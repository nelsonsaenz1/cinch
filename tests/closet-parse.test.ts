/**
 * Workstream 5 — the deterministic closet parser, fifty-odd cases.
 *
 * The plan's headline acceptances are two negatives and one absolute:
 * a clear list reaches no model, an ambiguous phrase reaches it exactly once,
 * and every garment returned maps to a verbatim span or is visibly refused.
 * All three are checked here as properties rather than as vibes.
 *
 * The adversarial block at the end is the one that matters most. It feeds the
 * span validator quotations that were never said — the failure mode a model can
 * produce and a lexicon cannot — and asserts they are dropped rather than
 * merely marked unsure.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  findColour,
  findMaterial,
  findNoun,
  findPattern,
  findQuantity,
  needsFallback,
  parseCloset,
  provenSpans,
  splitClauses,
} from '../supabase/functions/_shared/closet-parse.ts';
import type { ParsedGarment } from '../supabase/functions/_shared/intake-schema.ts';

/** Every garment's receipt line must be a real slice of what was said. */
function assertReceipts(transcript: string, garments: readonly ParsedGarment[]) {
  for (const g of garments) {
    assert.ok(
      transcript.includes(g.utterance),
      `receipt line "${g.utterance}" is not in the transcript`,
    );
  }
}

function parse(transcript: string) {
  const result = parseCloset(transcript);
  assertReceipts(transcript, result.garments);
  return result;
}

// ---------------------------------------------------------------------------
// 1 · Clause splitting (1–6)
// ---------------------------------------------------------------------------

test('1 · punctuation splits clauses and offsets stay true', () => {
  const t = 'a black tee, navy jeans, brown loafers';
  const spans = splitClauses(t);
  assert.equal(spans.length, 3);
  for (const s of spans) assert.equal(t.slice(s.start, s.end), s.text);
});

test('2 · "and" splits, "with" does not', () => {
  assert.equal(splitClauses('a navy blazer and grey trousers').length, 2);
  assert.equal(splitClauses('a navy blazer with gold buttons').length, 1);
});

test('3 · trailing punctuation is trimmed off the span', () => {
  const spans = splitClauses('a white shirt.');
  assert.equal(spans[0]!.text, 'a white shirt');
});

test('4 · empty and whitespace transcripts produce nothing', () => {
  assert.deepEqual(splitClauses('   '), []);
  assert.deepEqual(parse('').garments, []);
});

test('5 · "and then" splits once, not twice', () => {
  assert.equal(splitClauses('a coat and then a scarf').length, 2);
});

test('6 · repeated separators do not create empty clauses', () => {
  assert.equal(splitClauses('a hat,, a belt').length, 2);
});

// ---------------------------------------------------------------------------
// 2 · Field extraction (7–20)
// ---------------------------------------------------------------------------

test('7 · a multiword colour beats the word inside it', () => {
  assert.equal(findColour('a light blue shirt'), 'light blue');
  assert.equal(findColour('a navy blue coat'), 'navy blue');
  assert.equal(findColour('an off white tee'), 'off white');
});

test('8 · a plain colour resolves', () => {
  assert.equal(findColour('black jeans'), 'black');
  assert.equal(findColour('an olive jacket'), 'olive');
});

test('9 · an unknown colour is null, never the nearest', () => {
  assert.equal(findColour('a greige jumper'), null);
  assert.equal(findColour('a linen shirt'), null);
});

test('10 · colour words inside other words do not match', () => {
  assert.equal(findColour('a blackberry stain'), null);
});

test('11 · nouns map to slots', () => {
  assert.equal(findNoun('a white tee')?.slot, 'base_top');
  assert.equal(findNoun('black jeans')?.slot, 'bottom');
  assert.equal(findNoun('a wool coat')?.slot, 'outerwear');
  assert.equal(findNoun('brown loafers')?.slot, 'footwear');
  assert.equal(findNoun('a silk dress')?.slot, 'dress');
  assert.equal(findNoun('a leather tote')?.slot, 'bag');
  assert.equal(findNoun('a wool beanie')?.slot, 'headwear');
  assert.equal(findNoun('a silk scarf')?.slot, 'accessory');
});

