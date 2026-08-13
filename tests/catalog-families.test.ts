/**
 * Listings become families, and the families come out in the right order.
 *
 * WHY THIS IS A FIXTURE TEST RATHER THAN A UNIT TEST
 *
 * `docs/commerce/incident-2026-08-11-junk-results.md` records what happens when
 * nobody looks at the rows: `gap-shop-match` shipped, was live for fifteen
 * minutes, and answered "coat" with a wooden coat STAND. The lesson written
 * down at the time was not "add a filter" but "nobody looked at the rows before
 * it shipped". `tests/slot-relevance.test.ts` is that looking for the shop
 * suggestions; this is that looking for the matcher.
 *
 * The fixture is CONSTRUCTED rather than recorded and its header says so at
 * length. It is in the wire shape `normalise()` produces and populated to the
 * live field census in `catalog.ts`, but it is not a recording of a live James
 * Perse query — that costs a metered production request this packet may not
 * make. So these tests prove the RULES and they do not prove Datafeedr carries
 * the brand. That second question is a blocker, not a test.
 *
 * The rows are awkward on purpose: three spellings of one colour, two merchants
 * listing the same shirt, a colour the lexicon cannot fully resolve, a row with
 * no colour, a foreign brand that satisfies the words exactly, and a garment of
 * another class wearing the same brand.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import type { CatalogProduct } from '../supabase/functions/_shared/catalog.ts';
import { parseQuery } from '../supabase/functions/_shared/catalog-query.ts';
import {
  canonicalTitle,
  displayTitle,
  groupFamilies,
  normaliseColour,
  rankFamilies,
  type CatalogFamily,
} from '../supabase/functions/garment-search/families.ts';

// A repo-relative path, not one relative to this file: the runner bundles each
// test into `node_modules/.cache/unit-tests/` and runs it from there, so
// `import.meta.url` points somewhere the fixtures are not. Same idiom as
// `tests/slot-relevance.test.ts`.
const fixture = JSON.parse(
  readFileSync('tests/fixtures/catalogue-families.json', 'utf8'),
) as { query: string; rows: CatalogProduct[] };

const parsed = parseQuery(fixture.query);
const result = rankFamilies(groupFamilies(fixture.rows), parsed);

const titles = (families: CatalogFamily[]) => families.map((f) => f.title);
const find = (needle: string) =>
  [...result.exact, ...result.nearMiss].find((f) => f.title.toLowerCase().includes(needle));

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

test('three merchants listing one shirt produce one family', () => {
  // The user owns one shirt. Three results for it is three chances to pick the
  // wrong one and no additional information.
  const crew = find('crew neck jersey');
  assert.ok(crew, 'the crew neck family did not survive grouping');
  assert.deepEqual([...crew.merchants].sort(), ['Mr Porter', 'Nordstrom', 'Saks']);
  assert.equal(
    result.exact.filter((f) => f.title.toLowerCase().includes('crew neck jersey')).length,
    1,
    'the same shirt came back as more than one family',
  );
});

test('distinct colourways all survive the collapse', () => {
  const crew = find('crew neck jersey')!;
  const labels = crew.colours.map((c) => c.label);
  // White, Black, Heather Grey, Vintage Black, and the row the feed gave no
  // colour for. Collapsing any of these would remove a choice the user is
  // meant to be making.
  assert.equal(crew.colours.length, 5, `expected five colourways, got ${labels.join(' / ')}`);
  assert.ok(labels.includes('White'));
  assert.ok(labels.includes('Black'));
  assert.ok(labels.includes('Heather Grey'));
});

test('three spellings of one colour are one colourway', () => {
  // §10.3: "Heather grey" / "Htr Grey" / "Grey Heather" are one colourway.
  const crew = find('crew neck jersey')!;
  const heathers = crew.colours.filter((c) => c.label.toLowerCase().includes('heather'));
  assert.equal(heathers.length, 1, `heather grey split into ${heathers.length} colourways`);

  assert.equal(normaliseColour('Heather Grey')!.key, normaliseColour('Htr Grey')!.key);
  assert.equal(normaliseColour('Heather Grey')!.key, normaliseColour('Grey Heather')!.key);
  assert.equal(normaliseColour('HEATHER GREY')!.key, normaliseColour('heather grey')!.key);
});

test('a colour the lexicon cannot resolve keeps the shop’s own words', () => {
  // §10.3: "Where no usable name exists the row must say so, not invent one."
  // The failure this forbids is quietly printing "Grey" for "Heather Grey",
  // which would put two different colourways under one name.
  const crew = find('crew neck jersey')!;

  const heather = crew.colours.find((c) => c.label.toLowerCase().includes('heather'))!;
  assert.equal(heather.label, 'Heather Grey');
  assert.equal(heather.resolved, false, 'a partial resolution was reported as Cinch’s own word');

  const vintage = crew.colours.find((c) => c.label.toLowerCase().includes('vintage'))!;
  assert.equal(vintage.label, 'Vintage Black');
  assert.equal(vintage.resolved, false);

  // And a colour that IS the lexicon's own word says so, so the screen can tell
  // the two apart.
  const white = crew.colours.find((c) => c.label === 'White')!;
  assert.equal(white.resolved, true);
});

test('a colourway the feed did not name is not given one', () => {
  const crew = find('crew neck jersey')!;
  const unnamed = crew.colours.find((c) => c.label === '');
  assert.ok(unnamed, 'the unnamed colourway was dropped or invented a name');
  assert.equal(unnamed.resolved, false);
  assert.equal(normaliseColour(null), null);
  assert.equal(normaliseColour('   '), null);
});

test('a missing image is a null rather than an empty string', () => {
  // §11: implementation may not assume a listing has an image. The screen draws
  // this state, so it has to be able to see it.
  const [family] = groupFamilies([
    { ...fixture.rows[0], externalId: '9001', imageUrl: '', thumbnailUrl: null },
  ]);
  assert.equal(family.colours[0].imageUrl, null);
  assert.equal(family.colours[0].alternateImageUrl, null);
});

test('the canonical title loses the colour, the size and the brand', () => {
  assert.equal(
    canonicalTitle('James Perse Crew Neck Jersey T-Shirt - Heather Grey, XL', {
      colour: 'Heather Grey',
      brand: 'James Perse',
    }),
    'crew neck jersey t shirt',
  );
  // The same garment at a shop that repeats neither the brand nor the colour.
  assert.equal(canonicalTitle('Crew Neck Jersey T-Shirt', { colour: 'Htr Grey' }), 'crew neck jersey t shirt');
});

test('the printed name loses the colourway, the size and the brand', () => {
  // CPV2-04's card sits above a row of six colours, so the colourway cannot be
  // in the name. The atlas's own VoiceOver line reads "Crew Neck Jersey Tee.
  // James Perse, short sleeve." — maker spoken separately, cut kept.
  assert.equal(
    displayTitle('James Perse Crew Neck Jersey T-Shirt - Heather Grey', { brand: 'James Perse' }),
    'Crew Neck Jersey T-Shirt',
  );
  assert.equal(displayTitle('Crew Neck Jersey T-Shirt, XL'), 'Crew Neck Jersey T-Shirt');
  assert.equal(displayTitle('Cotton Crew Neck Tee White'), 'Cotton Crew Neck Tee');
});

test('the printed name keeps the words that tell one product from another', () => {
  // Strip these and every shirt in the catalogue is called "Tee".
  assert.equal(
    displayTitle('James Perse Short Sleeve Crew Tee - Navy', { brand: 'James Perse' }),
    'Short Sleeve Crew Tee',
  );
  assert.equal(
    displayTitle('James Perse Sueded Jersey Henley - Black', { brand: 'James Perse' }),
    'Sueded Jersey Henley',
  );
  // A brand in the MIDDLE of a name is usually part of the product's own name,
  // and cutting there would leave a fragment.
  assert.equal(displayTitle("Levi's 501 Original Jean", { brand: '501' }), "Levi's 501 Original Jean");
});

test('a name made only of variant words keeps the shop’s own', () => {
  // A blank card is worse than an odd one.
  assert.equal(displayTitle('Navy'), 'Navy');
  assert.equal(displayTitle('Heather Grey XL'), 'Heather Grey XL');
});

test('every family prints a name with no colourway in it', () => {
  for (const family of [...result.exact, ...result.nearMiss]) {
    const printed = family.title.toLowerCase();
    for (const colour of family.colours) {
      if (!colour.label) continue;
      assert.ok(
        !printed.endsWith(colour.label.toLowerCase()),
        `family "${family.title}" is named after one of its own colourways`,
      );
    }
    assert.ok(family.title.trim().length > 0, 'a family printed an empty name');
  }
});

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

test('the exact brand and class lead', () => {
  const first = result.exact[0];
  assert.equal(first.brand, 'James Perse');
  assert.equal(first.productClass, 'top');
  assert.ok(
    first.title.toLowerCase().includes('crew neck jersey'),
    `expected the crew neck tee first, got: ${titles(result.exact).join(' | ')}`,
  );
});

test('a foreign brand can never outrank the brand that was asked for', () => {
  // The measurement in catalog.ts: a brand name inside a merchant-written title
  // is not evidence the garment is that brand. Only the `brand` column is.
  const everlane = result.exact.findIndex((f) => f.brand === 'Everlane');
  assert.ok(everlane > 0, 'a foreign brand ranked first');
  const lastAsked = result.exact.map((f) => f.brand).lastIndexOf('James Perse');
  assert.ok(
    everlane > lastAsked,
    'a foreign brand outranked a family of the brand that was asked for',
  );
});

test('near misses are demoted into their own group, not deleted', () => {
  // CPV2-04, and the accepted decision behind it: a henley is a top and so is a
  // tee, so refusing it outright would hide a garment the person may well own.
  const cuts = result.nearMiss.map((f) => f.nearMissCut).sort();
  assert.deepEqual(cuts, ['henley', 'polo']);

  for (const family of result.nearMiss) {
    assert.equal(family.productClass, 'top', 'a near miss is a different CUT, not a different garment');
  }
  for (const family of result.exact) {
    assert.equal(family.nearMissCut, null, 'a near miss leaked into the exact group');
  }
  assert.ok(
    !titles(result.exact).some((t) => /henley|polo/i.test(t)),
    'a near miss ranked as an exact match',
  );
});

test('a different garment class is excluded rather than demoted', () => {
  // "James Perse Jersey Pant" satisfies the brand exactly and is not an answer
  // to "T-shirt" at any rank. The near-miss group is for the right garment in
  // the wrong cut only.
  assert.ok(
    ![...result.exact, ...result.nearMiss].some((f) => /pant/i.test(f.title)),
    'a garment of another class was offered',
  );
});

test('no near-miss group is invented when the noun has no distinguishers', () => {
  // §10.4: "If it cannot be derived, omit the near-miss group rather than
  // mixing cuts." A tote has no cut table, so nothing may be demoted.
  const bagQuery = parseQuery('leather tote');
  assert.deepEqual(bagQuery.nearMissCuts, []);
  const grouped = rankFamilies(groupFamilies(fixture.rows), bagQuery);
  assert.deepEqual(grouped.nearMiss, []);
});

test('asking for the cut itself makes it an exact answer', () => {
  // A person searching for a polo shirt is answered by a polo.
  const poloQuery = parseQuery('james perse polo');
  const grouped = rankFamilies(groupFamilies(fixture.rows), poloQuery);
  assert.ok(
    titles(grouped.exact).some((t) => /polo/i.test(t)),
    'the polo was demoted for a query that asked for a polo',
  );
});

test('the order is stable across runs', () => {
  // A fixture test is only worth having if it pins ONE order. Anything that
  // sorts by a Map's insertion accident would pass once and fail on a rename.
  const again = rankFamilies(groupFamilies(fixture.rows), parseQuery(fixture.query));
  assert.deepEqual(titles(again.exact), titles(result.exact));
  assert.deepEqual(titles(again.nearMiss), titles(result.nearMiss));
});

// ---------------------------------------------------------------------------
// The contract carries no shop
// ---------------------------------------------------------------------------

test('no price, no link and no stock reaches the family contract', () => {
  // The handoff's §3: "Words that appear nowhere: price, buy, shop now, cart,
  // sponsored, paid link, affiliate, commission, in stock, web search." The
  // source rows carry every one of those facts; the contract must not.
  const serialised = JSON.stringify([...result.exact, ...result.nearMiss]);

  for (const banned of [
    'priceMinor',
    'currency',
    'monetised',
    'linkUrl',
    'instock',
    'onsale',
    'salediscount',
    'saleprice',
  ]) {
    assert.ok(!serialised.includes(banned), `the family contract carries "${banned}"`);
  }

  // The price of the fixture rows, in case a future field name hides it.
  assert.ok(!serialised.includes('9500'), 'a price value reached the family contract');

  // The affiliate redirector must not appear either — the only URL a colourway
  // carries is the merchant's own page, for provenance, never as a destination.
  for (const family of [...result.exact, ...result.nearMiss]) {
    for (const colour of family.colours) {
      if (colour.pageUrl) {
        assert.ok(
          !/@@@|linksynergy|anrdoezrs|pntrs|awin1/.test(colour.pageUrl),
          `a tracked link reached a colourway: ${colour.pageUrl}`,
        );
      }
    }
  }
});

test('ranking never consults price', () => {
  // Not a code-reading assertion: the same rows with every price inverted must
  // produce the identical order. Cheapest-first on an open catalogue is a
  // ranking by how little the garment resembles the one that was asked for —
  // catalog.ts measured that and removed the sort; it must not return as a
  // tiebreak.
  const inverted = fixture.rows.map((r, i) => ({ ...r, priceMinor: 100000 - i * 1000 }));
  const other = rankFamilies(groupFamilies(inverted), parsed);
  assert.deepEqual(titles(other.exact), titles(result.exact));
  assert.deepEqual(titles(other.nearMiss), titles(result.nearMiss));
});

test('a category the merchants disagree about is reported as unknown', () => {
  // Merchant categories are free text with no taxonomy. Picking one shop's word
  // to stand for all of them would be inventing agreement.
  const crew = find('crew neck jersey')!;
  assert.equal(crew.category, null);

  // Where they do agree, the word survives.
  const shortSleeve = find('short sleeve')!;
  assert.equal(shortSleeve.category, "Men's T-Shirts");
});
