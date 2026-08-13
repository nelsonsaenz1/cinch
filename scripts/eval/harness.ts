/**
 * The shapes every evaluation suite reports in, and the rule for reading them.
 *
 * ── Why this is not another test file ──────────────────────────────────────
 *
 * `tests/*.test.ts` answers "did this function do the right thing on the case
 * somebody thought of". That is a different question from the one Workstream 9
 * asks, which is "what share of real input does the deterministic path answer,
 * and how often does it hand the problem to a model". A unit test is a boolean
 * about one case; a suite here is a RATE over a corpus, and a rate has to be
 * measured before a threshold can honestly be set on it.
 *
 * The distinction matters in one practical way: a suite must never be tuned by
 * deleting the cases it fails. So the corpora are annotated with what a human
 * would say the answer is, not with what the code returns, and a suite whose
 * accuracy is below 1.0 is reporting a real gap rather than a broken fixture.
 *
 * ── Thresholds are declared, not asserted per case ─────────────────────────
 *
 * Every gate in this harness is a `Threshold` over an aggregate metric, held in
 * a list the suite exports. Nothing in a scorer says "this case must pass".
 * That is deliberate: a per-case assertion makes the corpus unextendable —
 * adding a hard transcript would break the build rather than move a number —
 * and the whole point of a corpus is that it grows. `tests/eval-harness.test.ts`
 * pins that property so it cannot quietly erode.
 *
 * Each threshold carries a `why`. A number with no stated derivation is a
 * number nobody can raise later without guessing what it was protecting.
 */

/** Bumped when a scorer changes meaning, so two reports can be compared. */
export const EVAL_VERSION = 1;

/**
 * A gate on one aggregate metric.
 *
 * `min` and `max` rather than a single "target" because half of what matters
 * here is a ceiling, not a floor: fallback rate and false-positive routing are
 * costs, and a suite that only knew how to demand "higher" could not express
 * them.
 */
export type Threshold = {
  metric: string;
  min?: number;
  max?: number;
  /** One line. Why this number and not a rounder one. */
  why: string;
};

export type SuiteResult = {
  id: string;
  title: string;
  caseCount: number;
  /** Gated values. Every key a threshold names must appear here. */
  metrics: Record<string, number>;
  /**
   * Reported and never gated: raw counts, sample shortfalls, spend estimates.
   * A consumer reads these; the pass/fail decision does not.
   */
  counters: Record<string, number>;
  /** Per-case diagnostics for whatever missed. Capped — see `MAX_DIAGNOSTICS`. */
  diagnostics: string[];
  /**
   * Input the plan requires and this repository does not have.
   *
   * A blocker is not a failing threshold: nothing is wrong with the code, the
   * evidence is missing. Reported separately so that "we cannot measure this"
   * can never be printed as "this passed".
   */
  blockers: string[];
};

export type EvalSuite = {
  id: string;
  title: string;
  thresholds: readonly Threshold[];
  run(): SuiteResult;
};

/** Enough to debug a regression, few enough that a scorecard stays readable. */
export const MAX_DIAGNOSTICS = 12;

/**
 * A rate, rounded.
 *
 * Four places because three lets a 1-in-1000 change vanish, and floating point
 * noise in the last digit would make two runs of the same corpus print
 * differently — which would defeat the point of a deterministic report.
 */
export function rate(numerator: number, denominator: number): number {
  if (denominator === 0) return 1;
  return Math.round((numerator / denominator) * 10_000) / 10_000;
}

/** Deep structural equality over the JSON-shaped values the corpora hold. */
export function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  return ka.every((k) =>
    sameValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  );
}

/**
 * Field-by-field comparison of one expected record against one produced record.
 *
 * Returns the number of fields checked and the number that matched, so a caller
 * can accumulate a FIELD accuracy rather than a record accuracy. Field accuracy
 * is the number the plan asks for and it is the kinder-but-truer one: a garment
 * whose colour is wrong and whose slot, noun and quantity are right is 75%
 * right, and scoring it as a total miss would hide which field needs work.
 */
export function scoreFields<T extends Record<string, unknown>>(
  expected: T,
  actual: Partial<T> | null,
  fields: readonly (keyof T)[],
): { checked: number; matched: number; wrong: string[] } {
  const wrong: string[] = [];
  let matched = 0;
  for (const field of fields) {
    const want = expected[field];
    const got = actual ? actual[field] : undefined;
    if (actual !== null && sameValue(want, got)) matched += 1;
    else wrong.push(`${String(field)}: expected ${format(want)}, got ${format(got)}`);
  }
  return { checked: fields.length, matched, wrong };
}

function format(value: unknown): string {
  if (value === undefined) return '(absent)';
  return JSON.stringify(value);
}

/** Whether a metric satisfies its gate. Shared by the runner and the guard test. */
export function meetsThreshold(value: number | undefined, threshold: Threshold): boolean {
  if (value === undefined) return false;
  if (threshold.min !== undefined && value < threshold.min) return false;
  if (threshold.max !== undefined && value > threshold.max) return false;
  return true;
}

/**
 * Read a corpus file.
 *
 * Paths are resolved from the repository root rather than from the bundle,
 * because the bundle lives in `node_modules/.cache` and a relative import there
 * would point at nothing. The root is passed in by the runner through an
 * environment variable it sets itself — never read from user input.
 */
export function corpusPath(name: string): string {
  const root = process.env.CINCH_EVAL_ROOT ?? process.cwd();
  return `${root}/tests/fixtures/eval/${name}`;
}