test('12 · a layer worn over another top is a mid layer, not a base', () => {
  assert.equal(findNoun('a navy cardigan')?.slot, 'mid_layer');
  assert.equal(findNoun('a grey sweater')?.slot, 'mid_layer');
  assert.equal(findNoun('a black hoodie')?.slot, 'mid_layer');
  // And a t-shirt is still a base layer.
  assert.equal(findNoun('a white t shirt')?.slot, 'base_top');
});

test('13 · jewellery lands in accessory, the only slot the engine has for it', () => {
  assert.equal(findNoun('a gold necklace')?.slot, 'accessory');
});

test('14 · the longest noun wins', () => {
  assert.equal(findNoun('a white t shirt')?.noun, 't shirt');
});

test('15 · materials resolve from the shared lexicon', () => {
  assert.equal(findMaterial('a wool coat'), 'wool');
  assert.equal(findMaterial('a cashmere jumper'), 'cashmere');
  assert.equal(findMaterial('a plain shirt'), null);
});

test('16 · patterns normalise to the tagger vocabulary', () => {
  assert.equal(findPattern('a striped tee'), 'striped');
  assert.equal(findPattern('a checked shirt'), 'checked');
  assert.equal(findPattern('a camouflage jacket'), 'camo');
  assert.equal(findPattern('a plain tee'), null);
});

test('17 · digits become quantities', () => {
  assert.equal(findQuantity('3 white tees'), 3);
  assert.equal(findQuantity('12 shirts'), 12);
});

test('18 · number words become quantities', () => {
  assert.equal(findQuantity('three white tees'), 3);
  assert.equal(findQuantity('a couple of shirts'), 2);
});

test('19 · "a pair of jeans" is one garment', () => {
  assert.equal(findQuantity('a pair of jeans'), 1);
});

test('20 · quantity defaults to one and is capped', () => {
  assert.equal(findQuantity('a shirt'), 1);
  assert.equal(findQuantity('99 shirts'), 1); // out of range, so not read as a count
});

// ---------------------------------------------------------------------------
// 3 · Whole parses: the clear cases that must not reach a model (21–34)
// ---------------------------------------------------------------------------

test('21 · a simple list parses with no fallback', () => {
  const t = 'three white t shirts, a navy wool cardigan, black jeans';
  const r = parse(t);
  assert.equal(needsFallback(r), false, 'a plain list reached the model');
  assert.equal(r.garments.length, 3);
  assert.deepEqual(r.garments.map((g) => g.slot), ['base_top', 'mid_layer', 'bottom']);
  assert.equal(r.garments[0]!.quantity, 3);
  assert.equal(r.garments[1]!.colour_term, 'navy');
  assert.equal(r.garments[1]!.fabric, 'wool');
});

test('22 · singular and plural both parse', () => {
  assert.equal(parse('a white shirt').garments.length, 1);
  assert.equal(parse('white shirts').garments.length, 1);
});

test('23 · a multiword colour survives the whole parse', () => {
  const r = parse('a light blue oxford shirt');
  assert.equal(r.garments[0]!.colour_term, 'light blue');
});

test('24 · an unnamed colour stays null rather than becoming grey', () => {
  const r = parse('my linen shirt');
  assert.equal(r.garments.length, 1);
  assert.equal(r.garments[0]!.colour_term, null, 'a colour was invented');
  assert.equal(r.garments[0]!.fabric, 'linen');
  // And the card knows to hedge.
  assert.ok(r.garments[0]!.confidence < 1);
});

test('25 · confidence is 1 only when everything resolved', () => {
  assert.equal(parse('a navy wool coat').garments[0]!.confidence, 1);
});

test('26 · a material without a colour still files', () => {
  const r = parse('a cashmere jumper');
  assert.equal(r.garments[0]!.slot, 'mid_layer');
  assert.equal(r.garments[0]!.fabric, 'cashmere');
});

test('27 · a pattern is carried', () => {
  assert.equal(parse('a striped navy tee').garments[0]!.pattern, 'striped');
});

