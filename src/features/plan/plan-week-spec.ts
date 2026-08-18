import { timeLabel } from '@/features/events/event-lines';
import { describeWeather, formatTemp } from '@/features/context/weather';
import type { WeatherContext } from '@/lib/styling';

/**
 * Plan — the week. The copy it prints and the date arithmetic it swipes on.
 *
 * A `.ts`, not a `.tsx`, for the reason `week-lines.ts` and `packing-math.ts`
 * both give: the node test bundler cannot parse React Native's Flow source, so
 * anything worth PINNING must not reach a component file. Everything here is a
 * pure function of its arguments — no hooks, no `new Date()` read from the
 * ambient clock except where a caller passes one in — which is what lets
 * `tests/plan-week-layout.test.ts` assert the week paging directly instead of
 * inferring it from a render.
 *
 * ── Why every date is anchored at LOCAL noon ─────────────────────────────────
 *
 * A week strip does arithmetic on calendar days, and calendar-day arithmetic on
 * a `Date` pinned to midnight is wrong twice a year. In a zone that springs
 * forward at 00:00 (São Paulo, Santiago, Tehran) there IS no local midnight on
 * that date, so `new Date(y, m, d)` silently lands on 01:00 the same day — or,
 * subtracting a day across the boundary, on 23:00 the day BEFORE the one asked
 * for. Every chip after it is then off by one.
 *
 * Anchoring at 12:00 local buys twelve hours of headroom in each direction,
 * which no real DST shift comes close to spending, so `addDays` is exact for
 * every zone and every date. `daysAhead` in `features/context/weather.ts`
 * already reaches for the same 12:00 trick; this states it once and shares it.
 *
 * LOCAL noon, deliberately, and NOT the UTC noon a first reading might suggest:
 * `dateKey` — the function that turns one of these Dates into the
 * `planned_date` the calendar table is keyed by — reads `getFullYear` /
 * `getMonth` / `getDate`, which are the LOCAL calendar fields. A UTC-noon
 * anchor renders as the previous day everywhere east of UTC+12 and as the next
 * day nowhere, so half the Pacific would file its plans a day early. The anchor
 * has to agree with the reader, and `dateKey` is the reader.
 */

/** Seven chips. The strip's width is this constant, in both directions. */
export const WEEK_LENGTH = 7;

/**
 * The same instant's calendar day, at 12:00 local. See the header.
 *
 * Every other function here goes through this, so there is exactly one place
 * that knows about the anchor and no call site can forget it.
 */
export function dayAnchor(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
}

/** `n` calendar days from `d`, DST-safe. Negative `n` goes back. */
export function addDays(d: Date, n: number): Date {
  const out = dayAnchor(d);
  out.setDate(out.getDate() + n);
  return out;
}

/** Do two Dates fall on the same calendar day, in the reader's own zone? */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * The Monday that opens the week containing `d`.
 *
 * Monday-first because the accepted frames are: the strip reads M T W T F S S
 * and the month sheet's column heads repeat it. That is a DESIGN decision, not
 * a locale one, so it is not read from `Intl` — a US locale would hand back
 * Sunday and silently redraw both surfaces against the artifact.
 */
export function startOfWeek(d: Date): Date {
  // getDay(): 0 = Sunday. Monday-first means Sunday is the SEVENTH day, so it
  // must travel six days back rather than none.
  const dow = dayAnchor(d).getDay();
  return addDays(d, -((dow + 6) % 7));
}

/** The seven days of the week that `weekStart` opens, in order. */
export function weekDates(weekStart: Date): Date[] {
  const start = dayAnchor(weekStart);
  return Array.from({ length: WEEK_LENGTH }, (_, i) => addDays(start, i));
}

/**
 * `delta` weeks from the week `d` sits in — the whole of the swipe gesture's
 * arithmetic. Past and future are the same call with opposite signs; nothing
 * here clamps, because the brief's instruction is that weeks shuffle freely.
 */
