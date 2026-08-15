/**
 * `venue_meta` records which resolver found the place, and now tells the truth.
 *
 * The column has always carried a `source` key, but it was a LITERAL in
 * `venueMetaJson` — every write claimed `open-meteo`. That was accurate while
 * the gazetteer was the only resolver. The launch-polish packet added
 * MKLocalSearch, which writes the same shape, so the literal stopped being a
 * fact about the row and became a fact about the code that wrote it.
 *
 * Nothing READS the key: `parseVenueMeta` validates the two numbers and drops
 * everything else, which is why the mistake was invisible and why correcting
 * it needs no migration. That is exactly the reason to pin it here — a field
 * no reader checks is a field that silently rots, and the only thing standing
 * between this column and a second wrong vendor name is a test.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parseVenueMeta, venueMetaJson } from '@/features/events/types';
import {
  emptyResolvedVenueMeta,
  resolvedVenueMetaFor,
  venueMetaForColumn,
  venueSelection,
  venueWriteFor,
} from '@/features/events/venue-search';

const mutations = readFileSync('src/features/events/mutations.ts', 'utf8');

test('the serializer writes the resolver the coordinate carries', () => {
  // The precise failure being prevented: a MapKit-resolved occasion stamped
  // `open-meteo`. Called, not read as text — `venueMetaJson` is the exact
  // function `useCreateEvent` hands `venue_meta` to.
  assert.equal(
    venueMetaJson({ latitude: 39.74, longitude: -104.99, source: 'mapkit' })?.source,
    'mapkit',
  );
  assert.equal(
    venueMetaJson({ latitude: 39.74, longitude: -104.99, source: 'open-meteo' })?.source,
    'open-meteo',
  );
});

test('an unstamped coordinate still reads as the gazetteer', () => {
  // Every row written before this field existed came from the one resolver
  // that predates it, so the fallback is a statement about history, not a
  // guess. If this ever needs to change, the rows themselves changed.
  assert.equal(venueMetaJson({ latitude: 39.74, longitude: -104.99 })?.source, 'open-meteo');
});

test('the create-event handoff stamps a MapKit pick as mapkit, end to end', () => {
  // The whole write path a host walks: a row tapped in the MapKit panel, the
  // form's resolved record, the blob the form hands `useCreateEvent`, and the
  // object that blob becomes in the `venue_meta` column. The defect this pins
  // lived in the middle link — the column helper dropped the resolver, so the
  // serializer's history fallback filed a MapKit venue under Open-Meteo.
  const selection = venueSelection({
    id: 'I1234ABCD',
    name: 'The Stanley',
    locality: 'Denver, CO',
    latitude: 39.74,
    longitude: -104.99,
    category: 'MKPOICategoryRestaurant',
  });
  const forColumn = venueMetaForColumn(resolvedVenueMetaFor(selection));

  assert.deepEqual(venueMetaJson(forColumn), {
    latitude: 39.74,
    longitude: -104.99,
    source: 'mapkit',
    category: 'MKPOICategoryRestaurant',
    placeId: 'I1234ABCD',
  });
});

test('a MapKit pick with no category and no identifier is still MapKit', () => {
  // An address result, or a POI on iOS 17 — the two breadcrumbs are absent, so
  // by shape alone it is indistinguishable from a gazetteer pick. Provenance is
  // carried, never re-derived, and this is the case that proves the difference.
  const selection = venueSelection({
    id: null,
    name: 'Larimer Square',
    locality: null,
    latitude: 39.74,
    longitude: -104.99,
    category: null,
  });

  assert.deepEqual(venueMetaJson(venueMetaForColumn(resolvedVenueMetaFor(selection))), {
    latitude: 39.74,
    longitude: -104.99,
    source: 'mapkit',
  });
});

test('a typed venue writes no blob, and so claims no resolver', () => {
  // Manual entry stays first-class. `Use "…" as typed`, and a keystroke after
  // any pick, both reach the same empty record — no coordinates, therefore no
  // `venue_meta` at all, therefore nothing to be wrong about.
  assert.equal(venueMetaForColumn(resolvedVenueMetaFor({ kind: 'typed' })), null);
  assert.equal(venueMetaJson(venueMetaForColumn(resolvedVenueMetaFor({ kind: 'typed' }))), null);
  assert.equal(venueMetaJson(venueMetaForColumn(emptyResolvedVenueMeta())), null);
});

// ---------------------------------------------------------------------------
// The repair path — N-10's "Add a place", after the occasion exists
// ---------------------------------------------------------------------------
//
// The detail page's PlaceSheet writes a selection straight to `useUpdateEvent`,
// with no form state in between, and it used to build the patch by hand: two of
// the five resolved fields reached the column and the resolver was not one of
// them. So the SAME venue was honest when picked during creation and false when
// picked an hour later. `venueWriteFor` is the one adapter both go through, and
// these pin that the two paths produce the same row.

test('repairing a place writes the resolver, the category and the identifier', () => {
  const picked = venueSelection({
    id: 'I1234ABCD',
    name: 'The Stanley',
    locality: 'Denver, CO',
    latitude: 39.74,
    longitude: -104.99,
    category: 'MKPOICategoryRestaurant',
  });
  const patch = venueWriteFor(picked);

  assert.equal(patch.venueName, 'The Stanley');
  assert.equal(patch.venueAddress, 'Denver, CO');
  assert.deepEqual(venueMetaJson(patch.venueMeta), {
    latitude: 39.74,
    longitude: -104.99,
    source: 'mapkit',
    category: 'MKPOICategoryRestaurant',
    placeId: 'I1234ABCD',
  });
});

test('creating and repairing the same pick write the identical blob', () => {
  // The contract, stated as the equality it is. If these ever diverge, one of
  // the two screens has started deciding for itself again.
  const picked = venueSelection({
    id: 'I1234ABCD',
    name: 'The Stanley',
    locality: 'Denver, CO',
    latitude: 39.74,
    longitude: -104.99,
    category: 'MKPOICategoryRestaurant',
  });

  const atCreation = venueMetaJson(venueMetaForColumn(resolvedVenueMetaFor(picked)));
  const atRepair = venueMetaJson(venueWriteFor(picked).venueMeta);
  assert.deepEqual(atRepair, atCreation);
});

test('repairing with a typed answer clears the address and writes no blob', () => {
  // Manual entry stays first-class on this path too: the name is kept verbatim,
  // and the two fields it cannot fill are cleared rather than left holding
  // whatever the occasion carried before.
  const patch = venueWriteFor({ kind: 'typed', name: 'Priya’s flat' });

  assert.equal(patch.venueName, 'Priya’s flat');
  assert.equal(patch.venueAddress, null);
  assert.equal(patch.venueMeta, null);
  assert.equal(venueMetaJson(patch.venueMeta), null);
});

test('the repair path stores no venue URL either', () => {
  // A resolved selection carries a URL slot so LP-05's clearing rule has all
  // five fields; nothing on the way to the column may keep it.
  const patch = venueWriteFor({
    kind: 'resolved',
    name: 'The Stanley',
    address: 'Denver, CO',
    latitude: 39.74,
    longitude: -104.99,
    source: 'mapkit',
    category: null,
    url: 'https://example.com',
    placeId: null,
  });

  assert.deepEqual(venueMetaJson(patch.venueMeta), {
    latitude: 39.74,
    longitude: -104.99,
    source: 'mapkit',
  });
  assert.equal('url' in (patch as object), false);
});

test('the detail screen does not build a venue patch of its own', () => {
  // A supplement to the behaviour above, not a substitute for it: the tests
  // that matter call the adapter, and this one only says the screen still
  // reaches for it. A hand-built `venueMeta` here is the exact regression.
  const detail = readFileSync('src/app/event/[id]/index.tsx', 'utf8');
  assert.match(detail, /patch: venueWriteFor\(selection\)/);
  assert.doesNotMatch(detail, /venueMeta: \{/);
});

test('a repaired gazetteer pick is still the gazetteer', () => {
  const patch = venueWriteFor({
    kind: 'resolved',
    name: 'Denver',
    address: 'Colorado, United States',
    latitude: 39.74,
    longitude: -104.99,
    source: 'open-meteo',
    category: null,
    url: null,
    placeId: null,
  });

  assert.deepEqual(venueMetaJson(patch.venueMeta), {
    latitude: 39.74,
    longitude: -104.99,
    source: 'open-meteo',
  });
});

test('the gazetteer pick is stamped as the gazetteer, not as MapKit', () => {
  // The runtime with no native module, which is still a shipping path. The fix
  // for the MapKit defect must not simply move the wrong name to this row.
  const forColumn = venueMetaForColumn(
    resolvedVenueMetaFor({
      kind: 'resolved',
      address: 'Colorado, United States',
      latitude: 39.74,
      longitude: -104.99,
      source: 'open-meteo',
      category: null,
      url: null,
      placeId: null,
    }),
  );

  assert.deepEqual(venueMetaJson(forColumn), {
    latitude: 39.74,
    longitude: -104.99,
    source: 'open-meteo',
  });
});

test('parseVenueMeta drops provenance on the way back in', () => {
  // Write-only by design: no reader branches on it, so no reader can be
  // broken by it, and `VenueCoords.source` stays optional for callers.
  for (const source of ['open-meteo', 'mapkit', 'something-nobody-shipped']) {
    assert.deepEqual(parseVenueMeta({ latitude: 39.7, longitude: -104.9, source }), {
      latitude: 39.7,
      longitude: -104.9,
    });
  }
});

// ---------------------------------------------------------------------------
// The two optional MapKit breadcrumbs, in the same jsonb bag
// ---------------------------------------------------------------------------
//
// A MapKit pick knows two things the three venue COLUMNS cannot hold: its
// point-of-interest category, and a stable `MKMapItem.identifier`. Columns for
// them would be a migration, so they ride in `venue_meta`, which already takes
// an arbitrary object. Nothing joins on the identifier and nothing branches on
// the category — they are a breadcrumb, and the tests below pin the three
// things that make keeping one safe: it round-trips, it is omitted rather than
// nulled when absent, and it never reaches an analytics payload.

test('a MapKit pick keeps its category and place identifier', () => {
  assert.deepEqual(
    parseVenueMeta({
      latitude: 39.74,
      longitude: -104.99,
      source: 'mapkit',
      category: 'MKPOICategoryRestaurant',
      placeId: 'I1234ABCD',
    }),
    {
      latitude: 39.74,
      longitude: -104.99,
      category: 'MKPOICategoryRestaurant',
      placeId: 'I1234ABCD',
    },
  );

  // The serializer writes them back under the same two names, and only when
  // there is something to write.
  assert.deepEqual(
    venueMetaJson({
      latitude: 39.74,
      longitude: -104.99,
      source: 'mapkit',
      category: 'MKPOICategoryRestaurant',
      placeId: 'I1234ABCD',
    }),
    {
      latitude: 39.74,
      longitude: -104.99,
      source: 'mapkit',
      category: 'MKPOICategoryRestaurant',
      placeId: 'I1234ABCD',
    },
  );

  const bare = venueMetaJson({ latitude: 39.74, longitude: -104.99, source: 'mapkit' });
  assert.equal('category' in (bare as object), false);
  assert.equal('placeId' in (bare as object), false);
});

test('a venue with neither reads exactly as it always did', () => {
  // The gazetteer path, and every row written before these keys existed. The
  // keys are OMITTED, not set to null: a screen that reads an occasion and
  // writes it back must not turn "never had a category" into "has a null one".
  const meta = parseVenueMeta({ latitude: 39.74, longitude: -104.99, source: 'open-meteo' });
  assert.deepEqual(meta, { latitude: 39.74, longitude: -104.99 });
  assert.equal('category' in (meta as object), false);
  assert.equal('placeId' in (meta as object), false);
});

test('a breadcrumb that is not a usable string is not kept', () => {
  for (const bad of [null, '', '   ', 42, {}, []]) {
    const meta = parseVenueMeta({
      latitude: 39.74,
      longitude: -104.99,
      category: bad,
      placeId: bad,
    });
    assert.deepEqual(meta, { latitude: 39.74, longitude: -104.99 }, `kept ${JSON.stringify(bad)}`);
  }
});

test('no venue URL is ever stored', () => {
  // LP-05 names the venue URL as one of the five things a keystroke must
  // CLEAR. It is not a sixth thing to persist — the native record has no such
  // field, and nothing on the write path may invent one.
  assert.doesNotMatch(mutations, /\burl\b/);
  const blob = venueMetaJson({ latitude: 39.74, longitude: -104.99, source: 'mapkit' });
  assert.equal('url' in (blob as object), false);
  const meta = parseVenueMeta({
    latitude: 39.74,
    longitude: -104.99,
    url: 'https://example.com',
  });
  assert.deepEqual(meta, { latitude: 39.74, longitude: -104.99 });
});

test('provenance never rescues an unusable coordinate', () => {
  // A stamped source must not make a bad pair look resolvable — the weather
  // rule is printed or dropped, never estimated.
  assert.equal(parseVenueMeta({ latitude: 'x', longitude: -104.9, source: 'mapkit' }), null);
  assert.equal(parseVenueMeta({ latitude: 91, longitude: -104.9, source: 'mapkit' }), null);
  assert.equal(parseVenueMeta({ source: 'mapkit' }), null);
});