test('28 · a long list parses entirely', () => {
  const t =
    'two black t shirts, a white blouse, navy trousers, a grey cardigan, ' +
    'brown boots, a leather belt, a wool coat, a silk scarf';
  const r = parse(t);
  assert.equal(needsFallback(r), false);
  assert.equal(r.garments.length, 8);
});

test('29 · repeated garments are kept as separate cards', () => {
  const r = parse('a black tee, a white tee');
  assert.equal(r.garments.length, 2);
});

test('30 · a self-correction replaces the garment before it', () => {
  const t = 'a black cardigan, no sorry a navy cardigan';
  const r = parse(t);
  assert.equal(r.garments.length, 1, 'the correction added a card instead of replacing one');
  assert.equal(r.garments[0]!.colour_term, 'navy');
  // The receipt line keeps the hesitation — it is what they said.
  assert.ok(r.garments[0]!.utterance.includes('navy cardigan'));
});

test('31 · "actually" and "I meant" correct too', () => {
  assert.equal(parse('a red skirt, actually a green skirt').garments.length, 1);
  assert.equal(parse('brown boots, i meant black boots').garments[0]!.colour_term, 'black');
});

test('32 · a correction with nothing before it is just a garment', () => {
  const r = parse('actually a white shirt');
  assert.equal(r.garments.length, 1);
});

test('33 · quantities and colours combine across a list', () => {
  const r = parse('four navy socks and two white shirts');
  assert.equal(r.garments.length, 1, 'socks are not in the lexicon, so only shirts file');
  assert.equal(r.garments[0]!.quantity, 2);
});

test('34 · trailing filler is dropped, not filed', () => {
  const r = parse('a white shirt, um');
  assert.equal(r.garments.length, 1);
  assert.equal(r.unconsumed.length, 0);
});

// ---------------------------------------------------------------------------
// 4 · The cases that must reach the model, exactly once (35–42)
// ---------------------------------------------------------------------------

test('35 · a relative phrase with no noun is ambiguous', () => {
  const r = parse('a navy jumper, the same in black');
  assert.equal(needsFallback(r), true);
  assert.equal(r.ambiguous.length, 1);
  assert.equal(r.garments.length, 1, 'the resolvable half still parsed locally');
});

test('36 · "another one of those" is ambiguous even with a noun', () => {
  const r = parse('a white shirt and another one of those shirts');
  assert.equal(needsFallback(r), true);
  assert.equal(r.ambiguous.length, 1);
});

test('37 · "matching" points at something already said', () => {
  assert.equal(needsFallback(parse('a navy blazer, matching trousers')), true);
});

test('38 · only the ambiguous spans are collected, never the whole transcript', () => {
  const t = 'a black tee, navy jeans, the same in white';
  const r = parse(t);
  assert.equal(r.ambiguous.length, 1);
  assert.ok(!r.ambiguous[0]!.includes('black tee'));
  assert.ok(!r.ambiguous[0]!.includes('navy jeans'));
});

test('39 · an unknown noun with a colour is ambiguous, not silently dropped', () => {
  const r = parse('a burgundy gilet, a navy peacoat');
  // "gilet" is in the lexicon; "peacoat" is not, and it carries a colour.
  assert.ok(r.ambiguous.length >= 1 || r.garments.length === 2);
});

test('40 · an unknown noun with nothing else is unconsumed, not sent', () => {
  const r = parse('a white shirt, the thing from last year');
  assert.equal(r.garments.length, 1);
  assert.equal(needsFallback(r), false, 'filler bought a model call');
  assert.equal(r.unconsumed.length, 1);
});

test('41 · unconsumed spans never trigger a fallback on their own', () => {
  const r = parse('a black tee, so anyway where was i');
  assert.equal(needsFallback(r), false);
  assert.ok(r.unconsumed.length >= 1);
});

test('42 · unfinished speech is neither a garment nor an error', () => {
  const r = parse('a black tee and then');
  assert.equal(r.garments.length, 1);
  assert.equal(needsFallback(r), false);
});

