import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

/**
 * "Opened" means somebody arrived — the mount is not the visit.
 *
 * NativeTabs is a UITabBarController: all five tab screens mount together at
 * launch. Before 2026-08-25 every tab's page-analytics effect ran at that
 * moment, so signing in fired `today_opened`, `stylist_opened`,
 * `daily_social_opened` and `closet_floor_shown` within ~1.5 seconds, for tabs
 * nobody had looked at — and every "opened" count in PostHog was a launch
 * counter wearing a visit's name (historical counts before that date are
 * inflated exactly this way).
 *
 * The contract now: each tab's analytics effects are gated on
 * `useTabVisited()` — false until the tab first receives focus. These tests
 * pin the gate in SOURCE, because no node-side render can reproduce a
 * UITabBarController mounting five screens at once.
 */

const read = (p: string) => readFileSync(p, 'utf8');

const HOOK = 'src/lib/use-tab-visited.ts';
const TABS = {
  today: 'src/app/(tabs)/index.tsx',
  closet: 'src/app/(tabs)/closet.tsx',
  stylist: 'src/app/(tabs)/stylist.tsx',
  explore: 'src/app/(tabs)/explore.tsx',
} as const;

test('the hook watches focus, not mount, and never un-visits', () => {
  const src = read(HOOK);
  assert.match(src, /useFocusEffect/, 'the visit must be defined by focus');
  assert.doesNotMatch(
    src,
    /setVisited\(false\)/,
    'a re-blur must not un-visit: the screens dedupe repeats themselves',
  );
});

test('every tab with page analytics takes the gate', () => {
  for (const [name, file] of Object.entries(TABS)) {
    const src = read(file);
    assert.match(
      src,
      /useTabVisited\(\)/,
      `${name} fires page analytics but never asks whether it was visited`,
    );
  }
});

test('the "opened" events themselves are behind the gate', () => {
  // The exact guard, not just the hook's presence — importing the hook and
  // forgetting the `if` is the regression this file exists to catch.
  assert.match(
    read(TABS.today),
    /if \(!visited \|\| openedRef\.current\) return;/,
    'today_opened fires unfocused',
  );
  assert.match(
    read(TABS.stylist),
    /if \(!visited \|\| openedOnce\.current\) return;/,
    'stylist_opened fires unfocused',
  );
  assert.match(
    read(TABS.explore),
    /if \(!visited \|\| !showsDaily \|\| dailyLoading\) return;/,
    'daily_social_opened fires unfocused',
  );
  assert.match(
    read(TABS.closet),
    /if \(!visited \|\| reported\.current === rails\) return;/,
    'closet_viewed fires unfocused',
  );
});

test('the state observations are gated too, not only the opened beacons', () => {
  const today = read(TABS.today);
  for (const guard of [
    /if \(!visited \|\| weatherStateRef\.current === weatherRead\.state\) return;/,
    /if \(!visited \|\| !belowFloor \|\| floorRef\.current\) return;/,
  ]) {
    assert.match(today, guard, `a Today observation escaped the visit gate: ${guard}`);
  }
  assert.match(
    read(TABS.stylist),
    /if \(!visited \|\| markReported\.current === markVisible\) return;/,
    'allowance_mark_shown fires unfocused',
  );
  assert.match(
    read(TABS.closet),
    /if \(!visited \|\| capacity\.loading \|\| reported\.current === state\) return;/,
    'closet_capacity_state fires unfocused',
  );
});

test("Explore's shelf reads wait for a visit too — they fire events from inside queryFn", () => {
  // `explore_shop_feed_loaded` is emitted inside the react-query `queryFn`
  // of use-shop-feed.ts / use-partner-feed.ts, so the only gate that can
  // keep it from firing at launch is the query's own `enabled`.
  const explore = read(TABS.explore);
  assert.match(explore, /useShopFeed\([\s\S]*?visited && showWhereToBuy\.data === true/);
  assert.match(explore, /usePartnerFeed\(visited && showWhereToBuy\.data === true\)/);
});
