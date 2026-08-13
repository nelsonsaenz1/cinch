/**
 * Guards on the evaluation harness itself.
 *
 * The harness is measurement equipment, and measurement equipment fails in a
 * way ordinary code does not: quietly, and in the flattering direction. A
 * corpus can be trimmed until it passes, a threshold can be moved down to meet
 * a regression, a scorer can be written so that it cannot fail, and a suite
 * missing its input can report a clean sweep of the cases it does have. None of
 * those show up as a broken test anywhere else, so they are pinned here — in
 * the ordinary suite, which runs on every commit, rather than in the harness,
 * which does not.
 *
 * The four properties, and what each one is defending:
 *
 *   SIZE. The plan names 50 transcripts, 30 prompts and 20 scenarios. Deleting
 *   the cases a change fails is the cheapest way to make a harness lie.
 *   DECLARED THRESHOLDS. Every gate is an aggregate with a stated reason. A
 *   per-case assertion would make the corpora unextendable, which is the same
 *   pressure to delete cases wearing a different hat.
 *   NO IDENTITIES. The corpora are committed, so anything resembling a person,
 *   an address, a signed URL or a storage key must never enter one.
 *   THE SHORTFALL IS REPORTED. The vision suite has none of the photographs
 *   the plan requires and must say so rather than pass on synthetic vectors.
 */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

import { EVAL_VERSION, meetsThreshold, type EvalSuite } from '../scripts/eval/harness.ts';
import { suite as closetParsing } from '../scripts/eval/suites/closet-parsing.ts';
import { suite as stylist } from '../scripts/eval/suites/stylist.ts';
import {
  buildInput,
  loadScenarios,
  suite as packing,
  unsupportedClaims,
} from '../scripts/eval/suites/packing.ts';
import { suite as catalogue } from '../scripts/eval/suites/catalogue.ts';
import { suite as garmentVision } from '../scripts/eval/suites/garment-vision.ts';
import { buildPackingMemo } from '../src/features/plan/packing-memo.ts';

const SUITES: EvalSuite[] = [closetParsing, stylist, packing, catalogue, garmentVision];
const FIXTURE_DIR = 'tests/fixtures/eval';

// ---------------------------------------------------------------------------
// 1 · The corpora are at least as large as the plan asks for
// ---------------------------------------------------------------------------

test('the closet corpus carries at least the fifty transcripts the plan names', () => {
  const corpus = JSON.parse(readFileSync(`${FIXTURE_DIR}/closet-transcripts.json`, 'utf8'));
  assert.ok(corpus.cases.length >= 50, `only ${corpus.cases.length} transcripts`);
  // Every case annotated, not merely present: a transcript with no expected
  // parse contributes nothing to a field accuracy and pads the count.
  for (const kase of corpus.cases) {
    assert.equal(typeof kase.transcript, 'string');
    assert.equal(typeof kase.fallback, 'boolean');
    assert.ok(Array.isArray(kase.garments));
  }
});

test('the stylist corpus carries at least thirty prompts, split both ways', () => {
  const corpus = JSON.parse(readFileSync(`${FIXTURE_DIR}/stylist-prompts.json`, 'utf8'));
  assert.ok(corpus.cases.length >= 30, `only ${corpus.cases.length} prompts`);
  // A corpus of nothing but lookups would score a perfect precision and mean
  // nothing — the negatives are the half that measures the expensive error.
  const open = corpus.cases.filter((c: { intent: string | null }) => c.intent === null);
  assert.ok(open.length >= 10, `only ${open.length} open-ended prompts`);
});

test('the packing corpus carries at least twenty scenarios', () => {
  const corpus = JSON.parse(readFileSync(`${FIXTURE_DIR}/packing-scenarios.json`, 'utf8'));
  assert.ok(corpus.scenarios.length >= 20, `only ${corpus.scenarios.length} scenarios`);
});

// ---------------------------------------------------------------------------
// 2 · Thresholds are declared aggregates, not per-case assertions
// ---------------------------------------------------------------------------

test('every suite declares its thresholds, and every one names a metric it reports', () => {
  for (const suite of SUITES) {
    assert.ok(suite.thresholds.length > 0, `${suite.id} declares no thresholds`);
    const result = suite.run();
    for (const threshold of suite.thresholds) {
      assert.ok(
        threshold.metric in result.metrics,
        `${suite.id} gates ${threshold.metric}, which it does not report`,
      );
      assert.ok(
        threshold.min !== undefined || threshold.max !== undefined,
        `${suite.id}'s ${threshold.metric} threshold has no bound`,
      );
      // A number nobody wrote a reason for is a number nobody can raise later.
      assert.ok(
        threshold.why.length > 20,
        `${suite.id}'s ${threshold.metric} threshold has no stated derivation`,
      );
    }
  }
});

