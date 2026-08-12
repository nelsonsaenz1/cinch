/**
 * DS-03/04/05 — the typed sentence becomes a piece, locally.
 *
 * Two things are under test and only one of them is the normaliser. The other
 * is a promise: this path must work with the radio off and with AI consent
 * declined, because that is what DS-05's first two notices say. A single
 * network import creeping into this module would break both without breaking a
 * single assertion about categories — so the last test reads the file.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  canFileTypedWords,
  MIN_TYPED_LENGTH,
  normalizeTypedGarment,
} from '../src/features/ingest/typed-garment';

test('the sentence survives verbatim — it is the user’s own writing', () => {
  const g = normalizeTypedGarment('  Navy   wool crewneck sweater ');
  // Trimmed and whitespace-collapsed, never reworded, never title-cased.
  assert.equal(g.description, 'Navy wool crewneck sweater');
});

test('a recognised noun sets the category and is kept verbatim as subcategory', () => {
  const g = normalizeTypedGarment('navy wool crewneck sweater');
  assert.equal(g.category, 'top');
  // `toSlot()` separates a base_top from a mid_layer by regex over this text,
  // so canonicalising it to "top" would lose the layering distinction that
  // drives both the warmth sum and the volume rule.
  assert.equal(g.subcategory, 'crewneck');
});

test('the most specific noun wins, in the order the list is written', () => {
  assert.equal(normalizeTypedGarment('denim jacket').category, 'outerwear');
  assert.equal(normalizeTypedGarment('shirt dress').category, 'dress');
  assert.equal(normalizeTypedGarment('black ankle boots').category, 'footwear');
});

test('an unrecognised sentence files as `other` with the words intact', () => {
  const g = normalizeTypedGarment('the thing my aunt gave me');
  assert.equal(g.category, 'other');
  assert.equal(g.subcategory, null);
  // Still a real, usable, findable piece — which is the whole claim DS-04
  // makes when it says "your words stand".
  assert.equal(g.description, 'the thing my aunt gave me');
});

test('a known colour word resolves; an unknown one leaves colours empty', () => {
  const g = normalizeTypedGarment('navy wool crewneck');
  assert.equal(g.colourTerm, 'navy');
  assert.equal(g.colors.length, 1);
  assert.match(g.colors[0]!.hex, /^#[0-9a-f]{6}$/i);
  assert.equal(g.colors[0]!.name, 'navy');

  const unknown = normalizeTypedGarment('crewneck sweater');
  assert.equal(unknown.colourTerm, null);
  // Empty, NOT a placeholder grey. A garment with no stated colour is honest;
  // a garment with an invented one is the app claiming to know something about
  // somebody's clothes that nobody told it.
  assert.deepEqual(unknown.colors, []);
});

test('the colour word is found wherever it sits in the sentence', () => {
  // A positional rule would understand one of these two and not the other.
  assert.equal(normalizeTypedGarment('navy crewneck').colourTerm, 'navy');
  assert.equal(normalizeTypedGarment('crewneck in navy').colourTerm, 'navy');
});

test('the filing floor is the search floor, so Find and filing agree', () => {
  assert.equal(MIN_TYPED_LENGTH, 3);
  assert.equal(canFileTypedWords('  a '), false);
  assert.equal(canFileTypedWords('tee'), true);
  // No user can reach a state where Find is inert but the escape row is live,
  // or the reverse — either would be a control whose availability contradicts
  // the one beside it.
});

test('nothing in this module can reach the network', () => {
  // DS-05 draws offline and declined-consent as states in which filing STILL
  // works. An import of the search hook, the supabase client, or anything that
  // fetches would make that false in exactly the two cases it is promised, and
  // would send the sentence to a server the user may have told us not to.
  const src = readFileSync('src/features/ingest/typed-garment.ts', 'utf8');
  const imports = [...src.matchAll(/^import .*?from '([^']+)';$/gm)].map((m) => m[1]!);
  const allowed = ['@/types/database', '@/features/intake/colour-lexicon'];
  assert.deepEqual(
    imports.filter((i) => !allowed.includes(i)),
    [],
    `typed-garment.ts may only import ${allowed.join(' and ')}`,
  );
  assert.doesNotMatch(src, /\bfetch\b|supabase|invoke|axios/);
});

test('the filing action sends no image path and no fabricated URL', () => {
  // The atlas is explicit that a match with no usable picture "files as a
  // silhouette instead of borrowing a stock photograph", and a placeholder URL
  // would be exactly that borrowing with an extra step.
  const src = readFileSync('src/features/ingest/use-garment-search.ts', 'utf8');
  const filing = src.slice(src.indexOf('export function useFileTypedWords'));
  const body = filing.slice(0, filing.indexOf('export function useGarmentSearchFlow'));
  for (const column of ['image_path', 'thumb_path', 'cutout_path', 'plate_path']) {
    assert.doesNotMatch(body, new RegExp(`\\b${column}\\b`), `${column} written by filing`);
  }
  // And the provenance columns say what this row actually is.
  assert.match(body, /intake_method: 'manual'/);
  assert.match(body, /colour_source: 'spoken'/);
});

test('the typed sentence never becomes an analytics property', () => {
  const src = readFileSync('src/features/ingest/use-garment-search.ts', 'utf8');
  const filing = src.slice(src.indexOf('export function useFileTypedWords'));
  const body = filing.slice(0, filing.indexOf('export function useGarmentSearchFlow'));
  const tracked = /track\([^)]*\)/s.exec(body)?.[0] ?? '';
  assert.doesNotMatch(tracked, /description/);
  assert.match(tracked, /stage: 'filed_own_words'/);
});
