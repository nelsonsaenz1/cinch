/**
 * Unit test runner.
 *
 * There is no Jest here on purpose. The things worth testing in this app are
 * pure functions — the styling engine, the colour maths, cost-per-wear, date
 * keys — none of which need a React renderer, a native module mock, or a
 * transform pipeline. Node 22 ships a test runner; esbuild is already a
 * dependency for the smoke scripts. Those two are the entire toolchain.
 *
 * esbuild bundles each `tests/*.test.ts` into ESM (resolving the `@/*` aliases
 * out of tsconfig.json on the way), then `node --test` runs the results.
 *
 * The `.pending` suffix
 * ---------------------
 * A test file may be written before the module it tests exists. Such a file is
 * named `*.test.ts.pending` with a `// requires: <path>` line at the top: the
 * extension keeps it out of tsconfig's `**\/*.ts` glob (so `tsc --noEmit` does
 * not fail on the missing import), and this runner promotes it to a real test
 * automatically the moment its dependency lands. Nobody has to remember.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const testsDir = join(root, 'tests');
const workDir = join(root, 'node_modules', '.cache', 'unit-tests');

rmSync(workDir, { recursive: true, force: true });
mkdirSync(workDir, { recursive: true });

const entries = [];
const skipped = [];

for (const name of readdirSync(testsDir).sort()) {
  if (name.endsWith('.test.ts')) {
    entries.push(join(testsDir, name));
    continue;
  }
  if (!name.endsWith('.test.ts.pending')) continue;

  const source = readFileSync(join(testsDir, name), 'utf8');
  const required = [...source.matchAll(/^\/\/ requires: (.+)$/gm)].map((m) => m[1].trim());
  const missing = required.filter((p) => !existsSync(join(root, p)));

  if (missing.length) {
    skipped.push(`${name} — waiting on ${missing.join(', ')}`);
    continue;
  }

  // Staged inside tests/ so its relative imports still resolve.
  const staged = join(testsDir, name.replace(/\.pending$/, ''));
  writeFileSync(staged, source);
  entries.push(staged);
}

const cleanup = () => {
  for (const e of entries) {
    if (existsSync(`${e}.pending`)) rmSync(e, { force: true });
  }
};

try {
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
} finally {
  cleanup();
}

if (skipped.length) {
  console.log('\nPending test files (dependency not in the tree yet):');
  for (const s of skipped) console.log(`  - ${s}`);
  console.log('');
}

if (!entries.length) {
  console.error('No test files found.');
  process.exit(1);
}

// Explicit file arguments rather than the directory: `node --test <dir>` walks
// the tree with its own discovery rules, and those skip anything under
// node_modules — which is exactly where the build cache lives.
const bundled = readdirSync(workDir)
  .filter((f) => f.endsWith('.test.mjs'))
  .sort()
  .map((f) => join(workDir, f));

execFileSync(process.execPath, ['--test', ...bundled], { stdio: 'inherit', cwd: root });
