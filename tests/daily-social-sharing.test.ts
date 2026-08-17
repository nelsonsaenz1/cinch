/**
 * DS-07 — the switch that shares what you wear, and the promise printed beside
 * it.
 *
 * The failure this file exists to prevent is a copy failure with a data
 * consequence. A boolean plus a seven-day window would have exposed up to a
 * week of already-worn looks the instant sharing was switched on; the schema no
 * longer can, because `friend_worn_outfits` demands
 * `worn_at >= worn_outfits_shared_since` and a `before update` trigger stamps
 * that boundary with `now()` however the client writes it. What is left to get
 * wrong is the sentence: a line reading "friends can see your last seven days"
 * would be false in exactly the direction that makes somebody regret tapping,
 * and no pgTAP case can catch a sentence.
 *
 * So half of this file reads the words and half reads the write, and the two
 * halves have to agree: the copy says sharing starts from now, and the mutation
 * must actually let the database decide when now is.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  WORN_SHARING_FOOTER,
  WORN_SHARING_LABEL,
  WORN_SHARING_NOTE,
  WORN_SHARING_OVERRIDDEN_REASON,
  WORN_SHARING_SCOPE,
  WORN_SHARING_SECTION,
  wornSharingState,
} from '@/features/privacy/worn-sharing-copy';

const body = (path: string) =>
  readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');

/** The migration without its `--` prose — see `daily-social-feed.test.ts`. */
const MIGRATION = readFileSync('supabase/migrations/20260817000000_daily_social.sql', 'utf8')
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n');

const HOOK = body('src/features/daily-social/use-worn-sharing.ts');
const PAGE = body('src/components/privacy/closet-visibility-page.tsx');
const ROUTE = body('src/app/privacy/visibility.tsx');

const ALL_COPY = [
  WORN_SHARING_SECTION,
  WORN_SHARING_LABEL,
  WORN_SHARING_NOTE,
  WORN_SHARING_FOOTER,
  ...WORN_SHARING_SCOPE.map((scope) => scope.title),
  WORN_SHARING_OVERRIDDEN_REASON,
  wornSharingState(true),
  wornSharingState(false),
].join(' ');

// ---------------------------------------------------------------------------
// 1 · The promise: from now, and never backwards
// ---------------------------------------------------------------------------

test('the copy says plainly that sharing starts from now', () => {
  assert.match(WORN_SHARING_NOTE, /from the moment you tap it/i);
  assert.match(wornSharingState(true), /from now/i);
});

test('the copy says nothing you already wore is ever shared', () => {
  assert.match(WORN_SHARING_NOTE, /nothing you wore before is ever shared/i);
});

test('nothing in the copy implies a week of your history is about to appear', () => {
  // The exact sentence a boolean-only implementation would have earned, and
  // the one this must never say. "Seven days" is allowed and required; "your
  // last seven days" is the lie.
  assert.doesNotMatch(
    ALL_COPY,
    /your (last|past|previous|recent) (seven|7) days|last week|past week|already wore.{0,40}(see|shared|visible)|history/i,
  );
});

test('switching off and on again is described as starting fresh, not filling in', () => {
  // The trigger rewrites the boundary on every off→on transition, so the gap is
  // never backfilled. Somebody who turns this off for a week and back on must
  // not expect that week to arrive.
  assert.match(WORN_SHARING_NOTE, /off and on again starts fresh/i);
  assert.match(MIGRATION, /new\.worn_outfits_shared_since := now\(\)/);
});

test('seven days is stated, in both the switch line and the paragraph', () => {
  assert.match(wornSharingState(true), /seven days/i);
  assert.match(WORN_SHARING_NOTE, /seven days/i);
  assert.match(MIGRATION, /interval '7 days'/);
});

// ---------------------------------------------------------------------------
// 2 · What crosses, and the five things that never do
// ---------------------------------------------------------------------------

test('the copy names what a friend actually sees: the pieces, the name, the day', () => {
  assert.match(WORN_SHARING_NOTE, /pieces in a look/i);
  assert.match(WORN_SHARING_NOTE, /its name/i);
  assert.match(WORN_SHARING_NOTE, /day you wore it/i);
});

