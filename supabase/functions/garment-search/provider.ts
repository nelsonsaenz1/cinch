import { OpenRouterError, redactUrls, type ChatMessage, type ContentPart } from '../_shared/openrouter.ts';

import { guardedFetch, UnsafeUrlError } from './net.ts';
import {
  extractImageUrl,
  hostLabel,
  PAGE_ACCEPT,
  PAGE_MAX_BYTES,
  PAGE_TIMEOUT_MS,
} from './page-meta.ts';

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

export type ProviderResult = {
  candidates: GarmentCandidate[];
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
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/** Web search plus a model call is slower than a bare completion. */
const SEARCH_TIMEOUT_MS = 45_000;
/** Pages are resolved in parallel; this bounds the fan-out, not the results. */
const MAX_PAGES_RESOLVED = 10;

const SYSTEM_PROMPT = [
  'You identify clothing from a shopper\'s description and the web search results provided to you.',
  'Return only product or retailer pages that show the SPECIFIC garment described — the right brand,',
  'the right silhouette, the right colour. A page for a different colourway is a different garment.',
  'Never invent a URL: every pageUrl you return must be one of the URLs in the search results.',
  'Prefer the brand\'s own site over resellers, and a product page over a listicle or a blog post.',
  'confidence is your honest 0-1 estimate that this page shows the described garment.',
  'Return fewer candidates rather than padding the list with near-misses.',
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

/**
 * The default provider: OpenRouter's web plugin, then server-side resolution.
 *
 * `plugins` rather than the `:online` suffix, because the model id comes from
 * `ai_config` and string-concatenating a suffix onto an operator-editable value
 * is how you end up with `qwen/qwen3-vl:online:online` after one careless UPDATE.
 * The two are documented as equivalent.
 */
export function openRouterWebProvider(opts: {
  apiKey: string;
  model: string;
  maxTokens: number;
  params: Record<string, unknown>;
}): GarmentImageProvider {
  return {
    id: 'openrouter-web',

    async search(input: ProviderInput): Promise<ProviderResult> {
      const started = Date.now();

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
                name: 'garment_candidates',
                strict: true,
                schema: candidateSchema,
              },
            },
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

      let parsed: { candidates?: ModelCandidate[] };
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
      const accounting = {
        promptTokens: usage.prompt_tokens ?? null,
        completionTokens: usage.completion_tokens ?? null,
        costUsd: typeof usage.cost === 'number' ? usage.cost : null,
        latencyMs: Date.now() - started,
      };

      const verified = (parsed.candidates ?? [])
        .filter((candidate) => typeof candidate?.pageUrl === 'string')
        // The citation check. Dropping rather than trusting is the whole
        // anti-hallucination story of this file.
        .filter((candidate) => cited.has(citationKey(candidate.pageUrl)))
        .sort((a, b) => (Number(b.confidence) || 0) - (Number(a.confidence) || 0))
        .slice(0, MAX_PAGES_RESOLVED);

      const resolved = await Promise.all(
        verified.map(async (candidate): Promise<GarmentCandidate | null> => {
          try {
            const page = await guardedFetch(candidate.pageUrl, {
              accept: PAGE_ACCEPT,
              maxBytes: PAGE_MAX_BYTES,
              timeoutMs: PAGE_TIMEOUT_MS,
            });
            if (page.status !== 200 || !page.contentType.includes('html')) return null;

            const html = new TextDecoder('utf-8', { fatal: false }).decode(page.body);
            const imageUrl = extractImageUrl(html, page.url);
            if (!imageUrl) return null;

            // Vetted here so a candidate that could never be imported is never
            // offered — the import call re-checks, because that is the one that
            // downloads bytes.
            const image = new URL(imageUrl);

            return {
              imageUrl: image.toString(),
              title: String(candidate.title ?? '').slice(0, 120),
              source: hostLabel(page.url),
              confidence: Math.min(Math.max(Number(candidate.confidence) || 0, 0), 1),
            };
          } catch (err) {
            // A retailer that blocks bots, times out, or redirects somewhere
            // unsafe is a dropped tile, never a failed search.
            if (err instanceof UnsafeUrlError) return null;
            return null;
          }
        }),
      );

      const seen = new Set<string>();
      const candidates: GarmentCandidate[] = [];
      for (const candidate of resolved) {
        if (!candidate) continue;
        // Retailers syndicate the same asset across pages; two identical tiles
        // read as a broken grid.
        if (seen.has(candidate.imageUrl)) continue;
        seen.add(candidate.imageUrl);
        candidates.push(candidate);
        if (candidates.length >= input.maxCandidates) break;
      }

      return { candidates, ...accounting };
    },
  };
}