export function shiftWeeks(d: Date, delta: number): Date {
  return addDays(startOfWeek(d), delta * WEEK_LENGTH);
}

/**
 * WHICH MONTH A WEEK BELONGS TO — the label above the strip.
 *
 * A week that straddles two months has to pick one, and "the month of its first
 * day" is the tempting answer that reads wrong: the week of Mon 29 September
 * 2026 has six of its seven days in October, and labelling it September puts
 * the reader in the wrong month for most of what they are looking at.
 *
 * ISO 8601 already settled this for week NUMBERING — a week belongs to the year
 * containing its Thursday — and the same midpoint rule is exactly "whichever
 * month owns four or more of the seven days", with no tie to break because
 * seven is odd. So the Thursday is the answer, and it is one line rather than a
 * count.
 */
export function weekMonthAnchor(weekStart: Date): Date {
  return addDays(startOfWeek(weekStart), 3);
}

/** "September" — the strip's month label. */
export function monthLabel(weekStart: Date): string {
  return weekMonthAnchor(weekStart).toLocaleDateString(undefined, { month: 'long' });
}

/** "September 2026" — the month sheet's own heading, where the year matters. */
export function monthTitle(monthAnchor: Date): string {
  return monthAnchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/** The first of the month `d` sits in, anchored at local noon. */
export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 12, 0, 0, 0);
}

/**
 * `delta` months from `d`, landing on the first.
 *
 * Built from the year and month numbers rather than `setMonth`, which overflows
 * silently: `setMonth(1)` on the 31st of January gives the 3rd of March. Going
 * to the FIRST first makes that class of bug unreachable.
 */
export function shiftMonths(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1, 12, 0, 0, 0);
}

/**
 * The month sheet's grid, Monday-first: leading blanks, then every day.
 *
 * `null` is a real cell that draws nothing, not a missing one — the frame's
 * September 2026 opens with four empty squares before the 1st lands on a
 * Tuesday, and a grid built by filtering would slide the whole month left.
 *
 * TRAILING blanks are deliberately absent: the frame's last row stops at the
 * 30th rather than padding out to Sunday, and a 7-column grid needs no filler
 * to keep its columns.
 */
export function monthGrid(monthAnchor: Date): (Date | null)[] {
  const first = startOfMonth(monthAnchor);
  const lead = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();

  return [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => addDays(first, i)),
  ];
}

/** The column heads over both the strip and the grid. Monday-first. */
export const DOW_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

/** "M" — the initial over one chip, from its own date rather than its index. */
export function dowInitial(d: Date): string {
  return DOW_INITIALS[(dayAnchor(d).getDay() + 6) % 7]!;
}

/**
 * "Mon" — the spelled day the AX frame's three-chip strip carries.
 *
 * At the largest Dynamic Type sizes a single letter stops being a label and
 * starts being a glyph, and three of them in a row are indistinguishable
 * (T, T, S, S). The frame's answer is a COMPOSITION change — fewer chips, each
 * one saying more — which is why this is a separate function rather than a
 * truncation of the one above.
 */
export function dowShort(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'short' });
}

/** "Saturday" — the day heading's weekday, and the one the empty state names. */
export function weekdayName(d: Date): string {
  return d.toLocaleDateString(undefined, { weekday: 'long' });
}

/** "Saturday 12" — the plate's heading. */
export function dayHeading(d: Date): string {
  return `${weekdayName(d)} ${d.getDate()}`;
}

/** "12 September" — the month sheet's jump target, said in full. */
export function jumpLabel(d: Date): string {
  return `${d.getDate()} ${d.toLocaleDateString(undefined, { month: 'long' })}`;
}

// ---------------------------------------------------------------------------
// Weather, as a MARK rather than a sentence
// ---------------------------------------------------------------------------

