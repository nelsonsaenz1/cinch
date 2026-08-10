import assert from 'node:assert/strict';
import { test } from 'node:test';

/**
 * The commit's slot inversion, pinned where the derivation actually lives.
 *
 * `items` stores `category`; the styling engine's `Slot` is DERIVED from
 * category + subcategory by `toSlot`. So committing a spoken garment has to
 * invert a TypeScript function from SQL, and `commit_intake_session`
 * (20260810140200_intake_commit.sql) does it with `intake_category_for` —
 * slot → category, and the spoken noun written into `subcategory` verbatim.
 *
 * Eight of the nine slots invert cleanly because category alone decides them.
 * The ninth does not: `base_top` and `mid_layer` are BOTH category 'top', and
 * toSlot separates them by regex over the subcategory text. That makes the
 * round trip depend on a word the language model chose, which is exactly the
 * kind of coupling that breaks silently — a cardigan read back as a t-shirt
 * still typechecks, still bundles, and just quietly scores wrong forever.
 *
 * The migration deliberately does NOT copy that regex into SQL (a fourth copy
 * of a drifting list — see 04_plans.sql for why). This test is the other half
 * of that decision: it pins the mapping against the real `toSlot`, so a change
 * to either side fails here.
 */
import { toSlot } from '../src/lib/styling/garment';
import type { Slot } from '../src/lib/styling/types';

/**
 * The SQL copy, transcribed. Deliberately a literal rather than an import:
 * the point is a tripwire between two languages, not DRY. If
 * `intake_category_for` changes, this must change with it or the test lies.
 */
const INTAKE_CATEGORY_FOR: Record<Slot, string> = {
  base_top: 'top',
  mid_layer: 'top',
  bottom: 'bottom',
  dress: 'dress',
  outerwear: 'outerwear',
  footwear: 'footwear',
  bag: 'bag',
  headwear: 'headwear',
  accessory: 'accessory',
};

/** What a commit actually writes, for a draft with this slot and spoken noun. */
function committedSlot(slot: Slot, spokenNoun: string): Slot {
  return toSlot({
    category: INTAKE_CATEGORY_FOR[slot] as never,
    subcategory: spokenNoun,
  });
}

/**
 * Nouns the parser realistically returns per slot. `name` is the garment word
 * alone — colour travels in `colour_term`, so these are what actually land in
 * `subcategory`.
 */
const SPOKEN: Record<Slot, string[]> = {
  base_top: ['crewneck', 'tee', 't-shirt', 'button-down shirt', 'blouse', 'tank top'],
  mid_layer: ['cardigan', 'sweater', 'jumper', 'hoodie', 'sweatshirt', 'fleece', 'turtleneck'],
  bottom: ['jeans', 'trousers', 'skirt', 'shorts', 'chinos'],
  dress: ['midi dress', 'slip dress', 'shirt dress'],
  outerwear: ['wool coat', 'trench coat', 'puffer jacket', 'parka'],
  footwear: ['ankle boots', 'trainers', 'loafers', 'heels'],
  bag: ['tote', 'clutch', 'crossbody bag'],
  headwear: ['beanie', 'baseball cap', 'wool hat'],
  accessory: ['leather belt', 'silk scarf', 'sunglasses'],
};

for (const slot of Object.keys(SPOKEN) as Slot[]) {
  for (const noun of SPOKEN[slot]) {
    test(`${slot}: "${noun}" survives the commit round trip`, () => {
      assert.equal(
        committedSlot(slot, noun),
        slot,
        `a draft parsed as ${slot} came back as ${committedSlot(slot, noun)} — ` +
          `the styling engine would treat this garment as the wrong layer`,
      );
    });
  }
}

/**
 * The failure the mapping cannot prevent, recorded so it is a known shape
 * rather than a surprise.
 *
 * If the model returns slot `mid_layer` with a noun carrying no knit word, the
 * round trip degrades to `base_top` — a cardigan scored as a t-shirt, which
 * costs the layering and warmth rules. The mitigation is in the parse prompt
 * (§7, `parse-closet`), which must return a knit noun for a knit; this asserts
 * the degradation is exactly that and nothing worse, so if it ever starts
 * losing the garment entirely the test moves.
 */
test('a mid_layer with no knit word degrades to base_top, not to nothing', () => {
  const degraded = committedSlot('mid_layer', 'thing');
  assert.equal(degraded, 'base_top');
  assert.notEqual(degraded, 'accessory');
});

/** Every slot the drafts table admits is a slot the engine knows. */
test('the drafts CHECK constraint and the Slot union agree', () => {
  // Transcribed from intake_drafts.slot's check (20260810140100).
  const SQL_SLOTS = [
    'base_top', 'mid_layer', 'bottom', 'dress', 'outerwear',
    'footwear', 'bag', 'headwear', 'accessory',
  ];
  assert.deepEqual(SQL_SLOTS.sort(), Object.keys(INTAKE_CATEGORY_FOR).sort());
});
