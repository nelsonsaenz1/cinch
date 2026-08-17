/**
 * THE VOCABULARY CONTRACT, MADE ENFORCEABLE RATHER THAN ASPIRATIONAL.
 *
 * `docs/design/private-circles-preparation.md` §0 fixed one rule and named the
 * two assertions that hold it. Both are here, and the second matters as much as
 * the first:
 *
 *   1. **No customer-facing string in this flow contains "circle."** Scanned
 *      over the EVALUATED copy — every constant, and every function called with
 *      the arguments the atlas draws — because a scanner reading the source
 *      would miss what a function returns and the functions are where the
 *      sentences are assembled.
 *   2. **The five existing friend-graph strings still say "circle."** Pinned by
 *      value, so a well-meaning global rename cannot quietly take them. "Your
 *      circle" means YOUR MUTUAL FRIENDS and is correct where it stands; the
 *      risk after a decision like this is not only that the new flow says the
 *      old word but that a sweep renames the old flow to the new one.
 *
 * The rest of this file holds the promises the frames make. Every one of them
 * is a claim about who can see what, and every one is checked against a schema
 * that already keeps it — a sentence that promised more than the trigger does
 * is the exact failure `block_retracts_votes` was written to correct.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  ACCEPT_REFUSED_FULL,
  ALONE,
  acceptAccessibilityLabel,
  CAP_SPELLED,
  closedRowAccessibilityLabel,
  COLOUR_INDEPENDENCE_RULE,
  CREATE,
  declineAccessibilityLabel,
  declineNote,
  DELETE_GROUP,
  deleteGroupBody,
  deleteGroupHeading,
  FULL,
  GROUP_GONE,
  GROUPS_TITLE,
  groupRowAccessibilityLabel,
  groupRowLine,
  groupSeatLine,
  groupSubtitle,
  INELIGIBILITY_REASONS,
  ineligibilityReason,
  INVITATION,
  invitationFrom,
  invitationMetaLine,
  invitationsWaiting,
  invitationsWaitingRow,
  inviteAgainAccessibilityLabel,
  invitedLabel,
  invitedSpokenLabel,
  joinedLabel,
  LEAVE_GROUP,
  leaveGroupHeading,
  MANAGE,
  manageMemberSubtitle,
  manageOwnerSubtitle,
  memberCountPhrase,
  memberLine,
  memberPermissionNote,
  memberRowAccessibilityLabel,
  membersHeading,
  NO_GROUPS,
  OFFLINE,
  OVERVIEW,
  PENDING,
  pendingRowAccessibilityLabel,
  PICKER,
  PICKER_HINT,
  pickerRowAccessibilityLabel,
  pickerSubtitle,
  REMOVE_MEMBER,
  removeAccessibilityLabel,
  removeMemberConfirm,
  removeMemberHeading,
  NAME_REFUSED,
  seatsLeftLine,
  SEND_UNAVAILABLE_FULL,
  sendInvitationsLabel,
  spelledCount,
  timeAgo,
  WRITE_FAILED,
} from '../src/features/circles/copy.ts';
import { CIRCLE_MAX_MEMBERS } from '../src/features/circles/types.ts';

const body = (path: string) =>
  readFileSync(path, 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

/** Every sentence a state says, as its own string. */
const sentences = (text: string) =>
  text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

const NAME = 'Sunday tennis';
const INVITER = 'Maya';
const MEMBER = 'Ellis Moore';

/**
 * EVERY USER-FACING STRING THIS LANE CAN PRODUCE, EVALUATED.
 *
 * Constants and function results both, and the functions are called across
 * their whole meaningful range — every member count from zero to the cap, both
 * ineligibility reasons, a named inviter and an anonymous one. A scanner that
 * only read the source would pass a file whose `if (n === 1)` branch says
 * "circle".
 */
