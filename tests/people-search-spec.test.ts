/**
 * People Search — the page's decisions. Redesign 09, accepted 2026-08-17.
 *
 * The screen is a rendering problem and this runner has no renderer, on
 * purpose. What it can hold is every decision the page makes before it draws:
 * when the invite rows are on screen, what the oxblood row promises, when a
 * failure is allowed to claim the network is down, and — the load-bearing one
 * — that no affordance on this page does anything but navigate to Share.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  COPY,
  INVITE_ROUTE,
  inviteHeadingFor,
  isOfflineLike,
  isSearching,
  MIN_QUERY,
  searchTerm,
  shareSubtitle,
  showsInviteRows,
  STATE_COPY,
} from '../src/features/social-graph/people-search-spec';

// ── The correction from the first draft ────────────────────────────────────

test('every invite affordance navigates to Share, and nothing copies inline', () => {
  // The accepted cut's one deliberate deviation from the first design draft.
  // A page where two rows that look alike sometimes navigate and sometimes
  // silently mutate the pasteboard is a page nobody can predict.
  assert.equal(INVITE_ROUTE, '/invite');

  const body = readFileSync('src/components/social/people-search-body.tsx', 'utf8');
  const screen = readFileSync('src/app/people-search.tsx', 'utf8');

  for (const [name, source] of [
    ['body', body],
    ['screen', screen],
  ] as const) {
    assert.doesNotMatch(source, /expo-clipboard/, `${name} reaches for the clipboard`);
    assert.doesNotMatch(source, /copyText|setStringAsync/, `${name} copies a link inline`);
  }

  // Every invite affordance is wired to the one handler.
  assert.equal(
    (body.match(/onPress=\{view\.onShare\}/g) ?? []).length,
    4,
    'the two resting rows, the no-results CTA and the error fallback all route to Share',
  );
});

test('the page sends no analytics, so a username cannot leak through one', () => {
  // The brief forbids "analytics payload containing the search query/username".
  // The whole-hearted version of that rule is to emit nothing at all: a search
  // screen has nothing to say that is worth the risk of saying it wrong.
  for (const path of [
    'src/components/social/people-search-body.tsx',
    'src/app/people-search.tsx',
    'src/features/social-graph/people-search-spec.ts',
    'src/features/social-graph/recent-people.ts',
  ]) {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /\btrack\s*\(|trackOnce|posthog/, `${path} emits an event`);
  }
});

// ── The invite rows, and the first keystroke ───────────────────────────────

test('the invite rows go on the FIRST typed character, not the second', () => {
  // The brief is explicit, and it is the right cut: the rows answer "I do not
  // know their username", and somebody typing one has stopped asking that.
  assert.equal(showsInviteRows(''), true);
  assert.equal(showsInviteRows('a'), false, 'one character is enough to dismiss them');
  assert.equal(showsInviteRows('al'), false);

  // Tied to typing, NOT to whether a search went out. These two predicates
  // disagree at exactly one character, and that gap is the point.
  assert.equal(isSearching('a'), false);
  assert.equal(showsInviteRows('a'), false);
});

test('a field holding only whitespace is a field nobody has started', () => {
  assert.equal(showsInviteRows('   '), true);
  assert.equal(isSearching('   '), false);
});

test('the search floor matches the query that is actually sent', () => {
  // `useProfileSearch` is `enabled` at >= 2 characters. A page that drew
  // results-shaped furniture below its own floor would be describing a
  // request nobody made.
  assert.equal(MIN_QUERY, 2);
  assert.equal(isSearching('al'), true);
  assert.equal(isSearching('@al'), true, 'the @ is not one of the two');
  assert.equal(isSearching('@a'), false);
});

test('the term is normalised the way the query is', () => {
  // What the page SAYS and what it ASKED cannot be allowed to drift.
  assert.equal(searchTerm('  @alexndria.f '), 'alexndria.f');
  assert.equal(searchTerm('@@dana'), '@dana', 'one @, like useProfileSearch');
  assert.equal(inviteHeadingFor('  @alexndria.f  '), 'Invite alexndria.f');
});

// ── What the oxblood row promises ──────────────────────────────────────────

test('the share row names the real host and the signed-in handle', () => {
  // The frame reads "cinch.app/priya". Both halves are fixture: the app's
  // host is cinchstyle.com and the handle belongs to whoever is signed in.
  const line = shareSubtitle('priya');
  assert.equal(line, 'Opens Share — cinchstyle.com/i/@priya');
  assert.doesNotMatch(line, /cinch\.app/, 'a domain the app does not own');
});

test('a member with no handle is offered Share without a promise about it', () => {
  // An ordinary state, not an error: Share is exactly where she goes to claim
  // one, and there is no link yet to preview.
  assert.equal(shareSubtitle(null), 'Opens Share');
  assert.equal(shareSubtitle(''), 'Opens Share');
  assert.equal(shareSubtitle(undefined), 'Opens Share');
});

// ── The one claim about the network ────────────────────────────────────────

test('OFFLINE is claimed for transport failures and withheld otherwise', () => {
  // There is no NetInfo in this app, so this is an inference from the shape
  // of the failure and never a reading of the radio.
  assert.equal(isOfflineLike(new TypeError('Network request failed')), true);
  assert.equal(isOfflineLike(new TypeError('Failed to fetch')), true);
  assert.equal(isOfflineLike(new Error('Load failed')), true);

  // A server that answered is not an absent network.
  assert.equal(isOfflineLike({ message: 'permission denied for view' }), false);
  assert.equal(isOfflineLike(new Error('duplicate key value')), false);
  assert.equal(isOfflineLike(null), false);
  assert.equal(isOfflineLike(undefined), false);
});

test('the error copy is true whether or not the pill is drawn', () => {
  // Only the badge is gated on the guess. The words hold for any failed
  // search: the request either did not complete or its answer did not
  // arrive, and either way nothing was written.
  assert.equal(COPY.errorBody, 'Your search wasn’t sent. Nothing was changed.');
  assert.match(COPY.errorBody, /Nothing was changed/);
  // It must not imply the request reached anyone — that is the difference
  // between "we could not search" and "we searched and found no one".
  assert.match(COPY.errorHeadline, /couldn’t reach/);
});

// ── The exact strings ──────────────────────────────────────────────────────

test('the accepted copy is the copy, typographer’s apostrophes and all', () => {
  assert.equal(COPY.title, 'Find people');
  assert.equal(COPY.cancel, 'Cancel');
  assert.equal(COPY.searchPlaceholder, 'Search by username');
  assert.equal(COPY.shareHeading, 'Share your link');
  assert.equal(COPY.inviteHeading, 'Invite a friend');
  assert.equal(COPY.inviteSubtitle, 'Text, mail, or anywhere else');
  assert.equal(COPY.recent, 'RECENT');
  assert.equal(COPY.friends, 'Friends');
  assert.equal(COPY.add, 'Add');
  assert.equal(COPY.emptyHeadline, 'No one goes by that username');
  assert.equal(
    COPY.emptyBody,
    'Cinch searches usernames only. Check the spelling, or send them a link.',
  );
  assert.equal(COPY.emptySubtitle, 'Opens Share to send them your link');
  assert.equal(COPY.offline, 'OFFLINE');
  assert.equal(COPY.errorHeadline, 'Search couldn’t reach Cinch');
  assert.equal(COPY.tryAgain, 'Try again');
  assert.equal(COPY.shareInstead, 'Share your link instead');

  // The two states the frames do not draw and the page still answers for.
  assert.equal(STATE_COPY.requested, 'Requested');
  assert.equal(STATE_COPY.you, 'You');

  // Straight apostrophes are a different string and would ship as one.
  for (const value of [COPY.errorHeadline, COPY.errorBody]) {
    assert.doesNotMatch(value, /'/, `${value} carries a typewriter apostrophe`);
  }
});

test('the search copy says usernames, because usernames are all it searches', () => {
  // The privacy contract, in the one place a user reads it: a search that
  // found nothing is not an answer about who is on Cinch.
  assert.match(COPY.searchPlaceholder, /username/i);
  assert.match(COPY.emptyBody, /usernames only/i);
});
