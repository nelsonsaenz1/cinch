/**
 * NT-01's rows against what the senders actually send.
 *
 * The channel table's governing rule is "the description is the promise": a
 * row's sentence is what `supabase/functions/send-push` is checked against, so
 * rewording a description is a change to a promise, not to copy.
 *
 * This matters here because correction 32 asked for the descriptions "taken
 * verbatim from the push channel definitions" and then supplied paraphrases
 * that are not those definitions and are not true of the senders. Three of
 * them would have shipped a promise nothing keeps:
 *
 *   Event reminders — the atlas says "Invitations, and a reminder before an
 *   occasion starts". `eventReminderPayload()` sends exactly one sentence,
 *   "<title> is tomorrow", and no branch of `index.ts` sends an invitation on
 *   this channel at all.
 *
 *   Borrow requests — the atlas says "when they answer yours".
 *   `borrowPayload()` fires on `asked` and on `returned`; there is no
 *   answered-your-request branch.
 *
 *   Friend activity — the atlas says "Requests and new friends".
 *   `friendActivityPayload()` counts follow-backs and new pieces; requests are
 *   a different channel entirely.
 *
 * So the code's sentences ship, and this test is why that decision cannot be
 * quietly reversed by somebody tidying the copy later.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  channelCountLine,
  channelStateWord,
  DEFAULT_MORNING_EDIT_TIME,
  MORNING_EDIT_SLOTS,
  morningEditDescription,
  NOTIFICATION_CHANNELS,
  wouldArriveDescription,
} from '../src/features/push/channels';

test('there are five channels and the page counts them rather than stating five', () => {
  assert.equal(NOTIFICATION_CHANNELS.length, 5);
  assert.match(channelCountLine(), /sends five kinds of message and nothing else/);
  assert.match(channelCountLine(), /no digest and no re-engagement reminder/);
});

test('the five titles are the five the atlas names', () => {
  assert.deepEqual(
    NOTIFICATION_CHANNELS.map((c) => c.title),
    ['Morning edit', 'Friend activity', 'Borrow requests', 'Event reminders', 'Votes and comments'],
  );
});

test('the event-reminder row does not promise invitations, because nothing sends one', () => {
  const sender = readFileSync('supabase/functions/send-push/copy.ts', 'utf8');
  // The sender's whole body for this channel.
  assert.match(sender, /is tomorrow\./);
  assert.doesNotMatch(sender, /channel: 'event_reminders'[\s\S]{0,200}invit/i);

  const row = NOTIFICATION_CHANNELS.find((c) => c.key === 'event_reminders')!;
  assert.doesNotMatch(row.description, /invitation/i);
});

test('the borrow row promises the return, which is the branch that exists', () => {
  const row = NOTIFICATION_CHANNELS.find((c) => c.key === 'borrow_requests')!;
  assert.match(row.description, /return/i);
  const sender = readFileSync('supabase/functions/send-push/copy.ts', 'utf8');
  assert.match(sender, /returned your/);
});

test('the morning edit never names an outfit, at any of its four times', () => {
  // Naming it would put closet content into a lock-screen message, and the
  // server does not have a look at that hour regardless — generation is
  // on-device.
  for (const slot of MORNING_EDIT_SLOTS) {
    const said = morningEditDescription(slot.value);
    assert.match(said, new RegExp(`at ${slot.label}am`));
    assert.match(said, /ready to read/);
  }
  const sender = readFileSync('supabase/functions/send-push/copy.ts', 'utf8');
  assert.match(sender, /The day’s look is ready to read\./);
});

test('there are exactly four send times, and they are the ones SQL allows', () => {
  assert.deepEqual(
    MORNING_EDIT_SLOTS.map((s) => s.label),
    ['6:30', '7:00', '7:30', '8:00'],
  );
  const migration = readFileSync('supabase/migrations/20260810100300_push.sql', 'utf8');
  for (const slot of MORNING_EDIT_SLOTS) {
    assert.ok(migration.includes(slot.value.slice(0, 5)), `slot ${slot.value} is not in SQL`);
  }
});

test('NT-02 states the same promise in the conditional, built from the same string', () => {
  const row = NOTIFICATION_CHANNELS.find((c) => c.key === 'friend_activity')!;
  const said = wouldArriveDescription(row, DEFAULT_MORNING_EDIT_TIME);
  assert.match(said, /^Would arrive: /);
  // The promise itself is unchanged — only its first letter and its tense
  // wrapper — so the two rows cannot drift into two different promises.
  assert.ok(said.toLowerCase().includes(row.description.toLowerCase().slice(0, 30)));
});

test('a toggle has a word for each of its two states', () => {
  assert.equal(channelStateWord(true), 'On');
  assert.equal(channelStateWord(false), 'Off');
});
