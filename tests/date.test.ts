/**
 * Local plain-date keys.
 *
 * This is the bug class that only appears for users who are not in UTC, which
 * is most of them: `toISOString().slice(0, 10)` silently returns *yesterday* in
 * Honolulu for most of the evening, and *tomorrow* in Auckland for most of the
 * morning. The calendar, the "worn today" mutation and the plan tab all key on
 * this string, so an off-by-one here files an outfit under the wrong day.
 *
 * The contract under test is `dateKey(d: Date): string` returning the LOCAL
 * calendar date as `YYYY-MM-DD`. These assertions were written against that
 * contract before `src/lib/date.ts` existed, which is the only way to get a
 * test that describes the requirement rather than the implementation.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dateKey } from '../src/lib/date';

/** Run `fn` with the process in `tz`, restoring the previous zone afterwards. */
function inZone(tz: string, fn: () => void) {
  const previous = process.env.TZ;
  process.env.TZ = tz;
  try {
    fn();
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

test('always returns a zero-padded YYYY-MM-DD', () => {
  for (const tz of ['Pacific/Honolulu', 'UTC', 'Pacific/Auckland']) {
    inZone(tz, () => {
      for (const iso of ['2026-01-02T03:04:05Z', '2026-08-04T23:59:59Z', '2026-12-31T00:00:00Z']) {
        const key = dateKey(new Date(iso));
        assert.match(key, ISO_DATE, `${tz} / ${iso} => ${key}`);
      }
    });
  }
});

test('uses the local calendar date, not the UTC one, at UTC-10', () => {
  inZone('Pacific/Honolulu', () => {
    // 05:00Z on the 5th is still 19:00 on the 4th in Honolulu.
    assert.equal(dateKey(new Date('2026-08-05T05:00:00Z')), '2026-08-04');
    // Local midnight exactly.
    assert.equal(dateKey(new Date('2026-08-05T10:00:00Z')), '2026-08-05');
    // One millisecond before local midnight.
    assert.equal(dateKey(new Date('2026-08-05T09:59:59.999Z')), '2026-08-04');
  });
});

test('uses the local calendar date, not the UTC one, at UTC+12', () => {
  inZone('Pacific/Auckland', () => {
    // 20:00Z on the 4th is already 08:00 on the 5th in Auckland (NZST, UTC+12).
    assert.equal(dateKey(new Date('2026-08-04T20:00:00Z')), '2026-08-05');
    assert.equal(dateKey(new Date('2026-08-04T11:59:59Z')), '2026-08-04');
    assert.equal(dateKey(new Date('2026-08-04T12:00:00Z')), '2026-08-05');
  });
});

test('agrees with the UTC date when the process is in UTC', () => {
  inZone('UTC', () => {
    for (const iso of ['2026-08-04T00:00:00Z', '2026-08-04T23:59:59Z', '2026-02-28T12:00:00Z']) {
      assert.equal(dateKey(new Date(iso)), iso.slice(0, 10));
    }
  });
});

test('survives a spring-forward DST boundary', () => {
  // US DST 2026 begins 08 March, when 02:00 local becomes 03:00 local
  // (07:00Z). The day itself is only 23 hours long.
  inZone('America/New_York', () => {
    assert.equal(dateKey(new Date('2026-03-08T04:59:00Z')), '2026-03-07'); // 23:59 EST
    assert.equal(dateKey(new Date('2026-03-08T05:00:00Z')), '2026-03-08'); // 00:00 EST
    assert.equal(dateKey(new Date('2026-03-08T06:59:00Z')), '2026-03-08'); // 01:59 EST
    assert.equal(dateKey(new Date('2026-03-08T07:00:00Z')), '2026-03-08'); // 03:00 EDT
    assert.equal(dateKey(new Date('2026-03-09T03:59:00Z')), '2026-03-08'); // 23:59 EDT
    assert.equal(dateKey(new Date('2026-03-09T04:00:00Z')), '2026-03-09'); // 00:00 EDT
  });
});

test('survives a fall-back DST boundary, where a local hour repeats', () => {
  // US DST 2026 ends 01 November: 02:00 EDT becomes 01:00 EST, so 01:30 local
  // happens twice. Both instants are still the 1st.
  inZone('America/New_York', () => {
    assert.equal(dateKey(new Date('2026-11-01T05:30:00Z')), '2026-11-01'); // 01:30 EDT
    assert.equal(dateKey(new Date('2026-11-01T06:30:00Z')), '2026-11-01'); // 01:30 EST
    assert.equal(dateKey(new Date('2026-11-02T04:59:00Z')), '2026-11-01'); // 23:59 EST
    assert.equal(dateKey(new Date('2026-11-02T05:00:00Z')), '2026-11-02'); // 00:00 EST
  });
});

test('the same instant keys to three different days in three zones', () => {
  const instant = new Date('2026-08-05T09:00:00Z');
  const keys: string[] = [];
  for (const tz of ['Pacific/Honolulu', 'UTC', 'Pacific/Auckland']) {
    inZone(tz, () => keys.push(dateKey(instant)));
  }
  assert.deepEqual(keys, ['2026-08-04', '2026-08-05', '2026-08-05']);
});

test('handles month and year rollovers in the local zone', () => {
  inZone('Pacific/Auckland', () => {
    // 12:00Z on 31 December is already the 1st of January locally.
    assert.equal(dateKey(new Date('2026-12-31T12:00:00Z')), '2027-01-01');
  });
  inZone('Pacific/Honolulu', () => {
    // 05:00Z on 1 January is still 31 December locally.
    assert.equal(dateKey(new Date('2027-01-01T05:00:00Z')), '2026-12-31');
  });
});

test('is stable — the same Date always produces the same key', () => {
  inZone('Europe/London', () => {
    const d = new Date('2026-06-15T22:30:00Z');
    assert.equal(dateKey(d), dateKey(d));
    assert.equal(dateKey(d), '2026-06-15'); // BST, UTC+1 => 23:30 local
  });
});
