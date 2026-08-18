/**
 * Profile — your own room. The layout bargain, and the decisions under it.
 * Redesign 07.
 *
 * Written to the shape `trips-list-layout.test.ts` and
 * `trip-detail-layout.test.ts` set: the drawn body is asserted as TEXT, because
 * esbuild cannot parse React Native's Flow source and there is no renderer in
 * this runner; everything the page DECIDES before it draws lives in
 * `profile-spec.ts` and is imported and exercised directly.
 *
 * This page has two things to get wrong that no other page in the wave does.
 *
 * The first is the ORDER, which is not taste: directive §7 is the founder's own
 * spec, and a rail moved above another rail is the one change nobody would file
 * as a bug. It is pinned twice below — as a list, and as the sequence the body
 * actually draws.
 *
 * The second is LOSS. Profile is the surface UX-05 split in half, and this
 * rebuild moves the gear into an overflow control; every capability that split
 * accounted for still has to be reachable. `tests/profile-settings-split.test.ts`
 * holds that reconciliation in both directions and is the other half of this
 * file — it is deliberately not duplicated here.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  CHEVRON_SIZE,
  CHEVRON_SIZE_AX,
  CLOSET_COLUMNS,
  CLOSET_COLUMNS_AX,
  CLOSET_TILES,
  CTA_MIN_HEIGHT,
  FAVORITE_TILES,
  MOST_WORN_TILES,
  MORE_SIZE,
  PLAN_ROW_MIN_HEIGHT,
  PLAN_ROW_MIN_HEIGHT_AX,
  PROFILE_COPY,
  PROFILE_SECTIONS,
  PROFILE_STACK_SCALE,
  RAIL_TILE_HEIGHT,
  RAIL_TILE_HEIGHT_AX,
  RAIL_TILE_WIDTH,
  RAIL_TILE_WIDTH_AX,
  TASTE_THRESHOLD,
  capacityLine,
  costPerWearFigure,
  favoritesPrivacyLine,
  friendsLabel,
  friendsTone,
  joinNaturally,
  learnedLine,
  planDoorFor,
  profileBodyState,
  statMarks,
} from '../src/features/profile/profile-spec';
import { PLANS } from '../src/features/billing/plans';
import { AX_STACK_SCALE } from '../src/features/closet/dynamic-type';

const RAW = readFileSync('src/components/profile/profile-body.tsx', 'utf8');
const ROUTE_RAW = readFileSync('src/app/profile.tsx', 'utf8');
const SPEC_RAW = readFileSync('src/features/profile/profile-spec.ts', 'utf8');
const FIXTURES_RAW = readFileSync('src/features/profile/profile-fixtures.ts', 'utf8');
const LAYOUT_RAW = readFileSync('src/app/_layout.tsx', 'utf8');

/** Comments describe the intent; the code is what ships. */
function code(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

const CODE = code(RAW);
const ROUTE = code(ROUTE_RAW);
const SPEC = code(SPEC_RAW);
const FIXTURES = code(FIXTURES_RAW);

// ---------------------------------------------------------------------------
// The order, which is the brief
// ---------------------------------------------------------------------------

test('the page is the order the founder asked for', () => {
  assert.deepEqual(
    [...PROFILE_SECTIONS],
    ['identity', 'most-worn', 'favorites', 'marks', 'plan-door', 'closet'],
    'directive §7 sets this sequence and it is not a preference',
  );
});

test('the body draws the sections in that sequence and no other', () => {
  // The ready state is the one frame that carries all six, so its order IS the
  // page's order. Read as positions in the source rather than as a shape,
  // because a re-ordered JSX block is exactly the change that would otherwise
  // pass every other test in this file.
  const ready = CODE.slice(CODE.indexOf('function ReadyBody'));
  const marks = [
    ['most worn', ready.indexOf('<MostWornRail')],
    ['favorites', ready.indexOf('<FavoritesRail')],
    ['marks', ready.indexOf('<Marks')],
    ['plan door', ready.indexOf('<PlanRow')],
    ['closet grid', ready.indexOf('<ClosetGrid')],
  ] as const;
  for (const [name, at] of marks) assert.ok(at > 0, `${name} is not drawn at all`);
  for (let i = 1; i < marks.length; i += 1) {
    assert.ok(
      marks[i]![1] > marks[i - 1]![1],
      `${marks[i]![0]} is drawn before ${marks[i - 1]![0]}`,
    );
  }

  // Identity is above all of them, and outside the state switch, because it is
  // the one block every frame shares.
  const page = CODE.slice(CODE.indexOf('export function ProfileBody'));
  assert.ok(
    page.indexOf('<Identity') < page.indexOf("view.state === 'ready'"),
    'identity fell below the content it belongs to',
  );
});

test('the closet is the last thing on the page, and it bleeds to both edges', () => {
  // "closet photos at the bottom as a tight grid" — the grid takes no gutter of
  // its own, which is what makes it bleed. Its header keeps one.
  const grid = CODE.slice(CODE.indexOf('function ClosetGrid'), CODE.indexOf('function PrimaryCta'));
  assert.doesNotMatch(grid, /paddingHorizontal: GUTTER/, 'the closet grid stopped bleeding');
  assert.match(CODE, /function ClosetHeader[\s\S]{0,400}paddingHorizontal: GUTTER/, 'the header lost its measure');
});

// ---------------------------------------------------------------------------
// The layout bargain
// ---------------------------------------------------------------------------

test('a column that can grow is a column that can shrink', () => {
  // `flex: 1` alone does not permit a child to go smaller than its content in
  // every RN layout path; the zero minimum on the flexed axis is what makes the
  // shrink actually available.
  const flexed = CODE.match(/flex: 1[^}]*}/g) ?? [];
  assert.ok(
    flexed.length >= 8,
    `expected the wells, the rows, the tiles and the page — got ${flexed.length}`,
  );
  for (const column of flexed) {
    assert.match(column, /min(Width|Height): 0/, `a flexible box without a zero minimum — ${column}`);
  }
});

