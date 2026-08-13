/**
 * The query that actually goes on the wire.
 *
 * Everything else about the matcher is pure and provable from fixtures. This is
 * the one part that is not: `buildQuery` composes a Datafeedr request out of a
 * parse, a duplicate rule and an availability posture, and getting any of the
 * three wrong is invisible in the result — you get rows, they look plausible,
 * and the garment the user actually owns is simply absent.
 *
 * So `fetch` is stubbed and the REQUEST BODIES are asserted. Nothing here
 * reaches the network, and the assertions are about what we would have asked
 * rather than about what came back.
 *
 * THE THREE THINGS THAT ARE WORTH THIS TROUBLE:
 *
 *   `instock = 1` must be absent for the matcher and present for the shop
 *   path. A garment somebody owns is owned whether or not a shop still sells
 *   it, and the pieces most likely to be missing from a live feed are exactly
 *   the ones owned longest — so this filter, correct for `gap-shop-match`, is
 *   the difference between finding somebody's four-year-old shirt and telling
 *   them the catalogue has never heard of it.
 *
 *   `exclude_duplicates` must keep colourways for the matcher and collapse them
 *   for the shop path. Collapsing is not an optimisation here; it deletes the
 *   thing the user is choosing between.
 *
 *   The ladder must stop at three requests, and its last rung must be the one
 *   that drops a guessed brand.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  type CatalogProduct,
  type DatafeedrOpts,
  searchCatalogue,
} from '../supabase/functions/_shared/catalog.ts';
import { ladderFor, parseQuery } from '../supabase/functions/_shared/catalog-query.ts';

type Sent = { query: string[]; exclude_duplicates: string; limit: number };

/**
 * A Datafeedr that records what it was asked and answers however the test says.
 *
 * `answers` is consumed one per request, so a test can make the first rung come
 * back empty and watch the ladder walk.
 */
