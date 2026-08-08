/**
 * The Gap Feed's own derivations — labels, descriptions, dominance, pairing
 * samples. `outfit-count.test.ts` already holds every printed number against
 * the atlases; this file is everything gap-feed.ts computes on top of that.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  corePreviewRows,
  dominantGaps,
  gapLabel,
  gapNoun,
  describeGap,
  mostOwnedKind,
  nounWithArticle,
  ordinal,
  pairablePieces,
  swapAdvice,
  type PairablePiece,
} from '../src/features/closet/gap-feed';
import { rankGaps, type Tally } from '../src/features/closet/outfit-count';

const closet = (tops: number, bottoms: number, dresses: number, shoes: number): Tally => ({
  tops,
  bottoms,
  dresses,
  shoes,
});

const THE_TEN = closet(3, 2, 1, 2);

test('ordinal words', () => {
  assert.equal(ordinal(1), 'first');
  assert.equal(ordinal(4), 'fourth');
  assert.equal(ordinal(11), 'eleventh');
  assert.equal(ordinal(13), '13th');
  assert.equal(ordinal(22), '22nd');
  assert.equal(ordinal(23), '23rd');
});

test('gap labels are the literal owned+1 ordinal, for every kind including shoes', () => {
  assert.equal(gapLabel(THE_TEN, 'tops'), 'A fourth top');
  assert.equal(gapLabel(THE_TEN, 'bottoms'), 'A third bottom');
  assert.equal(gapLabel(THE_TEN, 'dresses'), 'A second dress');
  // The canonical ten already owns two pairs of shoes — the honest next one is
  // a THIRD pair, not the atlas's "second". See gap-feed.ts's header.
  assert.equal(gapLabel(THE_TEN, 'shoes'), 'A third pair of shoes');
  // "An eighth top" — the indefinite article follows the vowel sound of the
  // ordinal word, not the noun.
  assert.equal(gapLabel(closet(7, 0, 0, 0), 'tops'), 'An eighth top');
});

test('gapNoun pluralises only the noun, "pair(s) of shoes" included', () => {
  assert.equal(gapNoun('shoes', 1), 'pair of shoes');
  assert.equal(gapNoun('shoes', 2), 'pairs of shoes');
  assert.equal(gapNoun('bottoms', 1), 'bottom');
  assert.equal(gapNoun('bottoms', 3), 'bottoms');
});

test('describeGap states the real arrow and never a fixed count', () => {
  const ranked = rankGaps(THE_TEN);
  const shoes = ranked.find((g) => g.kind === 'shoes')!;
  assert.equal(describeGap(THE_TEN, shoes), '14 outfits → 21. Pairs with everything you own, including the dress.');

  const noDress = closet(3, 2, 0, 2);
  const shoesNoDress = rankGaps(noDress).find((g) => g.kind === 'shoes')!;
  assert.equal(describeGap(noDress, shoesNoDress), '12 outfits → 18. Pairs with everything you own.');

  const bottoms = ranked.find((g) => g.kind === 'bottoms')!;
  assert.equal(describeGap(THE_TEN, bottoms), '14 outfits → 20. Your 3 tops all work over it.');
});

test('dominantGaps is null for a balanced closet — the ordinary ranked list stands', () => {
  assert.equal(dominantGaps(rankGaps(THE_TEN)), null);
});

test('dominantGaps reports a genuine tie rather than picking a winner for the user', () => {
  // The G-05 fixture. cores = tops × bottoms × shoes with bottoms = shoes = 1
  // means gaining EITHER doubles tops — a provable tie, not an illustration.
  const unbalanced = closet(8, 1, 0, 1);
  const ranked = rankGaps(unbalanced);
  const leaders = dominantGaps(ranked);
  assert.ok(leaders);
  assert.deepEqual(
    leaders!.map((g) => g.kind).sort(),
    ['bottoms', 'shoes'],
  );
  assert.ok(leaders!.every((g) => g.gain === 8));
});

test('a runner-up within a third of the leader is not "dominant"', () => {
  // shoes: 8*1*(2+1)=24, gain 16. bottoms: 8*2*2=32, gain 16 (tie again — same
  // structural reason). Regardless, the point under test is the threshold
  // itself: fabricate a ranked list by hand rather than lean on a real tally.
  const ranked = [
    { kind: 'shoes' as const, total: 24, gain: 16 },
    { kind: 'bottoms' as const, total: 22, gain: 6 }, // 6*3=18 <= 16? no: 18>16 -> not dominant
    { kind: 'tops' as const, total: 20, gain: 4 },
    { kind: 'dresses' as const, total: 18, gain: 2 },
  ];
  assert.equal(dominantGaps(ranked), null);
});

test('pairablePieces samples the real closet and never invents an item', () => {
  type Fixture = { name: string };
  const pieces: PairablePiece<Fixture>[] = [
    { id: '1', kind: 'tops', piece: { name: 'blouse' } },
    { id: '2', kind: 'tops', piece: { name: 'sweater' } },
    { id: '3', kind: 'bottoms', piece: { name: 'trousers' } },
    { id: '4', kind: 'bottoms', piece: { name: 'skirt' } },
    { id: '5', kind: 'dresses', piece: { name: 'dress' } },
    { id: '6', kind: 'shoes', piece: { name: 'loafers' } },
  ];

  // A new pair of shoes pairs with every top, bottom and dress — 5 relevant
  // pieces, sampled to 3 with 2 left over.
  const shoes = pairablePieces('shoes', pieces);
  assert.equal(shoes.shown.length, 3);
  assert.equal(shoes.more, 2);

  // A new dress pairs with shoes alone — one relevant piece, nothing left over.
  const dresses = pairablePieces('dresses', pieces);
  assert.deepEqual(
    dresses.shown.map((p) => p.name),
    ['loafers'],
  );
  assert.equal(dresses.more, 0);

  // A new bottom pairs with tops and shoes, never with another bottom.
  const bottoms = pairablePieces('bottoms', pieces);
  assert.equal(bottoms.shown.length, 3); // blouse, sweater, loafers
  assert.equal(bottoms.more, 0);
});

test('mostOwnedKind and nounWithArticle', () => {
  assert.equal(mostOwnedKind(closet(8, 1, 0, 1)), 'tops');
  assert.equal(nounWithArticle('shoes'), 'a pair of shoes');
  assert.equal(nounWithArticle('bottoms'), 'a bottom');
});

test('swapAdvice names the genuinely plentiful kind, never a fixed pair', () => {
  assert.equal(swapAdvice(closet(8, 1, 0, 1), 'bottoms'), 'Swap a top for a bottom');
  assert.equal(swapAdvice(closet(8, 1, 0, 1), 'shoes'), 'Swap a top for a pair of shoes');
  // Nothing sensible to swap when the plentiful kind has only one piece.
  assert.equal(swapAdvice(closet(1, 1, 1, 1), 'shoes'), null);
});

test('corePreviewRows never fabricates a garment and ties "more" to the real gain', () => {
  const byKind = {
    tops: ['blouse', 'sweater', 'coat-look'],
    bottoms: ['trousers', 'skirt'],
    dresses: ['dress'],
  };
  // Gain of 7 (the canonical ten's shoes gap), sampled to 3.
  const { shown, more } = corePreviewRows('shoes', byKind, 7, 3);
  assert.equal(shown.length, 3);
  assert.equal(more, 4);
  // Every row is pairs of REAL owned pieces — never a third fabricated item.
  for (const row of shown) {
    for (const piece of row) assert.ok(byKind.tops.includes(piece) || byKind.bottoms.includes(piece) || byKind.dresses.includes(piece));
  }

  // A dress pairs with shoes alone — one real piece per row, never a pair.
  const dressRows = corePreviewRows('dresses', { shoes: ['loafers', 'boots'] }, 2, 3);
  assert.deepEqual(dressRows.shown, [['loafers'], ['boots']]);
  assert.equal(dressRows.more, 0);

  // Nothing owned in the needed kinds yields nothing fabricated, not a crash.
  assert.deepEqual(corePreviewRows('shoes', {}, 3, 3), { shown: [], more: 3 });
});
