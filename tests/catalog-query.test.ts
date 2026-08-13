/**
 * The parse, and the one property it exists to guarantee.
 *
 * WHY THIS TEST IS THE IMPORTANT ONE
 *
 * The accepted design has typed and spoken input converge on a single screen:
 * "typed + spoken converge here" (CPV2-04), reached by "the identical search
 * call as typed". That sentence is only true if the two produce the same query,
 * and there is no way to see that on a simulator — a person types one thing,
 * speaks another, and gets two plausible-looking answers with no way to tell
 * they were different questions.
 *
 * So the equivalence is asserted here, on the launch fixture and on the several
 * things a speech recogniser plausibly returns for it. It is asserted on the
 * SEMANTIC TRIPLE rather than on the string, because a transcript carries
 * different punctuation, different contractions and often a different word for
 * the same garment — demanding string equality would be testing the recogniser
 * rather than the parser, and would fail on correct input.
 *
 * THE SECOND JOB is drift. `garment-lexicon.ts` duplicates garment nouns that
 * `gap-shop-match/relevance.ts` also holds, which is the house pattern
 * (`intake-schema.ts` duplicates the colour lexicon the same way) — but a
 * duplicate is only safe while something fails when the two disagree.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  ladderFor,
  ladderPlan,
  MAX_LADDER_RUNGS,
  parseQuery,
  prepareText,
  semanticTriple,
} from '../supabase/functions/_shared/catalog-query.ts';
import {
  CLASS_NOUNS,
  GENDER_SET,
  NOUN_TO_CLASS,
} from '../supabase/functions/_shared/garment-lexicon.ts';
import { COLOUR_TERMS } from '../supabase/functions/_shared/intake-schema.ts';
import { __testables } from '../supabase/functions/gap-shop-match/relevance.ts';

// ---------------------------------------------------------------------------
// The launch fixture
// ---------------------------------------------------------------------------

const TYPED = "James Perse men's T-shirt";

/**
 * What a speech recogniser plausibly returns for the same sentence.
 *
 * Every one of these is a real transcription behaviour rather than a variation
 * invented to pass: Whisper-class models drop the possessive apostrophe, spell
 * "T-shirt" three different ways, punctuate a finished utterance, occasionally
 * capitalise mid-sentence, and reach for the shorter garment noun a speaker
 * actually said.
 *
 * NOT INCLUDED, on purpose: a transcript that misheard the BRAND ("James
 * Purse"). That is a recognition error, not a parse difference, and no amount
 * of normalisation can or should recover it — the honest behaviour is a search
 * for a brand that has no rows, which CPV2-09 already draws.
 */
const SPOKEN_VARIANTS = [
  'james perse mens t shirt',
  'James Perse mens T-Shirt',
  'James Perse men’s tshirt',
  "James Perse men's tee.",
  'james perse men t shirt',
];

test('typed and every plausible transcript ask the same question', () => {
  const typed = parseQuery(TYPED);
  assert.equal(semanticTriple(typed), 'james perse|top|-');

  for (const spoken of SPOKEN_VARIANTS) {
    assert.equal(
      semanticTriple(parseQuery(spoken)),
      semanticTriple(typed),
      `transcript parsed differently from the typed query: ${spoken}`,
    );
  }
});

test('the brand leaves the free text and becomes a column constraint', () => {
  const parsed = parseQuery(TYPED);
  assert.equal(parsed.brand, 'james perse');
  // The measurement in catalog.ts: the same words in `name LIKE` returned a
  // Zadig & Voltaire dress for "Reformation". The brand must not be a term.
  assert.ok(!parsed.strong.includes('james'), 'the brand is still in the search terms');
  assert.ok(!parsed.strong.includes('perse'), 'the brand is still in the search terms');
});

test("the possessive does not leave an orphaned 's' in the search terms", () => {
  // "men's" -> "men s" under normaliseQuery, and that stray token is ANDed
  // against every product title by `name LIKE`. It is also a size token.
  const parsed = parseQuery(TYPED);
  assert.ok(!parsed.strong.includes('s'), "an orphaned 's' reached the search terms");
  assert.ok(!parsed.weak.includes('s'));
  assert.equal(prepareText("men's"), 'men');
});

test('the gender word is bucketed apart so the ladder can drop it', () => {
  const parsed = parseQuery(TYPED);
  assert.deepEqual(parsed.gender, ['men']);

  const rungs = ladderFor(parsed);
  // Rung one keeps the word the person said; rung two is the measured fix —
  // "James Perse mens white button down" returns NOTHING and the same phrase
  // without "mens" returns five real James Perse shirts.
  assert.ok(rungs[0].value.includes('men'), 'the first rung dropped a word the user said');
  assert.ok(!rungs[1].value.includes('men'), 'the second rung still carries the gender word');
  assert.ok(rungs.length <= MAX_LADDER_RUNGS);
});