/**
 * "16°" — the mark under a chip, or null.
 *
 * Null rather than a dash when the day has no forecast, and that is the whole
 * of the honesty here: Open-Meteo forecasts sixteen days ahead and nothing
 * behind, so swiping to March or to next November hands these chips no weather
 * at all. The mark is then ABSENT. Nothing is estimated, nothing is carried
 * over from the nearest day that does have a reading, and no seasonal normal
 * stands in wearing a forecast's clothes.
 */
export function chipTemp(weather: WeatherContext | null, units: 'C' | 'F' = 'F'): string | null {
  return weather ? formatTemp(weather.feelsLikeC, units) : null;
}

/**
 * "18° · clear" — the line beside the day heading, or null.
 *
 * Composed from the two existing weather vocabularies rather than a third one:
 * `formatTemp` for the figure and `describeWeather` for the reason. Neither
 * invents; `describeWeather` returns "warm" / "mild" / "cold" from the
 * temperature it was handed, and the rain, wind and swing fragments only appear
 * once the forecast actually crosses their thresholds.
 */
export function dayWeatherLine(
  weather: WeatherContext | null,
  units: 'C' | 'F' = 'F',
): string | null {
  if (!weather) return null;
  return `${formatTemp(weather.feelsLikeC, units)} · ${describeWeather(weather, units)}`;
}

/**
 * "Saturday 12 · 18°" — the AX frame's heading, weather folded in.
 *
 * At the largest type sizes the heading and its weather mark cannot share a
 * row, and the frame's answer is again composition rather than truncation: the
 * two become one line. The CONDITION drops rather than the figure, because the
 * figure is the half that survives being read at a glance.
 */
export function dayHeadingAx(d: Date, weather: WeatherContext | null, units: 'C' | 'F' = 'F'): string {
  const temp = chipTemp(weather, units);
  return temp ? `${dayHeading(d)} · ${temp}` : dayHeading(d);
}

/**
 * The empty state's second line — "Showers, so it will favour boots." — or null.
 *
 * Every branch is a fact the forecast HOLDS, at the same thresholds
 * `describeWeather` already uses, and the sentence says what the day will
 * favour rather than what the week will contain. Null when the forecast is
 * missing or unremarkable: a mild dry day has nothing to say, and filling the
 * line with something anyway is how a screen starts narrating.
 *
 * NOTE what this deliberately never says: how many outfits exist, how many
 * pieces are involved, or how many looks a closet can make. The week engine
 * promises no counts and neither does its empty state.
 */
export function weatherNudge(weather: WeatherContext | null): string | null {
  if (!weather) return null;
  if (weather.precipitationChance >= 0.4) return 'Showers, so it will favour boots.';
  if (weather.windKph >= 25) return 'Windy, so it will favour a layer that stays put.';
  if (weather.swing) return 'The day moves a lot, so it will favour something you can take off.';
  if (weather.feelsLikeC >= 24) return 'Warm, so it will favour the lightest things you own.';
  if (weather.feelsLikeC <= 8) return 'Cold, so it will favour your warmest layers.';
  return null;
}

// ---------------------------------------------------------------------------
// The occasion on a day
// ---------------------------------------------------------------------------

/**
 * "8:30 pm · 4 friends going" — the event card's second line, or null.
 *
 * `timeLabel` is the app's existing time vocabulary ("8:30pm"); the space
 * before the meridiem is added here because this line sets it against a middot
 * and the frame reads it as two words. The count is `memberCount` — people who
 * actually JOINED — so a room of declines never inflates it, and it is dropped
 * entirely below one rather than printing "0 friends going".
 */
