/**
 * Workstream 3 — the packing memo, with the model taken out of it.
 *
 * The plan lists nine fixtures and one property. The property is the one that
 * matters and it is asserted first: the same input produces a byte-identical
 * memo. Everything a model used to write here was, by construction, not that.
 *
 * The fixtures are built by hand rather than run through `buildPackingList`,
 * and deliberately: this file is testing the MEMO, and a memo that changed
 * because the packing engine's beam search drifted would be a test failure
 * about the wrong thing. `tests/packing-math.test.ts` owns the capsule.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { buildPackingMemo, type MemoInput } from '../src/features/plan/packing-memo.ts';
import type { PackedLook, PackedPiece, PackingResult } from '../src/features/plan/packing.ts';
import type { Garment, OutfitCandidate, WeatherContext } from '../src/lib/styling/types.ts';

// ---------------------------------------------------------------------------
// Fixture material
// ---------------------------------------------------------------------------

function garment(id: string, slot: Garment['slot'], subcategory: string): Garment {
  return {
    id,
    slot,
    category: slot,
    subcategory,
    colors: [{ name: 'navy', hex: '#1f2a44', ratio: 1 }],
    formality: 3,
    warmth: 2,
    wearCount: 4,
    lastWornAt: null,
    purchasePrice: null,
    pattern: null,
    fabric: null,
    seasons: [],
  } as unknown as Garment;
}

function outfit(items: Garment[]): OutfitCandidate {
  return {
    items,
    features: {} as OutfitCandidate['features'],
    score: 0.8,
    notes: {},
    harmonies: [],
  };
}

function weather(lowC: number, highC: number, rain: number): WeatherContext {
  return {
    lowC,
    highC,
    feelsLikeC: (lowC + highC) / 2,
    precipitationChance: rain,
    windKph: 5,
    condition: 'clear',
  } as unknown as WeatherContext;
}

const TOP = garment('g-top', 'base_top', 'linen blouse');
const BOTTOM = garment('g-bottom', 'bottom', 'cord skirt');
const SHOE = garment('g-shoe', 'footwear', 'loafers');
const COAT = garment('g-coat', 'outerwear', 'trench');

function look(dayIndex: number, part: PackedLook['part'], items: Garment[] | null): PackedLook {
  return {
    dayIndex,
    date: `2026-09-0${dayIndex + 1}` as PackedLook['date'],
    part,
    weather: weather(16, 24, 0.1),
    outfit: items ? outfit(items) : null,
  };
}

function piece(g: Garment, looks: number, worn = false): PackedPiece {
  return { garment: g, looks, worn };
}

const COVERED: PackingResult = {
  looks: [
    look(0, 'daytime', [TOP, BOTTOM, SHOE]),
    look(0, 'evening', [TOP, BOTTOM, SHOE]),
    look(1, 'daytime', [TOP, BOTTOM, SHOE]),
    look(1, 'evening', [TOP, BOTTOM, SHOE]),
  ],
  items: [piece(TOP, 4), piece(BOTTOM, 4), piece(SHOE, 4, true)],
  unfilled: 0,
};

const BASE: MemoInput = {
  vibes: [{ label: 'Long dinners', formality: 4 }],
  parts: ['daytime', 'evening'],
  days: 2,
  forecasts: [weather(16, 24, 0.1), weather(15, 23, 0.1)],
  weatherSource: 'forecast',
  packing: COVERED,
  requestedLooks: 4,
};

// ---------------------------------------------------------------------------
// 1 · The property the whole workstream turns on
// ---------------------------------------------------------------------------

test('the same input produces a byte-identical memo', () => {
  const a = JSON.stringify(buildPackingMemo(BASE));
  const b = JSON.stringify(buildPackingMemo(BASE));
  const c = JSON.stringify(buildPackingMemo({ ...BASE, packing: { ...COVERED } }));
  assert.equal(a, b);
  assert.equal(a, c, 'a structurally identical input produced different prose');
});

test('nothing in the memo reads a clock or a random number', () => {
  const src = readFileSync('src/features/plan/packing-memo.ts', 'utf8');
  const body = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/Date\.now|Math\.random|new Date\(\)/.test(body), 'the memo is not deterministic');
});

// ---------------------------------------------------------------------------
// 2 · No model, no consent, no allowance — the point of the exercise
// ---------------------------------------------------------------------------

test('packing reaches no server at all', () => {
  for (const file of [
    'src/features/plan/packing-memo.ts',
    'src/features/plan/use-packing-brief.ts',
  ]) {
    const src = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!/functions\.invoke|supabase\./.test(src), `${file} still calls a server`);
    assert.ok(!/openrouter|OPENROUTER/i.test(src));
  }
});

test('and the screen no longer claims it does', () => {
  const screen = readFileSync('src/features/plan/packing-trip.tsx', 'utf8');
  // The four failure cards are gone with the call. The one that mattered told
  // the user packing draws on the stylist's allowance.
  assert.ok(!/styling allowance is spent/i.test(screen), 'the quota failure copy survived');
  assert.ok(!/MemoProseFailure/.test(screen.replace(/\/\/.*$/gm, '')), 'the failure card survived');
});

// ---------------------------------------------------------------------------
// 3 · The plan's nine fixtures
// ---------------------------------------------------------------------------

test('forecast available — the range is printed as a forecast', () => {
  const memo = buildPackingMemo(BASE);
  assert.ok(memo.spec.some((s) => /–/.test(s)), 'no temperature range in the spec');
  assert.ok(!memo.spec.some((s) => /typical/.test(s)));
});

test('seasonal normals fallback — the range says it is typical', () => {
  const memo = buildPackingMemo({ ...BASE, weatherSource: 'normals' });
  assert.ok(
    memo.spec.some((s) => /typical/.test(s)),
    'normals were printed as though they were a forecast',
  );
});

test('no weather — the temperature fragment disappears rather than softening', () => {
  const memo = buildPackingMemo({ ...BASE, forecasts: undefined });
  assert.ok(!memo.spec.some((s) => /–/.test(s)));
  // And the rest of the memo still stands on the bag.
  assert.match(memo.observation, /Three pieces/);
});

test('rain gap — named only when nothing in the bag is outerwear', () => {
  const wet = [weather(12, 18, 0.7), weather(12, 17, 0.6)];
  const withoutCoat = buildPackingMemo({ ...BASE, forecasts: wet });
  assert.match(withoutCoat.gaps ?? '', /nothing in the bag is outerwear/);

  const withCoat = buildPackingMemo({
    ...BASE,
    forecasts: wet,
    packing: { ...COVERED, items: [...COVERED.items, piece(COAT, 2)] },
  });
  assert.equal(withCoat.gaps, null, 'a packed coat still produced a rain gap');
});

test('formal-event gap — a dressy trip says so in the spec, not in an invented claim', () => {
  const memo = buildPackingMemo({
    ...BASE,
    vibes: [
      { label: 'Beach', formality: 2 },
      { label: 'Wedding', formality: 5 },
    ],
  });
  // The dressiest vibe wins, exactly as the capsule targets it.
  assert.ok(memo.spec.includes('formal at least once'));
  // And nothing was invented about the destination.
  assert.ok(!/local|culture|restaurant|people there/i.test(memo.observation));
});

test('thin closet — nothing packed is stated, not dressed up', () => {
  const memo = buildPackingMemo({
    ...BASE,
    packing: { looks: [look(0, 'daytime', null)], items: [], unfilled: 4 },
  });
  assert.match(memo.observation, /Nothing is packed yet/);
  assert.match(memo.headline, /Zero pieces/);
});

test('fully covered trip — no gap sentence at all', () => {
  assert.equal(buildPackingMemo(BASE).gaps, null);
});

test('repeated pieces — the hardest-working piece is named from its real count', () => {
  const memo = buildPackingMemo(BASE);
  assert.match(memo.observation, /Linen blouse does the most work at four of them\./);
  assert.match(memo.observation, /Loafers travels on you, so it is not in the bag\./);
});

test('unfilled looks — the shortfall is the real number, never rounded up', () => {
  const memo = buildPackingMemo({
    ...BASE,
    packing: {
      ...COVERED,
      looks: [...COVERED.looks.slice(0, 2), look(1, 'daytime', null), look(1, 'evening', null)],
      unfilled: 2,
    },
    requestedLooks: 4,
  });
  assert.match(memo.gaps ?? '', /Two looks, not four —/);
});

// ---------------------------------------------------------------------------
// 4 · Day parts
// ---------------------------------------------------------------------------

test('one note per part asked for, in the order asked', () => {
  const memo = buildPackingMemo(BASE);
  assert.deepEqual(memo.parts.map((p) => p.part), ['daytime', 'evening']);
  for (const part of memo.parts) {
    assert.match(part.note, /Two looks for/);
    // Ids, so the screen can link to real garments — never names it invented.
    assert.deepEqual([...part.itemIds].sort(), ['g-bottom', 'g-shoe', 'g-top']);
  }
});

test('a part the closet could not dress says so', () => {
  const memo = buildPackingMemo({
    ...BASE,
    packing: { ...COVERED, looks: [look(0, 'daytime', [TOP, BOTTOM, SHOE]), look(0, 'evening', null)] },
  });
  const evening = memo.parts.find((p) => p.part === 'evening')!;
  assert.match(evening.note, /unfilled/);
  assert.deepEqual(evening.itemIds, []);
});
