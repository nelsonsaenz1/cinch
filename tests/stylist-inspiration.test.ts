/**
 * Board-led inspiration — the deterministic selection under proof.
 *
 * What matters here: the ask-parser stays narrow (a "board meeting" is not a
 * Pinterest board), the board chooser refuses rather than guesses, the Pin
 * ranking is stable for a given board and question, and the persisted reply
 * text never contains the API's name for anything — the no-storage rule as a
 * test, since the reply is what `persist` writes.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  chooseBoard,
  inspirationFailureText,
  inspirationReplyText,
  parseInspirationAsk,
  pinRelevant,
  rankPins,
} from '../src/features/stylist/inspiration';
import type { PinterestBoard, PinterestPin } from '../src/features/recreate/pinterest';

const board = (id: string, name: string): PinterestBoard => ({
  id,
  name,
  description: null,
  pinCount: null,
});

const pin = (id: string, text: Partial<PinterestPin> = {}): PinterestPin => ({
  id,
  title: null,
  description: null,
  altText: null,
  pinUrl: `https://www.pinterest.com/pin/${id}/`,
  imageUrl: 'https://example.invalid/img.jpg',
  dominantColor: null,
  ...text,
});

// ---------------------------------------------------------------------------
// Recognizing the ask
// ---------------------------------------------------------------------------

test('a named board is recognized and its phrase captured', () => {
  assert.deepEqual(
    parseInspirationAsk("I'm going to lunch with friends this fall. Draw inspiration from my Fall/Winter board."),
    { boardPhrase: 'fall/winter' },
  );
  assert.deepEqual(parseInspirationAsk('something like the wedding board'), {
    boardPhrase: 'wedding',
  });
});

test('an unnamed pinterest reach still counts, without a phrase', () => {
  assert.deepEqual(parseInspirationAsk('use my pinterest for this'), { boardPhrase: null });
});

test('a board meeting is a meeting, not a board', () => {
  assert.equal(parseInspirationAsk('what should I wear to a board meeting'), null);
  assert.equal(parseInspirationAsk('what do I wear to the board review'), null);
});

test('an ordinary styling question is not an inspiration ask', () => {
  assert.equal(parseInspirationAsk('what should I wear to lunch this fall?'), null);
});

// ---------------------------------------------------------------------------
// Choosing the board
// ---------------------------------------------------------------------------

const BOARDS = [board('1', 'Fall/Winter Clothing'), board('2', 'Wedding Guest'), board('3', 'Home')];

test('the phrase finds its board across punctuation and case', () => {
  assert.equal(chooseBoard(BOARDS, 'fall/winter')?.id, '1');
  assert.equal(chooseBoard(BOARDS, 'Fall Winter Clothing')?.id, '1');
  assert.equal(chooseBoard(BOARDS, 'wedding')?.id, '2');
});

test('no overlap refuses rather than guesses', () => {
  assert.equal(chooseBoard(BOARDS, 'ski trip'), null);
  assert.equal(chooseBoard([], 'anything'), null);
});

// ---------------------------------------------------------------------------
// Choosing the Pin
// ---------------------------------------------------------------------------

const PINS = [
  pin('30', { title: 'Cozy autumn layers for lunch out' }),
  pin('10', { title: 'Beach day linen' }),
  pin('20', { title: 'Snow boots', imageUrl: null }),
];

test('the pin meeting the question outranks the rest, deterministically', () => {
  const ranked = rankPins(PINS, 'lunch with friends this fall');
  assert.equal(ranked[0]?.id, '30');
  // Same inputs, same order — ids break the tie at the bottom.
  assert.deepEqual(
    rankPins(PINS, 'lunch with friends this fall').map((p) => p.id),
    ranked.map((p) => p.id),
  );
});

test('relevance is graded honestly', () => {
  assert.equal(pinRelevant(PINS[0]!, 'lunch this fall'), true);
  assert.equal(pinRelevant(PINS[1]!, 'lunch this fall'), false);
});

test('a zero-overlap board still yields its top image-bearing pin', () => {
  const ranked = rankPins(PINS, 'quarterly earnings');
  assert.ok(ranked[0]?.imageUrl, 'an image-bearing pin leads when nothing is relevant');
});

// ---------------------------------------------------------------------------
// The reply — what gets persisted
// ---------------------------------------------------------------------------

test('the reply speaks in the person’s own words, never the API’s', () => {
  // The API's name for the board is "Fall/Winter Clothing"; the person said
  // "fall/winter". The persisted sentence may echo only the latter.
  const text = inspirationReplyText('fall/winter', true, 2);
  assert.match(text, /fall\/winter/);
  assert.doesNotMatch(text, /Fall\/Winter Clothing/);
  assert.match(inspirationReplyText(null, true, 2), /your board/);
});

test('the reply grades itself: spirit, not recreation, and gaps stay honest', () => {
  assert.match(inspirationReplyText('x', true, 2), /in its spirit/);
  assert.doesNotMatch(inspirationReplyText('x', true, 2), /recreat/i);
  assert.match(inspirationReplyText('x', false, 2), /Nothing on/);
  assert.match(inspirationReplyText('x', true, 0), /doesn’t have enough pieces/);
});

test('every failure sentence exists and none quotes provider text', () => {
  const causes = [
    'not_connected',
    'reconnect',
    'no_boards',
    'no_board_match',
    'board_empty',
    'rate_limited',
    'offline',
    'provider_down',
  ] as const;
  for (const cause of causes) {
    const text = inspirationFailureText(cause, null);
    assert.ok(text.length > 10, cause);
  }
  // The one echo permitted is the person's own phrase.
  assert.match(inspirationFailureText('no_board_match', 'ski trip'), /ski trip/);
});

// ---------------------------------------------------------------------------
// The storage boundary, as source contract
// ---------------------------------------------------------------------------

const CHAT = readFileSync('src/features/stylist/use-chat.ts', 'utf8');

test('the pin reference never reaches persist', () => {
  // `persist('assistant', …)` writes StoredContent; the pin must not be in it.
  const persistCalls = CHAT.match(/persist\('assistant',[\s\S]{0,300}?\}\)/g) ?? [];
  assert.ok(persistCalls.length > 0, 'the assistant persist call exists');
  for (const call of persistCalls) {
    assert.doesNotMatch(call, /\bpin\b/i, call);
  }
});

test('the inspiration turn spends nothing and cannot open a paywall', () => {
  // It returns before the invoke: the branch lives inside mutationFn ahead of
  // the stylist-chat call, and marks itself the closet's own answer.
  const branch = CHAT.slice(CHAT.indexOf('parseInspirationAsk(question)'), CHAT.indexOf('const askContext'));
  assert.ok(branch.includes("source: 'closet'"), 'inspiration replies are closet-sourced');
  assert.doesNotMatch(branch, /stylist-chat/, 'no model call inside the inspiration branch');
});
