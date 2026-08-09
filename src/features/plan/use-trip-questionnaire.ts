import { useCallback, useMemo, useState } from 'react';

import type { Place } from '@/features/context/weather';

import {
  DAY_PARTS,
  TRIP_STEPS,
  VIBES,
  type CompanionKey,
  type DayPartKey,
  type IsoDate,
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
  /** Cinch friends coming too. Optional everywhere — most trips name nobody. */
  friendIds: string[];
  friendNames: string[];
  startsOn: IsoDate | null;
  endsOn: IsoDate | null;
  /** Multi-select, kept in `VIBES` order however it was tapped. */
  vibes: VibeKey[];
  /** Multi-select, kept in `DAY_PARTS` order however it was tapped. */
  parts: DayPartKey[];
};

const EMPTY: TripDraft = {
  destination: null,
  companions: null,
  friendIds: [],
  friendNames: [],
  startsOn: null,
  endsOn: null,
  vibes: [],
  parts: [],
};

const PART_ORDER = DAY_PARTS.map((p) => p.key);
const VIBE_ORDER = VIBES.map((v) => v.key);

/**
 * Index and answers in ONE state value, deliberately.
 *
 * They change together on every tap, and holding them apart means an updater
 * that has to reach into the other's setter — impure, and double-invoked under
 * StrictMode, which is how a single tap advances two questions.
 */
type Run = { index: number; draft: TripDraft };

const FRESH: Run = { index: 0, draft: EMPTY };

/**
 * The run, held at module level so it outlives the component.
 *
 * `PackingTab` unmounts the moment another segment is chosen, and the atlas is
 * explicit that answers survive a glance at Week — three questions in, a look
 * at the calendar must not cost three taps. The *finished* trip is already
 * held by the Plan screen; this slot does the same for the half-answered one.
 * One questionnaire exists per app, which is what makes a module slot honest
 * rather than sneaky shared state. Cleared on completion, so the next trip
 * opens on question one.
 */
let heldRun: Run = FRESH;

export function useTripQuestionnaire(onComplete: (trip: Trip) => void) {
  const [{ index, draft }, setRunState] = useState<Run>(heldRun);

  /** Every write lands in the module slot too, so unmounting loses nothing. */
  const setRun = useCallback((update: (run: Run) => Run) => {
    setRunState((run) => {
      const next = update(run);
      heldRun = next;
      return next;
    });
  }, []);

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
  }, [setRun]);

  /**
   * The last question does not advance on tap, and asks two things.
   *
   * The vibes are a set and the day parts are a set — "pick as many as are
   * true" — so the step needs an explicit finish, which is also the only place
   * a primary button appears in the whole flow. Both toggles keep their answer
   * in vocabulary order however it was tapped, so the summary row reads the
   * same way twice.
   */
  const togglePart = useCallback((key: DayPartKey) => {
    setRun((run) => {
      const has = run.draft.parts.includes(key);
      const parts = (has ? run.draft.parts.filter((p) => p !== key) : [...run.draft.parts, key])
        .slice()
        .sort((a, b) => PART_ORDER.indexOf(a) - PART_ORDER.indexOf(b));
      return { ...run, draft: { ...run.draft, parts } };
    });
  }, [setRun]);

  const toggleVibe = useCallback((key: VibeKey) => {
    setRun((run) => {
      const has = run.draft.vibes.includes(key);
      const vibes = (has ? run.draft.vibes.filter((v) => v !== key) : [...run.draft.vibes, key])
        .slice()
        .sort((a, b) => VIBE_ORDER.indexOf(a) - VIBE_ORDER.indexOf(b));
      return { ...run, draft: { ...run.draft, vibes } };
    });
  }, [setRun]);

  /**
   * The date range, which is two answers to one question.
   *
   * Does not advance: the picker is a calendar, and a first tap is a start, not
   * a finished answer. The step's button is what moves on.
   */
  const setDates = useCallback(
    (startsOn: IsoDate | null, endsOn: IsoDate | null) => {
      setRun((run) => ({ ...run, draft: { ...run.draft, startsOn, endsOn } }));
    },
    [setRun],
  );

  /** Friends coming along. Ids and names move together or not at all. */
  const setCompanionFriends = useCallback(
    (friendIds: string[], friendNames: string[]) => {
      setRun((run) => ({ ...run, draft: { ...run.draft, friendIds, friendNames } }));
    },
    [setRun],
  );

  const back = useCallback(() => {
    setRun((run) => ({ ...run, index: Math.max(0, run.index - 1) }));
  }, [setRun]);

  const reset = useCallback(() => setRun(() => FRESH), [setRun]);

  /**
   * Hand the finished trip up.
   *
   * Returns nothing and does nothing when the draft is incomplete rather than
   * throwing: the button that calls it is already disabled in that state, and a
   * throw from a press handler would be a red box over a questionnaire.
   */
  const complete = useCallback(() => {
    const { destination, companions, friendIds, friendNames, startsOn, endsOn, vibes, parts } =
      draft;
    if (!destination || !companions || !startsOn || !endsOn) return;
    if (!vibes.length || !parts.length) return;
    // The trip is the Plan screen's from here; the held run has done its job.
    heldRun = FRESH;
    onComplete({
      destination,
      companions,
      friendIds,
      friendNames,
      startsOn,
      endsOn,
      vibes,
      parts,
    });
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
      toggleVibe,
      setDates,
      setCompanionFriends,
      back,
      reset,
      complete,
    }),
    [
      step,
      index,
      draft,
      answer,
      togglePart,
      toggleVibe,
      setDates,
      setCompanionFriends,
      back,
      reset,
      complete,
    ],
  );
}
