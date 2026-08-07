/**
 * The Lately page's clock.
 *
 * The contract under test: `sinceLabel` and `dayLabel` must agree about what
 * "yesterday" means, because both render on the same screen — the heading over
 * a group and the elapsed mark inside its rows. The failure class is the
 * elapsed-hours bucket: a piece added at 22:00 and read the next morning is
 * eleven *elapsed* hours old but sits under a YESTERDAY heading, and an
 * elapsed "1d" can be two calendar days old. So the day tiers are calendar
 * days, computed from local midnights, and minutes/hours survive only for
 * entries whose calendar day is today.
 *
 * `now` is injected throughout — these boundaries are exactly the ones that
 * cannot be tested by waiting for midnight.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dayLabel, sinceLabel } from '../src/features/explore/timeline';

/** A local-time instant, so the calendar math under test matches the zone the test runs in. */
function at(y: number, m: number, d: number, h = 0, min = 0): Date {
  return new Date(y, m, d, h, min);
}

const iso = (d: Date) => d.toISOString();

test('same-day entries keep the clock labels', () => {
  const now = at(2026, 7, 7, 14, 0);
  assert.equal(sinceLabel(iso(at(2026, 7, 7, 13, 59)), now), '1 min ago');
  assert.equal(sinceLabel(iso(at(2026, 7, 7, 13, 48)), now), '12 min ago');
  assert.equal(sinceLabel(iso(at(2026, 7, 7, 9, 0)), now), '5h ago');
  // Seconds old — not yet a minute.
  assert.equal(sinceLabel(iso(new Date(now.getTime() - 30_000)), now), 'Just now');
});

test('calendar yesterday says Yesterday even under 24 elapsed hours', () => {
  // Added 22:00, read 09:00 the next morning — 11 elapsed hours, but the
  // heading over this row already reads Yesterday.
  const now = at(2026, 7, 7, 9, 0);
  assert.equal(sinceLabel(iso(at(2026, 7, 6, 22, 0)), now), 'Yesterday');
});

test('two calendar days is 2d ago even at 25 elapsed hours', () => {
  // 23:30 two nights back, read just after midnight — barely a day on the
  // clock, two leaves back on the calendar.
  const now = at(2026, 7, 7, 0, 30);
  assert.equal(sinceLabel(iso(at(2026, 7, 5, 23, 30)), now), '2d ago');
});

test('midnight is the boundary in both directions', () => {
  // Ten minutes across midnight: already Yesterday, never "10 min ago".
  assert.equal(
    sinceLabel(iso(at(2026, 7, 6, 23, 55)), at(2026, 7, 7, 0, 5)),
    'Yesterday',
  );
  // Nearly 24 hours inside one day: still an hours label.
  assert.equal(
    sinceLabel(iso(at(2026, 7, 7, 0, 5)), at(2026, 7, 7, 23, 55)),
    '23h ago',
  );
});

test('2–6 calendar days count, 7 becomes a date', () => {
  const now = at(2026, 7, 7, 12, 0);
  assert.equal(sinceLabel(iso(at(2026, 7, 4, 12, 0)), now), '3d ago');
  assert.equal(sinceLabel(iso(at(2026, 7, 1, 23, 0)), now), '6d ago');

  const dated = sinceLabel(iso(at(2026, 6, 31, 12, 0)), now);
  assert.match(dated, /Jul/, `expected a dated label, got "${dated}"`);
  assert.match(dated, /31/, `expected a dated label, got "${dated}"`);
});

test('sinceLabel never contradicts the heading over it', () => {
  // The bug class this file exists for: wherever the heading says Yesterday,
  // the elapsed mark must too — and only there.
  const now = at(2026, 7, 7, 9, 0);
  const samples = [
    at(2026, 7, 7, 8, 0),
    at(2026, 7, 6, 23, 59),
    at(2026, 7, 6, 0, 1),
    at(2026, 7, 5, 23, 59),
    at(2026, 7, 3, 12, 0),
  ];
  for (const sample of samples) {
    const heading = dayLabel(iso(sample), now);
    const mark = sinceLabel(iso(sample), now);
    assert.equal(
      mark === 'Yesterday',
      heading === 'Yesterday',
      `${iso(sample)}: heading "${heading}" vs mark "${mark}"`,
    );
  }
});

test('an unparseable timestamp renders as nothing, not NaN', () => {
  assert.equal(sinceLabel('not-a-date'), '');
  assert.equal(dayLabel('not-a-date'), '');
});
