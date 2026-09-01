/**
 * A title this function emits is a title the import endpoint accepts back.
 *
 * THE FAILURE THIS IS ABOUT
 *
 * A user searched, tapped a shirt, tapped "Add to closet", and got the generic
 * refusal. Nothing was wrong with the shirt, the network, or the closet's
 * capacity. The merchant had simply written a 170-character product name, the
 * matcher passed it through untouched, and the client posted it straight back
 * as `imports[0].title` — where the request bounds refuse anything over 120:
 *
 *   imports[0].title is too long (170 characters, limit 120).
 *
 * So the function rejected a string it had itself just emitted. Nothing the
 * user could do would fix it: the title was not theirs to shorten.
 *
 * `page-meta.ts` had the rule written down already — "a title this file emits
 * must be one the import endpoint would accept back" — and honoured it. The two
 * catalogue producers never got the same treatment: `toCandidate` capped at 200
 * (a bound for a different endpoint's shape, not this one's) and the family
 * title had no cap at all.
 *
 * These tests are the round trip, stated as a rule rather than as a length:
 * take the title the function emits, hand it to the very validator the client's
 * request will meet, and require that it survives.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import type { CatalogProduct } from '../supabase/functions/_shared/catalog.ts';
import { parseGarmentSearchRequest } from '../supabase/functions/garment-search/bounds.ts';
import { toCandidate } from '../supabase/functions/garment-search/catalog-provider.ts';
import { groupFamilies } from '../supabase/functions/garment-search/families.ts';
import { boundTitle, MAX_TITLE_CHARS } from '../supabase/functions/garment-search/title-bound.ts';

// Repo-relative, not file-relative: the runner bundles each test into
// `node_modules/.cache/unit-tests/` and runs it from there. Same idiom as
// `tests/catalog-families.test.ts`.
const fixture = JSON.parse(
  readFileSync('tests/fixtures/catalogue-families.json', 'utf8'),
) as { query: string; rows: CatalogProduct[] };

/**
 * A real merchant sentence, not a wall of one character.
 *
 * The distinction matters: a string of 170 identical letters would be cut by
 * any implementation, including a naive one, and would prove nothing about
 * where the cut lands. This has words, punctuation and a brand prefix — the
 * shape the feed actually carries — so the assertions below are about a cut a
 * person would accept reading.
 */
const LONG_TITLE =
  'James Perse Crew Neck Short Sleeve Sueded Jersey T-Shirt in Vintage White ' +
  'with Garment Dyed Finish and Reinforced Shoulder Seams, Made in Los Angeles ' +
  'from Long Staple Supima Cotton - White';

/** The row the merchant with the long name would send. */
const longRow = (): CatalogProduct => ({ ...fixture.rows[0], title: LONG_TITLE });

/** The import the client posts for a chosen colourway, with `title` under test. */
const importBatchWith = (title: string) => ({
  action: 'import-batch',
  imports: [
    {
      externalId: 'df-101',
      imageUrl: 'https://cdn.shop.test/df-101.jpg',
      pageUrl: 'https://shop.test/p/df-101',
      title,
      colourLabel: 'White',
    },
  ],
});

/** The import the single-garment path posts for a chosen search tile. */
const importWith = (title: string) => ({
  action: 'import',
  imageUrl: 'https://cdn.shop.test/df-101.jpg',
  pageUrl: 'https://shop.test/p/df-101',
  title,
});

/**
 * The refusal a request earned, or '' when it was accepted.
 *
 * Written out by hand rather than with `assert.throws` / `assert.doesNotThrow`:
 * the repo's `@types/node` types the strict namespace without them and types
 * the matcher as a string, per the note in `tests/catalogue-fail-closed.test.ts`.
 */
function refusalFor(request: unknown): string {
  try {
    parseGarmentSearchRequest(request);
    return '';
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

// ---------------------------------------------------------------------------
// The round trip — the defect itself
// ---------------------------------------------------------------------------

test('a family title the matcher emits is one the batch import accepts back', () => {
  assert.ok(LONG_TITLE.length > MAX_TITLE_CHARS, 'the fixture must exceed the bound');

  const [family] = groupFamilies([longRow()]);

  // The client posts `family.title` verbatim — see
  // `src/features/catalogue/use-catalogue-import.ts`.
  assert.equal(
    refusalFor(importBatchWith(family.title)),
    '',
    `the matcher emitted a ${family.title.length}-character title its own import refuses`,
  );
});

test('a candidate title the provider emits is one the single import accepts back', () => {
  const candidate = toCandidate(longRow(), 0.8);

  // The client posts `candidate.title` verbatim — see
  // `src/features/ingest/use-garment-search.ts`.
  assert.equal(
    refusalFor(importWith(candidate.title)),
    '',
    `the provider emitted a ${candidate.title.length}-character title its own import refuses`,
  );
});

test('the bound still refuses a title that came from somewhere else', () => {
  // The producers are capped; the validator is not softened. A caller that
  // invents its own 170-character title still gets the named 400.
  assert.equal(
    refusalFor(importBatchWith('x'.repeat(170))),
    'imports[0].title is too long (170 characters, limit 120).',
  );
});

// ---------------------------------------------------------------------------
// Where the cut lands
// ---------------------------------------------------------------------------

test('truncation stops at a word boundary rather than mid-word', () => {
  const bounded = boundTitle(LONG_TITLE);

  assert.ok(bounded.length <= MAX_TITLE_CHARS);
  // Every word kept is a whole word from the original.
  assert.ok(LONG_TITLE.startsWith(bounded));
  assert.ok(
    LONG_TITLE[bounded.length] === ' ' || LONG_TITLE[bounded.length] === undefined,
    `cut mid-word: ...${bounded.slice(-20)}|${LONG_TITLE.slice(bounded.length, bounded.length + 10)}`,
  );
});

test('the cut never ends on orphaned punctuation', () => {
  // A name whose 120th character lands just after a comma.
  const title = `${'Word '.repeat(22)}Sueded, Jersey Tee`;
  const bounded = boundTitle(title);
  assert.ok(bounded.length <= MAX_TITLE_CHARS);
  assert.doesNotMatch(bounded, /[\s\-–—|,/(]$/);
});

test('a title already inside the bound is returned untouched', () => {
  assert.equal(boundTitle('Crew Neck Jersey Tee'), 'Crew Neck Jersey Tee');
  assert.equal(boundTitle('  Crew Neck Jersey Tee  '), 'Crew Neck Jersey Tee');
});

test('one unbroken word longer than the bound is cut rather than emptied', () => {
  const bounded = boundTitle('A'.repeat(200));
  assert.equal(bounded.length, MAX_TITLE_CHARS);
  assert.equal(refusalFor(importBatchWith(bounded)), '');
});

test('truncation is deterministic — the same title always cuts the same way', () => {
  const once = boundTitle(LONG_TITLE);
  for (let i = 0; i < 5; i += 1) assert.equal(boundTitle(LONG_TITLE), once);
  // And re-bounding an already-bounded title is a no-op, so a value that makes
  // the round trip twice does not erode a word each time.
  assert.equal(boundTitle(once), once);
});

// ---------------------------------------------------------------------------
// What the cut must not cost
// ---------------------------------------------------------------------------

test('the family title still carries the words that name the garment', () => {
  const [family] = groupFamilies([longRow()]);
  assert.match(family.title, /Crew Neck/);
  assert.match(family.title, /T-Shirt/);
});
