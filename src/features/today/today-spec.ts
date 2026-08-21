import { PLANS } from '@/features/billing/plans';
import { pieceName } from '@/features/closet/item-name';
import { numberWord } from '@/features/onboarding/reveal-copy';

/**
 * Today — what the morning decides before it draws. Redesign 11.
 *
 * A `.ts` with no React and no `.tsx` import, for the reason every spec in this
 * wave gives: the node bundler cannot parse React Native's Flow source, so
 * anything a test needs to read has to live where no component can reach it.
 *
 * ── THE ONE PROMISE ─────────────────────────────────────────────────────────
 *
 * "Three outfits for today — from clothes you already own." The set is built by
 * the on-device beam search, synchronously, from the persisted closet. It works
 * with no network and no model, and that is not a fallback: it is the primary
 * path, which is why nothing on this screen may block on a request.
 */

// ---------------------------------------------------------------------------
// The activation floor
// ---------------------------------------------------------------------------

/**
 * How many pieces Today asks for before it builds a morning.
 *
 * TEN — `PLANS.free.items` — and deliberately NOT `MIN_CLOSET_FOR_OUTFITS`.
 *
 * Those two numbers are different questions and the repo has always said so.
 * `MIN_CLOSET_FOR_OUTFITS` (eight) is the ENGINE floor: below it there is not
 * enough to combine, and it governs the stylist, packing and the help article.
 * Ten is the number the PRODUCT asks a person for — the number in The Ten, in
 * the tour, in the free tier, and now the number Today waits for.
 *
 * Before redesign 11 Today activated at the engine floor while its copy quoted
 * ten, so a closet of eight got outfits under a sentence promising ten and a
 * closet of nine was told nothing at all. The accepted design states the line
 * outright — "Start with ten pieces" — and a screen may not print a number it
 * does not act on. So the ACTIVATION floor moves to ten and the engine floor
 * stays exactly where it is, still meaning what it says.
 *
 * The cost is named rather than hidden: a closet of eight or nine could have
 * produced outfits and will now be asked for ten first. That is the product
 * asking once, plainly, instead of moving the goalposts later.
 */
export const TODAY_ACTIVATION_FLOOR = PLANS.free.items;

/**
 * Whether Today draws the floor instead of a morning.
 *
 * Two conditions, and both are real: the closet has to be big enough to be
 * worth asking about, and it has to have a shape the engine can build from —
 * ten jumpers is still not a morning. `canGenerate` owns the second half.
 */
export function belowActivationFloor(pieceCount: number, engineCanGenerate: boolean): boolean {
  return pieceCount < TODAY_ACTIVATION_FLOOR || !engineCanGenerate;
}

/** How many more pieces the floor is waiting on. Derived, never written. */
export function piecesRemaining(pieceCount: number): number {
  return Math.max(0, TODAY_ACTIVATION_FLOOR - pieceCount);
}

// ---------------------------------------------------------------------------
// The context chips
// ---------------------------------------------------------------------------

export type ContextFacet = 'weather' | 'occasion' | 'feel';

/**
 * The occasion options, and what each one asks the scorer for.
 *
 * `engine` is fed to `StyleContext.targetOccasion`, which `occasionRule`
 * matches case-insensitively against each garment's own `occasions` tags —
 * so these are lowercase single words on purpose, to match the tagger's
 * vocabulary rather than a label a designer wrote.
 *
 * `no_plans` asks for nothing: a null target is the rule's neutral 0.7, which
 * is the honest score for "no occasion stated" and not a penalty.
 */
export const OCCASION_OPTIONS = [
  { id: 'no_plans', label: 'No plans', engine: null },
  { id: 'office', label: 'Office', engine: 'work' },
  { id: 'dinner_out', label: 'Dinner out', engine: 'dinner' },
  { id: 'travelling', label: 'Travelling', engine: 'travel' },
  { id: 'something_formal', label: 'Something formal', engine: 'formal' },
] as const;

export type OccasionId = (typeof OCCASION_OPTIONS)[number]['id'];

/**
 * The feel options, and the formality each one asks for.
 *
 * Feel is expressed as `StyleContext.targetFormality`, a 0..1 the scorer
 * already understands through `resolveTargetFormality` — not a new axis. An
 * event on the calendar still sets the floor when no feel is chosen, which is
 * the existing behaviour and is left alone.
 *
 * `easy` is the resting value because an ordinary morning is an ordinary
 * morning; it is a real request for a lower formality, not an absence.
 */
