/**
 * CPV2-06 → CPV2-07 → CPV2-08. The only thing in this feature that writes.
 *
 * §11: "Only the explicit import action writes." Tapping a family opens a
 * screen; tapping a colour chip on a result card changes a preview; tapping a
 * colour row toggles client state. None of them reach this file. That is why
 * selection lives in `use-catalogue-flow.ts` as plain state and why this hook
 * takes the selection as an argument instead of reading it — a hook that could
 * see the selection is a hook that could be made to write on selection.
 *
 * §11 again: "an import is not atomic. Colourways succeed and fail
 * independently and successes are never rolled back." So the result is a LIST,
 * one row per colourway, and a failure is a row in it — never a thrown error
 * that discards the two that landed.
 *
 * PROVENANCE. `pageUrl` is the merchant's own product page, and sending it is
 * the fix for the gap Packet 2 left open: the server derives
 * `listing_source_label` from the URL it fetched, so an import that sends only
 * an image URL records a CDN hostname ("img.mrporter.com") as the place the
 * garment came from. `sourceHost` is deliberately NOT sent — the server
 * computes it from the page URL, and a client-supplied host would be a second
 * source of truth that could disagree with the URL beside it.
 */

import { FunctionsHttpError } from '@supabase/supabase-js';
import { useCallback, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';

import { catalogueImportCompleted, catalogueImportStarted } from './analytics';
import { tagImportedGarment } from '@/features/ingest/upload-queue';
import { classifyImportError, GENERIC, type ImportErrorOutcome } from './import-outcome';
import type { CatalogueColourway, CatalogueFamily } from './types';

export type { CapacityRefusal } from './import-outcome';

/** One colourway's outcome, mirroring the server's `ImportRowResult`. */
export type ImportRowResult = {
  externalId: string;
  status: 'added' | 'already-added' | 'failed';
  itemId?: string;
  error?: string;
  message?: string;
};

export type ImportOutcome =
  | { status: 'done'; results: ImportRowResult[]; added: number; alreadyAdded: number; failed: number }
  | ImportErrorOutcome;

type BatchResponse = {
  ok?: boolean;
  results?: ImportRowResult[];
  added?: number;
  alreadyAdded?: number;
  failed?: number;
};

async function readBody(error: unknown): Promise<Record<string, unknown> | null> {
  if (!(error instanceof FunctionsHttpError)) return null;
  try {
    const response = (error as { context?: unknown }).context as Response | undefined;
    return response ? ((await response.json()) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function useCatalogueImport() {
  const qc = useQueryClient();
  const [pending, setPending] = useState(false);

  /**
   * Import the selected colourways of one family.
   *
   * `family` is passed alongside so the title rides with each row: the piece
   * has no name of its own until tagging runs, and "Combed Cotton-Jersey
   * T-Shirt — Black" is what stops three imported colourways from appearing in
   * the closet as three identical blank cards.
   */
  const run = useCallback(
    async (
      family: CatalogueFamily,
      selected: readonly CatalogueColourway[],
      /**
       * The search's opaque intent key, when this import came from one.
       *
       * Optional and never required: this is how the server counts which
       * intents convert, and an import must not depend on a statistic. It is a
       * hash, not the words — see `use-catalogue-search.ts`.
       */
      intentKey?: string | null,
    ): Promise<ImportOutcome> => {
      if (selected.length === 0) return { status: 'error', message: GENERIC };
      if (pending) return { status: 'error', message: GENERIC };

      setPending(true);
      catalogueImportStarted(selected.length);

      try {
        const { data, error } = await supabase.functions.invoke<BatchResponse>('garment-search', {
          body: {
            action: 'import-batch',
            intentKey: intentKey ?? undefined,
            imports: selected.map((colour) => ({
              externalId: colour.externalId,
              imageUrl: colour.imageUrl ?? '',
              // The provenance fix. See the header.
              pageUrl: colour.pageUrl ?? undefined,
              title: family.title,
              colourLabel: colour.label,
            })),
          },
        });

        if (error) {
          // The one decision about a refusal lives in `import-outcome.ts` —
          // capacity, the consent gate, and the generic fallback, in one place
          // the tests can reach without a client.
          return classifyImportError(await readBody(error), selected.length);
        }

        const results = data?.results ?? [];
        const added = data?.added ?? 0;
        const alreadyAdded = data?.alreadyAdded ?? 0;
        const failed = data?.failed ?? 0;

        catalogueImportCompleted(added + alreadyAdded, failed);

        // The closet, the counts and the ceiling all moved. Same invalidation
        // set the single import uses.
        void qc.invalidateQueries({ queryKey: ['items'] });
        void qc.invalidateQueries({ queryKey: ['capacity'] });

        // Each new piece joins the tagging queue exactly as a photographed one
        // does — the catalogue photograph stands in as the rail thumbnail,
        // because it is the picture the user actually chose.
        for (const row of results) {
          if (row.status !== 'added' || !row.itemId) continue;
          const colour = selected.find((c) => c.externalId === row.externalId);
          if (colour?.imageUrl) void tagImportedGarment(row.itemId, colour.imageUrl);
        }

        return { status: 'done', results, added, alreadyAdded, failed };
      } catch {
        return { status: 'error', message: GENERIC };
      } finally {
        setPending(false);
      }
    },
    [pending, qc],
  );

  return { run, pending };
}
