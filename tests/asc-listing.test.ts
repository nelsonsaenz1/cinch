import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { KEYWORDS, KEYWORD_LIMIT } from '../scripts/asc-listing.mjs';

/**
 * The next build's keyword fields (founder order 2026-09-07): one string per
 * storefront localisation, each within Apple's 100 characters, no whitespace,
 * no repeats of a word the name or subtitle already carries, no term repeated
 * across the two fields the US storefront reads (en-US + es-MX) — repetition
 * does not stack. The doc is the source; the script must match it.
 */
const DOC = readFileSync('docs/app-store-listing.md', 'utf8');
const NAME = 'Cinch: Outfit Planner & Closet';
const SUBTITLE = 'Capsule Wardrobe, Packing List';
const identity = new Set(`${NAME} ${SUBTITLE}`.toLowerCase().match(/[a-z]+/g));
const STOP = new Set(['to', 'and', 'the', 'a', 'an', 'of', 'for', 'with', 'in', 'on']);

test('every field fits, has no whitespace, no stop words, and no word from the name or subtitle', () => {
  for (const [locale, kw] of Object.entries(KEYWORDS)) {
    assert.ok(kw.length <= KEYWORD_LIMIT, `${locale} is ${kw.length} chars`);
    assert.doesNotMatch(kw, /\s/, locale);
    const terms = kw.split(',');
    assert.equal(new Set(terms).size, terms.length, `${locale} repeats a term`);
    for (const t of terms) {
      assert.ok(!STOP.has(t), `${locale} spends characters on the stop word "${t}"`);
      // The GB/AU/CA fields deliberately carry "wardrobe": their storefronts do not
      // all read the subtitle at the same weight, and the doc says to drop it if
      // the subtitle changes. Every other field is strict.
      if (!(locale !== 'en-US' && locale !== 'es-MX' && t === 'wardrobe')) {
        assert.ok(!identity.has(t), `${locale} repeats "${t}" from the name or subtitle`);
      }
    }
  }
});

test('the two fields the US storefront reads share no term', () => {
  const us = new Set(KEYWORDS['en-US'].split(','));
  for (const t of KEYWORDS['es-MX'].split(',')) assert.ok(!us.has(t), `es-MX repeats "${t}" from en-US`);
});

test('the script’s strings are the doc’s strings', () => {
  for (const [locale, kw] of Object.entries(KEYWORDS)) {
    assert.ok(DOC.includes(kw), `${locale} field in the script is not in docs/app-store-listing.md`);
  }
  // The live field is still the live field until the Search Ads scores exist.
  assert.equal(
    KEYWORDS['en-US'],
    'digital,stylist,organizer,clothes,what,wear,ootd,style,calendar,inventory,clothing,ai,travel,weather',
  );
});

test('apply is guarded to editable versions and never runs on import', () => {
  const src = readFileSync('scripts/asc-listing.mjs', 'utf8');
  assert.match(src, /if \(!EDITABLE\.has\(version\.state\)\) throw new Error/);
  assert.match(src, /const isMain = \/asc-listing\\\.mjs\$\/\.test\(process\.argv\[1\] \?\? ''\);/);
  assert.match(src, /if \(isMain\) \{/);
  // Every new localisation is created whole: description, keywords, promo, What's New.
  assert.match(src, /description: primaryFull\.description,\s*keywords: s\.keywords,\s*promotionalText: primaryFull\.promotionalText/);
});
