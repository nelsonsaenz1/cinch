import type { Board, IsoDay, KeptPlate } from './types';

/**
 * Every sentence and every count atlas 35 prints, as pure functions.
 *
 * `.ts`, not `.tsx`, and deliberately: the test bundler cannot parse React
 * Native's Flow source, so anything a test needs to see has to live where no
 * component import can reach it. The screens below are then thin enough that
 * what is left in them is layout.
 *
 * The rule these all serve is the same one: **counts are printed or dropped,
 * never estimated.** "never worn" is a printed zero, not a shrug — KP says it
 * plainly because "a kept look that has not happened yet is the normal case,
 * not a failure".
 */

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/**
 * Parsed at local noon, which no timezone shift can push onto another day.
 *
 * Same reasoning as `features/plan/trip.ts` — a board's dates are calendar
 * days in the traveller's own calendar, not instants, and midnight-local read
 * one zone west is the day before.
 */
function atNoon(iso: IsoDay): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

const longMonth = (d: Date) => d.toLocaleDateString(undefined, { month: 'long' });

/**
 * A board is dated only when BOTH ends are set.
 *
 * This is the predicate behind "dates make it a trip": the `Send to Packing`
 * action appears exactly when this is true, and nowhere else. Written as a
 * type guard so the call site that reads `board.startsOn` afterwards does not
 * need a second null check to satisfy the compiler — the check IS the rule.
 */
export function isDatedBoard(
  board: Pick<Board, 'startsOn' | 'endsOn'>,
): board is Pick<Board, 'startsOn' | 'endsOn'> & { startsOn: IsoDay; endsOn: IsoDay } {
  return board.startsOn != null && board.endsOn != null;
}

/**
 * `14–19 September` — KP-03's own line: an en dash, the month said once when
 * it does not change, and the month spelled out.
 *
 * Locale-formatted rather than built from a month table, so a device set to
 * French says "septembre" on its own terms. The month is LONG here where the
 * packing questionnaire's `formatDateRange` uses the short form; the two are
 * different sentences in different places, not a duplicated one — this is a
 * page heading with room, that is a chip.
 */
export function formatBoardRange(startsOn: IsoDay, endsOn: IsoDay): string {
  const a = atNoon(startsOn);
  const b = atNoon(endsOn);

  const sameYear = a.getFullYear() === b.getFullYear();
  const sameMonth = sameYear && a.getMonth() === b.getMonth();

  if (sameMonth && a.getDate() === b.getDate()) return `${a.getDate()} ${longMonth(a)}`;
  if (sameMonth) return `${a.getDate()}–${b.getDate()} ${longMonth(b)}`;
  if (sameYear) return `${a.getDate()} ${longMonth(a)} – ${b.getDate()} ${longMonth(b)}`;
  return (
    `${a.getDate()} ${longMonth(a)} ${a.getFullYear()} – ` +
    `${b.getDate()} ${longMonth(b)} ${b.getFullYear()}`
  );
}

// ---------------------------------------------------------------------------
// The plate at rest
// ---------------------------------------------------------------------------

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * `worn 6×`, or `never worn`.
 *
 * The zero is spelled out rather than printed as "worn 0×" because the atlas
 * insists on it: never worn is a statement about a plan, and "0×" is a score.
 * A negative count cannot happen, and is clamped rather than printed.
 */
export function wearLine(wornCount: number): string {
  return wornCount > 0 ? `worn ${wornCount}×` : 'never worn';
}

/**
 * The meta line under a plate: `Work · worn 6×`, or just `never worn` for a
 * plate that sits in All.
 *
 * Board first, then the count — KP's "The plate at rest" states the order, and
 * it is the order that makes the line scannable down a column.
 */
export function plateMeta(boardName: string | null, wornCount: number): string {
  const wear = wearLine(wornCount);
  return boardName ? `${boardName} · ${wear}` : wear;
}

/**
 * What the card is called.
 *
 * "Whatever it was given when kept, or the occasion it was planned for. Never
 * auto-generated from the garment list here." So when there is neither, this
 * returns null and the card prints no title rather than assembling one out of
 * "Blouse, skirt, loafers" — that grammar belongs to the diary, and borrowing
 * it here would make two different screens claim to be naming the same thing.
 */
