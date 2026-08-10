import assert from 'node:assert/strict';
import { test } from 'node:test';

/**
 * Every colour the parser is allowed to return must be one the app can resolve.
 *
 * §4.9 of the reframe directive: the model never invents colour — it returns a
 * term and the app maps it through the lexicon. That only holds if the two ends
 * agree, and they live in different runtimes: the enum is in an Edge Function
 * (`_shared/intake-schema.ts`, sent to the model as part of a strict JSON
 * schema) and the resolver is in the client bundle (`src/lib/color/families.ts`).
 *
 * A term in the enum that the lexicon cannot resolve is the "greige" failure:
 * the model returns it happily, the schema accepts it, the draft stores it, and
 * the garment arrives in the closet with no colour at all — which for a drawn
 * silhouette means a garment with no body, since the fill IS the colour.
 *
 * This asserts the behaviour rather than comparing two lists, because the lists
 * are allowed to be spelled differently; what must be true is that every term
 * resolves.
 *
 * `intake-schema.ts` is deliberately import-free so it can be pulled into a
 * Node test like this — no `npm:` specifiers, unlike the rest of `_shared`.
 */
import { COLOUR_TERMS, SLOTS, MAX_QUANTITY } from '../supabase/functions/_shared/intake-schema';
import { resolveColorName } from '../src/lib/color/families';

test('every colour term in the parse enum resolves in the lexicon', () => {
  const unresolvable = COLOUR_TERMS.filter((term) => resolveColorName(term) === null);
  assert.deepEqual(
    unresolvable,
    [],
    `these terms are offered to the model but resolve to nothing: ${unresolvable.join(', ')}`,
  );
});

test('the enum is not empty and carries no duplicates', () => {
  assert.ok(COLOUR_TERMS.length > 50, 'a thin lexicon forces the model into bad nearest-matches');
  assert.equal(new Set(COLOUR_TERMS).size, COLOUR_TERMS.length, 'duplicate colour terms');
});

/**
 * The wardrobe neutrals specifically. `families.ts` opens by explaining that
 * navy, olive, camel, charcoal, cream and chocolate behave as neutrals despite
 * carrying real chroma, and that treating them as saturated breaks the pairing
 * rules. If any of them fell out of the enum, voice intake would quietly stop
 * being able to describe the most common garments anyone owns.
 */
test('the wardrobe neutrals are all offerable', () => {
  for (const neutral of ['navy', 'olive', 'camel', 'charcoal', 'cream', 'chocolate']) {
    assert.ok(
      (COLOUR_TERMS as readonly string[]).includes(neutral),
      `"${neutral}" is a wardrobe neutral and must be offerable`,
    );
    assert.notEqual(resolveColorName(neutral), null, `"${neutral}" must resolve`);
  }
});

/** The schema's slot enum, the drafts CHECK and the styling union are one list. */
test('the parse schema offers exactly the nine styling slots', () => {
  assert.deepEqual(
    [...SLOTS].sort(),
    ['accessory', 'bag', 'base_top', 'bottom', 'dress', 'footwear', 'headwear', 'mid_layer', 'outerwear'],
  );
});

/** Matches intake_drafts.quantity's CHECK (20260810140100). */
test('the quantity ceiling agrees with the drafts constraint', () => {
  assert.equal(MAX_QUANTITY, 12);
});
