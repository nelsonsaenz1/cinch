/**
 * The Repeat — reading real wear history and turning it into an honest claim.
 *
 * Every function here is pure: no Supabase, no React. `use-worn-outfits.ts`
 * fetches the rows; `dev-repeat.tsx` and the tests both hand this module plain
 * data. That split is what makes the date-reading logic testable without a
 * database, and it is the part of The Repeat most likely to invent a claim if
 * it is wrong — see docs/design/design-refs "The Repeat State Atlas", rule
 * "Real dates only": every "you wore this" reads a marked calendar row, no
 * inference, no "probably". If the day was never marked, the mark does not
 * appear.
 *
 * Consumes `src/features/closet/outfit-count.ts` for the counting routine
 * (`kindOfSlot`, `countOutfits`, `tallyOf`, `rankGaps`) rather than
 * reimplementing any of it — the free-tier contract is explicit that there is
 * exactly one counting routine and no screen gets a second opinion.
 */

import { kindOfSlot, type CountedKind } from '@/features/closet/outfit-count';
import { dateKey } from '@/lib/date';
import type { Garment } from '@/lib/styling';

/** One real wear: an outfit the user actually marked worn, and when. */
export type WornRecord = {
  date: Date;
  itemIds: readonly string[];
};

// ── Core matching ───────────────────────────────────────────────────────────

/**
 * The counted-kind garments among `itemIds`, sorted for a stable key.
 *
 * Matching happens at the CORE — top/bottom/shoes or dress/shoes — not the
 * full item set. A repeat is "the same combination", and the canonical ten has
 * exactly one bag and one coat, so matching on the full set (bag and coat
 * included) would call two outfits different for a reason nobody chose. This
 * is the same reduction `outfit-count.ts` counts by, so a core that has been
 * worn and a core the closet can build are directly comparable.
 */
export function coreIdsOf(itemIds: readonly string[], wardrobe: readonly Garment[]): string[] {
  const kindById = new Map(wardrobe.map((g) => [g.id, kindOfSlot(g.slot)]));
  return [...itemIds].filter((id) => kindById.get(id) != null).sort();
}

/** A stable string key for a (sorted) set of ids. Empty ids have no key. */
export function coreKey(ids: readonly string[]): string {
  return ids.join('·');
}

/**
 * Every distinct core the current wardrobe could build.
 *
 * Built the same way `countOutfits` computes its arithmetic —
 * (tops × bottoms + dresses) × max(shoes, 1) — so `possibleCores(w).length`
 * and `countOutfits(tallyOf(w))` never diverge. Tested directly.
 *
 * SHOES MULTIPLY, NEVER GATE. `countOutfits` stopped requiring footwear on
 * 2026-09-01 (founder decision, commit 150a7a5) and this function did not
 * follow: twelve of the twenty-five live closets hold no shoes, and for
 * every one of them The Repeat counted zero possible cores, so its
 * "you've worn them all" state could never be reached. A shoeless closet
 * now builds unshod cores — the same cores the generator offers it.
 */
export function possibleCores(wardrobe: readonly Garment[]): string[][] {
  const by = (kind: CountedKind) => wardrobe.filter((g) => kindOfSlot(g.slot) === kind);
  const tops = by('tops');
  const bottoms = by('bottoms');
  const dresses = by('dresses');
  const shoes = by('shoes');
  // One "no shoe" so the loops below run once; `null` adds no id.
  const footwear: (Garment | null)[] = shoes.length > 0 ? shoes : [null];

  const cores: string[][] = [];
  for (const t of tops) {
    for (const b of bottoms) {
      for (const s of footwear) cores.push(s ? [t.id, b.id, s.id].sort() : [t.id, b.id].sort());
    }
  }
  for (const d of dresses) {
    for (const s of footwear) cores.push(s ? [d.id, s.id].sort() : [d.id]);
  }
  return cores;
}

/**
 * Past wears of the exact core `candidateItemIds` reduces to, oldest first.
 *
 * Real rows only — a record whose core does not match returns nothing for it,
 * and an item no longer in the wardrobe (sold, removed) simply cannot form a
 * core any more, which correctly drops it rather than guessing.
 */
export function wearsOfCore(
  records: readonly WornRecord[],
  wardrobe: readonly Garment[],
  candidateItemIds: readonly string[],
): Date[] {
  const key = coreKey(coreIdsOf(candidateItemIds, wardrobe));
  if (!key) return [];

  return records
    .filter((r) => coreKey(coreIdsOf(r.itemIds, wardrobe)) === key)
    .map((r) => r.date)
    .sort((a, b) => a.getTime() - b.getTime());
}

