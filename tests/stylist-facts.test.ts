/**
 * Workstream 6 — questions with one right answer, answered without a model.
 *
 * Thirty-plus cases in three groups, and the third is the one that keeps the
 * router honest: NEGATIVE cases. A router that fires on everything would pass
 * every positive test here and would answer "what should I wear to a wedding"
 * with a count of dresses.
 *
 * Every numeric answer is reconciled against a fixture closet defined once
 * below, so a number in an assertion can be checked by reading the fixture
 * rather than trusted.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  answerFactQuestion,
  closetRevision,
  routeFactQuestion,
  selectGarments,
  tryFactAnswer,
} from '../src/features/stylist/facts.ts';
import type { Garment } from '../src/lib/styling/types.ts';

// ---------------------------------------------------------------------------
// One fixture closet. Every number below reconciles against it.
// ---------------------------------------------------------------------------

const DAY = 86_400_000;
const NOW = 1_770_000_000_000;

function g(
  id: string,
  slot: Garment['slot'],
  subcategory: string,
  colour: string,
  family: string,
  extra: Partial<Garment> = {},
): Garment {
  return {
    id,
    slot,
    category: slot,
    subcategory,
    colors: [{ name: colour, family, hex: '#000', ratio: 1 }],
    formality: 3,
    warmth: 2,
    wearCount: 0,
    lastWornAt: null,
    purchasePrice: null,
    pattern: null,
    material: null,
    brand: null,
    seasons: [],
    occasions: [],
    ...extra,
  } as unknown as Garment;
}

/**
 * 4 tops (2 white), 2 bottoms, 1 knit, 2 shoes. No dresses, bags, hats or
 * accessories — so the gap answer has something true to say.
 */
const CLOSET: Garment[] = [
  g('t1', 'base_top', 'shirt', 'white', 'white', { wearCount: 12, lastWornAt: NOW - 2 * DAY, purchasePrice: 60 }),
  g('t2', 'base_top', 'shirt', 'white', 'white', { wearCount: 3, lastWornAt: NOW - 30 * DAY }),
  g('t3', 'base_top', 't shirt', 'black', 'black', { wearCount: 40, lastWornAt: NOW - DAY, purchasePrice: 20 }),
  g('t4', 'base_top', 'blouse', 'navy', 'blue'),
  g('b1', 'bottom', 'jeans', 'black', 'black', { wearCount: 25, lastWornAt: NOW - 3 * DAY, purchasePrice: 100 }),
  g('b2', 'bottom', 'trousers', 'grey', 'grey', { wearCount: 1 }),
  g('k1', 'mid_layer', 'cardigan', 'navy', 'blue', { wearCount: 5, formality: 3 }),
  g('s1', 'footwear', 'loafers', 'brown', 'brown', { wearCount: 8, formality: 4, lastWornAt: NOW - 5 * DAY }),
  g('s2', 'footwear', 'sneakers', 'white', 'white', { wearCount: 0, formality: 2 }),
];

const ask = (q: string) => tryFactAnswer(CLOSET, q, NOW);

// ---------------------------------------------------------------------------
// 1 · Routing (1–8)
// ---------------------------------------------------------------------------

test('1 · a count question routes to count', () => {
  assert.equal(routeFactQuestion('how many white shirts do I have')?.intent, 'count');
});

test('2 · slot and colour are both read out of the question', () => {
  const r = routeFactQuestion('how many white shirts do I have');
  assert.equal(r?.slot, 'base_top');
  assert.equal(r?.colour, 'white');
});

test('3 · the eight other intents route', () => {
  const cases: [string, string][] = [
    ['what colours do I wear most', 'colour_distribution'],
    ['what do I wear the most', 'most_worn'],
    ['what do I barely wear', 'least_worn'],
    ['what have I never worn', 'unworn'],
    ['what is my cost per wear', 'cost_per_wear'],
    ['when did I last wear my loafers', 'last_worn'],
    ['what am I missing', 'gaps'],
    ['what goes with my brown loafers', 'compatible'],
  ];
  for (const [question, intent] of cases) {
    assert.equal(routeFactQuestion(question)?.intent, intent, question);
  }
});

test('4 · paraphrases route to the same intent', () => {
  for (const q of ['how many shirts have I got', 'do I have any white shirts', 'number of shirts']) {
    assert.equal(routeFactQuestion(q)?.intent, 'count', q);
  }
  for (const q of ['what do I reach for most', 'which piece do I wear the most']) {
    assert.equal(routeFactQuestion(q)?.intent, 'most_worn', q);
  }
  for (const q of ['what have I not worn', 'anything unworn', "what haven't I worn"]) {
    assert.equal(routeFactQuestion(q)?.intent, 'unworn', q);
  }
});

