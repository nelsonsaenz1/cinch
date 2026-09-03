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
  EXPLORE_SHELF_CAP,
  FAMILIES_PER_SLOT,
  FEED_SLOT_CAP,
  MIN_CONFIDENT_CARDS,
  cardTitle,
  categoryVerdict,
  closetColourNames,
  confidentShelf,
  exploreShelf,
  fashionCategoryLabel,
  feedCards,
  feedSlots,
  isConfidentFashion,
  partnerShelfCards,
} from '../src/features/explore/shop-feed';
import { TITLE_UNAVAILABLE } from '../src/features/catalogue/copy';
import type { CatalogueFamily } from '../src/features/catalogue/types';

const garment = (slot: string) => ({ slot }) as never;

/**
 * The fixture carries a `productClass` because the category gate
 * (2026-09-02, P0 #16) will not print a card for a family whose kind cannot be
 * proven — see "the gate" below. Before that gate, a family with no class at
 * all became a card, which is exactly how a hat RACK reached the shelf.
 */
const family = (id: string, over: Partial<CatalogueFamily> = {}): CatalogueFamily => ({
  familyId: id,
  brand: 'Acme',
  title: 'Cotton Shirt',
  productClass: 'top',
  category: 'Clothing',
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
  const many = (prefix: string, n: number, productClass: string) =>
    Array.from({ length: n }, (_, i) =>
      family(`${prefix}${i}`, { productClass } as Partial<CatalogueFamily>),
    );
  const cards = feedCards([
    { slot: 'top', families: { exact: many('t', 10, 'top'), nearMiss: [] } },
    { slot: 'footwear', families: { exact: many('f', 10, 'footwear'), nearMiss: [] } },
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
// Colour affinity
// ---------------------------------------------------------------------------

test('the closet palette is counted, canonical, and deterministic', () => {
  const g = (name: string) => ({ colors: [{ name }] }) as never;
  assert.deepEqual(
    closetColourNames([g('Navy'), g('navy'), g('gray'), g('grey'), g('grey'), g('white')]),
    ['grey', 'navy', 'white'],
  );
  assert.deepEqual(closetColourNames([]), []);
});

test('families speaking the closet’s colours rank first, label over title', () => {
  const coloured = (id: string, label: string, title: string) =>
    family(id, { title, colours: [{ ...family(id).colours[0]!, label }] });
  const cards = feedCards(
    [
      {
        slot: 'top',
        families: {
          exact: [
            coloured('plain', 'Red', 'Linen Shirt'),
            coloured('title-hit', 'Multi', 'Navy Oxford Shirt'),
            coloured('label-hit', 'Navy', 'Oxford Shirt'),
          ],
          nearMiss: [],
        },
      },
    ],
    ['navy'],
  );
  assert.deepEqual(
    cards.map((c) => c.key),
    ['top:label-hit', 'top:title-hit', 'top:plain'],
  );
});

test('an empty palette degrades to the server’s own order', () => {
  const cards = feedCards(
    [{ slot: 'top', families: { exact: [family('a'), family('b')], nearMiss: [] } }],
    [],
  );
  assert.deepEqual(cards.map((c) => c.key), ['top:a', 'top:b']);
});

test('a colour word never fires inside a longer word', () => {
  const tan = family('t', { title: 'Titanium Frame Jacket', colours: [{ ...family('t').colours[0]!, label: 'Titanium' }] });
  const real = family('r', { title: 'Tan Suede Jacket', colours: [{ ...family('r').colours[0]!, label: 'Tan' }] });
  const cards = feedCards([{ slot: 'top', families: { exact: [tan, real], nearMiss: [] } }], ['tan']);
  assert.equal(cards[0]?.key, 'top:r');
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
  // AMENDED 2026-09-02 (P1 #18): the two full shelves became ONE compact grid
  // with a door to `/shop`. The gate expression is unchanged in kind — the
  // switch still decides whether any commerce renders at all — it now guards
  // the single `ShopShelf` instead of two sections.
  assert.match(SCREEN, /showWhereToBuy\.data === true \? \(\s*<ShopShelf/);
});

test('analytics carry counts, never kinds or cards', () => {
  const calls = HOOK.match(/track\([\s\S]{0,200}?\)/g) ?? [];
  assert.ok(calls.length > 0);
  for (const c of calls) {
    assert.doesNotMatch(c, /slot(?!s\.length)|title|merchant|brand|url/i, c);
  }
});

// ---------------------------------------------------------------------------
// The category confidence gate — P0 #16, 2026-09-02
//
// The founder's audit found the shelf serving home decor, electronics and
// automotive parts. The cause is structural, not cosmetic: a browse asks the
// catalogue for one noun, and the server only refuses a family when its class
// and the query's class both exist and disagree — so a home-goods row whose
// title contains a garment word ("Hat Rack") is classed as that garment and
// admitted. These tests pin the refusal.
// ---------------------------------------------------------------------------

test('the live regression: a hat rack is not a hat', () => {
  const rack = family('rack', {
    title: 'Rustic Wall Shelf Hat Rack',
    // The head noun is "hat" — the server really does class this headwear.
    productClass: 'headwear',
    category: 'Home & Garden > Storage',
  });
  assert.equal(isConfidentFashion(rack, 'headwear'), false);

  const cards = feedCards([{ slot: 'headwear', families: { exact: [rack], nearMiss: [] } }]);
  assert.deepEqual(cards, []);
});

test('a non-fashion department refuses the row whatever the title says', () => {
  for (const category of [
    'Automotive > Seat Covers',
    'Electronics > Phone Accessories',
    'Home Decor',
    'Toys & Games',
    'Sporting Goods > Fishing',
  ]) {
    assert.equal(categoryVerdict(category), 'non-fashion', category);
    assert.equal(
      isConfidentFashion({ title: 'Cotton Shirt', productClass: 'top', category }, 'top'),
      false,
      category,
    );
  }
});

test('an object nobody wears is refused from the title alone', () => {
  for (const title of [
    'Cedar Shoe Rack',
    'Wooden Coat Hanger Set',
    'Leather Belt Buckle Keychain',
    'Dress Form Mannequin Lamp',
  ]) {
    assert.equal(
      isConfidentFashion({ title, productClass: 'footwear', category: null }, 'footwear'),
      false,
      title,
    );
  }
});

test('proof is required, and it is the kind that was asked for', () => {
  const unclassified = { title: 'Amalfi', productClass: null, category: null };
  // No class and no category: nothing here says clothing, so nothing renders.
  assert.equal(isConfidentFashion(unclassified, 'top'), false);
  // The merchant's own category can carry it instead.
  assert.equal(isConfidentFashion({ ...unclassified, category: 'Women’s Apparel' }, 'top'), true);
  // Fashion, but the wrong kind: a trouser under a dress browse is still a
  // broken promise, and is refused for the same reason a hat rack is.
  assert.equal(
    isConfidentFashion(
      { title: 'Navy Dress Pant', productClass: 'bottom', category: 'Clothing' },
      'dress',
    ),
    false,
  );
  // And the right kind, proven, passes.
  assert.equal(
    isConfidentFashion({ title: 'Oxford Shirt', productClass: 'top', category: 'Clothing' }, 'top'),
    true,
  );
});

test('a category word never fires inside a longer word', () => {
  // "car" must not fire inside "cardigan", nor the reverse.
  assert.equal(categoryVerdict('Cardigans'), 'fashion');
  assert.equal(categoryVerdict('Car Accessories'), 'non-fashion');
});

test('below four confident cards there is no shelf at all', () => {
  const three = Array.from({ length: 3 }, (_, i) => family(`c${i}`));
  const four = Array.from({ length: 4 }, (_, i) => family(`c${i}`));
  assert.equal(MIN_CONFIDENT_CARDS, 4);
  assert.deepEqual(
    confidentShelf(feedCards([{ slot: 'top', families: { exact: three, nearMiss: [] } }])),
    [],
  );
  assert.equal(
    confidentShelf(feedCards([{ slot: 'top', families: { exact: four, nearMiss: [] } }])).length,
    4,
  );
});

test('the hook, not just the builder, applies the shelf minimum', () => {
  assert.match(HOOK, /confidentShelf\(/);
});

// ---------------------------------------------------------------------------
// P0 #17 — "Catalog name unavailable" never reaches a card
// ---------------------------------------------------------------------------

const DUMP = 'T-Shirt Mens 1XL Gray Cotton Casual Usa Made Logo Classic Preppy Short Sleeve';

test('an unusable title is suppressed, never printed as a placeholder', () => {
  const nameless = family('n', { title: DUMP, category: 'Clothing' });
  assert.equal(cardTitle(nameless), null);

  const cards = feedCards([
    { slot: 'top', families: { exact: [nameless, family('good')], nearMiss: [] } },
  ]);
  assert.deepEqual(
    cards.map((c) => c.key),
    ['top:good'],
  );
  for (const card of cards) assert.notEqual(card.title, TITLE_UNAVAILABLE);
});

test('a fashion category label may stand in for a missing name', () => {
  assert.equal(cardTitle({ title: DUMP, category: 'Women’s Clothing > Dresses' }), 'Dress');
  assert.equal(fashionCategoryLabel('Footwear > Boots'), 'Boots');
  // "Clothing" proves apparel but names no product — that card is suppressed
  // rather than titled with a department.
  assert.equal(fashionCategoryLabel('Clothing'), null);
});

test('no shelf source can print the placeholder sentence', () => {
  for (const path of [
    'src/features/explore/shop-feed.ts',
    'src/components/explore/shop-shelf.tsx',
    'src/components/explore/shop-feed-section.tsx',
    'src/components/explore/partner-shop-section.tsx',
  ]) {
    const src = readFileSync(path, 'utf8');
    assert.doesNotMatch(
      src,
      /TITLE_UNAVAILABLE|presentedTitle/,
      `${path} can still print a placeholder`,
    );
  }
});

// ---------------------------------------------------------------------------
// P1 #18 — commerce is subordinate: one compact grid, and a door
// ---------------------------------------------------------------------------

const partner = (
  key: string,
  over: Partial<Parameters<typeof partnerShelfCards>[0][number]> = {},
) => ({
  key,
  title: 'Linen Shirt',
  brand: 'CICYBELL',
  merchant: 'CICYBELL',
  imageUrl: 'https://example.invalid/p.jpg',
  pageUrl: 'https://awin.example/p',
  slot: 'top' as string | null,
  ...over,
});

test('the Explore grid is capped, closet first, partner filling', () => {
  const closet = Array.from({ length: 4 }, (_, i) => family(`c${i}`));
  const cards = feedCards([{ slot: 'top', families: { exact: closet, nearMiss: [] } }]);
  const shelf = exploreShelf(
    cards,
    partnerShelfCards(Array.from({ length: 20 }, (_, i) => partner(`p${i}`))),
  );

  assert.equal(EXPLORE_SHELF_CAP, 6);
  assert.equal(shelf.cards.length, EXPLORE_SHELF_CAP);
  assert.equal(shelf.total, 24, 'the door must lead to everything, not to the cap');
  // Closet-similarity answers the person, so it leads.
  assert.deepEqual(
    shelf.cards.slice(0, 4).map((c) => c.paid),
    [false, false, false, false],
  );
  assert.deepEqual(
    shelf.cards.slice(4).map((c) => c.paid),
    [true, true],
  );
});

test('disclosure rides the card, never the block', () => {
  const shelf = exploreShelf(
    feedCards([{ slot: 'top', families: { exact: [family('a')], nearMiss: [] } }]),
    partnerShelfCards([partner('p1')]),
  );
  assert.equal(shelf.cards.filter((c) => c.paid).length, 1);

  const section = readFileSync('src/components/explore/shop-shelf.tsx', 'utf8');
  // The marker is drawn from the card's own `paid`, and there is no
  // block-level paid sentence over a grid that is only half paid.
  assert.match(section, /card\.paid\s*\n?\s*\?/);
  assert.doesNotMatch(section, /paid arrangement|may earn a commission/);
});

test('a partner row with no usable title takes its slot label, or nothing', () => {
  const dumped = partnerShelfCards([partner('p1', { title: DUMP })]);
  assert.equal(dumped[0]?.title, 'Top');
  // No usable title AND no known kind: no card.
  assert.deepEqual(partnerShelfCards([partner('p2', { title: DUMP, slot: null })]), []);
  // And a row the server sent without a picture or a link never draws.
  assert.deepEqual(partnerShelfCards([partner('p3', { imageUrl: '' })]), []);
});

test('the shelf sits below the circle, and the door is the way to more', () => {
  const shelfAt = SCREEN.indexOf('<ShopShelf');
  assert.ok(shelfAt > 0, 'Explore lost its shelf');
  // Every piece of circle content is composed before it.
  for (const marker of ['{dailySection}', '<Hero', 'EXPLORE_COPY.additionsHeading']) {
    assert.ok(SCREEN.indexOf(marker) < shelfAt, `${marker} renders after the shop shelf`);
  }
  assert.match(SCREEN, /router\.push\('\/shop'\)/);
  // The full feed lives on its own route, gated by the same switch.
  const route = readFileSync('src/app/shop.tsx', 'utf8');
  assert.match(route, /useShowWhereToBuy\(\)/);
  assert.match(route, /<ShopFeedSection/);
  assert.match(route, /<PartnerShopSection/);
});

// ---------------------------------------------------------------------------
// The mirror — the server refuses the same rows, or the two have drifted
// ---------------------------------------------------------------------------

test('the client gate and the Edge Function gate hold the same words', () => {
  const client = readFileSync('src/features/explore/shop-feed.ts', 'utf8');
  const server = readFileSync('supabase/functions/garment-search/fashion-gate.ts', 'utf8');

  const block = (src: string, name: string) => {
    const start = src.indexOf(`export const ${name}`);
    assert.ok(start !== -1, `${name} is missing`);
    const list = src.indexOf('\n];', start);
    const record = src.indexOf('\n};', start);
    const end = list !== -1 && (record === -1 || list < record) ? list : record;
    return src.slice(start, end);
  };

  for (const name of [
    'FASHION_CATEGORY_LABELS',
    'GENERIC_FASHION_CATEGORY_WORDS',
    'NON_FASHION_CATEGORY_WORDS',
    'NON_APPAREL_TITLE_WORDS',
  ]) {
    assert.equal(block(client, name), block(server, name), `${name} has drifted`);
  }

  // And the browse handler actually applies it, on both groups.
  const index = readFileSync('supabase/functions/garment-search/index.ts', 'utf8');
  assert.match(index, /exact\.filter\(\(f\) => isFashionFamily\(f, request\.slot\)\)/);
  assert.match(index, /nearMiss\.filter\(\(f\) => isFashionFamily\(f, request\.slot\)\)/);
});