test('the copy names all five omissions, including the money one', () => {
  // Every one of these is attached to the same outfit somewhere else in this
  // app. Cost per wear is the one most easily dropped from a list of five and
  // the most sensitive of them, exactly as it was among the four flags above.
  for (const omission of [/your note/i, /the weather/i, /the occasion/i, /your rating/i, /per wear/i]) {
    assert.match(WORN_SHARING_NOTE, omission, `an omission is missing from the note`);
  }
  assert.match(WORN_SHARING_NOTE, /never shared/i);
});

test('the copy never promises privacy from anyone but friends', () => {
  // Same rule the four flags follow: this governs one audience, and the public
  // boundary is `profiles.visibility`, a different control.
  assert.doesNotMatch(ALL_COPY, /\banyone\b|\beveryone can\b|\bthe public\b|\bnobody can\b/i);
  assert.match(WORN_SHARING_NOTE, /friends you follow back/i);
});

test('nothing suggests sharing is already on, or that looks are already waiting', () => {
  assert.match(wornSharingState(false), /^Off\./);
  assert.doesNotMatch(ALL_COPY, /already (sharing|shared|waiting)|are waiting/i);
});

test('the scope list is the five facts DS-07 heads, and the note is derived from it', () => {
  // Five headed facts rather than one paragraph: somebody at a privacy switch
  // is LOOKING FOR the thing they are worried about, and five facts running
  // together is where a reader decides they have understood and stops.
  assert.deepEqual(
    WORN_SHARING_SCOPE.map((scope) => scope.title),
    [
      'Mutual friends only',
      'Sharing starts now',
      'Each look, up to seven days',
      'Pieces, outfit name, when worn',
      'Hidden garments stay hidden',
    ],
  );

  // The census is DERIVED, not a second copy — a hand-assembled one passes
  // after the rendered words have moved, which is the whole failure it exists
  // to catch. Every sentence the page draws is a sentence this file reads.
  assert.equal(WORN_SHARING_NOTE, WORN_SHARING_SCOPE.map((scope) => scope.body).join(' '));

  for (const scope of WORN_SHARING_SCOPE) {
    assert.ok(scope.title.length > 0 && scope.body.length > 0);
    assert.match(scope.body, /\.$/, `"${scope.title}" is not a sentence`);
  }
});

test('a piece its owner hid stays hidden inside a shared look, and the copy says so', () => {
  // The atlas heads this and no sentence in the app said it. Somebody who has
  // taken the trouble to hide a piece is owed the fact that the trouble still
  // counts — and this is the OWNER's own screen, so saying it here reveals
  // nothing to anybody. Nothing on the friend-facing side may hint at it, which
  // is what `daily-social-copy.test.ts` holds.
  const hidden = WORN_SHARING_SCOPE.find((scope) => scope.title === 'Hidden garments stay hidden');
  assert.ok(hidden, 'the hidden-garment fact left the scope list');
  assert.match(hidden.body, /left out of a shared look/i);
  // Not a count, here either. "One of your pieces" would be the same
  // measurement, told to the person it belongs to and then to nobody else.
  assert.doesNotMatch(hidden.body, /\d/);
});

test('the way back out is stated, and it is immediate', () => {
  // §6's "revocation is immediate" had no sentence anywhere a person could read
  // it: everything printed beside the switch described turning sharing ON.
  // Knowing the way back is instant is what makes trying it a small decision.
  assert.match(WORN_SHARING_FOOTER, /turn it off/i);
  assert.match(WORN_SHARING_FOOTER, /immediately/i);
  // And the SQL is why the word is honest — the boundary is read per query, so
  // the next fetch on a friend's device already returns nothing.
  assert.match(MIGRATION, /worn_outfits_shared_since is not null/);
});

