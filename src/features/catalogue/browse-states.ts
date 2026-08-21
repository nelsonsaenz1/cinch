/**
 * The browse grid's state machine, with React and the network taken out.
 *
 * Same arrangement `saved-looks/states.ts` uses and for the same reason: the
 * repo's test runner has no renderer, so the transitions worth defending live
 * here as pure functions and `use-catalogue-browse.ts` only wires them to the
 * invoke. `tests/catalogue-browse.test.ts` exercises these directly.
 *
 * THE CONFUSION EACH STATE EXISTS TO PREVENT, because every pair below has
 * shipped as one screen somewhere before:
 *
 *   · `loaded` with no families versus `failed` — "this category has nothing"
 *     is a sentence about the catalogue; "the catalogue could not be reached"
 *     is a sentence about us. Only one of them is true at a time.
 *   · `offline` versus `failed` — one is fixed by walking to a window, and the
 *     notice should say so rather than blaming the catalogue.
 */

import type { CatalogueFailure } from './use-catalogue-search';
import type { CatalogueFamilies } from './types';
import type { CatalogueBrowseSlot } from './browse-spec';

export type CatalogueBrowseState =
  | { status: 'idle' }
  | { status: 'loading'; slot: CatalogueBrowseSlot }
  | { status: 'loaded'; slot: CatalogueBrowseSlot; families: CatalogueFamilies }
  | { status: 'offline'; slot: CatalogueBrowseSlot }
  | { status: 'failed'; slot: CatalogueBrowseSlot; failure: CatalogueFailure; code: string | null };

/**
 * What the invoke came back with, flattened to the three things that can
 * happen to it. The hook builds one of these; nothing else reaches the
 * transition.
 */
export type BrowseOutcome =
  | { kind: 'response'; families: CatalogueFamilies | null }
  | { kind: 'error'; code: string | null }
  | { kind: 'thrown'; offline: boolean };

/**
 * Server codes → the same notices the typed search draws (CPV2-10's four),
 * because a browse fails in exactly the ways a search does and inventing a
 * fifth sentence would mean maintaining a second table of the same truths.
 * `catalogue_unavailable` is the fail-closed code and maps to
 * `partner_unavailable`, never to an empty grid — "never asked" is not
 * "has nothing".
 */
export function browseFailureFor(code: string | null): CatalogueFailure {
  switch (code) {
    case 'search_timeout':
      return 'timeout';
    default:
      return 'partner_unavailable';
  }
}

/** The one transition out of `loading`. */
export function browseStateFor(
  slot: CatalogueBrowseSlot,
  outcome: BrowseOutcome,
): CatalogueBrowseState {
  if (outcome.kind === 'thrown') {
    return outcome.offline
      ? { status: 'offline', slot }
      : { status: 'failed', slot, failure: 'partner_unavailable', code: null };
  }
  if (outcome.kind === 'error') {
    return { status: 'failed', slot, failure: browseFailureFor(outcome.code), code: outcome.code };
  }
  // `families: null` means the grouping itself was unavailable server-side —
  // a failure, not an empty category, exactly as the typed search reads it.
  if (!outcome.families) {
    return { status: 'failed', slot, failure: 'partner_unavailable', code: null };
  }
  return { status: 'loaded', slot, families: outcome.families };
}