test('the ladder never exceeds three metered requests', () => {
  // The ceiling is a bill, not a preference: the Starter plan meters requests
  // with a hard cutoff and no overage.
  for (const q of [
    TYPED,
    'my favourite old vintage heavy grey wool winter overcoat from paris',
    'shirt',
    '',
    'reformation midi dress',
  ]) {
    assert.ok(
      ladderFor(parseQuery(q)).length <= MAX_LADDER_RUNGS,
      `ladder too long for: ${q}`,
    );
  }
});

test('a guessed brand is dropped exactly once, on the last rung', () => {
  // The failure this recovers from: the heuristic reads an unrecognised leading
  // word as a maker, `brand =` matches nothing, and EVERY rung comes back empty
  // — so the user is told the licensed catalogue has no such garment while it
  // sits in it. One brandless rung at the end is the bounded recovery.
  const plan = ladderPlan(parseQuery(TYPED));

  assert.equal(plan.brandSource, 'leading-run');
  assert.equal(plan.brandRelaxedAt, plan.rungs.length - 1, 'the relaxed rung is not last');
  assert.equal(plan.rungs.filter((r) => r.brandRelaxed).length, 1, 'more than one rung was relaxed');
  assert.equal(plan.rungs[plan.brandRelaxedAt!].brand, null);
  assert.equal(plan.rungs[plan.brandRelaxedAt!].why, 'brand-relaxed');

  // The rungs before it still carry the brand — relaxing is the LAST answer,
  // not the first.
  for (const rung of plan.rungs.slice(0, plan.brandRelaxedAt!)) {
    assert.equal(rung.brand, undefined, 'an earlier rung stopped using the query brand');
    assert.equal(rung.brandRelaxed, false);
  }

  // And it is still three requests. A recovery that widened the cap would make
  // the cap meaningless.
  assert.ok(plan.rungs.length <= MAX_LADDER_RUNGS);
});

test('a brand the caller actually knows is NEVER relaxed', () => {
  // A user who named the brand, or a real lexicon that matched it, asked a
  // specific question. Widening it silently would answer a different one and
  // present the answer as theirs.
  const plan = ladderPlan(parseQuery("James Perse men's T-shirt", ['James Perse']));
  assert.equal(plan.brandSource, 'known');
  assert.equal(plan.brandRelaxedAt, null, 'a known brand was silently dropped');
  assert.ok(plan.rungs.every((r) => !r.brandRelaxed));
  assert.ok(plan.rungs.length <= MAX_LADDER_RUNGS);
});

test('a query with no brand at all has nothing to relax', () => {
  const plan = ladderPlan(parseQuery('cream mohair sweater'));
  assert.equal(plan.brandSource, null);
  assert.equal(plan.brandRelaxedAt, null);
});

test('the relaxed rung is a different question, not a duplicate string', () => {
  // Rung two and the relaxed rung carry the same WORDS by construction. They
  // are different questions, and deduplicating on the string alone would
  // silently delete the recovery — which would look exactly like it working.
  const plan = ladderPlan(parseQuery(TYPED));
  const values = plan.rungs.map((r) => r.value);
  assert.equal(values[1], values[2], 'the fixture no longer exercises the collision');
  assert.notEqual(plan.rungs[1].brand, plan.rungs[2].brand);
});

test('a one-word query is never relaxed into a uselessly general one', () => {
  // "shirt" on its own is not a looser version of a question, it is a different
  // and worse one. The ladder must not manufacture rungs below two terms.
  const rungs = ladderFor(parseQuery('shirt'));
  assert.deepEqual(rungs, [{ value: 'shirt' }]);
});

// ---------------------------------------------------------------------------
// The brand heuristic, and where it is honestly wrong
// ---------------------------------------------------------------------------

test('a description that opens on a colour has no brand', () => {
  for (const q of ['cream mohair sweater', 'white linen blouse', 'brown leather boots']) {
    const parsed = parseQuery(q);
    assert.equal(parsed.brand, null, `invented a brand for: ${q}`);
  }
});

test('a maker before the description is read as a maker', () => {
  const parsed = parseQuery('reformation midi dress');
  assert.equal(parsed.brand, 'reformation');
  assert.equal(parsed.brandSource, 'leading-run');
  assert.equal(parsed.productClass, 'dress');
});

test('a one-word maker is still a maker', () => {
  // Most brands are one word — Reformation, Everlane, Nike, Zara — so a
  // two-token floor would send nearly all of them into the free-text match,
  // which is the failure `catalog.ts` measured.
  assert.equal(parseQuery('everlane crew neck tee').brand, 'everlane');
});

