/**
 * The catalogue cache state machine, and the provider chain's ordering.
 *
 * WHY THIS FILE IS WORTH ITS SIZE
 *
 * Datafeedr meters REQUESTS, not results: 10,000 a month on the Starter plan,
 * a hard cutoff at the limit (error 301) and no overage billing. So the cache
 * is not a latency optimisation, it is the thing that decides whether the
 * feature works at the end of the month. Its most expensive possible bug is
 * also its quietest: conflating "no cache row" with "a cached row that says we
 * found nothing". Both are falsy. One means ask the provider, the other means
 * we already asked and the answer was no.
 *
 * Get that wrong and every unfindable garment costs a metered request every
 * single time anybody re-describes it — and obscure garments are precisely the
 * ones people describe more than once. Nothing errors. The bill just arrives.
 *
 * These tests are deliberately hermetic: no network, and no rows that would
 * reach `admitSource` (which fetches robots.txt). They test the decisions, not
 * the wire — the wire was verified against live responses instead.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  type CatalogProduct,
  datafeedrProvider,
  firstLicensed,
  type LookupMode,
  retainableTerms,
} from '../supabase/functions/garment-search/catalog.ts';
import type {
  GarmentImageProvider,
  MatchResult,
  ProviderResult,
} from '../supabase/functions/garment-search/provider.ts';

/** Records what the provider asked of its injected collaborators. */
type Spy = {
  claims: boolean[];
  reads: string[];
  writes: Array<{
    key: string;
    mode: LookupMode;
    terms: string[];
    products: CatalogProduct[] | null;
    ttl: number;
  }>;
};

function build(cacheAnswer: CatalogProduct[] | null | undefined, spy: Spy) {
  return datafeedrProvider({
    accessId: 'test-id',
    accessKey: 'test-key',
    affiliateIds: {},
    claimRequest: (exact) => {
      spy.claims.push(exact);
      // Refuse, so no test can reach the network even if the gate is bypassed.
      return Promise.resolve(false);
    },
    cacheGet: (key) => {
      spy.reads.push(key);
      return Promise.resolve(cacheAnswer);
    },
    cachePut: (key, mode, terms, products, ttl) => {
      spy.writes.push({ key, mode, terms, products, ttl });
      return Promise.resolve();
    },
  });
}

function spy(): Spy {
  return { claims: [], reads: [], writes: [] };
}

test('a cached miss does not produce a second provider call', async () => {
  const s = spy();
  // `null` is the stored negative: we asked, and there was nothing.
  const provider = build(null, s);

  const result = await provider.search({
    description: 'my late nan cardigan',
    maxCandidates: 6,
  });

  assert.deepEqual(result.candidates, [], 'a cached miss yields no candidates');
  assert.equal(s.reads.length, 1, 'the cache is consulted exactly once');
  assert.deepEqual(
    s.claims,
    [],
    'THE POINT OF THIS FILE: a cached miss must not claim a metered request',
  );
  assert.deepEqual(s.writes, [], 'and must not rewrite the row it just read');
});

test('an absent cache row does claim a request', async () => {
  const s = spy();
  // `undefined` is "no row, or expired" — the one state that may spend money.
  const provider = build(undefined, s);

  await provider.search({ description: 'black wool overcoat', maxCandidates: 6 });

  assert.equal(s.claims.length, 1, 'exactly one request is claimed');
  assert.equal(s.claims[0], false, 'a keyword search is not an exact lookup');
});

test('a refused quota claim caches nothing', async () => {
  const s = spy();
  const provider = build(undefined, s);

  const result = await provider.search({ description: 'navy blazer', maxCandidates: 6 });

  assert.deepEqual(result.candidates, []);
  assert.deepEqual(
    s.writes,
    [],
    'a refusal is not evidence of absence — caching it would invent a negative',
  );
});

test('the brand is part of the cache key', async () => {
  const bare = spy();
  await build(null, bare).match({
    descriptor: 'midi dress',
    photoUrl: 'https://example.com/a.jpg',
    brand: undefined,
    maxCandidates: 6,
  });

  const branded = spy();
  await build(null, branded).match({
    descriptor: 'midi dress',
    photoUrl: 'https://example.com/a.jpg',
    brand: 'Reformation',
    maxCandidates: 6,
  });

  assert.notEqual(
    bare.reads[0],
    branded.reads[0],
    'brand-scoped and unscoped lookups return different rows and must not collide',
  );
});

test('the cache key is stable across equivalent phrasings', async () => {
  const a = spy();
  await build(null, a).search({ description: 'Black  Wool Coat!', maxCandidates: 6 });

  const b = spy();
  await build(null, b).search({ description: 'black wool coat', maxCandidates: 6 });

  assert.equal(
    a.reads[0],
    b.reads[0],
    'normalisation is what makes the cache global rather than per user',
  );
});

// ---------------------------------------------------------------------------
// Chain ordering. The licensed source answers first; the web path is a fallback
// and is absent entirely when the switch is off. This is a legal statement
// rather than a performance one, so it is asserted rather than assumed.
// ---------------------------------------------------------------------------

