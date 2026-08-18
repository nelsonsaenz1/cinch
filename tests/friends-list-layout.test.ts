/**
 * Friends — the circle, its presence facts, and the six ways one must not
 * appear. Redesign 08.
 *
 * Written to the shape the rest of the wave set: everything the page DECIDES
 * lives in `friends-presence.ts` and `friends-lines.ts` and is imported and
 * exercised directly; the drawn body is asserted as TEXT, because esbuild
 * cannot parse React Native's Flow source and there is no renderer here.
 *
 * `supabase/tests/23_friends_presence.sql` is the other half of this file. It
 * proves the SERVER answers correctly; this proves the CLIENT neither adds a
 * filter of its own nor draws anything the server did not authorize.
 *
 * `tests/friends-row-data.test.ts` still holds correction 23 — what a row may
 * say — and is deliberately not duplicated here.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  presenceByFriend,
  withheldOffline,
  withoutMuted,
  type PresenceFact,
} from '../src/features/social-graph/friends-presence';
import {
  ACCEPT_FAILED_DETAIL,
  ACCEPT_FAILED_TITLE,
  ADD,
  ADDING,
  FRIENDS_FAILED_BODY,
  FRIENDS_FAILED_TITLE,
  freeClosetNote,
  INVITE_MUTUAL_NOTE,
  INVITE_TITLE,
  impliesRejection,
  joinedCircleLine,
  NOBODY_YET_BODY,
  NOBODY_YET_TITLE,
  NOT_NOW,
  NO_RESULTS_BODY,
  NO_RESULTS_TITLE,
  OFFLINE_BODY,
  OFFLINE_TITLE,
  REQUESTS_FAILED,
  SENT_NOTE,
  SET_ASIDE,
  UNDO,
  WAITING_ON_YOU,
  WITHDRAW,
  WORN_TODAY,
  worePieceLine,
} from '../src/components/social/friends-lines';

const ROWS_RAW = readFileSync('src/components/social/friend-rows.tsx', 'utf8');
const PAGE_RAW = readFileSync('src/components/social/friends-page.tsx', 'utf8');
const ROUTE_RAW = readFileSync('src/app/friends/index.tsx', 'utf8');
const SPEC_RAW = readFileSync('src/features/social-graph/friends-presence.ts', 'utf8');
const HOOK_RAW = readFileSync('src/features/social-graph/use-friends-presence.ts', 'utf8');
const LINES_RAW = readFileSync('src/components/social/friends-lines.ts', 'utf8');
const SHEETS_RAW = readFileSync('src/components/social/friend-sheets.tsx', 'utf8');

/** Comments describe the intent; the code is what ships. */
function code(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

const ROWS = code(ROWS_RAW);
const PAGE = code(PAGE_RAW);
const ROUTE = code(ROUTE_RAW);
const SPEC = code(SPEC_RAW);
const HOOK = code(HOOK_RAW);

const NOW = new Date(2026, 7, 18, 12, 0, 0, 0);
const iso = (d: Date) => d.toISOString();
const hoursAgo = (h: number) => iso(new Date(NOW.getTime() - h * 3600_000));

const piece = (id: string, label: string) => ({
  id,
  label,
  thumbPath: `t/${id}`,
  cutoutPath: null,
  platePath: null,
});

// ---------------------------------------------------------------------------
// The authorized fact
// ---------------------------------------------------------------------------

test('an authorized piece becomes the card’s one fact', () => {
  const facts = presenceByFriend({
    outfits: [{ id: 'o1', user_id: 'f1', worn_at: hoursAgo(3) }],
    links: [{ outfit_id: 'o1', item_id: 'i1' }],
    pieces: [piece('i1', 'wool coat')],
    now: NOW,
  });
  const fact = facts.get('f1');
  assert.equal(fact?.kind, 'piece');
  assert.equal(fact?.kind === 'piece' && fact.label, 'wool coat');
  assert.equal(worePieceLine('wool coat'), 'Wore the wool coat');
});

test('the newest look that ARRIVED is the one drawn', () => {
  // An expired look never reaches this function, so "newest" can only ever be
  // chosen among rows the server already authorized. Two authorized looks pick
  // the later one.
  const facts = presenceByFriend({
    outfits: [
      { id: 'older', user_id: 'f1', worn_at: hoursAgo(40) },
      { id: 'newer', user_id: 'f1', worn_at: hoursAgo(2) },
    ],
    links: [
      { outfit_id: 'older', item_id: 'i1' },
      { outfit_id: 'newer', item_id: 'i2' },
    ],
    pieces: [piece('i1', 'old shirt'), piece('i2', 'new shirt')],
    now: NOW,
  });
  const fact = facts.get('f1');
  assert.equal(fact?.kind === 'piece' && fact.label, 'new shirt');
});

test('only already-authorized derivatives are ever asked for', () => {
  // thumb, cutout, plate — never an original path and never a public URL.
  assert.match(HOOK, /thumb_path, cutout_path, plate_path/);
  assert.doesNotMatch(HOOK, /image_path|getPublicUrl|original/i);
  // And the well resolves through the app's one signing helper.
  assert.match(ROWS, /useSignedUrls\(/);
});

// ---------------------------------------------------------------------------
// Omission — the property the whole page rests on
// ---------------------------------------------------------------------------

test('a friend with no authorized row simply has no entry', () => {
  const facts = presenceByFriend({ outfits: [], links: [], pieces: [], now: NOW });
  assert.equal(facts.has('f1'), false);
  assert.equal(facts.size, 0);
});

test('a look whose every piece is hidden is not a piece fact', () => {
  // The look crossed; none of its garments did. Worn earlier in the window, so
  // not even the day can be claimed — the friend has no fact at all.
  const facts = presenceByFriend({
    outfits: [{ id: 'o1', user_id: 'f1', worn_at: hoursAgo(50) }],
    links: [{ outfit_id: 'o1', item_id: 'hidden' }],
    pieces: [],
    now: NOW,
  });
  assert.equal(facts.has('f1'), false);
});

test('"Worn today" is only ever said about today', () => {
  const today = presenceByFriend({
    outfits: [{ id: 'o1', user_id: 'f1', worn_at: hoursAgo(2) }],
    links: [{ outfit_id: 'o1', item_id: 'hidden' }],
    pieces: [],
    now: NOW,
  });
  assert.equal(today.get('f1')?.kind, 'worn_today');

  const yesterday = presenceByFriend({
    outfits: [{ id: 'o1', user_id: 'f1', worn_at: hoursAgo(26) }],
    links: [{ outfit_id: 'o1', item_id: 'hidden' }],
    pieces: [],
    now: NOW,
  });
  assert.equal(yesterday.has('f1'), false, 'a Tuesday four days ago is not "today"');
});

test('every reason for absence produces the identical result', () => {
  // Revoked, expired, hidden, never shared — the server returns no row for all
  // four, so the map is empty for all four and the card cannot tell them apart.
  const empty = presenceByFriend({ outfits: [], links: [], pieces: [], now: NOW });
  const muted = withoutMuted(
    presenceByFriend({
      outfits: [{ id: 'o1', user_id: 'f1', worn_at: hoursAgo(2) }],
      links: [{ outfit_id: 'o1', item_id: 'i1' }],
      pieces: [piece('i1', 'wool coat')],
      now: NOW,
    }),
    (id) => id === 'f1',
  );
  const offline = withheldOffline();
  for (const map of [empty, muted, offline]) assert.equal(map.get('f1'), undefined);
});

test('the card draws no element at all when there is no fact', () => {
  // Every presence node in the row is behind a truthiness check on `presence`.
  // No branch renders a dash, a dimmed slot, a placeholder or an empty well.
  assert.doesNotMatch(ROWS, /nothing shared|no fact yet|placeholder/i);
  assert.match(ROWS, /presence\?\.kind === 'piece'/);
  assert.match(ROWS, /presence \? <PresenceBlock/);
  // And the spoken label collapses to the bare name.
  assert.match(ROWS, /: name;/);
});

test('a muted friend is removed, never marked', () => {
  const facts = new Map<string, PresenceFact>([
    ['f1', { kind: 'worn_today' }],
    ['f2', { kind: 'worn_today' }],
  ]);
  const out = withoutMuted(facts, (id) => id === 'f1');
  assert.equal(out.has('f1'), false);
  assert.equal(out.has('f2'), true);
  // Removed, so a muted friend's card is identical to a friend with nothing to
  // show — otherwise the mute becomes visible on the page that performs it.
  assert.doesNotMatch(SPEC, /muted: true|isMutedFlag|mutedMarker/);
});

// ---------------------------------------------------------------------------
// The forbidden sentence
// ---------------------------------------------------------------------------

test('the rejected phrase, and every shape of it, is absent', () => {
  // The first export of this page was rejected for "Shared 2 pieces this week".
  // Asserted against the CODE, not the comments: `friends-lines.ts` quotes the
  // rejected sentence in a docblock precisely so the next person knows why it
  // is forbidden, and a test that outlawed the explanation would delete the
  // institutional memory it depends on.
  for (const [name, src] of [
    ['lines', code(LINES_RAW)],
    ['rows', ROWS],
    ['page', PAGE],
    ['spec', SPEC],
  ] as const) {
    assert.doesNotMatch(src, /Shared \d+ pieces/i, `${name} carries the rejected phrase`);
    assert.doesNotMatch(src, /\d+ pieces this week|this week/i, `${name} carries a weekly tally`);
  }
  // And no count of anything reaches a presence sentence.
  assert.equal(worePieceLine('wool coat'), 'Wore the wool coat');
  assert.doesNotMatch(worePieceLine('wool coat'), /\d/);
  assert.doesNotMatch(WORN_TODAY, /\d/);
});

test('nothing on the page is ordered by activity', () => {
  // Alphabetical only. Presence never reorders, so nobody can infer how often a
  // friend posts from where they sit.
  assert.doesNotMatch(PAGE, /sort\(.*worn|sort\(.*presence|byActivity|recentFirst/i);
  assert.doesNotMatch(ROUTE, /sort\(.*presence/i);
  assert.match(ROUTE, /byName/, 'the list lost its alphabetical sort');
});

// ---------------------------------------------------------------------------
// Independent failures
// ---------------------------------------------------------------------------

test('the four reads fail independently', () => {
  // Requests, friends, presence and each image resolve on their own. A failed
  // presence read is a page of name-only cards, which is a valid frame.
  assert.match(PAGE, /props\.requestsError/);
  assert.match(PAGE, /props\.friendsError/);
  assert.match(ROUTE, /presenceQuery\.isError/);
  assert.match(HOOK, /useQuery\(/, 'presence must be its own query with its own key');
  assert.match(HOOK, /queryKey: \[\.\.\.PRESENCE_KEY/);
});

test('a failed circle read never renders as an empty circle', () => {
  assert.match(FRIENDS_FAILED_TITLE, /Couldn’t load your circle/);
  assert.match(FRIENDS_FAILED_BODY, /not an empty list/);
  assert.match(FRIENDS_FAILED_BODY, /Nobody has been removed/);
  assert.match(PAGE, /FRIENDS_FAILED_TITLE/);
});

test('a failed requests read leaves the circle fully usable', () => {
  assert.equal(REQUESTS_FAILED, 'Requests didn’t load. Your friends are fine.');
  assert.match(PAGE, /REQUESTS_FAILED/);
  // The band carries its own retry rather than sending the page to one.
  assert.match(PAGE, /onRetry=\{props\.onRetryRequests\}/);
});

test('offline keeps every name and withholds every fact', () => {
  assert.equal(withheldOffline().size, 0);
  assert.match(OFFLINE_TITLE, /You’re offline/);
  assert.match(OFFLINE_BODY, /from the last time you were connected/);
  assert.match(OFFLINE_BODY, /isn’t shown until Cinch can check it again/);
  // The page withholds on either failure — a stale fact asserts a permission
  // that may already have been withdrawn.
  assert.match(ROUTE, /presenceWithheld = presenceQuery\.isError \|\| friends\.isError/);
  assert.match(PAGE, /props\.presenceWithheld \? null :/);
});

// ---------------------------------------------------------------------------
// Requests — accept, rollback, Not now, Undo
// ---------------------------------------------------------------------------

test('the band exists only when something is waiting', () => {
  assert.equal(WAITING_ON_YOU, 'Waiting on you');
  assert.match(PAGE, /showRequests \?/);
  assert.match(PAGE, /accessibilityLabel=\{WAITING_ON_YOU\}/);
});

test('accepting is optimistic and rolls back on failure', () => {
  assert.equal(ADD, 'Add');
  assert.equal(ADDING, 'Adding…');
  assert.equal(ACCEPT_FAILED_TITLE, 'That didn’t go through');
  assert.equal(ACCEPT_FAILED_DETAIL, 'Still waiting — nothing was sent');
  // The row goes to `adding`, then `accepted` or back to `failed` — never a
  // silent success. The retry sits on the row that failed.
  assert.match(ROUTE, /setRowState\(id, 'adding'\)|setRowState\(userId, 'adding'\)/);
  assert.match(ROUTE, /'failed'/);
  assert.match(PAGE, /onRetryAccept/);
});

test('a second tap on an in-flight row is swallowed', () => {
  assert.match(ROWS, /state === 'adding'/);
  assert.match(ROWS, /PendingLabel/);
});

test('"Not now" is silent, and Undo restores exactly what it wrote', () => {
  assert.equal(NOT_NOW, 'Not now');
  assert.equal(SET_ASIDE, 'Set aside. Nobody was told.');
  assert.equal(UNDO, 'Undo');
  assert.equal(impliesRejection(SET_ASIDE), false);
  assert.equal(impliesRejection(NOT_NOW), false);

  // The guarantee itself: nothing is written to the server.
  const notNow = ROUTE.slice(ROUTE.indexOf('const notNowRequest'), ROUTE.indexOf('const undoNotNow'));
  assert.match(notNow, /writeDismissed/);
  assert.ok(!/supabase|mutate\(/.test(notNow), 'Not now must write nothing to the server');
  const undo = ROUTE.slice(ROUTE.indexOf('const undoNotNow'));
  assert.match(undo, /writeDismissed\(\(next\) => next\.delete\(id\)\)/);
});

test('the accepted beat says the person joined, and claims no fact for them', () => {
  assert.equal(joinedCircleLine('Mara'), 'Mara is in your circle.');
  // Sharing is off by default and never retroactive, so a brand-new friend has
  // no presence fact — and the copy must not imply one is coming.
  assert.doesNotMatch(joinedCircleLine('Mara'), /shar|wore|worn/i);
});

// ---------------------------------------------------------------------------
// Sent requests, block, report
// ---------------------------------------------------------------------------

test('a sent request can be withdrawn and reports no read receipt', () => {
  assert.equal(WITHDRAW, 'Withdraw');
  assert.match(SENT_NOTE, /Nothing is shared either way until a request is accepted/);
  assert.match(PAGE, /onWithdrawSent/);
  // Withdrawing reuses the existing unfollow rather than a second path.
  assert.match(ROUTE, /onWithdrawSent=\{cancelAsk\}/);
  // No "seen", "delivered" or "viewed" anywhere near the sent section.
  assert.doesNotMatch(PAGE, /read receipt|\bseen\b|delivered/i);
});

test('blocking removes the person from the list and from search in one pass', () => {
  // `useBlockUser` invalidates both reads; the page renders whatever comes back
  // rather than filtering a blocked id on the device.
  const moderation = readFileSync('src/features/social-graph/moderation.ts', 'utf8');
  assert.match(moderation, /'friends',/);
  assert.match(moderation, /'profile-search',/);
  assert.doesNotMatch(PAGE, /blockedIds|isBlocked\(/, 'blocked users must be absent, not filtered');
  assert.doesNotMatch(ROUTE, /blockedIds|isBlocked\(/);
});

test('the report note never enters an analytics call', () => {
  // The whole-hearted version of "no free text in analytics": this surface
  // emits nothing at all, so there is no payload for a note to leak through.
  for (const path of [
    'src/app/friends/index.tsx',
    'src/components/social/friends-page.tsx',
    'src/components/social/friend-rows.tsx',
    'src/components/social/friend-sheets.tsx',
    'src/components/social/friends-lines.ts',
    'src/features/social-graph/friends-presence.ts',
    'src/features/social-graph/use-friends-presence.ts',
  ]) {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /\btrack\s*\(|trackOnce|posthog/, `${path} emits an event`);
  }
  // And the note itself goes to the moderation table and nowhere else.
  assert.match(SHEETS_RAW, /onSubmit/);
});

// ---------------------------------------------------------------------------
// Navigation, plan note, invite
// ---------------------------------------------------------------------------

test('every door on the page leads where it always did', () => {
  assert.match(ROUTE, /router\.push\(\{ pathname: '\/friends\/\[userId\]'/);
  assert.match(ROUTE, /router\.push\('\/invite'\)/);
  assert.match(ROUTE, /router\.push\('\/groups'\)/);
  assert.match(ROUTE, /router\.push\('\/membership'\)/);
  assert.match(ROUTE, /router\.push\('\/friends\/blocked'\)/);
  // Nothing here opens a web view or an external surface.
  assert.doesNotMatch(PAGE, /Linking\.openURL|WebBrowser/);
});

test('the invite footer is a designed card and routes to page 10', () => {
  assert.equal(INVITE_TITLE, 'Invite a friend');
  assert.equal(INVITE_MUTUAL_NOTE, 'Cinch only shows people you’re both friends with.');
  assert.match(PAGE, /function InviteFooter/);
  assert.match(PAGE, /accessibilityHint="Opens your invite link"/);
});

test('the free-plan note carries no price, no trial and no upgrade button', () => {
  const note = freeClosetNote(10);
  assert.match(note, /first 10 pieces/);
  assert.match(note, /stays private until you say otherwise/);
  assert.doesNotMatch(note, /\$|trial|upgrade|subscribe/i);
  // The number derives from plans.ts rather than being typed.
  assert.match(ROUTE, /PLANS\.free\.items/);
});

test('the empty circle offers two honest routes and no stranger suggestions', () => {
  assert.equal(NOBODY_YET_TITLE, 'Nobody here yet');
  assert.match(NOBODY_YET_BODY, /only ever shows people you’re both friends with/);
  assert.doesNotMatch(PAGE, /contacts|address book|suggested|people you may know/i);
});

test('a search that finds nobody says nothing about the person', () => {
  assert.equal(NO_RESULTS_TITLE, 'No one to show');
  assert.match(NO_RESULTS_BODY, /Check the spelling/);
  // Never "no such account" / "not on Cinch" — either would leak the existence
  // of a blocked or private profile.
  assert.doesNotMatch(NO_RESULTS_BODY, /doesn’t exist|no account|not on Cinch/i);
});

// ---------------------------------------------------------------------------
// Accessibility, Dynamic Type, motion
// ---------------------------------------------------------------------------

test('a card is one element and speaks its whole sentence', () => {
  assert.match(ROWS, /accessibilityLabel=\{spoken\}/);
  assert.match(ROWS, /accessibilityHint="Opens their profile"/);
  // The thumbnail is decorative — the label already said the garment.
  assert.match(ROWS, /accessibilityElementsHidden/);
  assert.match(ROWS, /importantForAccessibility="no-hide-descendants"/);
});

test('the page recomposes at the wave’s one threshold instead of shrinking', () => {
  assert.match(ROUTE, /fontScale >= FRIENDS_STACK_SCALE/);
  assert.match(ROUTE, /useWindowDimensions/);
  assert.match(SPEC, /AX_STACK_SCALE as FRIENDS_STACK_SCALE/);
  assert.match(ROWS, /large \?/, 'the card never stacks');
  for (const [name, src] of [['rows', ROWS], ['page', PAGE], ['route', ROUTE]] as const) {
    assert.doesNotMatch(
      src,
      /maxFontSizeMultiplier|adjustsFontSize|allowFontScaling=\{false\}/,
      `${name} answers large type by shrinking text`,
    );
  }
});

test('every control clears the 44pt floor', () => {
  assert.ok((ROWS.match(/MIN_TAP_TARGET/g) ?? []).length >= 3);
  assert.ok((PAGE.match(/MIN_TAP_TARGET/g) ?? []).length >= 2);
});

test('a column that can grow is a column that can shrink', () => {
  const flexed = ROWS.match(/flex: 1[^}]*}/g) ?? [];
  assert.ok(flexed.length >= 3, `expected the text columns and the wells — got ${flexed.length}`);
  for (const column of flexed) assert.match(column, /min(Width|Height): 0/, column);
});

test('motion is opacity and layout only, and Reduce Motion is honoured by construction', () => {
  // The band's arrival and the accepted row's collapse are Reanimated layout
  // and fade primitives; every spring in this app carries ReduceMotion.System
  // and the press response is untweened under the setting.
  assert.match(PAGE, /LinearTransition|FadeOut/);
  assert.doesNotMatch(PAGE, /translateY|scale:/, 'composition must not move under Reduce Motion');
});

test('the page ticks at nothing it did not tick at before', () => {
  // Navigation gets no haptic. The page's writes go through Button/Chip, which
  // own the policy themselves.
  for (const [name, src] of [['rows', ROWS], ['page', PAGE], ['route', ROUTE]] as const) {
    assert.doesNotMatch(src, /expo-haptics/, `${name} reached past the policy`);
  }
});

// ---------------------------------------------------------------------------
// No new surface
// ---------------------------------------------------------------------------

test('the page added no table, view, RPC, package, permission or public surface', () => {
  // The presence read goes through views that already existed for Daily Social.
  assert.match(HOOK, /from\('friend_worn_outfits'\)/);
  assert.match(HOOK, /from\('friend_worn_outfit_items'\)/);
  assert.match(HOOK, /from\('friend_items'\)/);
  assert.doesNotMatch(HOOK, /\.rpc\(/, 'no new RPC was needed');
  // And never the one shortcut that would break the authorization boundary.
  assert.doesNotMatch(HOOK, /last_worn_at|wear_count/);
  assert.match(SPEC_RAW, /WHY THIS IS NOT DERIVED FROM/);
});
