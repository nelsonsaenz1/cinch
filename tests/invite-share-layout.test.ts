/**
 * Invite / Share — the card you hand someone, and the eleven things it refuses
 * to become. Redesign 10.
 *
 * Written to the shape the rest of the wave set: everything the page DECIDES
 * lives in `invite-lines.ts` and is imported and exercised directly; the drawn
 * body is asserted as TEXT, because esbuild cannot parse React Native's Flow
 * source and there is no renderer here.
 *
 * `tests/invite-link.test.ts` already pins the URL grammar and every string
 * this app puts in somebody else's message thread. It is deliberately not
 * duplicated — what this file holds is the PAGE's contract.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  ARRIVALS_FAILED_BODY,
  ARRIVALS_FAILED_TITLE,
  ARRIVALS_HEADING,
  COPIED_ACTION,
  COPIED_HOLD_MS,
  COPY_ACTION,
  EMPTY_BODY,
  EMPTY_TITLE,
  FRESH_DETAIL,
  FRESH_MARK,
  FRESH_WINDOW_MS,
  INVITATION_EYEBROW,
  LINK_FAILED_BODY,
  LINK_FAILED_TITLE,
  LINK_NOTE,
  NO_HANDLE_BODY,
  NO_HANDLE_TITLE,
  OFFLINE_BODY,
  OFFLINE_TITLE,
  SHARE_ACTION,
  SHARE_FAILED_BODY,
  SHARE_FAILED_TITLE,
  PRIMARY_HEIGHT,
  PRIMARY_HEIGHT_AX,
  SECONDARY_HEIGHT,
  SECONDARY_HEIGHT_AX,
  isFreshArrival,
} from '../src/features/invite/invite-lines';
import { inviteUrl, inviteUrlForDisplay } from '../src/features/invite/link';

const PAGE_RAW = readFileSync('src/components/invite/invite-page.tsx', 'utf8');
const ROW_RAW = readFileSync('src/components/invite/arrival-row.tsx', 'utf8');
const ROUTE_RAW = readFileSync('src/app/invite.tsx', 'utf8');
const LINES_RAW = readFileSync('src/features/invite/invite-lines.ts', 'utf8');
const CLIPBOARD_RAW = readFileSync('src/features/invite/clipboard.ts', 'utf8');
const QUERIES_RAW = readFileSync('src/features/invite/queries.ts', 'utf8');
const MIGRATION_RAW = readFileSync(
  'supabase/migrations/20260810120100_invite_links.sql',
  'utf8',
);
/** The block guard, added after the redesign-10 audit found the roster kept one. */
const ARRIVALS_FIX_RAW = readFileSync(
  'supabase/migrations/20260823000000_invite_arrivals_respects_blocks.sql',
  'utf8',
);
/** The function as it SHIPS — the replacement, not the original definition. */
const ARRIVALS_FN = ARRIVALS_FIX_RAW.slice(
  ARRIVALS_FIX_RAW.indexOf('create or replace function public.invite_arrivals'),
);

