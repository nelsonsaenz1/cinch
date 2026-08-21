/**
 * The category grid — the catalogue entered without words.
 *
 * Three contracts, one file:
 *
 *   1 · THE MIRROR. `_shared/browse-slots.ts` restates the nine verified terms
 *       from `gap-shop-match/policy.ts`'s `SLOT_QUERY` because Edge Functions
 *       may not import across each other's directories. A mirror is only
 *       honest while a test reads both tables, so this one does — a term
 *       changed on either side fails here before it can ship as two different
 *       shops answering one category.
 *
 *   2 · ENUM-ONLY INPUT. The browse action's whole privacy argument is that a
 *       request cannot carry words. `bounds.ts` has to refuse free text in a
 *       slot, a tenth value, and typed words riding beside a valid slot — and
 *       the validated request must contain the slot and nothing else.
 *
 *   3 · THE CLIENT MACHINE. The hook's transitions are pure functions in
 *       `browse-states.ts` (the `saved-looks/states.ts` arrangement), so they
 *       are exercised as functions rather than described.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  BROWSABLE_SLOTS,
  BROWSE_TERM,
  isBrowsableSlot,
} from '../supabase/functions/_shared/browse-slots.ts';
import { parseQuery } from '../supabase/functions/_shared/catalog-query.ts';
import { SLOT_QUERY } from '../supabase/functions/gap-shop-match/policy.ts';
import { parseGarmentSearchRequest } from '../supabase/functions/garment-search/bounds.ts';
import { BROWSE_TILES, browseTileLabel } from '../src/features/catalogue/browse-spec.ts';
import { browseFailureFor, browseStateFor } from '../src/features/catalogue/browse-states.ts';
import type { CatalogueFamilies } from '../src/features/catalogue/types.ts';

// ---------------------------------------------------------------------------
// 1 · The mirror
// ---------------------------------------------------------------------------

test('the browse terms are exactly the nine verified SLOT_QUERY words', () => {
  assert.equal(BROWSABLE_SLOTS.length, 9);

  for (const slot of BROWSABLE_SLOTS) {
    const original = SLOT_QUERY[slot];
    assert.ok(original, `${slot} is browsable but SLOT_QUERY has no entry for it`);
    assert.equal(
      original.verified,
      true,
      `${slot} is browsable but its term was never verified — see SLOT_QUERY's rules`,
    );
    assert.equal(
      BROWSE_TERM[slot],
      original.word,
      `the mirrored term for ${slot} drifted from the verified one`,
    );
  }
});

test('"other" is not browsable, for the same reason it is not searchable', () => {
  // SLOT_QUERY says it in data — null — and the browse enum says it by
  // absence. Both statements have to hold.
  assert.equal(SLOT_QUERY.other, null);
  assert.ok(!isBrowsableSlot('other'));
  assert.ok(!(BROWSABLE_SLOTS as readonly string[]).includes('other'));
});

test('a browse term can never be read as a brand constraint', () => {
  // The server parses the term with `parseQuery`, whose leading-run heuristic
  // pins unrecognised leading words to `brand =` — which empties every rung.
  // A single-word query is immune by construction; this pins that all nine
  // stay that way, so a browse can never return nothing because its own term
  // was mistaken for a maker.
  for (const slot of BROWSABLE_SLOTS) {
    const parsed = parseQuery(BROWSE_TERM[slot]);
    assert.equal(parsed.brand, null, `"${BROWSE_TERM[slot]}" was parsed as a brand`);
    assert.ok(parsed.normalised.length > 0);
  }
});

// ---------------------------------------------------------------------------
// 2 · Enum-only input
// ---------------------------------------------------------------------------

test('every slot in the enum parses, and to nothing but itself', () => {
  for (const slot of BROWSABLE_SLOTS) {
    const parsed = parseGarmentSearchRequest({ action: 'browse', slot });
    // The whole request: two keys. No field exists that could carry words, so
    // "no free text on the wire" is a property of the shape, not a promise.
    assert.deepEqual(parsed, { action: 'browse', slot });
    assert.deepEqual(Object.keys(parsed).sort(), ['action', 'slot']);
  }
});

/** The message a parse refuses with, checked by hand — the repo's `@types`
 *  version types `assert.throws`'s second argument as a string (see the note
 *  in `contrast.test.ts`), so the matcher is written out instead. */