test('the page draws the scope list and the footer, not the paragraph', () => {
  assert.match(PAGE, /WORN_SHARING_SCOPE\.map/);
  assert.match(PAGE, /\{WORN_SHARING_FOOTER\}/);
  // The derived census is testable prose, not something to render — drawing it
  // as well would print every sentence twice.
  assert.doesNotMatch(PAGE, /WORN_SHARING_NOTE/);
});

// ---------------------------------------------------------------------------
// 3 · The two state lines
// ---------------------------------------------------------------------------

test('on and off say different things, and both are sentences', () => {
  assert.notEqual(wornSharingState(true), wornSharingState(false));
  for (const shared of [true, false]) {
    assert.match(wornSharingState(shared), /\.$/);
    assert.ok(wornSharingState(shared).length > 0);
  }
});

test('the state line describes the world, not the switch’s action', () => {
  // "Friends can open your closet." rather than "Tap to share." A control that
  // describes its own action reads as an instruction; one that describes the
  // world reads as a fact you can change.
  assert.doesNotMatch(ALL_COPY, /\btap to\b|\bturn on to\b|\bswitch on to\b/i);
});

test('no copy on this control is a placeholder', () => {
  for (const line of [WORN_SHARING_SECTION, WORN_SHARING_LABEL, WORN_SHARING_NOTE]) {
    assert.doesNotMatch(line, /^[—–-]+$/, 'a dash standing in for copy');
    assert.doesNotMatch(line, /TODO|TBD|Lorem|placeholder/i);
  }
});

// ---------------------------------------------------------------------------
// 4 · The write — the client says on or off, the database says when
// ---------------------------------------------------------------------------

test('sharing is stored in one column, and off is null', () => {
  assert.match(HOOK, /worn_outfits_shared_since: shared \? new Date\(\)\.toISOString\(\) : null/);
});