test('5 · "how much" is cost-per-wear when it says so, count otherwise', () => {
  assert.equal(routeFactQuestion('what is the cost per wear on my jeans')?.intent, 'cost_per_wear');
  assert.equal(routeFactQuestion('how much of my closet is black')?.intent, 'count');
});

test('6 · every slot word maps', () => {
  const pairs: [string, Garment['slot']][] = [
    ['how many tops', 'base_top'],
    ['how many jumpers', 'mid_layer'],
    ['how many jeans', 'bottom'],
    ['how many dresses', 'dress'],
    ['how many coats', 'outerwear'],
    ['how many shoes', 'footwear'],
    ['how many bags', 'bag'],
    ['how many hats', 'headwear'],
    ['how many scarves', 'accessory'],
  ];
  for (const [q, slot] of pairs) assert.equal(routeFactQuestion(q)?.slot, slot, q);
});

test('7 · an empty question routes to nothing', () => {
  assert.equal(routeFactQuestion('   '), null);
});

test('8 · gray and grey are the same question', () => {
  assert.equal(routeFactQuestion('how many gray trousers')?.colour, 'gray');
  assert.equal(selectGarments(CLOSET, { intent: 'count', colour: 'gray', slot: 'bottom' }).length, 1);
});

// ---------------------------------------------------------------------------
// 2 · Answers reconciled against the fixture (9–24)
// ---------------------------------------------------------------------------

test('9 · counts are counted, not estimated', () => {
  assert.match(ask('how many white shirts do I have')!.text, /\b2\b/);
  assert.match(ask('how many tops do I have')!.text, /\b4\b/);
  assert.match(ask('how many shoes do I have')!.text, /\b2\b/);
});

