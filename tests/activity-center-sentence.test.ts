/**
 * The Activity Center's sentences, stamps and inline affordances.
 *
 * The contract under test is §5's taxonomy and §9's copy table. The failure
 * classes worth a test are all about what a row must NOT say or do:
 *
 *   - no live Accept on anything but a pending, unrevoked invitation;
 *   - no "undefined" or "null" anywhere, at any resolution of any subject;
 *   - no free text in a reaction — the three words, or nothing;
 *   - no row addressed to a route that could dead-end.
 *
 * Plus the two things a reader is entitled to: the group's name survives on the
 * row after the group itself has stopped being visible, and the composed
 * VoiceOver label carries "unread" as a WORD rather than leaving colour to do
 * it alone.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  describeActivity,
  inlineActionsFor,
  reactionLabel,
  spokenElapsed,
  stamp,
} from '../src/features/activity-center/sentence';
import {
  ACTIVITY_EVENT_TYPES,
  isActivityEventType,
  routeFor,
  type ActivityActor,
  type ActivityEvent,
  type ActivityEventType,
} from '../src/features/activity-center/types';

const NOW = new Date(2026, 7, 17, 9, 41);
const HOUR = 3_600_000;

const NOBODY: ActivityActor = { name: null, avatarUrl: null };
const MAYA: ActivityActor = { name: 'Maya', avatarUrl: null };

function event(type: ActivityEventType, over: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id: 'e-1',
    type,
    actorId: 'u-1',
    subjectType: type === 'daily.reaction.received' ? 'outfit' : 'circle',
    subjectId: 's-1',
    circleId: type === 'daily.reaction.received' ? null : 'c-1',
    payload:
      type === 'daily.reaction.received'
        ? { reaction: 'sharp' }
        : { circle_name: 'Sunday Roasts' },
    occurredAt: new Date(NOW.getTime() - 2 * HOUR).toISOString(),
    seenAt: null,
    revokedAt: null,
    ...over,
  };
}

/** Every type that a trigger actually produces. `outfit.saved.shared` is inert. */
const LIVE_TYPES = ACTIVITY_EVENT_TYPES.filter((t) => t !== 'outfit.saved.shared');

// ---------------------------------------------------------------------------
// The taxonomy is closed, and closed at both ends
// ---------------------------------------------------------------------------

test('the union is exactly eight members, seven of which are produced', () => {
  assert.equal(ACTIVITY_EVENT_TYPES.length, 8);
  assert.equal(LIVE_TYPES.length, 7);
  assert.ok(ACTIVITY_EVENT_TYPES.includes('outfit.saved.shared'));
});

test('an unknown type off the wire is not a type', () => {
  assert.equal(isActivityEventType('circle.invite.rescinded'), false);
  assert.equal(isActivityEventType(''), false);
  assert.equal(isActivityEventType(null), false);
  assert.equal(isActivityEventType(undefined), false);
  assert.equal(isActivityEventType('circle.invite.received'), true);
});

// ---------------------------------------------------------------------------
// Every sentence is a sentence, at every resolution
// ---------------------------------------------------------------------------

test('every produced type says something true with a named actor', () => {
  for (const type of LIVE_TYPES) {
    const line = describeActivity(event(type), MAYA, NOW);
    assert.ok(line.spoken.length > 0, `${type} said nothing`);
    assert.doesNotMatch(line.spoken, /undefined|null|NaN|\{|\}/, `${type} leaked a placeholder`);
    assert.match(line.spoken, /\.$/, `${type} did not end in a full stop`);
  }
});

test('every produced type still says something true with NOTHING resolved', () => {
  // A group co-member who is a stranger to the reader resolves to no name, and
  // a row older than its group can lose the payload. Neither is exceptional.
  for (const type of LIVE_TYPES) {
    const line = describeActivity(event(type, { payload: {} }), NOBODY, NOW);
    assert.ok(line.spoken.length > 0, `${type} said nothing`);
    assert.doesNotMatch(line.spoken, /undefined|null|NaN/, `${type} leaked a placeholder`);
  }
});

