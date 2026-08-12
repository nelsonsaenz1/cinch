import { type DayPartKey, type IsoDate, addDays } from './trip';

/**
 * The arithmetic the packing questionnaire says out loud.
 *
 * K-03 prints a running total under the chips — "Two day parts across four days
 * is eight looks" — and K-05 then promises exactly that many. The two numbers
 * have to be the same number, computed once, or the flow lies to itself between
 * screens.
 *
 * PURE, AND IN A `.ts`. The test bundler runs esbuild, which cannot parse React
 * Native's Flow-typed source, so anything a test needs to import must not reach
 * a `.tsx` — see docs/design/free-tier-contract.md for the same rule and the
 * same reason.
 */

/**
 * `days × parts`, except for travel — the one place that formula is wrong.
 *
 * You travel on the way out and on the way back. A trip does not have four
 * travel days because it is four days long, and packing a fourth aeroplane
 * outfit is precisely the over-packing this screen exists to stop. A one-day
 * trip has one.
 */
export const looksForPart = (days: number, part: DayPartKey): number =>
  part === 'travel' ? Math.min(2, days) : days;

export const looksFor = (days: number, parts: readonly DayPartKey[]): number =>
  parts.reduce((total, part) => total + looksForPart(days, part), 0);

/**
 * The order looks are WORN, which is not the order they are asked for.
 *
 * `DAY_PARTS` is chip order and follows the atlas's own layout — Daytime,
 * Evening, Gym, Travel days. A day reads in a different order than it is
 * chosen: you land, you go to the gym, you spend the day, you go to dinner.
 */
const LOOK_ORDER: readonly DayPartKey[] = ['travel', 'gym', 'daytime', 'evening'] as const;

export type Look = {
  /** Which day of the trip, 0-based. */
  dayIndex: number;
  date: IsoDate;
  part: DayPartKey;
};

/**
 * Every look the trip needs, in the order the memo prints them.
 *
 * Day-major: all of Friday, then all of Saturday. The memo is a day-by-day
 * document and a reader packs by day, not by part.
 */
export function lookSchedule(
  startsOn: IsoDate,
  days: number,
  parts: readonly DayPartKey[],
): Look[] {
  const wanted = LOOK_ORDER.filter((p) => parts.includes(p));
  const looks: Look[] = [];

  for (let dayIndex = 0; dayIndex < days; dayIndex++) {
    const date = addDays(startsOn, dayIndex);
    for (const part of wanted) {
      if (part === 'travel' && !isTravelDay(dayIndex, days)) continue;
      looks.push({ dayIndex, date, part });
    }
  }

  return looks;
}

/**
 * The first and last day, whatever was tapped.
 *
 * A day is a travel day because of the dates, not because of a chip — K-05
 * captions Friday "24° · travel day" regardless. The chip decides whether that
 * day gets a look of its own; this decides whether it gets the caption.
 */
export const isTravelDay = (dayIndex: number, days: number): boolean =>
  dayIndex === 0 || dayIndex === days - 1;

/**
 * WHY THERE IS NO `targetPieces()` HERE.
 *
 * K-03 prints "Cinch will try to do it in eleven pieces" beside the look count.
 * Eleven is not derivable from four days and two day parts: the honest floor for
 * eight looks is six pieces that all recombine (2 tops × 2 bottoms × 2 shoes,
 * the same arithmetic as the free-tier contract's `countOutfits`), and the real
 * answer depends on the weather, the formality spread and what the closet
 * actually holds — none of which are known when that line is on screen.
 *
 * So the running total states the look count and stops. A predicted piece count
 * would be a promise made before the search that produces it, and the memo would
 * then either break it or be tuned to meet it. The look count is a fact about
 * the answers; the piece count is a result, and results are printed in K-05
 * where they are known.
 */

/**
 * "Two day parts across four days is eight looks."
 *
 * Spelled out, because the atlas spells it out and because this is a sentence
 * rather than a readout — it sits in body copy under the chips, not in a
 * counter. Above twenty the words get worse than the digits, so it stops.
 */
const WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen',
  'nineteen', 'twenty',
];

/**
 * `4` → `"four"`.
 *
 * Exported because three surfaces spell the same numbers: K-03's running
 * arithmetic, K-01's history line ("four days in Lisbon… eleven pieces and
 * nine looks") and K-05's memo. Unit Q had to keep a second copy of this table
 * while it was private, which is the beginning of the drift that put the same
 * function in two files last wave.
 */
export const spellOut = (n: number): string => WORDS[n] ?? String(n);

const word = spellOut;

const sentenceCase = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export function looksSentence(days: number, parts: readonly DayPartKey[]): string {
  const looks = looksFor(days, parts);
  const partCount = parts.length;

  return (
    `${sentenceCase(word(partCount))} day ${partCount === 1 ? 'part' : 'parts'} ` +
    `across ${word(days)} ${days === 1 ? 'day' : 'days'} ` +
    `is ${word(looks)} ${looks === 1 ? 'look' : 'looks'}.`
  );
}

/** `×3`, `×4`, or `worn` for the one piece that never enters the bag. */
export function repeatLabel(days: number, worn: boolean): string {
  return worn ? 'worn' : `×${days}`;
}

// ---------------------------------------------------------------------------
// PK-03 — the count that sits ON the piece
// ---------------------------------------------------------------------------

/** Which looks a garment appears in, by their part of the day. */
export type PieceCoverage = { parts: readonly DayPartKey[]; count: number; worn: boolean };

/**
 * "3 days", "6 nights", "2 looks", "Worn" — the chip at the foot of a packed
 * piece.
 *
 * PK-03 puts the repeat count ON the garment rather than in a summary strip,
 * which removes a whole row of numbers, and the atlas writes the unit in the
 * words the trip actually uses: the linen blouse carries "3 days", the boots
 * "6 nights". That unit is DERIVED, not chosen — it follows the parts of the
 * day the piece is packed for:
 *
 *   · every look is an evening        → nights
 *   · no look is an evening           → days
 *   · a mix of the two                → looks, which is the memo's own word for
 *                                        a dressed moment and the only unit
 *                                        that is true of both
 *
 * The departure shoe reads "Worn", exactly as the directive allows: it is on
 * your feet on the plane, so it never enters the bag and a repeat count would
 * be describing space it does not take.
 *
 * Nothing here is estimated. A piece that appears in one look and is not worn
 * on departure gets NO chip at all (`null`) — PK-03 names those in prose
 * instead of padding the grid with a count of one.
 */
export function packedPieceChip(coverage: PieceCoverage): string | null {
  if (coverage.worn) return 'Worn';
  if (coverage.count <= 1) return null;

  const evenings = coverage.parts.filter((p) => p === 'evening').length;
  if (evenings === coverage.parts.length) return `${coverage.count} nights`;
  if (evenings === 0) return `${coverage.count} days`;
  return `${coverage.count} looks`;
}
