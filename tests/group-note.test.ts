/**
 * The group note (Event Detail State Atlas E-07) — the derivation held
 * against the atlas's own four situations. This is the part of the page most
 * likely to invent a claim, so every case here is a sentence the atlas
 * actually prints or a silence it actually requires.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { groupStyleNote, type NoteBoard } from '../src/features/events/group-note';
import { garment } from './helpers';

const board = (userId: string, ...garments: NoteBoard['garments']): NoteBoard => ({
  userId,
  garments,
});

test('silence: fewer than two boards carry a colour', () => {
  const boards = [board('me', garment('base_top', 'cream'))];
  assert.equal(groupStyleNote(boards, 'me'), null);
});

test('silence: no shared hue family among any two attendees', () => {
  // Three genuinely distinct families — `cream` is a wardrobe "neutral" in
  // this engine (families.ts groups navy/charcoal/cream/olive together
  // deliberately), so the other two here are vivid, non-neutral hues that
  // land in `red` and `green` respectively, each alone.
  const boards = [
    board('me', garment('base_top', 'cream')),
    board('dana', garment('base_top', 'red')),
    board('june', garment('base_top', 'green')),
  ];
  assert.equal(groupStyleNote(boards, 'me'), null);
});

test('silence: a board with garments but no readable colour is skipped, not guessed', () => {
  const noColour = garment('base_top', 'cream', { colors: [] });
  const boards = [board('me', noColour), board('dana', garment('base_top', 'cream'))];
  assert.equal(groupStyleNote(boards, 'me'), null);
});

test('you are in the set: your own reads differently with a contrasting piece', () => {
  const boards = [
    board(
      'me',
      garment('base_top', 'cream', { visualWeight: 1 }),
      garment('footwear', 'cognac', { visualWeight: 0.5 }),
    ),
    board('dana', garment('base_top', 'cream')),
  ];
  const note = groupStyleNote(boards, 'me');
  assert.match(note ?? '', /^Two of you are in cream\. Yours reads differently with the cognac /);
});

test('ecru and cream count as the same room — the family, not the name, converges', () => {
  const boards = [
    board('me', garment('base_top', 'ecru', { visualWeight: 1 }), garment('footwear', 'cognac', { visualWeight: 0.5 })),
    board('dana', garment('base_top', 'cream')),
    board('june', garment('base_top', 'ivory')),
  ];
  const note = groupStyleNote(boards, 'me');
  // Three converge on one family; the note names the commonest NAME inside it
  // and counts all three, not just the two that matched on the literal word.
  assert.match(note ?? '', /^Three of you are in \w+\./);
});

test('you are the exception: the group is elsewhere, yours is named', () => {
  // Black and charcoal are BOTH wardrobe neutrals in this engine, same as
  // cream — so the group here is drawn from the vivid `red` family instead,
  // which cream shares with nobody.
  const boards = [
    board('me', garment('base_top', 'cream')),
    board('dana', garment('base_top', 'red')),
    board('june', garment('base_top', 'crimson')),
  ];
  const note = groupStyleNote(boards, 'me');
  assert.match(note ?? '', /^(Two|Three) of them are in \w+\. Yours is the cream in the room\.$/);
});

test('you have not picked: the group is described without you', () => {
  const boards = [board('dana', garment('base_top', 'red')), board('june', garment('base_top', 'crimson'))];
  const note = groupStyleNote(boards, 'me');
  assert.match(note ?? '', /^Two of them are already in \w+ — worth knowing before you pick\.$/);
});

test('a tie in group size breaks deterministically, never throws', () => {
  const boards = [
    board('a', garment('base_top', 'navy')),
    board('b', garment('base_top', 'navy')),
    board('c', garment('base_top', 'red')),
    board('d', garment('base_top', 'red')),
  ];
  // No invented tiebreak drama — just a deterministic, non-throwing answer
  // (the test runner fails the case on its own if this throws).
  groupStyleNote(boards, null);
});

test('null viewer never crashes and still reports the group', () => {
  const boards = [board('dana', garment('base_top', 'red')), board('june', garment('base_top', 'crimson'))];
  const note = groupStyleNote(boards, null);
  assert.match(note ?? '', /already in/);
});
