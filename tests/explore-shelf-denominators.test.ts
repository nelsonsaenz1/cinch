/**
 * The Explore shelf's own denominators — ledger A46, 2026-09-05.
 *
 * `explore_shop_product_opened` had never fired, lifetime: not from a
 * customer, not from the harness that loaded 979 cards. The only other
 * number, `explore_shop_feed_loaded`, counts READS from inside a queryFn and
 * says nothing about a grid on screen. Three events make "invisible" and
 * "unwanted" different numbers: the visit, the settled shelf (with its card
 * count, including zero), and the grid entering the viewport.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const EXPLORE = readFileSync('src/app/(tabs)/explore.tsx', 'utf8');
const SHELF = readFileSync('src/components/explore/shop-shelf.tsx', 'utf8');
const POSTHOG = readFileSync('src/lib/posthog.tsx', 'utf8');

test('the three names are in the union, documented as counts only', () => {
  for (const name of ['explore_opened', 'explore_shop_shelf_shown', 'explore_shop_shelf_reached']) {
    assert.match(POSTHOG, new RegExp(`\\| '${name}'`), name);
  }
});

test('the visit fires once per mount and only when focused, like today_opened', () => {
  assert.match(
    EXPLORE,
    /const openedRef = useRef\(false\);\s*useEffect\(\(\) => \{\s*if \(!visited \|\| openedRef\.current\) return;\s*openedRef\.current = true;\s*track\('explore_opened'\);/,
  );
});

test('the shelf reports itself when it draws, and the page reports the zero it cannot', () => {
  // The component: once per mount, only with cards, counts only.
  assert.match(SHELF, /if \(shown\.current \|\| cards\.length === 0\) return;\s*shown\.current = true;/);
  assert.match(
    SHELF,
    /track\('explore_shop_shelf_shown', \{\s*cards: cards\.length,\s*paid: cards\.filter\(\(card\) => card\.paid\)\.length,\s*\}\)/,
  );
  // Nothing about a card leaves: no merchant, kind or title in any payload.
  for (const call of SHELF.match(/track\([^)]*\)/g) ?? []) {
    assert.doesNotMatch(call, /merchant|title|kind|brand|pageUrl|imageUrl/, call);
  }
  // The page: the zero, once, only after BOTH reads settled on a focused page
  // with the switch on — a shelf still loading is not an empty shelf, and a
  // closet read that DISABLED itself (no slots: the empty closet) is settled,
  // which `isSuccess` would never say.
  assert.match(
    EXPLORE,
    /const shelfSettled =\s*visited &&\s*showWhereToBuy\.data === true &&\s*shopFeed\.fetchStatus === 'idle' &&\s*partnerFeed\.fetchStatus === 'idle';/,
  );
  assert.doesNotMatch(EXPLORE, /shelfSettled[\s\S]{0,200}isSuccess/);
  assert.match(
    EXPLORE,
    /if \(!shelfSettled \|\| shelf\.cards\.length > 0 \|\| emptyShelfReported\.current\) return;\s*emptyShelfReported\.current = true;\s*track\('explore_shop_shelf_shown', \{ cards: 0, paid: 0 \}\);/,
  );
});

test('reached is measured by the page from the shelf’s own y, once, from every measurement', () => {
  assert.match(SHELF, /onLayout\?: \(y: number\) => void;/);
  assert.match(SHELF, /onLayout=\{onLayout \? \(e: LayoutChangeEvent\) => onLayout\(e\.nativeEvent\.layout\.y\) : undefined\}/);
  // One decision, three callers. The gate run of 09-05 found the shelf inside
  // the FIRST viewport of a near-empty page — no scroll ever happened and a
  // scroll-only check never fired — so the shelf's layout, the viewport's
  // layout and the scroll all re-run the same comparison.
  assert.match(
    EXPLORE,
    /const maybeShelfReached = \(\) => \{\s*if \(shelfReached\.current \|\| shelfTop\.current === null \|\| viewportHeight\.current === null\) return;\s*if \(scrollOffset\.current \+ viewportHeight\.current < shelfTop\.current\) return;\s*shelfReached\.current = true;\s*track\('explore_shop_shelf_reached'\);\s*\};/,
  );
  assert.match(EXPLORE, /onLayout=\{\(y\) => \{\s*shelfTop\.current = y;\s*maybeShelfReached\(\);\s*\}\}/);
  assert.match(
    EXPLORE,
    /onLayout=\{\(e\) => \{\s*viewportHeight\.current = e\.nativeEvent\.layout\.height;\s*maybeShelfReached\(\);\s*\}\}/,
  );
  const onScroll = EXPLORE.slice(EXPLORE.indexOf('const onScroll = ('), EXPLORE.indexOf('/** Will anything print an ending?'));
  assert.match(onScroll, /scrollOffset\.current = contentOffset\.y;\s*viewportHeight\.current = layoutMeasurement\.height;\s*maybeShelfReached\(\);/);
  // The existing day's-end early return must not sit ABOVE the shelf check,
  // or a page with no daily looks would never report the shelf.
  assert.ok(onScroll.indexOf('maybeShelfReached()') < onScroll.indexOf('if (dailyEndSeen'));
  assert.equal((EXPLORE.match(/track\('explore_shop_shelf_reached'\)/g) ?? []).length, 1);
});
