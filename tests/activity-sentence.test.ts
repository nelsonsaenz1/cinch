/**
 * The Activity page's sentences.
 *
 * The contract under test is the one the atlas states and the contract §4.3
 * corrects: seven kinds, each with one mark, one sentence whose only bold is a
 * name, one elapsed label, and up to two affordances. The failure classes worth
 * a test are all about what the page must NOT say:
 *
 *   - no "Decline" on a friend request, ever, under any resolution;
 *   - a person's initials only when a person did it;
 *   - a count printed from the tally or dropped, never estimated;
 *   - an unresolved id producing a true sentence rather than "undefined".
 *
 * Plus the retention rule, which is the only reason an answered row still has a
 * place on the page, and the dot, which must never become a number.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  answerCopy,
  describeActivity,
  friendCount,
  occasionWhen,
} from '../src/features/activity/sentence';
import { hasUnseen, mergeRetained } from '../src/features/activity/retention';
import type { ActivityFeedRow, ActivityKind, ActivitySubjects } from '../src/features/activity/types';
import { ACTIVITY_KINDS } from '../src/features/activity/types';

const NOW = new Date(2026, 7, 6, 9, 41);

const NONE: ActivitySubjects = {
  actorName: null,
  garment: null,
  eventTitle: null,
  eventStartsAt: null,
};

function row(kind: ActivityKind, over: Partial<ActivityFeedRow> = {}): ActivityFeedRow {
  return {
    kind,
    subjectKey: 's-1',
    actorId: 'u-1',
    occurredAt: new Date(NOW.getTime() - 2 * 3_600_000).toISOString(),
    itemId: null,
    outfitId: null,
    eventId: null,
    postId: null,
    tally: null,
    ...over,
  };
}

const say = (line: { spoken: string }) => line.spoken;

// ---------------------------------------------------------------------------
// The sentences.
// ---------------------------------------------------------------------------

test('a friend request says what adding back will do', () => {
  const line = describeActivity(row('follow_in'), { ...NONE, actorName: 'Sam Okafor' }, NOW);
  assert.equal(
    say(line),
    'Sam Okafor wants to be friends. Adding back opens your closet to each other.',
  );
  assert.deepEqual(line.segments[0], { text: 'Sam Okafor', bold: true });
  // The name is the ONLY bold.
  assert.equal(line.segments.filter((s) => s.bold).length, 1);
});

test('a mutual follow is news, not a request', () => {
  const line = describeActivity(row('follow_back'), { ...NONE, actorName: 'Mara Whitfield' }, NOW);
  assert.equal(say(line), 'Mara Whitfield added you back. Her closet is open to you.');
  assert.deepEqual(
    line.actions.map((a) => a.label),
    ['See her closet'],
  );
});

test('a borrow names the garment, and its occasion only when there is one', () => {
  const subjects = {
    ...NONE,
    actorName: 'Nora Lindqvist',
    garment: 'shearling coat',
    eventStartsAt: new Date(2026, 7, 7, 19).toISOString(),
  };
  assert.equal(
    say(describeActivity(row('borrow_request', { itemId: 'i-1', eventId: 'e-1' }), subjects, NOW)),
    'Nora Lindqvist asked to borrow the shearling coat for tomorrow.',
  );

  // No event, no date: a borrow with no occasion has no deadline to invent.
  assert.equal(
    say(
      describeActivity(
        row('borrow_request', { itemId: 'i-1' }),
        { ...subjects, eventStartsAt: null },
        NOW,
      ),
    ),
    'Nora Lindqvist asked to borrow the shearling coat.',
  );
});

test('an invitation bolds the occasion as well as the host', () => {
  const line = describeActivity(
    row('event_invite', { eventId: 'e-1' }),
    {
      ...NONE,
      actorName: 'Mara Whitfield',
      eventTitle: 'Sunday lunch',
      eventStartsAt: new Date(2026, 7, 14, 13).toISOString(),
    },
    NOW,
  );
  assert.equal(say(line), 'Mara Whitfield invited you to Sunday lunch, 14 Aug.');
  assert.deepEqual(
    line.segments.filter((s) => s.bold).map((s) => s.text),
    ['Mara Whitfield', 'Sunday lunch'],
  );
});

test('votes are aggregated per look and name no voter', () => {
  const line = describeActivity(
    row('votes', { actorId: null, eventId: 'e-1', postId: 'p-1', tally: 3 }),
    { ...NONE, eventTitle: 'Wednesday supper' },
    NOW,
  );
  assert.equal(say(line), 'Three friends voted on your look for Wednesday supper.');
  assert.deepEqual(line.mark, { kind: 'glyph', glyph: 'bars' });
  assert.deepEqual(
    line.actions.map((a) => a.label),
    ['See the votes'],
  );
});

test('one vote is one friend, not "1 friends"', () => {
  const line = describeActivity(
    row('votes', { actorId: null, eventId: 'e-1', tally: 1 }),
    { ...NONE, eventTitle: 'Wednesday supper' },
    NOW,
  );
  assert.equal(say(line), 'One friend voted on your look for Wednesday supper.');
});

test('a missing tally drops the count rather than estimating one', () => {
  const line = describeActivity(
    row('votes', { actorId: null, eventId: 'e-1', tally: null }),
    { ...NONE, eventTitle: 'Wednesday supper' },
    NOW,
  );
  assert.equal(say(line), 'Friends voted on your look for Wednesday supper.');
  assert.equal(friendCount(null), null);
  assert.equal(friendCount(0), null);
  assert.equal(friendCount(12), '12 friends');
});

test('a compliment on an outfit does not pretend to name a garment', () => {
  assert.equal(
    say(describeActivity(row('compliment'), { ...NONE, actorName: 'Sam Okafor' }, NOW)),
    'Sam Okafor called your look a good call.',
  );
  assert.equal(
    say(
      describeActivity(
        row('compliment', { itemId: 'i-1' }),
        { ...NONE, actorName: 'Sam Okafor', garment: 'shearling coat' },
        NOW,
      ),
    ),
    'Sam Okafor called your shearling coat a good call.',
  );
});

test('an unresolved name or garment still makes a true sentence', () => {
  const line = describeActivity(row('borrow_request', { itemId: 'i-1' }), NONE, NOW);
  assert.equal(say(line), 'A Cinch member asked to borrow the piece.');
  assert.ok(!say(line).includes('undefined'));
  assert.ok(!say(line).includes('null'));
});

test('every kind produces a sentence, with no exclamation marks', () => {
  for (const kind of ACTIVITY_KINDS) {
    const line = describeActivity(row(kind, { itemId: 'i-1', eventId: 'e-1', tally: 2 }), NONE, NOW);
    assert.ok(line.spoken.length > 0, kind);
    assert.ok(!line.spoken.includes('!'), kind);
    assert.equal(line.key, `${kind}:s-1`);
  }
});

// ---------------------------------------------------------------------------
// The marks.
// ---------------------------------------------------------------------------

test('initials when a person did it, the object glyph when the app reports it', () => {
  const person: ActivityKind[] = ['follow_in', 'follow_back', 'borrow_request'];
  for (const kind of person) {
    assert.deepEqual(
      describeActivity(row(kind), { ...NONE, actorName: 'Nora Lindqvist' }, NOW).mark,
      { kind: 'person', name: 'Nora Lindqvist' },
      kind,
    );
  }

  const glyphs: [ActivityKind, string][] = [
    ['event_invite', 'calendar'],
    ['borrow_returned', 'hanger'],
    ['votes', 'bars'],
    ['compliment', 'heart'],
  ];
  for (const [kind, glyph] of glyphs) {
    assert.deepEqual(
      describeActivity(row(kind), { ...NONE, actorName: 'Nora Lindqvist' }, NOW).mark,
      { kind: 'glyph', glyph },
      kind,
    );
  }
});

// ---------------------------------------------------------------------------
// The answers. Contract §4.3.
// ---------------------------------------------------------------------------

test('"Decline" does not exist on a friend request — the second button is "Not now"', () => {
  const line = describeActivity(row('follow_in'), { ...NONE, actorName: 'Sam Okafor' }, NOW);
  assert.deepEqual(
    line.actions.map((a) => a.label),
    ['Add back', 'Not now'],
  );
  for (const kind of ACTIVITY_KINDS) {
    const labels = describeActivity(row(kind, { eventId: 'e-1' }), NONE, NOW).actions.map(
      (a) => a.label,
    );
    assert.ok(!labels.includes('Decline'), kind);
  }
});

test('"Not now" says nothing was sent; the borrow answers say she was told', () => {
  assert.equal(answerCopy('not-now')?.done, 'Not now · nothing was sent');
  assert.match(answerCopy('not-this-time')?.done ?? '', /she has been told/);
  assert.match(answerCopy('lend')?.done ?? '', /she has been told/);
  assert.equal(answerCopy('add-back')?.done, 'Added back · her closet is open to you');
  // Destinations navigate; they have no outcome to state.
  assert.equal(answerCopy('open-event'), null);
});

test('the affirmative is solid and there is never more than one per row', () => {
  for (const kind of ACTIVITY_KINDS) {
    const actions = describeActivity(row(kind, { eventId: 'e-1' }), NONE, NOW).actions;
    assert.ok(actions.length <= 2, kind);
    assert.ok(actions.filter((a) => a.tone === 'solid').length <= 1, kind);
  }
});

test('compliments and returns carry nothing at all', () => {
  for (const kind of ['compliment', 'borrow_returned'] as ActivityKind[]) {
    assert.deepEqual(describeActivity(row(kind, { itemId: 'i-1' }), NONE, NOW).actions, [], kind);
  }
});

test('a destination with no id to reach is not offered', () => {
  assert.deepEqual(describeActivity(row('event_invite', { eventId: null }), NONE, NOW).actions, []);
  assert.deepEqual(describeActivity(row('votes', { eventId: null }), NONE, NOW).actions, []);
  assert.deepEqual(describeActivity(row('follow_back', { actorId: null }), NONE, NOW).actions, []);
});

// ---------------------------------------------------------------------------
// Dates.
// ---------------------------------------------------------------------------

test('an occasion says today, tomorrow, a weekday, then a date', () => {
  assert.equal(occasionWhen(new Date(2026, 7, 6, 20).toISOString(), NOW), 'today');
  assert.equal(occasionWhen(new Date(2026, 7, 7, 20).toISOString(), NOW), 'tomorrow');
  assert.equal(occasionWhen(new Date(2026, 7, 9, 20).toISOString(), NOW), 'Sunday');
  assert.equal(occasionWhen(new Date(2026, 7, 14, 13).toISOString(), NOW), '14 Aug');
  // A weekday name is ambiguous beyond a week, and the past is always dated.
  assert.equal(occasionWhen(new Date(2026, 7, 13, 20).toISOString(), NOW), '13 Aug');
  assert.equal(occasionWhen(new Date(2026, 7, 4, 20).toISOString(), NOW), '4 Aug');
  assert.equal(occasionWhen(null, NOW), null);
});

test('the elapsed label speaks Lately’s clock', () => {
  assert.equal(describeActivity(row('follow_in'), NONE, NOW).elapsed, '2h ago');
  assert.equal(
    describeActivity(row('follow_in', { occurredAt: new Date(2026, 7, 5, 20).toISOString() }), NONE, NOW)
      .elapsed,
    'Yesterday',
  );
});

// ---------------------------------------------------------------------------
// Retention — AV-05's "keeps its place".
// ---------------------------------------------------------------------------

function line(key: string, occurredAt: string) {
  return describeActivity(row('follow_in', { subjectKey: key, occurredAt }), NONE, NOW) ;
}

test('an answered row that has left the feed goes back where it was', () => {
  const a = line('a', '2026-08-06T09:00:00Z');
  const b = line('b', '2026-08-06T07:00:00Z');
  const c = line('c', '2026-08-06T05:00:00Z');

  // b was answered and is gone from the feed; it belongs between a and c.
  const merged = mergeRetained([a, c], [b]);
  assert.deepEqual(
    merged.map((l) => l.key),
    ['follow_in:a', 'follow_in:b', 'follow_in:c'],
  );
});

test('a retained row still in the feed is not duplicated', () => {
  const a = line('a', '2026-08-06T09:00:00Z');
  const b = line('b', '2026-08-06T07:00:00Z');
  assert.deepEqual(
    mergeRetained([a, b], [b]).map((l) => l.key),
    ['follow_in:a', 'follow_in:b'],
  );
  assert.deepEqual(mergeRetained([a, b], []).map((l) => l.key), ['follow_in:a', 'follow_in:b']);
});

// ---------------------------------------------------------------------------
// The dot. A boolean, forever.
// ---------------------------------------------------------------------------

test('the dot is a boolean, and an empty feed never lights it', () => {
  assert.equal(hasUnseen(null, null), false);
  assert.equal(hasUnseen(null, '2026-08-06T09:00:00Z'), false);
  // Never opened, something waiting.
  assert.equal(hasUnseen('2026-08-06T09:00:00Z', null), true);
  assert.equal(hasUnseen('2026-08-06T09:00:00Z', '2026-08-06T08:00:00Z'), true);
  assert.equal(hasUnseen('2026-08-06T09:00:00Z', '2026-08-06T09:00:00Z'), false);
  assert.equal(hasUnseen('2026-08-06T09:00:00Z', '2026-08-06T10:00:00Z'), false);
});