export const FEEL_OPTIONS = [
  { id: 'easy', label: 'Easy', formality: 0.3 },
  { id: 'sharp', label: 'Sharp', formality: 0.75 },
  { id: 'warm', label: 'Warm', formality: 0.4 },
  { id: 'cool', label: 'Cool', formality: 0.5 },
] as const;

export type FeelId = (typeof FEEL_OPTIONS)[number]['id'];

export type TodayContextChoice = {
  occasion: OccasionId;
  feel: FeelId;
};

export const DEFAULT_CONTEXT: TodayContextChoice = { occasion: 'no_plans', feel: 'easy' };

/** What the scorer is asked for, from what the chips say. */
export function engineOccasion(id: OccasionId): string | null {
  return OCCASION_OPTIONS.find((o) => o.id === id)?.engine ?? null;
}

export function engineFormality(id: FeelId): number | null {
  return FEEL_OPTIONS.find((f) => f.id === id)?.formality ?? null;
}

export function occasionLabel(id: OccasionId): string {
  return OCCASION_OPTIONS.find((o) => o.id === id)?.label ?? 'No plans';
}

export function feelLabel(id: FeelId): string {
  return FEEL_OPTIONS.find((f) => f.id === id)?.label ?? 'Easy';
}

// ---------------------------------------------------------------------------
// What is actually coming — the band that replaced the chips
// ---------------------------------------------------------------------------

/**
 * ── THE CONTEXT CHIPS ARE GONE FROM TODAY ─────────────────────────────────
 *
 * Founder order, 2026-08-18. The row read "warm, 86°" · "no plans" · "easy"
 * on an ordinary morning, and the second and third of those were the DEFAULTS
 * — the app stating, in a control, that it had been told nothing. Two of the
 * three chips were furniture, and the third repeated a temperature the
 * masthead had already said in a sentence one line above (audit 57 spent a
 * whole pass making the weather appear exactly once on this screen; the chip
 * put it back).
 *
 * What takes the space is a rule rather than a control: something is drawn
 * there only when there is genuinely something to say about the day ahead,
 * and otherwise the plates start higher up the screen.
 *
 * The EVENT half of that rule is not served from here. An occasion today is
 * already drawn — better, and above the look it competes with — by
 * `OccasionInterrupt` (T-02), which carries the event's own action. Printing
 * it a second time in this band would be the weather-chip mistake repeated.
 * So this band is the TRIP half, and the two together are what the reader
 * sees: an occasion today, a trip inside the week, or nothing.
 *
 * `OCCASION_OPTIONS` / `FEEL_OPTIONS` / `DEFAULT_CONTEXT` above are kept.
 * They are what the engine is still asked for — `DEFAULT_CONTEXT` is what the
 * chips sent on the overwhelming majority of mornings anyway, since it is
 * what they rested at — and the Stylist still offers the same vocabulary.
 */

/** A trip further out than this is not news on a morning screen. */
export const TRIP_AHEAD_WINDOW_DAYS = 7;

/**
 * Whole calendar days from `now` to an `YYYY-MM-DD` date, in local time.
 *
 * Calendar days, not elapsed hours: a trip that starts tomorrow morning is
 * "tomorrow" whether it is now 9pm or 9am, and dividing a millisecond
 * difference by 86,400,000 gets that wrong for exactly the readers who look
 * at this screen late at night.
 */
export function daysUntilIso(startsOn: string, now: Date): number {
  const [y, m, d] = startsOn.split('-').map(Number);
  if (!y || !m || !d) return Number.NaN;
  const start = new Date(y, m - 1, d).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((start - today) / 86_400_000);
}

/**
 * The soonest trip starting inside the window, or null.
 *
 * A trip already under way is deliberately EXCLUDED. This band is about
 * packing for something that has not happened yet; somebody in Lisbon does not
 * need Today to tell them about Lisbon, and the trip's own screens are where
 * the wardrobe question lives once they have arrived.
 */
export function tripAhead<T extends { startsOn: string }>(
  trips: readonly T[],
  now: Date,
  windowDays: number = TRIP_AHEAD_WINDOW_DAYS,
): T | null {
  let best: { trip: T; days: number } | null = null;
  for (const trip of trips) {
    const days = daysUntilIso(trip.startsOn, now);
    if (!Number.isFinite(days) || days < 0 || days > windowDays) continue;
    if (!best || days < best.days) best = { trip, days };
  }
  return best?.trip ?? null;
}

/**
 * "Lisbon, in three days" — the whole line, and never a bare number.
 *
 * Spelt-out counts to seven for the reason `wrongCodeLine` spells them in the
 * auth run: "in 3 days" reads as a countdown timer, and this is a sentence
 * somebody is being told on the way to getting dressed.
 */
