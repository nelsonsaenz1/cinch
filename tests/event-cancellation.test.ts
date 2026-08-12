/**
 * Correction 26 and audit 92 — "cancellation promises only what the app does —
 * canceled in the list, saved content kept, recorded wears untouched", and "no
 * absent-attendee behaviour is exposed".
 *
 * This file is written as a set of REFUSALS as much as assertions, because the
 * defect correction 26 exists to fix was a set of promises rather than a
 * missing one: the earlier copy promised a push nobody sends, promised no
 * crown at a time when crowns are an unresolved conflict, and implied a
 * recorded wear would be erased. Each of those is a `assert.ok(!…)` below, and
 * each will fail the moment somebody writes the sentence back.
 *
 * The three positive claims were checked against the repository, not against
 * the atlas:
 *   · `useCancelEvent` updates `events.canceled_at` and nothing else.
 *   · `event_outfit_posts` / `event_comments` / `event_outfit_votes` cascade on
 *     the event ROW being deleted, which cancelling never does.
 *   · a wear is an `outfits` row with `worn_at` owned by `user_id`, with no
 *     foreign key to the occasion at all.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CANCELLATION_FACTS,
  HOST_CANCELLATION_FACTS,
  cancelledHeading,
  dayOfWearLine,
  hostStatusLine,
  inviteeStatusLine,
  noLookYetLine,
  readyLine,
} from '../src/features/event-outfits/occasion-copy';

const ALL_CANCELLATION_COPY = [...CANCELLATION_FACTS, ...HOST_CANCELLATION_FACTS].join(' ');

test('cancellation states the three things the app actually does', () => {
  const body = CANCELLATION_FACTS.join(' ');
  assert.ok(/shows as canceled in everyone’s list/.test(body), body);
  assert.ok(/comments stay readable/.test(body), body);
  assert.ok(/votes on the board are kept/.test(body), body);
  assert.ok(/stays in your diary/.test(body), body);
});

test('the host’s confirmation adds the one-way door and nothing else', () => {
  assert.equal(HOST_CANCELLATION_FACTS.length, CANCELLATION_FACTS.length + 1);
  assert.ok(HOST_CANCELLATION_FACTS.join(' ').includes('cannot be reopened'));
});

test('cancellation promises nobody is notified', () => {
  // The earlier version promised a push nobody sends. Cancelling writes one
  // column; no sender in `push_senders.sql` fires on it.
  assert.ok(!/notif/i.test(ALL_CANCELLATION_COPY));
  assert.ok(!/told|alert|push|email|message/i.test(ALL_CANCELLATION_COPY));
});

test('cancellation says nothing about crowns — dependency B', () => {
  assert.ok(!/crown|favourite|winner/i.test(ALL_CANCELLATION_COPY));
});

test('cancellation never implies a recorded wear is erased', () => {
  assert.ok(!/erase|removed from your diary|lost/i.test(ALL_CANCELLATION_COPY));
  // The positive form is what has to be there: a diary entry belongs to the
  // wearer, not to the occasion.
  assert.ok(/stays in your diary/.test(ALL_CANCELLATION_COPY));
});

test('no cancellation copy exposes who had or had not answered', () => {
  assert.ok(!/declined|not going|did not respond|hasn’t answered|attending/i.test(ALL_CANCELLATION_COPY));
});

test('the heading names the actor when it is known, and the occasion when it is not', () => {
  assert.equal(cancelledHeading('Sarah', 'the birthday dinner'), 'Sarah cancelled the birthday dinner');
  assert.equal(cancelledHeading(null, 'the birthday dinner'), 'the birthday dinner was cancelled');
});

// ---------------------------------------------------------------------------
// Audit 92 — coarse attendance, in both directions
// ---------------------------------------------------------------------------

test('the status sentences carry counts and never a person who is absent', () => {
  assert.equal(hostStatusLine(6, 4), 'You are hosting. 6 invited, 4 ready.');
  assert.equal(hostStatusLine(1, 0), 'You are hosting. 1 invited, 0 ready.');
  assert.equal(
    inviteeStatusLine('Sarah', false),
    'Sarah invited you. You have not answered yet.',
  );
  assert.equal(inviteeStatusLine('Sarah', true), 'Sarah invited you. You are going.');
  assert.equal(inviteeStatusLine(null, false), 'You were invited. You have not answered yet.');
});

test('no status function can be handed a list of people', () => {
  // The privacy rule is enforced by the SHAPE: none of these takes a roster,
  // so none of them can name who is not coming. A future signature that grew
  // one would fail this before it shipped.
  assert.equal(hostStatusLine.length, 2);
  assert.equal(inviteeStatusLine.length, 2);
  assert.equal(readyLine.length, 1);
});

test('the readiness line is omitted at zero', () => {
  assert.equal(readyLine(0), null);
  assert.equal(readyLine(1), '1 has chosen a look');
  assert.equal(readyLine(4), '4 have chosen a look');
});

test('day-of says exactly where a recorded wear goes', () => {
  const line = dayOfWearLine(5);
  assert.ok(line.includes('5 pieces'), line);
  assert.ok(/diary/.test(line), line);
  assert.ok(/wear count/.test(line), line);
  assert.ok(dayOfWearLine(1).includes('1 piece'));
});

test('an invitee’s empty look card explains rather than sits empty', () => {
  const line = noLookYetLine();
  assert.ok(/Join first/.test(line), line);
  assert.ok(/pick the pieces yourself/.test(line), line);
});
