import assert from 'node:assert/strict';
import { test } from 'node:test';

import { OUTFIT_NAME_LIBRARY, acceptEnhancedName, nameOutfits, tagsForOutfit } from '../src/features/styling/outfit-names';
import { generateOutfits } from '../src/lib/styling';
import { context, smallCloset, weather } from './helpers';

test('curated library has 50–100 unique names of 2–4 words', () => {
  assert.ok(OUTFIT_NAME_LIBRARY.length >= 50 && OUTFIT_NAME_LIBRARY.length <= 100);
  const names = OUTFIT_NAME_LIBRARY.map((entry) => entry.name);
  assert.equal(new Set(names).size, names.length);
  for (const entry of OUTFIT_NAME_LIBRARY) {
    const count = entry.name.split(/\s+/).length;
    assert.ok(count >= 2 && count <= 4, entry.name);
    assert.ok(entry.tags.length > 0, `${entry.name} has no grounded tags`);
  }
});

test('same outfits, day and context produce the same distinct names', () => {
  const ctx = context({ now: new Date(2026, 7, 16, 8).getTime(), weather: weather(18) });
  const outfits = generateOutfits(smallCloset(), ctx, { count: 3 });
  const first = [...nameOutfits(outfits, ctx).values()];
  const second = [...nameOutfits(outfits, ctx).values()];
  assert.deepEqual(first, second);
  assert.equal(new Set(first).size, first.length);
});

test('tag derivation reaches the critical grounded families', () => {
  const reached = new Set<string>();
  for (const ctx of [context({ weather: weather(-2) }), context({ weather: weather(29) }),
    context({ weather: { ...weather(12), precipitationChance: 0.9 } })]) {
    for (const outfit of generateOutfits(smallCloset(), ctx, { count: 12 })) {
      for (const tag of tagsForOutfit(outfit, ctx)) reached.add(tag);
    }
  }
  for (const family of ['warm', 'light', 'rain', 'balanced', 'dress', 'separates']) {
    assert.ok(reached.has(family), `missing tag family ${family}`);
  }
});

test('enhanced wording is accepted only from compatible curated options', () => {
  const ctx = context({ weather: weather(18) });
  const [candidate] = generateOutfits(smallCloset(), ctx, { count: 1 });
  assert.ok(candidate);
  const local = [...nameOutfits([candidate!], ctx).values()][0]!;
  assert.equal(acceptEnhancedName(local, candidate!, ctx, new Set()), local);
  assert.equal(acceptEnhancedName('Paris Silk Morning', candidate!, ctx, new Set()), null);
  assert.equal(acceptEnhancedName(local, candidate!, ctx, new Set([local])), null);
});