test('10 · a count of nothing says so plainly', () => {
  const a = ask('how many dresses do I have')!;
  assert.match(a.text, /don't have any/);
  assert.deepEqual(a.itemIds, []);
});

test('10b · a count of one is written in English', () => {
  // The singular used to be derived by stripping a trailing `s`, which produced
  // "You have 1 dresse." and "1 coats and jacket". The arithmetic was right
  // every time, which is exactly why nothing caught it: the eval scores the
  // number, and a person reads the sentence.
  assert.equal(ask('how many knits do I have')!.text, 'You have 1 knit or sweatshirt.');
  assert.equal(ask('how many navy tops do I have')!.text, 'You have 1 navy top.');
  // And the plural is untouched.
  assert.equal(ask('how many tops do I have')!.text, 'You have 4 tops.');
  // The empty answer keeps the plural — "any dress filed" would be wrong too.
  assert.match(ask('how many dresses do I have')!.text, /any dresses filed/);
});

test('11 · the count carries the ids behind it', () => {
  assert.deepEqual(ask('how many white shirts do I have')!.itemIds.sort(), ['t1', 't2']);
});

test('12 · colour distribution sums to the closet', () => {
  const a = ask('what colours do I wear most')!;
  // 3 white, 2 black, 2 blue, 1 grey, 1 brown = 9
  assert.match(a.text, /white 3/);
  assert.match(a.text, /9 pieces in all/);
});

test('13 · most worn is ordered by real wear counts', () => {
  const a = ask('what do I wear the most')!;
  assert.ok(a.text.startsWith('black t shirt (40 wears)'), a.text);
  assert.equal(a.itemIds[0], 't3');
});

test('14 · least worn is the other end of the same list', () => {
  const a = ask('what do I barely wear')!;
  assert.ok(a.text.startsWith('grey trousers (1 wear)'), a.text);
});

test('15 · a single wear is singular', () => {
  assert.match(ask('what do I barely wear')!.text, /\(1 wear\)/);
});

test('16 · unworn names the pieces', () => {
  const a = ask('what have I never worn')!;
  assert.match(a.text, /white sneakers/);
  assert.match(a.text, /navy blouse/);
  assert.equal(a.itemIds.length, 2);
});

test('17 · cost per wear uses only priced, worn pieces', () => {
  // t1 60/12, t3 20/40, b1 100/25 → 180 spend, 77 wears
  const a = ask('what is my cost per wear')!;
  assert.match(a.text, /\$2\.34 per wear/);
  assert.match(a.text, /3 priced pieces/);
});

test('18 · cost per wear names the best piece by real arithmetic', () => {
  // 20/40 = 0.50, the lowest.
  assert.match(ask('what is my cost per wear')!.text, /black t shirt at \$0\.50/);
});

test('19 · cost per wear refuses rather than averaging over unpriced pieces', () => {
  const a = tryFactAnswer(
    [g('x', 'base_top', 'shirt', 'white', 'white', { wearCount: 4 })],
    'what is my cost per wear',
    NOW,
  )!;
  assert.match(a.text, /needs a price and at least one wear/);
  assert.deepEqual(a.itemIds, []);
});

test('20 · last worn gives an absolute date and a real gap', () => {
  const a = ask('when did I last wear my shoes')!;
  assert.match(a.text, /brown loafers/);
  assert.ok(!/ago\b.*\bago\b/.test(a.text));
});

test('21 · last worn dates are absolute, so a saved thread does not go stale', () => {
  const a = tryFactAnswer(CLOSET, 'when did I last wear my t shirt', NOW)!;
  assert.match(a.text, /\d{1,2} \w+ \d{4}/);
});

test('22 · gaps are empty slots, counted, not taste', () => {
  const a = ask('what am I missing')!;
  for (const missing of ['dresses', 'coats and jackets', 'bags', 'hats', 'accessories']) {
    assert.match(a.text, new RegExp(missing));
  }
  assert.ok(!/should|could|consider|statement/i.test(a.text), 'the gap answer gave advice');
});

test('23 · compatibility is a formality band, never an outfit', () => {
  const a = ask('what goes with my brown loafers')!;
  assert.match(a.text, /sit at the same level/);
  assert.ok(!a.itemIds.includes('s1'), 'the anchor was returned as its own match');
  assert.ok(!a.itemIds.some((id) => id === 's2'), 'a second shoe was offered as a match');
});

test('24 · an unanswerable lookup returns null rather than guessing', () => {
  assert.equal(tryFactAnswer([], 'what goes with my brown loafers', NOW), null);
});

// ---------------------------------------------------------------------------
// 3 · Negative cases — the router must refuse (25–33)
// ---------------------------------------------------------------------------

test('25 · open-ended advice is not a lookup', () => {
  for (const q of [
    'what should I wear to my sisters wedding',
    'help me look less boring',
    'is navy and black ok together',
    'what would you style with this',
    'I have a date tonight',
    'does this suit me',
  ]) {
    assert.equal(routeFactQuestion(q), null, `"${q}" was force-fitted to a template`);
  }
});

test('26 · a question about the future is not a count', () => {
  assert.equal(routeFactQuestion('what should I buy next season'), null);
});

test('27 · "what do I need for Rome" is a gap question and answers from slots only', () => {
  // It DOES route — "need" is in the gap vocabulary — and that is acceptable
  // precisely because the answer is a list of empty slots rather than advice
  // about Rome. The assertion is that it cannot invent a destination claim.
  const a = ask('what do I need for Rome')!;
  assert.ok(!/Rome|Italy|weather/i.test(a.text));
});

test('28 · a greeting is not a question', () => {
  assert.equal(routeFactQuestion('hi'), null);
  assert.equal(routeFactQuestion('thanks!'), null);
});

test('29 · the chat asks the closet before it asks the model', () => {
  const src = readFileSync('src/features/stylist/use-chat.ts', 'utf8');
  const fact = src.indexOf('tryFactAnswer(wardrobe, question');
  const invoke = src.indexOf("supabase.functions.invoke('stylist-chat'");
  assert.ok(fact > 0, 'the router is not wired into the chat');
  assert.ok(fact < invoke, 'a factual question still reaches the model first');
});

test('30 · a factual answer returns no outfits', () => {
  const src = readFileSync('src/features/stylist/use-chat.ts', 'utf8');
  const block = src.slice(src.indexOf('const fact = tryFactAnswer'), src.indexOf('// Generate against'));
  assert.match(block, /outfits: \[\]/);
});

test('31 · no tool asks a model to do arithmetic', () => {
  const src = readFileSync('src/features/stylist/facts.ts', 'utf8');
  assert.ok(!/functions\.invoke|supabase|openrouter/i.test(src), 'facts.ts reaches a server');
});

test('32 · the closet revision changes when the closet does', () => {
  const base = closetRevision(CLOSET);
  assert.equal(closetRevision(CLOSET), base, 'the revision is not stable');
  assert.notEqual(closetRevision(CLOSET.slice(1)), base, 'a removed piece did not change it');
  const worn = CLOSET.map((x, i) => (i === 0 ? { ...x, wearCount: x.wearCount + 1 } : x));
  assert.notEqual(closetRevision(worn), base, 'a new wear did not change it');
});

test('33 · every routed intent has an answer branch', () => {
  const intents = [
    'how many shirts', 'what colours do I wear most', 'what do I wear the most',
    'what do I barely wear', 'what have I never worn', 'what is my cost per wear',
    'when did I last wear my shoes', 'what am I missing', 'what goes with my brown loafers',
  ];
  for (const q of intents) {
    const routed = routeFactQuestion(q)!;
    assert.ok(routed, q);
    // Null is allowed (unanswerable), undefined is a missing branch.
    assert.notEqual(answerFactQuestion(CLOSET, routed, NOW), undefined, q);
  }
});
