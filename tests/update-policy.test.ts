import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  FOREGROUND_CHECK_COOLDOWN_MS,
  shortUpdateIdentity,
  shouldCheckForUpdate,
  updateFailureReason,
} from '@/features/updates/policy';

test('the first update check is allowed and concurrent checks are refused', () => {
  assert.equal(shouldCheckForUpdate({ now: 10, lastCheckedAt: null, inFlight: false }), true);
  assert.equal(shouldCheckForUpdate({ now: 10, lastCheckedAt: null, inFlight: true }), false);
});

test('foreground checks are cooled down without permanently suppressing them', () => {
  assert.equal(
    shouldCheckForUpdate({ now: FOREGROUND_CHECK_COOLDOWN_MS - 1, lastCheckedAt: 0, inFlight: false }),
    false,
  );
  assert.equal(
    shouldCheckForUpdate({ now: FOREGROUND_CHECK_COOLDOWN_MS, lastCheckedAt: 0, inFlight: false }),
    true,
  );
});

test('update failures become bounded analytics reasons', () => {
  assert.equal(updateFailureReason(new Error('Network request timed out')), 'network');
  assert.equal(updateFailureReason(new Error('native state rejected')), 'unknown');
  assert.equal(updateFailureReason({ secret: 'never forwarded' }), 'unknown');
});

test('diagnostic identities stay readable on a phone', () => {
  assert.equal(shortUpdateIdentity('019ffb3e-75bd-7d35-b3fd', 'Unknown'), '019ffb3e-75b');
  assert.equal(shortUpdateIdentity('', 'Embedded'), 'Embedded');
});
