/**
 * gap-shop-match, end to end, with the database and the network taken out.
 *
 * WHAT "END TO END" MEANS HERE
 *
 * Every rule the commerce directive imposes on a shop suggestion, exercised
 * through the same `decide()` the deployed function calls, with fake reads
 * standing in for Postgres and Datafeedr. Both callers are covered: the Gap
 * Feed matching a computed gap (C-01), and a friend's closet item (C-04), which
 * differ only by whether an `itemId` is present and are otherwise the same
 * code — which is itself worth asserting.
 *
 * WHY IT IS WORTH THE SIZE
 *
 * Two of these rules protect somebody other than the caller. `shoppable` is a
 * friend's decision about their own wardrobe, and until 2026-08-11 it was
 * enforced only in `FriendItemSheet` — the same client that was asking. Anyone
 * calling the endpoint directly got matches for a friend's garment whether or
 * not that friend had allowed it. A rule enforced by the questioner is not a
 * rule, and the only way that stays fixed is a test that fails when it is not.
 *
 * The rest guard claims. "Paid link" was once a static label on every row while
 * zero programmes were joined, which told every user we earned a commission we
 * did not earn.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { CatalogProduct } from '../supabase/functions/_shared/catalog.ts';
import {
  decide,
  MAX_MERCHANTS,
  readHints,
  type Deps,
} from '../supabase/functions/gap-shop-match/policy.ts';

/** A catalogue row. `sourceId` 310 is Awin US, the one network we hold a
 *  publisher id for, so it is the only family that can ever be paid. */
function product(over: Partial<CatalogProduct> = {}): CatalogProduct {
  return {
    externalId: 'p1',
    title: 'Everlane Mac Coat In Black, Size Medium, Cotton',
    brand: 'Everlane',
    colour: 'black',
    priceMinor: 19_800,
    currency: 'USD',
    imageUrl: 'https://img.example/1.jpg',
    thumbnailUrl: null,
    merchant: 'Everlane',
    merchantId: '142544',
    sourceId: 310,
    linkUrl: 'https://www.awin1.com/cread.php?awinmid=142544&p=https%3A%2F%2Fshop',
    directUrl: 'https://everlane.example/mac-coat',
    identifier: null,
    monetised: true,
    ...over,
  } as CatalogProduct;
}

type Calls = { searches: string[]; notes: string[] };

function deps(over: Partial<Deps> = {}): { deps: Deps; calls: Calls } {
  const calls: Calls = { searches: [], notes: [] };
  const base: Deps = {
    showWhereToBuy: async () => true,
    itemShoppable: async () => true,
    search: async (query) => {
      calls.searches.push(query);
      return [product()];
    },
    joined: async () => new Set<string>(),
    note: (metric) => calls.notes.push(metric),
    ...over,
  };
  // Wrap whatever `search` ended up being so every test records its calls —
  // several of these assert that NO catalogue request was made at all.
  const wrapped: Deps = {
    ...base,
    search: async (q, b) => {
      calls.searches.push(q);
      return await base.search(q, b);
    },
  };
  if (over.search === undefined) wrapped.search = base.search;
  return { deps: wrapped, calls };
}

const BLACK_COAT = { slot: 'outerwear' as const, hints: { colour: 'black' } };

// ---------------------------------------------------------------------------
// Consent. Both of these must be decided BEFORE a metered request is spent.
// ---------------------------------------------------------------------------

test("a viewer who turned suggestions off gets none, and costs nothing", () => {
  return (async () => {
    const { deps: d, calls } = deps({ showWhereToBuy: async () => false });
    const out = await decide(BLACK_COAT, d);

    assert.deepEqual(out.products, []);
    assert.equal(out.refusal, 'viewer_opted_out');
    assert.deepEqual(calls.searches, [], 'a refused viewer must not spend a catalogue request');
  })();
});

test("a friend's piece marked not shoppable returns nothing", async () => {
  const { deps: d, calls } = deps({ itemShoppable: async () => false });
  const out = await decide({ ...BLACK_COAT, itemId: 'item-1' }, d);

  assert.deepEqual(out.products, []);
  assert.equal(out.refusal, 'owner_not_shoppable');
  assert.deepEqual(calls.searches, []);
});

test('an item the caller cannot see is the same silence as one marked private', async () => {
  // Distinguishing them would tell a caller that an item exists and that its
  // owner said no — which is not theirs to learn.
  const invisible = await decide({ ...BLACK_COAT, itemId: 'x' }, deps({ itemShoppable: async () => null }).deps);
  const refused = await decide({ ...BLACK_COAT, itemId: 'x' }, deps({ itemShoppable: async () => false }).deps);
  assert.deepEqual(invisible, refused);
});

test("the viewer's preference beats the owner's permission", async () => {
  // A viewer who opted out gets nothing even on a friend's explicitly
  // shoppable piece. The two consents are not interchangeable.
  const { deps: d } = deps({ showWhereToBuy: async () => false, itemShoppable: async () => true });
  const out = await decide({ ...BLACK_COAT, itemId: 'item-1' }, d);
  assert.equal(out.refusal, 'viewer_opted_out');
});

