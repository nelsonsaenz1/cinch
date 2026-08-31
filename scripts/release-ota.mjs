#!/usr/bin/env node
/**
 * Publish one production iOS OTA only when it can reach the submitted binary.
 *
 * Usage: npm run release:ota -- "Short release message"
 *
 * This deliberately does not install and walk a production build. The release
 * gate is compatibility and provenance: clean scoped source, pushed main,
 * production variables matching the build profile, and the recorded native
 * fingerprint. expo-updates then enforces that runtime on-device.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { lstatSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const message = process.argv.slice(2).join(' ').trim();
const protectedDirty = new Set([
  'docs/commerce/health-runbook.md',
  'docs/ops/cinch-implementation-release-ledger.md',
  'docs/ops/wave3-visual-acceptance-matrix.md',
]);

function fail(message) {
  console.error(`OTA release refused: ${message}`);
  process.exit(1);
}

function run(file, args, options = {}) {
  return execFileSync(file, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
}

function eas(args, options = {}) {
  return run('npx', ['-y', '-p', 'eas-cli@21.6.0', 'eas', ...args], options);
}

function regexEscape(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

if (!message) fail('pass a release message, for example `npm run release:ota -- "Profile polish"`.');

// ── The deno-poisoned node_modules gate (2026-08-31) ────────────────────────
//
// `eas update` computes the runtime fingerprint from THIS working directory,
// and @expo/fingerprint hashes every native-module directory it can find. A
// stray `deno install` anywhere in the repo can silently rewrite node_modules
// into deno's symlink layout — real packages under `node_modules/.deno/`,
// symlinks at the top — which adds dozens of phantom native dirs to the hash.
// That is exactly how the first 2026-08-31 publish landed on an orphan
// runtime no binary carries. The check is cheap and the remediation is one
// command, so this fails fast with it instead of publishing an update nobody
// can receive.
if (existsSyncSafe(join(root, 'node_modules', '.deno'))) {
  fail(
    'node_modules/.deno exists — a deno install has rewritten node_modules ' +
      'into its symlink layout, which poisons the runtime fingerprint.\n' +
      '  Fix: rm -rf node_modules && npm ci',
  );
}
try {
  if (lstatSync(join(root, 'node_modules', 'expo')).isSymbolicLink()) {
    fail(
      'node_modules/expo is a symlink — node_modules is not the npm ci layout ' +
        'the store build was fingerprinted from.\n  Fix: rm -rf node_modules && npm ci',
    );
  }
} catch {
  fail('node_modules/expo is missing — run npm ci first.');
}
function existsSyncSafe(path) {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

const dirty = run('git', ['status', '--porcelain=v1'])
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const path = line.slice(3);
    return path.includes(' -> ') ? path.split(' -> ').at(-1) : path;
  })
  .filter((path) => path && !protectedDirty.has(path));
if (dirty.length) fail(`commit or remove scoped changes first:\n  ${dirty.join('\n  ')}`);

const branch = run('git', ['branch', '--show-current']).trim();
if (branch !== 'main') fail(`current branch is ${branch || '(detached)'}, not main.`);

run('git', ['fetch', '--quiet', 'origin', 'main']);
const head = run('git', ['rev-parse', 'HEAD']).trim();
const remote = run('git', ['rev-parse', 'origin/main']).trim();
if (head !== remote) fail('HEAD does not exactly match origin/main; push the release commit first.');

run('npm', ['run', 'check:fingerprint'], { stdio: 'inherit' });
const fingerprint = JSON.parse(readFileSync(join(root, 'fingerprint.json'), 'utf8'));
if (!fingerprint.hash) fail('fingerprint.json has no recorded runtime hash.');

const easConfig = JSON.parse(readFileSync(join(root, 'eas.json'), 'utf8'));
const expectedEnv = easConfig.build?.production?.env ?? {};
const remoteEnv = eas(
  ['env:list', 'production', '--format', 'long', '--include-sensitive'],
  { stdio: ['ignore', 'pipe', 'inherit'] },
);
for (const [name, value] of Object.entries(expectedEnv)) {
  const pattern = new RegExp(
    `Name\\s+${regexEscape(name)}[\\s\\S]{0,240}?Value\\s+${regexEscape(String(value))}(?:\\n|$)`,
  );
  if (!pattern.test(remoteEnv)) {
    fail(`EAS production variable ${name} is missing or differs from eas.json.`);
  }
}

const published = spawnSync(
  'npx',
  [
    '-y',
    '-p',
    'eas-cli@21.6.0',
    'eas',
    'update',
    '--channel',
    'production',
    '--platform',
    'ios',
    '--environment',
    'production',
    '--message',
    message,
    '--json',
  ],
  {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['inherit', 'pipe', 'inherit'],
  },
);
if (published.status !== 0) process.exit(published.status ?? 1);

let result;
try {
  result = JSON.parse(published.stdout);
} catch {
  fail('EAS reported success but its JSON receipt could not be parsed.');
}

const runtimes = new Set();
const updates = [];
function collect(value) {
  if (!value || typeof value !== 'object') return;
  if (typeof value.runtimeVersion === 'string') runtimes.add(value.runtimeVersion);
  if (typeof value.id === 'string' && typeof value.runtimeVersion === 'string') updates.push(value.id);
  for (const child of Object.values(value)) collect(child);
}
collect(result);

if (runtimes.size !== 1 || !runtimes.has(fingerprint.hash)) {
  fail(
    `published runtime ${[...runtimes].join(', ') || '(missing)'} does not match build runtime ${fingerprint.hash}.`,
  );
}

console.log(`OTA published to production for runtime ${fingerprint.hash}.`);
if (updates.length) console.log(`Update: ${updates.join(', ')}`);
