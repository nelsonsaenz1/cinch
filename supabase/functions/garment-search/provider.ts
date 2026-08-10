import { OpenRouterError, redactUrls, type ChatMessage, type ContentPart } from '../_shared/openrouter.ts';

import { guardedFetch, UnsafeUrlError } from './net.ts';
import {
  extractImageUrl,
  hostLabel,
  PAGE_ACCEPT,
  PAGE_MAX_BYTES,
  PAGE_TIMEOUT_MS,
} from './page-meta.ts';
import {
  admitContent,
  admitSource,
  isPreferredSource,
  PREFERENCE_BONUS,
  type Declined,
  type DeclineReason,
} from './policy.ts';

/**
 * Finding a photograph of a garment somebody described in words.
 *
 * WHY THIS IS A PROVIDER INTERFACE AND NOT JUST A FUNCTION
 *
 * There are three ways to get product images programmatically and they have
 * very different costs. A dedicated image-search API (Google Custom Search in
 * image mode, SerpAPI, Exa's own image references) returns image URLs directly
 * and would be the better answer — but each needs a key the project does not
 * have, in a repo whose edge secrets today hold exactly one: OPENROUTER_API_KEY.
 * Shipping is worth more than the last 10% of quality, so the default
 * implementation buys zero new keys, and this interface is where a better one
 * drops in without any caller changing.
 *
 * WHAT THE DEFAULT ACTUALLY DOES, AND WHY IT IS SHAPED THIS WAY
 *
 * OpenRouter's web plugin (`:online`, or `plugins: [{ id: 'web' }]`) is Exa
 * behind an LLM. It returns `message.annotations[]` of type `url_citation`,
 * each carrying `{ url, title, content }` — a PAGE and an extract of its TEXT.
 * It does not return image URLs. So a design that asks the model for an
 * `imageUrl` is asking it to invent a string that happens to 200 — which is
 * hallucination with a plausible shape, and the failure mode is a grid of
 * broken tiles.
 *
 * The split used instead:
 *
 *   the model      ranks and interprets — which of these cited pages is
 *                  actually a navy Reformation midi dress
 *   this function  resolves and verifies — the page's own `og:image`, which is
 *                  the hero product shot every retailer publishes for the sake
 *                  of link previews, fetched and proven to exist
 *
 * A candidate whose page URL is not in the citation list is dropped before any
 * of that: it is a URL the model produced from memory rather than from the
 * search, and it is the one class of answer we can cheaply prove untrustworthy.
 *
 * A THIRD PARTY GETS A VOTE. Between "the model cited this page" and "we
 * fetched it" sits `policy.ts`, which asks the site whether it wants to be read
 * at all. Pages it refuses do not become tiles and do not become silence
 * either — they come back as `declined[]`, one line per host, alongside
 * whatever did survive. See that file for why this is not an allowlist.
 *
 * `match` is the same machinery entered from the other side: instead of words
 * that describe a garment nobody has photographed, it takes the photograph of a
 * garment the closet already holds and asks two questions — who plausibly made
 * this, and where is it sold. Same web plugin, same citation check, same
 * server-side og:image resolution; the only new ingredient is the image part.
 */

export type GarmentCandidate = {
  /** Absolute https URL of the product image. Downloaded server-side on import. */
  imageUrl: string;
  /** What the model thinks this garment is. Shown under the tile. */
  title: string;
  /** Host the image came from, e.g. "reformation.com". Never a full URL. */
  source: string;
  /** The model's own 0–1 confidence. Used for ordering, never as a gate. */
  confidence: number;
};

/**
 * A candidate that keeps its page URL, because the caller needs it back.
 *
 * `search` ends at the image — the user imports the picture and the page is
 * disposable. `match` ends at `attach`, which records WHERE the listing lives
 * on the item, so the page URL is part of the answer rather than plumbing.
 */
export type ListingCandidate = GarmentCandidate & {
  /** The product page the image was resolved from. Handed back to `attach`. */
  pageUrl: string;
};

export type ProviderResult = {
  candidates: GarmentCandidate[];
  /**
   * Sources the policy refused, one entry per host, in the order they were
   * dropped. Rides alongside the candidates rather than replacing them: a
   * search that found four tiles and refused two is a normal search, and the
   * screen should show four tiles and one honest line.
   */
  declined: Declined[];
  promptTokens: number | null;
  completionTokens: number | null;
  costUsd: number | null;
  latencyMs: number;
};

export type ProviderInput = {
  /** The user's own words. Already length-bounded by the caller. */
  description: string;
  /** Optional `data:image/jpeg;base64,…` colour swatch, small by construction. */
  swatchDataUrl?: string;
  /** How many tiles the client will show. */
  maxCandidates: number;
};

