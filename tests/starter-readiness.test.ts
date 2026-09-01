/**
 * Starter readiness — the acceptance fixtures for the adaptive "Your first 10".
 *
 * The template these replace prescribed 3 tops / 2 bottoms / 1 dress / 2 shoes
 * / 1 coat / 1 bag and asserted fourteen outfits before anything had been
 * photographed. It failed a real tester whose closet was three tops, a hoodie,
 * two pairs of trousers, two pairs of shoes, a watch and one more piece.
 *
 * The first test below IS that closet. If it ever goes red, the grid has gone
 * back to having opinions about wardrobes it has not seen.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { countOutfits } from '../src/features/closet/outfit-count';
import {
  starterReadiness,
  starterSuggestion,
  STARTER_MIN_OUTFITS,
  STARTER_PIECES,
} from '../src/features/onboarding/starter-readiness';
import type { Garment } from '../src/lib/styling';

/** A classified closet, written as the classifier's own answers. */
const closet = (...slots: Garment['slot'][]) => slots.map((slot) => ({ slot }));

const repeat = (slot: Garment['slot'], n: number) =>
  Array.from({ length: n }, () => ({ slot }));

test("Nelson's closet is READY — no dress, no bag, sixteen computed cores", () => {
  const wardrobe = closet(
    'base_top',
    'base_top',
    'base_top',
    'mid_layer', // the hoodie — a top, exactly as outfit-count.ts defines
    'bottom',
    'bottom',
    'footwear',
    'footwear',
    'accessory', // the watch
    'outerwear',
  );
  assert.equal(wardrobe.length, 10);

  const r = starterReadiness(wardrobe);
  assert.equal(r.pieces, 10);
  // 4 tops × 2 bottoms × 2 shoes + 0 dresses × 2 shoes.
  assert.deepEqual(r.tally, { tops: 4, bottoms: 2, dresses: 0, shoes: 2 });
  assert.equal(r.outfits, 16);
  assert.ok(r.ready);
  assert.deepEqual(r.missing, []);
  assert.equal(starterSuggestion(r), null, 'a ready closet is not nagged');
});

test('the watch and the coat count toward ten without inflating the arithmetic', () => {
  const withAccessories = starterReadiness(
    closet(
      'base_top', 'base_top', 'base_top', 'mid_layer',
      'bottom', 'bottom', 'footwear', 'footwear',
      'accessory', 'outerwear',
    ),
  );
  const withoutAccessories = starterReadiness(
    closet(
      'base_top', 'base_top', 'base_top', 'mid_layer',
      'bottom', 'bottom', 'footwear', 'footwear',
    ),
  );

  assert.equal(withAccessories.pieces - withoutAccessories.pieces, 2, 'both count as pieces');
  assert.equal(
    withAccessories.outfits,
    withoutAccessories.outfits,
    'neither creates an outfit — "layers and bags dress an outfit; they don\'t create one"',
  );
  // …and the eight-piece closet is not ready, because the ten is the target.
  assert.ok(!withoutAccessories.ready);
  assert.deepEqual(withoutAccessories.missing, ['pieces']);
});

test('a dress-led closet is READY with no top and no bottom in it', () => {
  const r = starterReadiness(
    closet(
      'dress', 'dress', 'dress',
      'footwear', 'footwear',
      'bag', 'bag', 'accessory', 'headwear', 'outerwear',
    ),
  );
  assert.equal(r.pieces, 10);
  assert.equal(r.outfits, 6); // 3 dresses × 2 shoes
  assert.ok(r.outfits >= STARTER_MIN_OUTFITS);
  assert.ok(r.hasCore, 'a dress is a whole core');
  assert.ok(r.ready);
});

test('ten watches is NOT READY', () => {
  const r = starterReadiness(repeat('accessory', 10));
  assert.equal(r.pieces, 10);
  assert.equal(r.outfits, 0);
  assert.ok(!r.ready);
  assert.deepEqual(r.missing, ['footwear', 'core', 'outfits']);
});

test('ten tops is NOT READY', () => {
  const r = starterReadiness(repeat('base_top', 10));
  assert.equal(r.outfits, 0);
  assert.ok(!r.ready);
  assert.ok(r.missing.includes('footwear'));
  assert.ok(r.missing.includes('core'));
});

test('tops and bottoms with no footwear counts, but The Ten still asks for shoes', () => {
  // Shoes multiply, never gate (2026-09-01): the closet honestly makes 25.
  // Readiness still names footwear first — the guided ten teaches a complete
  // look, and that is pedagogy, not arithmetic.
  const r = starterReadiness([...repeat('base_top', 5), ...repeat('bottom', 5)]);
  assert.equal(r.pieces, 10);
  assert.ok(r.hasCore, 'the shape is there…');
  assert.ok(!r.hasFootwear);
  assert.equal(r.outfits, 25, '…and it already counts barefoot');
  assert.ok(!r.ready);
  assert.equal(r.missing[0], 'footwear', 'the guidance is named first');
});

test('shape and footwear are not enough — four cores is the fourth condition', () => {
  // One top, one bottom, one pair of shoes and seven coats: ten pieces, a
  // legal shape, footwear present, and exactly one outfit. Not a week.
  const r = starterReadiness([
    { slot: 'base_top' as const },
    { slot: 'bottom' as const },
    { slot: 'footwear' as const },
    ...repeat('outerwear', 7),
  ]);
  assert.equal(r.pieces, 10);
  assert.ok(r.hasFootwear && r.hasCore);
  assert.equal(r.outfits, 1);
  assert.ok(!r.ready);
  assert.deepEqual(r.missing, ['outfits']);
});

