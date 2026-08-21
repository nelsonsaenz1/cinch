/**
 * The category grid — the catalogue entered without words.
 *
 * A tap on one of nine tiles sends `{ action: 'browse', slot }` and nothing
 * else: no description, no transcript, no field the server could read words
 * out of. That is the whole privacy story of this hook, and it is enforced at
 * both ends — `bounds.ts` 400s a browse that carries text, and
 * `tests/catalogue-browse.test.ts` pins that the body built here has exactly
 * two keys.
 *
 * EVERY RUN IS A TAP. Same rule as the search: no effect fires a request, so
 * opening the flow costs nothing and nine tiles cannot become nine requests.
 * The overtaking protection is the search hook's ticket, borrowed whole — two
 * quick taps on different tiles must not let the slower answer land under the
 * faster tile's name.
 *
 * The transitions themselves are pure and live in `browse-states.ts`; this
 * file only owns the invoke and the ticket.
 */

import { useCallback, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';

import type { CatalogueBrowseSlot } from './browse-spec';
import {
  browseStateFor,
  type BrowseOutcome,
  type CatalogueBrowseState,
} from './browse-states';
import type { CatalogueFamilies } from './types';
import { looksOffline, readCode } from './use-catalogue-search';

type BrowseResponse = {
  families?: CatalogueFamilies | null;
};

export function useCatalogueBrowse() {
  const [state, setState] = useState<CatalogueBrowseState>({ status: 'idle' });

  // The ticket — see `use-catalogue-search.ts` for why a ref and not state.
  const ticket = useRef(0);

  /** Burn the ticket; whatever is in flight lands unrendered. */
  const cancel = useCallback(() => {
    ticket.current += 1;
  }, []);

  const reset = useCallback(() => {
    ticket.current += 1;
    setState({ status: 'idle' });
  }, []);

  const run = useCallback(async (slot: CatalogueBrowseSlot) => {
    ticket.current += 1;
    const mine = ticket.current;

    setState({ status: 'loading', slot });

    let outcome: BrowseOutcome;
    try {
      const { data, error } = await supabase.functions.invoke<BrowseResponse>('garment-search', {
        // The slot and the action. Nothing typed can reach this body because
        // nothing typed is in scope — the tile is the whole input.
        body: { action: 'browse', slot },
      });
      outcome = error
        ? { kind: 'error', code: await readCode(error) }
        : { kind: 'response', families: data?.families ?? null };
    } catch (err) {
      outcome = { kind: 'thrown', offline: looksOffline(err) };
    }

    if (mine !== ticket.current) return; // overtaken — a later tap owns the screen
    setState(browseStateFor(slot, outcome));
  }, []);

  return { state, run, cancel, reset };
}