test('the fixed parts of a row keep their points explicitly', () => {
  // The other half of the same bargain: if the fixed parts do not say they are
  // fixed, the text column is not the one that gives. The avatar, the overflow
  // square, the chevron, the capacity track and the band's dot each state it.
  assert.ok(
    (CODE.match(/flexShrink: 0/g) ?? []).length >= 8,
    'a fixed part of a row can be squeezed by the text beside it',
  );
});

test('truncation is a standard-size treatment and lifts at large type', () => {
  // The governing clause of the wave — "in every case composition changes and
  // height is allowed. Nothing is capped, truncated, ellipsised or scaled below
  // its documented size."
  assert.ok(
    (CODE.match(/numberOfLines=\{large \? undefined : 1\}/g) ?? []).length >= 2,
    'a line truncates at every setting',
  );
  // The one line that stays single at every size is the display name, which is
  // an identity and is trimmed to its cap height beside a 66pt face at standard
  // size only — the large branch draws it untrimmed and unlimited.
  const large = CODE.slice(CODE.indexOf('if (large) {', CODE.indexOf('function Identity')));
  assert.doesNotMatch(
    large.slice(0, large.indexOf('return (', large.indexOf('</View>'))),
    /numberOfLines=\{1\}/,
    'the name is still clipped at the largest type',
  );
});