test('the group name comes off the row, so it survives the group', () => {
  // The reader has been removed and can no longer see `circles` at all; the
  // denormalised name is the only thing left that can name the room.
  const line = describeActivity(event('circle.invite.received'), MAYA, NOW);
  assert.match(line.spoken, /Sunday Roasts/);
  assert.equal(line.spoken, 'Maya invited you to the circle Sunday Roasts.');
});

test('emphasis lands on the proper nouns and nowhere else', () => {
  const line = describeActivity(event('circle.invite.received'), MAYA, NOW);
  const bold = line.segments.filter((s) => s.bold).map((s) => s.text);
  assert.deepEqual(bold, ['Maya', 'Sunday Roasts']);
  // And the runs reassemble into exactly the sentence.
  assert.equal(line.segments.map((s) => s.text).join(''), line.spoken);
});

test('an unresolvable noun is not emphasised — the fallbacks are common nouns', () => {
  const line = describeActivity(event('circle.invite.received', { payload: {} }), NOBODY, NOW);
  assert.deepEqual(line.segments.filter((s) => s.bold), []);
  assert.equal(line.segments.map((s) => s.text).join(''), line.spoken);
});

test('you left a group in the second person, and it is the only row that is', () => {
  const line = describeActivity(event('circle.self.left'), NOBODY, NOW);
  assert.equal(line.spoken, 'You left Sunday Roasts.');
});

// ---------------------------------------------------------------------------
// Reactions are three words, never prose
// ---------------------------------------------------------------------------

test('the reaction word is one of the three the schema allows', () => {
  assert.equal(reactionLabel('sharp'), 'Sharp');
  assert.equal(reactionLabel('cozy'), 'Cozy');
  assert.equal(reactionLabel('noted'), 'Noted');
});

test('anything else is no word at all — a payload cannot become copy', () => {
  // The attack this refuses: a reaction column that grew a free-text value
  // would otherwise be quoted verbatim into a sentence on somebody's inbox.
  assert.equal(reactionLabel('Love this'), '');
  assert.equal(reactionLabel('<script>'), '');
  assert.equal(reactionLabel(null), '');
  assert.equal(reactionLabel(undefined), '');

  const line = describeActivity(
    event('daily.reaction.received', { payload: { reaction: 'Love this' } }),
    MAYA,
    NOW,
  );
  assert.doesNotMatch(line.spoken, /Love this/);
});

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

test('only a live invitation carries inline actions', () => {
  for (const type of LIVE_TYPES) {
    const actions = inlineActionsFor(event(type));
    if (type === 'circle.invite.received') assert.deepEqual(actions, ['accept', 'decline']);
    else assert.deepEqual(actions, [], `${type} offered an inline action`);
  }
});

test('a revoked invitation carries none — AC-05 is inert', () => {
  const revoked = event('circle.invite.received', { revokedAt: NOW.toISOString() });
  assert.deepEqual(inlineActionsFor(revoked), []);
  assert.deepEqual(describeActivity(revoked, MAYA, NOW).actions, []);
});

test('a revoked row still has somewhere to go — never a dead end', () => {
  const revoked = event('circle.invite.received', { revokedAt: NOW.toISOString() });
  assert.equal(describeActivity(revoked, MAYA, NOW).href, '/activity/invitation/e-1');
});

test('the detail route carries the EVENT id, never the subject id', () => {
  const invite = event('circle.invite.received', { id: 'ev-9', subjectId: 'circle-9' });
  assert.equal(routeFor(invite), '/activity/invitation/ev-9');

  const reaction = event('daily.reaction.received', { id: 'ev-8', subjectId: 'outfit-8' });
  assert.equal(routeFor(reaction), '/activity/reaction/ev-8');
});