const DAY_WORDS = ['', '', 'two', 'three', 'four', 'five', 'six', 'seven'] as const;

export function tripAheadLine(destination: string, days: number): string {
  if (days <= 0) return `${destination}, today`;
  if (days === 1) return `${destination}, tomorrow`;
  return `${destination}, in ${DAY_WORDS[days] ?? String(days)} days`;
}

/**
 * The AsyncStorage key under which ONE trip's reminder dismissal lives.
 *
 * Keyed per trip id, not globally: "Got it" is an answer about Tokyo, and a
 * different trip next month is new news that must still surface. AsyncStorage
 * rather than a column for the reasons `use-profile-coaching.ts` gives — it is
 * the app's card-dismissal idiom, a dismissal is a property of an install, and
 * it must resolve without a round trip so the card never flashes in after the
 * screen. Derived here (not in the hook) so the node suite can pin the shape.
 */
export function tripReminderKey(tripId: string): string {
  return `cinch.today.trip-reminder.dismissed.${tripId}`;
}

// ---------------------------------------------------------------------------
// Weather — four truthful states, and never a fifth
// ---------------------------------------------------------------------------

export type WeatherState = 'ok' | 'stale' | 'off' | 'unavailable';

export type WeatherRead = {
  state: WeatherState;
  /** "Grey, 63°" for the chip. Null when there is no reading to state. */
  chip: string | null;
  /**
   * The plate's mark: the temperature ALONE ("82°"), or "As of 7am" when the
   * reading is dated. The condition phrase — and with it `describeWeather`'s
   * low–high range clause — deliberately never reaches this string: the range
   * lives in the masthead eyebrow and nowhere else (audit 57's rule, packet T).
   */
  mark: string | null;
  /**
   * The SF Symbol drawn beside the mark — `weatherSymbol`'s pick, passed
   * through untouched. Null when there is nothing current to claim: a dated
   * reading keeps its "As of 7am" words and drops the glyph, because a sun
   * next to a two-hour-old number is the icon claiming what the words just
   * disclaimed.
   */
  symbol: string | null;
};

/**
 * How stale a reading may be before it is dated rather than stated.
 *
 * Ninety minutes. Weather is the one fact on this page that goes wrong quietly:
 * a two-hour-old "63° and grey" is not a lie the reader can see, so past this
 * window the reading keeps its words and gains a time, which is the difference
 * between reporting and claiming.
 */
export const WEATHER_STALE_AFTER_MS = 90 * 60 * 1000;