const ALL_COPY = [
  GROUPS_TITLE,
  NO_GROUPS.title,
  NO_GROUPS.body,
  NO_GROUPS.action,
  NO_GROUPS.footnote,
  CREATE.title,
  CREATE.fieldLabel,
  CREATE.placeholder,
  CREATE.helper,
  CREATE.action,
  CREATE.actionSpoken,
  CREATE.cancel,
  CREATE.aboutHeading,
  ...CREATE.about,
  PICKER.title,
  PICKER.body,
  PICKER.cancel,
  PICKER_HINT,
  SEND_UNAVAILABLE_FULL,
  GROUP_GONE.title,
  GROUP_GONE.body,
  GROUP_GONE.action,
  OVERVIEW.membersHeading,
  OVERVIEW.waitingHeading,
  OVERVIEW.invite,
  OVERVIEW.footnote,
  MANAGE.ownerTitle,
  MANAGE.memberTitle,
  MANAGE.done,
  MANAGE.groupHeading,
  MANAGE.memberHeading,
  MANAGE.manageSpoken,
  PENDING.waitingHeading,
  PENDING.closedHeading,
  PENDING.inviteAgain,
  PENDING.declined,
  PENDING.footnote,
  FULL.action,
  INVITATION.title,
  manageOwnerSubtitle(NAME),
  manageMemberSubtitle(NAME, INVITER),
  manageMemberSubtitle(NAME, null),
  memberPermissionNote(INVITER),
  memberPermissionNote(null),
  membersHeading(4),
  membersHeading(1),
  inviteAgainAccessibilityLabel(MEMBER),
  closedRowAccessibilityLabel(MEMBER, PENDING.declined),
  groupSeatLine(NAME, 12),
  invitationMetaLine(INVITER, null).drawn,
  invitationMetaLine(INVITER, null).spoken,
  invitationMetaLine(null, null).drawn,
  invitationMetaLine(null, null).spoken,
  ...Array.from({ length: CIRCLE_MAX_MEMBERS + 2 }, (_, n) => [
    pickerSubtitle(n),
    sendInvitationsLabel(n),
    invitationsWaitingRow(n),
    groupSubtitle(n, true),
    groupSubtitle(n, false),
  ]).flat(),
  COLOUR_INDEPENDENCE_RULE,
  ...Object.values(INELIGIBILITY_REASONS),
  INVITATION.body,
  INVITATION.accept,
  INVITATION.decline,
  ACCEPT_REFUSED_FULL.title,
  ACCEPT_REFUSED_FULL.body,
  PENDING.heading,
  PENDING.status,
  PENDING.spokenStatus,
  PENDING.withdraw,
  ALONE.title,
  ALONE.body,
  ALONE.action,
  MANAGE.heading,
  MANAGE.ownerBadge,
  MANAGE.remove,
  MANAGE.removalNote,
  MANAGE.ownerCannotLeave,
  MANAGE.leave,
  MANAGE.delete,
  DELETE_GROUP.confirm,
  DELETE_GROUP.keep,
  LEAVE_GROUP.body,
  LEAVE_GROUP.confirm,
  LEAVE_GROUP.stay,
  REMOVE_MEMBER.body,
  REMOVE_MEMBER.keep,
  OFFLINE.title,
  OFFLINE.body,
  OFFLINE.action,
  FULL.title,
  FULL.body,
  CAP_SPELLED,
  MANAGE.link,
  INVITATION.heading,
  ...Object.values(WRITE_FAILED),
  ...Object.values(NAME_REFUSED),
  deleteGroupHeading(NAME),
  leaveGroupHeading(NAME),
  removeMemberHeading(MEMBER),
  removeMemberConfirm(MEMBER),
  removeAccessibilityLabel(MEMBER),
  pendingRowAccessibilityLabel(MEMBER),
  acceptAccessibilityLabel(NAME),
  declineAccessibilityLabel(NAME),
  declineNote(INVITER),
  declineNote(null),
  invitationFrom(INVITER),
  invitationFrom(null),
  invitationsWaiting(0),
  invitationsWaiting(1),
  invitationsWaiting(2),
  joinedLabel('2026-03-04T10:00:00.000Z'),
  joinedLabel(null),
  ineligibilityReason(null) ?? '',
  ineligibilityReason('group_full') ?? '',
  ineligibilityReason('not_mutual') ?? '',
  pickerRowAccessibilityLabel({ name: MEMBER, reason: null }),
  pickerRowAccessibilityLabel({ name: MEMBER, reason: 'group_full' }),
  pickerRowAccessibilityLabel({ name: MEMBER, reason: 'not_mutual' }),
  memberRowAccessibilityLabel({ name: MEMBER, isOwner: true, joinedAt: '2026-03-04T10:00:00.000Z' }),
  memberRowAccessibilityLabel({ name: MEMBER, isOwner: false, joinedAt: null }),
  ...Array.from({ length: CIRCLE_MAX_MEMBERS + 2 }, (_, n) => [
    spelledCount(n),
    memberLine(n),
    memberCountPhrase(n),
    groupRowLine(n, true),
    groupRowLine(n, false),
    deleteGroupBody(n),
    seatsLeftLine(n),
    groupRowAccessibilityLabel({ name: NAME, memberCount: n, isOwner: true }),
    groupRowAccessibilityLabel({ name: NAME, memberCount: n, isOwner: false }),
  ]).flat(),
].join('\n');

// ---------------------------------------------------------------------------
// 1 · The word
// ---------------------------------------------------------------------------

test('not one customer-facing string in this flow contains "circle"', () => {
  assert.doesNotMatch(ALL_COPY, /circle/i);
  // And every string says the customer's word somewhere: the flow is about
  // groups and never leaves the reader guessing what the thing is called.
  assert.match(ALL_COPY, /\bgroup\b/i);
});

