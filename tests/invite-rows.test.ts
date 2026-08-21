/**
 * The Invite Friends State Atlas (IF-01…IF-06) — row classification, the two
 * sections, the filter, and the per-person send copy.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildInviteRows,
  everyoneAlreadyInvited,
  failedSends,
  filterInviteRows,
  joinNames,
  partitionInviteRows,
  sendResultBody,
  sendResultTitle,
  standingSummary,
  type InviteFriend,
  type InviteRosterEntry,
} from '../src/features/events/invite-rows';

const friend = (userId: string, name: string, username: string | null = null): InviteFriend => ({
  userId,
  name,
  username,
});

test('a plain friend gets a checkbox, never a word', () => {
  const rows = buildInviteRows([friend('1', 'Deji Okonkwo', 'deji')], []);
  assert.equal(rows[0]!.selectable, true);
  assert.equal(rows[0]!.standing, null);
  assert.equal(rows[0]!.alreadyInvited, false);
});

test('going and still-deciding print a word, never a checkbox', () => {
  const roster: InviteRosterEntry[] = [
    { userId: '1', state: 'joined' },
    { userId: '2', state: 'invited' },
  ];
  const rows = buildInviteRows(
    [friend('1', 'Ada Márquez'), friend('2', 'Hana Petrova')],
    roster,
  );
  assert.equal(rows[0]!.standing, 'Going');
  assert.equal(rows[0]!.selectable, false);
  assert.equal(rows[1]!.standing, 'Still deciding');
  assert.equal(rows[1]!.selectable, false);
});

test('declined is the one already-invited row that stays selectable', () => {
  const rows = buildInviteRows(
    [friend('1', 'Sena Ruiz')],
    [{ userId: '1', state: 'declined' }],
  );
  assert.equal(rows[0]!.standing, "Can’t make it");
  assert.equal(rows[0]!.selectable, true);
  assert.equal(rows[0]!.alreadyInvited, true);
});

test('the host row is a word, never removable, never a checkbox', () => {
  const rows = buildInviteRows([friend('1', 'You')], [{ userId: '1', state: 'host' }]);
  assert.equal(rows[0]!.standing, 'Hosting');
  assert.equal(rows[0]!.selectable, false);
});

test('partition: already-invited and your-friends never overlap', () => {
  const rows = buildInviteRows(
    [friend('1', 'Ada'), friend('2', 'Deji')],
    [{ userId: '1', state: 'joined' }],
  );
  const { alreadyInvited, yourFriends } = partitionInviteRows(rows);
  assert.equal(alreadyInvited.length, 1);
  assert.equal(alreadyInvited[0]!.userId, '1');
  assert.equal(yourFriends.length, 1);
  assert.equal(yourFriends[0]!.userId, '2');
});

test('filter matches name or username, case-insensitively, over the fetched list only', () => {
  const rows = buildInviteRows(
    [friend('1', 'Nora Lindqvist', 'nora'), friend('2', 'Noor Bakhtiari', 'noorb')],
    [],
  );
  assert.deepEqual(
    filterInviteRows(rows, 'no').map((r) => r.userId).sort(),
    ['1', '2'],
  );
  assert.deepEqual(filterInviteRows(rows, 'NORA').map((r) => r.userId), ['1']);
  assert.deepEqual(filterInviteRows(rows, 'quinn'), []);
});

test('an empty query returns every row', () => {
  const rows = buildInviteRows([friend('1', 'Ada'), friend('2', 'Deji')], []);
  assert.equal(filterInviteRows(rows, '').length, 2);
  assert.equal(filterInviteRows(rows, '   ').length, 2);
});

test('everyoneAlreadyInvited: false with zero friends, true only when every row has a standing', () => {
  assert.equal(everyoneAlreadyInvited([]), false);
  const partlyInvitable = buildInviteRows(
    [friend('1', 'Ada'), friend('2', 'Deji')],
    [{ userId: '1', state: 'joined' }],
  );
  assert.equal(everyoneAlreadyInvited(partlyInvitable), false);
  const allInvited = buildInviteRows(
    [friend('1', 'Ada'), friend('2', 'Deji')],
    [
      { userId: '1', state: 'joined' },
      { userId: '2', state: 'invited' },
    ],
  );
  assert.equal(everyoneAlreadyInvited(allInvited), true);
});

test('standingSummary matches the atlas sentence shape', () => {
  const rows = buildInviteRows(
    [friend('1', 'A'), friend('2', 'B'), friend('3', 'C'), friend('4', 'D'), friend('5', 'E'), friend('6', 'F')],
    [
      { userId: '1', state: 'joined' },
      { userId: '2', state: 'joined' },
      { userId: '3', state: 'joined' },
      { userId: '4', state: 'joined' },
      { userId: '5', state: 'invited' },
      { userId: '6', state: 'declined' },
    ],
  );
  assert.equal(standingSummary(rows), 'Four are going, one still deciding, one can’t make it.');
});

test('standingSummary omits empty clauses and is quiet on nothing to say', () => {
  const rows = buildInviteRows([friend('1', 'A')], [{ userId: '1', state: 'joined' }]);
  assert.equal(standingSummary(rows), 'One is going.');
  assert.equal(standingSummary([]), '');
});

test('joinNames: the house join, no Oxford comma, singular and empty handled', () => {
  assert.equal(joinNames([]), '');
  assert.equal(joinNames(['Deji']), 'Deji');
  assert.equal(joinNames(['Deji', 'Iris']), 'Deji and Iris');
  assert.equal(joinNames(['Deji', 'Iris', 'Noor']), 'Deji, Iris and Noor');
});

test('sendResultTitle and body: every send worked', () => {
  const outcomes = [
    { userId: '1', name: 'Deji', ok: true },
    { userId: '2', name: 'Iris', ok: true },
    { userId: '3', name: 'Noor', ok: true },
  ];
  assert.equal(sendResultTitle(outcomes), 'Three invitations sent.');
  assert.equal(sendResultBody(outcomes), 'Deji, Iris and Noor are on the list.');
  assert.equal(failedSends(outcomes).length, 0);
});

test('sendResultTitle and body: a partial failure names who made it, not just a count', () => {
  const outcomes = [
    { userId: '1', name: 'Deji', ok: true },
    { userId: '2', name: 'Iris', ok: true },
    { userId: '3', name: 'Noor', ok: false },
  ];
  assert.equal(sendResultTitle(outcomes), '2 of 3 went out');
  assert.equal(sendResultBody(outcomes), 'Deji and Iris are on the list.');
  const failed = failedSends(outcomes);
  assert.equal(failed.length, 1);
  assert.equal(failed[0]!.name, 'Noor');
});

test('a single successful send is grammatically singular', () => {
  const outcomes = [{ userId: '1', name: 'Deji', ok: true }];
  assert.equal(sendResultTitle(outcomes), 'One invitation sent.');
  assert.equal(sendResultBody(outcomes), 'Deji is on the list.');
});
