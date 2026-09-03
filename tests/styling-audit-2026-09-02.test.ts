import assert from 'node:assert/strict';
import { test } from 'node:test';

import { generateOutfits } from '../src/lib/styling';
import { isSolidPattern, toGarment } from '../src/lib/styling/garment';
import type { ItemRow } from '../src/lib/styling/types';
import { context, garment, weather } from './helpers';

/**
 * Three invariants the 2026-09-02 audit found broken on live closets. Each
 * shipped green because the suite only covered the closets the design docs
 * describe; each is pinned here on the closet that broke it.
 */

test('a closet whose every top is a knit still dresses its owner on a hot day', () => {
  // Five jumpers, three pairs of trousers, two pairs of shoes: ten pieces,
  // thirty counted outfits — and, above 24.6 °C, zero generated ones, with
  // the fallback copy telling her to add shoes she already owned.
  const closet = [
    ...Array.from({ length: 5 }, (_, i) => garment('mid_layer', ['navy', 'oat', 'grey', 'olive', 'rust'][i]!)),
    ...Array.from({ length: 3 }, () => garment('bottom', 'charcoal')),
    ...Array.from({ length: 2 }, () => garment('footwear', 'brown')),
  ];
  const out = generateOutfits(closet, context({ weather: weather(32) }), { count: 3 });
  assert.ok(out.length > 0, 'a counted closet must never generate nothing');
});

test('when shirts exist, the heat gate still keeps knits out of the cores', () => {
  // The narrowing is a design decision (generate.ts, `knitsMayAnchor`) —
  // this pins that the fix above did not widen it.
  const closet = [
    garment('base_top', 'white'),
    garment('mid_layer', 'navy'),
    garment('bottom', 'charcoal'),
    garment('footwear', 'brown'),
  ];
  const out = generateOutfits(closet, context({ weather: weather(32) }), { count: 5 });
  assert.ok(out.length > 0);
  for (const o of out) {
    assert.ok(!o.items.some((g) => g.slot === 'mid_layer'), 'a knit anchored a core in the heat');
  }
});

test('a solid garment has no pattern scale, whatever the column says', () => {
  // Four live rows: pattern='solid', pattern_scale='small'. Read at face
  // value they scored as a small print and the card said "solid as the
  // focal point".
  const row = {
    id: 'r1',
    category: 'tops',
    subcategory: 't-shirt',
    description: null,
    colors: [{ name: 'white', hex: '#ffffff' }],
    pattern: 'solid',
    pattern_scale: 'small',
    material: 'cotton',
    brand: null,
    warmth: 3,
    formality: 2,
    seasons: [],
    occasions: [],
    water_resistant: false,
  } as unknown as ItemRow;
  assert.equal(toGarment(row).patternScale, 'none');
  assert.equal(isSolidPattern('solid'), true);
  assert.equal(isSolidPattern('stripe'), false);
  const striped = toGarment({ ...row, pattern: 'stripe', pattern_scale: 'small' } as unknown as ItemRow);
  assert.equal(striped.patternScale, 'small');
  // A NULL pattern keeps whatever scale the tagger stored — only an explicit
  // solid overrides the column.
  const untyped = toGarment({ ...row, pattern: null, pattern_scale: 'medium' } as unknown as ItemRow);
  assert.equal(untyped.patternScale, 'medium');
});
