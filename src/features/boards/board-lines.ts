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
 * The quadrant is FIXED at four cells (audit 98).
 *
 * Named here rather than written as `4` in the tile, the meta line and the
 * test, because the whole of audit 98 is a rule about what happens at the
 * boundary — three pieces get a designed fourth cell, five or more get a
 * sentence instead of a fifth — and a boundary spelled in three places drifts.
 */
export const QUADRANT_CELLS = 4;

/**
 * `worn once` · `worn twice` · `worn 4 times` · `not worn yet`.
 *
 * AUDIT 98 — NEVER-WORN IS WORDS. Not a zero and not a dash: "worn 0×" is a
 * score against a plan that has simply not happened yet, and a dash is the app
 * declining to say. "not worn yet" is the fact, and it is the normal case for a
 * plate kept this morning.
 *
 * Once and twice are words because English has them; past that the figure is
 * clearer than "thrice". A negative count cannot happen and reads as unworn
 * rather than printing nonsense.
 */
export function wearLine(wornCount: number): string {
  if (wornCount <= 0) return 'not worn yet';
  if (wornCount === 1) return 'worn once';
  if (wornCount === 2) return 'worn twice';
  return `worn ${wornCount} times`;
}

/**
 * `Saved in June` — the month a plate was kept.
 *
 * The month alone, never the day: a collection at rest is browsed by season,
 * and "Saved on 14 June" is a precision nobody reads. The year appears only
 * when it is not this one, the rule every other date in the app follows. An
 * unparseable timestamp drops the clause rather than printing "Invalid Date".
 */
export function savedLine(savedAt: string, now: Date = new Date()): string | null {
  const at = new Date(savedAt);
  if (Number.isNaN(at.getTime())) return null;
  const month = longMonth(at);
  return at.getFullYear() === now.getFullYear()
    ? `Saved in ${month}`
    : `Saved in ${month} ${at.getFullYear()}`;
}

/**
 * The meta line under a plate: `Saved in June · worn twice`.
 *
 * AUDIT 98 — SAVED STATE AND WEAR COUNT ARE VISUALLY DISTINCT, and their order
 * is fixed: the saved month first, the wear count second, in the same 13pt
 * line. The board name is NOT on this line any more — the chip rail above
 * already says which board is held, and which board a plate sits on is a fact
 * about the collection rather than about the plate.
 *
 * A plate of five or more pieces states its total here rather than cramming a
 * fifth into a four-cell tile: `5 pieces · Saved in August · worn once`. Four
 * or fewer says nothing, because the tile has already shown them all.
 */
export function plateMetaLine(
  plate: Pick<KeptPlate, 'savedAt' | 'wornCount' | 'itemIds'>,
  now: Date = new Date(),
): string {
  const total = plate.itemIds.length;
  return [
    total > QUADRANT_CELLS ? plural(total, 'piece', 'pieces') : null,
    savedLine(plate.savedAt, now),
    wearLine(plate.wornCount),
  ]
    .filter(Boolean)
    .join(' · ');
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

/**
 * `Work 5` — a board's chip, with its count inline.
 *
 * The count is dropped rather than printed as a zero: an empty board is one tap
 * old and "Work 0" reads as a defect. Chips are 14pt regular with the held one
 * in Medium; the weight is the chip's business, the words are this one's.
 */
export const boardChipLabel = (name: string, plateCount: number): string =>
  plateCount > 0 ? `${name} ${plateCount}` : name;

/**
 * `14 plates · 4 boards` — SV-01's masthead line.
 *
 * Either half is dropped when it is zero, and with both gone the line does not
 * render at all: the page's own empty state is what speaks then.
 */
export function savedSummaryLine(plateCount: number, boardCount: number): string | null {
  const parts = [
    plateCount > 0 ? plural(plateCount, 'plate', 'plates') : null,
    boardCount > 0 ? plural(boardCount, 'board', 'boards') : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

/**
 * `started in March` — when a board was made.
 *
 * Readable, and read: `boards.created_at` is a real column
 * (`20260810100000_wear_diary_and_boards.sql:50`), carried through
 * `Board.createdAt`. The month only, and the year only when it is not this one.
 * Null when the column has not been read — the clause is dropped rather than
 * guessed at.
 */
export function boardStartedLine(createdAt: string | null, now: Date = new Date()): string | null {
  if (!createdAt) return null;
  const at = new Date(createdAt);
  if (Number.isNaN(at.getTime())) return null;
  const month = longMonth(at);
  return at.getFullYear() === now.getFullYear()
    ? `started in ${month}`
    : `started in ${month} ${at.getFullYear()}`;
}

/**
 * SV-02's board line: `5 plates · started in March`, or the trip's dates when
 * it has them.
 *
 * A dated board is a trip, and its range is the more useful fact — so the dates
 * displace the birthday rather than joining it. An empty board says so in words
 * instead of printing "0 plates".
 */
export function boardDetailLine(input: {
  plateCount: number;
  startsOn: IsoDay | null;
  endsOn: IsoDay | null;
  createdAt: string | null;
  now?: Date;
}): string {
  const dates = isDatedBoard(input)
    ? formatBoardRange(input.startsOn, input.endsOn)
    : boardStartedLine(input.createdAt, input.now);

  return [
    input.plateCount === 0 ? 'No plates yet' : plural(input.plateCount, 'plate', 'plates'),
    dates,
  ]
    .filter(Boolean)
    .join(' · ');
}

// ---------------------------------------------------------------------------
// SV-02 · deleting a board
// ---------------------------------------------------------------------------

/** Spelled to twelve, because the heading is a sentence, not a figure. */
const SPELLED = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six',
  'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
] as const;

/**
 * THE CONFIRMATION LEADS WITH WHAT IS KEPT — audit 98's sentence, as the
 * heading rather than as a reassurance buried under a warning.
 *
 * It is true, and it is the schema that makes it true: `outfits.board_id` is
 * declared `references boards (id) ON DELETE SET NULL`
 * (`20260810100000_wear_diary_and_boards.sql:93`), so deleting a board detaches
 * its plates and destroys none of them. `useDeleteBoard` is one `delete` on
 * `boards` and touches no other table.
 */
export function deleteBoardHeading(plateCount: number): string {
  if (plateCount === 0) return 'Nothing is kept on this board';
  const spelled = plateCount >= 0 && plateCount <= 12 ? SPELLED[plateCount] : String(plateCount);
  return `The ${spelled.toLowerCase()} ${plateCount === 1 ? 'plate is' : 'plates are'} kept`;
}

/**
 * Where they go, and what is not touched.
 *
 * NOTHING HERE SAYS PERMANENT, because for a board it is not: only the
 * grouping is lost, and every plate, name, piece and wear count survives it.
 * Saying "permanent" of a reversible arrangement is how a warning stops being
 * believed on the screen where it is true.
 */
export function deleteBoardBody(boardName: string): string {
  return (
    `Deleting “${boardName}” removes the board only. Its plates return to All saved, with their ` +
    'names, pieces and wear counts intact. No garment is affected.'
  );
}

export const DELETE_BOARD_KEEP = 'Keep the board';
export const DELETE_BOARD_CONFIRM = 'Delete the board';

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
