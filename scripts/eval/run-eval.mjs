/**
 * The evaluation runner.
 *
 * ── What it is for ────────────────────────────────────────────────────────
 *
 * Workstream 9 asks for versioned evaluation harnesses rather than a model
 * chosen off a price table. This is the thing that produces the numbers: it
 * bundles the suites under `suites/`, runs each corpus, and prints one
 * scorecard against thresholds the suites declare themselves.
 *
 * It is NOT part of `npm test` and deliberately so. The unit suite answers
 * "is this broken"; this answers "how good is it, and what does the gap cost",
 * and those two questions want different cadences — the first on every commit,
 * the second when a model, a lexicon or a threshold changes.
 *
 * ── Bundling ──────────────────────────────────────────────────────────────
 *
 * Same mechanism as `scripts/run-tests.mjs`, for the same reason: the suites
 * import TypeScript modules through the `@/*` aliases and, in the Edge Function
 * cases, through Deno-flavoured `.ts` specifiers. esbuild resolves both from
 * tsconfig.json. Nothing else in the toolchain would, and adding something that
 * did would mean a new dependency.
 *
 * The bundle output goes to `node_modules/.cache/` alongside the unit runner's,
 * which is already gitignored and already the house convention.
 *
 * ── Exit codes ────────────────────────────────────────────────────────────
 *
 *   0  every threshold met and no blocker recorded
 *   1  a threshold was missed
 *   2  every threshold met, but a suite is missing input the plan requires
 *
 * Two is separate from one on purpose. A blocked suite is not a failing suite —
 * nothing is wrong with the code, the evidence to judge it does not exist yet —
 * and collapsing the two would let "we could not measure this" print as green.
 * There is no flag to suppress it; a blocker clears when the input arrives.
 *
 * ── Timings ───────────────────────────────────────────────────────────────
 *
 * Wall-clock per suite is measured and printed, and it decides NOTHING. It
 * lives in its own `timings` section of the JSON so a consumer diffing two
 * reports can drop one key and get a byte-identical comparison. A threshold on
 * a timing would make this runner's verdict depend on what else the machine was
 * doing, which is the opposite of what a versioned harness is for.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const suitesDir = join(root, 'scripts', 'eval', 'suites');
const workDir = join(root, 'node_modules', '.cache', 'eval-suites');

const asJson = process.argv.includes('--json');

/** Suites read their corpora relative to this rather than to the bundle. */
process.env.CINCH_EVAL_ROOT = root;

rmSync(workDir, { recursive: true, force: true });
mkdirSync(workDir, { recursive: true });

const suiteNames = readdirSync(suitesDir)
  .filter((name) => name.endsWith('.ts'))
  .sort();

if (!suiteNames.length) {
  console.error('No evaluation suites found.');
  process.exit(1);
}

// `harness.ts` is bundled as its own entry point rather than reached through a
// suite: the runner needs `EVAL_VERSION` and the threshold rule, and importing
// them out of an arbitrary suite's bundle would make the report's version
// depend on which file sorted first.
const harnessEntry = join(root, 'scripts', 'eval', 'harness.ts');
const entries = [harnessEntry, ...suiteNames.map((name) => join(suitesDir, name))];

execFileSync(
  join(root, 'node_modules', '.bin', 'esbuild'),
  [
    ...entries,
    '--bundle',
    '--platform=node',
    '--format=esm',
    '--target=node22',
    `--outdir=${workDir}`,
    '--out-extension:.js=.mjs',
    `--tsconfig=${join(root, 'tsconfig.json')}`,
    '--log-level=error',
  ],
  { stdio: 'inherit', cwd: root },
);

const { EVAL_VERSION, meetsThreshold } = await import(
  pathToFileURL(join(workDir, 'harness.mjs')).href
);

const results = [];
const timings = {};

for (const name of suiteNames) {
  const bundled = join(workDir, 'suites', name.replace(/\.ts$/, '.mjs'));
  const module = await import(pathToFileURL(bundled).href);
  const suite = module.suite;
  if (!suite) {
    console.error(`${name} does not export a \`suite\`.`);
    process.exit(1);
  }

  const started = process.hrtime.bigint();
  const result = suite.run();
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;

  timings[suite.id] = Math.round(elapsedMs * 100) / 100;
  results.push({ suite, result });
}

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------

let missed = 0;
let blocked = 0;
const report = {
  evalVersion: EVAL_VERSION,
  suites: [],
};

for (const { suite, result } of results) {
  const checks = suite.thresholds.map((threshold) => {
    const value = result.metrics[threshold.metric];
    const ok = meetsThreshold(value, threshold);
    if (!ok) missed += 1;
    return {
      metric: threshold.metric,
      value: value ?? null,
      min: threshold.min ?? null,
      max: threshold.max ?? null,
      why: threshold.why,
      ok,
    };
  });

  if (result.blockers.length) blocked += 1;

  report.suites.push({
    id: result.id,
    title: result.title,
    caseCount: result.caseCount,
    checks,
    metrics: result.metrics,
    counters: result.counters,
    diagnostics: result.diagnostics,
    blockers: result.blockers,
    status: checks.every((c) => c.ok) ? (result.blockers.length ? 'blocked' : 'pass') : 'fail',
  });
}

report.status = missed > 0 ? 'fail' : blocked > 0 ? 'blocked' : 'pass';
const exitCode = missed > 0 ? 1 : blocked > 0 ? 2 : 0;

if (asJson) {
  // Timings last and top-level, so a consumer comparing two reports can delete
  // one key and compare the rest byte for byte.
  console.log(JSON.stringify({ ...report, timings }, null, 2));
  process.exit(exitCode);
}

const pct = (n) => `${(n * 100).toFixed(2)}%`;
const mark = (ok) => (ok ? 'PASS' : 'MISS');

console.log(`\nCinch deterministic evaluation — harness v${EVAL_VERSION}\n`);

for (const suite of report.suites) {
  console.log(`${suite.title}  (${suite.caseCount} cases)  [${suite.status.toUpperCase()}]`);
  for (const check of suite.checks) {
    const bound =
      check.min !== null ? `min ${pct(check.min)}` : `max ${pct(check.max ?? 1)}`;
    console.log(
      `  ${mark(check.ok)}  ${check.metric.padEnd(22)} ${pct(check.value ?? 0).padStart(8)}  (${bound})`,
    );
    console.log(`        ↳ ${check.why}`);
  }
  const counters = Object.entries(suite.counters);
  if (counters.length) {
    console.log(`  counters: ${counters.map(([k, v]) => `${k}=${v}`).join(', ')}`);
  }
  for (const blocker of suite.blockers) console.log(`  BLOCKER: ${blocker}`);
  for (const line of suite.diagnostics) console.log(`  · ${line}`);
  console.log('');
}

console.log(
  `timings (reported, never gated): ${Object.entries(timings)
    .map(([k, v]) => `${k} ${v}ms`)
    .join(', ')}`,
);
console.log(`\noverall: ${report.status.toUpperCase()}\n`);
process.exit(exitCode);
