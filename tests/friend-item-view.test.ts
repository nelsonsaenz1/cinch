/**
 * IT-04 — what a friend's garment may say, and who decides.
 *
 * Three separate people's decisions meet in this one view: the owner's
 * `borrowable`, the owner's `shoppable`, and the viewer's own "Show where to
 * buy". Getting the conjunction wrong is not a layout bug — it is showing a
 * commerce row over somebody who opted out, or offering to borrow a coat its
 * owner never offered. Neither is visible in a screenshot of the happy path.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  BORROW_CONSEQUENCE,
  friendItemView,
  lendsLine,
  OWNER_ONLY_CELLS,
} from '../src/features/social-graph/friend-item-view';
import type { FriendItem } from '../src/features/social-graph/types';

const item = (over: Partial<FriendItem> = {}): FriendItem => ({
  id: 'i1',
  userId: 'priya',
  category: 'Outerwear',
  subcategory: 'Overshirt jacket',
  colors: [],
  pattern: null,
  material: 'oat cotton twill',
  brand: null,
  seasons: [],
  occasions: [],
  description: null,
  thumbPath: null,
  cutoutPath: null,
  platePath: null,
  borrowable: true,
  createdAt: '2026-03-02T00:00:00.000Z',
  wearCount: 18,
  lastWornAt: null,
  shoppable: false,
  ...over,
});

const viewer = { userId: 'me', showWhereToBuy: true };

test('the document reads as the atlas draws it', () => {
  const v = friendItemView(item(), viewer);
  assert.equal(v.title, 'Overshirt jacket');
  assert.equal(v.line, 'Outerwear · oat cotton twill');
  assert.equal(v.wears, 18);
  assert.equal(v.borrow, 'lent');
  assert.equal(lendsLine('Priya'), 'Priya lends this one');
});

test('the descriptive line never announces an empty cell', () => {
  // "Outerwear · " with nothing after it is a cell saying it has nothing.
  assert.equal(friendItemView(item({ material: null }), viewer).line, 'Outerwear');
  assert.equal(friendItemView(item({ material: '   ' }), viewer).line, 'Outerwear');
});

test('the garment is called what its owner calls it', () => {
  assert.equal(friendItemView(item({ subcategory: null }), viewer).title, 'Outerwear');
  assert.equal(friendItemView(item({ subcategory: '  ' }), viewer).title, 'Outerwear');
});

test('zero wears is quiet, not a zero', () => {
  // "0 wears" about somebody else's clothes reads as a judgement, and the
  // standing refusal is that zero is quiet.
  assert.equal(friendItemView(item({ wearCount: 0 }), viewer).wears, null);
  assert.equal(friendItemView(item({ wearCount: 1 }), viewer).wears, 1);
});

test('a piece the owner does not lend carries nothing about lending', () => {
  // Not a disabled button and not an explanation: a decision she made about
  // her own coat is not narrated to somebody who did not ask.
  assert.equal(friendItemView(item({ borrowable: false }), viewer).borrow, 'not_lent');
});

test('asking promises exactly what the schema does — no hold', () => {
  // `borrow_requests` is a message with a state; nothing reserves or blocks the
  // garment, so the sentence may not imply one.
  assert.equal(
    BORROW_CONSEQUENCE,
    'Asking sends her a request she can decline. Nothing is reserved until she says yes.',
  );
  assert.doesNotMatch(BORROW_CONSEQUENCE, /hold|reserved for you|set aside|until you/i);
});

test('commerce needs BOTH people to have said yes', () => {
  const shoppable = item({ shoppable: true });
  assert.equal(friendItemView(shoppable, viewer).commerce, 'find_it');
  // The owner has not opted in — her pieces are not shoppable by anyone.
  assert.equal(friendItemView(item({ shoppable: false }), viewer).commerce, 'off');
  // The viewer has turned merchant rows off app-wide; the owner's consent does
  // not override the viewer's own setting, or the reverse.
  assert.equal(
    friendItemView(shoppable, { ...viewer, showWhereToBuy: false }).commerce,
    'off',
  );
});

test('the view refuses to render over your own piece', () => {
  const mine = friendItemView(item({ userId: 'me' }), viewer);
  assert.equal(mine.borrow, 'own');
  // Asking to borrow your own coat, and being sold one you already own, are
  // both nonsense — and every owner cell is missing here, so this document is
  // the wrong one for that garment entirely.
  assert.equal(mine.commerce, 'off');
});

test('an anonymous viewer is not treated as the owner', () => {
  // `userId: null` must not collide with an item whose owner id is unknown.
  const v = friendItemView(item(), { userId: null, showWhereToBuy: true });
  assert.equal(v.borrow, 'lent');
});

test('no owner-only cell is carried, and the enforcement is not here', () => {
  // The narrow row is the database's doing: `friend_items` is a
  // `security_invoker = false` view with an explicit column list, so price and
  // its relatives never cross. This asserts the view object cannot grow one by
  // accident — and that this module does not pretend to be the enforcement.
  const v = friendItemView(item(), viewer) as Record<string, unknown>;
  for (const cell of OWNER_ONLY_CELLS) {
    assert.equal(cell in v, false, `${cell} reached the friend view`);
  }
  const src = readFileSync('src/features/social-graph/friend-item-view.ts', 'utf8');
  assert.doesNotMatch(src, /supabase|from\('items'\)|select\(/);
});

test('the document draws no owner action and no fabricated cell', () => {
  const src = readFileSync('src/components/social/friend-item-document.tsx', 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  // The overflow menu and everything it held belong to the owner. Matched as
  // button titles rather than as bare words: `overflow-hidden` is a layout
  // class and has nothing to do with a menu.
  assert.doesNotMatch(src, /title="(Edit|Archive|Delete|Mark for sale|More)/i);
  assert.doesNotMatch(src, /onOverflow|OverflowMenu/);
  // No price, no cost per wear, and no currency anywhere.
  // `$` alone would match every template literal, so currency is matched as a
  // symbol against a figure.
  assert.doesNotMatch(src, /[£€]\s?\d|\$\s?\d|cost.?per.?wear|purchase/i);
  // A size cell would be fabricated: `items.size` exists but `friend_items`
  // does not project it, so there is no size to draw. See the report.
  assert.doesNotMatch(src, /\bsize\b/i);
});
