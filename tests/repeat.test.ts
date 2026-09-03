/**
 * The Repeat's date-reading logic — the part of Directive 5 most likely to
 * invent a claim if it is wrong. Every case here is either a rule from
 * `design-refs/html/The Repeat State Atlas/` ("Real dates only", "Escalate
 * once") or a number the atlas itself prints (the canonical ten's fourteen
 * cores), the same way `tests/outfit-count.test.ts` holds the counting
 * function against the five free-tier atlases.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { countOutfits, tallyOf } from '../src/features/closet/outfit-count';
import {
  coreIdsOf,
  coreKey,
  describeDate,
  describeShortDate,
  describeSpan,
  exhaustionProgress,
  joinDates,
  ordinalDay,
  ordinalWord,
  possibleCores,
  repeatRegisterFor,
  wearsOfCore,
  weekdayName,
  type WornRecord,
} from '../src/features/styling/repeat';
import { garment, resetIds } from './helpers';

const day = (y: number, m: number, d: number, hh = 9, mm = 0) => new Date(y, m - 1, d, hh, mm, 0);

/** The canonical ten: 3 tops, 2 bottoms, 1 dress, 2 shoes, 1 coat, 1 bag. */
function theTen() {
  resetIds();
  return [
    garment('base_top', 'white'), // g1
    garment('base_top', 'navy'), // g2
    garment('mid_layer', 'cream'), // g3
    garment('bottom', 'charcoal'), // g4
    garment('bottom', 'denim'), // g5
    garment('dress', 'olive'), // g6
    garment('footwear', 'brown'), // g7
    garment('footwear', 'black'), // g8
    garment('outerwear', 'navy'), // g9
    garment('bag', 'tan'), // g10
  ];
}

// ── possibleCores / countOutfits agreement ──────────────────────────────────

test('possibleCores never diverges from countOutfits, across every atlas closet', () => {
  const closet = (tops: number, bottoms: number, dresses: number, shoes: number) => {
    resetIds();
    return [
      ...Array.from({ length: tops }, () => garment('base_top', 'white')),
      ...Array.from({ length: bottoms }, () => garment('bottom', 'charcoal')),
      ...Array.from({ length: dresses }, () => garment('dress', 'olive')),
      ...Array.from({ length: shoes }, () => garment('footwear', 'brown')),
    ];
  };

  const cases: [number, number, number, number][] = [
    [3, 2, 1, 2], // The Ten — 14
    [4, 2, 0, 2], // 16
    [3, 3, 0, 2], // 18
    [3, 2, 0, 2], // 12
    [3, 2, 1, 3], // 21
    [0, 0, 0, 0], // 0
    // Shoeless closets — twelve of the twenty-five live ones. Shoes multiply,
    // never gate (founder decision 2026-09-01), and the cores follow the count.
    [2, 3, 0, 0], // 6
    [3, 2, 1, 0], // 7
    [0, 0, 2, 0], // 2
  ];

  for (const [tops, bottoms, dresses, shoes] of cases) {
    const wardrobe = closet(tops, bottoms, dresses, shoes);
    const cores = possibleCores(wardrobe);
    assert.equal(cores.length, countOutfits(tallyOf(wardrobe)), `${tops}/${bottoms}/${dresses}/${shoes}`);
  }
});

test('the canonical ten makes exactly fourteen possible cores', () => {
  assert.equal(possibleCores(theTen()).length, 14);
});

// ── coreIdsOf / coreKey ──────────────────────────────────────────────────────

test('coreIdsOf keeps only counted-kind garments, sorted', () => {
  const wardrobe = theTen();
  const [top, , , bottom, , , shoe, , outer, bag] = wardrobe;

  // A full worn outfit, bag and coat included — the way a real `outfit_items`
  // row would list every garment actually worn that day.
  const full = [outer!.id, top!.id, bottom!.id, shoe!.id, bag!.id];
  const core = coreIdsOf(full, wardrobe);

  assert.deepEqual(core, [top!.id, bottom!.id, shoe!.id].sort());
});

test('coreIdsOf drops ids not present in the wardrobe at all', () => {
  const wardrobe = theTen();
  const [top, , , bottom, , , shoe] = wardrobe;
  const core = coreIdsOf([top!.id, bottom!.id, shoe!.id, 'sold-item-id'], wardrobe);
  assert.deepEqual(core, [top!.id, bottom!.id, shoe!.id].sort());
});

