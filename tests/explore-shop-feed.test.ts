/**
 * The Explore shop shelf — the rules that make it honest, under proof.
 *
 * What matters: the catalogue is asked only about kinds the person OWNS
 * (most-owned first, capped, deterministic); the wire body is an enum and
 * nothing else; a card without a picture or a destination does not exist;
 * the grid interleaves kinds; and the whole section is gated on the
 * person's own "Show where to buy" switch — off means absent.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  FAMILIES_PER_SLOT,
  FEED_SLOT_CAP,
  feedCards,
  feedSlots,
} from '../src/features/explore/shop-feed';
import type { CatalogueFamily } from '../src/features/catalogue/types';

const garment = (slot: string) => ({ slot }) as never;

const family = (id: string, over: Partial<CatalogueFamily> = {}): CatalogueFamily => ({
  familyId: id,
  brand: 'Acme',
  title: 'Cotton Shirt',
  productClass: null,
  category: null,
  gender: null,
  colours: [
    {
      label: 'White',
      resolved: true,
      imageUrl: 'https://example.invalid/x.jpg',
      alternateImageUrl: null,
      externalId: id,
      sourceHost: 'shop.example',
      pageUrl: 'https://shop.example/x',
    },
  ],
  merchants: ['Example Shop'],
  nearMissCut: null,
  ...over,
});

// ---------------------------------------------------------------------------
// Which kinds get asked
// ---------------------------------------------------------------------------

test('owned kinds only, most-owned first, capped and deterministic', () => {
  const wardrobe = [
    ...Array(5).fill(garment('base_top')),
    ...Array(2).fill(garment('mid_layer')), // tops total 7
    ...Array(4).fill(garment('footwear')),
    ...Array(3).fill(garment('bottom')),
    ...Array(2).fill(garment('outerwear')),
    garment('bag'),
  ];
  // Five kinds owned; the cap keeps four, by count then name.
  assert.deepEqual(feedSlots(wardrobe), ['top', 'footwear', 'bottom', 'outerwear']);
  assert.equal(feedSlots(wardrobe).length, FEED_SLOT_CAP);
  // Same closet, same answer.
  assert.deepEqual(feedSlots(wardrobe), feedSlots(wardrobe));
});

test('an empty closet earns no feed at all', () => {
  assert.deepEqual(feedSlots([]), []);
});

test('both top layers collapse onto one browse kind', () => {
  assert.deepEqual(feedSlots([garment('base_top'), garment('mid_layer')]), ['top']);
});

// ---------------------------------------------------------------------------
// What renders
// ---------------------------------------------------------------------------

test('a family without a picture or a destination never becomes a card', () => {
  const noImage = family('a', {
    colours: [{ ...family('a').colours[0]!, imageUrl: null }],
  });
  const noPage = family('b', {
    colours: [{ ...family('b').colours[0]!, pageUrl: null }],
  });
  const cards = feedCards([
    { slot: 'top', families: { exact: [noImage, noPage, family('c')], nearMiss: [] } },
  ]);
  assert.deepEqual(
    cards.map((c) => c.key),
    ['top:c'],
  );
});

test('near-misses stay out of the feed', () => {
  const cards = feedCards([
    { slot: 'top', families: { exact: [], nearMiss: [family('n')] } },
  ]);
  assert.equal(cards.length, 0);
});

test('kinds interleave and each is bounded', () => {
  const many = (prefix: string, n: number) =>
    Array.from({ length: n }, (_, i) => family(`${prefix}${i}`));
  const cards = feedCards([
    { slot: 'top', families: { exact: many('t', 10), nearMiss: [] } },
    { slot: 'footwear', families: { exact: many('f', 10), nearMiss: [] } },
  ]);
  // Bounded per slot…
  assert.equal(cards.length, FAMILIES_PER_SLOT * 2);
  // …and round-robin: the grid opens with one of each, not a run of tops.
  assert.deepEqual(
    cards.slice(0, 4).map((c) => c.slot),
    ['top', 'footwear', 'top', 'footwear'],
  );
});

// ---------------------------------------------------------------------------
// The wire, and the gate — as source contract
// ---------------------------------------------------------------------------

const HOOK = readFileSync('src/features/explore/use-shop-feed.ts', 'utf8');
const SCREEN = readFileSync('src/app/(tabs)/explore.tsx', 'utf8');

test('the browse body carries the action and an enum slot, nothing else', () => {
  assert.match(HOOK, /body: \{ action: 'browse', slot \}/);
  // One body in the whole hook, and it is that one — no second request shape
  // through which text could travel.
  assert.equal((HOOK.match(/body:/g) ?? []).length, 1);
});

test('the shelf is gated on the person’s own Show-where-to-buy switch', () => {
  assert.match(SCREEN, /useShowWhereToBuy\(\)/);
  assert.match(SCREEN, /showWhereToBuy\.data === true \? <ShopFeedSection/);
});

test('analytics carry counts, never kinds or cards', () => {
  const calls = HOOK.match(/track\([\s\S]{0,200}?\)/g) ?? [];
  assert.ok(calls.length > 0);
  for (const c of calls) {
    assert.doesNotMatch(c, /slot(?!s\.length)|title|merchant|brand|url/i, c);
  }
});
