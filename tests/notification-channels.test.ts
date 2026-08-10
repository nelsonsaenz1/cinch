import assert from 'node:assert/strict';
import { test } from 'node:test';

/**
 * The channel table is the artefact three things are checked against: the rows
 * this screen draws, the columns in `20260810100300_push.sql`, and the senders
 * Unit X writes in `supabase/functions/send-push/**`. Atlas 37's governing rule
 * — "the description is the promise… copy and schedule are reviewed together" —
 * only means anything if changing one of the three fails something.
 *
 * This is that tripwire. The SQL side is transcribed as literals rather than
 * imported, for the same reason `plans.test.ts` transcribes the edge limits:
 * the point is that a change has to be made twice deliberately, not that the
 * constant is written once.
 */
import {
  allChannelsOff,
  DEFAULT_MORNING_EDIT_TIME,
  DEFAULT_NOTIFICATION_PREFS,
  MORNING_EDIT_SLOTS,
  morningEditDescription,
  morningEditLabel,
  normalizeMorningEditTime,
  NOTIFICATION_CHANNELS,
  prefsFromRow,
  rowFromPrefs,
  type NotificationChannelKey,
} from '../src/features/push/channels';

/** `notification_prefs`' columns and their `default`s, transcribed from the migration. */
const MIGRATION_DEFAULTS: Record<NotificationChannelKey, boolean> = {
  morning_edit: true,
  friend_activity: true,
  borrow_requests: true,
  event_reminders: true,
  votes_comments: false,
};

/** The `check (morning_edit_at in (…))` list, transcribed from the migration. */
const MIGRATION_TIME_SLOTS = ['06:30', '07:00', '07:30', '08:00'];

test('every channel has a column, and every column has a channel', () => {
  const keys = NOTIFICATION_CHANNELS.map((c) => c.key).sort();
  assert.deepEqual(
    keys,
    Object.keys(MIGRATION_DEFAULTS).sort(),
    'the channel table and notification_prefs must name the same set of channels',
  );
});

test('the defaults are the atlas rule: on by default, except votes', () => {
  for (const channel of NOTIFICATION_CHANNELS) {
    assert.equal(
      channel.defaultOn,
      MIGRATION_DEFAULTS[channel.key],
      `${channel.key}: the table says ${channel.defaultOn}, the migration says ${MIGRATION_DEFAULTS[channel.key]}`,
    );
  }
  // Stated separately from the loop above so the rule itself, not just the
  // agreement, is what fails: "anything that fires per friend action starts
  // off", and votes is the only channel whose frequency other people set.
  const off = NOTIFICATION_CHANNELS.filter((c) => !c.defaultOn).map((c) => c.key);
  assert.deepEqual(off, ['votes_comments']);
});

test('Season in review is not a channel, and neither is anything for marketing', () => {
  // Atlas 34 is deferred (contract §3) and notification_prefs has no column for
  // it. A switch for a feature that does not exist is the refusal this repo has
  // already made once; this is where it stays made.
  const keys = NOTIFICATION_CHANNELS.map((c) => c.key) as string[];
  assert.ok(!keys.includes('season_in_review'));
  const prose = NOTIFICATION_CHANNELS.map((c) => `${c.title} ${c.description}`).join(' ');
  assert.ok(!/season/i.test(prose), 'no channel may mention a season while atlas 34 is deferred');
  // "There is no row for offers, tips or re-engagement, and none will be added."
  assert.ok(!/offer|tip|deal|discount|come back/i.test(prose));
});

test('the morning edit never promises to carry the day’s look', () => {
  // Contract §4.5. Generation is on-device — the server never holds a look to
  // put in a payload — so the atlas's "with the day's look" is a promise no
  // sender can keep, and the contract froze the replacement.
  const morning = NOTIFICATION_CHANNELS.find((c) => c.key === 'morning_edit');
  assert.ok(morning);
  assert.ok(
    !/with the day’s look|with the day's look/.test(morning.description),
    'the morning edit may not claim to contain the look',
  );
  assert.equal(
    morning.description,
    'One notification at 7:30am, when the day’s look is ready to read. Nothing else arrives in the morning.',
  );
});

