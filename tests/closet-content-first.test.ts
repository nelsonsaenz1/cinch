/**
 * UX-02 — the Closet becomes content-first and honest.
 *
 * Two changes, and both are the kind nothing type-checks:
 *
 *   * ORDER. The masthead was eight sections deep — identity, a full-width Edit
 *     button on its own line, the stat row, the capacity line, two rails and an
 *     insight card — before the category chips and the first garment. What is
 *     ABOUT the closet now sits below the closet.
 *   * A NAME. The "Favourites" rail was `mostWornItems` all along: a ranking by
 *     wear count, in an app with no favourite flag, no favourite column and no
 *     way for a person to nominate one. It says what it is made of now.
 *
 * Source rather than rendered, like the rest of this suite: the screen imports
 * `@shopify/flash-list`, `expo-symbols` and React Native, and the test bundler
 * cannot parse React Native's Flow source. What that costs is real — none of
 * this proves a layout pass — and it is why the state matrix is also shot on
 * the simulator.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const code = (p: string) => readFileSync(p, 'utf8');
/** Source with comments stripped — a rule quoted in prose is not a rule kept. */
const stripped = (p: string) =>
  code(p)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');

const CLOSET = 'src/app/(tabs)/closet.tsx';
const HOOK = 'src/features/closet/use-closet-screen.ts';
const RAIL = 'src/components/closet/rail-card.tsx';

/** Just the masthead — the block that renders above the grid. */
function masthead(): string {
  const src = stripped(CLOSET);
  const start = src.indexOf('function Masthead');
  const end = src.indexOf('function SecondaryInsights');
  assert.ok(start > 0 && end > start, 'the masthead or the footer block was renamed');
  return src.slice(start, end);
}

/** Just the footer — everything that is about the closet rather than in it. */
function secondary(): string {
  const src = stripped(CLOSET);
  const start = src.indexOf('function SecondaryInsights');
  const end = src.indexOf('function Rail(', start);
  assert.ok(start > 0 && end > start, 'the footer block was renamed or moved');
  return src.slice(start, end);
}

// ---------------------------------------------------------------------------
// Content first
// ---------------------------------------------------------------------------

test('the masthead is four sections deep, and the last of them is the chips', () => {
  const src = masthead();
  for (const section of ['<EyebrowHeader', '<Avatar', '<StatRow', '<CapacityColophon', '<CategoryChipsRow']) {
    assert.ok(src.includes(section), `the masthead lost ${section}`);
  }
  // The chips are the last thing before the grid: a filter row that sits under
  // a summary of the thing it filters is a row nobody reaches.
  const chips = src.indexOf('<CategoryChipsRow');
  for (const earlier of ['<EyebrowHeader', '<Avatar', '<StatRow', '<CapacityColophon']) {
    assert.ok(src.indexOf(earlier) < chips, `${earlier} fell below the category chips`);
  }
});

test('nothing derived sits between the reader and their garments', () => {
  const src = masthead();
  assert.doesNotMatch(src, /<Rail\b/, 'a rail climbed back above the grid');
  assert.doesNotMatch(src, /<InsightCard/, 'the insight card climbed back above the grid');
});

test('the rails and the insight card are still there, below the grid', () => {
  // Content-first is a reordering, not a deletion: every one of these still
  // says exactly what it said.
  const src = secondary();
  assert.match(src, /title="Latest pieces"/);
  assert.match(src, /title="Most worn"/);
  assert.match(src, /<InsightCard/);
  assert.match(src, /accessibilityLabel="See all pieces"/, 'the Latest rail lost its way into the grid');
  assert.match(stripped(CLOSET), /ListFooterComponent=\{\s*<SecondaryInsights/);
});

test('Edit rides the identity row instead of a full-width button of its own', () => {
  const src = masthead();
  // A control that is edge-to-edge reads as the page's primary action, which on
  // a closet it is not. The full sentence survives for VoiceOver.
  assert.doesNotMatch(src, /className="mx-gutter mt-4 items-center justify-center rounded-md border/);
  assert.match(src, /accessibilityLabel="Edit your profile"/);
  assert.match(src, /accessibilityHint="Change your name, handle, bio and photo"/);
  assert.match(src, /size=\{52\}/, 'the identity avatar was not compressed');
});

// ---------------------------------------------------------------------------
// Honest Most worn
// ---------------------------------------------------------------------------

test('the wear rail says what it is made of', () => {
  const src = stripped(CLOSET);
  assert.match(src, /title="Most worn"/);
  assert.doesNotMatch(src, /Favourites|favourites/, 'the closet still claims a favourite');
  assert.doesNotMatch(stripped(HOOK), /favourite/i, 'the derivation still claims a favourite');
  assert.doesNotMatch(stripped(RAIL), /favourite/i, 'the rail card still claims a favourite');
});

test('no favourite state was invented to go with the name', () => {
  // UX-02: "Do not create a fake favorite state or backend contract." The rail
  // is a ranking by wear count and nothing in the app writes a favourite.
  const src = stripped(HOOK);
  assert.match(src, /mostWornRail = useMemo\(\(\) => mostWornItems\(items, MOST_WORN_RAIL_LIMIT\)/);
  assert.doesNotMatch(src, /is_favourite|isFavourite/);
});

test('the rail ranks by wear count and drops what has never been worn', () => {
  // The claim the label now makes out loud, read off `mostWornItems` itself.
  // Source rather than a call: `features/closet/profile.ts` reaches Supabase and
  // React Query, so importing it would drag React Native into this bundle —
  // which is also why the rail's own limit is checked as text below.
  const src = stripped('src/features/closet/profile.ts');
  assert.match(src, /filter\(\(i\) => i\.wearCount > 0\)/, 'a never-worn piece can reach the rail');
  assert.match(src, /sort\(\(a, b\) => b\.wearCount - a\.wearCount/, 'the rail is not ranked by wear');
  assert.match(stripped(HOOK), /MOST_WORN_RAIL_LIMIT = 8/, 'the rail changed length');
});

// ---------------------------------------------------------------------------
// The visibility rules that were NOT allowed to change
// ---------------------------------------------------------------------------

test('both rails keep the visibility rules they shipped with', () => {
  // The implementation plan: "preserve current category/Most-worn visibility
  // rules rather than adding 5/15-piece thresholds". Latest appears whenever
  // there is anything; Most worn appears once something has been worn; neither
  // renders empty; no piece count gates either.
  const src = secondary();
  assert.match(src, /screen\.latestPieces\.length > 0 \?/);
  assert.match(src, /screen\.mostWornRail\.length > 0 \?/);
  assert.doesNotMatch(src, /items\.length (>|>=|<) *(5|15)\b/, 'a piece-count threshold was invented');
  assert.doesNotMatch(stripped(HOOK), /=== 5|>= 15|> 15/, 'a piece-count threshold was invented');
});

test('the category chips still drop only what is empty', () => {
  // `categoryCounts` hides a category with nothing filed under it and always
  // keeps `All`. Untouched by this packet, and asserted so it stays that way.
  const src = stripped(HOOK);
  assert.match(src, /if \(count === 0 && category !== 'All'\) return \[\];/);
});

test('the other closet states are still branches of their own', () => {
  const src = stripped(CLOSET);
  for (const branch of ['screen.loading', 'screen.error', 'selecting', 'screen.searching']) {
    assert.ok(src.includes(branch), `the ${branch} branch was lost`);
  }
  // The zero state is CI-01's, and this packet does not touch it: it has no
  // grid to get out of the way of.
  assert.match(src, /<ZeroIdentityHeader/);
});