test('at the accessibility sizes the page recomposes rather than shrinking', () => {
  // Four composition changes, each drawn in the accepted AX frame.
  assert.match(CODE, /if \(large\) \{[\s\S]{0,900}<FriendsPill count=\{view\.friends\} large/, 'the friends count never leaves the identity line');
  assert.match(CODE, /large \? RAIL_TILE_WIDTH_AX : RAIL_TILE_WIDTH/, 'the rail tiles do not grow');
  assert.match(CODE, /favoritesPrivacyLine\(tiles\.length\)/, 'favourites never become a sentence');
  assert.match(CODE, /flexDirection: large \? 'column' : 'row'/, 'the marks never stop sharing a row');

  // And the pairs move in the direction the frame moves them.
  assert.ok(RAIL_TILE_WIDTH_AX > RAIL_TILE_WIDTH);
  assert.ok(RAIL_TILE_HEIGHT_AX > RAIL_TILE_HEIGHT);
  assert.ok(PLAN_ROW_MIN_HEIGHT_AX > PLAN_ROW_MIN_HEIGHT);
  assert.ok(CHEVRON_SIZE_AX > CHEVRON_SIZE);
  assert.ok(CLOSET_COLUMNS_AX < CLOSET_COLUMNS, 'the grid must get wider tiles, not more of them');
});

test('the page recomposes at the same moment every other rebuilt page does', () => {
  // One threshold for the whole redesign, so two rebuilt pages cannot disagree
  // about what "large" is.
  assert.equal(PROFILE_STACK_SCALE, AX_STACK_SCALE);
  assert.match(ROUTE, /fontScale >= PROFILE_STACK_SCALE/, 'the route guessed at the setting');
  assert.match(ROUTE, /useWindowDimensions/, 'the setting was not read from the window');
});

test('nothing on this page answers large type by shrinking text', () => {
  for (const [name, src] of [['body', CODE], ['spec', SPEC], ['route', ROUTE]] as const) {
    assert.doesNotMatch(src, /maxFontSizeMultiplier|adjustsFontSize|allowFontScaling=\{false\}/, name);
  }
});

test('no fixed height sits under anything that carries type', () => {
  // Every literal height in the body has to belong to a picture box, a mark, a
  // glyph or a skeleton — never to a label that grows with Dynamic Type. The
  // controls state `minHeight`, which grows.
  const heights = CODE.match(/\bheight: [^,\n}]+/g) ?? [];
  assert.ok(heights.length > 0);
  for (const line of heights) {
    assert.match(
      line,
      /RAIL_TILE_HEIGHT|CLOSET_TILE_HEIGHT|GHOST_TILE_HEIGHT|GHOST_SHAPES|MARK_SKELETON_HEIGHT|PLAN_ROW_MIN_HEIGHT|PLAN_TRACK_HEIGHT|FAVORITE_DOT|BAND_DOT|MORE_DOT|shadow\.contact|\bheight,\b|\bsize\b|\bnumber\b/,
      // `height: number` is a prop's type annotation, not a measure; the
      // shadow offsets are geometry of a shadow. Everything else must name a
      // constant from the spec.
      `a fixed height under something that carries type — ${line}`,
    );
  }
  assert.ok(
    (CODE.match(/minHeight: MIN_TAP_TARGET/g) ?? []).length >= 3,
    'a control lost its growable floor',
  );
});

test('every control on the page clears the 44pt floor', () => {
  assert.ok(CTA_MIN_HEIGHT >= 44, 'the filled action is below the tap floor');
  assert.ok(MORE_SIZE >= 44, 'the overflow control is below the tap floor');
  assert.ok(PLAN_ROW_MIN_HEIGHT >= 44, 'the plan door is below the tap floor');
  assert.ok(
    (CODE.match(/MIN_TAP_TARGET/g) ?? []).length >= 4,
    'a control on the page has no 44pt floor',
  );
  // The two bare-text controls take their target from hitSlop rather than from
  // a box drawn around them, which is what keeps "Done" and "See all" from
  // becoming buttons.
  assert.ok((CODE.match(/hitSlop=\{12\}/g) ?? []).length >= 2, 'a small target lost its slop');
});

test('waiting is drawn with skeletons, never a spinner', () => {
  assert.match(CODE, /<Skeleton/);
  assert.doesNotMatch(CODE, /ActivityIndicator|<Spinner/, 'a spinner reached the page');
  // The waiting frame holds the real geometry, so nothing jumps when rows land.
  assert.match(CODE, /height: RAIL_TILE_HEIGHT, borderRadius: RAIL_TILE_RADIUS/, 'the waiting rail invented its own height');
  assert.match(CODE, /height: PLAN_ROW_MIN_HEIGHT/, 'the waiting plan row invented its own height');
  // And the identity block is NOT a skeleton: the name and the face answer from
  // cache on every visit after the first, and blanking them would be the app
  // forgetting who you are for a beat it did not need to.
  const page = CODE.slice(CODE.indexOf('export function ProfileBody'));
  assert.ok(
    page.indexOf('<Identity') < page.indexOf('<LoadingBody'),
    'identity fell inside the waiting state',
  );
});

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

