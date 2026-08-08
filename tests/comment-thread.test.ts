/**
 * Event Comments composer arithmetic, held against EC-02 (M-02 in the atlas
 * file — renumbered per `docs/design/event-social-contract.md` §5): "300
 * characters, counted only past 240" and the reply-as-mention convention
 * `comment-thread.ts` documents.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  counterLabel,
  isReplyBody,
  mentionOf,
  splitMention,
  withReplyPrefix,
} from '../src/features/event-outfits/comment-thread';

test('counterLabel is silent until 240 characters', () => {
  assert.equal(counterLabel(''), null);
  assert.equal(counterLabel('a'.repeat(240)), null);
  assert.equal(counterLabel('a'.repeat(241)), '241 / 300');
  assert.equal(counterLabel('The tote is the right call'.slice(0, 25)), null);
});

test('isReplyBody / mentionOf: a leading @token reads as a reply', () => {
  assert.equal(isReplyBody('@Dana tote it is.'), true);
  assert.equal(mentionOf('@Dana tote it is.'), 'Dana');
  assert.equal(isReplyBody('Both, honestly. Bring the loafers.'), false);
  assert.equal(mentionOf('Both, honestly. Bring the loafers.'), null);
  // An email or handle mid-sentence is not a reply marker.
  assert.equal(isReplyBody('ask dana@example.com'), false);
});

test('splitMention separates the mention from the sentence for styling', () => {
  assert.deepEqual(splitMention('@Dana tote it is.'), { mention: '@Dana', rest: 'tote it is.' });
  assert.equal(splitMention('No mention here'), null);
});

test('withReplyPrefix prepends the target, and is a no-op with none', () => {
  assert.equal(withReplyPrefix('tote it is.', 'Dana'), '@Dana tote it is.');
  assert.equal(withReplyPrefix('Both, honestly.', null), 'Both, honestly.');
});
