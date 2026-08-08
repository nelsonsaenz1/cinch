/**
 * The occasion row → domain crossing.
 *
 * Two things are under test, and both are trust boundaries rather than
 * formatting:
 *
 * `venue_meta` is a `jsonb` column. Postgres will hand back whatever was
 * written to it — a string, an array, a pair of numeric strings, a latitude of
 * 900 — and the value flows straight into a forecast request. Coordinates that
 * are merely *shaped* like coordinates would produce a confident "Feels 75°"
 * for a place that does not exist, which is the exact failure `weather.ts`
 * already refuses in its own docblock ("no invented temperature"). So the
 * parser is written to reject, not to coerce.
 *
 * `starts_at` became nullable when the New Occasion atlas made a name enough to
 * create an occasion (N-10, "No date yet"). Every screen that prints a date now
 * has a null to survive, and the mapper is the single place that decides a
 * missing date stays missing rather than becoming the epoch — `new Date(null)`
 * is 1 January 1970, a date the user never picked, printed as if they had.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseVenueMeta, toEvent, type EventWithMembersRow } from '../src/features/events/types';

/** A minimal joined row; each test overrides only the column it is about. */
function row(overrides: Partial<EventWithMembersRow> = {}): EventWithMembersRow {
  return {
    id: 'evt-1',
    host_id: 'user-1',
    title: "Priya & Tom's wedding",
    note: null,
    occasion: null,
    dress_code: null,
    starts_at: '2026-08-09T16:00:00.000Z',
    ends_at: null,
    party_size: null,
    visibility: 'invite_only',
    venue_name: null,
    venue_address: null,
    venue_meta: null,
    reservation_url: null,
    canceled_at: null,
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    event_members: [],
    ...overrides,
  } as EventWithMembersRow;
}

// ---------------------------------------------------------------------------
// venue_meta
// ---------------------------------------------------------------------------

test('a well-formed coordinate pair survives', () => {
  assert.deepEqual(parseVenueMeta({ latitude: 39.74, longitude: -104.99 }), {
    latitude: 39.74,
    longitude: -104.99,
  });
});

test('the extra keys the writer stamps on are dropped, not carried', () => {
  // The data layer writes `{ latitude, longitude, source: 'open-meteo' }`.
  // Only the two numbers are domain data; the provenance stamp stays on the
  // wire, so nothing downstream can start branching on it by accident.
  assert.deepEqual(parseVenueMeta({ latitude: 0, longitude: 0, source: 'open-meteo' }), {
    latitude: 0,
    longitude: 0,
  });
});

test('null island is a real place, not a falsy one', () => {
  // 0,0 is in the Gulf of Guinea. A truthiness check on the coordinates would
  // throw it away, and the bug would only ever show up there.
  assert.notEqual(parseVenueMeta({ latitude: 0, longitude: 0 }), null);
});

test('anything that is not an object is refused', () => {
  for (const raw of [null, undefined, 'Denver', 42, true, [39.74, -104.99]]) {
    assert.equal(parseVenueMeta(raw), null, `expected ${JSON.stringify(raw)} to be refused`);
  }
});

test('numeric strings are refused rather than coerced', () => {
  // `Number('39.74')` would "work", and every consumer would then be one
  // implicit conversion away from `NaN` on the first non-numeric string.
  assert.equal(parseVenueMeta({ latitude: '39.74', longitude: '-104.99' }), null);
});

test('a half-written pair is refused', () => {
  assert.equal(parseVenueMeta({ latitude: 39.74 }), null);
  assert.equal(parseVenueMeta({ longitude: -104.99 }), null);
});

test('non-finite coordinates are refused', () => {
  assert.equal(parseVenueMeta({ latitude: NaN, longitude: 0 }), null);
  assert.equal(parseVenueMeta({ latitude: 0, longitude: Infinity }), null);
});

test('coordinates outside the globe are refused', () => {
  assert.equal(parseVenueMeta({ latitude: 91, longitude: 0 }), null);
  assert.equal(parseVenueMeta({ latitude: -91, longitude: 0 }), null);
  assert.equal(parseVenueMeta({ latitude: 0, longitude: 181 }), null);
  assert.equal(parseVenueMeta({ latitude: 0, longitude: -181 }), null);
});

test('the poles and the antimeridian are inside the globe', () => {
  assert.notEqual(parseVenueMeta({ latitude: 90, longitude: 180 }), null);
  assert.notEqual(parseVenueMeta({ latitude: -90, longitude: -180 }), null);
});

// ---------------------------------------------------------------------------
// The mapper
// ---------------------------------------------------------------------------

test('a dated occasion keeps its instant', () => {
  const event = toEvent(row(), 'user-1');
  assert.equal(event.startsAt?.toISOString(), '2026-08-09T16:00:00.000Z');
});

test('an undated occasion stays undated — never the epoch', () => {
  const event = toEvent(row({ starts_at: null }), 'user-1');
  assert.equal(event.startsAt, null);
});

test('a bad venue_meta blob leaves the occasion without coordinates', () => {
  // The occasion itself must still map. A malformed blob costs the forecast,
  // not the event: the atlas's rule is that a place which does not resolve is
  // "kept verbatim and simply doesn't" carry weather.
  // The cast is the point: `EventVenueMetaRow` describes what we *write*, but
  // `venue_meta` is jsonb and the database will hand back whatever is in it.
  const event = toEvent(
    row({ venue_meta: 'nonsense' as unknown as EventWithMembersRow['venue_meta'], venue_name: 'The Stanley' }),
    'user-1',
  );
  assert.equal(event.venueName, 'The Stanley');
  assert.equal(event.venueMeta, null);
});

test('the host flag needs a signed-in caller, not just a matching id', () => {
  assert.equal(toEvent(row(), 'user-1').isHost, true);
  assert.equal(toEvent(row(), 'user-2').isHost, false);
  assert.equal(toEvent(row(), null).isHost, false);
});
