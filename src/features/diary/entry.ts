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

import { describeWeather, formatTemp } from '@/features/context/weather';
import { costPerWear } from '@/schemas/item';

import type { DiaryEntry, DiaryMonth, DiaryPiece, DiaryWeather, YearChip } from './types';

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

/**
 * The weather out of `context_snapshot`, or null.
 *
 * Same defensiveness as `firstColorName` above and for the same reason: this
 * jsonb is whatever the client passed as `p_context` at the time of the wear,
 * its shape has changed across builds, and several call sites pass null
 * outright. Every field is checked, and anything that is not a complete
 * `WeatherContext` reads as "no weather was recorded" — which is a true answer
 * and produces no row, rather than a half-filled one that would print a
 * temperature with an invented range behind it.
 */
export function weatherFromSnapshot(raw: unknown): DiaryWeather | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const w = (raw as { weather?: unknown }).weather;
  if (typeof w !== 'object' || w === null) return null;

  const r = w as Record<string, unknown>;
  const num = (k: string) => (typeof r[k] === 'number' && Number.isFinite(r[k]) ? (r[k] as number) : null);

  const feelsLikeC = num('feelsLikeC');
  const highC = num('highC');
  const lowC = num('lowC');
  const precipitationChance = num('precipitationChance');
  const windKph = num('windKph');
  if (
    feelsLikeC === null ||
    highC === null ||
    lowC === null ||
    precipitationChance === null ||
    windKph === null
  ) {
    return null;
  }

  return {
    feelsLikeC,
    highC,
    lowC,
    precipitationChance,
    windKph,
    swing: r.swing === true,
  };
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
  if (entry.planned) return plannedLine(entry);
  const named = entry.name?.trim();
  if (named) return named;
  if (entry.pieces.length === 0) return 'A look';
  const joined = entry.pieces.map(pieceWord).join(', ');
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

/**
 * The row's second line — "Outfit of 5 pieces · $2.14 a wear".
 *
 * WD-01, audit 78: the trailing metadata moved OUT of a third column and under
 * the name, which is where the name's width came from. Three facts in one 13pt
 * prose line, each of them printed only when it is known:
 *
 *   · the shape of the look — "Outfit of 5 pieces", or "Worn on its own" for a
 *     single garment, which is the atlas's own wording;
 *   · the standing wear count, but only for a single-piece wear, because "7th
 *     wear" of a five-piece outfit is not a fact about anything;
 *   · cost-per-wear, and ONLY when every piece in the look carries a price.
 *     `items.purchase_price` is nullable and usually null; the atlas draws the
 *     figure on two rows and drops it on the other two, which is exactly this
 *     rule. Never estimated, never a dash — the sentence simply ends.
 *
 * The occasion is dropped from this line rather than lost: it is the entry
 * page's subtitle, and audit 77's whole complaint is that the row's second line
 * was competing with the name for a width it does not have.
 */
export function rowMeta(entry: DiaryEntry): string | null {
  if (entry.planned) return plannedMeta(entry);

  const parts: string[] = [];
  const n = entry.pieces.length;
  if (n === 1) {
    parts.push('Worn on its own');
    parts.push(ordinalWear(entry.pieces[0]!.wearCount));
  } else if (n > 1) {
    parts.push(`Outfit of ${n} pieces`);
  }

  const cost = lookCostPerWear(entry);
  if (cost !== null) parts.push(`$${cost.toFixed(2)} a wear`);

  return parts.length ? parts.join(' · ') : null;
}

/** "7th wear" — the standing count as an ordinal, spelt the way English does. */
export function ordinalWear(count: number): string {
  const rem100 = count % 100;
  const rem10 = count % 10;
  const suffix =
    rem100 >= 11 && rem100 <= 13 ? 'th' : rem10 === 1 ? 'st' : rem10 === 2 ? 'nd' : rem10 === 3 ? 'rd' : 'th';
  return `${count}${suffix} wear`;
}