test('the write is an update, scoped to the owner, never an upsert', () => {
  // An upsert would create a profile row as a side effect of a privacy switch,
  // giving the account a username-less profile it never asked for — the same
  // reasoning `use-closet-visibility.ts` gives for the four flags.
  assert.match(HOOK, /\.from\('profiles'\)/);
  assert.match(HOOK, /\.update\(/);
  assert.match(HOOK, /\.eq\('user_id', userId\)/);
  assert.doesNotMatch(HOOK, /\.upsert\(/);
});

test('the client does not fight the trigger for the instant', () => {
  // The trigger's override is the enforcement, not a courtesy: `profiles: owner
  // can update` is a plain RLS policy, so an owner could otherwise write 2020
  // into their own row and expose everything. Nothing here may compare, retry,
  // verify or re-send the timestamp.
  assert.match(MIGRATION, /before update on profiles/);
  assert.match(MIGRATION, /new\.worn_outfits_shared_since := old\.worn_outfits_shared_since/);
  assert.doesNotMatch(HOOK, /Date\.parse|getTime\(\)|>=|<=/);
});

test('the hook exposes a boolean, never the instant itself', () => {
  // The screen has no use for the timestamp and every render of it would be an
  // opportunity to imply the wrong thing about what it means.
  assert.match(HOOK, /Promise<boolean>/);
  assert.match(HOOK, /Boolean\(row\?\.worn_outfits_shared_since\)/);
  assert.doesNotMatch(PAGE, /worn_outfits_shared_since|sharedSince|sinceDate/);
});

// ---------------------------------------------------------------------------
// 5 · Default off, and this packet does not move it
// ---------------------------------------------------------------------------

test('the column is nullable with no default, so every account starts off', () => {
  assert.match(MIGRATION, /add column if not exists worn_outfits_shared_since timestamptz;/);
  assert.doesNotMatch(MIGRATION, /worn_outfits_shared_since timestamptz[^;]*default/);
});

test('an absent row, a signed-out reader and a pending read all read as off', () => {
  assert.match(HOOK, /if \(!userId\) return false;/);
  assert.match(ROUTE, /wornSharing=\{wornSharing \?\? false\}/);
});

test('a failed write puts the switch back where it was', () => {
  assert.match(HOOK, /onMutate:/);
  assert.match(HOOK, /setQueryData\(WORN_SHARING_KEY, context\.previous\)/);
  assert.match(HOOK, /onSettled:/);
  assert.match(HOOK, /invalidateQueries\(\{ queryKey: WORN_SHARING_KEY \}\)/);
});

// ---------------------------------------------------------------------------
// 6 · A row on a screen that already exists
// ---------------------------------------------------------------------------

test('DS-07 adds no route of its own', () => {
  // Contract §5.2: a new route is a contract change, not an implementation
  // detail. This is a row beside the four flags, which answer the same question
  // about the same audience.
  assert.deepEqual(readdirSync('src/app/privacy').sort(), [
    'ai.tsx',
    'delete.tsx',
    'export.tsx',
    'visibility.tsx',
  ]);
});

test('DS-07 uses the existing toggle primitive rather than a new component', () => {
  assert.match(PAGE, /import \{ ToggleRow \} from '@\/components\/ui\/settled-row'/);
  assert.match(PAGE, /label=\{WORN_SHARING_LABEL\}/);
  assert.match(PAGE, /state=\{wornSharingState\(wornSharing\)\}/);
  assert.match(PAGE, /value=\{wornSharing\}/);
});

test('the route wires the switch to the real mutation', () => {
  assert.match(ROUTE, /useWornSharing\(\)/);
  assert.match(ROUTE, /setWornSharing\.mutate\(\{ shared \}\)/);
});

test('the switch goes inert with the closet, for a reason the SQL states', () => {
  // `friend_worn_outfits` carries `not p.closet_hidden`, so with the closet
  // hidden no look crosses however this is set. A live switch there would be a
  // control that lies about its own effect — the argument the three stat
  // switches above it already make.
  assert.match(MIGRATION, /and not p\.closet_hidden/);
  // The JSX use, not the import at the top of the file — the import is the
  // first occurrence, and slicing from it walks the whole page.
  const from = PAGE.indexOf('label={WORN_SHARING_LABEL}');
  assert.ok(from > 0, 'the DS-07 row is not on the page');
  const row = PAGE.slice(from, from + PAGE.slice(from).indexOf('/>'));
  assert.match(row, /overridden=\{closetHidden\}/);
  assert.match(row, /overriddenReason=\{WORN_SHARING_OVERRIDDEN_REASON\}/);
  assert.match(WORN_SHARING_OVERRIDDEN_REASON, /closet is hidden/i);
});

test('nothing on this surface animates, so Reduce Motion has nothing to reduce', () => {
  assert.doesNotMatch(
    readFileSync('src/components/privacy/closet-visibility-page.tsx', 'utf8'),
    /Animated|withTiming|withSpring|useSharedValue|LayoutAnimation/,
  );
});

test('both acceptance fixtures draw the new row, off by default and inert when hidden', () => {
  // §7 wants DS-07 at standard type and at AX-XXXL, and the state that only
  // appears in combination — the closet hidden — has its own deep link.
  const plain = body('src/dev-fixtures/dev-closet-visibility.tsx');
  const hidden = body('src/dev-fixtures/dev-closet-visibility-hidden.tsx');
  assert.match(plain, /useState\(false\)/);
  assert.match(plain, /wornSharing=\{wornSharing\}/);
  assert.match(hidden, /wornSharing=\{wornSharing\}/);
});

// ---------------------------------------------------------------------------
// 7 · Measurement — a boolean, and nothing that narrows to a person
// ---------------------------------------------------------------------------

test('turning sharing on or off reports a boolean and nothing else', () => {
  assert.match(HOOK, /wornSharingChangedProps\(shared\)/);
  assert.doesNotMatch(HOOK, /userId[^\n]*track|track\([^)]*userId/);
});

test('the event fires on the write, not on the tap', () => {
  // An optimistic switch that rolled back did not change anything, and an
  // opt-in rate counted from taps would over-report the number this unit lives
  // or dies on.
  assert.match(HOOK, /onSuccess: \(_data, \{ shared \}\) => \{/);
});
