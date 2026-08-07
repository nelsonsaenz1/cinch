/**
 * The handoff's time-aware salutation (W-14).
 *
 * Pure over an hour number, so no clock freezing: the screen passes
 * `new Date().getHours()`. The boundaries under test are the ones a user
 * would notice being wrong — "Good morning" at 23:00 reads as a bug.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { greetingForHour } from '../src/features/auth/greeting';

test('morning runs from five to noon', () => {
  assert.equal(greetingForHour(5), 'Good morning');
  assert.equal(greetingForHour(9), 'Good morning');
  assert.equal(greetingForHour(11), 'Good morning');
});

test('afternoon runs from noon to six', () => {
  assert.equal(greetingForHour(12), 'Good afternoon');
  assert.equal(greetingForHour(17), 'Good afternoon');
});

test('evening covers the rest, small hours included', () => {
  assert.equal(greetingForHour(18), 'Good evening');
  assert.equal(greetingForHour(23), 'Good evening');
  assert.equal(greetingForHour(0), 'Good evening');
  assert.equal(greetingForHour(4), 'Good evening');
});