/**
 * "$2.14 a wear" for the whole look — total spend over total wears.
 *
 * ALL OR NOTHING, the same rule `bagHeaderLine` follows for the packing bag:
 * one unpriced piece and the figure is not computable, so it is not printed.
 * Summing only the priced half would print a number that is smaller than the
 * truth and looks exact.
 */
export function lookCostPerWear(entry: DiaryEntry): number | null {
  if (entry.pieces.length === 0) return null;
  if (!entry.pieces.every((p) => p.purchasePrice !== null)) return null;

  const spend = entry.pieces.reduce((s, p) => s + (p.purchasePrice ?? 0), 0);
  const wears = entry.pieces.reduce((s, p) => s + p.wearCount, 0);
  if (wears === 0) return null;
  return spend / wears;
}

// ---------------------------------------------------------------------------
// WD-03 — a plan among the worn days
// ---------------------------------------------------------------------------

/**
 * "Planned: the overcoat with the black jeans".
 *
 * The word comes FIRST, in the name, and the row is set in the regular cut
 * rather than Medium — two of the three channels the atlas asks for; the rule
 * beneath it is the third. No opacity trick and no colour tint: a plan is a
 * different kind of row, not a faded wear.
 */
export function plannedLine(entry: DiaryEntry): string {
  const named = entry.name?.trim();
  if (named) return `Planned: ${named}`;
  if (entry.pieces.length === 0) return 'Planned: a look';
  return `Planned: ${entry.pieces.map(pieceWord).join(' with the ')}`;
}

/** "Planned for Saturday — not worn yet." */
export function plannedMeta(entry: DiaryEntry): string {
  const weekday = new Date(entry.wornAt).toLocaleDateString('en-GB', { weekday: 'long' });
  return `Planned for ${weekday} — not worn yet`;
}

/** "11 wears", with the singular handled once. */
export function wearsLine(count: number): string {
  return `${count} ${count === 1 ? 'wear' : 'wears'}`;
}

/**
 * The masthead total, and it FOLLOWS THE FILTER.
 *
 * "188 wears in 2026" and "612 wears since March" must never appear in the
 * same sentence — the audit's own complaint. Every figure is counted from the
 * rows in hand, and the "since" month is the month of the oldest one, so no
 * account-creation date is invented for it. Planned days are excluded: they
 * are not wears.
 */
