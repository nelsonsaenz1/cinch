/**
 * The launch fixture, against rows the licensed feed actually returned.
 *
 * `catalog-families.test.ts` proves the grouping and ranking RULES against
 * fixtures built to exercise them. This file proves something the constructed
 * fixture structurally could not: that the rules survive contact with three real
 * merchants who each format a title differently and agree on nothing.
 *
 * The rows are recorded, not written — see the header of
 * `tests/fixtures/catalogue-james-perse.json` for their provenance and for the
 * three rules they falsified. Every assertion below failed before those fixes.
 *
 * WHAT THIS FILE DOES NOT CLAIM. It is a snapshot of one day's feed. Merchants
 * add and drop listings, so an assertion here that starts failing is a signal to
 * re-record, not necessarily a bug — which is why the assertions are about the
 * SHAPE of the answer (the launch family leads, near-misses are demoted, no name
 * is a fragment) and never about a count of rows.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import type { CatalogProduct } from '../supabase/functions/_shared/catalog.ts';
import { parseQuery } from '../supabase/functions/_shared/catalog-query.ts';
import {
  type CatalogFamily,
  groupFamilies,
  rankFamilies,
} from '../supabase/functions/garment-search/families.ts';

const ROWS: CatalogProduct[] = JSON.parse(
  readFileSync('tests/fixtures/catalogue-james-perse.json', 'utf8'),
).products;

const PARSED = parseQuery("James Perse men's T-shirt");
const RESULT = rankFamilies(groupFamilies(ROWS), PARSED);

const find = (list: readonly CatalogFamily[], title: string) =>
  list.find((f) => f.title === title);

// ---------------------------------------------------------------------------
// The launch criterion
// ---------------------------------------------------------------------------

test('the exact brand and garment family leads, with every colour the shop lists', () => {
  const first = RESULT.exact[0];
  assert.ok(first, 'the live rows produced no exact family at all');
  assert.equal(first.title, 'Combed Cotton-Jersey T-Shirt');
  assert.equal(first.brand, 'James Perse');

  // Seven separate merchant rows, one card. This is the whole point of §10.2:
  // without grouping the user scrolls seven near-identical tiles and cannot see
  // that they are one shirt.
  assert.equal(first.colours.length, 7);
  assert.deepEqual(
    [...first.colours.map((c) => c.label)].sort(),
    ['Black', 'Blue', 'Brown', 'Green', 'Grey', 'Neutrals', 'White'],
  );
});

test('a colour the lexicon cannot place is still offered, in the shop’s own words', () => {
  // "Neutrals" is Mr Porter's word and resolves to nothing in the lexicon. §10.3
  // says such a row must SAY so rather than invent a name, so it is present and
  // flagged unresolved — never dropped, because the user may own that shirt.
  const neutrals = RESULT.exact[0].colours.find((c) => c.label === 'Neutrals');
  assert.ok(neutrals, 'an unresolvable colourway was silently dropped');
  assert.equal(neutrals.resolved, false);
});

// ---------------------------------------------------------------------------
// Near misses rank below — CPV2-04
// ---------------------------------------------------------------------------

test('henleys, polos and long sleeves are demoted, not mixed in', () => {
  const cuts = RESULT.nearMiss.map((f) => f.nearMissCut).sort();
  assert.deepEqual(cuts, ['henley', 'long sleeve', 'polo', 'polo']);

  for (const family of RESULT.exact) {
    assert.equal(family.nearMissCut, null, `${family.title} ranked as an exact match`);
  }
});

// ---------------------------------------------------------------------------
// The three rules the live rows falsified
// ---------------------------------------------------------------------------

test('a finish word names a garment and does not merge into the plain one', () => {
  // Mr Porter sells both. Dropping `distressed` from the key merged them, and
  // the distressed shirt's Brown became a colourway of the plain one — so a user
  // choosing Brown would have imported a garment they never looked at.
  const distressed = find(RESULT.exact, 'Distressed Cotton-Jersey T-Shirt');
  const plain = find(RESULT.exact, 'Cotton Jersey T-Shirt');

  assert.ok(distressed, 'the distressed shirt lost its own family');
  assert.deepEqual(distressed.colours.map((c) => c.label), ['Brown']);
  assert.ok(plain, 'the plain shirt lost its family');
  assert.ok(
    !plain.colours.some((c) => c.label === 'Brown'),
    'the distressed shirt’s colour is being offered under the plain shirt',
  );
});

test('a trailing gender segment is not part of the product’s name', () => {
  // Every Mr Porter row is "Brand - Product - Men - Colour - Size".
  for (const family of [...RESULT.exact, ...RESULT.nearMiss]) {
    assert.ok(
      !/[-–—|,]\s*(men|women|mens|womens|men's|women's)$/i.test(family.title),
      `a gender segment survived into a printed name: ${family.title}`,
    );
  }
});

test('a leading gender word is kept, because there it is the name', () => {
  // COUTR lists "James Perse Men's Essential T-Shirt". Stripping there would
  // leave "Essential T-Shirt" and lose the only thing distinguishing it.
  assert.ok(find(RESULT.exact, "Men's Essential T-Shirt"), 'a leading gender word was stripped');
});

test('no printed name is a fragment', () => {
  // Grailed writes "(Size L)". Stripping "L)" as a size and stopping left names
  // ending mid-parenthesis — worse than the over-long title it came from.
  for (const family of [...RESULT.exact, ...RESULT.nearMiss]) {
    assert.ok(family.title.trim().length > 0, 'a family was printed with no name');
    assert.ok(
      !/[([{]$|[-–—|,/]$/.test(family.title.trim()),
      `a name ends on dangling punctuation: ${JSON.stringify(family.title)}`,
    );
    assert.ok(
      !/\b(in|and|or|with|for|by|the|a|of)$/i.test(family.title.trim()),
      `a name ends on a connective: ${JSON.stringify(family.title)}`,
    );
    assert.ok(
      !family.title.toLowerCase().startsWith('james perse'),
      `the brand is printed twice: ${family.title}`,
    );
  }
});

// ---------------------------------------------------------------------------
// What the cache actually holds
// ---------------------------------------------------------------------------

test('grouping works with no category and no gender on any row', () => {
  // These rows were cached by the deployed pre-Packet-1 code, which had neither
  // field — which is also the state of every cached row for the first week after
  // this ships, since the cache TTL is seven days. Grouping must not depend on
  // them, and §11 forbids assuming them in any case.
  assert.ok(ROWS.every((r) => r.category === null && r.gender === null));
  assert.ok(RESULT.exact.length > 0, 'grouping collapsed without category or gender');
});