test('an unreadable profile fails closed', async () => {
  // `index.ts` maps a read error to `false` rather than `null`, so a database
  // problem cannot be read as "no preference set, go ahead".
  const { deps: d } = deps({ showWhereToBuy: async () => false });
  assert.equal((await decide(BLACK_COAT, d)).refusal, 'viewer_opted_out');
});

// ---------------------------------------------------------------------------
// What may be asked
// ---------------------------------------------------------------------------

test('a slot with no colour or brand asks nothing and returns nothing', async () => {
  // Measured: "coat" alone returns a wooden coat stand and an automotive
  // listing; "black coat" returns fifteen apparel merchants and no junk.
  const { deps: d, calls } = deps();
  const out = await decide({ slot: 'outerwear', hints: {} }, d);

  assert.deepEqual(out.products, []);
  assert.equal(out.refusal, 'no_qualifier');
  assert.deepEqual(calls.searches, []);
});

test('a brand alone is a sufficient qualifier', async () => {
  const { deps: d, calls } = deps();
  const out = await decide({ slot: 'outerwear', hints: { brand: 'Everlane' } }, d);
  assert.equal(calls.searches.length, 1);
  assert.equal(out.products.length, 1);
});

test('the "other" slot is never searched', async () => {
  const { deps: d, calls } = deps();
  const out = await decide({ slot: 'other', hints: { colour: 'black' } }, d);
  assert.equal(out.refusal, 'slot_unverified');
  assert.deepEqual(calls.searches, []);
});

test('a provider failure is silence, not an error', async () => {
  const { deps: d, calls } = deps({
    search: async () => {
      throw new Error('transport');
    },
  });
  const out = await decide(BLACK_COAT, d);
  assert.deepEqual(out.products, []);
  assert.equal(out.refusal, 'provider_failed');
  assert.ok(calls.notes.includes('provider_failure'), 'a failure nobody counts is invisible');
});

// ---------------------------------------------------------------------------
// What comes back
// ---------------------------------------------------------------------------

test('at most three merchants, and never two rows from one shop', async () => {
  const rows = [
    product({ externalId: 'a', merchant: 'Everlane' }),
    product({ externalId: 'b', merchant: 'Everlane' }),
    product({ externalId: 'c', merchant: 'Nordstrom' }),
    product({ externalId: 'd', merchant: 'Macy\'s' }),
    product({ externalId: 'e', merchant: 'Belk' }),
    product({ externalId: 'f', merchant: 'REVOLVE' }),
  ];
  const { deps: d } = deps({ search: async () => rows });
  const out = await decide(BLACK_COAT, d);

  assert.equal(out.products.length, MAX_MERCHANTS);
  const merchants = out.products.map((p) => p.merchantName);
  assert.equal(new Set(merchants).size, merchants.length, 'a shop appeared twice');
});

test('irrelevant rows are dropped before ranking, not after', async () => {
  // "Marguerite Coated Skinny Jean In Black Coated" satisfies `name LIKE black
  // coat` exactly and is a pair of jeans. If it survived to the ranking it
  // could still win, because ranking junk only decides which junk goes first.
  const rows = [
    product({ externalId: 'junk', title: 'Marguerite Coated Skinny Jean In Black Coated', merchant: "L'AGENCE" }),
    product({ externalId: 'real', title: 'Everlane Mac Coat In Black', merchant: 'Everlane' }),
  ];
  const { deps: d } = deps({ search: async () => rows });
  const out = await decide(BLACK_COAT, d);

  assert.deepEqual(out.products.map((p) => p.id), ['real']);
});

test('when nothing survives the filter, the answer is empty rather than wrong', async () => {
  const { deps: d } = deps({
    search: async () => [product({ title: 'Black Shoe Polish Cream 75ml Tube', merchant: 'X' })],
  });
  const out = await decide({ slot: 'footwear', hints: { colour: 'black' } }, d);
  assert.deepEqual(out.products, []);
  assert.equal(out.refusal, 'nothing_relevant');
});

// ---------------------------------------------------------------------------
// Money. The claim, and the link.
// ---------------------------------------------------------------------------

test('with no joined programme, nothing is called paid and links go direct', async () => {
  // This is the live state today: Awin reports zero joined programmes, and a
  // buildable tracking URL is not evidence of earning from it.
  const { deps: d } = deps({ joined: async () => new Set() });
  const out = await decide(BLACK_COAT, d);

  assert.equal(out.products.length, 1);
  assert.equal(out.products[0].paid, false);
  assert.equal(out.products[0].url, 'https://everlane.example/mac-coat');
  assert.ok(!out.products[0].url.includes('awin1.com'), 'an unpaid click must not be routed');
});

test('a confirmed joined programme is the only thing that makes a link paid', async () => {
  const { deps: d } = deps({ joined: async () => new Set(['awin:142544']) });
  const out = await decide(BLACK_COAT, d);

  assert.equal(out.products[0].paid, true);
  assert.ok(out.products[0].url.includes('awin1.com'));
});