function stub(id: string, candidates: number): GarmentImageProvider {
  const made = Array.from({ length: candidates }, (_, i) => ({
    imageUrl: `https://example.com/${id}-${i}.jpg`,
    title: `${id} ${i}`,
    source: 'example.com',
    confidence: 0.5,
    // `match` returns ListingCandidate, which carries the page it links to.
    pageUrl: `https://example.com/${id}-${i}`,
  }));
  const common = {
    declined: [],
    promptTokens: null,
    completionTokens: null,
    costUsd: null,
    latencyMs: 0,
  };
  return {
    id,
    search: () => Promise.resolve({ candidates: made, ...common } satisfies ProviderResult),
    match: () => Promise.resolve({ brands: [], candidates: made, ...common } satisfies MatchResult),
  };
}

const BOTH = { search: true, match: true };
const NEITHER = { search: false, match: false };
/** The shipped configuration: licensed images only, brand identification kept. */
const SHIPPED = { search: false, match: true };

test('the licensed provider answers before the web fallback', async () => {
  const chain = firstLicensed([stub('licensed', 3)], stub('web', 3), BOTH);
  const result = await chain.search({ description: 'anything', maxCandidates: 6 });

  assert.equal(result.candidates[0]?.title, 'licensed 0');
});

test('the web fallback answers only what the licensed source could not', async () => {
  const chain = firstLicensed([stub('licensed', 0)], stub('web', 3), BOTH);
  const result = await chain.search({ description: 'anything', maxCandidates: 6 });

  assert.equal(result.candidates.length, 3);
  assert.equal(result.candidates[0]?.title, 'web 0');
});

test('the kill switch removes the unlicensed provider from the chain entirely', async () => {
  const chain = firstLicensed([stub('licensed', 0)], stub('web', 3), NEITHER);

  assert.equal(chain.id, 'licensed', 'the web provider is not merely skipped, it is absent');

  const result = await chain.search({ description: 'anything', maxCandidates: 6 });
  assert.deepEqual(
    result.candidates,
    [],
    'with the switch off, no licensed answer means no answer — never an unlicensed one',
  );
});

test('the shipped configuration keeps brand identification while refusing web imagery', async () => {
  const chain = firstLicensed([stub('licensed', 0)], stub('web', 3), SHIPPED);

  const searched = await chain.search({ description: 'anything', maxCandidates: 6 });
  assert.deepEqual(searched.candidates, [], 'no licensed image means no image at all');

  const matched = await chain.match({
    descriptor: 'anything',
    photoUrl: 'https://example.com/a.jpg',
    brand: undefined,
    maxCandidates: 6,
  });
  assert.equal(
    matched.candidates.length,
    3,
    'reading a brand off the user’s own photograph copies no image, so it survives',
  );
});

// ---------------------------------------------------------------------------
// The relaxation ladder.
//
// Regression cover for a real report: a user searched "james perse mens white
// button down" and got nothing usable. `name LIKE` is AND across every term,
// and no merchant writes "mens" in that title — so all six words together match
// zero rows while five of them match five actual James Perse shirts.
// ---------------------------------------------------------------------------

/** Captures the `name LIKE` term of every query the provider sends. */
function fetchSpy(productsPerAttempt: number[]) {
  const queries: string[] = [];
  let attempt = 0;
  const original = globalThis.fetch;

  globalThis.fetch = (async (_url: string, init: { body: string }) => {
    const body = JSON.parse(init.body) as { query: string[] };
    const like = body.query.find((q) => q.startsWith('name LIKE '));
    queries.push(like ? like.slice('name LIKE '.length) : '');
    const count = productsPerAttempt[attempt++] ?? 0;
    return {
      ok: true,
      json: () =>
        Promise.resolve({
          products: Array.from({ length: count }, (_, i) => ({
            id: i,
            name: 'James Perse button-down cotton shirt',
            merchant: 'Farfetch',
            merchant_id: 1,
            source: 'Rakuten US',
            source_id: 4,
            currency: 'USD',
            price: 19500,
            finalprice: 19500,
            url: 'https://click.linksynergy.com/deeplink?id=@@@&mid=1&murl=x',
            direct_url: `https://www.farfetch.com/shopping/item-${i}.aspx`,
            image: `https://cdn-images.farfetch-contents.com/${i}.jpg`,
          })),
        }),
    };
  }) as unknown as typeof fetch;

  return { queries, restore: () => { globalThis.fetch = original; } };
}

function relaxing(spy: Spy) {
  return datafeedrProvider({
    accessId: 'test-id',
    accessKey: 'test-key',
    affiliateIds: {},
    claimRequest: (exact) => { spy.claims.push(exact); return Promise.resolve(true); },
    cacheGet: (key) => { spy.reads.push(key); return Promise.resolve(undefined); },
    cachePut: (key, mode, terms, products, ttl) => {
      spy.writes.push({ key, mode, terms, products, ttl });
      return Promise.resolve();
    },
  });
}

