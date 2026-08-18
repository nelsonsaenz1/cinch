import {
  DAY_PARTS,
  TRIP_STEPS,
  daysBetween,
  formatDateRange,
  fromIsoDate,
  type IsoDate,
  type TripStepKey,
} from './trip';

/**
 * New Trip — the stepped card flow. What the flow decides before it draws.
 * Redesign 05.
 *
 * A `.ts`, not a `.tsx`, for the reason `trips-list-spec.ts`, `plan-week-spec.ts`
 * and `event-detail-spec.ts` all give: the node test bundler cannot parse React
 * Native's Flow source, so anything worth PINNING must not reach a component
 * file. Everything here is a pure function of its arguments — no hooks, no
 * `new Date()` read from the ambient clock — which is what lets
 * `tests/new-trip-layout.test.ts` assert the step machine, the progress dots
 * and the colophons directly rather than inferring them from a render.
 *
 * ── WHAT THIS PAGE GUARDS ────────────────────────────────────────────────────
 *
 * Packing is the membership feature, and the `PackingAccess` gate in
 * `use-packing-access.ts` is the boundary. NOTHING in this file, and nothing in
 * the surfaces drawn from it, reads a plan, presents a placement, or decides
 * who may pack. The gate is checked in `PackingTab` BEFORE the questionnaire is
 * rendered at all, which is the ordering `tests/new-trip-layout.test.ts` pins:
 * a free account never reaches a step, so no server call can be made from one.
 *
 * ── WHY THREE CARDS AND FOUR ANSWERS ─────────────────────────────────────────
 *
 * The frames draw three progress dots and three questions — where, when, what's
 * happening — and the directive names exactly those three. The answered `Trip`
 * still carries FOUR things, because `trips.companions` is `not null` in
 * migration 20260809100000 and `formalityFor` reads the vibes and the parts
 * separately. So the asking was restyled and the answers were not: `companions`
 * and the day parts are asked inside the third card, under their own labels,
 * rather than being dropped or given a fourth dot the frames do not draw. See
 * the build report's deviation list.
 */

// ---------------------------------------------------------------------------
// Copy — nothing here promises a count of anything
// ---------------------------------------------------------------------------

/**
 * Every word the flow says.
 *
 * The week-engine rule applies to packing too: no line here names a number of
 * outfits, pieces or looks the search has not run yet. The one arithmetic
 * sentence in the flow is `looksSentence` in `packing-math.ts`, which counts
 * LOOKS ASKED FOR (day parts × days) rather than predicting what comes back.
 */
export const NEW_TRIP_COPY = {
  /** The three questions, in the frames' own words. */
  back: 'Back',
  close: 'Close',
  next: 'Next',
  build: 'Build the packing plan',

  destinationPlaceholder: 'City or region',
  destinationLabel: 'Destination',
  beenBefore: 'Been before',

  whoWith: 'Who with',
  dayParts: 'Parts of the day',
  friends: 'Add friends (optional)',
  friendsNote: 'Names their trip summary, not what gets packed.',

  /** The retention line. True of this app: `useStartTrip` writes the row first. */
  retention:
    'Your answers are saved with the trip, so you can reopen the memo or build it again without answering twice.',

  /** The plate, building. */
  packing: 'Packing…',

  /** The plate that did not come back. */
  errorKicker: 'Couldn’t pack',
  errorTitle: 'The packing plan didn’t come back',
  errorBody: 'Your answers are still here.',
  tryAgain: 'Try again',
  saveAndFinishLater: 'Save and finish later',

  /** The completion moment. */
  planned: 'Trip planned',
  seeThisTrip: 'See this trip',
  allTrips: 'All trips',

  /** The quiet actions the frames keep off the foot. */
  swapDay: 'Swap a day',
  share: 'Share',

  /** The error frame's three answer cards. */
  answerWhere: 'Where',
  answerWhen: 'When',
  answerWhat: 'What’s happening',
} as const;

// ---------------------------------------------------------------------------
// The step machine, read from the outside
// ---------------------------------------------------------------------------

/**
 * The dots, derived from the step index and nothing else.
 *
 * The frames draw three states and they are not two: the CURRENT dot is a
 * 22pt oxblood bar, the steps BEHIND it are short rose dots, and the steps
 * AHEAD are short sand ones. That difference is the only progress furniture on
 * the page — there is no "2 of 3" line any more — so it has to carry both
 * "where am I" and "how much is left", which a two-state dot cannot.
 *
 * Pure, and indexed rather than named, so a step inserted into `TRIP_STEPS`
 * needs no edit here.
 */
export type DotState = 'done' | 'current' | 'ahead';

