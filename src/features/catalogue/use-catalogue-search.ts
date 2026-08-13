/**
 * The catalogue search — one call, whoever asked for it.
 *
 * THE FAILURE THIS FILE IS BUILT AROUND is the one you cannot see in a
 * simulator on a desk. Somebody types "james perse tee", waits, edits it to
 * "james perse henley", and the first request — slower, because it walked all
 * three ladder rungs and the second one hit the cache — lands second. Without a
 * sequence number the screen now shows tee families under the word "henley",
 * and every subsequent tap imports the wrong garment while looking entirely
 * correct.
 *
 * So every run takes a ticket. A response whose ticket is not the current one
 * is dropped on the floor: not rendered, not tracked, not turned into an error.
 * `tests/catalogue-stale.test.ts` runs exactly that overtaking case.
 *
 * THE SECOND THING IT DOES is refuse to spend an AI consent it does not need.
 * The server (Packet 1) moved `action: 'search'` above the consent gate, so
 * typed search now works with AI processing switched off. The old client
 * mapped `ai_consent_required` to a sentence and showed it; that sentence is
 * now unreachable for this path and `search-failure.ts` has been corrected to
 * match. Nothing here re-adds it.
 */

import { FunctionsHttpError } from '@supabase/supabase-js';
import { useCallback, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';

import { catalogueSearchCompleted, catalogueSearchFailed, catalogueSearchStarted } from './analytics';
import type { CatalogueFamilies } from './types';
import type { CatalogueQuery } from './query';

/** The four notices CPV2-10 draws, plus the empty answer CPV2-09 draws. */
export type CatalogueFailure =
  | 'offline'
  | 'timeout'
  | 'quota'
  | 'partner_unavailable';

export type CatalogueSearchState =
  | { status: 'idle' }
  | { status: 'searching'; query: CatalogueQuery }
  | { status: 'results'; query: CatalogueQuery; families: CatalogueFamilies }
  | { status: 'empty'; query: CatalogueQuery }
  | { status: 'failed'; query: CatalogueQuery; failure: CatalogueFailure; code: string | null };

type SearchResponse = {
  families?: CatalogueFamilies | null;
};

/**
 * Server codes → the four notices.
 *
 * `catalogue_unavailable` is Packet 1's fail-closed code: the licensed feed is
 * not configured, so nothing could have answered. It maps to
 * `partner_unavailable` and NOT to an empty result, because "the catalogue has
 * nothing" and "the catalogue was never asked" are different sentences and only
 * one of them is true.
 */
function failureFor(code: string | null): CatalogueFailure {
  switch (code) {
    case 'ai_quota_exceeded':
    case 'quota_unavailable':
      return 'quota';
    case 'search_timeout':
      return 'timeout';
    case 'catalogue_unavailable':
    case 'search_disabled':
    case 'search_failed':
      return 'partner_unavailable';
    default:
      return 'partner_unavailable';
  }
}

async function readCode(error: unknown): Promise<string | null> {
  if (!(error instanceof FunctionsHttpError)) return null;
  try {
    const response = (error as { context?: unknown }).context as Response | undefined;
    if (!response) return null;
    const body = (await response.json()) as { error?: string };
    return body.error ?? null;
  } catch {
    return null;
  }
}

/**
 * Whether the device believes it is offline.
 *
 * Read from the failure rather than from a network listener: an added
 * dependency is out of scope for this packet, and a fetch that never left the
 * device is the only offline that matters here. `TypeError: Network request
 * failed` is what React Native's fetch throws for it.
 */
function looksOffline(error: unknown): boolean {
  return error instanceof TypeError && /network request failed/i.test(error.message);
}

export function useCatalogueSearch() {
  const [state, setState] = useState<CatalogueSearchState>({ status: 'idle' });

  // The ticket. A ref rather than state: it must be readable synchronously by
  // a resolution that happens after several awaits, and a state read there
  // would see the value from the render that started the request.
  const ticket = useRef(0);

  /**
   * Stop caring about whatever is in flight.
   *
   * Called on edit and on close. It cannot abort the request — the function
   * invoke has no signal — so it does the honest equivalent: burns the ticket,
   * which means the answer arrives and is ignored. The metered request is
   * already spent either way; what this prevents is it being spent on the
   * user's behalf and then shown to them under different words.
   */
  const cancel = useCallback(() => {
    ticket.current += 1;
  }, []);

  const reset = useCallback(() => {
    ticket.current += 1;
    setState({ status: 'idle' });
  }, []);

  const run = useCallback(async (query: CatalogueQuery) => {
    ticket.current += 1;
    const mine = ticket.current;
    const startedAt = Date.now();

    setState({ status: 'searching', query });
    catalogueSearchStarted(query.path, query.namedColours.length > 0);

    try {
      const { data, error } = await supabase.functions.invoke<SearchResponse>('garment-search', {
        body: { action: 'search', description: query.text },
      });

      if (mine !== ticket.current) return; // overtaken — see the header

      if (error) {
        const code = await readCode(error);
        catalogueSearchFailed(code);
        setState({ status: 'failed', query, failure: failureFor(code), code });
        return;
      }

      // `families: null` means the grouping pass itself failed server-side. It
      // is NOT an empty catalogue, and CPV2-09's "this is the whole answer"
      // would be a lie in front of it.
      const families = data?.families ?? null;
      if (!families) {
        catalogueSearchFailed('partner_unavailable');
        setState({ status: 'failed', query, failure: 'partner_unavailable', code: null });
        return;
      }

      const total = families.exact.length + families.nearMiss.length;
      catalogueSearchCompleted(total, Date.now() - startedAt);

      setState(
        total === 0 ? { status: 'empty', query } : { status: 'results', query, families },
      );
    } catch (err) {
      if (mine !== ticket.current) return;
      const offline = looksOffline(err);
      catalogueSearchFailed(offline ? 'offline' : null);
      setState({
        status: 'failed',
        query,
        failure: offline ? 'offline' : 'partner_unavailable',
        code: offline ? 'offline' : null,
      });
    }
  }, []);

  return { state, run, cancel, reset };
}
