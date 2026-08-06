import { useCallback, useMemo, useState } from 'react';

import type { Place } from '@/features/context/weather';

import {
  DAY_PARTS,
  TRIP_STEPS,
  type CompanionKey,
  type DayPartKey,
  type Trip,
  type TripStepKey,
  type VibeKey,
} from './trip';

/**
 * The packing questionnaire as a state machine, kept out of the screen.
 *
 * Same division of labour as `features/stylist/use-questionnaire.ts`: the screen
 * renders an eyebrow, a serif question and a row of chips; deciding which
 * question is current, what a finished run composes into, and what "finished"
 * even means lives here. Five answers that never outlive the tab do not need a
 * reducer, a context or a store.
 *
 * EVERY MUTATION NAMES THE STEP IT IS ANSWERING. Without that, two taps landing
 * in the same frame — a double tap on one chip, or a fat-fingered pair — both
 * read the pre-tap index and advance twice, silently skipping a question. The
 * step name makes the second tap a no-op instead, which is the same hazard the
 * stylist's `runRef` closes by a different route.
 */

export type TripDraft = {
  destination: Place | null;
  companions: CompanionKey | null;
  vibe: VibeKey | null;
  days: number | null;
  /** Multi-select, kept in `DAY_PARTS` order however it was tapped. */
  parts: DayPartKey[];
};

const EMPTY: TripDraft = {
  destination: null,
  companions: null,
  vibe: null,
  days: null,
  parts: [],
};

const PART_ORDER = DAY_PARTS.map((p) => p.key);

/**
 * Index and answers in ONE state value, deliberately.
 *
 * They change together on every tap, and holding them apart means an updater
 * that has to reach into the other's setter — impure, and double-invoked under
 * StrictMode, which is how a single tap advances two questions.
 */
type Run = { index: number; draft: TripDraft };

export function useTripQuestionnaire(onComplete: (trip: Trip) => void) {
  const [{ index, draft }, setRun] = useState<Run>({ index: 0, draft: EMPTY });

  const step: TripStepKey = TRIP_STEPS[index] ?? TRIP_STEPS[0]!;

  /** Answer the *named* step and advance. A tap for any other step is stale. */
  const answer = useCallback((answered: TripStepKey, patch: Partial<TripDraft>) => {
    setRun((run) =>
      TRIP_STEPS[run.index] !== answered
        ? run
        : {
            index: Math.min(run.index + 1, TRIP_STEPS.length - 1),
            draft: { ...run.draft, ...patch },
          },
    );
  }, []);

  /**
   * The one question that does not advance on tap.
   *
   * Mornings, days and nights are a set, not a choice, so the step needs an
   * explicit finish — which is also the only place a primary button appears in
   * the whole flow.
   */
  const togglePart = useCallback((key: DayPartKey) => {
    setRun((run) => {
      const has = run.draft.parts.includes(key);
      const parts = (has ? run.draft.parts.filter((p) => p !== key) : [...run.draft.parts, key])
        .slice()
        .sort((a, b) => PART_ORDER.indexOf(a) - PART_ORDER.indexOf(b));
      return { ...run, draft: { ...run.draft, parts } };
    });
  }, []);

  const back = useCallback(() => {
    setRun((run) => ({ ...run, index: Math.max(0, run.index - 1) }));
  }, []);

  const reset = useCallback(() => setRun({ index: 0, draft: EMPTY }), []);

  /**
   * Hand the finished trip up.
   *
   * Returns nothing and does nothing when the draft is incomplete rather than
   * throwing: the button that calls it is already disabled in that state, and a
   * throw from a press handler would be a red box over a questionnaire.
   */
  const complete = useCallback(() => {
    const { destination, companions, vibe, days, parts } = draft;
    if (!destination || !companions || !vibe || !days || !parts.length) return;
    onComplete({ destination, companions, vibe, days, parts });
  }, [draft, onComplete]);

  return useMemo(
    () => ({
      step,
      /** 1-based, for "2 of 5". Honest: every step here is really asked. */
      position: index + 1,
      total: TRIP_STEPS.length,
      draft,
      canGoBack: index > 0,
      answer,
      togglePart,
      back,
      reset,
      complete,
    }),
    [step, index, draft, answer, togglePart, back, reset, complete],
  );
}