/** "7am" — the hour a dated reading was taken. Lowercase, no minutes. */
export function asOfLabel(at: Date): string {
  const h = at.getHours();
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}${h < 12 ? 'am' : 'pm'}`;
}

/**
 * The four states, resolved once so nothing downstream has to guess.
 *
 * `off` and `unavailable` are different facts and are kept apart: off is a
 * permission this reader has not given, and unavailable is a reading this
 * device could not get. Neither invents a temperature, and neither blocks a
 * morning — the outfits are already built by the time this is asked.
 */
export function resolveWeather(input: {
  /** Null when there is no reading at all. */
  conditionLabel: string | null;
  temperatureLabel: string | null;
  /**
   * `weatherSymbol`'s SF Symbol name for the current condition, or absent.
   * Optional so the surfaces that only read words are untouched by its arrival.
   */
  symbol?: string | null;
  /** When the reading was taken. Null when there is none. */
  fetchedAt: Date | null;
  /** The reader has not granted location. */
  permissionOff: boolean;
  /** The read failed. */
  failed: boolean;
  now: Date;
}): WeatherRead {
  if (input.permissionOff) return { state: 'off', chip: null, mark: null, symbol: null };
  if (input.failed || !input.conditionLabel || !input.temperatureLabel || !input.fetchedAt) {
    return { state: 'unavailable', chip: null, mark: null, symbol: null };
  }
  const reading = `${input.conditionLabel}, ${input.temperatureLabel}`;
  const age = input.now.getTime() - input.fetchedAt.getTime();
  if (age > WEATHER_STALE_AFTER_MS) {
    const at = asOfLabel(input.fetchedAt);
    // A dated reading keeps its words and gains a time — and sheds the glyph,
    // which would otherwise claim as current the condition the words just dated.
    return { state: 'stale', chip: `${reading} · ${at}`, mark: `As of ${at}`, symbol: null };
  }
  // The mark is the temperature ALONE. The founder's card is "82°" plus one
  // condition symbol; the condition PHRASE (which carries the low–high range
  // on a swing day) is composed exactly once, in the masthead eyebrow.
  return { state: 'ok', chip: reading, mark: input.temperatureLabel, symbol: input.symbol ?? null };
}

// ---------------------------------------------------------------------------
// The masthead collapse — a prototype, and it says so
// ---------------------------------------------------------------------------

/**
 * The masthead's height budget, in points — audit 56's "capped at 96 pt",
 * which until now existed only as prose in a comment above the `<Masthead>`
 * call site. Encoded so the collapse below can be reasoned about against a
 * number the repo actually states, not a number somebody remembers.
 */
export const MASTHEAD_CAP = 96;

/**
 * How far the page scrolls before the greeting has fully stepped back, in
 * points. Roughly twice the greeting block's own height (a 30/32 pt serif
 * line plus its support line is ~60 pt): by the time the fade completes, two
 * greeting-heights of content have moved past and the plates have plainly
 * taken the page — the H1 never vanishes ahead of the thing replacing it.
 */
export const MASTHEAD_COLLAPSE_DISTANCE = 120;

/**
 * Where the greeting's opacity lands at full collapse. Zero, because the
 * eyebrow row above it does not move and keeps the page anchored — a greeting
 * held at some ghost opacity under real content would read as a rendering
 * bug, not restraint. The linear ramp from 1 means it is still clearly
 * legible past the halfway point of the distance.
 */
export const MASTHEAD_GREETING_FADE_TO = 0;

/**
 * How far the greeting rises as it fades, in points. Twelve — the same 12 pt
 * that separates the greeting from the eyebrow row, so at full collapse it
 * has drifted exactly the gap it was given and no further. A slight lean
 * into the scroll, not a parallax stunt; anything larger starts colliding
 * with the eyebrow it is supposed to leave behind.
 */
export const MASTHEAD_GREETING_RISE = 12;

// ---------------------------------------------------------------------------
// The carousel
// ---------------------------------------------------------------------------

/** Three, and there is no fourth card and no "load more". */
export const PLATE_COUNT = 3;

export type PlateIndex = 1 | 2 | 3;

/** A scroll offset turned into a one-based position, clamped to the three. */
export function pageFromOffset(offsetX: number, pageWidth: number): PlateIndex {
  if (!Number.isFinite(offsetX) || pageWidth <= 0) return 1;
  const raw = Math.round(offsetX / pageWidth) + 1;
  return Math.min(PLATE_COUNT, Math.max(1, raw)) as PlateIndex;
}

/** "card 2 of 3" — spoken position, so the dots never have to carry it. */
export function positionLabel(index: PlateIndex): string {
  return `card ${index} of ${PLATE_COUNT}`;
}

// ---------------------------------------------------------------------------
// A thin wardrobe — above the floor, below comfort
// ---------------------------------------------------------------------------

/**
 * Enough for today, not enough for every day.
 *
 * Derived rather than numbered: the engine was asked for three and returned
 * fewer, which is the only honest definition of thin that does not invent a
 * second threshold nobody agreed. Zero is not thin — that is the no-viable
 * outcome, which has its own words.
 */
export function isThinWardrobe(shownCount: number): boolean {
  return shownCount > 0 && shownCount < PLATE_COUNT;
}

// ---------------------------------------------------------------------------
// Copy — the accepted frames' own words
// ---------------------------------------------------------------------------

export const TODAY_COPY = {
  /** The activation floor, verbatim and non-negotiable. */
  // "Start with ten pieces" — and the TEN IS DERIVED, not typed. It is
  // `numberWord(TODAY_ACTIVATION_FLOOR)`, which is `PLANS.free.items`, which is
  // the same number The Ten counts to and the free plan caps at. The accepted
  // frame asks for this sentence exactly; building it rather than quoting it is
  // what stops the sentence and the gate ever disagreeing again.
  floorTitle: `Start with ${numberWord(TODAY_ACTIVATION_FLOOR)} pieces`,
  floorBody:
    'Cinch builds mornings out of what you own, so it needs a little to work with. Ten is enough to start.',
  floorAction: 'Photograph your first piece',

  /** The one filled action per plate. */
  wear: 'Wear this',

  /** The context editor's own heading, opened in place — never a modal. */
  occasionHeading: 'What’s on today',
  /** The trip band's eyebrow. See `tripAhead` — drawn only when there is one. */
  tripAheadKicker: 'PACKING SOON',
  /** Its one action, which is the trip's own screen and not a new surface. */
  tripAheadAction: 'Open the packing list',
  /**
   * The quiet way out. The card said "Tokyo, in five days" and until now
   * never went away — a reminder with no acknowledgement is nagging. "Got it"
   * because the card is a sentence somebody was told, not a task: it is held
   * to the same taste bar as the action above it (no numeral, no urgency),
   * and it dismisses THIS trip only — see `tripReminderKey`.
   */
  tripAheadDismiss: 'Got it',
  weatherOff: 'Add weather',

  /** Applying a context: the old plate stays legible while the new one lands. */
  applying: 'Reworking from what you own…',

  /** Enhancement is a parallel track and says so quietly, or says nothing. */
  stillLooking: 'Still looking',

  /** A thin wardrobe — enough for today, said plainly and with no count. */
  thinKicker: 'A THIN WARDROBE',
  thinBody:
    'There is enough here for today, though more pieces would give the mornings more room.',
  thinAction: 'Add a few more',

  /** Nothing clean and suitable. An outcome, not an error. */
  noViableTitle: 'Nothing formal is ready',
  noViableBody:
    'Everything that would work for this is in the wash or stored. Change the occasion and Cinch will build from what is clean.',
  noViableAction: 'Change the occasion',

  /** Show another ran out of genuinely different looks. */
  exhaustedKicker: 'THAT IS EVERYTHING FOR TODAY',

  /** Offline, with a wardrobe already on the phone. */
  offlineKicker: 'YOU’RE OFFLINE',
  offlineCachedBody:
    'These are built from the wardrobe already on this phone. Wearing one saves when you reconnect.',
  offlineNoCacheBody:
    'Your closet has not been read on this phone yet, so there is nothing to build from. Reconnect and Today fills in.',
  tryAgain: 'Try again',

  /** The wear flow. */
  confirmBody: 'It goes into your diary for today. You can rate it now or not at all.',
  confirmAction: 'Log it',
  cancel: 'Cancel',
  ratingHeading: 'How did it feel?',
  ratingOptional: 'You don’t have to rate it.',
  favorite: 'Keep as a favourite',
  save: 'Save',

  /** A settled wear. One restrained mark — no confetti and no score. */
  wornKicker: 'Worn today',
  wornBody: 'It’s in your diary. Tomorrow starts fresh.',
  wornAction: 'Go to your closet',

  /** A write that did not land, and says so without losing the choice. */
  wearFailedKicker: 'THAT DIDN’T SAVE',
  wearFailedBody:
    'The wear was not written and nothing was recorded twice. Your rating is still here.',
  wearFailedRetry: 'Try again',
  wearFailedDismiss: 'Not now',

  /** The occasion interrupt: offered once, dismissible, never a notification. */
  interruptKicker: 'SOMETHING ON TODAY',
  interruptAction: 'Build for it',
  interruptDismiss: 'Not today',
} as const;

/**
 * The exhausted sentence, built from the context it is about.
 *
 * It names what has been seen rather than counting it: "the looks that work for
 * grey and no plans" is a description of a day, where "you have seen 6 of 6"
 * would be a score. No number reaches this string.
 */
export function exhaustedBody(weatherWord: string | null, occasion: string): string {
  const conditions = weatherWord ? `${weatherWord.toLowerCase()} and ${occasion.toLowerCase()}` : occasion.toLowerCase();
  return `You have seen the looks that work for ${conditions}. Change the context or come back tomorrow.`;
}

/**
 * Where this page recomposes instead of shrinking.
 *
 * The same threshold every other rebuilt page in this wave uses, so two pages
 * cannot disagree about what "large" is.
 */
export { AX_STACK_SCALE as TODAY_STACK_SCALE } from '@/features/closet/dynamic-type';

/**
 * The pieces line — "Wool coat, linen shirt, ankle boots".
 *
 * The plate's spoken label is built from this, so the ORDER matters: it is the
 * order the collage lays the garments out in, which is the order somebody
 * looking at the card would read them. A VoiceOver user and a sighted user
 * hear and see the same outfit in the same sequence.
 *
 * Lives here rather than in the card because it is a decision about words and
 * the card is a decision about pixels — and because a `.tsx` cannot be
 * imported by the node suite, so a helper that lived there could not be tested.
 *
 * `pieceName` already answers "what is this garment called" everywhere else in
 * the app, and its untagged fallback is deliberately reused: a piece with no
 * tags reads as the same neutral word here as it does in the closet, which is
 * the same refusal to infer that the image fallback makes.
 */
export function piecesLine(
  pieces: readonly { category: string; subcategory: string | null; colors: readonly { name: string }[] }[],
): string {
  return pieces
    .map((piece, i) => {
      const name = pieceName(piece as never);
      // Only the first opens the sentence; the rest are mid-list, and
      // "Wool coat, Linen shirt" reads as two proper nouns rather than as one
      // outfit.
      return i === 0 ? name : name.charAt(0).toLowerCase() + name.slice(1);
    })
    .join(', ');
}
