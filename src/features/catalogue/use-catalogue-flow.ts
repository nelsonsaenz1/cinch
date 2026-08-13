/**
 * The state machine behind CPV2-01…CPV2-11, and the seam the dev routes pose.
 *
 * WHY A VIEW OBJECT. Every screen in this feature renders from
 * `CatalogueFlowView` and nothing else — no screen calls a hook of its own. The
 * dev fixture routes then build that object by hand with inert callbacks, which
 * is how Codex gets all fourteen states to look at without a single production
 * write. It is the same seam `GarmentSearchSheetBody` already uses; this file
 * just makes it the rule rather than the exception.
 *
 * WHAT IS NOT IN HERE. There is no `search-on-type`, no debounce that fires a
 * request, and no effect that runs a query. Every request in this feature is
 * the direct result of a tap — which is what §7 means by "one catalogue request
 * per garment the user asks about", and what stops the bulk walkthrough from
 * quietly becoming seven requests.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { getUserId } from '@/lib/supabase';

import { catalogueColoursSelected, catalogueFamilyOpened } from './analytics';
import { holdSelection, readHeldSelection, releaseHeldSelection } from './held-selection';
import {
  isSearchableQuery,
  normaliseCatalogueQuery,
  sameQuery,
  type CataloguePath,
} from './query';
import type { CatalogueColourway, CatalogueFamily } from './types';
import { useCatalogueImport, type CapacityRefusal, type ImportRowResult } from './use-catalogue-import';
import { useCatalogueSearch, type CatalogueSearchState } from './use-catalogue-search';

/** Where the user is. One value, so two screens can never both think they are open. */
export type CatalogueStep =
  | 'search' // CPV2-01/02/03/04/09/10
  | 'detail' // CPV2-05/12
  | 'confirm' // CPV2-06/11
  | 'importing' // CPV2-07
  | 'done'; // CPV2-08

export type CatalogueFlowView = {
  step: CatalogueStep;

  // ── The field (CPV2-01, CPV2-03) ──────────────────────────────────────────
  text: string;
  setText: (next: string) => void;
  /** Whether there is enough typed to spend a request. */
  canSearch: boolean;
  /** Run the search. The ONE entry point — typed, spoken and walkthrough all use it. */
  submit: () => void;
  /** CPV2-04's "Edit search": cancel anything in flight and go back to the field. */
  editSearch: () => void;

  // ── The answer (CPV2-04, CPV2-09, CPV2-10) ────────────────────────────────
  search: CatalogueSearchState;

  // ── The family (CPV2-05) ──────────────────────────────────────────────────
  family: CatalogueFamily | null;
  openFamily: (family: CatalogueFamily, position: number) => void;
  closeFamily: () => void;
  /** externalIds of the selected colourways. Never written until `confirm`. */
  selected: readonly string[];
  toggleColour: (colour: CatalogueColourway) => void;
  selectedColours: readonly CatalogueColourway[];

  // ── The write (CPV2-06, CPV2-07, CPV2-08, CPV2-11) ────────────────────────
  review: () => void;
  backToDetail: () => void;
  confirm: () => void;
  importing: boolean;
  results: readonly ImportRowResult[];
  refusal: CapacityRefusal | null;
  /** Retry only the rows that failed. Successes are never re-sent. */
  retryFailed: () => void;
  errorMessage: string | null;
  /** The item ids CPV2-08 links to. */
  addedItemIds: readonly string[];

  reset: () => void;
  /**
   * CPV2-11 — a selection kept from a previous visit, offered back.
   *
   * Null when there is none, which is the common case. Restoring is a TAP, not
   * an effect: silently re-ticking three colourways somebody chose yesterday
   * and leaving an armed "Add 3 to closet" under their thumb is how a hold
   * becomes an unwanted import.
   */
  heldSelection: HeldSelectionOffer | null;
  restoreHeld: () => void;
  dismissHeld: () => void;
};

export type HeldSelectionOffer = {
  family: CatalogueFamily;
  colours: CatalogueColourway[];
};

export type CatalogueFlowOptions = {
  path: CataloguePath;
  /** Prefilled words — the walkthrough's utterance, or a transcript. */
  initialText?: string;
  /** §8: `CPV2-05` opens with the walkthrough's `namedColours` pre-selected. */
  namedColours?: readonly string[];
};

