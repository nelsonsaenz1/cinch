/**
 * SF-01/02/03's sentences, held against audit 99 and against the schema.
 *
 * A safety screen's copy is not decoration: "they are not told" is a claim
 * about what the app does to somebody else's phone, and "the votes do not come
 * back" is a claim about rows that were deleted. Both are load-bearing, so both
 * are asserted here rather than trusted to survive an edit.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  BLOCK_ELSEWHERE_LINE,
  BLOCKED_EMPTY_BODY,
  BLOCKED_MASTHEAD,
  blockedCountLine,
  blockedWhen,
  KEEP_BLOCKED_ACTION,
  UNBLOCK_ACTION,
  UNBLOCK_FAILED_LINE,
  unblockConsequences,
  unblockQuestion,
} from '../src/features/social-graph/blocked-lines';

const NOW = new Date('2026-08-12T12:00:00Z');

test('the masthead states that nobody is told', () => {
  // The fact people most want and most often have to guess. It is true because
  // nothing in `supabase/functions/send-push` has a branch for an insert into
  // `user_blocks` — there is no sender to turn off.
  assert.match(BLOCKED_MASTHEAD, /none of them is told/);
});

test('the count sentence spells small numbers and agrees with its verb', () => {
  assert.equal(blockedCountLine(0), 'Nobody is blocked.');
  assert.equal(blockedCountLine(1), 'One person is blocked.');
  assert.equal(blockedCountLine(3), 'Three people are blocked.');
  assert.equal(blockedCountLine(12), '12 people are blocked.');
});

test('a date is printed exactly or relatively, never approximated', () => {
  // The standing refusal: a known figure is printed or omitted, never
  // estimated. The relative phrases stop at a fortnight because past that
  // "a few weeks ago" would be an estimate standing in for a date the row
  // actually holds.
  assert.equal(blockedWhen('2026-08-10T09:00:00Z', NOW), 'Blocked this week');
  assert.equal(blockedWhen('2026-08-04T09:00:00Z', NOW), 'Blocked last week');
  assert.equal(blockedWhen('2026-06-14T09:00:00Z', NOW), 'Blocked in June');
  assert.equal(blockedWhen('2025-04-02T09:00:00Z', NOW), 'Blocked in April 2025');
  assert.equal(blockedWhen('not a date', NOW), null);
});

test('audit 99: the sheet states both consequences, in three regular paragraphs', () => {
  const lines = unblockConsequences('Daniel Okafor');
  assert.equal(lines.length, 3, 'three paragraphs, never one bolded block');

  const all = lines.join(' ');
  // The two facts the audit names by number.
  assert.match(all, /able to find you on Cinch again/);
  assert.match(all, /retracted while blocked are not restored/);
  // And the way back, which is what keeps the sheet from reading as a warning.
  assert.match(all, /block Daniel Okafor again at any time/);
});

test('the name is used in the question and in every consequence', () => {
  // "Nobody unblocks the wrong person from a list of three."
  assert.equal(unblockQuestion('Rina Lo'), 'Unblock Rina Lo?');
  for (const line of unblockConsequences('Rina Lo')) {
    assert.ok(line.includes('Rina Lo'), `name missing from: ${line}`);
  }
});

test('no sentence on this surface guesses a pronoun', () => {
  // Cinch holds a display name and a handle. It has never held a pronoun and
  // no column in `supabase/migrations` could supply one, so guessing from a
  // name would misgender a real person on the screen where being wrong about
  // who somebody is matters most.
  const gendered = /\b(he|him|his|she|her|hers)\b/i;
  const surface = [
    BLOCKED_MASTHEAD,
    BLOCK_ELSEWHERE_LINE,
    BLOCKED_EMPTY_BODY,
    UNBLOCK_FAILED_LINE,
    UNBLOCK_ACTION,
    KEEP_BLOCKED_ACTION,
    ...unblockConsequences('Daniel Okafor'),
  ];
  for (const line of surface) {
    assert.doesNotMatch(line, gendered, `gendered pronoun in: ${line}`);
  }
});

test('the second action is named for its outcome, not "Cancel"', () => {
  assert.equal(KEEP_BLOCKED_ACTION, 'Keep them blocked');
  assert.doesNotMatch(KEEP_BLOCKED_ACTION, /cancel/i);
});

test('the failure says the block still stands and that nothing was sent', () => {
  // The important state on a safety screen: a user who cannot tell whether a
  // block lapsed has a real problem, not a cosmetic one.
  assert.match(UNBLOCK_FAILED_LINE, /nothing changed/);
  assert.match(UNBLOCK_FAILED_LINE, /still cannot find you/);
  assert.match(UNBLOCK_FAILED_LINE, /told nothing/);
});