test('nor does any string inside the components, VoiceOver labels included', () => {
  // Comments are stripped: the components EXPLAIN at length why the identifiers
  // say circle and the strings say group, and a rule that punishes its own
  // documentation teaches people to stop writing it down.
  const dir = 'src/components/circles';
  const files = readdirSync(dir).filter((f) => /\.tsx?$/.test(f));
  assert.ok(files.length >= 6, 'the component census found almost nothing — check the path');

  for (const file of files) {
    const src = body(`${dir}/${file}`);
    // Import paths legitimately say `circles`: the module directory follows the
    // identifier rule. Only string LITERALS are scanned.
    const literals = [...src.matchAll(/(['"`])((?:(?!\1)[^\\]|\\.)*)\1/g)]
      .map((m) => m[2] ?? '')
      .filter((s) => !/^[@./]/.test(s) && !/^[a-z-]+$/.test(s));
    for (const literal of literals) {
      assert.doesNotMatch(literal, /circle/i, `${file} says "circle" to a customer: ${literal}`);
    }
  }
});

test('the five shipped friend-graph strings still say "circle"', () => {
  // "Your circle" means YOUR MUTUAL FRIENDS and is correct where it stands. A
  // sweep that renamed the old flow to the new word would be a worse failure
  // than the one assertion 1 catches, because it changes copy nobody reviewed.
  const pins: [string, string][] = [
    ['src/features/explore/feed.ts', 'You’re caught up with your circle.'],
    ['src/features/daily-social/copy.ts', 'What your circle wore'],
    ['src/features/daily-social/copy.ts', 'Nobody in your circle has worn anything new.'],
    ['src/features/daily-social/copy.ts', 'Cinch can’t reach your circle'],
    ['src/app/(tabs)/explore.tsx', 'Open your circle'],
  ];
  for (const [path, line] of pins) {
    assert.ok(readFileSync(path, 'utf8').includes(line), `${path} no longer says "${line}"`);
  }
});

test('nothing in this lane touches the surfaces that own the old word', () => {
  const dir = 'src/components/circles';
  for (const file of readdirSync(dir).filter((f) => /\.tsx?$/.test(f))) {
    const src = body(`${dir}/${file}`);
    assert.doesNotMatch(src, /daily-social|explore\/feed/, `${file} reaches into the friend-graph copy`);
  }
});

// ---------------------------------------------------------------------------
// 2 · The frames, verbatim
// ---------------------------------------------------------------------------

test('PC-01 is transcribed exactly', () => {
  assert.equal(GROUPS_TITLE, 'Groups');
  assert.equal(NO_GROUPS.title, 'No groups yet.');
  assert.equal(
    NO_GROUPS.body,
    'A private group is a small space for friends you both added. Two to twelve people.',
  );
  assert.equal(NO_GROUPS.action, 'Create a group');
  assert.equal(
    NO_GROUPS.footnote,
    'Groups are invite-only. Nobody can search for one, and no one outside sees that it exists.',
  );
});

test('PC-02 is transcribed exactly, minus the one clause the app cannot keep', () => {
  assert.equal(CREATE.title, 'New group');
  assert.equal(CREATE.fieldLabel, 'Name');
  assert.equal(CREATE.helper, 'Only members see this name.');
  assert.equal(CREATE.action, 'Create');
  assert.equal(CREATE.aboutHeading, 'What a group is');
  assert.equal(CREATE.about[0], 'Two to twelve people.');
  assert.equal(CREATE.about[1], 'Only friends you both added can be invited.');
  // The frame's third line offers renaming. `useRenameCircle` is wired to no
  // surface, so the word is dropped rather than printed as a promise the owner
  // then cannot find a control for. THIS ASSERTION IS THE REMINDER: restoring
  // the word and restoring the surface are one commit.
  assert.doesNotMatch(CREATE.about.join(' '), /renam/i);
  assert.match(CREATE.about[2], /^You own it\./);
});

test('PC-03 is transcribed exactly, and the send button counts', () => {
  assert.equal(PICKER.title, 'Invite friends');
  assert.equal(
    PICKER.body,
    'Only friends you both added appear here. Cinch never suggests anyone else.',
  );
  assert.equal(pickerSubtitle(3), 'Mutual friends only · 3 of 12 chosen');
  assert.equal(sendInvitationsLabel(3), 'Send 3 invitations');
  // One reads as English, and zero is a STATE rather than arithmetic — PC-10's
  // disabled label, which never says "Send 0 invitations".
  assert.equal(sendInvitationsLabel(1), 'Send 1 invitation');
  assert.equal(sendInvitationsLabel(0), 'Send invitations');
  for (let n = 0; n <= CIRCLE_MAX_MEMBERS; n += 1) {
    assert.doesNotMatch(sendInvitationsLabel(n), /\b0\b|undefined|NaN/);
  }
});

test('the picker names all four reasons a row can be inert', () => {
  // PC-03 draws member / pending / not-mutual; PC-10 draws the seat cap. Every
  // one of them is a WORD on the row — a row that simply vanished would answer
  // nobody's question about a friend who is not in the list.
  assert.equal(INELIGIBILITY_REASONS.already_member, 'Already a member');
  assert.equal(INELIGIBILITY_REASONS.invite_pending, 'Invite pending');
  assert.equal(Object.keys(INELIGIBILITY_REASONS).length, 4);
  for (const reason of Object.values(INELIGIBILITY_REASONS)) {
    assert.ok(reason.trim().length > 0);
    // No reason may disclose a block, and none names anybody.
    assert.doesNotMatch(reason, /block/i);
  }
});

test('PC-05 is transcribed exactly, and the dated status is not a nudge', () => {
  assert.equal(PENDING.waitingHeading, 'Waiting');
  assert.equal(PENDING.closedHeading, 'Closed');
  assert.equal(PENDING.withdraw, 'Revoke');
  assert.equal(PENDING.inviteAgain, 'Invite again');
  assert.equal(PENDING.declined, 'Declined');
  assert.equal(
    PENDING.footnote,
    'Only you can see who was invited. Nobody is told who else received an invitation.',
  );

  const now = new Date('2026-03-10T12:00:00.000Z');
  assert.equal(invitedLabel('2026-03-10T09:00:00.000Z', now), 'Invited today');
  assert.equal(invitedLabel('2026-03-09T09:00:00.000Z', now), 'Invited yesterday');
  assert.equal(invitedLabel('2026-03-08T09:00:00.000Z', now), 'Invited 2 days ago');
  // No timestamp is the undated fallback, never a name with nothing under it.
  assert.equal(invitedLabel(null, now), PENDING.status);
  assert.equal(invitedLabel('not a date', now), PENDING.status);
  assert.equal(invitedSpokenLabel(null, now), PENDING.spokenStatus);
  // And nothing in it chases: no "still", no "any day now", no elapsed hours
  // for the owner to read as overdue.
  for (const days of [0, 1, 2, 9, 40]) {
    const at = new Date(now.getTime() - days * 86_400_000).toISOString();
    assert.doesNotMatch(invitedLabel(at, now), /still|overdue|hours|remind/i);
  }
});

test('PC-06 is transcribed exactly, and the role is stated in words', () => {
  assert.equal(OVERVIEW.membersHeading, 'Members');
  assert.equal(OVERVIEW.waitingHeading, 'Waiting');
  assert.equal(OVERVIEW.invite, 'Invite someone');
  assert.equal(
    OVERVIEW.footnote,
    'Invite-only. Members see each other and nothing beyond this group. There is no way to find it from outside.',
  );
  assert.equal(groupSubtitle(4, true), '4 members · you own this group');
  assert.equal(groupSubtitle(4, false), '4 members · private');
  assert.equal(invitationsWaitingRow(2), '2 invitations waiting');
  assert.equal(invitationsWaitingRow(1), '1 invitation waiting');
  // The overview's invite control is not the liveness state's: the first sits
  // under a roster with people already on it, and "a friend" there would imply
  // the ones already in the group were something else.
  assert.notEqual(OVERVIEW.invite, ALONE.action);
});

test('PC-07 and PC-07b are two screens, and each states its own boundary', () => {
  assert.equal(MANAGE.ownerTitle, 'Manage');
  assert.equal(MANAGE.memberTitle, 'This group');
  assert.notEqual(MANAGE.ownerTitle, MANAGE.memberTitle);
  assert.equal(MANAGE.done, 'Done');
  assert.equal(MANAGE.groupHeading, 'Group');
  assert.equal(MANAGE.memberHeading, 'What you can do');
  assert.equal(MANAGE.leave, 'Leave group');
  assert.equal(MANAGE.delete, 'Delete group');
  assert.equal(manageOwnerSubtitle('Sunday tennis'), 'Sunday tennis · you are the owner');
  assert.equal(
    manageMemberSubtitle('Sunday tennis', 'Maya Okonkwo'),
    'Sunday tennis · Maya Okonkwo owns it',
  );
  assert.equal(membersHeading(4), 'Members · 4');

  // A member is told who holds the controls they cannot see, and that leaving
  // is always theirs. Renaming is absent for the same reason it is absent from
  // PC-02's card: there is no surface for it.
  const note = memberPermissionNote('Maya');
  assert.match(note, /^Only Maya can invite, remove members, or delete this group\./);
  assert.match(note, /You can leave at any time\.$/);
  assert.doesNotMatch(note, /renam/i);
  // And it still reads when `social_profiles` gave no name for the owner.
  for (const line of [manageMemberSubtitle(NAME, null), memberPermissionNote(null)]) {
    assert.doesNotMatch(line, /undefined|null|\bnull\b/);
  }
});

test('PC-09b says the group is gone without saying who did it', () => {
  assert.equal(GROUP_GONE.title, 'This group no longer exists.');
  assert.match(GROUP_GONE.body, /Nothing of yours was affected\./);
  // The frame names the owner ("Maya deleted it."). The client cannot: a
  // deleted group and a membership that ended are the same `null`, on purpose,
  // and telling them apart would disclose that somebody was removed — the one
  // fact PC-07 spends a whole sentence refusing to disclose.
  assert.doesNotMatch(GROUP_GONE.body, /deleted it|removed you|owner/i);
  assert.ok(GROUP_GONE.action.trim().length > 0);
});

test('PC-10 offers the remedy it names', () => {
  assert.equal(FULL.action, 'Manage members');
  assert.match(FULL.body, /Remove someone/);
  // The disabled send says WHY, since `accessibilityState.disabled` says only
  // that it is off.
  assert.equal(SEND_UNAVAILABLE_FULL, 'Send invitations, unavailable, this group is full');
  assert.equal(groupSeatLine('Sunday tennis', 12), 'Sunday tennis · 12 of 12');
});

test('elapsed time is coarse, never a clock, and never rounded up', () => {
  const now = new Date('2026-03-10T12:00:00.000Z');
  assert.equal(timeAgo('2026-03-10T11:59:30.000Z', now), 'just now');
  assert.equal(timeAgo('2026-03-10T11:59:00.000Z', now), '1 minute ago');
  assert.equal(timeAgo('2026-03-10T11:30:00.000Z', now), '30 minutes ago');
  assert.equal(timeAgo('2026-03-10T10:00:00.000Z', now), '2 hours ago');
  assert.equal(timeAgo('2026-03-09T10:00:00.000Z', now), 'yesterday');
  assert.equal(timeAgo('2026-03-05T10:00:00.000Z', now), '5 days ago');
  assert.equal(timeAgo(null, now), '');
  assert.equal(timeAgo('not a date', now), '');
  // A clock time beside somebody's name is a second fact about their habits.
  assert.doesNotMatch(timeAgo('2026-03-10T10:00:00.000Z', now), /\d{1,2}:\d{2}/);
});

test('PC-04 is transcribed exactly, with the name as a parameter', () => {
  assert.equal(
    INVITATION.body,
    'You will see who else is in it after you accept. Nothing of yours is shared until then.',
  );
  assert.equal(
    declineNote('Maya'),
    'Declining tells Maya only that you declined. You can be invited again later.',
  );
  // And it still reads when no display name ever arrived.
  assert.equal(
    declineNote(null),
    'Declining tells them only that you declined. You can be invited again later.',
  );
  // The card LEADS with who asked — the frame's order, and the first question
  // anybody has about an invitation.
  assert.equal(INVITATION.title, 'Invitation');
  assert.equal(invitationFrom('Maya Okonkwo'), 'Maya Okonkwo invited you');
  assert.equal(invitationFrom(null), 'Someone you have both added invited you');

  const now = new Date('2026-03-10T12:00:00.000Z');
  const meta = invitationMetaLine('Maya Okonkwo', '2026-03-10T10:00:00.000Z', now);
  assert.equal(meta.drawn, 'invited you · 2 hours ago');
  // Spoken, the drawn separator goes and the sentence rebuilds around the name.
  assert.equal(meta.spoken, 'Maya Okonkwo invited you 2 hours ago.');
  assert.doesNotMatch(meta.spoken, /·/);
  assert.equal(invitationMetaLine('Maya', null).drawn, 'invited you');
  assert.equal(timeAgo('2026-03-10T12:00:00.000Z', now), 'just now');
});

test('PC-07 is transcribed exactly', () => {
  assert.equal(
    MANAGE.removalNote,
    'Removing someone ends their access immediately. They are told they were removed, not who removed them.',
  );
});

test('PC-08 is transcribed exactly at four, and rebuilds at every other number', () => {
  assert.equal(deleteGroupHeading('Sunday tennis'), 'Delete “Sunday tennis”?');
  assert.equal(
    deleteGroupBody(4),
    'All four members lose access immediately. Invitations still waiting are canceled. This cannot be undone.',
  );
  // "All one members lose access" is how a headline ships broken. One member is
  // the owner alone — the liveness state — and there nobody else is affected.
  assert.equal(
    deleteGroupBody(1),
    'You are the only member, so nobody else loses anything. Invitations still waiting are canceled. This cannot be undone.',
  );
  assert.equal(
    deleteGroupBody(2),
    'Both members lose access immediately. Invitations still waiting are canceled. This cannot be undone.',
  );
  assert.equal(
    deleteGroupBody(12),
    'All twelve members lose access immediately. Invitations still waiting are canceled. This cannot be undone.',
  );
  // Every number from zero to the cap reads as English: no numeral where a word
  // belongs, no "1 members", no doubled space.
  for (let n = 0; n <= CIRCLE_MAX_MEMBERS; n += 1) {
    const line = deleteGroupBody(n);
    assert.doesNotMatch(line, /\ba? ?\d+ members\b/, `deleteGroupBody(${n}) prints a numeral`);
    assert.doesNotMatch(line, /\b1 member\b/, `deleteGroupBody(${n}) says "1 member"`);
    assert.doesNotMatch(line, / {2}/, `deleteGroupBody(${n}) has a doubled space`);
    assert.match(line, /This cannot be undone\.$/);
  }
});

test('PC-09 is transcribed exactly', () => {
  assert.equal(OFFLINE.title, 'You’re offline.');
  assert.equal(OFFLINE.body, 'Cinch couldn’t load your groups. Nothing changed.');
  assert.equal(OFFLINE.action, 'Try again');
});

test('PC-10 is transcribed exactly, reasons included', () => {
  assert.equal(FULL.title, 'This group is full.');
  assert.equal(FULL.body, 'A group holds twelve people. Remove someone before inviting another.');
  assert.equal(INELIGIBILITY_REASONS.group_full, 'Group is full');
  assert.equal(INELIGIBILITY_REASONS.not_mutual, 'No longer a mutual friend');
  // The frame's own annotation about how it behaves is kept as a RULE rather
  // than printed — a screen that explained its accessibility strategy to the
  // person using it would be the design talking about itself in front of the
  // user. `private-circles-ax.test.ts` enforces it against the components.
  assert.equal(
    COLOUR_INDEPENDENCE_RULE,
    'Every unavailable row states its reason on the row itself. Nothing is hidden and nothing is explained by colour alone.',
  );
});

test('the spelled cap matches the number the schema enforces', () => {
  assert.equal(CIRCLE_MAX_MEMBERS, 12);
  assert.equal(CAP_SPELLED, 'twelve');
  assert.match(FULL.body, new RegExp(`\\b${CAP_SPELLED}\\b`));
  assert.match(NO_GROUPS.body, new RegExp(`\\b${CAP_SPELLED}\\b`));
});

// ---------------------------------------------------------------------------
// 3 · The emptinesses are different problems
// ---------------------------------------------------------------------------

test('PC-01 and the one-member state share no sentence at all', () => {
  // Both arrive as a page with no other people on it, and they are different
  // problems with different actions: "you have no groups" versus "you have a
  // group and it is waiting for somebody". Written at the call site three
  // weeks apart they converge on one apologetic sentence.
  const states = {
    'PC-01': [NO_GROUPS.title, NO_GROUPS.body, NO_GROUPS.action, NO_GROUPS.footnote],
    alone: [ALONE.title, ALONE.body, ALONE.action],
    'PC-09': [OFFLINE.title, OFFLINE.body, OFFLINE.action],
    'PC-10': [FULL.title, FULL.body],
  };

  const seen = new Map<string, string>();
  for (const [name, lines] of Object.entries(states)) {
    for (const sentence of lines.flatMap(sentences)) {
      const owner = seen.get(sentence);
      assert.equal(owner, undefined, `${name} and ${owner} both say “${sentence}”`);
      seen.set(sentence, name);
    }
  }
});

test('the one-member state is an invitation, not an apology', () => {
  // It must not read as a fault, an error or an emptiness — it is the first
  // state of every group, because the schema enforces no floor of two.
  const all = `${ALONE.title} ${ALONE.body} ${ALONE.action}`;
  assert.doesNotMatch(all, /\bempty\b|\bnothing here\b|\bfailed\b|\bsorry\b|\bproblem\b/i);
  assert.match(ALONE.action, /invite/i);
});

test('offline never blames the network for emptiness, and claims nothing about the data', () => {
  assert.match(OFFLINE.body, /nothing changed/i);
  assert.doesNotMatch(OFFLINE.body, /no groups|you have none|empty/i);
  // And no empty state offers the connection as an explanation.
  assert.doesNotMatch(
    `${NO_GROUPS.body} ${NO_GROUPS.footnote} ${ALONE.body}`,
    /connection|offline|network|try again|reload/i,
  );
});

// ---------------------------------------------------------------------------
// 4 · The privacy promises, and what may never be said
// ---------------------------------------------------------------------------

test('nothing anywhere suggests a group can be discovered', () => {
  assert.doesNotMatch(
    ALL_COPY,
    /people you may know|suggested|discover|explore groups|popular|nearby|trending|browse groups|search for a group/i,
  );
  // The footnote states the opposite, and it is true by construction: a
  // non-member's select on `circles` returns nothing at all.
  assert.match(NO_GROUPS.footnote, /invite-only/i);
  assert.match(NO_GROUPS.footnote, /nobody can search/i);
});

test('nothing counts people in a way that identifies them', () => {
  assert.doesNotMatch(ALL_COPY, /\bfollowers?\b|\blikes?\b|\bviews?\b|\btally\b/i);
  // The member count is a scalar the schema hands out deliberately, and says
  // how many and never who. No string may name a member alongside it.
  assert.equal(memberLine(4), '4 members · private');
  assert.equal(memberLine(1), '1 member · private');
  assert.equal(memberLine(0), '0 members · private');
  assert.doesNotMatch(memberLine(4), /and \d+ others|with /i);
});

test('no string ever names who removed anybody, or says "blocked"', () => {
  // PC-07's second clause, and PC-10's absent third reason. A block severs both
  // follow edges, so the honest thing to say is that the pair are no longer
  // mutual friends — saying "blocked" would disclose the block.
  assert.doesNotMatch(ALL_COPY, /\bblocked\b|\bblock\b/i);
  assert.doesNotMatch(ALL_COPY, /\bremoved by\b/i);
  assert.doesNotMatch(ALL_COPY, /\bthe owner removed\b/i);
  // "who removed" is permitted in exactly one construction, and it is the
  // DENIAL — PC-07's "not who removed them". Anything else with that phrase is
  // an attribution, which is the thing the frame refuses.
  assert.doesNotMatch(ALL_COPY, /\bwho removed\b(?!\s+them\b)/i);
  assert.match(MANAGE.removalNote, /not who removed them/);
});

test('the invitation promises the roster only after accepting, and nothing before', () => {
  assert.match(INVITATION.body, /after you accept/i);
  assert.match(INVITATION.body, /nothing of yours is shared until then/i);
  // And no string on the invitation names another member.
  const invitation = [
    INVITATION.body,
    invitationFrom(INVITER),
    memberLine(4),
    declineNote(INVITER),
  ].join(' ');
  assert.doesNotMatch(invitation, /\bmembers are\b|\bwith \w+ and\b|\balready in it are\b/i);
});

test('declining is reversible in the copy because it is reversible in the schema', () => {
  // `can_see_circle` admits `declined` precisely so a turned-down invitation
  // stays reachable, and the transition trigger permits `declined -> joined`.
  assert.match(declineNote(INVITER), /invited again later/i);
  assert.doesNotMatch(declineNote(INVITER), /permanent|forever|cannot be undone/i);
});

// ---------------------------------------------------------------------------
// 5 · The destructive confirmations name what is lost
// ---------------------------------------------------------------------------

test('every destructive confirmation names the thing and the consequence', () => {
  const confirmations: [string, string, string][] = [
    ['delete', deleteGroupHeading(NAME), deleteGroupBody(4)],
    ['leave', leaveGroupHeading(NAME), LEAVE_GROUP.body],
    ['remove', removeMemberHeading(MEMBER), REMOVE_MEMBER.body],
  ];
  for (const [which, heading, text] of confirmations) {
    // The subject is in the question, so nothing is ambiguous at the moment of
    // the tap.
    assert.match(heading, /\?$/, `${which} does not ask a question`);
    assert.ok(
      heading.includes(NAME) || heading.includes(MEMBER),
      `${which} does not name what it acts on`,
    );
    // And the body says what stops working, in words, immediately.
    assert.match(text, /access|lose|left|removed/i, `${which} does not name the loss`);
  }
});

test('only the delete claims to be irreversible, because only it is', () => {
  assert.match(deleteGroupBody(4), /cannot be undone/i);
  assert.match(deleteGroupBody(4), /invitations still waiting are canceled/i);
  // A removed or left member CAN be invited again — the transition trigger
  // permits `removed|left|declined -> invited` — so neither of these may claim
  // otherwise.
  assert.doesNotMatch(LEAVE_GROUP.body, /cannot be undone|permanent|forever/i);
  assert.doesNotMatch(REMOVE_MEMBER.body, /cannot be undone|permanent|forever/i);
  assert.match(REMOVE_MEMBER.body, /invite them again later/i);
  assert.match(LEAVE_GROUP.body, /invite you back later/i);
});

test('leaving is described as leaving, and never as being removed', () => {
  // The whole reason `circle_member_state` has five values where the events
  // enum has four. Someone who walked out must not appear to have been thrown
  // out, and the copy states which record is written.
  assert.match(LEAVE_GROUP.body, /you left, not that you were removed/i);
  assert.notEqual(LEAVE_GROUP.confirm, MANAGE.remove);
  // It also does not promise silence the schema does not deliver: the `left`
  // row stays on the roster and the people still in it can read it.
  assert.doesNotMatch(LEAVE_GROUP.body, /nobody will know|no one is told|quietly/i);
});

test('the safe choice is named as an act, never as "Cancel"', () => {
  // A dialog whose calm option says "Cancel" makes the reader work out which of
  // the two things it cancels. Each of these names the outcome instead.
  for (const safe of [DELETE_GROUP.keep, LEAVE_GROUP.stay, REMOVE_MEMBER.keep]) {
    assert.doesNotMatch(safe, /^cancel$/i);
    assert.match(safe, /group/i);
  }
});

test('the owner is told they cannot leave, and why, without a promise of transfer', () => {
  // The transition trigger refuses `owner -> left` in as many words, and the
  // design record leaves transfer unresolved.
  assert.match(MANAGE.ownerCannotLeave, /cannot leave/i);
  assert.match(MANAGE.ownerCannotLeave, /delet/i);
  assert.doesNotMatch(MANAGE.ownerCannotLeave, /transfer|hand it over|new owner|make someone/i);
});

// ---------------------------------------------------------------------------
// 6 · The seat that vanished
// ---------------------------------------------------------------------------

test('an invitee who returns to a full group is told what happened, and keeps the invitation', () => {
  // Reachable only because `enforce_circle_size` now guards UPDATE as well as
  // INSERT: decline, watch the owner refill the seat, come back to accept.
  assert.match(ACCEPT_REFUSED_FULL.body, new RegExp(`\\b${CAP_SPELLED}\\b`));
  assert.match(ACCEPT_REFUSED_FULL.body, /the invitation stays here/i);
  // It names nobody: who took the seat is a roster fact and this reader is not
  // on the roster.
  assert.doesNotMatch(ACCEPT_REFUSED_FULL.body, /\btook it\b.*\b\w+ did\b|joined instead/i);
  // And it does not blame the reader for having declined.
  assert.doesNotMatch(ACCEPT_REFUSED_FULL.body, /you should have|because you declined|too slow/i);
  // Distinct from the owner-side full state: two audiences, two problems.
  const owner = new Set(sentences(`${FULL.title} ${FULL.body}`));
  for (const s of sentences(`${ACCEPT_REFUSED_FULL.title} ${ACCEPT_REFUSED_FULL.body}`)) {
    assert.equal(owner.has(s), false, `the two full states share “${s}”`);
  }
});

// ---------------------------------------------------------------------------
// 7 · Counts that read like English
// ---------------------------------------------------------------------------

test('every count reads naturally at one, and at the cap', () => {
  assert.equal(spelledCount(0), 'zero');
  assert.equal(spelledCount(4), 'four');
  assert.equal(spelledCount(12), 'twelve');
  assert.equal(memberCountPhrase(1), '1 member');
  assert.equal(memberCountPhrase(2), '2 members');
  assert.equal(invitationsWaiting(1), '1 waiting');
  assert.equal(invitationsWaiting(2), '2 waiting');
  assert.equal(seatsLeftLine(0), 'No seats left.');
  assert.equal(seatsLeftLine(1), 'One seat left.');
  assert.equal(seatsLeftLine(7), 'Seven seats left.');
  // Nothing throws or prints `undefined` on a count that never arrived.
  const missing = undefined as unknown as number;
  for (const fn of [spelledCount, memberCountPhrase, invitationsWaiting, seatsLeftLine]) {
    assert.doesNotMatch(fn(missing), /undefined|NaN/);
  }
  assert.doesNotMatch(deleteGroupBody(missing), /undefined|NaN/);
  assert.doesNotMatch(memberLine(Number.NaN), /undefined|NaN/);
});

test('a join date is printed or dropped, never guessed', () => {
  assert.equal(joinedLabel('2026-03-04T12:00:00.000Z'), 'Joined Mar 4');
  assert.equal(joinedLabel(null), '');
  assert.equal(joinedLabel('not a date'), '');
});

// ---------------------------------------------------------------------------
// 8 · House copy rules
// ---------------------------------------------------------------------------

test('apostrophes are typographic, and no placeholder survived', () => {
  assert.doesNotMatch(ALL_COPY, /\w'\w/, 'a straight apostrophe crept into the copy');
  assert.doesNotMatch(ALL_COPY, /TODO|TBD|TKTK|Lorem|coming soon|placeholder/i);
});

test('nothing on this surface reads as a notification', () => {
  assert.doesNotMatch(ALL_COPY, /\bnotification\b|\bbadge\b|\bunread\b|\bnotify\b|\bpush\b/i);
  const dir = 'src/components/circles';
  for (const file of readdirSync(dir).filter((f) => /\.tsx$/.test(f))) {
    assert.doesNotMatch(body(`${dir}/${file}`), /bell\b/i, `${file} draws a notification`);
  }
});

test('nothing chases anybody for an answer', () => {
  // An invite-only room that pressured people would be the opposite of what it
  // is for. The pending status is a fact, not a nudge.
  assert.doesNotMatch(ALL_COPY, /remind|nudge|chase|still waiting for you|hurry|last chance/i);
  assert.equal(PENDING.status, 'Invited · waiting for an answer');
});

test('every VoiceOver label is a sentence, not a fragment of furniture', () => {
  // A middle dot is a drawn separator; spoken it is either silence or "middle
  // dot", and neither is what the row means.
  const spoken = [
    groupRowAccessibilityLabel({ name: NAME, memberCount: 4, isOwner: true }),
    groupRowAccessibilityLabel({ name: NAME, memberCount: 1, isOwner: false }),
    memberRowAccessibilityLabel({ name: MEMBER, isOwner: true, joinedAt: '2026-03-04T12:00:00.000Z' }),
    memberRowAccessibilityLabel({ name: MEMBER, isOwner: false, joinedAt: null }),
    pendingRowAccessibilityLabel(MEMBER),
    removeAccessibilityLabel(MEMBER),
    acceptAccessibilityLabel(NAME),
    declineAccessibilityLabel(NAME),
    pickerRowAccessibilityLabel({ name: MEMBER, reason: null }),
    pickerRowAccessibilityLabel({ name: MEMBER, reason: 'group_full' }),
  ];
  for (const label of spoken) {
    assert.ok(label.length > 0);
    assert.doesNotMatch(label, /·/, `a spoken label carries a middle dot: ${label}`);
    assert.doesNotMatch(label, /undefined|null/, label);
  }
  assert.equal(
    groupRowAccessibilityLabel({ name: NAME, memberCount: 4, isOwner: true }),
    'Sunday tennis. 4 members. Private. You own it.',
  );
  assert.equal(
    memberRowAccessibilityLabel({ name: MEMBER, isOwner: true, joinedAt: '2026-03-04T12:00:00.000Z' }),
    'Ellis Moore, Owner, Joined Mar 4.',
  );
  // Ellis Moore renders with no avatar in PC-07 and no join date is a real
  // case too; neither may leave a dangling comma.
  assert.equal(
    memberRowAccessibilityLabel({ name: MEMBER, isOwner: false, joinedAt: null }),
    'Ellis Moore.',
  );
});

test('a picker row speaks its reason, and never announces its own selection twice', () => {
  assert.equal(pickerRowAccessibilityLabel({ name: MEMBER, reason: null }), 'Ellis Moore');
  assert.equal(
    pickerRowAccessibilityLabel({ name: MEMBER, reason: 'group_full' }),
    'Ellis Moore. Group is full.',
  );
  assert.equal(
    pickerRowAccessibilityLabel({ name: MEMBER, reason: 'not_mutual' }),
    'Ellis Moore. No longer a mutual friend.',
  );
  // Whether the row is chosen rides on `accessibilityState.selected`; a label
  // that also said "selected" would announce the change twice.
  for (const reason of [null, 'group_full', 'not_mutual'] as const) {
    assert.doesNotMatch(
      pickerRowAccessibilityLabel({ name: MEMBER, reason }),
      /selected|chosen|checked/i,
    );
  }
});

// ---------------------------------------------------------------------------
// 7 · The refusals that used to have no words at all
// ---------------------------------------------------------------------------

/**
 * `classifyCircleError` names eight failures. Four have a surface of their own
 * — `group_full` is PC-10's notice, `not_mutual` is a picker-row reason,
 * `terms_required` raises the terms sheet, `stale` is silent by design. These
 * are the other four, and until they were written a failed create or a failed
 * delete did nothing and said nothing.
 */
const REFUSALS = [
  WRITE_FAILED.unknown,
  WRITE_FAILED.rateLimited,
  NAME_REFUSED.blockedText,
  NAME_REFUSED.invalidName,
];

test('all four refusals are real sentences, and no two of them are the same', () => {
  for (const line of REFUSALS) {
    assert.equal(typeof line, 'string');
    assert.ok(line.trim().length > 0, 'a refusal is empty');
    // A refusal that is not a sentence is a fragment on a screen. Every one of
    // these ends the thought it starts.
    assert.match(line, /[.!?]$/, `not a sentence: ${line}`);
  }
  assert.equal(new Set(REFUSALS).size, REFUSALS.length, 'two refusals say the same thing');
});

test('no refusal blames the reader or names a person', () => {
  for (const line of REFUSALS) {
    assert.doesNotMatch(line, /\byou (can't|cannot|failed|must not)\b/i, line);
    assert.doesNotMatch(line, /invalid|illegal|forbidden|denied|error/i, line);
    // The word that would disclose a block, which no reason may ever carry.
    assert.doesNotMatch(line, /block/i, line);
  }
});

test('only the two NAME refusals claim the group was not created', () => {
  // They may: `assert_clean_ugc` and the length check both fire before the row
  // exists, so "wasn't created" is a fact about a write that provably did not
  // happen.
  assert.match(NAME_REFUSED.blockedText, /wasn’t created/);
  assert.match(NAME_REFUSED.invalidName, /wasn’t created/);

  // These two may NOT. `unknown` covers the network never answering, which
  // includes the server having committed and the reply having been lost, so any
  // claim about what became of the data would be a guess presented as a fact.
  // `rate_limited` is refused cleanly but is not about a group's existence.
  for (const line of [WRITE_FAILED.unknown, WRITE_FAILED.rateLimited]) {
    assert.doesNotMatch(line, /wasn’t created|nothing was|nothing changed|is safe/i, line);
  }
});

test('the catch-all sends the reader to look rather than straight back to the button', () => {
  // A bare "try again" on a write that may already have landed is how somebody
  // ends up with two of something.
  assert.match(WRITE_FAILED.unknown, /check/i);
});

test('the day limit states a boundary and not a number', () => {
  // The 100/day limit is server-side and tunable; a sentence naming it would be
  // a second place it has to be changed.
  assert.doesNotMatch(WRITE_FAILED.rateLimited, /\d/);
  assert.match(WRITE_FAILED.rateLimited, /tomorrow/i);
});

test('the two borrowed headings now have words of their own', () => {
  // "Manage" is not "Members": the link sits under a roster and opens the
  // screen where somebody is removed and a group is deleted.
  assert.equal(MANAGE.link, 'Manage');
  assert.notEqual(MANAGE.link, MANAGE.heading);
  // And the reader's incoming invitations are not the owner's outgoing ones,
  // which are the same noun for the opposite direction two taps away.
  assert.notEqual(INVITATION.heading, PENDING.heading);
  assert.ok(INVITATION.heading.trim().length > 0);
});