export function occasionLine(startsAt: Date | null, memberCount: number): string | null {
  const time = timeLabel(startsAt)?.replace(/(am|pm)$/, ' $1') ?? null;
  const going = memberCount > 0 ? `${memberCount} ${memberCount === 1 ? 'friend' : 'friends'} going` : null;
  const parts = [time, going].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

// ---------------------------------------------------------------------------
// The chip's state — one predicate per visual, so the body branches on nouns
// ---------------------------------------------------------------------------

/**
 * What a day chip IS, in the order the frame resolves it.
 *
 * Selection wins over today, because the frame draws Saturday filled oxblood
 * while Tuesday keeps only its ring — a day cannot be both the fill and the
 * ring, and the one under the reader's finger is the one that takes the fill.
 * `planned` is the blush ground beneath both.
 */
export type ChipState = 'selected' | 'today' | 'planned' | 'plain';

export function chipState({
  date,
  selected,
  today,
  planned,
}: {
  date: Date;
  selected: Date;
  today: Date;
  planned: boolean;
}): ChipState {
  if (isSameDay(date, selected)) return 'selected';
  if (isSameDay(date, today)) return 'today';
  return planned ? 'planned' : 'plain';
}

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

/**
 * Every string the week draws, in one table.
 *
 * NOTHING HERE PROMISES A COUNT. The week outfit engine prefers spreading wear
 * but cannot guarantee a number of distinct looks, and the previous masthead
 * shipped "No piece worn more than twice" over a week that visibly broke it.
 * The rule survives that lesson: no sentence below names an outfit count, a
 * piece count, or a number of days it will fill.
 */
export const WEEK_COPY = {
  title: 'Plan',

  /** The plate's two actions on a planned day. */
  logWear: 'Log this wear',
  keepPlan: 'Keep this plan',
  swapPlate: 'Swap the plate',

  /** The empty day. Both take the weekday so the day names itself. */
  emptyTitle: (weekday: string) => `Nothing planned for ${weekday}`,
  emptyAction: (weekday: string) => `Plan ${weekday}`,

  /** The plate's own failure — the strip above it stays live. */
  errorKicker: 'OFFLINE',
  errorTitle: 'The plate didn’t load',
  errorRetry: 'Try again',
  errorEscape: 'Open the closet',

  /** The month sheet. */
  monthSheetLabel: 'Jump to a month',
  monthPrev: 'Previous month',
  monthNext: 'Next month',
  legendPlanned: 'Planned',
  legendEvent: 'Event',
  legendToday: 'Today',
  jump: (day: string) => `Jump to ${day}`,

  /**
   * A write that did not land, said in the toast.
   *
   * Both sentences name what did NOT happen, per UX-08 — a failure the user
   * cannot see the shape of is a failure they will assume went through. Neither
   * promises a retry the screen does not offer: the action is still there under
   * their thumb.
   */
  planFailed: 'That day wasn’t saved. Nothing else in your week changed.',
  wearFailed: 'The wear wasn’t logged. Nothing was counted.',

  /** Spoken labels for the strip's gesture, which has no visible affordance. */
  stripLabel: 'Week of',
  prevWeek: 'Previous week',
  nextWeek: 'Next week',
} as const;

/**
 * WHICH PRIMARY ACTION A DAY GETS — and the one place this build knowingly
 * departs from the accepted frame.
 *
 * The frame draws "Log this wear" on Saturday the 12th while today is Tuesday
 * the 8th. Wired literally that button would call `useWearOutfit` for a day
 * nobody has lived through yet, and a wear is not a plan: it increments
 * `wear_count`, stamps `last_worn_at`, and feeds both the cost-per-wear figures
 * and the freshness rule that stops the app offering the same jacket three days
 * running. Logging one four days early corrupts all of that, and no amount of
 * frame fidelity is worth a number the app then reports as fact.
 *
 * So the verb follows the day. Today and every day behind it can be WORN;
 * every day ahead can only be KEPT, which is exactly the distinction
 * `usePlanOutfit`'s own header already draws ("a plan is an intention, and
 * counting it as a wear would corrupt both the cost-per-wear numbers and the
 * freshness rule"). The frame's label survives verbatim wherever it is true.
 */
export type PrimaryAction = { label: string; kind: 'wear' | 'keep' };

export function primaryAction(selected: Date, today: Date): PrimaryAction {
  const future = dayAnchor(selected).getTime() > dayAnchor(today).getTime();
  return future
    ? { label: WEEK_COPY.keepPlan, kind: 'keep' }
    : { label: WEEK_COPY.logWear, kind: 'wear' };
}

// ---------------------------------------------------------------------------
// Geometry — the artifact's numbers
// ---------------------------------------------------------------------------

/**
 * The measurements the accepted frames state, so the body reads them by name
 * and the test can assert them without re-measuring a PNG.
 *
 * Every one of these is a FLOOR or a radius, never a fixed height on anything
 * carrying type. The two exceptions are declared as such below.
 */

/** The day chip's corner, and the ring width that marks today. */
export const CHIP_RADIUS = 15;
export const CHIP_BORDER = 1.5;
/** Between chips. The strip's own margin is the page gutter less this again. */
export const CHIP_GAP = 5;

/**
 * The chip's thumbnail well — 32 × 36.
 *
 * A fixed size, and legitimately: it is a PICTURE box, not a label. It holds a
 * garment photograph or a flat ground, and nothing inside it grows with
 * Dynamic Type. The AX frame removes it entirely rather than scaling it, which
 * is why this number never has to stretch.
 */
export const CHIP_THUMB_WIDTH = 32;
export const CHIP_THUMB_HEIGHT = 36;

/** The event dot, on a chip and in the month grid. A mark, never type. */
export const DOT = 5;

/** The plate's two rows. The left column spans both. */
export const PLATE_ROW = 118;
/** The sand showing between the plate's tiles. */
export const PLATE_GAP = 3;
/** The AX frame's plate — one short row, because the type below it needs the room. */
export const PLATE_ROW_AX = 74;

/** The occasion card and the month sheet's cells. */
export const CARD_RADIUS = 15;
export const CELL_RADIUS = 13;
export const CELL_MIN_HEIGHT = 46;

/** The primary action's floor, and the secondary's. Floors, not heights. */
export const CTA_MIN_HEIGHT = 56;
export const CTA_SECONDARY_MIN_HEIGHT = 52;
export const CTA_RADIUS = 16;

/** The month sheet's lip. */
export const SHEET_RADIUS = 30;

/**
 * The largest type at which this page still draws itself the way the frames at
 * standard size do.
 *
 * `AX_STACK_SCALE` and not a number of this page's own, for the reason
 * `people-search-spec.ts` gives: three screens changing composition at three
 * thresholds is three different apps to the person moving the slider.
 */
export { AX_STACK_SCALE as PLAN_WEEK_STACK_SCALE } from '@/features/closet/dynamic-type';

/**
 * How many chips the strip draws at a given type size.
 *
 * Seven at standard, three at the accessibility sizes — the AX frame's own
 * answer, and a COMPOSITION change rather than a truncation: the three that
 * remain spell their weekday out ("Fri", "Sat", "Sun") where the seven show a
 * single letter. Nothing is scaled below its documented size and nothing is
 * clipped; the week simply shows a window onto itself, centred on the selected
 * day, and the swipe still moves a whole week at a time.
 */
export const AX_VISIBLE_CHIPS = 3;

export function visibleChipCount(large: boolean): number {
  return large ? AX_VISIBLE_CHIPS : WEEK_LENGTH;
}

/**
 * The window of the week the AX strip shows — three chips centred on the
 * selection, clamped so it never runs off either end of the seven.
 *
 * Returns the whole week untouched at standard size, so the body has one code
 * path and the branch lives here where it can be asserted.
 */
export function visibleDays<T>(days: readonly T[], selectedIndex: number, large: boolean): T[] {
  if (!large || days.length <= AX_VISIBLE_CHIPS) return [...days];
  const start = Math.min(
    Math.max(0, selectedIndex - Math.floor(AX_VISIBLE_CHIPS / 2)),
    days.length - AX_VISIBLE_CHIPS,
  );
  return days.slice(start, start + AX_VISIBLE_CHIPS);
}