export type MatchInput = {
  /** What the closet already knows, rendered as one line by the caller. */
  descriptor: string;
  /** Short-lived signed URL of the item's own photograph. Never logged. */
  photoUrl: string;
  /** The user's brand, when they gave one. Absence IS the unscoped fallback. */
  brand?: string;
  /** How many tiles the client will show. */
  maxCandidates: number;
};

export type MatchResult = {
  /** Up to five brand names, most likely first. May be empty, never padded. */
  brands: string[];
  candidates: ListingCandidate[];
  /** Same contract as `ProviderResult.declined`. */
  declined: Declined[];
  promptTokens: number | null;
  completionTokens: number | null;
  costUsd: number | null;
  latencyMs: number;
};

/**
 * The seam a dedicated image-search API slots into later.
 *
 * Anything satisfying this — Exa `/search` with `x-exa-image-references`, Google
 * CSE `searchType=image`, SerpAPI — replaces the default without touching
 * index.ts, which only knows this type.
 */
export interface GarmentImageProvider {
  /** Stable identifier, written to `ai_calls.provider` for cost attribution. */
  readonly id: string;
  search(input: ProviderInput): Promise<ProviderResult>;
  match(input: MatchInput): Promise<MatchResult>;
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/** Web search plus a model call is slower than a bare completion. */
const SEARCH_TIMEOUT_MS = 45_000;
/** Pages are resolved in parallel; this bounds the fan-out, not the results. */
const MAX_PAGES_RESOLVED = 10;
/** Enough guesses to be useful, few enough that each one means something. */
const MAX_BRANDS = 5;
/** Mirrors the title cap: a brand longer than this is not a brand name. */
const MAX_BRAND_CHARS = 80;

const SYSTEM_PROMPT = [
  'You identify clothing from a shopper\'s description and the web search results provided to you.',
  'Return only product or retailer pages that show the SPECIFIC garment described — the right brand,',
  'the right silhouette, the right colour. A page for a different colourway is a different garment.',
  'Never invent a URL: every pageUrl you return must be one of the URLs in the search results.',
  'Prefer the brand\'s own site over resellers, and a product page over a listicle or a blog post.',
  'confidence is your honest 0-1 estimate that this page shows the described garment.',
  'Return fewer candidates rather than padding the list with near-misses.',
].join(' ');

const MATCH_SYSTEM_PROMPT = [
  'You are shown a photograph of a garment somebody owns, together with what their wardrobe app',
  'already knows about it. You have two jobs.',
  'First, name up to five brands that plausibly made this piece, most likely first. Read a label or',
  'wordmark if the photograph shows one; otherwise judge from construction, hardware and styling.',
  'Return fewer names rather than padding the list with guesses.',
  'Second, return product or retailer pages from the web search results that show this garment or',
  'one nearly identical to it — the same silhouette, the same colour, the same details.',
  'Never invent a URL: every pageUrl you return must be one of the URLs in the search results.',
  'Prefer the brand\'s own site over resellers, and a product page over a listicle or a blog post.',
  'confidence is your honest 0-1 estimate that this page shows this garment.',
].join(' ');

const candidateSchema = {
  type: 'object',
  properties: {
    candidates: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          pageUrl: { type: 'string', description: 'Exact URL from the search results.' },
          title: { type: 'string', description: 'Brand and garment, e.g. "Reformation Gemma Dress".' },
          confidence: { type: 'number', description: '0-1.' },
        },
        required: ['pageUrl', 'title', 'confidence'],
        additionalProperties: false,
      },
    },
  },
  required: ['candidates'],
  additionalProperties: false,
} as const;

/** Same candidate rows as `candidateSchema`, plus the brand guesses. Sharing
 *  the inner definition is what keeps the two shapes from drifting apart. */
const matchSchema = {
  type: 'object',
  properties: {
    brands: {
      type: 'array',
      items: {
        type: 'string',
        description: 'A brand name, e.g. "Reformation". Most likely first.',
      },
    },
    candidates: candidateSchema.properties.candidates,
  },
  required: ['brands', 'candidates'],
  additionalProperties: false,
} as const;

type ModelCandidate = { pageUrl: string; title: string; confidence: number };

type Annotation = {
  type?: string;
  url_citation?: { url?: string; title?: string };
};

/** Normalized for comparison only — never for fetching. */
function citationKey(raw: string): string {
  try {
    const url = new URL(raw);
    url.hash = '';
    return `${url.hostname.toLowerCase().replace(/^www\./, '')}${url.pathname.replace(/\/$/, '')}`;
  } catch {
    return raw;
  }
}