/** Comments describe the intent; the code is what ships. */
function code(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

const PAGE = code(PAGE_RAW);
const ROW = code(ROW_RAW);
const ROUTE = code(ROUTE_RAW);
const LINES = code(LINES_RAW);

// ---------------------------------------------------------------------------
// One permanent link, and nothing that manages it
// ---------------------------------------------------------------------------

test('the link is the handle, and there is exactly one of them forever', () => {
  assert.equal(inviteUrl('priyar'), 'https://cinchstyle.com/i/@priyar');
  assert.equal(inviteUrlForDisplay('priyar'), 'cinchstyle.com/i/@priyar');
  // The card prints the address without its scheme; everything that SENDS it
  // keeps the scheme or it will not linkify.
  assert.match(ROUTE, /inviteUrlForDisplay\(/);
  assert.match(ROUTE, /link\.url/);
});

test('nothing on this page mints, expires or revokes anything', () => {
  for (const [name, src] of [
    ['page', PAGE],
    ['row', ROW],
    ['route', ROUTE],
    ['lines', LINES],
  ] as const) {
    assert.doesNotMatch(src, /expir|revoke|regenerate|rotate/i, `${name} manages the link`);
    // `\btoken\b` rather than a bare substring: `@/theme/tokens` is an import
    // path, not an invite token, and a guard that fires on it teaches people to
    // delete the guard.
    assert.doesNotMatch(
      src,
      /inviteCode|invite_code|per-invite|\btokens?\b(?!';)/i,
      `${name} mints a code`,
    );
  }
  // And there is no table to hold one. The migration says so in its own words.
  assert.match(MIGRATION_RAW, /There is no invites table/);
});

test('the page reads no contact book and tracks no recipient', () => {
  for (const [name, src] of [['page', PAGE], ['route', ROUTE], ['row', ROW]] as const) {
    assert.doesNotMatch(src, /Contacts|expo-contacts|addressBook/i, `${name} reaches for contacts`);
    assert.doesNotMatch(src, /recipient|sentTo|sent_to|deliver/i, `${name} tracks a recipient`);
  }
});

test('there is no waiting-on row, because the app cannot know one', () => {
  // The atlas drew "Waiting on" — named recipients with send times — and the
  // rules rule it out: no per-invite code and no contact upload means the app
  // cannot know a link was sent to anybody.
  assert.doesNotMatch(PAGE, /waiting on|Waiting on|pending invite/i);
  assert.equal(ARRIVALS_HEADING, 'Came in from your link');
});

test('the share sheet’s destination is never learned or reported', () => {
  // `Share.share` resolves with an activity type on iOS; the page must not read
  // it, store it or send it anywhere.
  assert.doesNotMatch(ROUTE, /activityType|activity_type|\.action\b/);
  assert.match(ROUTE, /\.then\(\(\) => \{\}\)/, 'the resolved share must be ignored');
});

// ---------------------------------------------------------------------------
// No counts, no badges
// ---------------------------------------------------------------------------

test('nothing on this page is a count of anything', () => {
  for (const [name, src] of [['page', PAGE], ['row', ROW], ['lines', LINES]] as const) {
    assert.doesNotMatch(src, /\.length\s*\}/, `${name} prints a length`);
    assert.doesNotMatch(src, /\b\d+ (people|friends|invites|arrivals|new)\b/i, `${name} counts`);
  }
  // The one `.length` the page is allowed is the empty-vs-populated branch and
  // the fresh/earlier split — neither of which is printed.
  assert.match(PAGE, /props\.arrivals\.length === 0/);
});

test('the fresh mark is a word, never a badge and never a number', () => {
  assert.equal(FRESH_MARK, 'Just arrived');
  assert.doesNotMatch(FRESH_MARK, /\d/);
  // No "N new", no dot-with-a-count, no unread tally anywhere.
  assert.doesNotMatch(ROW, /badge|unread|count/i);
  // It ages out on its own — there is nothing to tap and no read state.
  assert.doesNotMatch(ROW, /onDismiss|markRead|seen/i);
  assert.doesNotMatch(ROUTE, /markRead|seen|unread/i);
});

test('the mark ages out by itself, on a window the client owns', () => {
  const now = new Date(2026, 7, 18, 12, 0, 0, 0);
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000).toISOString();
  assert.equal(FRESH_WINDOW_MS, 48 * 60 * 60 * 1000);
  assert.equal(isFreshArrival(hoursAgo(1), now), true);
  assert.equal(isFreshArrival(hoursAgo(47), now), true);
  assert.equal(isFreshArrival(hoursAgo(49), now), false);
  // A row that declines to claim a date must not claim a mark either.
  assert.equal(isFreshArrival(null, now), false);
  assert.equal(isFreshArrival(undefined, now), false);
  assert.equal(isFreshArrival('not a date', now), false);
});

// ---------------------------------------------------------------------------
// What an arrival proves — and the three things it does not
// ---------------------------------------------------------------------------

test('an arrival proves only that they joined through the link', () => {
  assert.equal(FRESH_DETAIL, 'They joined Cinch from your link.');
  // Not a friendship, not mutual authorization, not closet visibility.
  for (const [name, src] of [['page', PAGE_RAW], ['row', ROW_RAW], ['lines', LINES_RAW]] as const) {
    assert.doesNotMatch(
      code(src),
      /you are friends|already friends|their closet is|added to each other/i,
      `${name} claims a relationship an arrival does not prove`,
    );
  }
});

test('the roster outlives the friendship, which is why it claims none', () => {
  // `invited_by` is written once and never cleared; the two follow edges the
  // same RPC creates can be undone by a removal, and a block deletes them
  // outright. So a row is not evidence of a current friendship.
  assert.match(MIGRATION_RAW, /invited_by is null/, 'invited_by must be write-once');
  assert.match(MIGRATION_RAW, /insert into public\.follows/);
  // And the shipped read does NOT gate on friendship — a row that vanished
  // when a friendship ended would report that ending, which is the inference
  // the page exists to refuse.
  assert.doesNotMatch(ARRIVALS_FN, /public\.follows|is_friend/, 'the roster became a friends list');
});

test('but a block removes the arrival, in either direction', () => {
  // The one guard the permanent fact does need. `invited_by` cannot be cleared,
  // so without this a blocked person keeps a row with their name and handle on
  // the inviter's private roster — while every other read in this schema
  // refuses across a block.
  assert.match(ARRIVALS_FN, /not public\.blocked_between\(\(select auth\.uid\(\)\), p\.user_id\)/);
  // Through the schema's one definition of "blocked", which is already
  // symmetric, rather than a second hand-written copy of the predicate.
  assert.doesNotMatch(ARRIVALS_FN, /user_blocks/, 'the predicate was copied instead of called');
  // And the replacement keeps the signature, so no generated type moves.
  assert.match(
    ARRIVALS_FIX_RAW,
    /returns table \(user_id uuid, display_name text, username text, joined_at timestamptz\)/,
  );
  assert.match(ARRIVALS_FIX_RAW, /create or replace function public\.invite_arrivals\(\)/);
  // Still authenticated-only after the replacement.
  assert.match(ARRIVALS_FIX_RAW, /grant execute on function public\.invite_arrivals\(\) to authenticated/);
  assert.match(ARRIVALS_FIX_RAW, /revoke all on function public\.invite_arrivals\(\) from anon/);
});

// ---------------------------------------------------------------------------
// Two reads that fail independently
// ---------------------------------------------------------------------------

test('the link and the arrivals are separate queries with separate states', () => {
  assert.match(QUERIES_RAW, /inviteArrivalsKey = \['invite-arrivals'\]/);
  assert.match(QUERIES_RAW, /useMyProfile\(\)/, 'the link rides the profile read');
  // Four independent props, four independent branches.
  for (const prop of ['linkError', 'linkLoading', 'arrivalsError', 'arrivalsLoading']) {
    assert.match(PAGE, new RegExp(`props\\.${prop}`), `${prop} is not branched on`);
  }
});

test('a failed link never says the invitation changed', () => {
  assert.equal(LINK_FAILED_TITLE, 'Couldn’t load your link');
  assert.match(LINK_FAILED_BODY, /hasn’t changed/);
  assert.match(LINK_FAILED_BODY, /Nothing about your invitation has been altered/);
});

test('a failed roster never renders as "nobody has come in yet"', () => {
  assert.equal(ARRIVALS_FAILED_TITLE, 'Couldn’t load who came in');
  assert.match(ARRIVALS_FAILED_BODY, /not an empty list/);
  assert.match(ARRIVALS_FAILED_BODY, /Nobody has been removed/);
  assert.notEqual(ARRIVALS_FAILED_TITLE, EMPTY_TITLE);
});

test('offline keeps the link shareable and withholds the roster', () => {
  // The asymmetry is the whole point: the link is permanent so a cached one is
  // still true; the roster can have changed, so it is withheld not shown stale.
  assert.equal(OFFLINE_TITLE, 'You’re offline');
  assert.match(OFFLINE_BODY, /Your link never changes/);
  assert.match(OFFLINE_BODY, /hidden until you’re back on a connection/);
  assert.match(PAGE, /props\.arrivalsWithheld/);
  // Withholding replaces the roster only — it never disables Share.
  const arrivalsBlock = PAGE.slice(PAGE.indexOf('function Arrivals'));
  assert.match(arrivalsBlock, /arrivalsWithheld/);
  assert.doesNotMatch(PAGE, /arrivalsWithheld[\s\S]{0,200}onShare/);
});

// ---------------------------------------------------------------------------
// Share and copy
// ---------------------------------------------------------------------------

test('a cancelled share is not a success and changes nothing', () => {
  // `dismissedAction` lands in the fulfilled branch and does nothing at all —
  // no toast, no "sent", no arrival row, nothing beyond the enum RN returned.
  assert.match(ROUTE, /\.then\(\(\) => \{\}\)/);
  // Only a rejection — the sheet could not be presented — is reported.
  assert.match(ROUTE, /\.catch\(\(\) => setShareFailed\(true\)\)/);
  assert.equal(SHARE_FAILED_TITLE, 'The share sheet didn’t open');
  assert.match(SHARE_FAILED_BODY, /^Nothing was sent/);
});

test('the copy confirmation is exactly four seconds and moves nothing', () => {
  assert.equal(COPIED_HOLD_MS, 4000);
  assert.match(ROUTE, /setTimeout\(\(\) => setCopied\(false\), COPIED_HOLD_MS\)/);
  // Same control, same box, same place: only the word and the fill change.
  assert.equal(COPY_ACTION, 'Copy link');
  assert.equal(COPIED_ACTION, 'Copied');
  assert.match(PAGE, /props\.copied \? COPIED_ACTION : COPY_ACTION/);
  // The box is a fixed minHeight around the control in BOTH states, so a
  // confirmation cannot shift anything above or below it.
  assert.match(PAGE, /minHeight: large \? SECONDARY_HEIGHT_AX : SECONDARY_HEIGHT/);
  assert.ok(SECONDARY_HEIGHT > 0 && SECONDARY_HEIGHT_AX > SECONDARY_HEIGHT);
});

test('the clipboard is written and never read', () => {
  // Reading prompts an iOS 16+ paste permission, and this page has no reason to
  // read: it wrote the string it would be checking for.
  assert.match(CLIPBOARD_RAW, /setStringAsync/);
  assert.doesNotMatch(CLIPBOARD_RAW, /getStringAsync|hasStringAsync|getImageAsync/);
  assert.doesNotMatch(ROUTE, /getStringAsync|hasStringAsync/);
  // And only this one file may name the module at all.
  assert.doesNotMatch(ROUTE, /expo-clipboard/);
  assert.doesNotMatch(PAGE, /expo-clipboard/);
});

test('copy is absent, never disabled, when the module is missing', () => {
  assert.match(ROUTE, /CLIPBOARD_AVAILABLE \? copy : undefined/);
  assert.match(PAGE, /props\.onCopy \?/);
});

test('the confirmation is only ever claimed when the write happened', () => {
  const copyBlock = ROUTE.slice(ROUTE.indexOf('const copy ='));
  assert.match(copyBlock, /if \(!ok\) return;/);
  // Both the confirmation and the event live inside the success branch.
  assert.ok(copyBlock.indexOf('if (!ok) return;') < copyBlock.indexOf("track('invite_copied')"));
  assert.ok(copyBlock.indexOf('if (!ok) return;') < copyBlock.indexOf('setCopied(true)'));
});

// ---------------------------------------------------------------------------
// Copy — verbatim
// ---------------------------------------------------------------------------

test('the words are the artifact’s words', () => {
  assert.equal(INVITATION_EYEBROW, 'Your invitation');
  assert.equal(SHARE_ACTION, 'Share your link');
  assert.equal(LINK_NOTE, 'One link, yours permanently. Send it to as many people as you like.');
  assert.equal(EMPTY_TITLE, 'Nobody has come in yet');
  assert.match(EMPTY_BODY, /^When someone joins Cinch through your link/);
  assert.match(EMPTY_BODY, /The link is yours permanently/);
  assert.equal(NO_HANDLE_TITLE, 'Choose a handle first');
  assert.match(NO_HANDLE_BODY, /built from your handle/);
});

test('the empty state says nothing about how many were invited', () => {
  // There is no record of who the link went to, by design and permanently.
  assert.doesNotMatch(EMPTY_BODY, /\d/);
  assert.doesNotMatch(EMPTY_BODY, /sent|invited \d|nobody accepted/i);
});

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

test('the page emits exactly the two events it always did, with the same shapes', () => {
  const events = [...ROUTE.matchAll(/track\('([a-z_]+)'/g)].map((m) => m[1]);
  assert.deepEqual(events.sort(), ['invite_copied', 'invite_shared']);
  assert.match(ROUTE, /track\('invite_shared', \{ has_link: true, surface: 'invite_screen' \}\)/);
  assert.match(ROUTE, /track\('invite_copied'\)/);
});

test('no payload carries a handle, a URL, a name or a count', () => {
  const payloads = [...ROUTE.matchAll(/track\('[a-z_]+',\s*(\{[^}]*\})/g)].map((m) => m[1]!);
  for (const payload of payloads) {
    assert.doesNotMatch(payload, /link\.|handle|username|url|name|userId|arrivals|length/i, payload);
  }
  // The roster emits nothing at all: no impression, no open, no per-row event.
  const arrivalsBlock = ROUTE.slice(ROUTE.indexOf('onOpenArrival'));
  assert.doesNotMatch(arrivalsBlock, /track\(/);
});

// ---------------------------------------------------------------------------
// What this page did not add
// ---------------------------------------------------------------------------

test('no new package, permission, vendor, backend or billing change', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
    dependencies: Record<string, string>;
  };
  // react-native-svg was already installed; nothing was added for this page.
  assert.ok(pkg.dependencies['react-native-svg'], 'react-native-svg must already be present');
  assert.equal(pkg.dependencies['react-native-qrcode-svg'], undefined);
  assert.equal(pkg.dependencies['qrcode'], undefined);
  for (const [name, src] of [['page', PAGE], ['row', ROW], ['route', ROUTE]] as const) {
    assert.doesNotMatch(src, /usePlan|useGate|Placement|PLANS/, `${name} touches billing`);
    assert.doesNotMatch(src, /requestPermission|Permissions/, `${name} asks a permission`);
  }
});

test('the trial architecture and the absence of intro offers are untouched', () => {
  for (const [name, src] of [['page', PAGE], ['route', ROUTE], ['lines', LINES]] as const) {
    assert.doesNotMatch(src, /trial|introductory|introOffer/i, `${name} touches the trial`);
  }
});

// ---------------------------------------------------------------------------
// Accessibility and Dynamic Type
// ---------------------------------------------------------------------------

test('the page recomposes at the wave’s one threshold instead of shrinking', () => {
  assert.match(ROUTE, /fontScale >= INVITE_STACK_SCALE/);
  assert.match(LINES_RAW, /AX_STACK_SCALE as INVITE_STACK_SCALE/);
  assert.ok(PRIMARY_HEIGHT_AX > PRIMARY_HEIGHT);
  assert.ok(SECONDARY_HEIGHT_AX > SECONDARY_HEIGHT);
  for (const [name, src] of [['page', PAGE], ['row', ROW], ['route', ROUTE]] as const) {
    assert.doesNotMatch(
      src,
      /maxFontSizeMultiplier|adjustsFontSize|allowFontScaling=\{false\}/,
      `${name} answers large type by shrinking text`,
    );
  }
});

test('the mark survives at large type as a word rather than only a colour', () => {
  // The frame drops the pill at AX; a mark carried only by the blush ground
  // would make colour the sole carrier of meaning.
  assert.match(ROW, /arrival\.isNew && large/);
  assert.match(ROW, /arrival\.isNew && !large/);
});

test('a row is one element and speaks the mark it wears', () => {
  assert.match(ROW, /accessibilityLabel=\{spoken\}/);
  assert.match(ROW, /arrival\.isNew \? FRESH_MARK : null/);
  assert.match(ROW, /accessibilityHint=\{onPress \? 'Opens their profile' : undefined\}/);
});

test('the handle is never truncated, and the name may be', () => {
  // A shortened name is still the person; a shortened handle is a different
  // address, and this page is about an address.
  assert.match(ROW, /numberOfLines=\{large \? undefined : 1\}/);
  const handleBlock = ROW.slice(ROW.indexOf('arrival.handle ?'));
  assert.doesNotMatch(handleBlock.slice(0, 260), /numberOfLines/);
});