test('a query that matches nothing is retried without the words merchants omit', async () => {
  const net = fetchSpy([0, 5]); // first rung empty, second rung finds five
  const s = spy();
  try {
    await relaxing(s).search({
      description: 'james perse mens white button down',
      maxCandidates: 6,
    });

    assert.deepEqual(net.queries, [
      'james perse mens white button down',
      'james perse white button down',
    ], 'the second attempt drops "mens", which is the word that matched nothing');

    // Asserted on what the provider FOUND rather than on what it returned:
    // `admitRows` runs the real `admitSource`, which fetches robots.txt, and
    // this test's stub owns global fetch. Whether those five rows are then
    // admitted is the source policy's business and is measured live, not here.
    assert.equal(s.writes.length, 1, 'one cache write, under the original phrasing');
    assert.equal(
      s.writes[0]?.products?.length,
      5,
      'five James Perse shirts found where the unrelaxed query found none',
    );
  } finally {
    net.restore();
  }
});

test('a query that works first time costs exactly one request', async () => {
  const net = fetchSpy([5]);
  const s = spy();
  try {
    await relaxing(s).search({ description: 'black wool overcoat', maxCandidates: 6 });
    assert.equal(net.queries.length, 1, 'relaxing is for failures, not a default second call');
    assert.equal(s.claims.length, 1);
  } finally {
    net.restore();
  }
});

test('the ladder is bounded, and a genuine miss is still cached as one', async () => {
  const net = fetchSpy([0, 0, 0, 0, 0]);
  const s = spy();
  try {
    await relaxing(s).search({
      description: 'my nan hand knitted cardigan from 1974',
      maxCandidates: 6,
    });
    assert.ok(net.queries.length <= 3, `at most three metered requests, sent ${net.queries.length}`);
    assert.equal(s.writes.length, 1, 'one cache write');
    assert.equal(s.writes[0]?.products, null, 'and it records a miss, not an empty hit');
  } finally {
    net.restore();
  }
});

test('the ladder never degrades to a single useless term', async () => {
  const net = fetchSpy([0, 0, 0, 0]);
  const s = spy();
  try {
    await relaxing(s).search({ description: 'mens white shirt', maxCandidates: 6 });
    for (const q of net.queries) {
      assert.ok(
        q.split(' ').length >= 2,
        `"${q}" is one term — a one-word query is a different question, not a looser one`,
      );
    }
  } finally {
    net.restore();
  }
});

// ---------------------------------------------------------------------------
// What the cache is allowed to remember.
//
// `catalog_lookups` is keyed globally and attributed to nobody, which is what
// makes one paid request answer a question for everybody who asks it again.
// That is also exactly why the row must not hold free text: an unattributed
// table is not an anonymous one when the sentence inside it is "my late nan's
// cardigan". People describe clothes by what happened in them.
// ---------------------------------------------------------------------------

test('only vocabulary words survive into the stored terms', () => {
  assert.deepEqual(
    retainableTerms('black wool coat'),
    ['black', 'coat', 'wool'],
    'garment nouns, colours and materials are kept',
  );
});

test('names, places and occasions are dropped', () => {
  const terms = retainableTerms("my late nan's cardigan from Sarah's wedding in Lisbon");
  assert.deepEqual(terms, ['cardigan']);
  for (const leaked of ['nan', 'sarah', 'wedding', 'lisbon', 'late', 'my']) {
    assert.ok(!terms.includes(leaked), `"${leaked}" must not reach the database`);
  }
});

test('the stored terms are a set, so the phrase cannot be rebuilt from them', () => {
  // Sorting is the load-bearing part: it destroys word order, so two different
  // sentences made of the same vocabulary are indistinguishable in the row.
  assert.deepEqual(
    retainableTerms('black wool coat'),
    retainableTerms('coat, wool — black'),
    'word order is not recoverable',
  );
  assert.deepEqual(retainableTerms('coat coat coat wool'), ['coat', 'wool'], 'and repetition is not counted');
});

test('a description made only of unknown words stores nothing at all', () => {
  assert.deepEqual(
    retainableTerms('the thing Gran gave me in Perth'),
    [],
    'an empty array is a correct answer — the cache is keyed on the hash, not on this',
  );
});

test('the retained terms are bounded', () => {
  const many = retainableTerms(
    'black white grey navy blue red green brown beige cream ivory tan camel olive khaki wool cotton linen silk coat',
  );
  assert.ok(many.length <= 12, `stored ${many.length} terms; the column caps at 12`);
});

test('the cache write receives sanitised terms, never the description', async () => {
  const net = fetchSpy([5]);
  const s = spy();
  try {
    await relaxing(s).search({
      description: "my late nan's black wool coat",
      maxCandidates: 6,
    });
    const written = s.writes[0];
    assert.deepEqual(written?.terms, ['black', 'coat', 'wool']);
    assert.ok(
      !JSON.stringify(written?.terms).toLowerCase().includes('nan'),
      'the provider must not hand the database anything personal',
    );
  } finally {
    net.restore();
  }
});