test('a row that is only a fact has nowhere to go', () => {
  for (const type of LIVE_TYPES) {
    if (type === 'circle.invite.received' || type === 'daily.reaction.received') continue;
    assert.equal(routeFor(event(type)), null, `${type} invented a destination`);
  }
});

// ---------------------------------------------------------------------------
// Stamps
// ---------------------------------------------------------------------------

test('the trailing stamp is a column, not a sentence fragment', () => {
  assert.equal(stamp(new Date(NOW.getTime() - 30_000).toISOString(), NOW), 'Now');
  assert.equal(stamp(new Date(NOW.getTime() - 20 * 60_000).toISOString(), NOW), '20m');
  assert.equal(stamp(new Date(NOW.getTime() - 2 * HOUR).toISOString(), NOW), '2h');
  // Three days back from a Monday is a Friday; the weekday name is what AC-02
  // draws and it stops being unambiguous past six days.
  assert.equal(stamp(new Date(NOW.getTime() - 3 * 24 * HOUR).toISOString(), NOW), 'Fri');
  // Past a week it is the dated form AC-08 draws — "Aug 1", month first.
  assert.match(stamp(new Date(NOW.getTime() - 20 * 24 * HOUR).toISOString(), NOW), /^[A-Z][a-z]{2} \d+$/);
});

test('the spoken form is whole words, because it is read aloud', () => {
  assert.equal(spokenElapsed(new Date(NOW.getTime() - 2 * HOUR).toISOString(), NOW), '2 hours ago');
  assert.equal(spokenElapsed(new Date(NOW.getTime() - HOUR).toISOString(), NOW), '1 hour ago');
  assert.equal(spokenElapsed(new Date(NOW.getTime() - 24 * HOUR).toISOString(), NOW), 'yesterday');
  // Never the abbreviated column form: "2h" is announced as "two h".
  assert.doesNotMatch(spokenElapsed(new Date(NOW.getTime() - 2 * HOUR).toISOString(), NOW), /^\d+h$/);
});

test('an unparseable timestamp produces no stamp rather than "Invalid Date"', () => {
  assert.equal(stamp('not-a-date', NOW), '');
  assert.equal(spokenElapsed('not-a-date', NOW), '');
});

// ---------------------------------------------------------------------------
// The accessibility label — §11
// ---------------------------------------------------------------------------

test('unread is a WORD in the label, never colour alone', () => {
  const line = describeActivity(event('circle.invite.received'), MAYA, NOW);
  assert.equal(
    line.label,
    'Maya invited you to the circle Sunday Roasts, 2 hours ago, unread',
  );
});

test('a read row says its time and stops', () => {
  const line = describeActivity(
    event('circle.invite.received', { seenAt: NOW.toISOString() }),
    MAYA,
    NOW,
  );
  assert.equal(line.label, 'Maya invited you to the circle Sunday Roasts, 2 hours ago');
  assert.doesNotMatch(line.label, /unread/);
});

test('a revoked row is never announced as unread, however unseen it is', () => {
  const line = describeActivity(
    event('circle.invite.received', { seenAt: null, revokedAt: NOW.toISOString() }),
    MAYA,
    NOW,
  );
  assert.doesNotMatch(line.label, /unread/);
});

// ---------------------------------------------------------------------------
// Marks
// ---------------------------------------------------------------------------

test('a room wears the group mark; a person wears their face', () => {
  assert.equal(describeActivity(event('circle.invite.received'), MAYA, NOW).mark.kind, 'circle');
  assert.equal(describeActivity(event('circle.member.joined'), MAYA, NOW).mark.kind, 'circle');
  assert.equal(describeActivity(event('circle.invite.accepted'), MAYA, NOW).mark.kind, 'person');
  assert.equal(describeActivity(event('daily.reaction.received'), MAYA, NOW).mark.kind, 'person');
});
