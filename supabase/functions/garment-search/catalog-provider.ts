/**
 * The garment-image provider — `_shared/catalog.ts` wrapped in the source policy.
 *
 * WHY THIS IS SEPARATE FROM THE CATALOGUE CLIENT
 *
 * The Datafeedr client moved to `_shared` when `gap-shop-match` needed the same
 * licensed data. What did NOT move is this file, because what happens to a row
 * here is specific to closet imagery: the picture becomes the photograph of a
 * garment somebody owns and keeps for years, so `admitSource` governs where it
 * may come from. A shop suggestion has no such requirement — it is a link to a
 * listing, not a picture being adopted — so gap-shop-match calls the client
 * directly and applies its own judgement instead.
 */

import { admitSource, type Declined } from './policy.ts';
import { type CatalogProduct, type DatafeedrOpts, searchCatalogue } from '../_shared/catalog.ts';
import type {
  GarmentCandidate,
  GarmentImageProvider,
  ListingCandidate,
  MatchInput,
  MatchResult,
  ProviderInput,
  ProviderResult,
} from './provider.ts';

async function admitRows(
  rows: CatalogProduct[],
  limit: number,
): Promise<{ admitted: CatalogProduct[]; declined: Declined[] }> {
  const admitted: CatalogProduct[] = [];
  const declined: Declined[] = [];

  for (const row of rows) {
    if (admitted.length >= limit) break;

    let url: URL;
    try {
      url = new URL(row.linkUrl);
    } catch {
      continue; // not a URL we can judge, so not one we can offer
    }

    const reason = await admitSource(url);
    if (reason) {
      if (!declined.some((d) => d.source === row.sourceHost)) {
        declined.push({ source: row.sourceHost, reason });
      }
      continue;
    }
    admitted.push(row);
  }

  return { admitted, declined };
}

function toCandidate(p: CatalogProduct, confidence: number): GarmentCandidate {
  return {
    imageUrl: p.imageUrl,
    title: p.brand && !p.title.toLowerCase().startsWith(p.brand.toLowerCase())
      ? `${p.brand} ${p.title}`.slice(0, 200)
      : p.title,
    source: p.sourceHost,
    confidence,
  };
}

/**
 * Feeds have no model confidence, so we synthesise one from rank.
 *
 * This is deliberately a shallow decay rather than a real score: the ordering
 * already came from the provider's relevance, and inventing a confident-looking
 * number for a row we did not judge would be dishonest in exactly the way the
 * existing provider's comments warn about.
 */
function rankConfidence(index: number, total: number): number {
  if (total <= 1) return 0.8;
  return Number((0.85 - (index / total) * 0.35).toFixed(3));
}

export function datafeedrProvider(opts: DatafeedrOpts): GarmentImageProvider {
  return {
    id: 'datafeedr',

    async search(input: ProviderInput): Promise<ProviderResult> {
      const started = Date.now();
      const rows = await searchCatalogue(opts, 'keyword', input.description);
      const { admitted, declined } = await admitRows(rows, input.maxCandidates);

      const capped = admitted;
      return {
        candidates: capped.map((p, i) => toCandidate(p, rankConfidence(i, capped.length))),
        declined,
        // A feed lookup spends no tokens. Null rather than 0 so cost reporting
        // can tell "this provider has no token cost" from "we failed to read it".
        promptTokens: null,
        completionTokens: null,
        costUsd: null,
        latencyMs: Date.now() - started,
      };
    },

    /**
     * `match` is the photograph path, and a feed cannot do the hard half of it.
     *
     * Identifying a brand from a photo is a vision problem; a product feed only
     * answers "given these words, what is for sale". So this returns no brands
     * and leaves that to the model path, then uses the descriptor to find
     * listings. Returning an empty brand list is the honest answer — padding it
     * with guesses derived from feed titles would be inventing evidence.
     */
    async match(input: MatchInput): Promise<MatchResult> {
      const started = Date.now();
      // The brand goes to the `brand` FIELD rather than being concatenated into
      // the descriptor — see `buildQuery`. Concatenating it is what produced a
      // Zadig & Voltaire dress in answer to "Reformation".
      const rows = await searchCatalogue(opts, 'keyword', input.descriptor, input.brand);
      const { admitted, declined } = await admitRows(rows, input.maxCandidates);

      const capped = admitted;
      const candidates: ListingCandidate[] = capped.map((p, i) => ({
        ...toCandidate(p, rankConfidence(i, capped.length)),
        pageUrl: p.linkUrl,
      }));

      return {
        brands: [],
        candidates,
        declined,
        promptTokens: null,
        completionTokens: null,
        costUsd: null,
        latencyMs: Date.now() - started,
      };
    },
  };
}

