import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { OUTFIT_SYSTEM_PROMPT, outfitSchema } from '../supabase/functions/_shared/outfit-schema.ts';

/**
 * swapNote is the one model-authored string that reaches the user unedited.
 *
 * `use-outfits.ts:258` assigns `swapNote: pick.swapNote` straight from the
 * model's JSON onto the outfit, and `today/plate.tsx` renders `{outfit.swapNote}`
 * with no normalisation between them. There is no server-side sanitiser and no
 * client-side one either — which is deliberate, because the honest fix is for
 * the model never to emit a placeholder, not for the client to guess which
 * strings were meant to be nothing.
 *
 * That makes the prompt the contract, and a contract worth pinning: a model
 * that answers "None" instead of `null` does not fail a schema check (the field
 * is a nullable string, and "None" is a string), it just prints the word None
 * to someone looking at their outfit for the day.
 */

const swapNote = outfitSchema.properties.picks.items.properties.swapNote;

test('swapNote is a nullable string whose description forbids placeholder words', () => {
  assert.deepEqual(swapNote.type, ['string', 'null']);

  // The schema alone cannot reject "None" — it is a valid string — so the
  // prohibition has to live where the model reads it.
  const description = swapNote.description;
  assert.match(description, /null/);
  assert.match(description, /"None"/);
  assert.match(description, /N\/A/);
  assert.match(description, /shown to the user exactly as written/i);
});

test('swapNote must name a piece from its own candidate, not a garment the user lacks', () => {
  assert.match(OUTFIT_SYSTEM_PROMPT, /THAT SAME candidate/);
  assert.match(OUTFIT_SYSTEM_PROMPT, /never a candidate id/);

  // The failure this prevents is advice the user cannot act on: the engine only
  // ever assembled clothes they own, so a swap naming something else is not a
  // swap at all.
  assert.match(OUTFIT_SYSTEM_PROMPT, /Add a blazer/);
  assert.match(OUTFIT_SYSTEM_PROMPT, /light jacket/);
  assert.match(OUTFIT_SYSTEM_PROMPT, /the user cannot act on a garment they were not given/i);
});

test('the no-change case is the JSON null, and the prompt names every stand-in it rejects', () => {
  for (const placeholder of [/"None"/, /"N\/A"/, /no swap needed/, /empty string/]) {
    assert.match(OUTFIT_SYSTEM_PROMPT, placeholder);
  }
  assert.match(OUTFIT_SYSTEM_PROMPT, /printed to the user exactly as you write it/i);
});

test('nothing between the model and the screen rewrites swapNote, so the prompt is the only guard', () => {
  const hook = readFileSync('src/features/styling/use-outfits.ts', 'utf8');
  const plate = readFileSync('src/components/today/plate.tsx', 'utf8');

  // If either of these ever gains a sanitiser, this test should be revisited
  // rather than deleted — the prompt rules stay correct, but they stop being
  // the last line of defence, and that is worth noticing on purpose.
  assert.match(hook, /swapNote: pick\.swapNote/);
  assert.match(plate, /\{outfit\.swapNote\}/);
});
