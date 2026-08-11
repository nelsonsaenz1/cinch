/**
 * What a delivery receipt is allowed to conclude.
 *
 * WHY THIS IS THE ONLY THING THAT CAN CHECK IT
 *
 * `push_tokens` is empty and will stay empty until a store build carries
 * `expo-notifications` and the `aps-environment` entitlement. No notification
 * has ever been sent by this codebase, so no receipt has ever come back, so
 * every line in `interpretReceipts` is currently unexercised by reality. A test
 * over a hand-built response is not as good as a real one — but it is the
 * difference between logic that has been run and logic that has been read.
 *
 * The consequential case is `DeviceNotRegistered`, because acting on it DELETES
 * somebody's device row. Deleting the wrong one silently ends their
 * notifications, and nothing would ever report it — the sweeps would keep
 * succeeding with one fewer recipient.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { interpretReceipts } from '../supabase/functions/_shared/push.ts';

const A = { id: 'ticket-a', token: 'ExponentPushToken[aaaa]' };
const B = { id: 'ticket-b', token: 'ExponentPushToken[bbbb]' };

test('a delivered receipt resolves and retires nothing', () => {
  const v = interpretReceipts([A], { 'ticket-a': { status: 'ok' } });
  assert.deepEqual(v.delivered, ['ticket-a']);
  assert.deepEqual(v.unregistered, []);
  assert.deepEqual(v.failed, []);
  assert.deepEqual(v.pending, []);
});

test('DeviceNotRegistered retires the token that ticket was for', () => {
  // The whole reason audit 25 exists. Note it is B's token that comes back,
  // not A's — an off-by-one here would delete the wrong person's device.
  const v = interpretReceipts([A, B], {
    'ticket-a': { status: 'ok' },
    'ticket-b': { status: 'error', details: { error: 'DeviceNotRegistered' } },
  });
  assert.deepEqual(v.delivered, ['ticket-a']);
  assert.deepEqual(v.unregistered, [B.token]);
  assert.deepEqual(
    v.failed.map((f) => f.ticketId),
    ['ticket-b'],
  );
});

test('a ticket Expo has not answered for yet stays pending, not failed', () => {
  // Receipts are not ready immediately. Reading silence as failure would retire
  // a live device for the crime of being asked about too early.
  const v = interpretReceipts([A, B], { 'ticket-a': { status: 'ok' } });
  assert.deepEqual(v.pending, ['ticket-b']);
  assert.deepEqual(v.unregistered, []);
  assert.deepEqual(v.failed, []);
});

test('an empty response leaves everything pending and retires nothing', () => {
  // The shape of an Expo outage, and the one where a wrong answer would be
  // catastrophic: it would delete every token asked about.
  const v = interpretReceipts([A, B], {});
  assert.deepEqual(v.pending, ['ticket-a', 'ticket-b']);
  assert.deepEqual(v.unregistered, []);
  assert.deepEqual(v.delivered, []);
});

test('other errors resolve the ticket without touching the token', () => {
  // MessageTooBig is a bug in our payload and MismatchSenderId is a problem
  // with the Expo project's credentials. Neither says anything about the
  // device, so neither may delete it.
  const v = interpretReceipts([A, B], {
    'ticket-a': { status: 'error', details: { error: 'MessageTooBig' } },
    'ticket-b': { status: 'error', details: { error: 'MismatchSenderId' } },
  });
  assert.deepEqual(v.unregistered, []);
  assert.deepEqual(
    v.failed.map((f) => f.reason),
    ['MessageTooBig', 'MismatchSenderId'],
  );
  assert.deepEqual(v.delivered, []);
});

test('an error with no details still resolves, carrying whatever Expo said', () => {
  const v = interpretReceipts([A], { 'ticket-a': { status: 'error', message: 'went wrong' } });
  assert.deepEqual(v.failed, [{ ticketId: 'ticket-a', reason: 'went wrong' }]);
  assert.deepEqual(v.unregistered, []);
});

test('an unrecognised status resolves rather than retrying forever', () => {
  // A row retried until it ages out on a status this code does not understand
  // is a slow leak. The unknown value is carried through so it shows up in the
  // logs instead of being flattened to "unknown".
  const v = interpretReceipts([A], { 'ticket-a': { status: 'something-new' } });
  assert.deepEqual(v.failed, [{ ticketId: 'ticket-a', reason: 'something-new' }]);
  assert.deepEqual(v.pending, []);
});

test('a receipt for a ticket that was not asked about is ignored', () => {
  // Expo answering about something we did not ask for must not widen the set of
  // tokens considered for deletion.
  const v = interpretReceipts([A], {
    'ticket-a': { status: 'ok' },
    'ticket-z': { status: 'error', details: { error: 'DeviceNotRegistered' } },
  });
  assert.deepEqual(v.delivered, ['ticket-a']);
  assert.deepEqual(v.unregistered, []);
  assert.deepEqual(v.failed, []);
});

test('two tickets for the same device both retire it, and the caller dedupes', () => {
  // One person with one device gets several notifications; if the device is
  // gone, every one of those tickets says so. The verdict repeats the token —
  // `collectReceipts` is what passes it through a Set before deleting.
  const second = { id: 'ticket-c', token: A.token };
  const v = interpretReceipts([A, second], {
    'ticket-a': { status: 'error', details: { error: 'DeviceNotRegistered' } },
    'ticket-c': { status: 'error', details: { error: 'DeviceNotRegistered' } },
  });
  assert.deepEqual(v.unregistered, [A.token, A.token]);
  assert.equal(new Set(v.unregistered).size, 1);
});

test('nothing asked about produces nothing at all', () => {
  const v = interpretReceipts([], { 'ticket-a': { status: 'ok' } });
  assert.deepEqual(v, { delivered: [], unregistered: [], failed: [], pending: [] });
});
