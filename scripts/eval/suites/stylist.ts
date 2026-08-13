/**
 * Which questions the closet answers itself, and which ones it must not.
 *
 * ── The two errors are not worth the same ─────────────────────────────────
 *
 * `facts.ts` opens by saying the router is closed and that a question which
 * matches nothing goes to the model unchanged. That makes the two directions of
 * failure wildly asymmetric, and a single "accuracy" number would average them
 * into meaninglessness:
 *
 *   A FALSE NEGATIVE — a real lookup escaping to the model — costs one AI call
 *   and about twenty seconds. The user still gets an answer, and it is usually
 *   the right one, because a model reading a closet digest can usually count to
 *   three. Annoying; recoverable.
 *
 *   A FALSE POSITIVE — a taste question caught by the template — produces an
 *   inventory count in reply to "what should I wear to my sister's wedding".
 *   There is no signal to the user that anything went wrong. That is the error
 *   with a real cost, so precision and recall are scored SEPARATELY and the
 *   precision gate is the tighter of the two.
 *
 * ── What "grounded" means here ────────────────────────────────────────────
 *
 * A factual case passes when every substring in its `grounded` list appears in
 * the answer, and those substrings are arithmetic over the wardrobe fixture —
 * counts, garment names, dates — never phrasing. The plan's concern is a model
 * inventing a plausible number about somebody's own wardrobe; the corpus checks
 * the number, and leaves the sentence around it free to be rewritten.
 */

import { routeFactQuestion, tryFactAnswer } from '@/features/stylist/facts';
import type { FactIntent } from '@/features/stylist/facts';
import type { Garment } from '@/lib/styling';
import {
  MAX_DIAGNOSTICS,
  corpusPath,
  rate,
  type EvalSuite,
  type SuiteResult,
  type Threshold,
} from '../harness.ts';
import { readFileSync } from 'node:fs';

type PromptCase = {
  id: string;
  question: string;
  /** Null means "this is a taste question and must reach the model". */
  intent: FactIntent | null;
  grounded?: string[];
};

function loadWardrobe(): { wardrobe: Garment[]; now: number } {
  const raw = JSON.parse(readFileSync(corpusPath('stylist-wardrobe.json'), 'utf8')) as {
    now: number;
    garments: unknown[];
  };
  // The fixture carries exactly the fields the fact tools read. Cast rather
  // than construct: a full `Garment` needs styling-engine fields (visual
  // weight, harmonies) that no fact answer looks at, and inventing them would
  // put numbers in the corpus that nothing verifies.
  return { wardrobe: raw.garments as unknown as Garment[], now: raw.now };
}

function loadCases(): PromptCase[] {
  return (JSON.parse(readFileSync(corpusPath('stylist-prompts.json'), 'utf8')) as {
    cases: PromptCase[];
  }).cases;
}

const thresholds: readonly Threshold[] = [
  {
    metric: 'routingPrecision',
    // Nineteen of the twenty routed questions are genuine lookups. The one that
    // is not — "what would you wear with a leather jacket in autumn" — is
    // caught by the `wear with` clause of the compatible rule. Measured 0.95;
    // gated at 0.90 so one more paraphrase trap in the corpus does not fail the
    // build, and no lower, because this is the error the user cannot see.
    min: 0.9,
    why: 'Answering a taste question with arithmetic is invisible to the user. Measured 0.95 when this suite was written — the trap was "what would you wear with…" matching `wear with`, now refused — and 1.00 since. The bar stays at 0.90 so a future rule can be added without a red run, not because 0.90 is acceptable.',
  },
  {
    metric: 'routingRecall',
    // A missed lookup costs an AI call and nothing else, so this sits lower
    // than precision deliberately. Measured 0.95 — "which top do I wear least"
    // is phrased outside the intent table.
    min: 0.85,
    why: 'A missed lookup costs one call, not a wrong answer; measured 0.95 and gated looser than precision on purpose.',
  },
  {
    metric: 'intentAccuracy',
    // Of the questions that DO route, the share routed to the right template.
    // Perfect today and it should stay perfect: a lookup sent to the wrong tool
    // returns a confident number about the wrong question.
    min: 1,
    why: 'A lookup answered by the wrong tool is a confident number about a different question; perfect today.',
  },
  {
    metric: 'groundedAnswerAccuracy',
    // Every number in every answered case, checked against the fixture. This is
    // the property the whole workstream turns on and there is no honest reason
    // for it to be below one.
    min: 1,
    why: 'Every number comes from a count over the fixture; anything less means an answer is not grounded.',
  },
];

function run(): SuiteResult {
  const { wardrobe, now } = loadWardrobe();
  const cases = loadCases();
  const diagnostics: string[] = [];

  let truePositives = 0;
  let falsePositives = 0;
  let falseNegatives = 0;
  let trueNegatives = 0;
  let intentChecked = 0;
  let intentCorrect = 0;
  let groundedChecked = 0;
  let groundedCorrect = 0;
  let reachesModel = 0;

  for (const kase of cases) {
    const routed = routeFactQuestion(kase.question);
    const answer = tryFactAnswer(wardrobe, kase.question, now);
    if (!answer) reachesModel += 1;

    if (kase.intent === null) {
      if (routed === null) trueNegatives += 1;
      else {
        falsePositives += 1;
        diagnostics.push(
          `${kase.id}: taste question routed to ${routed.intent} — "${kase.question}"`,
        );
      }
      continue;
    }

    if (routed === null) {
      falseNegatives += 1;
      diagnostics.push(`${kase.id}: lookup escaped to the model — "${kase.question}"`);
      continue;
    }

    truePositives += 1;
    intentChecked += 1;
    if (routed.intent === kase.intent) intentCorrect += 1;
    else {
      diagnostics.push(
        `${kase.id}: intent expected ${kase.intent}, got ${routed.intent}`,
      );
    }

    if (kase.grounded?.length) {
      groundedChecked += 1;
      const text = answer?.text ?? '';
      const missing = kase.grounded.filter((fragment) => !text.includes(fragment));
      if (!missing.length) groundedCorrect += 1;
      else if (diagnostics.length < MAX_DIAGNOSTICS) {
        diagnostics.push(`${kase.id}: answer missing ${missing.join(', ')} — "${text}"`);
      }
    }
  }

  return {
    id: 'stylist',
    title: 'Stylist — factual routing against open questions',
    caseCount: cases.length,
    metrics: {
      routingPrecision: rate(truePositives, truePositives + falsePositives),
      routingRecall: rate(truePositives, truePositives + falseNegatives),
      intentAccuracy: rate(intentCorrect, intentChecked),
      groundedAnswerAccuracy: rate(groundedCorrect, groundedChecked),
    },
    counters: {
      factualPrompts: truePositives + falseNegatives,
      openPrompts: trueNegatives + falsePositives,
      falsePositives,
      falseNegatives,
      /** Every prompt the deterministic path declined. This is the AI spend. */
      promptsSpendingAnAiCall: reachesModel,
    },
    diagnostics: diagnostics.slice(0, MAX_DIAGNOSTICS),
    blockers: [],
  };
}

export const suite: EvalSuite = {
  id: 'stylist',
  title: 'Stylist — factual routing against open questions',
  thresholds,
  run,
};
