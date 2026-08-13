/**
 * Workstream 7 — the tagging contract, enforced rather than requested.
 *
 * Every rule below is already in `TAG_SYSTEM_PROMPT`, at length and in capitals,
 * because each of them was got wrong in production. These tests are the same
 * rules as facts about what can reach the database.
 *
 * The brand block is the one that matters most: a vision model reading a logo it
 * cannot see writes a plausible maker's name onto somebody's garment, and brand
 * drives catalogue search, resale value and a person's own sense of what they
 * own. There is no confidence threshold at which a guess becomes evidence.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  categoryFromSubcategory,
  describeGarment,
  resolveBrand,
  validateTags,
} from '../supabase/functions/_shared/tag-validate.ts';
import type { TagResult } from '../supabase/functions/_shared/tag-schema.ts';

const BASE: TagResult = {
  category: 'top',
  subcategory: 'oxford shirt',
  colorNames: ['white'],
  pattern: 'solid',
  material: 'cotton',
  brand: null,
  formalityScore: 3,
  warmthScore: 2,
  waterResistant: false,
  fit: 'regular',
  patternScale: 'none',
  seasons: ['spring', 'summer'],
  occasions: ['office', 'casual'],
  description: 'anything at all',
};

const ok = (t: Partial<TagResult>, ctx = {}) => {
  const r = validateTags({ ...BASE, ...t }, ctx);
  assert.equal(r.ok, true, r.ok ? '' : `unexpected failures: ${r.failures.join(',')}`);
  return r as Extract<typeof r, { ok: true }>;
};

const fails = (t: Partial<TagResult>) => {
  const r = validateTags({ ...BASE, ...t });
  assert.equal(r.ok, false, 'expected a rejection');
  return (r as Extract<typeof r, { ok: false }>).failures;
};

// ---------------------------------------------------------------------------
// 1 · Category and subcategory must agree
// ---------------------------------------------------------------------------

test('a tote filed as a top is rejected, not corrected', () => {
  assert.deepEqual(fails({ category: 'top', subcategory: 'leather tote' }), [
    'category_subcategory_conflict',
  ]);
});

test('every marker word settles its category', () => {
  const cases: [string, string][] = [
    ['chelsea boot', 'footwear'],
    ['crossbody bag', 'bag'],
    ['wool beanie', 'headwear'],
    ['gold necklace', 'jewelry'],
    ['midi dress', 'dress'],
    ['wool overcoat', 'outerwear'],
    ['straight jeans', 'bottom'],
    ['oxford shirt', 'top'],
  ];
  for (const [subcategory, category] of cases) {
    assert.equal(categoryFromSubcategory(subcategory), category, subcategory);
  }
});

test('a subcategory that implies nothing does not block a valid category', () => {
  assert.equal(categoryFromSubcategory('thing'), null);
  ok({ category: 'other', subcategory: 'thing' });
});

test('a boot filed as footwear passes', () => {
  ok({ category: 'footwear', subcategory: 'chelsea boot', occasions: ['casual'] });
});

// ---------------------------------------------------------------------------
// 2 · Pattern and scale are read together
// ---------------------------------------------------------------------------

test('a solid with a print scale is a contradiction', () => {
  assert.deepEqual(fails({ pattern: 'solid', patternScale: 'large' }), [
    'pattern_scale_contradiction',
  ]);
});

test('null and "plain" count as solid too', () => {
  assert.deepEqual(fails({ pattern: null, patternScale: 'micro' }), [
    'pattern_scale_contradiction',
  ]);
  assert.deepEqual(fails({ pattern: 'plain', patternScale: 'small' }), [
    'pattern_scale_contradiction',
  ]);
});

test('a print with no scale is the same contradiction, mirrored', () => {
  assert.deepEqual(fails({ pattern: 'striped', patternScale: 'none' }), [
    'pattern_scale_contradiction',
  ]);
});

test('a print with a scale passes', () => {
  ok({ pattern: 'striped', patternScale: 'medium' });
});

// ---------------------------------------------------------------------------
// 3 · Water resistance needs evidence
// ---------------------------------------------------------------------------

test('leather is not water resistant however sturdy it looks', () => {
  assert.deepEqual(
    fails({ waterResistant: true, material: 'leather', subcategory: 'jacket', category: 'outerwear' }),
    ['water_resistance_unsupported'],
  );
});

test('wool is not water resistant', () => {
  assert.deepEqual(
    fails({ waterResistant: true, material: 'wool', subcategory: 'coat', category: 'outerwear' }),
    ['water_resistance_unsupported'],
  );
});

test('a rain shell is', () => {
  ok({
    waterResistant: true,
    material: 'nylon',
    subcategory: 'rain jacket',
    category: 'outerwear',
    occasions: ['outdoor'],
  });
});

test('a waxed jacket and rubber boots are', () => {
  ok({ waterResistant: true, material: 'waxed cotton', subcategory: 'jacket', category: 'outerwear' });
  ok({ waterResistant: true, material: 'rubber', subcategory: 'wellington boot', category: 'footwear' });
});

test('false needs no evidence at all', () => {
  ok({ waterResistant: false, material: 'wool' });
});

// ---------------------------------------------------------------------------
// 4 · Enums and ranges
// ---------------------------------------------------------------------------

test('an invented enum value is refused', () => {
  assert.ok(fails({ fit: 'skinny' as TagResult['fit'] }).includes('enum_violation'));
  assert.ok(
    fails({ patternScale: 'huge' as TagResult['patternScale'] }).includes('enum_violation'),
  );
  assert.ok(fails({ seasons: ['monsoon'] }).includes('enum_violation'));
  assert.ok(fails({ occasions: ['brunch'] }).includes('enum_violation'));
  assert.ok(fails({ category: 'shoes' as TagResult['category'] }).includes('enum_violation'));
});

test('a score outside 1..5 is refused rather than clamped here', () => {
  assert.ok(fails({ formalityScore: 7 }).includes('score_out_of_range'));
  assert.ok(fails({ warmthScore: 0 }).includes('score_out_of_range'));
  assert.ok(fails({ formalityScore: 3.5 }).includes('score_out_of_range'));
});

test('an empty subcategory is refused', () => {
  assert.ok(fails({ subcategory: '   ' }).includes('empty_subcategory'));
});

test('every failure is reported, not just the first', () => {
  const f = fails({
    category: 'top',
    subcategory: 'leather tote',
    pattern: 'solid',
    patternScale: 'large',
    formalityScore: 9,
  });
  assert.ok(f.length >= 3, `expected several failures, got ${f.join(',')}`);
  assert.ok(f.includes('category_subcategory_conflict'));
  assert.ok(f.includes('pattern_scale_contradiction'));
  assert.ok(f.includes('score_out_of_range'));
});

// ---------------------------------------------------------------------------
// 5 · Brand needs evidence — the block that matters most
// ---------------------------------------------------------------------------

test("a model's unsupported brand guess is dropped", () => {
  const r = ok({ brand: 'James Perse' });
  assert.equal(r.tags.brand, null, 'an unsupported brand reached the database');
  assert.equal(r.brandEvidence, null);
});

test('OCR is evidence', () => {
  const r = ok({ brand: 'James Perse' }, { ocrText: 'JAMES PERSE LOS ANGELES' });
  assert.equal(r.tags.brand, 'James Perse');
  assert.equal(r.brandEvidence, 'ocr');
});

test('a catalogue match is evidence', () => {
  const r = ok({ brand: 'Everlane' }, { catalogueBrands: ['Everlane', 'Uniqlo'] });
  assert.equal(r.brandEvidence, 'catalogue');
});

test('a user correction outranks everything, including a contradicting model', () => {
  const r = ok({ brand: 'James Perse' }, { userBrand: 'Uniqlo', ocrText: 'JAMES PERSE' });
  assert.equal(r.tags.brand, 'Uniqlo');
  assert.equal(r.brandEvidence, 'user');
});

test('a user brand stands with no model claim at all', () => {
  const r = ok({ brand: null }, { userBrand: 'Arket' });
  assert.equal(r.tags.brand, 'Arket');
});

test('OCR that does not contain the claim is not evidence for it', () => {
  const r = ok({ brand: 'Prada' }, { ocrText: 'MADE IN PORTUGAL 100% COTTON' });
  assert.equal(r.tags.brand, null);
});

test('resolveBrand is the whole precedence, in one place', () => {
  assert.equal(resolveBrand('A', { userBrand: 'B' }).evidence, 'user');
  assert.equal(resolveBrand('A', { ocrText: 'a label' }).evidence, 'ocr');
  assert.equal(resolveBrand('A', { catalogueBrands: ['a'] }).evidence, 'catalogue');
  assert.equal(resolveBrand('A', {}).brand, null);
  assert.equal(resolveBrand(null, {}).brand, null);
});

// ---------------------------------------------------------------------------
// 6 · The description is assembled, not requested
// ---------------------------------------------------------------------------

test('the description is built from validated fields', () => {
  const r = ok({ description: 'A COMPLETELY INVENTED SENTENCE' });
  assert.ok(!r.tags.description.includes('INVENTED'), "the model's prose survived");
  assert.match(r.tags.description, /White cotton oxford shirt/);
  assert.match(r.tags.description, /smart-casual/);
  assert.match(r.tags.description, /for office or casual/);
});

test('an absent field removes its clause rather than being filled in', () => {
  const r = ok({ material: null, colorNames: [], occasions: [] });
  assert.equal(r.tags.description, 'Oxford shirt — smart-casual.');
});

test('a print appears in the description; a solid does not', () => {
  assert.match(
    ok({ pattern: 'striped', patternScale: 'medium' }).tags.description,
    /White striped cotton oxford shirt/,
  );
  assert.ok(!ok({}).tags.description.includes('solid'));
});

test('a brand only appears once it has evidence', () => {
  assert.ok(!ok({ brand: 'Prada' }).tags.description.includes('Prada'));
  assert.match(ok({ brand: 'Prada' }, { userBrand: 'Prada' }).tags.description, /by Prada/);
});

test('the same input always describes identically', () => {
  assert.equal(describeGarment(BASE), describeGarment({ ...BASE }));
});

// ---------------------------------------------------------------------------
// 7 · The wiring: one rescue, then needs_review, and no loop
// ---------------------------------------------------------------------------

function handler(): string {
  return readFileSync('supabase/functions/tag-item/index.ts', 'utf8');
}

test('the validator gates every write', () => {
  const src = handler();
  assert.match(src, /const checked = validateTags\(normalizeTags\(result\.parsed\)/);
  assert.match(src, /if \(checked\.ok\) \{\s*tags = checked\.tags;/);
});

test('a rejection escalates at most once, and only under the rescue policy', () => {
  const src = handler();
  assert.match(
    src,
    /if \(attempt === 0 && settings\.validatorPolicy === 'rescue' && settings\.rescueModelId\)/,
  );
  // Two attempts total. A third would be the verification loop the plan forbids.
  assert.match(src, /for \(let attempt = 0; attempt < 2; attempt\+\+\)/);
});

test('an unrescued rejection becomes needs_review, not a silent write', () => {
  const src = handler();
  assert.match(src, /failure = `validator_rejected:\$\{rejection\}`/);
  assert.match(src, /status: 'needs_review'/);
});

test('the rescue model is used only on the escalated attempt', () => {
  const src = handler();
  assert.match(
    src,
    /model: rescued && settings\.rescueModelId \? settings\.rescueModelId : config\.model_id/,
  );
  // And the ledger records which model actually ran.
  assert.match(
    src,
    /model_id: rescued && settings\.rescueModelId \? settings\.rescueModelId : config\.model_id/,
  );
});

test('brand evidence routes exist in the handler even while OCR is native-only', () => {
  const src = handler();
  // Explicitly null rather than omitted: the shape is the contract the native
  // packet fills, and an omitted field would silently become "no evidence
  // route" instead of "this route is not available yet".
  assert.match(src, /ocrText: null/);
  assert.match(src, /catalogueBrands: \[\]/);
});
