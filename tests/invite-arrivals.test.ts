/**
 * "Came in from your link" — the row narrowing and the two labels on it
 * (atlas 39, IV-01, as corrected by the contract §3.5).
 *
 * The interesting cases are all nullability: `invite_arrivals()` is a
 * `returns table`, which carries none, so the generated type promises four
 * non-null columns while three of them genuinely can be null on an ordinary
 * new account.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { arrivalName, arrivalSubtitle, firstNameOf, toArrival } from '@/features/invite/arrivals';

const NOW = new Date('2026-08-10T09:41:00Z');

test('a row without a user id is dropped, not rendered blank', () => {
  assert.equal(toArrival({ display_name: 'Maya', username: 'maya' }), null);
  assert.equal(toArrival({ user_id: '', display_name: 'Maya' }), null);
  assert.equal(toArrival({ user_id: 42 }), null);
});

test('nullable columns survive narrowing as nulls', () => {
  const row = toArrival({ user_id: 'u1', display_name: null, username: null, joined_at: null });
  assert.deepEqual(row, { userId: 'u1', displayName: null, username: null, joinedAt: null });
});

test('the name falls through to the handle, then to a person', () => {
  assert.equal(
    arrivalName({ userId: 'u', displayName: 'Maya Rahman', username: 'maya', joinedAt: null }),
    'Maya Rahman',
  );
  assert.equal(
    arrivalName({ userId: 'u', displayName: null, username: 'maya', joinedAt: null }),
    '@maya',
  );
  assert.equal(
    arrivalName({ userId: 'u', displayName: null, username: null, joinedAt: null }),
    'Someone new',
  );
});

test('the subtitle reads as prose, and is absent rather than guessed', () => {
  const at = (iso: string) => ({ userId: 'u', displayName: null, username: null, joinedAt: iso });

  assert.equal(arrivalSubtitle(at('2026-08-09T09:41:00Z'), NOW), 'Arrived yesterday');
  assert.equal(arrivalSubtitle(at('2026-08-07T09:41:00Z'), NOW), 'Arrived 3d ago');
  assert.equal(arrivalSubtitle(at('2026-08-10T09:40:30Z'), NOW), 'Arrived just now');

  // No timestamp is a real state — the name alone is a complete row.
  assert.equal(
    arrivalSubtitle({ userId: 'u', displayName: 'Maya', username: null, joinedAt: null }, NOW),
    null,
  );
  assert.equal(arrivalSubtitle(at('not a date'), NOW), null);
});

test('the inviter is addressed by first name, whatever the name is', () => {
  assert.equal(firstNameOf('Sophie Meyer'), 'Sophie');
  assert.equal(firstNameOf('  Sophie   Anne Meyer '), 'Sophie');
  assert.equal(firstNameOf('@sophie'), '@sophie');
  assert.equal(firstNameOf('Sophie'), 'Sophie');
});
