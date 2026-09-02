/**
 * EXPLORE (DAILY SOCIAL), REDESIGN 17 — the drawn contract.
 *
 * The page became larger, photo-first look cards with the additions timeline
 * demoted underneath. Nothing about what the page is ALLOWED to show moved,
 * and this file is what stops the presentation change from quietly becoming a
 * privacy change: four laws are asserted here, not trusted.
 *
 *   1. Reactions are the owner's to see. No count exists anywhere on this
 *      surface, and there is nowhere for one to appear.
 *   2. Sharing is off by default and no control on this page changes anyone's.
 *   3. A hidden piece is silently absent — nothing counts, marks or hints.
 *   4. The unit is finite. Nothing implies content past the end.
 *
 * Read as source where the claim is about what a component draws, and as
 * evaluated functions where the claim is arithmetic. The components import
 * `expo-symbols` and React Native, and the test bundler cannot parse React
 * Native's Flow source — which is why the pure decisions live in
 * `explore-spec.ts` in the first place.
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  ADDITION_CARD_RADIUS,
  CIRCLE_ACTIONS,
  CIRCLE_ROW_MIN_HEIGHT,
  EXPLORE_COPY,
  FEED_GAP,
  LOOK_CARD_RADIUS,
  WELL_RATIO,
  headlineStacked,
  lookHeadline,
  newSinceLabel,
  reactionPrivacyLine,
  wellRows,
} from '../src/features/explore/explore-spec.ts';
import { CAUGHT_UP_LINE } from '../src/features/explore/feed.ts';
import { unseenBoundaryIndex } from '../src/features/explore/unseen.ts';
import { MIN_TAP_TARGET } from '../src/theme/metrics.ts';

const code = (path: string) => readFileSync(path, 'utf8');
/** Source with comments stripped — a rule explained in prose is not a rule kept. */
const body = (path: string) =>
  code(path)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const ROUTE = 'src/app/(tabs)/explore.tsx';
const DIR = 'src/components/explore';
const kit = () => readdirSync(DIR).filter((f) => /\.tsx$/.test(f));

/** Every string the redesign types, evaluated rather than scraped. */
const ALL_COPY = [
  ...Object.values(EXPLORE_COPY),
  lookHeadline('Priya', 'the wool coat'),
  lookHeadline('Mara', null),
  reactionPrivacyLine('Priya', null),
  reactionPrivacyLine('Priya', 'Cozy'),
  newSinceLabel(new Date(2026, 7, 11).toISOString(), new Date(2026, 7, 16)),
  newSinceLabel(null),
].join('\n');

// ---------------------------------------------------------------------------
// 1 · Reactions are private, and there is nothing to count
// ---------------------------------------------------------------------------

test('no string on this page counts a reaction, a person, or anything else', () => {
  // "No public aggregation" is enforced by there being nothing to aggregate:
  // `daily_social_reactions` has no count column, no aggregate view, and RLS
  // shows a reactor only their own row. A number here would be a number the
  // app cannot get, which is worse than one it should not show.
  assert.doesNotMatch(ALL_COPY, /\blikes?\b|\bfollowers?\b|\bviews?\b|\btally\b|\bcount\b/i);
  assert.doesNotMatch(ALL_COPY, /\d+\s*(people|friends|reactions?|others?)\b/i);
  assert.doesNotMatch(ALL_COPY, /\breacted\b|\bothers\b|\beveryone else\b/i);
});

test('the privacy line names one person and no number', () => {
  assert.equal(reactionPrivacyLine('Priya', null), 'Only Priya can see what you pick.');
  // Once chosen it becomes the way back out, because the press is reversible —
  // `(outfit_id, reactor_id)` is a primary key, so pressing again is an update
  // or a delete and never a second row.
  assert.equal(reactionPrivacyLine('Priya', 'Cozy'), 'Tap Cozy again to take it back.');
  for (const line of [reactionPrivacyLine('Priya', null), reactionPrivacyLine('Priya', 'Sharp')]) {
    assert.doesNotMatch(line, /\d/, 'a number appeared beside a reaction');
    assert.doesNotMatch(line, /friends|people|others/i);
  }
});