type ProviderOpts = {
  apiKey: string;
  model: string;
  maxTokens: number;
  params: Record<string, unknown>;
};

type WebCompletion = {
  /** The model's parsed JSON object. Shape-checked by the caller, not here. */
  parsed: unknown;
  /** Every page the plugin actually retrieved, keyed for comparison. */
  cited: Map<string, string>;
  promptTokens: number | null;
  completionTokens: number | null;
  costUsd: number | null;
  latencyMs: number;
};

/**
 * One web-searching model call: fetch, error mapping, citation harvest,
 * accounting. `search` and `match` differ only in what they ask and what shape
 * the answer takes, so everything that must NOT differ between them lives here.
 */
async function completeWithWebSearch(
  opts: ProviderOpts,
  messages: ChatMessage[],
  schemaName: string,
  schema: unknown,
): Promise<WebCompletion> {
  const started = Date.now();

  let response: Response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${opts.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://cinch.app',
        'X-Title': 'Cinch',
      },
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
      body: JSON.stringify({
        model: opts.model,
        messages,
        max_tokens: opts.maxTokens,
        ...opts.params,
        // Exa named explicitly rather than left to `auto`: it is the engine
        // whose citations carry page extracts, which is what the model is
        // being asked to judge. `max_results` is the search's own cost knob
        // ($0.005 covers ten; each further result is another $0.001).
        plugins: [
          {
            id: 'web',
            engine: 'exa',
            max_results: MAX_PAGES_RESOLVED,
            search_prompt: 'Shopping results for this garment:',
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: schemaName,
            strict: true,
            schema,
          },
        },
        /**
         * Same routing restriction as `_shared/openrouter.ts`, and it matters
         * more here than anywhere: this is the second door a photograph leaves
         * by. `match` signs the user's own garment photo and sends it to a
         * vision model, so the provider that receives it must be one that does
         * not train on it.
         *
         * THE HOLE THIS DOES NOT CLOSE. OpenRouter documents its guarantees as
         * not applying to plugin traffic, and the `plugins` block above sends
         * the search leg through Exa. So the model call is covered by this and
         * the web search is not — which is why the privacy copy names the
         * listing search as its own thing rather than folding it in with
         * tagging. See docs/ai-provider-terms.md §2.4.
         *
         * Exa's own terms have since been read, and the hole is wider than
         * "uncovered": Exa's Terms of Service take a "perpetual and
         * irrevocable" licence over User Input, and its privacy policy says
         * query data trains its models. Neither statement has a per-request
         * parameter that switches it off, and no field in this body reaches
         * Exa's contract. What the search leg sends is therefore a design
         * question, not a configuration one — which is why the descriptor
         * built by `describeItem` is capped, tag-derived and never the user's
         * own free text. See docs/ai-provider-terms.md §2.8.
         */
        provider: { data_collection: 'deny' },
        usage: { include: true },
      }),
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : '';
    throw new OpenRouterError(
      name === 'TimeoutError'
        ? `Search did not finish within ${SEARCH_TIMEOUT_MS}ms.`
        : `Search request failed: ${redactUrls(err instanceof Error ? err.message : String(err))}`,
      undefined,
      true,
    );
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new OpenRouterError(
      `OpenRouter ${response.status}: ${redactUrls(body).slice(0, 400)}`,
      response.status,
      response.status === 429 || response.status >= 500,
    );
  }

  const json = await response.json();
  const message = json?.choices?.[0]?.message;

  if (json?.choices?.[0]?.finish_reason === 'length') {
    throw new OpenRouterError('Model output hit max_tokens before completing the object.');
  }

  const raw = message?.content;
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new OpenRouterError('Model returned no content.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new OpenRouterError(`Model returned non-JSON content: ${redactUrls(raw).slice(0, 200)}`);
  }

  // The citation set. Every page the plugin actually retrieved, and
  // therefore the only pages a candidate may point at.
  const cited = new Map<string, string>();
  for (const annotation of (message?.annotations ?? []) as Annotation[]) {
    const url = annotation?.url_citation?.url;
    if (annotation?.type === 'url_citation' && typeof url === 'string') {
      cited.set(citationKey(url), url);
    }
  }

  const usage = json?.usage ?? {};
  return {
    parsed,
    cited,
    promptTokens: usage.prompt_tokens ?? null,
    completionTokens: usage.completion_tokens ?? null,
    costUsd: typeof usage.cost === 'number' ? usage.cost : null,
    latencyMs: Date.now() - started,
  };
}

