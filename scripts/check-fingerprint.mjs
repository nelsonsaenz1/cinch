#!/usr/bin/env node
/**
 * Does the native layer still match the build that is out there?
 *
 * WHY THIS EXISTS
 *
 * `runtimeVersion.policy` is `appVersion`, which means an OTA update is
 * accepted by ANY installed build carrying the same version string —
 * regardless of whether its native layer matches. So the failure mode is:
 * somebody adds a native module, bumps nothing, ships an `eas update`, and the
 * JS bundle lands on a binary that does not contain the module. What the user
 * sees is not "missing native module". It is a router error, or a white screen,
 * or a crash on a screen unrelated to the change — because the failure surfaces
 * wherever the missing thing is first touched.
 *
 * That is a bad afternoon, and it is entirely avoidable: `@expo/fingerprint`
 * hashes everything that ends up in the binary (native projects, config
 * plugins, the packages with native code, the entitlements) and gives one hash
 * back. If it has moved, the tree needs a store build, not an OTA.
 *
 * WHAT THIS IS NOT
 *
 * It is not a substitute for switching `runtimeVersion.policy` to
 * `'fingerprint'`, which would make Expo enforce this rather than asking a
 * human to run a script. That switch is deliberately NOT made here: it changes
 * the runtime version of every future build, so installs already in the wild
 * would stop receiving OTAs until a new store build reaches them. That is a
 * shipping decision, not a tooling one. See `docs/ops/native-fingerprint.md`.
 *
 * USAGE
 *
 *   npm run check:fingerprint          compare against the recorded baseline
 *   npm run check:fingerprint -- --set  record the current hash as the baseline
 *
 * `--set` is for immediately after a store build is submitted, and is the only
 * moment it is honest to run it: the baseline means "this is what the binary in
 * the store contains".
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = join(root, 'fingerprint.json');
const PLATFORM = 'ios';

function currentFingerprint() {
  // `expo-updates fingerprint:generate` prints the full source list as JSON.
  // Only `hash` matters here; the sources are what make a DIFF readable, and
  // that is `fingerprint:diff`'s job rather than this script's.
  const out = execFileSync(
    'npx',
    ['expo-updates', 'fingerprint:generate', '--platform', PLATFORM],
    { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  // The command prints env-loading noise on stderr and JSON on stdout, but be
  // defensive: take the last line that parses.
  const lines = out.trim().split('\n');
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try {
      const parsed = JSON.parse(lines[i]);
      if (parsed?.hash) return { hash: parsed.hash, sources: parsed.sources?.length ?? 0 };
    } catch {
      // keep walking back
    }
  }
  throw new Error('could not parse a fingerprint out of expo-updates output');
}

function gitHead() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim();
  } catch {
    return 'unknown';
  }
}

const setting = process.argv.includes('--set');
const { hash, sources } = currentFingerprint();

if (setting) {
  const stamp = new Date().toISOString().slice(0, 10);
  writeFileSync(
    baselinePath,
    `${JSON.stringify(
      {
        _comment:
          'The native fingerprint of the build that is in the store. Set with ' +
          '`npm run check:fingerprint -- --set` at the moment a store build is ' +
          'submitted, and at no other time — see scripts/check-fingerprint.mjs.',
        platform: PLATFORM,
        hash,
        sources,
        recordedAt: stamp,
        commit: gitHead(),
      },
      null,
      2,
    )}\n`,
  );
  console.log(`fingerprint: baseline set to ${hash} (${sources} sources)`);
  process.exit(0);
}

if (!existsSync(baselinePath)) {
  console.error(
    'fingerprint: no baseline recorded.\n' +
      '  Run `npm run check:fingerprint -- --set` when a store build is submitted.',
  );
  process.exit(1);
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));

if (baseline.hash === hash) {
  console.log(`fingerprint: unchanged (${hash}) — an OTA reaches this binary.`);
  process.exit(0);
}

console.error(
  [
    '',
    'fingerprint: THE NATIVE LAYER HAS CHANGED.',
    '',
    `  recorded  ${baseline.hash}   ${baseline.recordedAt} @ ${baseline.commit}`,
    `  current   ${hash}   ${sources} sources`,
    '',
    '  An `eas update` shipped now would land this JS on a binary built from',
    '  different native code. With runtimeVersion policy `appVersion`, Expo will',
    '  NOT stop it — the version string still matches. The user would see a',
    '  router error or a blank screen somewhere unrelated to the change.',
    '',
    '  What to do:',
    '    · See what moved:  npx expo-updates fingerprint:diff',
    '    · If it is a real native change, this needs a STORE BUILD, not an OTA.',
    '    · After submitting that build: npm run check:fingerprint -- --set',
    '',
  ].join('\n'),
);
process.exit(1);
