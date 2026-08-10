/**
 * The diary's derivations — grouping, the year chips, and every line of type
 * the two screens print.
 *
 * A `.ts` on purpose: the test bundler (esbuild, `scripts/run-tests.mjs`)
 * cannot parse React Native's Flow-typed source, so anything importable from a
 * `.tsx` is untestable by construction. Everything here is pure, and
 * `tests/diary.test.ts` is what actually holds the rules — above all the two
 * that are easy to break by accident: a piece with no price gets no cost-per-
 * wear line at all, and the 24-hour correction window is read from the clock
 * rather than assumed.
 *
 * Dates are read in LOCAL time throughout. A diary is a calendar: a wear
 * confirmed at 11pm on the 7th belongs to the 7th for the person who wore it,
 * whatever UTC thinks.
 */

import { costPerWear } from '@/schemas/item';

import type { DiaryEntry, DiaryMonth, DiaryPiece, YearChip } from './types';

/** The chip that means "no filter". */
export const ALL_YEARS = 'all';
/** The chip that means the calendar year we are standing in. */
export const THIS_YEAR = 'this-year';

/** How long an entry stays correctable. Enforced in SQL; mirrored here for the UI. */
export const CORRECTION_WINDOW_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/** `2026-08`, from the LOCAL calendar. */
export function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** "August 2026" — the month header, and the entry page's back-link. */
export function monthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
}

/**
 * The 44pt date column: weekday over numeral.
 *
 * Returned in title case and uppercased by the type variant, not here — the
 * uppercasing is a typographic choice and belongs with the type, so an
 * accessibility label reading "Fri" is not shouted at a screen reader.
 */
export function dayCell(iso: string): { weekday: string; day: string } {
  const d = new Date(iso);
  return {
    weekday: d.toLocaleDateString('en-GB', { weekday: 'short' }),
    day: String(d.getDate()),
  };
}

