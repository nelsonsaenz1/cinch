/**
 * Explore's partner shelf (founder order 2026-09-02) — the seams that keep it
 * honest, pinned the way promo-caps.test.ts pins its modules: by reading the
 * source where the behavior cannot be executed in the node suite (two Edge
 * Functions and a screen), plus the compliance regex the link builder already
 * proves executably in awin-link-construction.test.ts.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const bounds = readFileSync('supabase/functions/garment-search/bounds.ts', 'utf8');
const search = readFileSync('supabase/functions/garment-search/index.ts', 'utf8');
const gap = readFileSync('supabase/functions/gap-shop-match/index.ts', 'utf8');
const explore = readFileSync('src/app/(tabs)/explore.tsx', 'utf8');
const section = readFileSync('src/components/explore/partner-shop-section.tsx', 'utf8');
const hook = readFileSync('src/features/explore/use-partner-feed.ts', 'utf8');

test('partner-feed is a zero-parameter action — nothing user-typed can ride it', () => {
  assert.ok(bounds.includes("action: 'partner-feed'"));
  assert.ok(
    bounds.includes("throw new BoundsError('partner-feed takes no parameters.')"),
    'fields riding along must be refused, not ignored',
  );
});

test('every shelf link is built by trackingUrl, and a missing publisher id fails the shelf closed', () => {
  const fn = search.slice(search.indexOf('async function partnerFeed'));
  assert.ok(fn.includes("trackingUrl('awin', merchant.external_id, row.product_url, ids)"));
  // Fail-closed: no publisher identity means an EMPTY shelf, never a bare
  // product_url dressed as a link.
  assert.ok(fn.includes('if (!ids.awinPublisherId)'));
  const emptyReturn = fn.indexOf('items: []');
  assert.ok(emptyReturn !== -1 && emptyReturn < fn.indexOf('for (const merchant of'));
  // And a row whose link cannot be built is skipped, not passed through raw.
  assert.ok(fn.includes('if (!(err instanceof CommerceConfigError)) throw err;'));
});

test('gap-shop-match did not inherit the gear feeds — its owned source is pinned', () => {
  assert.ok(gap.includes("const OWNED_GAP_MERCHANT_IDS = ['124976']"));
  assert.ok(gap.includes(".in('catalog_merchants.external_id', OWNED_GAP_MERCHANT_IDS)"));
});

test('the shelf obeys C-03 and discloses paid links', () => {
  // Same gate expression the shop feed uses, applied to the partner shelf.
  assert.ok(
    explore.includes(
      "showWhereToBuy.data === true ? <PartnerShopSection items={partnerFeed.data ?? []} /> : null",
    ),
  );
  assert.ok(section.includes('Paid link'), 'the disclosure is on the shelf, in words');
  assert.ok(section.includes('paid arrangement'), 'and said plainly above the grid');
});

test('analytics carry counts and the shelf word, never a product or merchant', () => {
  assert.ok(hook.includes("track('explore_shop_feed_loaded', { shelf: 'partner', cards: data.items.length })"));
  assert.ok(section.includes("track('explore_shop_product_opened', { shelf: 'partner' })"));
  for (const src of [hook, section]) {
    assert.ok(!/track\([^)]*(title|merchant:|brand)/.test(src), 'no content in events');
  }
});