/** One resolved candidate, or the reason its source was refused. A union
 *  rather than a nullable, so a refusal cannot be dropped by forgetting to
 *  look at it. */
type Resolution =
  | { ok: true; candidate: ListingCandidate }
  | { ok: false; source: string; reason: DeclineReason }
  | { ok: false; source: null; reason: null };

/**
 * Verify the model's candidates against the citations, then turn each surviving
 * page into a tile with a proven image.
 *
 * TWO KINDS OF LOSS, KEPT APART. A page can fail to become a tile because it
 * broke — a timeout, a JavaScript-rendered page with no Open Graph tags, an
 * unsafe redirect — or because its owner told us not to. The first is our
 * problem and the user gains nothing from hearing about it; the second is the
 * site exercising a choice, and saying so is the difference between a policy
 * and a silent filter. Only the second travels back as a `Declined`.
 *
 * The policy check runs BEFORE the page fetch, which is the only order that
 * means anything: a `robots.txt` consulted after the request it governs is a
 * receipt, not a rule.
 */
async function resolveAgainstCitations(
  modelCandidates: ModelCandidate[] | undefined,
  cited: Map<string, string>,
  maxCandidates: number,
): Promise<{ candidates: ListingCandidate[]; declined: Declined[] }> {
  const verified = (modelCandidates ?? [])
    .filter((candidate) => typeof candidate?.pageUrl === 'string')
    // The citation check. Dropping rather than trusting is the whole
    // anti-hallucination story of this file.
    .filter((candidate) => cited.has(citationKey(candidate.pageUrl)))
    // Confidence orders the list; a source we could hold a written
    // relationship with gets a nudge and never a veto. See `PREFERENCE_BONUS`.
    .sort((a, b) => rank(b) - rank(a))
    .slice(0, MAX_PAGES_RESOLVED);

  const resolved = await Promise.all(
    verified.map(async (candidate): Promise<Resolution> => {
      let pageUrl: URL;
      try {
        pageUrl = new URL(candidate.pageUrl);
      } catch {
        return { ok: false, source: null, reason: null };
      }

      const pageVerdict = await admitSource(pageUrl);
      if (pageVerdict) {
        return { ok: false, source: hostLabel(pageUrl), reason: pageVerdict };
      }

      try {
        const page = await guardedFetch(candidate.pageUrl, {
          accept: PAGE_ACCEPT,
          maxBytes: PAGE_MAX_BYTES,
          timeoutMs: PAGE_TIMEOUT_MS,
        });
        if (page.status !== 200 || !page.contentType.includes('html')) {
          return { ok: false, source: null, reason: null };
        }

        const html = new TextDecoder('utf-8', { fatal: false }).decode(page.body);

        // The page's own directives, readable only now that it has arrived.
        const contentVerdict = admitContent(page.headers, html);
        if (contentVerdict) {
          return { ok: false, source: hostLabel(page.url), reason: contentVerdict };
        }

        const imageUrl = extractImageUrl(html, page.url);
        if (!imageUrl) return { ok: false, source: null, reason: null };

        // Vetted here so a candidate that could never be imported is never
        // offered — the import call re-checks, because that is the one that
        // downloads bytes.
        const image = new URL(imageUrl);

        // The image is frequently on a different host from the page — a CDN,
        // sometimes a shared one — and that host's rules are the ones that
        // govern the bytes we would store. Checking only the page would be
        // checking the wrong site.
        const imageVerdict = await admitSource(image);
        if (imageVerdict) {
          return { ok: false, source: hostLabel(image), reason: imageVerdict };
        }

        return {
          ok: true,
          candidate: {
            imageUrl: image.toString(),
            // The page actually reached, after redirects — not the model's string.
            pageUrl: page.url.toString(),
            title: String(candidate.title ?? '').slice(0, 120),
            source: hostLabel(page.url),
            confidence: Math.min(Math.max(Number(candidate.confidence) || 0, 0), 1),
          },
        };
      } catch (err) {
        // A retailer that blocks bots, times out, or redirects somewhere
        // unsafe is a dropped tile, never a failed search.
        if (err instanceof UnsafeUrlError) return { ok: false, source: null, reason: null };
        return { ok: false, source: null, reason: null };
      }
    }),
  );

  const seen = new Set<string>();
  const declinedHosts = new Set<string>();
  const candidates: ListingCandidate[] = [];
  const declined: Declined[] = [];

  for (const entry of resolved) {
    if (!entry.ok) {
      // One line per host: three refused pages at one shop is one fact.
      if (entry.reason && !declinedHosts.has(entry.source)) {
        declinedHosts.add(entry.source);
        declined.push({ source: entry.source, reason: entry.reason });
      }
      continue;
    }
    // Retailers syndicate the same asset across pages; two identical tiles
    // read as a broken grid.
    if (seen.has(entry.candidate.imageUrl)) continue;
    seen.add(entry.candidate.imageUrl);
    candidates.push(entry.candidate);
    if (candidates.length >= maxCandidates) break;
  }

  return { candidates, declined };
}