/** "Friday 7 August" — the entry page's headline. */
export function entryDateLine(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/**
 * "confirmed 8:12am".
 *
 * `worn_at` is `now()` at the moment of the confirm — a real timestamp, not a
 * date the user picked — so printing the time is a fact about the record
 * rather than a claim about when the clothes went on.
 */
export function confirmedLine(iso: string): string {
  const time = new Date(iso)
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    .replace(/\s?AM$/i, 'am')
    .replace(/\s?PM$/i, 'pm');
  return `confirmed ${time}`;
}

/** "Dinner at Nora's · confirmed 8:12am", or just the confirmation. */
export function entrySubtitle(entry: DiaryEntry): string {
  const occasion = entry.occasion?.trim();
  return occasion ? `${occasion} · ${confirmedLine(entry.wornAt)}` : confirmedLine(entry.wornAt);
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

/** The fallback word, matching `pieceName`'s: "other" is the absence of a name. */
const UNTAGGED = 'untagged piece';

/** The bare kind word — "shearling coat". Lowercase, as the tagger writes it. */
export function pieceWord(piece: DiaryPiece): string {
  const kind = piece.kind ?? (piece.category === 'other' ? null : piece.category);
  return kind?.trim() ? kind.trim() : UNTAGGED;
}

/** "Shearling coat" — the piece row's title. */
export function pieceTitle(piece: DiaryPiece): string {
  const word = pieceWord(piece);
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * "Cognac · Toteme" — colour and maker, whichever of them exist.
 *
 * Null when neither does, so the row loses a line rather than printing a
 * middot with nothing on either side of it.
 */
export function pieceOrigin(piece: DiaryPiece): string | null {
  const parts = [piece.colorName?.trim(), piece.brand?.trim()].filter((p): p is string =>
    Boolean(p),
  );
  if (parts.length === 0) return null;
  const joined = parts.join(' · ');
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

/**
 * "Worn 6 times · $58.00 a wear" — the standing count, and the cost of it.
 *
 * The cost half is PRINTED OR DROPPED. `items.purchase_price` is nullable and
 * usually null, and the atlas gives every piece a figure; inventing one from
 * the category — or printing "—", or a zero — would put a number the user
 * never typed into a sentence that reads as their own accounting. `costPerWear`
 * already returns null for both no-price and never-worn, and this is the whole
 * of the display rule that follows from it.
 *
 * The dollar formatting is the app's existing one (`item/[id].tsx`,
 * `friends/[userId].tsx`), not the atlas's sterling.
 */
export function pieceStat(piece: DiaryPiece): string {
  const worn = piece.wearCount === 1 ? 'Worn once' : `Worn ${piece.wearCount} times`;
  const cpw = costPerWear(piece);
  return cpw === null ? worn : `${worn} · $${cpw.toFixed(2)} a wear`;
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

/**
 * The row's first line — "Coat, trousers, loafers".
 *
 * The look's name when it has one, otherwise the pieces read out in the order
 * they were recorded. Not `pieceName`, which leads with the colour: a row of
 * "Cognac shearling coat, charcoal tailored trousers" is a paint chart, and the
 * atlas's line is the kinds alone.
 */
export function rowLine(entry: DiaryEntry): string {
  const named = entry.name?.trim();
  if (named) return named;
  if (entry.pieces.length === 0) return 'A look';
  const joined = entry.pieces.map(pieceWord).join(', ');
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

/**
 * The row's second line — "Dinner · Noted".
 *
 * The occasion, and a middot-joined "Noted" when a note exists. Null when there
 * is neither, so a plain wear is one line rather than one line and a gap.
 */
export function rowMeta(entry: DiaryEntry): string | null {
  const parts: string[] = [];
  const occasion = entry.occasion?.trim();
  if (occasion) parts.push(occasion);
  if (entry.note?.trim()) parts.push('Noted');
  return parts.length ? parts.join(' · ') : null;
}

/** "11 wears", with the singular handled once. */
export function wearsLine(count: number): string {
  return `${count} ${count === 1 ? 'wear' : 'wears'}`;
}

// ---------------------------------------------------------------------------
// The spine
// ---------------------------------------------------------------------------

/**
 * Newest first, grouped by month.
 *
 * Sorted here rather than trusted from the query: the page is also mounted over
 * fixtures, and a diary that is only reverse-chronological because the server
 * happened to say `order by worn_at desc` is a rule nothing holds.
 */
export function groupByMonth(entries: DiaryEntry[]): DiaryMonth[] {
  const sorted = [...entries].sort(
    (a, b) => new Date(b.wornAt).getTime() - new Date(a.wornAt).getTime(),
  );

  const months: DiaryMonth[] = [];
  for (const entry of sorted) {
    const key = monthKey(entry.wornAt);
    const last = months[months.length - 1];
    if (last && last.key === key) {
      last.entries.push(entry);
      last.count += 1;
      continue;
    }
    months.push({
      key,
      label: monthLabel(entry.wornAt),
      count: 1,
      entries: [entry],
    });
  }
  return months;
}

/**
 * The filter row: one line of year chips, and nothing else.
 *
 * "Years appear only once the record spans them, so a first-year reader sees no
 * chips at all" — so a record entirely inside the current year returns an empty
 * array and the row does not render. `This year` appears only when there is
 * something in it; a chip that filters to nothing is a control that looks
 * broken.
 */
export function yearChips(entries: DiaryEntry[], now: Date = new Date()): YearChip[] {
  const current = now.getFullYear();
  const years = new Set(entries.map((e) => new Date(e.wornAt).getFullYear()));

  const earlier = [...years].filter((y) => y !== current).sort((a, b) => b - a);
  if (earlier.length === 0) return [];

  const chips: YearChip[] = [{ id: ALL_YEARS, label: 'All' }];
  if (years.has(current)) chips.push({ id: THIS_YEAR, label: 'This year' });
  for (const year of earlier) chips.push({ id: String(year), label: String(year) });
  return chips;
}

/** Apply a chip. An unknown id is treated as no filter rather than as nothing. */
export function filterByYear(
  entries: DiaryEntry[],
  chipId: string,
  now: Date = new Date(),
): DiaryEntry[] {
  if (chipId === ALL_YEARS) return entries;
  const target = chipId === THIS_YEAR ? now.getFullYear() : Number(chipId);
  if (!Number.isFinite(target)) return entries;
  return entries.filter((e) => new Date(e.wornAt).getFullYear() === target);
}

// ---------------------------------------------------------------------------
// The one-day correction
// ---------------------------------------------------------------------------

/**
 * Whether the entry is still correctable.
 *
 * `unwear_outfit_tx` enforces this in SQL and raises `22023` past the window,
 * so this is a courtesy rather than the rule — and it is deliberately the SAME
 * arithmetic, so the button and the server disagree only across a clock skew,
 * which `unwearRefusal` below is what handles.
 */
export function isCorrectable(wornAt: string, now: Date = new Date()): boolean {
  const worn = new Date(wornAt).getTime();
  if (Number.isNaN(worn)) return false;
  return now.getTime() - worn <= CORRECTION_WINDOW_MS;
}

/** What the page says once the day has passed. */
export const HISTORY_LINE =
  'Recorded more than a day ago, so it stays as history. The note can still be changed.';

/**
 * The server's refusal, said plainly.
 *
 * `22023` is `unwear_outfit_tx`'s "that entry is older than a day". It is
 * reachable even when `isCorrectable` said yes — a device clock a few minutes
 * fast is all it takes — and the honest answer is the rule itself rather than a
 * button that silently does nothing.
 */
export function unwearRefusal(code: string | undefined): string {
  if (code === '22023') return HISTORY_LINE;
  return 'That didn’t go through. The entry is unchanged — check your connection and try again.';
}

/**
 * The SQLSTATE off a thrown PostgREST error, if there is one.
 *
 * `supabase-js` rejects with a `PostgrestError` — a plain object carrying
 * `code`, not an `Error` subclass — so `instanceof` finds nothing and a
 * `catch (e: unknown)` has no typed way in. Narrowed here, once, rather than
 * cast at each call site: the whole 24-hour rule is carried by one five-digit
 * string, and a typo in it would silently downgrade the refusal to "check your
 * connection".
 */
export function postgresCode(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const code = (err as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}
