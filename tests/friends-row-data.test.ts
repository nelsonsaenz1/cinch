/**
 * Wave 3 · Group 5 — what a friends row may say, and what "Not now" may imply.
 *
 * Atlas: `docs/design/wave-3-final/Wave 3 - Design · Gap Feed and Social.dc.html`,
 * frames FR-01 and FR-02 (audit 88, 89 · correction 23).
 *
 * CORRECTION 23 IS A TRUTH CORRECTION, so this test is written against the READ
 * PATH rather than against a layout: the row may print only what
 * `fetchProfiles` selects, and the sources are read from disk so a later column
 * added to the row without a column added to the query fails here.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  acceptFailedLine,
  BLOCK_EFFECT,
  BLOCKED_BODY,
  circleLine,
  EMPTY_BODY,
  friendsHeading,
  handleLine,
  impliesRejection,
  NOT_NOW,
  personLine,
  REQUESTS_HEADING,
  setAsideDetail,
  setAsideLine,
} from '../src/components/social/friends-lines';

const ANA = {
  userId: 'u-ana',
  username: 'anab',
  displayName: 'Ana Beltrán',
  avatarUrl: null,
  bio: 'Vintage denim, mostly',
};

// ---------------------------------------------------------------------------
// Correction 23 · only real friendship data
// ---------------------------------------------------------------------------

test('the row prints the handle and the bio, and nothing else under the name', () => {
  assert.equal(personLine(ANA), '@anab · Vintage denim, mostly');
  // Either may be absent; neither is invented.
  assert.equal(personLine({ ...ANA, bio: null }), '@anab');
  assert.equal(personLine({ ...ANA, username: null }), 'Vintage denim, mostly');
  assert.equal(personLine({ ...ANA, username: null, bio: null }), null);
  assert.equal(personLine({ ...ANA, bio: '   ' }), '@anab');
  assert.equal(handleLine({ username: null }), null);
});

test('every field the row draws is a field the query actually selects', () => {
  // A friendship here is not a table: it is two `follows` edges plus a profile.
  // These two selects are the whole of what a row can honestly know.
  const queries = readFileSync('src/features/social-graph/queries.ts', 'utf8');
  assert.match(queries, /\.select\('user_id, username, display_name, avatar_url, bio'\)/);
  assert.match(queries, /\.select\('follower_id, followee_id, created_at'\)/);

  // So: no mutual-friend count, no hosting note, no lending claim. The lending
  // one is the sharpest: `borrowable` is per GARMENT (`items.borrowable`), and
  // there is no account-level lending setting to read at all.
  const rows = readFileSync('src/components/social/friend-rows.tsx', 'utf8');
  const lines = readFileSync('src/components/social/friends-lines.ts', 'utf8');
  const body = (src: string) =>
    src
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');

  for (const src of [body(rows), body(lines)]) {
    assert.ok(!/mutualFriends|mutualCount|friendsInCommon/.test(src));
    assert.ok(!/\bhosting\b/i.test(src));
    assert.ok(!/lends|willing to lend|lending/i.test(src));
  }
});

test('the schema carries no account-level lending flag to read', () => {
  // The claim correction 23 calls out by name. `borrowable` exists — on the
  // garment — and nothing in the migrations makes it a person's setting.
  const social = readFileSync(
    'supabase/migrations/20260807100000_social_graph_blocks_borrow.sql',
    'utf8',
  );
  assert.ok(!/profiles[\s\S]{0,120}\blends?\b/i.test(social));
  assert.ok(!/add column[^;]*lending/i.test(social));
});

// ---------------------------------------------------------------------------
// Audit 88 · no dismissal implies rejection
// ---------------------------------------------------------------------------

test('nothing on a friends row says decline, reject or remove', () => {
  assert.equal(NOT_NOW, 'Not now');

  const copy = [
    NOT_NOW,
    REQUESTS_HEADING,
    friendsHeading(18),
    circleLine(2, 18) ?? '',
    setAsideLine('Marguerite'),
    setAsideDetail('Marguerite'),
    acceptFailedLine('Priya'),
    EMPTY_BODY,
  ];
  for (const line of copy) assert.equal(impliesRejection(line), false, line);

  // The guard itself has to work, or the assertions above are decoration.
  assert.equal(impliesRejection('Request removed.'), true);
  assert.equal(impliesRejection('You declined this request'), true);
});

test('the set-aside receipt states all three facts', () => {
  assert.equal(setAsideLine('Marguerite'), 'Request from Marguerite set aside');
  assert.equal(
    setAsideDetail('Marguerite'),
    'Still waiting in Friends. Marguerite was not told.',
  );
});

test('"Not now" writes nothing to the server, which is why nothing is implied', () => {
  // The row's wording is only honest because of this: the dismissal is a set on
  // this device and no row is written, so the sender cannot detect it.
  const screen = readFileSync('src/app/friends/index.tsx', 'utf8');
  assert.match(screen, /const DISMISSED_KEY = 'cinch\.friends\.dismissedRequests\.v1'/);
  const notNow = screen.slice(
    screen.indexOf('const notNowRequest'),
    screen.indexOf('const undoNotNow'),
  );
  assert.match(notNow, /writeDismissed/);
  assert.ok(!/supabase|mutate\(/.test(notNow), 'Not now must write nothing to the server');

  // And the undo is a real reversal of exactly that write.
  const undo = screen.slice(screen.indexOf('const undoNotNow'));
  assert.match(undo, /writeDismissed\(\(next\) => next\.delete\(id\)\)/);
});

// ---------------------------------------------------------------------------
// FR-01 · the masthead and its sections
// ---------------------------------------------------------------------------

test('the masthead counts what is there and drops what is not', () => {
  assert.equal(circleLine(2, 18), '2 requests · 18 friends');
  assert.equal(circleLine(1, 1), '1 request · 1 friend');
  assert.equal(circleLine(0, 18), '18 friends');
  assert.equal(circleLine(0, 0), null);
  assert.equal(friendsHeading(18), '18 friends');
});

// ---------------------------------------------------------------------------
// FR-02 · one policy, one sentence
// ---------------------------------------------------------------------------

test('the blocked result uses the safety page’s own words', () => {
  // Two sentences for one policy is how a policy stops being one policy. The
  // safety page imports the same constant this frame prints.
  assert.ok(BLOCKED_BODY.startsWith(BLOCK_EFFECT));
  assert.match(BLOCKED_BODY, /they are not told/);

  // BL-01 STOPPED PRINTING IT when SF-01 landed, and that is this rule being
  // obeyed rather than broken. The atlas's masthead is the same four facts in
  // the plural, about a list rather than about one person, and printing both
  // one above the other would be the two paraphrases this test exists to stop.
  // `blocked-lines.ts` carries the plural statement and cross-references this
  // constant; `tests/blocked-lines.test.ts` pins the "not told" claim there.
  const blockedList = readFileSync('src/components/social/BlockedList.tsx', 'utf8');
  assert.doesNotMatch(blockedList, /\{BLOCK_EFFECT\}/, 'one policy, one place per surface');
  assert.match(blockedList, /\{BLOCKED_MASTHEAD\}/);

  const masthead = readFileSync('src/features/social-graph/blocked-lines.ts', 'utf8');
  assert.match(masthead, /THIS REPLACES `BLOCK_EFFECT` ON THIS SCREEN/);
});

test('the empty state leads with privacy, not with an exhortation', () => {
  assert.match(EMPTY_BODY, /looks you choose to share/);
  assert.match(EMPTY_BODY, /lend pieces if they opt in/);
  assert.match(EMPTY_BODY, /Nothing in your closet is shared until you decide it is/);
});