export function progressDots(index: number, total: number = TRIP_STEPS.length): DotState[] {
  const clamped = Math.min(Math.max(0, Math.trunc(index)), Math.max(0, total - 1));
  return Array.from({ length: Math.max(0, total) }, (_, i) =>
    i < clamped ? 'done' : i === clamped ? 'current' : 'ahead',
  );
}

/** 0-based position of a step, or 0 for anything the flow does not ask. */
export function stepIndex(step: TripStepKey): number {
  const i = TRIP_STEPS.indexOf(step);
  return i < 0 ? 0 : i;
}

/**
 * Can this step be left?
 *
 * The frames draw "Next" inactive on the untouched first card and active the
 * moment a place is chosen, so the answer is a function of the draft rather
 * than of which control was tapped last. The third card's CTA is the one that
 * finishes, and it needs BOTH multi-selects to be non-empty because
 * `trips.parts` is constrained to `array_length between 1 and 4` — a skipped
 * fourth answer is a row the database refuses.
 */
export function canLeaveStep(
  step: TripStepKey,
  draft: {
    destination: unknown | null;
    companions: unknown | null;
    startsOn: IsoDate | null;
    endsOn: IsoDate | null;
    vibes: readonly unknown[];
    parts: readonly unknown[];
  },
): boolean {
  switch (step) {
    case 'destination':
      return draft.destination != null;
    case 'dates':
      return Boolean(draft.startsOn && draft.endsOn);
    case 'shape':
      return draft.companions != null && draft.vibes.length > 0 && draft.parts.length > 0;
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// The colophons
// ---------------------------------------------------------------------------

/** Inclusive days minus one — the frames count NIGHTS on this page. */
export function nights(startsOn: IsoDate, endsOn: IsoDate): number {
  return Math.max(0, daysBetween(startsOn, endsOn) - 1);
}

/**
 * `10–14 Sep · 4 nights` — the destination card's second line.
 *
 * Nights, not days, because that is what both this page's frames and the trips
 * shelf print (`tripDatesLine`); the memo's own internals still count days and
 * that is deliberate — a look is packed for a day, a suitcase is packed for a
 * number of nights.
 */
export function tripDatesLine(startsOn: IsoDate, endsOn: IsoDate): string {
  const range = formatDateRange(startsOn, endsOn);
  const n = nights(startsOn, endsOn);
  if (n === 0) return range;
  return `${range} · ${n} ${n === 1 ? 'night' : 'nights'}`;
}

/**
 * `24° / 15°` — the destination's weather mark, high then low.
 *
 * Formatted here rather than in the drawing layer so the AX frame's spaced
 * form and the planned plate's tight form are one function with one argument,
 * and so a null band draws nothing at all rather than a guessed range. The
 * numbers arrive in Celsius from the archive; `format` is the caller's
 * `formatTemp`, passed in so this module stays free of the weather client.
 */
export function weatherMark(
  band: { lowC: number; highC: number } | null,
  format: (celsius: number) => string,
  spaced = true,
): string | null {
  if (!band) return null;
  return spaced
    ? `${format(band.highC)} / ${format(band.lowC)}`
    : `${format(band.highC)}/${format(band.lowC)}`;
}

/**
 * `10–14 Sep · 4 nights · 24°/15°` — the planned plate's colophon.
 *
 * The mark is appended only when there is one. A trip whose dates are past the
 * forecast horizon and whose normals did not resolve prints the dates alone
 * rather than an em dash where a temperature should be.
 */
export function plannedColophon(startsOn: IsoDate, endsOn: IsoDate, mark: string | null): string {
  return [tripDatesLine(startsOn, endsOn), mark].filter(Boolean).join(' · ');
}

/**
 * `Thu 10 · arrival` — a day band on the packing plate.
 *
 * The frames set the first and last days as "arrival" and "home" and leave the
 * middle ones as the date alone. The artifact's middle band reads "Sat 12 · the
 * birthday", which is an EVENT title — this app has no binding from a trip day
 * to a calendar event, and inventing one would put a sentence on the plate that
 * no row in the database backs. So the middle days carry the date and the
 * honest weather caption beside it instead. Listed as a deviation.
 *
 * Locale-formatted, so a device set to French says "jeu." on its own terms.
 * The `eyebrow` variant applies the caps; this returns sentence case.
 */
export function plateDayLabel(date: IsoDate, dayIndex: number, days: number): string {
  const when = fromIsoDate(date).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
  });
  if (days > 1 && dayIndex === 0) return `${when} · arrival`;
  if (days > 1 && dayIndex === days - 1) return `${when} · home`;
  return when;
}

