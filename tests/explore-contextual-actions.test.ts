/**
 * UX-09 — a hidden gesture may accelerate an action, never own one.
 *
 * The accepted design permits SDK 57 previews and context menus on safe objects
 * only "with every action also available visibly". That sentence is trivially
 * satisfiable in a comment and trivially lost in the next refactor, so it is
 * asserted here instead: every entry in the menu inventory must name where the
 * same outcome is reachable by looking at the screen, and the destructive
 * actions that have confirmation flows must stay out of the menu entirely.
 *
 * The other half of UX-09 — Closet's long press remains multi-select — is a
 * negative, and is proven by grep below rather than by inspection.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  actionTitle,
  EXPLORE_ROW_ACTIONS,
} from '../src/features/explore/contextual-actions';

test('the menu stays inside the accepted 3–5 band', () => {
  assert.ok(EXPLORE_ROW_ACTIONS.length >= 3, 'a menu of one or two is a button in disguise');
  assert.ok(EXPLORE_ROW_ACTIONS.length <= 5, 'past five, the menu becomes the primary surface');
});

test('every contextual action names a visible route to the same outcome', () => {
  for (const action of EXPLORE_ROW_ACTIONS) {
    assert.ok(
      action.visibleEquivalent.trim().length > 20,
      `${action.id} has no meaningful visible equivalent`,
    );
  }
});

test('action ids are unique — the render site keys on them', () => {
  const ids = EXPLORE_ROW_ACTIONS.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('nothing destructive is reachable from a long press', () => {
  // Unfriend, block and report keep their confirmation sheets, and a
  // mis-registered gesture must not be able to start one.
  const ids = EXPLORE_ROW_ACTIONS.map((a) => a.id).join(' ');
  const titles = EXPLORE_ROW_ACTIONS.map((a) =>
    actionTitle(a.id, { ownerName: 'Priya', isMuted: false }),
  ).join(' ');
  assert.doesNotMatch(`${ids} ${titles}`, /unfriend|remove|block|report|delete/i);
});

test('every action produces a title, and mute reads as the toggle it is', () => {
  for (const action of EXPLORE_ROW_ACTIONS) {
    assert.notEqual(
      actionTitle(action.id, { ownerName: 'Priya', isMuted: false }),
      '',
      `${action.id} renders an empty menu row`,
    );
  }
  assert.equal(actionTitle('mute', { ownerName: 'Priya', isMuted: false }), 'Mute in Lately');
  assert.equal(actionTitle('mute', { ownerName: 'Priya', isMuted: true }), 'Unmute in Lately');
  assert.match(actionTitle('open-closet', { ownerName: 'Priya', isMuted: false }), /Priya/);
});

test('Closet keeps its long press: no context menu is attached to a garment card', () => {
  // Long press IS multi-select on the Closet grid and is the only way in. A
  // `Link.Menu` on a card would swallow the gesture and delete the feature.
  const guarded = [
    'src/components/closet/item-card.tsx',
    'src/components/closet/closet-grid.tsx',
    'src/components/social/FriendItemCard.tsx',
  ];
  for (const path of guarded) {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /Link\.Menu|Link\.Preview/, `${path} must not mount a context menu`);
  }

  // …and the gesture it protects is still actually there.
  assert.match(
    readFileSync('src/components/closet/item-card.tsx', 'utf8'),
    /onLongPress/,
    'Closet multi-select long press has gone missing',
  );
});