export function diaryTotalLine(
  entries: readonly DiaryEntry[],
  chipId: string,
  now: Date = new Date(),
): string | null {
  const worn = entries.filter((e) => !e.planned);
  if (worn.length === 0) return null;

  const count = wearsLine(worn.length);

  if (chipId === THIS_YEAR) return `${count} in ${now.getFullYear()}`;
  if (chipId !== ALL_YEARS) {
    const year = Number(chipId);
    return Number.isFinite(year) ? `${count} in ${year}` : count;
  }

  const oldest = worn.reduce((min, e) =>
    new Date(e.wornAt).getTime() < new Date(min.wornAt).getTime() ? e : min,
  );
  const first = new Date(oldest.wornAt);
  const month = first.toLocaleDateString('en-GB', { month: 'long' });
  // The year is said only when it is not this one — "since March 2025" reads
  // as a fact, "since March 2026" reads as clutter.
  return first.getFullYear() === now.getFullYear()
    ? `${count} since ${month}`
    : `${count} since ${month} ${first.getFullYear()}`;
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
 * Whole hours left inside the 24-hour window, floored, never negative.
 *
 * WD-02 states the rule AND the remaining figure, so undo is never a surprise.
 * Floored rather than rounded: "14 hours left" must not be a promise of more
 * time than the server will honour. In hours because that is the granularity
 * the rule itself uses — `unwear_outfit_tx` refuses at exactly 24.
 */
export function hoursLeftToCorrect(wornAt: string, now: Date = new Date()): number {
  const worn = new Date(wornAt).getTime();
  if (Number.isNaN(worn)) return 0;
  const left = CORRECTION_WINDOW_MS - (now.getTime() - worn);
  return Math.max(0, Math.floor(left / 3_600_000));
}

/**
 * "You can change or undo a wear for 24 hours after it is recorded. This one
 * has 14 hours left."
 *
 * Under an hour the figure would round to zero and read as "expired" while the
 * server would still accept the write, so the second sentence changes shape
 * rather than printing a nought.
 */
export function correctionWindowLine(wornAt: string, now: Date = new Date()): string {
  const rule = 'You can undo a wear for 24 hours after it is recorded.';
  const hours = hoursLeftToCorrect(wornAt, now);
  if (hours >= 1) return `${rule} This one has ${hours} ${hours === 1 ? 'hour' : 'hours'} left.`;
  return `${rule} This one has less than an hour left.`;
}

// ---------------------------------------------------------------------------
// WD-02's three ruled facts
// ---------------------------------------------------------------------------

/**
 * "72° · warm" — the weather that day, or null.
 *
 * Fahrenheit, like every other temperature in this app; `describeWeather` is
 * the same phrase the Today strip and the week planner print, reused rather
 * than a second interpretation of the same numbers. Null whenever
 * `context_snapshot` carried no weather, which is a real and common case —
 * the row is dropped rather than filled with an estimate.
 */
export function entryWeatherLine(
  weather: DiaryWeather | null | undefined,
  units: 'C' | 'F' = 'F',
): string | null {
  if (!weather) return null;
  return `${formatTemp(weather.feelsLikeC, units)} · ${describeWeather(weather, units)}`;
}

/**
 * "Today's plate", "A kept plate", "Chosen by you" — where the wear came from.
 *
 * Provenance matters because a wear recorded from Today, from the diary or
 * from a plan are different acts, and every one of these is read off a column
 * that already exists: `origin_outfit_id` (set only by `wear_outfit_tx`'s
 * `p_origin`, which is how a kept plate finds its wearings) and
 * `generated_by`.
 */
export function provenanceLine(entry: DiaryEntry): string {
  if (entry.originOutfitId) return 'A plate you had kept';
  return entry.source === 'ai' ? 'Today’s plate' : 'Chosen by you';
}

// ---------------------------------------------------------------------------
// WD-03's undo notice
// ---------------------------------------------------------------------------

/**
 * "Tuesday's merino crewneck is back to 4 wears, and this year's count is 188.
 * The piece is untouched."
 *
 * Both figures the undo moved, said out loud — the audit's own ask, because a
 * count that moves without explanation is the thing it wants fixed. Neither is
 * an estimate: `unwear_outfit_tx` decrements every piece by exactly one as it
 * deletes the row, so `wearCount - 1` is the transaction's defined effect
 * rather than a guess, and the total is the same subtraction on the figure the
 * masthead was already printing.
 *
 * A multi-piece look does not get four counts in one sentence. It gets the one
 * true statement that covers all of them.
 */
export function undoneNotice(input: {
  /** "Tuesday" — the weekday of the wear that was undone. */
  weekday: string;
  /** The pieces as they stood BEFORE the undo. */
  pieces: readonly { word: string; wearCount: number }[];
  /** The masthead's line for the current filter, already recomputed. */
  totalLine: string | null;
}): string {
  const { weekday, pieces, totalLine } = input;
  const tail = totalLine ? `, and the record now reads ${totalLine}` : '';

  if (pieces.length === 1) {
    const piece = pieces[0]!;
    const back = Math.max(0, piece.wearCount - 1);
    return (
      `${weekday}’s ${piece.word} is back to ${wearsLine(back)}${tail}. ` +
      'The piece is untouched.'
    );
  }

  return (
    `${weekday}’s ${pieces.length} pieces are each back one wear${tail}. ` +
    'The pieces themselves are untouched.'
  );
}

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