function stub(answers: number[]) {
  const sent: Sent[] = [];
  const keys: string[] = [];
  const original = globalThis.fetch;

  let call = 0;
  globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Sent;
    sent.push(body);
    const count = answers[call] ?? 0;
    call += 1;
    const products = Array.from({ length: count }, (_, i) => ({
      id: 1000 + i,
      name: `Row ${i}`,
      merchant: 'Shop',
      merchant_id: 1,
      source: 'Impact US',
      source_id: 335,
      currency: 'USD',
      price: 1000,
      finalprice: 1000,
      url: 'https://track.test/@@@/1',
      direct_url: 'https://shop.test/p/1',
      image: 'https://cdn.shop.test/1.jpg',
    }));
    return new Response(JSON.stringify({ products }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof globalThis.fetch;

  const opts: DatafeedrOpts = {
    accessId: 'aid',
    accessKey: 'akey',
    affiliateIds: {},
    claimRequest: async () => true,
    // Always a miss, so every test exercises the provider rather than a cache.
    cacheGet: async (key) => {
      keys.push(key);
      return undefined;
    },
    cachePut: async () => {},
  };

  return { opts, sent, keys, restore: () => { globalThis.fetch = original; } };
}

const MATCHER = {
  duplicates: 'colourways' as const,
  availability: 'any' as const,
};

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

test('the matcher does not require a garment to still be for sale', () => {
  const s = stub([5]);
  return searchCatalogue(s.opts, 'keyword', 'crew neck tee', MATCHER)
    .then(() => {
      assert.equal(s.sent.length, 1);
      assert.ok(
        !s.sent[0].query.some((c) => c.includes('instock')),
        `the matcher asked for in-stock rows only: ${s.sent[0].query.join(' | ')}`,
      );
      // The locale filters are NOT relaxed with it. A garment priced in NZD is
      // still wrong on screen whether or not anyone can buy it.
      assert.ok(s.sent[0].query.includes('currency = USD'));
      assert.ok(s.sent[0].query.some((c) => c.startsWith('source_id IN')));
      assert.ok(s.sent[0].query.includes('image !EMPTY'));
    })
    .finally(s.restore);
});

test('the shop path still asks for things somebody can actually buy', () => {
  // `gap-shop-match` suggests a purchase. A sold-out listing there is a dead
  // tile, so the default stays strict and this proves the default did not move.
  const s = stub([5]);
  return searchCatalogue(s.opts, 'keyword', 'black coat', { merchantIds: [1, 2] })
    .then(() => {
      assert.ok(s.sent[0].query.includes('instock = 1'), 'the shop path stopped filtering stock');
      assert.ok(s.sent[0].query.some((c) => c.startsWith('merchant_id IN')));
    })
    .finally(s.restore);
});

test('availability is part of the cache key, so the two paths cannot share rows', () => {
  // An in-stock-only set is a strict SUBSET of the same query answered with
  // 'any'. Sharing a row would serve the matcher a set with every discontinued
  // garment already removed — the exact rows it exists to find.
  const s = stub([1, 1]);
  return searchCatalogue(s.opts, 'keyword', 'crew neck tee', MATCHER)
    .then(() => searchCatalogue(s.opts, 'keyword', 'crew neck tee', { duplicates: 'colourways' }))
    .then(() => {
      assert.equal(s.keys.length, 2);
      assert.notEqual(s.keys[0], s.keys[1], 'two availability postures shared one cache row');
    })
    .finally(s.restore);
});

// ---------------------------------------------------------------------------
// Duplicates
// ---------------------------------------------------------------------------

test('the matcher keeps colourways; the shop path collapses them', () => {
  const s = stub([1, 1]);
  return searchCatalogue(s.opts, 'keyword', 'crew neck tee', MATCHER)
    .then(() => searchCatalogue(s.opts, 'keyword', 'black coat', {}))
    .then(() => {
      // Same merchant AND same name AND same image is a size variant. Same
      // merchant and same name OR same image also collapses the colours.
      assert.equal(s.sent[0].exclude_duplicates, 'merchant_id name image');
      assert.equal(s.sent[1].exclude_duplicates, 'merchant_id name|image');
    })
    .finally(s.restore);
});

// ---------------------------------------------------------------------------
// The ladder on the wire
// ---------------------------------------------------------------------------

test('a guessed brand is dropped on the last request and not before', () => {
  // Every rung comes back empty, so the ladder walks to the end.
  const s = stub([0, 0, 0]);
  const parsed = parseQuery("James Perse men's T-shirt");

  return searchCatalogue(s.opts, 'keyword', parsed.normalised, {
    brand: parsed.brand,
    rungs: ladderFor(parsed),
    ...MATCHER,
  })
    .then(() => {
      assert.equal(s.sent.length, 3, 'the ladder did not spend exactly three requests');

      const brandOf = (q: string[]) => q.find((c) => c.startsWith('brand = ')) ?? null;
      assert.equal(brandOf(s.sent[0].query), 'brand = james perse');
      assert.equal(brandOf(s.sent[1].query), 'brand = james perse');
      assert.equal(brandOf(s.sent[2].query), null, 'the last rung still pinned the guessed brand');

      // And the words on the last rung are the same words — this is a brand
      // relaxation, not a different search.
      const nameOf = (q: string[]) => q.find((c) => c.startsWith('name LIKE ')) ?? null;
      assert.equal(nameOf(s.sent[1].query), nameOf(s.sent[2].query));
      assert.equal(nameOf(s.sent[2].query), 'name LIKE t shirt');
    })
    .finally(s.restore);
});

test('the ladder stops the moment a rung answers', () => {
  // The cap is three; the common case must still be one. Datafeedr meters
  // requests with a hard monthly cutoff, so a ladder that always walked would
  // triple the bill for nothing.
  const s = stub([4]);
  const parsed = parseQuery("James Perse men's T-shirt");

  return searchCatalogue(s.opts, 'keyword', parsed.normalised, {
    brand: parsed.brand,
    rungs: ladderFor(parsed),
    ...MATCHER,
  })
    .then((rows: CatalogProduct[]) => {
      assert.equal(s.sent.length, 1, 'a rung that answered was followed by another request');
      assert.equal(rows.length, 4);
    })
    .finally(s.restore);
});

test('a brand the caller knows is never dropped, however many rungs run', () => {
  const s = stub([0, 0, 0]);
  const parsed = parseQuery("James Perse men's T-shirt", ['James Perse']);

  return searchCatalogue(s.opts, 'keyword', parsed.normalised, {
    brand: parsed.brand,
    rungs: ladderFor(parsed),
    ...MATCHER,
  })
    .then(() => {
      for (const body of s.sent) {
        assert.ok(
          body.query.some((c) => c.startsWith('brand = ')),
          'a known brand was dropped from a rung',
        );
      }
    })
    .finally(s.restore);
});

test('every request asks for the full hundred rows', () => {
  // Datafeedr bills per request regardless of rows returned, so asking for six
  // throws away 94 rows already paid for. Not a tuning knob.
  const s = stub([0, 0, 0]);
  const parsed = parseQuery("James Perse men's T-shirt");
  return searchCatalogue(s.opts, 'keyword', parsed.normalised, {
    brand: parsed.brand,
    rungs: ladderFor(parsed),
    ...MATCHER,
  })
    .then(() => {
      for (const body of s.sent) assert.equal(body.limit, 100);
    })
    .finally(s.restore);
});