export function plateTitle(plate: Pick<KeptPlate, 'name' | 'occasion'>): string | null {
  const name = plate.name?.trim();
  if (name) return name;
  const occasion = plate.occasion?.trim();
  return occasion ? occasion : null;
}

// ---------------------------------------------------------------------------
// The collection
// ---------------------------------------------------------------------------

/** `All 14` — the leading chip, carrying the size of the whole set. */
export const allChipLabel = (total: number): string => `All ${total}`;

/** How many kept plates sit on each board, keyed by board id. */
export function plateCountsByBoard(
  plates: readonly Pick<KeptPlate, 'boardId'>[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const plate of plates) {
    if (!plate.boardId) continue;
    counts[plate.boardId] = (counts[plate.boardId] ?? 0) + 1;
  }
  return counts;
}

/** The set under a chip. `null` is All, which is every kept plate. */
export function platesOnBoard<T extends Pick<KeptPlate, 'boardId'>>(
  plates: readonly T[],
  boardId: string | null,
): T[] {
  return boardId === null ? [...plates] : plates.filter((p) => p.boardId === boardId);
}

/**
 * Distinct pieces across a set of plates.
 *
 * DISTINCT, not the sum of the looks: KP-03 prints "11 pieces in all", and the
 * thing a reader wants from that number is how much goes in the bag. Four
 * looks that share one pair of trousers are four looks and one pair of
 * trousers. It is also exactly what "Send to Packing" hands over, so the
 * number on screen and the number that travels are the same number.
 */
export function pieceCount(plates: readonly Pick<KeptPlate, 'itemIds'>[]): number {
  return distinctPieces(plates).length;
}

/** The same set, as ids, in first-seen order. */
export function distinctPieces(plates: readonly Pick<KeptPlate, 'itemIds'>[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const plate of plates) {
    for (const id of plate.itemIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      ordered.push(id);
    }
  }
  return ordered;
}

/**
 * KP-03's summary: `4 plates · 14–19 September · 11 pieces in all`.
 *
 * Each fragment is dropped rather than faked when there is nothing behind it —
 * an undated board says only how many plates it holds, and an empty board says
 * so in words instead of printing "0 plates", which reads as a defect rather
 * than as a board somebody made a minute ago.
 */
export function boardSummary(input: {
  plateCount: number;
  pieceCount: number;
  startsOn: IsoDay | null;
  endsOn: IsoDay | null;
}): string {
  const dates = isDatedBoard(input) ? formatBoardRange(input.startsOn, input.endsOn) : null;

  if (input.plateCount === 0) {
    return ['No plates yet', dates].filter(Boolean).join(' · ');
  }

  return [
    plural(input.plateCount, 'plate', 'plates'),
    dates,
    `${plural(input.pieceCount, 'piece', 'pieces')} in all`,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** `6 plates` — the count beside a board in the Keep sheet. */
export const boardPlateCountLabel = (count: number): string => plural(count, 'plate', 'plates');

// ---------------------------------------------------------------------------
// Writing a board
// ---------------------------------------------------------------------------

/** The database's own bound (`char_length(btrim(name)) between 1 and 60`). */
export const BOARD_NAME_MAX = 60;

export type BoardDraftProblem = 'empty-name' | 'long-name' | 'half-range' | 'backwards-range';

/**
 * Everything the two `boards` check constraints refuse, checked before the
 * round trip.
 *
 * Not a second source of truth — the constraints stay the authority, and a
 * race that gets past this still meets them. This exists so the sheet can
 * disable its own button instead of turning a designed form into a Postgres
 * error, and so the "dates are optional together" rule is stated somewhere the
 * reader of the form can see it.
 */
export function boardDraftProblem(draft: {
  name: string;
  startsOn: IsoDay | null;
  endsOn: IsoDay | null;
}): BoardDraftProblem | null {
  const name = draft.name.trim();
  if (!name) return 'empty-name';
  if (name.length > BOARD_NAME_MAX) return 'long-name';

  const set = Number(draft.startsOn != null) + Number(draft.endsOn != null);
  if (set === 1) return 'half-range';
  if (set === 2 && draft.endsOn! < draft.startsOn!) return 'backwards-range';

  return null;
}