export function useCatalogueFlow(options: CatalogueFlowOptions): CatalogueFlowView {
  const { path, initialText = '', namedColours = [] } = options;

  const [text, setTextRaw] = useState(initialText);
  const [step, setStep] = useState<CatalogueStep>('search');
  const [family, setFamily] = useState<CatalogueFamily | null>(null);
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [results, setResults] = useState<readonly ImportRowResult[]>([]);
  const [refusal, setRefusal] = useState<CapacityRefusal | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [held, setHeld] = useState<HeldSelectionOffer | null>(null);

  const search = useCatalogueSearch();
  const importer = useCatalogueImport();

  /**
   * Look for a hold once, on mount.
   *
   * This is the ONE effect in this file and it reads local storage — it cannot
   * spend a catalogue request, which is the property the rest of the module is
   * built around. `tests/catalogue-client.test.ts` allows exactly this one and
   * still forbids any search from an effect.
   */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const userId = await getUserId();
      if (!userId) return;
      const found = await readHeldSelection(userId, Date.now());
      if (!cancelled && found) setHeld({ family: found.family, colours: found.colours });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const restoreHeld = useCallback(() => {
    if (!held) return;
    setFamily(held.family);
    setSelected(held.colours.map((c) => c.externalId));
    setStep('confirm');
    setHeld(null);
  }, [held]);

  const dismissHeld = useCallback(() => {
    setHeld(null);
    void releaseHeldSelection();
  }, []);

  /**
   * Editing the field cancels whatever is in flight.
   *
   * §8: "editing cancels the in-flight request and re-runs it." The re-run is
   * the user's tap, not this — an edit that fired a request per keystroke would
   * spend the monthly allowance on somebody typing a brand name slowly.
   */
  const setText = useCallback(
    (next: string) => {
      setTextRaw(next);
      if (search.state.status === 'searching') search.cancel();
    },
    [search],
  );

  const canSearch = isSearchableQuery(text) && !importer.pending;

  const submit = useCallback(() => {
    const query = normaliseCatalogueQuery(text, path, namedColours);
    if (!query) return;
    // The same words, already answered, do not buy a second request.
    if (
      search.state.status === 'results' &&
      sameQuery(search.state.query, query)
    ) {
      return;
    }
    setFamily(null);
    setSelected([]);
    setResults([]);
    setRefusal(null);
    setErrorMessage(null);
    setStep('search');
    void search.run(query);
  }, [namedColours, path, search, text]);

  const editSearch = useCallback(() => {
    search.cancel();
    setStep('search');
    setFamily(null);
    setSelected([]);
  }, [search]);

  const openFamily = useCallback(
    (next: CatalogueFamily, position: number) => {
      catalogueFamilyOpened(position);
      setFamily(next);
      // §8 — the walkthrough's named colours arrive pre-selected. Matched on
      // the merchant's printed label, case-insensitively, because "Black" and
      // "black" are the same colourway and the feed uses both.
      const wanted = new Set(namedColours.map((c) => c.toLowerCase()));
      setSelected(
        wanted.size === 0
          ? []
          : next.colours.filter((c) => wanted.has(c.label.toLowerCase())).map((c) => c.externalId),
      );
      setStep('detail');
    },
    [namedColours],
  );

  const closeFamily = useCallback(() => {
    setFamily(null);
    setSelected([]);
    setStep('search');
  }, []);

  const toggleColour = useCallback((colour: CatalogueColourway) => {
    setSelected((prev) =>
      prev.includes(colour.externalId)
        ? prev.filter((id) => id !== colour.externalId)
        : [...prev, colour.externalId],
    );
  }, []);

  const selectedColours = useMemo(
    () => (family ? family.colours.filter((c) => selected.includes(c.externalId)) : []),
    [family, selected],
  );

  const review = useCallback(() => {
    if (selectedColours.length === 0) return;
    catalogueColoursSelected(selectedColours.length);
    setStep('confirm');
  }, [selectedColours.length]);

  const backToDetail = useCallback(() => {
    setRefusal(null);
    setStep('detail');
  }, []);

  /**
   * The write.
   *
   * Guarded against a double tap by `importer.pending` AND by the step change:
   * the action bar unmounts the moment the step becomes `importing`, so the
   * second tap has nothing to hit even if the first has not resolved.
   */
  const importColours = useCallback(
    async (colours: readonly CatalogueColourway[]) => {
      if (!family || colours.length === 0 || importer.pending) return;
      setErrorMessage(null);
      setRefusal(null);
      setStep('importing');

      const outcome = await importer.run(family, colours);

      if (outcome.status === 'refused') {
        setRefusal(outcome.refusal);
        setStep('confirm'); // CPV2-11 holds the selection where it was made
        // And keeps it for a day, so acquiring room does not cost the work.
        // Fire-and-forget: a failed write means no hold, not a failed refusal.
        void getUserId().then((userId) => {
          if (userId) void holdSelection(userId, family, colours, Date.now());
        });
        return;
      }
      if (outcome.status === 'error') {
        setErrorMessage(outcome.message);
        setStep('confirm');
        return;
      }

      // Merge rather than replace: a retry answers only for the rows it sent,
      // and the ones that already landed must keep their result.
      setResults((prev) => {
        const merged = new Map(prev.map((r) => [r.externalId, r]));
        for (const row of outcome.results) merged.set(row.externalId, row);
        return [...merged.values()];
      });
      // The hold has done its job the moment anything landed.
      void releaseHeldSelection();
      setStep(outcome.failed > 0 ? 'importing' : 'done');
    },
    [family, importer],
  );

  const confirm = useCallback(() => {
    void importColours(selectedColours);
  }, [importColours, selectedColours]);

  const retryFailed = useCallback(() => {
    const failedIds = new Set(results.filter((r) => r.status === 'failed').map((r) => r.externalId));
    void importColours(selectedColours.filter((c) => failedIds.has(c.externalId)));
  }, [importColours, results, selectedColours]);

  const addedItemIds = useMemo(
    () =>
      results
        .filter((r) => (r.status === 'added' || r.status === 'already-added') && r.itemId)
        .map((r) => r.itemId as string),
    [results],
  );

  const reset = useCallback(() => {
    search.reset();
    setTextRaw(initialText);
    setStep('search');
    setFamily(null);
    setSelected([]);
    setResults([]);
    setRefusal(null);
    setErrorMessage(null);
  }, [initialText, search]);

  return {
    step,
    text,
    setText,
    canSearch,
    submit,
    editSearch,
    search: search.state,
    family,
    openFamily,
    closeFamily,
    selected,
    toggleColour,
    selectedColours,
    review,
    backToDetail,
    confirm,
    importing: importer.pending,
    results,
    refusal,
    retryFailed,
    errorMessage,
    addedItemIds,
    reset,
    heldSelection: held,
    restoreHeld,
    dismissHeld,
  };
}
