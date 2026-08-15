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

import { parseVenueMeta } from '@/features/events/types';

const mutations = readFileSync('src/features/events/mutations.ts', 'utf8');

test('the serializer no longer hard-codes a vendor name', () => {
  // The precise failure being prevented: a MapKit-resolved occasion stamped
  // `open-meteo`. A literal here is that bug, whichever vendor it names.
  assert.equal(
    /source:\s*'(open-meteo|mapkit)'\s*,?\s*\n?\s*}/.test(mutations),
    false,
    'venueMetaJson writes a literal source; it must write the resolver the coordinate carries',
  );
  assert.match(mutations, /source:\s*coords\.source\s*\?\?\s*'open-meteo'/);
});

test('an unstamped coordinate still reads as the gazetteer', () => {
  // Every row written before this field existed came from the one resolver
  // that predates it, so the fallback is a statement about history, not a
  // guess. If this ever needs to change, the rows themselves changed.
  assert.match(mutations, /'open-meteo'/);
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

test('provenance never rescues an unusable coordinate', () => {
  // A stamped source must not make a bad pair look resolvable — the weather
  // rule is printed or dropped, never estimated.
  assert.equal(parseVenueMeta({ latitude: 'x', longitude: -104.9, source: 'mapkit' }), null);
  assert.equal(parseVenueMeta({ latitude: 91, longitude: -104.9, source: 'mapkit' }), null);
  assert.equal(parseVenueMeta({ source: 'mapkit' }), null);
});