test('nothing in the kit reads another reader’s reaction', () => {
  // The card takes ONE reaction — the reader's own — and hands back the next
  // one. A prop named for anybody else's is the shape a count would arrive in.
  for (const file of kit()) {
    const src = body(`${DIR}/${file}`);
    assert.doesNotMatch(
      src,
      /reactionCount|reactions\.length|reactorCount|otherReactions|allReactions/,
      `${file} reaches for somebody else’s reaction`,
    );
  }
});

// ---------------------------------------------------------------------------
// 2 · Sharing is off by default, and this page changes nobody's
// ---------------------------------------------------------------------------

test('the page reads the sharing switch and never writes it', () => {
  const src = body(ROUTE);
  assert.match(src, /useWornSharing\(\)/, 'the circle sheet stopped reporting the switch');
  assert.doesNotMatch(
    src,
    /useSetWornSharing|setWornSharing|setSharing\(/,
    'Explore acquired the ability to turn somebody’s sharing on',
  );
  // The only route to the switch is the screen that owns it.
  assert.match(src, /push\('\/privacy\/visibility'\)/, 'the sharing door is gone');
});

test('the circle sheet is three doors and nothing destructive', () => {
  assert.deepEqual([...CIRCLE_ACTIONS], ['friends', 'find', 'sharing']);
  const sheet = body(`${DIR}/circle-sheet.tsx`);
  assert.doesNotMatch(
    sheet,
    /unfriend|block|report|remove|delete/i,
    'a destructive action is reachable from a masthead control',
  );
  // Every row is a real target. `CIRCLE_ROW_MIN_HEIGHT` is a floor, never a
  // height: a title at AX-XXXL is taller than 44 on its own.
  assert.equal(CIRCLE_ROW_MIN_HEIGHT, MIN_TAP_TARGET);
  assert.match(sheet, /minHeight: CIRCLE_ROW_MIN_HEIGHT/);
  assert.doesNotMatch(sheet, /\bheight: CIRCLE_ROW_MIN_HEIGHT/);
});

test('the sheet states the mutual-friends boundary and the non-retroactivity', () => {
  assert.match(EXPLORE_COPY.circleBody, /both friends/i);
  assert.match(EXPLORE_COPY.circleFooter, /starts from now/i);
  assert.match(EXPLORE_COPY.circleFooter, /seven days/i);
  // Off is the default and the sheet must be able to say so.
  assert.equal(EXPLORE_COPY.circleSharingOff, 'Off');
});

// ---------------------------------------------------------------------------
// 3 · A hidden piece is silently absent
// ---------------------------------------------------------------------------

const HIDDEN_PIECE_TELLS = [
  /\bhidden\b/i,
  /\d+\s*(piece|item|garment)/i,
  /(piece|item|garment)s?\s+(hidden|missing|not shown|withheld)/i,
  /\bsome pieces\b/i,
  /\bnot all\b/i,
  /\bpartial look\b/i,
  /\bincomplete\b/i,
];

test('no user-facing string counts, infers or hints at a hidden piece', () => {
  for (const tell of HIDDEN_PIECE_TELLS) {
    assert.doesNotMatch(ALL_COPY, tell, `copy hints at a hidden piece: ${tell}`);
  }
});

test('nor does anything inside the kit, VoiceOver labels included', () => {
  // Comments are stripped: several of these files EXPLAIN at length why they
  // must not count, and a rule that punishes its own documentation teaches
  // people to stop writing it down. `overflow: 'hidden'` is a Yoga property
  // and `accessibilityElementsHidden` is an RN prop; neither is a sentence.
  for (const file of kit()) {
    const src = body(`${DIR}/${file}`)
      .replace(/overflow:\s*'hidden'/g, '')
      .replace(/accessibilityElementsHidden/g, '');
    for (const tell of HIDDEN_PIECE_TELLS) {
      assert.doesNotMatch(src, tell, `${file} hints at a hidden piece: ${tell}`);
    }
  }
});

test('a shorter look composes without a hole, at every length', () => {
  // The card must not read as broken when a garment its owner hid is simply
  // absent. Every piece lands in exactly one cell and no cell is empty.
  for (let n = 1; n <= 9; n += 1) {
    const pieces = Array.from({ length: n }, (_, i) => `piece-${i}`);
    const rows = wellRows(pieces);
    assert.deepEqual(rows.flat(), pieces, `a ${n}-piece look drops or duplicates a piece`);
    assert.ok(rows.every((row) => row.length > 0), `a ${n}-piece look draws an empty row`);
  }
  // A look with nothing visible draws nothing rather than an apology — "no
  // pieces to show" is itself a statement about what was hidden.
  assert.deepEqual(wellRows([]), []);
});

test('the well is conditional on the card, so no empty ground is left behind', () => {
  // A look whose every piece its owner kept must leave no shape a reader can
  // notice and subtract from. The whole well is skipped, not merely its cells.
  assert.match(
    body(`${DIR}/look-entry-card.tsx`),
    /pieces\.length > 0 \? <LookWell/,
    'a look with no visible pieces draws an empty well',
  );
});

test('the well is hidden from VoiceOver, so no tile can be counted off', () => {
  const well = code(`${DIR}/look-well.tsx`);
  assert.match(well, /accessibilityElementsHidden/);
  assert.match(well, /importantForAccessibility="no-hide-descendants"/);
});

// ---------------------------------------------------------------------------
// 4 · The unit is finite, and the ending says so
// ---------------------------------------------------------------------------

test('nothing implies more content past the end', () => {
  assert.doesNotMatch(ALL_COPY, /load more|show more|see more|and more|keep scrolling|swipe for more/i);
  assert.doesNotMatch(ALL_COPY, /\bnext page\b|\bolder\b|\bpull for\b/i);
  // No sentinel, no pager, no infinite-scroll machinery anywhere on the page.
  assert.doesNotMatch(
    body(ROUTE),
    /onEndReached|fetchNextPage|hasNextPage|useInfiniteQuery/,
    'Explore acquired an infinite scroller',
  );
});

test('the ending names the window, not just the bottom of a scroll', () => {
  assert.equal(EXPLORE_COPY.endingTitle, 'You’ve seen the whole week');
  assert.match(EXPLORE_COPY.endingBody, /seven days/i);
  // Seven days is the whole life of a shared look, which is what makes "the
  // whole week" a true claim rather than a flattering one.
  assert.match(EXPLORE_COPY.endingBody, /then they go/i);
  // The spoken version is the drawn one, with nothing appended. A hint like
  // "swipe for more" would be the pagination affordance the contract forbids,
  // spoken instead of drawn.
  assert.equal(
    EXPLORE_COPY.endingAccessibility,
    `${EXPLORE_COPY.endingTitle}. ${EXPLORE_COPY.endingBody}`,
  );
});

test('the older closure line survives where it belongs', () => {
  // Redesign 17 gave the LOOKS their own designed ending. The sentence that
  // ends a circle is unchanged and still owned by `feed.ts`, which is what
  // `daily-social/copy.ts` imports — two surfaces that both end a circle must
  // end it in the same words.
  assert.equal(CAUGHT_UP_LINE, 'You’re caught up with your circle.');
  assert.notEqual(EXPLORE_COPY.endingTitle, CAUGHT_UP_LINE);
});

test('the ending is terminal — no control sits under it', () => {
  const mark = body(`${DIR}/caught-up-mark.tsx`);
  assert.doesNotMatch(mark, /Pressable|Button|onPress/, 'the ending grew a control');
});

// ---------------------------------------------------------------------------
// 5 · The new-since boundary — logic untouched, drawing added
// ---------------------------------------------------------------------------

test('the divider still comes from unseen.ts and still refuses to guess', () => {
  const looks = [
    { wornAt: '2026-08-16T09:00:00Z' },
    { wornAt: '2026-08-15T09:00:00Z' },
    { wornAt: '2026-08-14T09:00:00Z' },
  ];
  const at = (l: { wornAt: string }) => l.wornAt;

  // Unproven means silent — no boundary, no rule. The app never invents
  // unreadness, and this is the case that keeps it honest.
  assert.equal(unseenBoundaryIndex(looks, at, null), null);
  // Nothing new, and nothing old: both draw the same nothing, because a rule
  // above the first row separates the page from itself.
  assert.equal(unseenBoundaryIndex(looks, at, '2026-08-17T00:00:00Z'), null);
  assert.equal(unseenBoundaryIndex(looks, at, '2026-08-13T00:00:00Z'), null);
  // One genuinely new look above two already seen.
  assert.equal(unseenBoundaryIndex(looks, at, '2026-08-15T12:00:00Z'), 1);
});

test('the rule names the day, and never guesses one', () => {
  const now = new Date(2026, 7, 16, 10, 0, 0);
  assert.equal(newSinceLabel(new Date(2026, 7, 11, 9, 0, 0).toISOString(), now), 'New since Tuesday');
  assert.equal(newSinceLabel(new Date(2026, 7, 15, 9, 0, 0).toISOString(), now), 'New since yesterday');
  assert.equal(newSinceLabel(new Date(2026, 7, 16, 8, 0, 0).toISOString(), now), 'New since earlier today');
  // Past a week a weekday name is ambiguous, so it becomes the date.
  assert.match(newSinceLabel(new Date(2026, 6, 20, 9, 0, 0).toISOString(), now), /New since 20 Jul/);
  // Unparseable and absent both fall back to the bare word — never to a clock.
  assert.equal(newSinceLabel(null), EXPLORE_COPY.newSinceBare);
  assert.equal(newSinceLabel('not a date'), EXPLORE_COPY.newSinceBare);
});

test('the divider is a rule with a word on it, never a count or an alert', () => {
  const dividers = body(`${DIR}/feed-dividers.tsx`);
  assert.doesNotMatch(dividers, /\bnew\b\s*\{/i, 'the divider draws a computed badge');
  assert.doesNotMatch(dividers, /theme\.accent|theme\.critical|theme\.warning/, 'the divider is an alert');
  assert.doesNotMatch(ALL_COPY, /\bunread\b|\bbadge\b|\bnotification\b|\bnotify\b/i);
});

// ---------------------------------------------------------------------------
// 6 · The composition, and its accessibility contract
// ---------------------------------------------------------------------------

test('the headline is one sentence: a person, and what they wore', () => {
  assert.equal(lookHeadline('Priya', 'the wool coat'), 'Priya wore the wool coat');
  assert.equal(lookHeadline('Priya', '  the wool coat  '), 'Priya wore the wool coat');
  // An unnamed look does not become "Priya wore A look", which sounds like a
  // bug rather than a person's Tuesday.
  assert.equal(lookHeadline('Mara', null), 'Mara logged a day out');
  assert.equal(lookHeadline('Mara', '   '), 'Mara logged a day out');
});

test('AX is a composition change and never a smaller anything', () => {
  // One threshold for the whole card, so it becomes its large-type self all at
  // once rather than one element at a time.
  assert.equal(headlineStacked(1, 1.5), false);
  assert.equal(headlineStacked(1.4, 1.5), false);
  assert.equal(headlineStacked(1.5, 1.5), true);
  assert.equal(headlineStacked(3, 1.5), true);
  assert.equal(headlineStacked(Number.NaN, 1.5), false);

  // Nothing in the kit clamps, truncates or scales text down. A clamp is how a
  // control loses its own name at the setting that needs it most.
  for (const file of kit()) {
    const src = body(`${DIR}/${file}`);
    assert.doesNotMatch(src, /numberOfLines/, `${file} clamps a line`);
    assert.doesNotMatch(src, /ellipsizeMode|adjustsFontSizeToFit|minimumFontScale/, `${file} shrinks text`);
    assert.doesNotMatch(src, /allowFontScaling=\{false\}/, `${file} opts out of Dynamic Type`);
  }
});

test('the card is one accessible element with the reactions outside it', () => {
  // Wrapping controls inside an `accessible` view is what makes them
  // unreachable on iOS, and the three reactions are the only controls here.
  const card = body(`${DIR}/look-entry-card.tsx`);
  const accessibleAt = card.indexOf('accessible\n');
  const reactionAt = card.indexOf('<ReactionRow');
  assert.ok(accessibleAt > 0, 'the look is no longer one accessible element');
  assert.ok(reactionAt > accessibleAt, 'the reaction row moved inside the accessible wrapper');
  assert.match(card, /lookAccessibilityLabel\(/, 'the card lost its spoken sentence');
});

test('the geometry is named, and the well needs no measurement', () => {
  assert.equal(LOOK_CARD_RADIUS, 20);
  assert.equal(ADDITION_CARD_RADIUS, 16);
  assert.ok(WELL_RATIO > 0 && WELL_RATIO < 1, 'the well is not a landscape proportion');
  assert.equal(FEED_GAP, 16);
  // `aspectRatio` rather than `onLayout`: a late-arriving height on a scroll of
  // cards moves every card below it.
  const well = body(`${DIR}/look-well.tsx`);
  assert.match(well, /aspectRatio: 1 \/ WELL_RATIO/);
  assert.doesNotMatch(well, /onLayout|useWindowDimensions/);
});

test('no hex literal was typed into the kit or the route', () => {
  for (const path of [ROUTE, ...kit().map((f) => `${DIR}/${f}`)]) {
    assert.doesNotMatch(body(path), /#[0-9a-fA-F]{3,8}\b/, `${path} types a colour by hand`);
  }
});

// ---------------------------------------------------------------------------
// 7 · Friends only, and no server change
// ---------------------------------------------------------------------------

test('the presentational kit fetches nothing, signs nothing and navigates nowhere', () => {
  // A component that cannot read cannot leak. It is also what lets every
  // accepted frame be posed as a fixture without a network.
  for (const file of kit()) {
    const src = body(`${DIR}/${file}`);
    assert.doesNotMatch(src, /useQuery|useMutation|supabase|from '@\/lib\/supabase'/, `${file} reads`);
    assert.doesNotMatch(src, /useRouter|router\.push|<Link/, `${file} navigates`);
    assert.doesNotMatch(src, /useSignedUrls|createSignedUrl/, `${file} signs a URL`);
  }
});

test('the redesign added no query, no table and no edge function', () => {
  const src = body(ROUTE);
  // Every read on this page is a hook that already existed before redesign 17.
  const allowed = [
    'useNewAdditions',
    'useFriends',
    'useMutedIds',
    'useDailyLooks',
    'useFriendsSharingCount',
    'useMyDailyReactions',
    'useSetDailyReaction',
    'useWornSharing',
    'useSignedUrls',
    'useExploreVisit',
    // Not a read: observes tab focus so "opened" analytics fire on a visit
    // rather than on NativeTabs' launch-time mount (lib/use-tab-visited.ts).
    'useTabVisited',
    // AMENDED 2026-08-30, the founder-ordered shop shelf: the person's own
    // C-03 switch, the closet the derivation reads, and the shelf's one
    // query hook (whose browse bodies carry a fixed enum and nothing else —
    // tests/explore-shop-feed.test.ts pins that wire). The direct-invoke ban
    // below still holds for the ROUTE; the invoke lives in the hook.
    'useShowWhereToBuy',
    'useWardrobe',
    'useShopFeed',
    // AMENDED 2026-09-02, the founder-ordered partner shelf: one more query
    // hook on the same C-03 gate, whose request carries no parameters at all
    // (tests/partner-shop-shelf.test.ts pins the wire and the disclosure).
    'usePartnerFeed',
  ];
  const hooks = [...src.matchAll(/\buse[A-Z]\w*/g)].map((m) => m[0]);
  for (const hook of new Set(hooks)) {
    if (/^use(Effect|Memo|Ref|State|Router|Theme|Window)/.test(hook)) continue;
    assert.ok(allowed.includes(hook), `Explore grew a new read: ${hook}`);
  }
  assert.doesNotMatch(src, /\.functions\.invoke|\.rpc\(/, 'Explore called the server directly');
});

test('the masthead is one heading, and the search is still an action', () => {
  const src = code(ROUTE);
  assert.equal((body(ROUTE).match(/variant="display"/g) ?? []).length, 1);
  assert.doesNotMatch(src, /<SearchField/, 'a permanent search field came back');
  assert.match(src, /accessibilityLabel: 'Find people'/);
  assert.match(src, /push\('\/people-search'\)/);
});