// ── Exhaustion (P-03) ───────────────────────────────────────────────────────

export type ExhaustionProgress = {
  /** How many distinct cores this closet can build. `countOutfits`'s number. */
  total: number;
  /** How many of those cores have a real worn record. */
  wornCount: number;
  /** True only when every core the closet can build has been worn at least once. */
  exhausted: boolean;
  /** The earliest worn date among the matched cores, or null if none matched. */
  since: Date | null;
};

/**
 * The exhausted state's numbers, read from real history against the closet's
 * real cores — never inferred from what has merely been suggested.
 */
export function exhaustionProgress(
  wardrobe: readonly Garment[],
  records: readonly WornRecord[],
): ExhaustionProgress {
  const cores = possibleCores(wardrobe);
  const total = cores.length;
  const coreKeys = new Set(cores.map(coreKey));

  const wornKeys = new Set<string>();
  let since: Date | null = null;

  for (const r of records) {
    const ids = coreIdsOf(r.itemIds, wardrobe);
    if (!ids.length) continue;
    const key = coreKey(ids);
    if (!coreKeys.has(key)) continue; // not one of THIS closet's real cores
    wornKeys.add(key);
    if (!since || r.date.getTime() < since.getTime()) since = r.date;
  }

  return { total, wornCount: wornKeys.size, exhausted: total > 0 && wornKeys.size >= total, since };
}

// ── The escalation ladder (P-01 / P-02) ─────────────────────────────────────

/**
 * Which register a repeat has earned, from real previous wears alone.
 *
 * `none` — first time; not a repeat, no mark.
 * `first` — one previous wear. P-01: a line inside the plate.
 * `firm` — two or more previous wears. P-02: the panel, every date named.
 *
 * There is no fourth register. Escalating once and stopping is the rule —
 * "nothing beyond that, a fourth register would be nagging".
 */
export type RepeatRegister =
  | { kind: 'none' }
  | { kind: 'first'; lastWorn: Date }
  | { kind: 'firm'; previousWears: Date[]; occurrence: number };

export function repeatRegisterFor(previousWears: readonly Date[]): RepeatRegister {
  if (previousWears.length === 0) return { kind: 'none' };
  if (previousWears.length === 1) return { kind: 'first', lastWorn: previousWears[0]! };
  const sorted = [...previousWears].sort((a, b) => a.getTime() - b.getTime());
  return { kind: 'firm', previousWears: sorted, occurrence: sorted.length + 1 };
}

// ── Date prose ───────────────────────────────────────────────────────────────

const WEEKDAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
] as const;

export function weekdayName(d: Date): string {
  return WEEKDAYS[d.getDay()]!;
}

/** "4th", "1st", "22nd", "13th" — the exception-ridden English ordinal suffix. */
export function ordinalDay(day: number): string {
  const mod100 = day % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

const ORDINAL_WORDS = [
  'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
];

/** "third", "eleventh" — for prose like "Third time in two weeks". */
export function ordinalWord(n: number): string {
  return ORDINAL_WORDS[n - 1] ?? `${n}th`;
}

/**
 * "Tuesday the 4th", or "today" when `d` is the same local calendar day as
 * `now`. Never a relative guess ("a few days ago") — always the real weekday
 * and day-of-month, or the literal word for today.
 */
export function describeDate(d: Date, now: Date): string {
  return dateKey(d) === dateKey(now) ? 'today' : `${weekdayName(d)} the ${ordinalDay(d.getDate())}`;
}

/** "a", "a and b", "a, b, and c" — spoken-English joining, oxford comma. */
export function joinDates(parts: readonly string[]): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}`;
}

/** Whole days between two instants, using their LOCAL calendar dates. */
function daysBetween(a: Date, b: Date): number {
  const toNoon = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((toNoon(b) - toNoon(a)) / 86_400_000);
}

/**
 * "in the last week" / "in the last N weeks" — the P-02 panel's rough span
 * between the first previous wear and now. Rounded and hedged on purpose: the
 * app can name the exact dates, so it never needs to pretend more precision
 * than "about N weeks" is worth.
 */
export function describeSpan(first: Date, now: Date): string {
  const days = Math.max(0, daysBetween(first, now));
  const weeks = Math.max(1, Math.round(days / 7));
  return weeks === 1 ? 'in the last week' : `in the last ${weeks} weeks`;
}

/** "18 Jul" — the exhausted state's "SINCE" line. */
export function describeShortDate(d: Date): string {
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  return `${d.getDate()} ${month}`;
}
