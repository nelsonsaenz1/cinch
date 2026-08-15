/**
 * The nearby-venue suggestion machine (LP-05).
 *
 * Swift does not run in this runner, so nothing below executes MapKit. What IS
 * testable here is everything that decides what to do with MapKit's answer —
 * which reply wins when two land out of order, which rows survive a dedupe,
 * what the panel offers when there is no answer at all — and that is the half
 * most likely to be quietly wrong, because it is the half full of decisions
 * somebody made.
 *
 * The load-bearing invariant, stated once: **the as-typed row is always there,
 * and no failure of any kind reaches for the Open-Meteo gazetteer.** Manual
 * entry is the designed answer, not the consolation prize.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  dedupeVenues,
  searchVenues,
  setVenueSearchProvider,
  venuePanelOpen,
  venueQueryInitial,
  venueQueryReduce,
  venueRows,
  venueSearchAvailable,
  venueSelection,
  venueStatusLine,
  toVenueSnapshot,
  VENUE_RESULT_CAP,
  type VenueQueryState,
  type VenueSuggestion,
} from '../src/features/events/venue-search.ts';

function venue(over: Partial<VenueSuggestion> = {}): VenueSuggestion {
  return {
    id: null,
    name: 'The Stanley',
    locality: 'Denver, CO',
    latitude: 39.74,
    longitude: -104.99,
    category: 'MKPOICategoryRestaurant',
    ...over,
  };
}

/** The reducer from empty to "two characters typed", which is the only state
 *  in which anything at all is on screen. */
function typed(text: string): VenueQueryState {
  return venueQueryReduce(venueQueryInitial(), { type: 'query', text });
}

// ---------------------------------------------------------------------------
// 1 · Latest request wins
// ---------------------------------------------------------------------------

test('a reply for an older query is dropped, not rendered', () => {
  const first = typed('stan');
  const second = venueQueryReduce(first, { type: 'query', text: 'stanley' });

  const stale = venueQueryReduce(second, {
    type: 'result',
    requestId: first.requestId,
    outcome: { ok: true, venues: [venue({ name: 'Stan’s Diner' })] },
  });

  assert.deepEqual(stale.venues, []);
  assert.equal(stale.status, 'searching');
});

test('the reply for the current query lands', () => {
  const state = typed('stanley');
  const next = venueQueryReduce(state, {
    type: 'result',
    requestId: state.requestId,
    outcome: { ok: true, venues: [venue()] },
  });

  assert.equal(next.status, 'ready');
  assert.equal(next.venues.length, 1);
});

test('a stale FAILURE cannot degrade a newer query either', () => {
  const first = typed('st');
  const second = venueQueryReduce(first, { type: 'query', text: 'stan' });

  const next = venueQueryReduce(second, {
    type: 'result',
    requestId: first.requestId,
    outcome: { ok: false, venues: [], failure: 'offline' },
  });

  assert.equal(next.status, 'searching');
  assert.equal(next.failure, null);
});

test('a reply arriving after a row was tapped does not reopen the panel', () => {
  const state = typed('stanley');
  const settled = venueQueryReduce(state, { type: 'settled' });
  const next = venueQueryReduce(settled, {
    type: 'result',
    requestId: state.requestId,
    outcome: { ok: true, venues: [venue()] },
  });

  assert.equal(venuePanelOpen(next), false);
  assert.deepEqual(next.venues, []);
});

// ---------------------------------------------------------------------------
// 2 · Dedupe, order, cap
// ---------------------------------------------------------------------------

test('MapKit’s ranking is preserved exactly — never re-sorted', () => {
  const order = ['Zebra Bar', 'Alpha Cafe', 'Middle Room'];
  const out = dedupeVenues(order.map((name) => venue({ name })));
  assert.deepEqual(
    out.map((v) => v.name),
    order,
  );
});

test('the OS identifier is the identity when there is one', () => {
  const out = dedupeVenues([
    venue({ id: 'A', name: 'The Stanley' }),
    // Same place, different label on the second entrance.
    venue({ id: 'A', name: 'Stanley Marketplace' }),
    venue({ id: 'B', name: 'The Stanley' }),
  ]);
  assert.equal(out.length, 2);
  assert.deepEqual(
    out.map((v) => v.id),
    ['A', 'B'],
  );
});

test('without an identifier, name and locality fold together case-insensitively', () => {
  const out = dedupeVenues([
    venue({ name: 'The Stanley', locality: 'Denver, CO' }),
    venue({ name: 'the stanley ', locality: ' denver, CO' }),
    venue({ name: 'The Stanley', locality: 'Aurora, CO' }),
  ]);
  assert.equal(out.length, 2);
});

test('the cap is the cap, and dedupe runs before it', () => {
  const many = Array.from({ length: 20 }, (_, i) => venue({ id: `id-${i % 3}`, name: `V${i}` }));
  assert.equal(dedupeVenues(many).length, 3);

  const distinct = Array.from({ length: 20 }, (_, i) => venue({ id: `id-${i}` }));
  assert.equal(dedupeVenues(distinct).length, VENUE_RESULT_CAP);
});

test('a nameless result is not a suggestion', () => {
  assert.equal(dedupeVenues([venue({ name: '   ' }), venue({ name: 'Real' })]).length, 1);
});

test('the same input always produces the same rows in the same order', () => {
  const input = [venue({ id: 'b', name: 'B' }), venue({ id: 'a', name: 'A' }), venue({ id: 'b' })];
  assert.deepEqual(dedupeVenues(input), dedupeVenues(input));
});