test('a joined programme on a DIFFERENT merchant does not make this one paid', async () => {
  const { deps: d } = deps({ joined: async () => new Set(['awin:999999']) });
  assert.equal((await decide(BLACK_COAT, d)).products[0].paid, false);
});

test('a row on a network we hold no publisher id for is never paid', async () => {
  // sourceId 3 is CJ US. `networkFamily` returns null for it, so no amount of
  // joined-programme rows can label it — there is no tracking URL to route to.
  const { deps: d } = deps({
    search: async () => [product({ sourceId: 3, monetised: false })],
    joined: async () => new Set(['awin:142544']),
  });
  const out = await decide(BLACK_COAT, d);
  assert.equal(out.products[0].paid, false);
  assert.equal(out.products[0].url, 'https://everlane.example/mac-coat');
});

test('no outbound link carries anything identifying the user', async () => {
  const { deps: d } = deps({ joined: async () => new Set(['awin:142544']) });
  const out = await decide(BLACK_COAT, d);

  for (const p of out.products) {
    const url = new URL(p.url);
    for (const forbidden of ['clickref', 'u1', 'sid', 'subid', 'uid', 'user', 'email']) {
      assert.equal(url.searchParams.get(forbidden), null, `${forbidden} leaked into ${p.url}`);
    }
  }
});

// ---------------------------------------------------------------------------
// Ranking is about fit, and only about fit
// ---------------------------------------------------------------------------

test('a paid row does not outrank a better-fitting unpaid one', async () => {
  // The property that keeps "what you are missing" an honest statement about a
  // wardrobe: `score()` has no term for what anything pays, so a joined
  // programme cannot buy position.
  const rows = [
    product({ externalId: 'paid-poor', merchant: 'Everlane', merchantId: '142544', colour: 'brown' }),
    product({ externalId: 'free-good', merchant: 'Nordstrom', merchantId: '130141', colour: 'black' }),
  ];
  const { deps: d } = deps({ search: async () => rows, joined: async () => new Set(['awin:142544']) });
  const out = await decide(BLACK_COAT, d);

  assert.equal(out.products[0].id, 'free-good');
  assert.equal(out.products[0].paid, false);
  assert.equal(out.products[1].paid, true);
});

test('the price hint is a ceiling, not an ordering', async () => {
  // Ordering by price ascending is what once surfaced a $14 SHEIN listing for
  // "reformation midi dress". Being cheaper earns nothing; only being under the
  // ceiling does, and it earns the same as any other row under it.
  const rows = [
    product({ externalId: 'cheap-wrong-colour', merchant: 'A', priceMinor: 1_400, colour: 'brown' }),
    product({ externalId: 'dearer-right-colour', merchant: 'B', priceMinor: 19_000, colour: 'black' }),
  ];
  const { deps: d } = deps({ search: async () => rows });
  const out = await decide(
    { slot: 'outerwear', hints: { colour: 'black', priceCeilingCents: 20_000 } },
    d,
  );
  assert.equal(out.products[0].id, 'dearer-right-colour', 'thirteen times the price and still the better answer');

  // And a row far over the ceiling loses to one under it, all else equal: a
  // suggestion nobody would buy is not a suggestion.
  const over = [
    product({ externalId: 'over', merchant: 'A', priceMinor: 200_000 }),
    product({ externalId: 'under', merchant: 'B', priceMinor: 15_000 }),
  ];
  const { deps: d2 } = deps({ search: async () => over });
  const out2 = await decide(
    { slot: 'outerwear', hints: { colour: 'black', priceCeilingCents: 20_000 } },
    d2,
  );
  assert.equal(out2.products[0].id, 'under');
});

// ---------------------------------------------------------------------------
// Input handling
// ---------------------------------------------------------------------------

test('hints are bounded and junk is dropped rather than trusted', () => {
  const h = readHints({
    colour: '  black  ',
    brand: 'x'.repeat(200),
    formality: 'nonsense',
    priceCeilingCents: -5,
  });
  assert.equal(h.colour, 'black');
  assert.equal(h.brand?.length, 80);
  assert.equal(h.formality, undefined);
  assert.equal(h.priceCeilingCents, undefined);

  assert.deepEqual(readHints(null), {
    colour: undefined,
    brand: undefined,
    formality: undefined,
    priceCeilingCents: undefined,
  });
  assert.equal(readHints({ priceCeilingCents: 99_999_999_999 }).priceCeilingCents, 100_000_00);
});

test('both callers run the same code', async () => {
  // C-01 (a computed gap) and C-04 (a friend's piece) differ only by `itemId`.
  // If they ever diverge, one of them will quietly stop honouring a rule.
  const gapFeed = await decide(BLACK_COAT, deps().deps);
  const friendItem = await decide({ ...BLACK_COAT, itemId: 'item-1' }, deps().deps);
  assert.deepEqual(gapFeed.products, friendItem.products);
});