test('coreKey is order-independent once ids are sorted', () => {
  assert.equal(coreKey(['a', 'b', 'c']), coreKey(['a', 'b', 'c']));
  assert.notEqual(coreKey(['a', 'b']), coreKey(['a', 'b', 'c']));
});

// ── wearsOfCore — real dates only ───────────────────────────────────────────

test('wearsOfCore matches the same core regardless of bag or coat', () => {
  const wardrobe = theTen();
  const [top, , , bottom, , , shoe, , outer, bag] = wardrobe;
  const core = [top!.id, bottom!.id, shoe!.id];

  const records: WornRecord[] = [
    { date: day(2026, 8, 4), itemIds: core }, // bare core
    { date: day(2026, 8, 7), itemIds: [...core, bag!.id] }, // core + bag
    { date: day(2026, 8, 9), itemIds: [outer!.id, ...core, bag!.id] }, // core + coat + bag
  ];

  const wears = wearsOfCore(records, wardrobe, core);
  assert.equal(wears.length, 3);
  // Oldest first.
  assert.deepEqual(
    wears.map((d) => d.getTime()),
    [day(2026, 8, 4).getTime(), day(2026, 8, 7).getTime(), day(2026, 8, 9).getTime()],
  );
});

test('wearsOfCore never matches a genuinely different core', () => {
  const wardrobe = theTen();
  const [top, , , bottom, , , shoe1, shoe2] = wardrobe;
  const records: WornRecord[] = [{ date: day(2026, 8, 4), itemIds: [top!.id, bottom!.id, shoe2!.id] }];

  const wears = wearsOfCore(records, wardrobe, [top!.id, bottom!.id, shoe1!.id]);
  assert.deepEqual(wears, []);
});

test('wearsOfCore returns nothing for an item set with no counted core', () => {
  const wardrobe = theTen();
  const [, , , , , , , , outer, bag] = wardrobe;
  const wears = wearsOfCore(
    [{ date: day(2026, 8, 4), itemIds: [outer!.id, bag!.id] }],
    wardrobe,
    [outer!.id, bag!.id],
  );
  assert.deepEqual(wears, []);
});

test('an unmarked day produces no wear — no inference, ever', () => {
  const wardrobe = theTen();
  const [top, , , bottom, , , shoe] = wardrobe;
  // No records at all: a suggestion shown is not a wear, however many times
  // the engine has offered it.
  assert.deepEqual(wearsOfCore([], wardrobe, [top!.id, bottom!.id, shoe!.id]), []);
});

// ── exhaustionProgress ───────────────────────────────────────────────────────

function twoCoreCloset() {
  resetIds();
  const tops = [garment('base_top', 'white'), garment('base_top', 'navy')]; // g1, g2
  const bottom = garment('bottom', 'charcoal'); // g3
  const shoe = garment('footwear', 'brown'); // g4
  return { wardrobe: [...tops, bottom, shoe], tops, bottom, shoe };
}

test('exhausted only once every real core has a real worn record', () => {
  const { wardrobe, tops, bottom, shoe } = twoCoreCloset();
  assert.equal(possibleCores(wardrobe).length, 2);

  const oneCore: WornRecord[] = [{ date: day(2026, 8, 1), itemIds: [tops[0]!.id, bottom.id, shoe.id] }];
  const partial = exhaustionProgress(wardrobe, oneCore);
  assert.equal(partial.wornCount, 1);
  assert.equal(partial.exhausted, false);

  const bothCores: WornRecord[] = [
    ...oneCore,
    { date: day(2026, 8, 3), itemIds: [tops[1]!.id, bottom.id, shoe.id] },
  ];
  const full = exhaustionProgress(wardrobe, bothCores);
  assert.equal(full.total, 2);
  assert.equal(full.wornCount, 2);
  assert.equal(full.exhausted, true);
  assert.equal(full.since?.getTime(), day(2026, 8, 1).getTime());
});

test('a record for an item no longer in the wardrobe cannot force exhaustion', () => {
  const { wardrobe, tops, bottom, shoe } = twoCoreCloset();
  const records: WornRecord[] = [
    { date: day(2026, 8, 1), itemIds: [tops[0]!.id, bottom.id, shoe.id] },
    // References an id this wardrobe has never had — a sold or removed item.
    { date: day(2026, 8, 2), itemIds: ['ghost-1', 'ghost-2', 'ghost-3'] },
  ];
  const progress = exhaustionProgress(wardrobe, records);
  assert.equal(progress.wornCount, 1);
  assert.equal(progress.exhausted, false);
});

