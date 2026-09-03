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

test('the shelf shows clothes and nothing else — the slot set is closed and jewelry/bag/accessory are outside it', () => {
  const fn = search.slice(search.indexOf('const PARTNER_FEED_SLOTS'));
  const setLine = fn.slice(0, fn.indexOf(';'));
  for (const kind of ['top', 'bottom', 'dress', 'outerwear', 'footwear', 'headwear']) {
    assert.ok(setLine.includes(`'${kind}'`), `clothes kind missing: ${kind}`);
  }
  for (const banned of ['jewelry', 'bag', 'accessory']) {
    assert.ok(!setLine.includes(`'${banned}'`), `banned kind present: ${banned}`);
  }
  // And the query actually applies the set — a NULL slot (every fishing rod
  // and display frame) cannot pass an IN filter.
  assert.ok(fn.includes(".in('slot', PARTNER_FEED_SLOTS)"));
});

test('the shelf names fashion brands only — gear brands are joined but absent by founder edit', () => {
  const setLine = search.slice(
    search.indexOf('const PARTNER_FEED_MERCHANT_IDS'),
    search.indexOf(';', search.indexOf('const PARTNER_FEED_MERCHANT_IDS')),
  );
  assert.ok(setLine.includes("'124976'"), 'CICYBELL is the shelf');
  for (const gear of ['78182', '89509', '129093', '92667', '95201']) {
    assert.ok(!setLine.includes(`'${gear}'`), `gear brand on the fashion shelf: ${gear}`);
  }
  const fn = search.slice(search.indexOf('async function partnerFeed'));
  assert.ok(fn.includes(".in('external_id', PARTNER_FEED_MERCHANT_IDS)"));
});

test('the ingest slot mapper matches whole words — Captain is not a cap, Spring is not a ring', () => {
  // The rules live in a Deno module the node suite cannot import, so they are
  // read out of the source and EXECUTED here — the same "inspect the product,
  // not the builder" stance the link test takes.
  const sync = readFileSync('supabase/functions/sync-feeds/index.ts', 'utf8');
  const block = sync.slice(sync.indexOf('const SLOT_RULES'), sync.indexOf('];', sync.indexOf('const SLOT_RULES')));
  const rules = [...block.matchAll(/\[\/(.+)\/i, '(\w+)'\]/g)].map(
    ([, pattern, slot]) => [new RegExp(pattern, 'i'), slot] as const,
  );
  assert.ok(rules.length >= 9, `expected the full rule table, parsed ${rules.length}`);
  const slotFor = (title: string) => rules.find(([re]) => re.test(title))?.[1] ?? null;

  // The live regression, verbatim from the brkox feed.
  assert.equal(slotFor("Wall Display Frame for LEGO® Icons Captain Jack Sparrow's Pirate Ship 10365"), null);
  // Prefix traps that must stay dead.
  assert.equal(slotFor('Spring Garden Party Invitation'), null);
  assert.equal(slotFor('Teen Vogue Poster'), null);
  // And the words themselves must still land, plurals included.
  assert.equal(slotFor('Wool Baseball Cap'), 'headwear');
  assert.equal(slotFor('Spring Midi Dress'), 'dress');
  assert.equal(slotFor('Leather Boots'), 'footwear');
  assert.equal(slotFor('Linen Shirts Two-Pack'), 'top');
});

test('gap-shop-match did not inherit the gear feeds — its owned source is pinned', () => {
  assert.ok(gap.includes("const OWNED_GAP_MERCHANT_IDS = ['124976']"));
  assert.ok(gap.includes(".in('catalog_merchants.external_id', OWNED_GAP_MERCHANT_IDS)"));
});

test('the shelf obeys C-03 and discloses paid links', () => {
  // ── AMENDED 2026-09-02 (P1 #18) ──────────────────────────────────────────
  //
  // The partner shelf used to render whole on Explore, under a second whole
  // shelf, which is how a private social page became a merchant feed. It now
  // reaches Explore through the ONE compact grid (`ShopShelf`, at most six
  // cards) and renders whole on `/shop`, behind that grid's "See more".
  //
  // What the founder's order of 2026-09-02 actually asked for is untouched:
  // every joined partner's clothes, images and tracked links are on Explore,
  // and the C-03 switch still decides whether any of it renders. What changed
  // is how much of it is on the first screen.
  assert.ok(
    explore.includes('partnerShelfCards(partnerFeed.data ?? [], feedProfile)'),
    'the partner shelf no longer reaches Explore',
  );
  assert.ok(explore.includes('showWhereToBuy.data === true ? ('), 'the C-03 gate moved off the shelf');
  assert.ok(explore.includes('<ShopShelf'), 'Explore lost its compact shelf');

  const full = readFileSync('src/app/shop.tsx', 'utf8');
  assert.ok(full.includes('<PartnerShopSection'), 'the full partner shelf has nowhere to live');
  assert.ok(full.includes('useShowWhereToBuy()'), 'the full shelf escaped C-03');

  // The disclosure follows the cards, per row, in both places.
  assert.ok(section.includes('Paid link'), 'the disclosure is on the shelf, in words');
  assert.ok(section.includes('paid arrangement'), 'and said plainly above the grid');
  const compact = readFileSync('src/components/explore/shop-shelf.tsx', 'utf8');
  assert.ok(compact.includes('PAID_LINK_LABEL'), 'the compact grid dropped the paid marker');
  // The compact grid mixes paid and unpaid cards, so the marker must be
  // per-card there — a block sentence would be false for half of it
  // (tests/commerce-disclosure.test.ts owns that rule).
  assert.ok(/card\.paid/.test(compact), 'the marker is not conditioned on the card');
});

test('analytics carry counts and the shelf word, never a product or merchant', () => {
  assert.ok(hook.includes("track('explore_shop_feed_loaded', { shelf: 'partner', cards: data.items.length })"));
  assert.ok(section.includes("track('explore_shop_product_opened', { shelf: 'partner' })"));
  for (const src of [hook, section]) {
    assert.ok(!/track\([^)]*(title|merchant:|brand)/.test(src), 'no content in events');
  }
});