test('no colour in the slice is a literal', () => {
  for (const [name, src] of [
    ['body', CODE],
    ['spec', SPEC],
    ['route', ROUTE],
    ['fixtures', FIXTURES],
  ] as const) {
    assert.doesNotMatch(src, /#[0-9a-fA-F]{3,8}\b/, `a hardcoded colour in the ${name}`);
    assert.doesNotMatch(src, /rgba\(/, `a hand-composited colour in the ${name}`);
  }

  // The artifact's hexes ARE the tokens', which is exactly why typing one would
  // stay invisible until the palette moved.
  assert.doesNotMatch(CODE, /DFD9CC|E4DED2|D8D1C2|EAE5DB|EFEBE1|B4AEA0|EEDFD6|F4F0E8/, 'an artifact hex');
  assert.doesNotMatch(CODE, /F5E4C8|EFD3A6|7A5312|4A3208|B98A2A/, 'an artifact amber reached the page');

  // The offline band is the warning token at an alpha, with ink on it — the
  // same construction the trips shelf uses, so the two failures read as one
  // object.
  assert.match(CODE, /warningAlpha\(0\.22\)/, 'the offline band’s ground');
  assert.match(CODE, /warningAlpha\(0\.35\)/, 'the offline kicker’s well');
});

test('clay heads the favourites rail and never carries type', () => {
  // The brief asks for "every rail's header in the area accent, not gray", and
  // the artifact heads Favorite outfits in clay. `accentWarm` is 2.98:1 and
  // `theme/contrast.ts` declares it `text: false` — but an 11pt tracked eyebrow
  // IS type, so the header takes the colour and the MARK LABELS beneath the
  // figures, which the artifact also paints clay, become `muted` instead.
  assert.match(CODE, /theme\.accent : theme\.accentWarm/, 'the favourites header lost its area accent');
  assert.doesNotMatch(
    CODE.slice(CODE.indexOf('function Marks'), CODE.indexOf('function LearnedLine')),
    /accentWarm/,
    'clay set as a mark label',
  );
});

test('the page spends its filled oxblood on one control at a time', () => {
  // Three accent grounds exist in the file and only ONE of them is pressable:
  // the primary CTA. The other two are marks — the capacity track's fill and
  // the dot on a kept look — which are drawings, not offers.
  const grounds = CODE.match(/backgroundColor: theme\.accent\b/g) ?? [];
  assert.equal(grounds.length, 3, 'the accent budget moved');
  assert.equal(
    (CODE.match(/<PrimaryCta/g) ?? []).length,
    2,
    'the filled control belongs to the empty state and the error state, and to nothing else',
  );
  assert.match(CODE, /color: theme\.canvas/, 'and canvas is what goes on it');
  // The ready frame has no filled control at all — the whole page is content.
  const ready = CODE.slice(CODE.indexOf('function ReadyBody'), CODE.indexOf('export function ProfileBody'));
  assert.doesNotMatch(ready, /<PrimaryCta/, 'the page at rest grew a call to action');
});

// ---------------------------------------------------------------------------
// The gesture, and what this page refuses to do
// ---------------------------------------------------------------------------

test('the page ticks at nothing — every press here is navigation', () => {
  for (const [name, src] of [['body', CODE], ['route', ROUTE]] as const) {
    assert.doesNotMatch(src, /expo-haptics/, `the ${name} reached past the policy`);
    // UX-07 reserves the vocabulary for what CHANGES. Opening a garment, the
    // friends list, the diary, settings or a paywall changes nothing here.
    assert.doesNotMatch(src, /haptic=/, `the ${name} spends a tick on navigation`);
  }
});

test('the page emits no analytics at all', () => {
  // The screen this replaces emitted none, and a surface carrying somebody's
  // handle, friend count, wardrobe size and plan is the last place to start:
  // every property worth sending from here is either an identifier or a count
  // of the reader's own things.
  for (const [name, src] of [['body', CODE], ['route', ROUTE], ['spec', SPEC]] as const) {
    assert.doesNotMatch(src, /\btrack\(|trackOnce\(|posthog/, `the ${name} started reporting on the reader`);
  }
});

test('the page adds no table, no column and no package', () => {
  // Every read is an existing hook. The route may name them; it may not reach
  // past them into Supabase for anything but the identity header it already
  // owned.
  const supabaseCalls = ROUTE.match(/supabase\s*\n?\s*\.from\('([a-z_]+)'\)/g) ?? [];
  assert.deepEqual(
    supabaseCalls.map((c) => c.match(/'([a-z_]+)'/)![1]),
    ['profiles'],
    'the page reached for a table of its own',
  );
  for (const hook of [
    'useCloset',
    'useOutfitCount',
    'useFavoriteOutfits',
    'useFriends',
    'useCapacity',
    'usePlan',
    'useStyleProfile',
  ]) {
    assert.ok(ROUTE.includes(hook), `${hook} is not read — a number on this page is being invented`);
  }
});

test('the favourites rail stays owner-private', () => {
  // The whole of the "Keep" clause: favourites are the reader's own, and the
  // page must offer no way to send one anywhere. `useFavoriteOutfits` is
  // owner-scoped server-side; this is the surface half of the same promise.
  assert.doesNotMatch(CODE, /Share|share\(|shareAsync/, 'a share affordance reached the private rail');
  assert.match(CODE, /favoritesPrivacyLine/, 'the privacy fact is never said in words');
  assert.match(favoritesPrivacyLine(4)!, /only you can see them/);
});

// ---------------------------------------------------------------------------
// Copy — verbatim
// ---------------------------------------------------------------------------

test('the words are the artifact’s words', () => {
  assert.equal(PROFILE_COPY.mostWorn, 'Most worn');
  assert.equal(PROFILE_COPY.favorites, 'Favorite outfits');
  assert.equal(PROFILE_COPY.closet, 'Closet');
  assert.equal(PROFILE_COPY.seeAll, 'See all');
  assert.equal(PROFILE_COPY.pieces, 'Pieces');
  assert.equal(PROFILE_COPY.outfitsMade, 'Outfits made');
  assert.equal(PROFILE_COPY.costPerWear, 'Cost per wear');
  assert.equal(PROFILE_COPY.noFriends, 'No friends yet');
  assert.equal(PROFILE_COPY.emptyTitle, 'Your room is empty');
  assert.equal(PROFILE_COPY.emptyBody, 'Add a few pieces and the rails fill themselves.');
  assert.equal(PROFILE_COPY.emptyAction, 'Add to your closet');
  assert.equal(PROFILE_COPY.offlineKicker, 'Offline');
  assert.equal(PROFILE_COPY.offlineTitle, 'Your rails didn’t load');
  assert.equal(PROFILE_COPY.offlineBody, 'The closet below is what’s saved on this device.');
  assert.equal(PROFILE_COPY.tryAgain, 'Try again');
  assert.equal(PROFILE_COPY.upgrade, 'Upgrade');
});

test('nothing on the page promises a count it has not read', () => {
  // No "of 3 outfits a week", no "you have worn 62% of your closet". The only
  // numbers are the marks, the friends count and the capacity line, and each of
  // them is a read.
  assert.doesNotMatch(SPEC, /\ba week\b|\bper week\b|%/, 'a promise about a rate');
});

// ---------------------------------------------------------------------------
// The friends count, which is a door and not a statistic
// ---------------------------------------------------------------------------

test('the friends count says what it knows and nothing more', () => {
  assert.equal(friendsLabel(12), '12 friends');
  assert.equal(friendsLabel(1), '1 friend');
  assert.equal(friendsLabel(0), 'No friends yet');
  // The one that matters: a query in flight is not an empty circle.
  assert.equal(friendsLabel(undefined), null);
});

test('an empty circle is still a door, and is not shouted at', () => {
  assert.equal(friendsTone(12), 'accent');
  assert.equal(friendsTone(0), 'quiet');
  assert.equal(friendsTone(undefined), 'quiet');
  // Drawn as a control either way — the friends list is where requests and the
  // invite path live, which is exactly what somebody with no friends needs.
  assert.match(CODE, /function FriendsPill[\s\S]{0,900}accessibilityRole="button"/);
  assert.match(ROUTE, /router\.push\('\/friends'\)/, 'the count leads nowhere');
});

// ---------------------------------------------------------------------------
// The marks
// ---------------------------------------------------------------------------

test('a mark is drawn only when its number has been read', () => {
  const all = statMarks({ pieces: 84, outfits: 31, avgCostPerWear: 4.1 });
  assert.deepEqual(all.map((m) => m.id), ['pieces', 'outfits', 'cost']);
  assert.deepEqual(all.map((m) => m.figure), ['84', '31', '$4.10']);

  // The free frame's two marks: no cost-per-wear, because no piece carries both
  // a price and a wear.
  const two = statMarks({ pieces: 37, outfits: 9, avgCostPerWear: null });
  assert.deepEqual(two.map((m) => m.id), ['pieces', 'outfits']);

  // The outfit count in flight drops its mark rather than drawing a zero over
  // somebody's thirty looks, or a dash inside a designed tile.
  const one = statMarks({ pieces: 37, outfits: undefined, avgCostPerWear: null });
  assert.deepEqual(one.map((m) => m.id), ['pieces']);
  for (const mark of [...all, ...two, ...one]) {
    assert.doesNotMatch(mark.figure, /—|-|NaN|Infinity/, `${mark.id} drew a non-number`);
  }
});

test('an unreadable cost-per-wear never reaches the page', () => {
  assert.deepEqual(
    statMarks({ pieces: 4, outfits: 1, avgCostPerWear: Number.POSITIVE_INFINITY }).map((m) => m.id),
    ['pieces', 'outfits'],
  );
  assert.deepEqual(
    statMarks({ pieces: 4, outfits: 1, avgCostPerWear: Number.NaN }).map((m) => m.id),
    ['pieces', 'outfits'],
  );
});

test('the money is set to two places, always', () => {
  assert.equal(costPerWearFigure(4.1), '$4.10');
  assert.equal(costPerWearFigure(4), '$4.00');
  assert.equal(costPerWearFigure(12.345), '$12.35');
});

test('exactly one mark is accented, and it is the middle one', () => {
  const marks = statMarks({ pieces: 84, outfits: 31, avgCostPerWear: 4.1 });
  assert.equal(marks.filter((m) => m.accent).length, 1);
  assert.equal(marks.find((m) => m.accent)!.id, 'outfits');
});

// ---------------------------------------------------------------------------
// The plan door — one quiet row, with the routing exactly as it shipped
// ---------------------------------------------------------------------------

const door = (over: Partial<Parameters<typeof planDoorFor>[0]> = {}) =>
  planDoorFor({
    plan: 'standard',
    planName: 'Standard',
    planLoading: false,
    planUnconfirmed: false,
    capacityLoading: false,
    used: 84,
    limit: 150,
    ...over,
  });

test('the row reads as the artifact sets it', () => {
  assert.equal(capacityLine(84, 150), '84 of 150 pieces');
  assert.equal(capacityLine(1, 1), '1 of 1 piece');
  assert.equal(door()!.line, 'Standard · 84 of 150 pieces');
});

test('a free account gets the blush row, the mark and the word', () => {
  const free = door({ plan: 'free', planName: 'Free', used: 8, limit: PLANS.free.items })!;
  assert.equal(free.tone, 'blush');
  assert.equal(free.action, PROFILE_COPY.upgrade);
  assert.equal(free.route, 'paywall');
  assert.ok(free.fill > 0 && free.fill <= 1);
});

test('the ceiling is the plan’s, never the frame’s', () => {
  // The artifact draws "Free · 37 of 45 pieces". There is no 45-piece ceiling
  // anywhere in this app, and the constraint that survives every redesign is
  // that numbers shown to users derive from plans.ts.
  assert.doesNotMatch(SPEC, /\b45\b/, 'the frame’s invented free ceiling reached the spec');
  assert.doesNotMatch(FIXTURES, /of 45/, 'the frame’s invented free ceiling reached the poses');
  assert.equal(door({ plan: 'free', planName: 'Free', used: 8, limit: PLANS.free.items })!.line,
    `Free · 8 of ${PLANS.free.items} pieces`);
});

test('a Pro member is shown the fact and sold nothing', () => {
  const pro = door({ plan: 'pro', planName: 'Pro', used: 200, limit: PLANS.pro.items })!;
  assert.equal(pro.route, 'none');
  assert.equal(pro.action, null);
  // And the body draws that one as a plain view rather than a control.
  assert.match(CODE, /if \(door\.route === 'none'\) \{[\s\S]{0,400}<View accessible/, 'the Pro row became pressable');
});

test('a row is never drawn over a plan the app has not confirmed', () => {
  // `usePlan` answers `free` on an unreadable read — the right answer for a
  // gate and a false claim for a label. A row drawn then would print somebody's
  // Standard closet against the free ceiling.
  assert.equal(door({ planUnconfirmed: true }), null);
  assert.equal(door({ planLoading: true }), null);
  assert.equal(door({ capacityLoading: true }), null);
  assert.equal(door({ limit: 0 }), null);
});

test('the door behind the row is the one that shipped', () => {
  // Standard goes to the membership page it has; everybody else meets the same
  // placement they always met; the failure line is the shared one, so the row
  // is never a control that appears to do nothing.
  assert.match(ROUTE, /plan\.plan === 'standard'[\s\S]{0,200}\/membership-upgrade/);
  assert.match(ROUTE, /gate\.present\(Placement\.RepeatUpsell\)/);
  assert.match(ROUTE, /outcome === 'unavailable'/);
  assert.match(ROUTE, /UPGRADE_UNAVAILABLE_LINE/);
});

test('the row’s numerator is the closet the page is drawing', () => {
  // Two reads of one quantity would eventually print "84 PIECES" above
  // "Standard · 83 of 150 pieces", which is the app disagreeing with itself in
  // eight points of vertical space.
  assert.match(ROUTE, /used: numbers\.pieces/, 'the row and the mark can now disagree');
  assert.match(ROUTE, /limit: capacity\.limit/, 'the ceiling stopped coming from the plan');
});

// ---------------------------------------------------------------------------
// The states
// ---------------------------------------------------------------------------

test('the page knows which of the six frames it is in', () => {
  assert.equal(profileBodyState({ closetLoading: true, closetError: false, pieces: 0 }), 'loading');
  assert.equal(profileBodyState({ closetLoading: false, closetError: true, pieces: 12 }), 'error');
  assert.equal(profileBodyState({ closetLoading: false, closetError: false, pieces: 0 }), 'empty');
  assert.equal(profileBodyState({ closetLoading: false, closetError: false, pieces: 1 }), 'ready');
});

test('a failed read with rows behind it is still a failure', () => {
  // The band's whole job is to say the grid underneath is what is on the
  // device. A page that served stale rows as if they were fresh is the failure
  // it exists to name.
  assert.equal(profileBodyState({ closetLoading: false, closetError: true, pieces: 84 }), 'error');
  assert.match(CODE, /<OfflineBand cached=\{view\.closet\.length > 0\}/);
  assert.equal(PROFILE_COPY.offlineBodyEmpty, 'Nothing is saved on this device yet.');
});

test('every state has a way forward', () => {
  assert.match(CODE, /function EmptyBody[\s\S]{0,1400}onPress=\{view\.onAddClothes\}|onAddClothes/, 'the empty state has no first step');
  assert.match(CODE, /label=\{PROFILE_COPY\.tryAgain\} onPress=\{view\.onRetry\}/, 'the error state has no retry');
  assert.match(ROUTE, /closet\.refetch\(\)[\s\S]{0,200}outfitCount\.refetch\(\)/, 'the retry refetches one query and calls it a recovery');
});

// ---------------------------------------------------------------------------
// The line the card above the marks became
// ---------------------------------------------------------------------------

test('the learned sentence keeps the words it shipped with', () => {
  assert.equal(TASTE_THRESHOLD, 8);
  assert.match(learnedLine({ failed: false, loading: false, feedbackCount: 0, summary: [] })!, /Nothing yet/);
  assert.match(learnedLine({ failed: false, loading: false, feedbackCount: 7, summary: [] })!, /^Still early\. 1 more reaction/);
  assert.match(learnedLine({ failed: false, loading: false, feedbackCount: 6, summary: [] })!, /2 more reactions/);
  assert.match(
    learnedLine({ failed: false, loading: false, feedbackCount: 20, summary: ['a', 'b', 'c'] })!,
    /So far you a, b, and c\./,
  );
  assert.match(
    learnedLine({ failed: false, loading: false, feedbackCount: 20, summary: [] })!,
    /no clear pattern yet/,
  );
});

test('a failed style read says nothing rather than something false', () => {
  // The card this replaces had an error branch for exactly one reason: without
  // it a failed read fell through to `feedbackCount = 0` and told somebody with
  // months of reactions "Nothing yet".
  assert.equal(learnedLine({ failed: true, loading: false, feedbackCount: 0, summary: [] }), null);
  assert.equal(learnedLine({ failed: false, loading: true, feedbackCount: 0, summary: [] }), null);
});

test('the list of tastes is joined like a sentence', () => {
  assert.equal(joinNaturally([]), '');
  assert.equal(joinNaturally(['one']), 'one');
  assert.equal(joinNaturally(['one', 'two']), 'one and two');
  assert.equal(joinNaturally(['one', 'two', 'three']), 'one, two, and three');
});

// ---------------------------------------------------------------------------
// What the page reads, and how much of it
// ---------------------------------------------------------------------------

test('the rails and the grid are bounded, and the closet is one tap away', () => {
  assert.ok(MOST_WORN_TILES > 0 && MOST_WORN_TILES <= 12);
  assert.ok(FAVORITE_TILES > 0 && FAVORITE_TILES <= 12, 'the favourites query returns at most 12');
  assert.equal(CLOSET_TILES % CLOSET_COLUMNS, 0, 'the grid would end on a ragged row');
  assert.match(ROUTE, /items\.slice\(0, CLOSET_TILES\)/, 'the grid became a second closet');
  assert.match(ROUTE, /router\.push\('\/\(tabs\)\/closet'\)/, '"See all" leads nowhere');
});

test('every well on the page is signed in one batch', () => {
  // The signer takes a list, and a request per section would be three round
  // trips for one screen.
  assert.equal((ROUTE.match(/useSignedUrls\(/g) ?? []).length, 1, 'the page signs more than once');
  assert.match(ROUTE, /item\.listingPath, item\.platePath, item\.cutoutPath, item\.thumbPath/, 'the app’s preference order changed');
});

test('a garment with no photograph draws the well, not a hole', () => {
  assert.match(CODE, /fallback=\{<TileFallback \/>\}/);
  assert.equal((CODE.match(/<GarmentImage/g) ?? []).length, 2, 'a well stopped going through the shared renderer');
});

// ---------------------------------------------------------------------------
// The route contract
// ---------------------------------------------------------------------------

test('Profile is still the form sheet it was, and still says how to leave', () => {
  // Redesign 07 does not make Profile a tab. The artifact draws one under the
  // page — a "You" tab beside Plan, Trips and Closet — and this app has four
  // tabs that are not those, so the frame's chrome is the one thing that could
  // not come across.
  assert.match(LAYOUT_RAW, /name="profile"[\s\S]{0,220}presentation: 'formSheet'/);
  const tabs = readFileSync('src/app/(tabs)/_layout.tsx', 'utf8');
  assert.ok(!tabs.includes('profile"'), 'Profile must not become a tab');
  // Which is why the sheet keeps a visible way out.
  assert.match(CODE, /function DoneRow/, 'a modal with no visible exit');
  assert.match(CODE, /accessibilityLabel=\{PROFILE_COPY\.done\}/);
});

test('the route draws nothing and the body fetches nothing', () => {
  assert.doesNotMatch(CODE, /use(Query|Mutation)\(|from '@\/lib\/supabase'/, 'the body reached for data');
  // The route mounts two things and lays out neither: the page's own body, and
  // PR-C1's coaching card in the slot the body keeps for it. No primitive, no
  // measure, no colour.
  assert.doesNotMatch(ROUTE, /<ScrollView|<Pressable|<View|<Text\b/, 'the route started drawing');
  assert.doesNotMatch(ROUTE, /style=\{\{/, 'the route started measuring');
  assert.doesNotMatch(ROUTE, /dev-fixtures/, 'a fixture reached the router');
});

test('the poses carry no signed URL and no live callback', () => {
  assert.doesNotMatch(FIXTURES, /https?:\/\//, 'a fixture pointed at a real picture');
  assert.match(FIXTURES, /uris: \[\]/, 'a pose invented a garment nobody owns');
  const callbacks = FIXTURES.match(/on[A-Z]\w*: \(\) => \{\}/g) ?? [];
  assert.ok(callbacks.length >= 12, `a pose can act — only ${callbacks.length} no-ops`);
});