/**
 * Which of the two paths the unlicensed model provider may still answer.
 *
 * These are separate flags because `search` and `match` ask the model for
 * different KINDS of thing, and only one of them raises a licensing question:
 *
 *   search  returns PHOTOGRAPHS. The web path finds them by resolving og:image
 *           from a page it was told about, which acquires no right to the
 *           picture. This is the one the whole licensed catalogue exists to
 *           replace, and it is off.
 *
 *   match   also returns a BRAND NAME read off a photograph the user took of
 *           their own garment. That is a vision judgement producing TEXT — no
 *           image is copied, so no licence is implicated. A product feed cannot
 *           do it at all: `datafeedrProvider.match` returns an empty brand list
 *           by construction, because inventing brands from feed titles would be
 *           fabricating evidence.
 *
 * Welding both to one switch meant turning off unlicensed imagery also turned
 * off brand identification, which no licensing argument asks for.
 */
export type UnlicensedFallback = {
  /** Images from the open web. Off once feed coverage is good enough. */
  search: boolean;
  /** Brand identification from the user's own photograph. */
  match: boolean;
};

/**
 * Try licensed sources first, fall back to the model path, and never the other
 * way round.
 *
 * The ordering is a legal statement, not a performance one. The web provider is
 * last because it is the only one whose images arrive without a licence, so it
 * should answer only what the licensed feeds could not.
 */
export function firstLicensed(
  providers: GarmentImageProvider[],
  fallback: GarmentImageProvider | null,
  allowUnlicensed: UnlicensedFallback,
): GarmentImageProvider {
  const searchChain = [...providers, ...(allowUnlicensed.search && fallback ? [fallback] : [])];
  const matchChain = [...providers, ...(allowUnlicensed.match && fallback ? [fallback] : [])];

  return {
    // Both chains, when they differ, because "which providers answered this"
    // is recorded against every call in `ai_calls` and a single id would make
    // the two paths indistinguishable in the accounting.
    id:
      searchChain.map((p) => p.id).join('>') === matchChain.map((p) => p.id).join('>')
        ? searchChain.map((p) => p.id).join('>')
        : `search:${searchChain.map((p) => p.id).join('>')} match:${matchChain.map((p) => p.id).join('>')}`,

    async search(input) {
      let last: ProviderResult | null = null;
      for (const p of searchChain) {
        const result = await p.search(input);
        last = result;
        if (result.candidates.length) return result;
      }
      return (
        last ?? {
          candidates: [],
          declined: [],
          promptTokens: null,
          completionTokens: null,
          costUsd: null,
          latencyMs: 0,
        }
      );
    },

    async match(input) {
      let last: MatchResult | null = null;
      for (const p of matchChain) {
        const result = await p.match(input);
        last = result;
        // Brands without candidates is still a useful answer — the model path
        // can name the brand even when no feed carries the piece — so this
        // stops on either, not on candidates alone.
        if (result.candidates.length || result.brands.length) return result;
      }
      return (
        last ?? {
          brands: [],
          candidates: [],
          declined: [],
          promptTokens: null,
          completionTokens: null,
          costUsd: null,
          latencyMs: 0,
        }
      );
    },
  };
}