test('the printed description carries whatever hour the reader chose', () => {
  // The description IS the promise, and the promise has a time in it. A row
  // still saying 7:30 to somebody who picked 6:30 is the same class of untruth
  // the line above was rewritten to remove.
  assert.match(morningEditDescription('06:30:00'), /at 6:30am,/);
  assert.match(morningEditDescription('08:00:00'), /at 8:00am,/);
  const morning = NOTIFICATION_CHANNELS.find((c) => c.key === 'morning_edit');
  assert.equal(
    morning?.description,
    morningEditDescription(DEFAULT_MORNING_EDIT_TIME),
    'the frozen table entry must be the default slot rendered through the same function',
  );
});

test('the four send times are the four the database will accept', () => {
  assert.deepEqual(
    MORNING_EDIT_SLOTS.map((s) => s.value.slice(0, 5)),
    MIGRATION_TIME_SLOTS,
  );
  assert.equal(DEFAULT_MORNING_EDIT_TIME, '07:30:00');
  assert.deepEqual(
    MORNING_EDIT_SLOTS.map((s) => s.label),
    ['6:30', '7:00', '7:30', '8:00'],
  );
});

test('a time from the server is coerced to a slot, never printed raw', () => {
  // Postgres `time` reads back as HH:MM:SS; a hand-written fixture or migration
  // may use the shorter spelling. Both mean the same slot.
  assert.equal(normalizeMorningEditTime('07:00:00'), '07:00:00');
  assert.equal(normalizeMorningEditTime('07:00'), '07:00:00');
  assert.equal(normalizeMorningEditTime('06:30:00+00'), '06:30:00');
  // Anything else is a row written by something that did not know the
  // constraint. Fall back rather than print a time no sender fires at.
  assert.equal(normalizeMorningEditTime('09:15:00'), DEFAULT_MORNING_EDIT_TIME);
  assert.equal(normalizeMorningEditTime(null), DEFAULT_MORNING_EDIT_TIME);
  assert.equal(normalizeMorningEditTime(undefined), DEFAULT_MORNING_EDIT_TIME);
  assert.equal(morningEditLabel('07:30:00'), '7:30');
});

test('no row means the defaults, not silence', () => {
  // Nothing writes a prefs row at sign-up, and the senders treat absence as the
  // atlas defaults. A screen that drew "everything off" for that person would
  // disagree with the sender about what is about to happen to them.
  assert.deepEqual(prefsFromRow(null), DEFAULT_NOTIFICATION_PREFS);
  assert.deepEqual(prefsFromRow(undefined), DEFAULT_NOTIFICATION_PREFS);
  assert.equal(allChannelsOff(DEFAULT_NOTIFICATION_PREFS), false);
});

test('a row round-trips through the app’s casing without losing a field', () => {
  const row = {
    morning_edit: false,
    morning_edit_at: '08:00:00',
    friend_activity: true,
    borrow_requests: false,
    event_reminders: true,
    votes_comments: true,
  };
  assert.deepEqual(rowFromPrefs(prefsFromRow(row)), row);
});

test('NP-02 is every channel false, computed over the table', () => {
  const off = { ...DEFAULT_NOTIFICATION_PREFS };
  for (const channel of NOTIFICATION_CHANNELS) off[channel.key] = false;
  assert.equal(allChannelsOff(off), true);

  // One left on is not "all off" — including a channel added later, which is
  // why this is a conjunction over the table rather than a hand-listed five.
  for (const channel of NOTIFICATION_CHANNELS) {
    assert.equal(
      allChannelsOff({ ...off, [channel.key]: true }),
      false,
      `${channel.key} on should keep the quiet note away`,
    );
  }
});