/**
 * The three rows the error frame preserves — WHERE, WHEN, WHAT'S HAPPENING.
 *
 * This is the frame's whole promise ("Your answers are still here") drawn as
 * evidence rather than asserted in a sentence, so it is built from the answered
 * draft and cannot be right for one field and stale for another. A field the
 * draft does not carry is DROPPED rather than filled with a placeholder.
 */
export type AnswerRow = { key: string; value: string };

export function answerRows(draft: {
  destination: { name: string } | null;
  startsOn: IsoDate | null;
  endsOn: IsoDate | null;
  /** Already resolved to labels by the caller — this module owns no vocabulary. */
  vibeLabels: readonly string[];
}): AnswerRow[] {
  const rows: AnswerRow[] = [];
  if (draft.destination) {
    rows.push({ key: NEW_TRIP_COPY.answerWhere, value: draft.destination.name });
  }
  if (draft.startsOn && draft.endsOn) {
    rows.push({ key: NEW_TRIP_COPY.answerWhen, value: tripDatesLine(draft.startsOn, draft.endsOn) });
  }
  if (draft.vibeLabels.length) {
    rows.push({ key: NEW_TRIP_COPY.answerWhat, value: joinLabels(draft.vibeLabels) });
  }
  return rows;
}

/** "Dinners out, a birthday, walking all day" — the frame's own casing. */
export function joinLabels(labels: readonly string[]): string {
  const lowered = labels.map((label, i) => (i === 0 ? label : label.toLowerCase()));
  return lowered.join(', ');
}

/** The whole day-part vocabulary, so the third card can draw it without importing twice. */
export const DAY_PART_KEYS = DAY_PARTS.map((p) => p.key);

// ---------------------------------------------------------------------------
// Geometry — the artifact's numbers
// ---------------------------------------------------------------------------

/** The pinned foot's primary, and the secondary beneath it. */
export const CTA_MIN_HEIGHT = 56;
export const CTA_RADIUS = 16;
export const CTA_SECONDARY_MIN_HEIGHT = 52;
/** The AX frame grows the primary and lets it wrap to two lines. */
export const CTA_MIN_HEIGHT_AX = 64;

/** The progress dots. */
export const DOT_SIZE = 8;
export const DOT_HEIGHT = 6;
export const DOT_CURRENT_WIDTH = 22;
export const DOT_GAP = 6;
export const DOT_SIZE_AX = 8;
export const DOT_HEIGHT_AX = 8;
export const DOT_GAP_AX = 7;

/** The back / close target in the flow's own chrome. */
export const CHROME_TARGET = 44;
export const CHROME_TARGET_AX = 48;
export const CHROME_RADIUS = 14;
export const CHROME_RADIUS_AX = 15;

/** The destination field on card one. */
export const FIELD_MIN_HEIGHT = 60;
export const FIELD_RADIUS = 16;
export const FIELD_DOT = 16;

/** A purpose chip. Wrapped at the standard size, full-width above the threshold. */
export const CHIP_MIN_HEIGHT = 48;
export const CHIP_RADIUS = 15;
export const CHIP_GAP = 9;
export const CHIP_MIN_HEIGHT_AX = 60;
export const CHIP_RADIUS_AX = 16;
export const CHIP_GAP_AX = 10;

/** The destination card that rides above questions two and three. */
export const PLACE_CARD_RADIUS = 16;
export const PLACE_CARD_RADIUS_AX = 18;
export const MARK_RADIUS = 12;
export const MARK_DOT = 16;

/** A search result row. */
export const MATCH_WELL = 36;
export const MATCH_WELL_RADIUS = 11;

/** The plate — three across, per day. */
export const PLATE_TILES = 3;
export const PLATE_ROW = 82;
export const PLATE_ROW_LOADING = 86;
export const PLATE_GAP = 3;
export const PLATE_TILE_RADIUS = 10;
export const PLATE_DAY_GAP = 14;

/** The two status bands — amber on the failure, green on the completion. */
export const BADGE_RADIUS = 9;
export const BADGE_DOT = 8;

/** An answer card on the error frame. */
export const ANSWER_CARD_RADIUS = 16;
export const ANSWER_CARD_MIN_HEIGHT = 56;
export const ANSWER_CARD_GAP = 10;

/**
 * Where the flow recomposes instead of shrinking.
 *
 * The same threshold the Plan week, the event poster and the trips shelf use —
 * one number for the whole redesign, so two rebuilt pages cannot disagree about
 * what "large" is.
 */
export { AX_STACK_SCALE as NEW_TRIP_STACK_SCALE } from '@/features/closet/dynamic-type';