test('ten is the target — nine of a perfectly good closet is not ready yet', () => {
  const nine = closet(
    'base_top', 'base_top', 'mid_layer',
    'bottom', 'bottom',
    'footwear', 'footwear',
    'accessory', 'outerwear',
  );
  assert.equal(nine.length, STARTER_PIECES - 1);

  const r = starterReadiness(nine);
  assert.equal(r.outfits, 12);
  assert.ok(!r.ready);
  assert.deepEqual(r.missing, ['pieces']);
  assert.equal(r.piecesRemaining, 1);
});

// ---------------------------------------------------------------------------
// The adaptive suggestion
// ---------------------------------------------------------------------------

test('an empty closet is invited, never instructed', () => {
  // The defect the simulator caught on T-01: the gap order produced "add a
  // pair of shoes" at zero pieces, and the projection under it read "0
  // outfits" — an arbitrary direction attached to a promise of no gain, on the
  // first screen of the app.
  const s = starterSuggestion(starterReadiness([]))!;
  assert.equal(s.gap, 'start');
  assert.equal(s.kind, null);
  // Shoes left this list 2026-09-01 — an outfit stands without them.
  assert.deepEqual(s.alsoNeeds, ['tops', 'bottoms']);
});

test('a suggestion never promises a gain it cannot deliver', () => {
  // One piece can only lift a closet off nought if it is the LAST missing
  // half. Five tops and no shoes needs BOTH a bottom and shoes, so the shoes
  // suggestion genuinely gains nothing and must not quote a projection.
  const stuck = starterSuggestion(starterReadiness(repeat('base_top', 10)))!;
  assert.equal(stuck.gap, 'footwear');
  assert.equal(stuck.projected, 0, 'shoes alone still make nothing here');
  assert.deepEqual(stuck.alsoNeeds, ['bottoms']);

  // …and since 2026-09-01 the first pair of shoes on a standing closet gains
  // nothing either — 25 outfits barefoot, 25 with one pair (×max(shoes, 1)).
  // The suggestion still names footwear (pedagogy), the projection stays
  // honest, and nothing is missing for a first outfit.
  const almost = starterSuggestion(
    starterReadiness([...repeat('base_top', 5), ...repeat('bottom', 5)]),
  )!;
  assert.equal(almost.gap, 'footwear');
  assert.equal(almost.projected, 25);
  assert.deepEqual(almost.alsoNeeds, []);
});

test('the suggestion names the cause, not the symptom', () => {
  const noShoes = starterSuggestion(
    starterReadiness([...repeat('base_top', 5), ...repeat('bottom', 5)]),
  );
  assert.equal(noShoes?.gap, 'footwear');
  assert.equal(noShoes?.kind, 'shoes');
  // 5 × 5 × 1 — a computed projection, never a table.
  assert.equal(noShoes?.projected, 25);

  const noBottom = starterSuggestion(
    starterReadiness([...repeat('base_top', 5), ...repeat('footwear', 5)]),
  );
  assert.equal(noBottom?.gap, 'core');
  assert.equal(noBottom?.kind, 'bottoms');
  assert.equal(noBottom?.projected, 25);
});

test('when only the count is short, the suggestion names no kind at all', () => {
  const r = starterReadiness(
    closet(
      'base_top', 'base_top', 'mid_layer',
      'bottom', 'bottom',
      'footwear', 'footwear',
      'accessory', 'outerwear',
    ),
  );
  const s = starterSuggestion(r);
  assert.equal(s?.gap, 'pieces');
  assert.equal(s?.kind, null, 'anything genuinely counts here — a coat, a bag, a watch');
});

test('every projection the suggestion quotes is countOutfits, never a table', () => {
  const wardrobe = closet(
    'base_top', 'bottom', 'footwear',
    'outerwear', 'outerwear', 'outerwear', 'outerwear', 'outerwear', 'outerwear', 'outerwear',
  );
  const r = starterReadiness(wardrobe);
  const s = starterSuggestion(r)!;

  assert.equal(s.gap, 'outfits');
  assert.ok(s.kind);
  const withOneMore = { ...r.tally, [s.kind!]: r.tally[s.kind!] + 1 };
  assert.equal(s.projected, countOutfits(withOneMore));
  assert.ok(s.projected > r.outfits, 'a suggestion that gains nothing is not a suggestion');
});

test('the classifier decides, never the position a photograph was taken from', () => {
  // The same ten garments, read twice. `starterReadiness` takes classified
  // slots and has no parameter for where a piece was tapped from — which is
  // the whole guarantee, stated as a type rather than a convention.
  const hoodieAsTop = starterReadiness(
    closet(
      'mid_layer', 'base_top', 'base_top', 'base_top',
      'bottom', 'bottom', 'footwear', 'footwear', 'accessory', 'outerwear',
    ),
  );
  // If the hoodie had been coerced to whatever slot it was shot into — say a
  // bottom position — the closet would read 3×3×2 = 18 and still be ready, but
  // for the wrong reason. It reads 16, because the tagger said `mid_layer`.
  assert.equal(hoodieAsTop.outfits, 16);
  assert.equal(hoodieAsTop.tally.tops, 4);
  assert.equal(hoodieAsTop.tally.bottoms, 2);
});