// ---------------------------------------------------------------------------
// 5 · Adversarial: the span validator (43–48)
// ---------------------------------------------------------------------------

const FABRICATED: ParsedGarment[] = [
  {
    utterance: 'a scarlet opera coat',
    name: 'coat',
    slot: 'outerwear',
    colour_term: 'red',
    fabric: null,
    pattern: null,
    formality: null,
    warmth: null,
    quantity: 1,
    confidence: 0.9,
  },
];

test('43 · a quotation that was never said is dropped entirely', () => {
  assert.deepEqual(provenSpans(FABRICATED, 'a black tee and navy jeans'), []);
});

test('44 · a real quotation survives', () => {
  const t = 'a scarlet opera coat';
  assert.equal(provenSpans(FABRICATED, t).length, 1);
});

test('45 · an empty receipt line is dropped', () => {
  assert.deepEqual(provenSpans([{ ...FABRICATED[0]!, utterance: '' }], 'anything'), []);
});

test('46 · a paraphrase is not a quotation', () => {
  assert.deepEqual(
    provenSpans([{ ...FABRICATED[0]!, utterance: 'the red coat' }], 'a scarlet opera coat'),
    [],
  );
});

test('47 · every deterministic span passes the validator by construction', () => {
  const t = 'three white t shirts, a navy wool cardigan, black jeans, brown loafers';
  const r = parse(t);
  assert.equal(provenSpans(r.garments, t).length, r.garments.length);
});

test('48 · the parser reads no clock and no random number', () => {
  const src = readFileSync('supabase/functions/_shared/closet-parse.ts', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/Date\.now|Math\.random|new Date\(/.test(src));
});

// ---------------------------------------------------------------------------
// 6 · The wiring: no call for a clear parse (49–52)
// ---------------------------------------------------------------------------

function handlerSource(): string {
  return readFileSync('supabase/functions/parse-closet/index.ts', 'utf8');
}

test('49 · a deterministic parse returns before the quota claim and the model', () => {
  const src = handlerSource();
  const deterministic = src.indexOf('if (!needsFallback(local))');
  const quota = src.indexOf("enforceAiQuota(admin, userId, 'tagging')");
  const model = src.indexOf('completeStructured<ParsedCloset>');
  assert.ok(deterministic > 0, 'the deterministic pass is not wired in');
  assert.ok(deterministic < quota, 'a clear parse claims AI quota');
  assert.ok(deterministic < model, 'a clear parse still calls the model');
  assert.match(src.slice(deterministic, quota), /return await commitParse\(/);
});

test('50 · the fallback is asked about phrases, not about the wardrobe', () => {
  const src = handlerSource();
  assert.match(src, /content: fallbackPrompt\(local, transcript\)/);
  const prompt = src.slice(src.indexOf('function fallbackPrompt'));
  assert.match(prompt, /local\.ambiguous\.map/);
  // Relational context only: names, never colours, ids or quantities.
  assert.match(prompt, /local\.garments\.map\(\(g\) => g\.name\)/);
  assert.ok(!/colour_term|purchasePrice|\.id\b/.test(prompt.slice(0, 900)));
});

test('51 · the fallback result goes through the same validator and the span proof', () => {
  const src = handlerSource();
  const after = src.slice(src.indexOf('const fallback = normalizeGarments'));
  assert.match(after, /provenSpans\(fallback\.garments, transcript\)/);
  assert.match(after, /const parsed = normalizeGarments\(merged, transcript\)/);
});

test('52 · both paths commit through one function', () => {
  const src = handlerSource();
  assert.equal((src.match(/commitParse\(/g) ?? []).length, 3, 'the commit path forked');
  assert.match(src, /async function commitParse\(/);
});

test('53 · an unrecognised colour is never resolved to a default', () => {
  const schema = readFileSync('supabase/functions/_shared/intake-schema.ts', 'utf8');
  const normalise = schema.slice(schema.indexOf('export function normalizeGarments'));
  assert.ok(!/: 'grey'/.test(normalise), "an unheard colour is still filed as grey");
  assert.match(normalise, /colour_term: \(COLOUR_TERMS as readonly string\[\]\)/);
});