test('an unknown leading word IS read as a brand, and that is the known cost', () => {
  // Stated as a test rather than left as a surprise. There is no way to tell a
  // maker from a word the lexicon has not met, so the heuristic takes it — and
  // because the brand constrains every rung of the ladder, a wrong one empties
  // the whole search rather than one request.
  //
  // `DESCRIPTOR_TERMS` is what keeps this rare, and the two cases below are the
  // difference it makes.
  assert.equal(parseQuery('distressed black jeans').brand, null, 'a known descriptor became a brand');
  assert.equal(parseQuery('gorpcore jacket').brand, 'gorpcore');
  assert.equal(parseQuery('gorpcore jacket').brandSource, 'leading-run');
});

test('a query made entirely of unknown words is not all brand', () => {
  // Pinning the whole query into `brand =` guarantees zero rows, which is the
  // one outcome the parser exists to avoid.
  assert.equal(parseQuery('qwerty asdf zxcv').brand, null);
});

test('an injected brand list wins wherever the brand appears', () => {
  const parsed = parseQuery('navy tee by james perse', ['James Perse']);
  assert.equal(parsed.brand, 'James Perse');
  assert.equal(parsed.brandSource, 'known');
  assert.equal(parsed.colour, 'navy');
  assert.equal(parsed.productClass, 'top');
});

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

test('colour is the voice enum, so a spoken and a typed colour are one value', () => {
  assert.equal(parseQuery('navy wool crewneck').colour, 'navy');
  // Multi-word colours must match as phrases. `intake-schema.ts` records what
  // happens when they are collapsed to one word: they resolve to nothing.
  assert.equal(parseQuery('light wash jeans').colour, 'light wash');
  assert.equal(parseQuery('off white shirt').colour, 'off white');
});

test('every colour the parser can return is one the lexicon can resolve', () => {
  const known = new Set<string>(COLOUR_TERMS);
  for (const q of ['navy tee', 'light wash jeans', 'off white shirt', 'hot pink dress']) {
    const colour = parseQuery(q).colour;
    if (colour) assert.ok(known.has(colour), `parser returned an unresolvable colour: ${colour}`);
  }
});

// ---------------------------------------------------------------------------
// Drift
// ---------------------------------------------------------------------------

test('the parser lexicon and relevance.ts agree about what a garment noun is', () => {
  // `relevance.ts` is deliberately dependency-free and belongs to another Edge
  // Function, so its nouns are duplicated here rather than imported — the same
  // arrangement `intake-schema.ts` has with the colour lexicon. A duplicate is
  // only safe while something fails when the two disagree.
  const theirs = __testables.SLOT_FAMILY as Record<string, string[]>;

  for (const [slot, nouns] of Object.entries(theirs)) {
    for (const noun of nouns) {
      const klass = NOUN_TO_CLASS.get(noun);
      assert.ok(klass, `relevance.ts knows the noun "${noun}" and the parser does not`);
      assert.equal(
        klass,
        slot,
        `"${noun}" is ${slot} in relevance.ts and ${klass} in the parser lexicon`,
      );
    }
  }
});

test('no garment noun is also a gender word or a colour', () => {
  // An overlap here would make a token's meaning depend on which set is checked
  // first, which is the shape of a bug nobody can read off the code.
  const colours = new Set<string>(COLOUR_TERMS);
  for (const noun of Object.values(CLASS_NOUNS).flat()) {
    assert.ok(!GENDER_SET.has(noun), `"${noun}" is both a garment and a gender word`);
    assert.ok(!colours.has(noun), `"${noun}" is both a garment and a colour`);
  }
});

test('the longest garment phrase wins, so a tee is not merely a shirt', () => {
  assert.equal(parseQuery('james perse t shirt').noun, 't shirt');
  assert.equal(parseQuery('oxford shirt').noun, 'shirt');
});

test('the brand run stops at a multi-word garment name, not just a single word', () => {
  // "t" is not a word the lexicon knows, so a run that only checks one token at
  // a time walks straight through it: brand "james perse t", garment "shirt".
  // A different garment, confidently.
  const parsed = parseQuery('james perse t shirt');
  assert.equal(parsed.brand, 'james perse');
  assert.equal(parsed.noun, 't shirt');
});

test('a noun in modifier position does not decide the garment', () => {
  // "Short Sleeve Crew Tee" is the case that found this: `short` is a garment
  // noun (shorts) and it is LONGER than `tee`, so a naive longest-first scan
  // files the shirt as a bottom — and a query for a top then excludes it. The
  // garment is in the catalogue and the user never sees it.
  const parsed = parseQuery('short sleeve crew tee');
  assert.equal(parsed.productClass, 'top');
  assert.equal(parsed.noun, 'tee');

  // And the word still means shorts when it is the head of its own phrase.
  assert.equal(parseQuery('linen shorts').productClass, 'bottom');
});

test('an empty query parses to nothing rather than throwing', () => {
  const parsed = parseQuery('   ');
  assert.equal(parsed.brand, null);
  assert.equal(parsed.noun, null);
  assert.equal(parsed.productClass, null);
  assert.deepEqual(parsed.strong, []);
  assert.deepEqual(ladderFor(parsed), []);
});
