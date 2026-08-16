import assert from 'node:assert/strict';
import { test } from 'node:test';

import { favorExactCores } from '../src/features/styling/favorite-ranking';
import type { OutfitCandidate } from '../src/lib/styling';

function candidate(score: number, ids: string[]): OutfitCandidate {
  return {
    score,
    items: ids.map((id) => ({ id }) as OutfitCandidate['items'][number]),
    features: {} as OutfitCandidate['features'],
    notes: {},
    harmonies: [],
  };
}

test('an exact favorite settles a close score without changing the candidate', () => {
  const higher = candidate(0.8, ['coat', 'trouser']);
  const favorite = candidate(0.78, ['shirt', 'jean']);
  const ranked = favorExactCores([higher, favorite], [['jean', 'shirt']]);
  assert.deepEqual(ranked, [favorite, higher]);
  assert.equal(ranked[0], favorite);
});

test('the bounded bonus cannot overtake a clearly stronger outfit', () => {
  const stronger = candidate(0.9, ['coat', 'trouser']);
  const favorite = candidate(0.78, ['shirt', 'jean']);
  assert.deepEqual(favorExactCores([stronger, favorite], [['shirt', 'jean']]), [stronger, favorite]);
});