// ---------------------------------------------------------------------------
// 3 · `Use as typed` is unconditional
// ---------------------------------------------------------------------------

const OUTCOMES = [
  { label: 'zero results', outcome: { ok: true as const, venues: [] } },
  { label: 'offline', outcome: { ok: false as const, venues: [] as [], failure: 'offline' as const } },
  { label: 'throttled', outcome: { ok: false as const, venues: [] as [], failure: 'throttled' as const } },
  { label: 'service error', outcome: { ok: false as const, venues: [] as [], failure: 'error' as const } },
  {
    label: 'module unavailable',
    outcome: { ok: false as const, venues: [] as [], failure: 'unavailable' as const },
  },
];

for (const { label, outcome } of OUTCOMES) {
  test(`the as-typed row survives ${label}`, () => {
    const state = typed('The Stanley');
    const next = venueQueryReduce(state, { type: 'result', requestId: state.requestId, outcome });

    const rows = venueRows(next);
    assert.equal(rows.length >= 1, true);
    const last = rows[rows.length - 1]!;
    assert.equal(last.kind, 'typed');
    assert.equal(last.kind === 'typed' && last.text, 'The Stanley');
  });

  test(`${label} stays manual-first — the panel is open and nothing else is offered`, () => {
    const state = typed('The Stanley');
    const next = venueQueryReduce(state, { type: 'result', requestId: state.requestId, outcome });
    assert.equal(venuePanelOpen(next), true);
    assert.equal(venueRows(next).filter((r) => r.kind === 'venue').length, 0);
  });
}

test('the as-typed row is last even when there are results', () => {
  const state = typed('stanley');
  const next = venueQueryReduce(state, {
    type: 'result',
    requestId: state.requestId,
    outcome: { ok: true, venues: [venue({ id: 'a' }), venue({ id: 'b', name: 'Stanley Bar' })] },
  });

  const rows = venueRows(next);
  assert.equal(rows.length, 3);
  assert.equal(rows[2]!.kind, 'typed');
});

test('a query below the minimum shows no panel at all', () => {
  assert.equal(venuePanelOpen(typed('t')), false);
  assert.deepEqual(venueRows(typed('t')), []);
});

// ---------------------------------------------------------------------------
// 4 · One quiet line per state, and never a second source
// ---------------------------------------------------------------------------

test('every reachable state has at most one line, and it is never a retry', () => {
  const base = typed('stanley');
  const line = (outcome: Parameters<typeof venueQueryReduce>[1] extends never ? never : any) =>
    venueStatusLine(venueQueryReduce(base, { type: 'result', requestId: base.requestId, outcome }));

  assert.equal(venueStatusLine(base), 'Looking nearby…');
  assert.equal(line({ ok: true, venues: [] }), 'No nearby matches — use what you typed.');
  assert.equal(line({ ok: true, venues: [venue()] }), null);
  assert.equal(line({ ok: false, venues: [], failure: 'offline' }), 'Offline — use what you typed.');
  assert.equal(
    line({ ok: false, venues: [], failure: 'error' }),
    'Nearby search is unavailable — use what you typed.',
  );
  // The module being absent is not an apology: no venue affordance was ever
  // offered on that runtime, so there is nothing to explain.
  assert.equal(line({ ok: false, venues: [], failure: 'unavailable' }), null);
});

test('with no native provider the seam reports unavailable rather than reaching elsewhere', async () => {
  setVenueSearchProvider(null);
  assert.equal(venueSearchAvailable(), false);

  const outcome = await searchVenues('the stanley');
  assert.deepEqual(outcome, { ok: false, venues: [], failure: 'unavailable' });
});

test('a native rejection is a service error, not a thrown search', async () => {
  setVenueSearchProvider(() => Promise.reject(new Error('bridge fell over')));
  const outcome = await searchVenues('the stanley');
  assert.deepEqual(outcome, { ok: false, venues: [], failure: 'error' });
  setVenueSearchProvider(null);
});

test('a query below the minimum never reaches the native module', async () => {
  let calls = 0;
  setVenueSearchProvider(() => {
    calls += 1;
    return Promise.resolve({ ok: true as const, venues: [], reason: null });
  });

  assert.deepEqual(await searchVenues('t'), { ok: true, venues: [] });
  assert.equal(calls, 0);
  setVenueSearchProvider(null);
});

// ---------------------------------------------------------------------------
// 5 · The adapter
// ---------------------------------------------------------------------------

test('a chosen suggestion becomes a resolved selection with its coordinates', () => {
  assert.deepEqual(venueSelection(venue({ name: '  The Stanley  ' })), {
    kind: 'resolved',
    name: 'The Stanley',
    address: 'Denver, CO',
    latitude: 39.74,
    longitude: -104.99,
  });
});

test('a suggestion with no address line still resolves — the row just has one line', () => {
  assert.equal(venueSelection(venue({ locality: null })).address, '');
});

test('the stored snapshot keeps the venue-snapshot shape, coordinates included', () => {
  const snapshot = toVenueSnapshot(venue({ id: 'mapkit-1' }));
  assert.equal(snapshot.name, 'The Stanley');
  assert.equal(snapshot.address, 'Denver, CO');
  assert.deepEqual(snapshot.meta, {
    latitude: 39.74,
    longitude: -104.99,
    mapkitId: 'mapkit-1',
    category: 'MKPOICategoryRestaurant',
  });
});