test('no scorer asserts on an individual case', () => {
  // The mechanical form of "thresholds are aggregates". A scorer that imported
  // an assertion library would be able to fail on one transcript, which is the
  // property that makes a corpus unextendable.
  const dir = 'scripts/eval/suites';
  for (const name of readdirSync(dir)) {
    const source = readFileSync(`${dir}/${name}`, 'utf8');
    assert.ok(!source.includes('node:assert'), `${name} imports an assertion library`);
    assert.ok(!source.includes('process.exit'), `${name} can halt the run on one case`);
  }
});

test('a suite that misses its bound is reported as missing it', () => {
  // The threshold rule itself, in both directions — a floor and a ceiling.
  assert.equal(meetsThreshold(0.9, { metric: 'x', min: 0.9, why: 'floor' }), true);
  assert.equal(meetsThreshold(0.89, { metric: 'x', min: 0.9, why: 'floor' }), false);
  assert.equal(meetsThreshold(0.25, { metric: 'x', max: 0.25, why: 'ceiling' }), true);
  assert.equal(meetsThreshold(0.26, { metric: 'x', max: 0.25, why: 'ceiling' }), false);
  assert.equal(meetsThreshold(undefined, { metric: 'x', min: 0, why: 'absent' }), false);
});

test('the harness carries a version, so two reports can be compared', () => {
  assert.equal(typeof EVAL_VERSION, 'number');
  assert.ok(EVAL_VERSION >= 1);
});

// ---------------------------------------------------------------------------
// 3 · Nothing in a committed corpus identifies anybody
// ---------------------------------------------------------------------------

test('no eval fixture carries an identity, a URL or a signed reference', () => {
  const forbidden: [RegExp, string][] = [
    [/https?:\/\//i, 'a URL'],
    [/[\w.+-]+@[\w-]+\.[\w.]+/, 'an email address'],
    [/X-Amz-Signature|Signature=|[?&]token=|[?&]sig=/i, 'a signed URL parameter'],
    [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, 'a UUID'],
    // Separators or an international prefix required. A bare run of digits is
    // an epoch timestamp, and the wardrobe fixture is full of them on purpose.
    [/\+\d[\d\s().-]{7,}\d|\b\d{3}[\s().-]+\d{3}[\s().-]*\d{4}\b/, 'a phone number'],
  ];

  for (const name of readdirSync(FIXTURE_DIR)) {
    // An image in a corpus directory is the failure the plan forbids outright,
    // and it would not be caught by scanning text.
    assert.ok(
      /\.json$/.test(name),
      `${name} is not JSON — no photograph or binary may live in ${FIXTURE_DIR}`,
    );
    const source = readFileSync(`${FIXTURE_DIR}/${name}`, 'utf8');
    for (const [pattern, description] of forbidden) {
      const hit = source.match(pattern);
      assert.equal(hit, null, `${name} contains ${description}: ${hit?.[0]}`);
    }
  }
});

// ---------------------------------------------------------------------------
// 4 · The vision suite reports its shortfall rather than passing
// ---------------------------------------------------------------------------

test('the vision suite reports the missing photographs as a blocker', () => {
  const result = garmentVision.run();
  assert.ok(result.blockers.length > 0, 'the vision suite reported no blocker');
  assert.match(result.blockers[0]!, /permissioned photographs/);
  assert.equal(result.counters.requiredPermissionedPhotographs, 40);
  assert.equal(
    result.counters.sampleShortfall,
    40 - result.counters.permissionedPhotographs!,
    'the shortfall is not the arithmetic it claims to be',
  );
  // And it is a shortfall rather than a failure: the synthetic vectors do pass,
  // which is exactly why the blocker has to be reported separately from them.
  for (const threshold of garmentVision.thresholds) {
    assert.ok(meetsThreshold(result.metrics[threshold.metric], threshold));
  }
});

// ---------------------------------------------------------------------------
// 5 · The claim scorer can actually fail
// ---------------------------------------------------------------------------

test('the packing claim scorer catches a memo that drops a shortfall', () => {
  // A negative control. A scorer nobody has seen fail is a scorer nobody knows
  // works — and "every claim supported" reads identically whether the check is
  // strict or vacuous.
  const scenario = loadScenarios().find((s) => s.looks.some((l) => l.items === null))!;
  const memo = buildPackingMemo(buildInput(scenario));
  assert.equal(unsupportedClaims(scenario, memo).length, 0);

  const tampered = { ...memo, gaps: null };
  const problems = unsupportedClaims(scenario, tampered);
  assert.ok(problems.length > 0, 'a dropped shortfall sentence was not caught');
  assert.match(problems[0]!, /no gap sentence/);
});

test('the packing claim scorer catches a miscounted observation', () => {
  const scenario = loadScenarios()[0]!;
  const memo = buildPackingMemo(buildInput(scenario));
  const tampered = { ...memo, observation: 'Nine pieces covering nine looks over three nights.' };
  assert.ok(unsupportedClaims(scenario, tampered).length > 0, 'a wrong count was not caught');
});