test('an empty wardrobe is never exhausted — nothing to exhaust', () => {
  const progress = exhaustionProgress([], []);
  assert.equal(progress.total, 0);
  assert.equal(progress.exhausted, false);
  assert.equal(progress.since, null);
});

// ── repeatRegisterFor — the escalation ladder ───────────────────────────────

test('zero previous wears is not a repeat', () => {
  assert.deepEqual(repeatRegisterFor([]), { kind: 'none' });
});

test('one previous wear is the first-register repeat (P-01)', () => {
  const register = repeatRegisterFor([day(2026, 8, 4)]);
  assert.equal(register.kind, 'first');
  if (register.kind === 'first') assert.equal(register.lastWorn.getTime(), day(2026, 8, 4).getTime());
});

test('two or more previous wears escalate once to the firm register (P-02), and stop', () => {
  const two = repeatRegisterFor([day(2026, 8, 7), day(2026, 8, 4)]); // out of order on purpose
  assert.equal(two.kind, 'firm');
  if (two.kind === 'firm') {
    assert.equal(two.occurrence, 3);
    // Sorted ascending regardless of input order.
    assert.deepEqual(
      two.previousWears.map((d) => d.getTime()),
      [day(2026, 8, 4).getTime(), day(2026, 8, 7).getTime()],
    );
  }

  // A fourth, fifth wear stays the SAME register — "escalate once" — but the
  // occurrence count keeps counting honestly.
  const four = repeatRegisterFor([day(2026, 8, 4), day(2026, 8, 7), day(2026, 8, 11)]);
  assert.equal(four.kind, 'firm');
  if (four.kind === 'firm') assert.equal(four.occurrence, 4);
});

// ── Date prose ───────────────────────────────────────────────────────────────

test('weekdayName reads the real calendar weekday', () => {
  // 4 Aug 2026 is a Tuesday, 7 Aug 2026 a Friday — verified against Node's own
  // Gregorian calendar, not asserted from the atlas's illustration alone.
  assert.equal(weekdayName(day(2026, 8, 4)), 'Tuesday');
  assert.equal(weekdayName(day(2026, 8, 7)), 'Friday');
});

test('ordinalDay handles the 11th/12th/13th exception', () => {
  const cases: [number, string][] = [
    [1, '1st'], [2, '2nd'], [3, '3rd'], [4, '4th'],
    [11, '11th'], [12, '12th'], [13, '13th'],
    [21, '21st'], [22, '22nd'], [23, '23rd'], [24, '24th'],
  ];
  for (const [n, expected] of cases) assert.equal(ordinalDay(n), expected);
});

test('ordinalWord matches repeatRegisterFor occurrences', () => {
  assert.equal(ordinalWord(1), 'first');
  assert.equal(ordinalWord(2), 'second');
  assert.equal(ordinalWord(3), 'third');
  assert.equal(ordinalWord(11), '11th');
});

test('describeDate says "today" for the same local day, and a real weekday otherwise', () => {
  const now = day(2026, 8, 7);
  assert.equal(describeDate(day(2026, 8, 7, 21, 0), now), 'today');
  assert.equal(describeDate(day(2026, 8, 4), now), 'Tuesday the 4th');
});

test('joinDates joins the way spoken English does', () => {
  assert.equal(joinDates([]), '');
  assert.equal(joinDates(['a']), 'a');
  assert.equal(joinDates(['a', 'b']), 'a and b');
  assert.equal(joinDates(['a', 'b', 'c']), 'a, b, and c');
  assert.equal(
    joinDates(['Tuesday the 4th', 'Friday the 7th', 'today']),
    'Tuesday the 4th, Friday the 7th, and today',
  );
});

test('describeSpan rounds to whole weeks and never claims false precision', () => {
  assert.equal(describeSpan(day(2026, 8, 4), day(2026, 8, 6)), 'in the last week');
  assert.equal(describeSpan(day(2026, 8, 4), day(2026, 8, 12)), 'in the last week');
  assert.equal(describeSpan(day(2026, 8, 4), day(2026, 8, 20)), 'in the last 2 weeks');
});

test('describeShortDate prints day and month, never a bare ISO string', () => {
  assert.equal(describeShortDate(day(2026, 7, 18)), '18 Jul');
});
