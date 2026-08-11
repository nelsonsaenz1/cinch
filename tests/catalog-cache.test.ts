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
  writes: Array<{ key: string; mode: LookupMode; products: CatalogProduct[] | null; ttl: number }>;
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
    cachePut: (key, mode, _query, products, ttl) => {
      spy.writes.push({ key, mode, products, ttl });
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

test('the licensed provider answers before the web fallback', async () => {
  const chain = firstLicensed([stub('licensed', 3)], stub('web', 3), true);
  const result = await chain.search({ description: 'anything', maxCandidates: 6 });

  assert.equal(result.candidates[0]?.title, 'licensed 0');
});

test('the web fallback answers only what the licensed source could not', async () => {
  const chain = firstLicensed([stub('licensed', 0)], stub('web', 3), true);
  const result = await chain.search({ description: 'anything', maxCandidates: 6 });

  assert.equal(result.candidates.length, 3);
  assert.equal(result.candidates[0]?.title, 'web 0');
});

test('the kill switch removes the unlicensed provider from the chain entirely', async () => {
  const chain = firstLicensed([stub('licensed', 0)], stub('web', 3), false);

  assert.equal(chain.id, 'licensed', 'the web provider is not merely skipped, it is absent');

  const result = await chain.search({ description: 'anything', maxCandidates: 6 });
  assert.deepEqual(
    result.candidates,
    [],
    'with the switch off, no licensed answer means no answer — never an unlicensed one',
  );
});