/** Ordering score: the model's confidence, nudged toward sources whose
 *  affiliate programme a human could actually join. */
function rank(candidate: ModelCandidate): number {
  const confidence = Number(candidate.confidence) || 0;
  try {
    return isPreferredSource(new URL(candidate.pageUrl)) ? confidence + PREFERENCE_BONUS : confidence;
  } catch {
    return confidence;
  }
}

/**
 * The default provider: OpenRouter's web plugin, then server-side resolution.
 *
 * `plugins` rather than the `:online` suffix, because the model id comes from
 * `ai_config` and string-concatenating a suffix onto an operator-editable value
 * is how you end up with `qwen/qwen3-vl:online:online` after one careless UPDATE.
 * The two are documented as equivalent.
 */
export function openRouterWebProvider(opts: ProviderOpts): GarmentImageProvider {
  return {
    id: 'openrouter-web',

    async search(input: ProviderInput): Promise<ProviderResult> {
      const parts: ContentPart[] = [];
      if (input.swatchDataUrl) {
        parts.push({ type: 'image_url', image_url: { url: input.swatchDataUrl } });
        parts.push({
          type: 'text',
          text: 'The attached photo shows the real colour and fabric of the garment. Match it.',
        });
      }
      parts.push({ type: 'text', text: `Find this garment: ${input.description}` });

      const messages: ChatMessage[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: parts },
      ];

      const completion = await completeWithWebSearch(
        opts,
        messages,
        'garment_candidates',
        candidateSchema,
      );

      const parsed = completion.parsed as { candidates?: ModelCandidate[] };
      const listings = await resolveAgainstCitations(
        parsed.candidates,
        completion.cited,
        input.maxCandidates,
      );

      return {
        // `search` never needed the page URL — the user imports the picture and
        // the page is disposable — so its wire shape stays exactly as shipped.
        candidates: listings.candidates.map(({ imageUrl, title, source, confidence }) => ({
          imageUrl,
          title,
          source,
          confidence,
        })),
        declined: listings.declined,
        promptTokens: completion.promptTokens,
        completionTokens: completion.completionTokens,
        costUsd: completion.costUsd,
        latencyMs: completion.latencyMs,
      };
    },

    async match(input: MatchInput): Promise<MatchResult> {
      const parts: ContentPart[] = [
        // The photograph leads: it is the ground truth the descriptor merely
        // summarizes, and a vision model weighs what it sees first.
        { type: 'image_url', image_url: { url: input.photoUrl } },
        {
          type: 'text',
          text: `The photograph shows the garment. What the closet already knows about it: ${input.descriptor}`,
        },
      ];
      if (input.brand) {
        parts.push({
          type: 'text',
          text:
            `The owner says the brand is ${input.brand}. ` +
            `Search for ${input.brand} listings and return only pages selling ${input.brand} pieces.`,
        });
      }
      parts.push({ type: 'text', text: 'Find product listings for this garment.' });

      const messages: ChatMessage[] = [
        { role: 'system', content: MATCH_SYSTEM_PROMPT },
        { role: 'user', content: parts },
      ];

      const completion = await completeWithWebSearch(opts, messages, 'garment_match', matchSchema);

      const parsed = completion.parsed as { brands?: unknown; candidates?: ModelCandidate[] };

      // Deduplicated case-insensitively, because "Levi's" and "levi's" are one
      // guess, and a repeated name is padding wearing a disguise.
      const seen = new Set<string>();
      const brands: string[] = [];
      for (const entry of Array.isArray(parsed.brands) ? parsed.brands : []) {
        if (typeof entry !== 'string') continue;
        const name = entry.trim().slice(0, MAX_BRAND_CHARS);
        if (!name) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        brands.push(name);
        if (brands.length >= MAX_BRANDS) break;
      }

      const listings = await resolveAgainstCitations(
        parsed.candidates,
        completion.cited,
        input.maxCandidates,
      );

      return {
        brands,
        candidates: listings.candidates,
        declined: listings.declined,
        promptTokens: completion.promptTokens,
        completionTokens: completion.completionTokens,
        costUsd: completion.costUsd,
        latencyMs: completion.latencyMs,
      };
    },
  };
}
