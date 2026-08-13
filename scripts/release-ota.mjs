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
import { readFileSync } from 'node:fs';
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