function refusal(fn: () => unknown): string {
  try {
    fn();
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
  return '';
}

test('free text in the slot field is refused, not searched', () => {
  for (const smuggled of ['red silk dress', 'shirt', ' top', 'TOP', 'coat stand', '']) {
    // 'shirt' is a VERIFIED TERM and still refused: the wire speaks slot
    // names, never search words, and accepting the term where the slot goes
    // would blur exactly the line the disclosure draws.
    assert.match(
      refusal(() => parseGarmentSearchRequest({ action: 'browse', slot: smuggled })),
      /nine browsable categories/,
      `"${smuggled}" was accepted as a slot`,
    );
  }
  assert.match(refusal(() => parseGarmentSearchRequest({ action: 'browse' })), /nine browsable/);
  assert.match(
    refusal(() => parseGarmentSearchRequest({ action: 'browse', slot: 3 })),
    /nine browsable/,
  );
});

test('typed words riding beside a valid slot are refused, never ignored', () => {
  assert.match(
    refusal(() =>
      parseGarmentSearchRequest({ action: 'browse', slot: 'top', description: 'james perse tee' }),
    ),
    /never typed words/,
  );
  assert.match(
    refusal(() => parseGarmentSearchRequest({ action: 'browse', slot: 'top', query: 'anything' })),
    /never typed words/,
  );
});

// ---------------------------------------------------------------------------
// 3 · The client
// ---------------------------------------------------------------------------

test('the client tiles and the server enum are the same nine slots', () => {
  assert.deepEqual(
    BROWSE_TILES.map((t) => t.slot).sort(),
    [...BROWSABLE_SLOTS].sort(),
    'a tile exists the server would 400, or a slot exists no tile can reach',
  );
  // The labels are display names, so each must exist and no two may collide.
  const labels = BROWSE_TILES.map((t) => t.label);
  assert.equal(new Set(labels).size, labels.length);
  for (const tile of BROWSE_TILES) {
    assert.equal(browseTileLabel(tile.slot), tile.label);
    assert.ok(tile.label.trim().length > 0);
  }
});

const FAMILIES: CatalogueFamilies = { exact: [], nearMiss: [] };

test('a server answer with families is loaded — even an empty one', () => {
  // Zero families is "this category has nothing", a sentence about the
  // catalogue. Only `families: null` — grouping unavailable — is a failure.
  const state = browseStateFor('top', { kind: 'response', families: FAMILIES });
  assert.deepEqual(state, { status: 'loaded', slot: 'top', families: FAMILIES });
});

test('families: null is a failure, never an empty grid', () => {
  const state = browseStateFor('bag', { kind: 'response', families: null });
  assert.equal(state.status, 'failed');
});

test('the fail-closed code arrives as partner_unavailable, with the code kept', () => {
  const state = browseStateFor('dress', { kind: 'error', code: 'catalogue_unavailable' });
  assert.deepEqual(state, {
    status: 'failed',
    slot: 'dress',
    failure: 'partner_unavailable',
    code: 'catalogue_unavailable',
  });
  assert.equal(browseFailureFor('search_timeout'), 'timeout');
});

test('a fetch that never left the device is offline, not the catalogue\'s fault', () => {
  assert.deepEqual(browseStateFor('footwear', { kind: 'thrown', offline: true }), {
    status: 'offline',
    slot: 'footwear',
  });
  assert.equal(browseStateFor('footwear', { kind: 'thrown', offline: false }).status, 'failed');
});

test('no effect can spend a browse, and the body carries only the slot', () => {
  // Same structural check `catalogue-client.test.ts` applies to the search:
  // the hook has no effect at all, so nothing can fire a request but a tap —
  // and the one invoke body it builds has no field a word could travel in.
  // Comments stripped, the repo's usual way: the hook's own header EXPLAINS
  // why no description exists, and scanning the explanation would make writing
  // the reason down the thing that fails the test.
  const src = readFileSync('src/features/catalogue/use-catalogue-browse.ts', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/useEffect/.test(src), 'the browse hook grew an effect');
  assert.match(src, /body:\s*\{\s*action:\s*'browse',\s*slot\s*\}/);
  assert.ok(!/description/.test(src), 'the browse hook mentions a description');
});
