/**
 * Today's analytics allowlist — thirteen events, and nothing else.
 *
 * A `.ts` with no import of `@/lib/posthog`, on the convention
 * `features/circles/analytics.ts` and `features/activity-center/analytics.ts`
 * set: that module pulls in expo-updates and the PostHog SDK and cannot be
 * executed by the node suite, while the PROPERTY SHAPES are the part worth
 * testing, because they are where an identifier would leak in. So the builders
 * are pure functions here and `track()` is called with them at the call site.
 *
 * ── WHAT MAY BE SENT ────────────────────────────────────────────────────────
 *
 * Every builder below returns bounded enums and booleans. Nothing returns a
 * string the reader typed, a name anybody chose, or a number that could
 * identify a wardrobe.
 *
 * ── WHAT MAY NEVER BE SENT ──────────────────────────────────────────────────
 *
 * A user id, a garment id, an outfit id, an image URL or storage path, a
 * garment or outfit NAME, a city, coordinates, precise or coarse location,
 * calendar text, or free text of any kind. `tests/today-analytics.test.ts`
 * asserts this against every builder and every enum value rather than against
 * a copy of this paragraph.
 *
 * Weather is the sharpest of those. Today knows a temperature and a condition,
 * and both are shown on screen — but `weather_state` reports only WHICH OF
 * FOUR STATES the weather read is in, never the reading itself, because a
 * temperature plus a timestamp is a location to anybody holding enough of them.
 */

/** The thirteen names, mirrored locally so the union membership is checkable. */
export const TODAY_EVENTS = {
  opened: 'today_opened',
  plateViewed: 'plate_viewed',
  /**
   * DORMANT since 2026-08-18 — the founder withdrew Today's context chips, and
   * these two fired only from them. They are kept rather than deleted for two
   * reasons: the thirteen-event roster is a pinned contract that PostHog reads
   * against (see `tests/today-analytics.test.ts`), and retiring a name is how
   * a dashboard silently starts reporting zero without anybody being told the
   * event stopped existing. The chips component itself is unmounted, not
   * deleted, and still draws in the dev fixtures — whatever asks the day's
   * context next reports through these.
   */
  contextOpened: 'context_opened',
  contextSet: 'context_set',
  outfitsSource: 'outfits_source',
  weatherState: 'weather_state',
  wearStarted: 'wear_started',
  wearResult: 'wear_result',
  ratingSet: 'rating_set',
  favoriteSet: 'favorite_set',
  repeatExhausted: 'repeat_exhausted',
  noViableCombination: 'no_viable_combination',
  closetFloorShown: 'closet_floor_shown',
} as const;

/** Which of the three plates is on screen. Never how many exist. */
export type PlateIndex = 1 | 2 | 3;

/** The three chips, and nothing about what any of them says. */
export type ContextFacet = 'weather' | 'occasion' | 'feel';

/**
 * The fixed option list, as enums.
 *
 * `context_set` reports WHICH option was chosen from a closed list — never the
 * label as rendered, and never a free-text occasion. An occasion typed by the
 * reader has no member here and is reported as `other`, which is the whole
 * reason `other` exists.
 */
export type ContextChoice =
  | 'office'
  | 'dinner_out'
  | 'travelling'
  | 'something_formal'
  | 'no_plans'
  | 'easy'
  | 'sharp'
  | 'warm'
  | 'cool'
  | 'other';

/** Which engine produced the set the reader is actually looking at. */
export type OutfitsSource = 'local' | 'enhanced';

/** The four truthful weather states. Never the reading, never the place. */
export type WeatherState = 'ok' | 'stale' | 'off' | 'unavailable';

export type WearResult = 'ok' | 'failed';

/** Every builder returns this shape: bounded scalars only. */
export type TodayProps = Record<string, string | number | boolean>;

export const todayOpenedProps = (): TodayProps => ({});

export const plateViewedProps = (index: PlateIndex): TodayProps => ({ index });

export const contextOpenedProps = (facet: ContextFacet): TodayProps => ({ facet });

export const contextSetProps = (facet: ContextFacet, choice: ContextChoice): TodayProps => ({
  facet,
  choice,
});

export const outfitsSourceProps = (source: OutfitsSource): TodayProps => ({ source });

export const weatherStateProps = (state: WeatherState): TodayProps => ({ state });

export const wearStartedProps = (): TodayProps => ({});

export const wearResultProps = (result: WearResult): TodayProps => ({ result });

/** Whether a rating was given at all — never which one. */
export const ratingSetProps = (rated: boolean): TodayProps => ({ rated });

/** Whether it was kept as a favourite — never which outfit. */
export const favoriteSetProps = (favorited: boolean): TodayProps => ({ favorited });

export const repeatExhaustedProps = (): TodayProps => ({});

export const noViableCombinationProps = (): TodayProps => ({});

export const closetFloorShownProps = (): TodayProps => ({});

/**
 * The closed list of choices, for the mapper and for the test.
 *
 * Exported so the privacy test can walk every legal value rather than a sample
 * of them — an enum is only bounded if something checks the bound.
 */
export const CONTEXT_CHOICES: readonly ContextChoice[] = [
  'office',
  'dinner_out',
  'travelling',
  'something_formal',
  'no_plans',
  'easy',
  'sharp',
  'warm',
  'cool',
  'other',
];

/**
 * A rendered option label reduced to its enum, or `other`.
 *
 * The mapper exists so a label can change without changing what is reported,
 * and so anything unrecognised — including an occasion somebody typed — lands
 * on `other` rather than travelling to the server as itself. It lower-cases and
 * matches exactly; it never falls back to sending the input.
 */
export function contextChoiceOf(label: string | null | undefined): ContextChoice {
  const key = (label ?? '').trim().toLowerCase().replace(/\s+/g, '_');
  return (CONTEXT_CHOICES as readonly string[]).includes(key)
    ? (key as ContextChoice)
    : 'other';
}
