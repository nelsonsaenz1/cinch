#!/usr/bin/env node
/**
 * Does the native layer still match the build that is out there?
 *
 * WHY THIS EXISTS
 *
 * Before the first release candidate, `runtimeVersion.policy` was
 * `appVersion`, which meant an OTA update could be accepted by any installed
 * build carrying the same version string regardless of native compatibility.
 * The failure mode was:
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
 * Runtime compatibility is now enforced with `runtimeVersion.policy =
 * 'fingerprint'`. This script remains the release ledger: it says whether the
 * current tree still matches the most recently submitted Store build. See
 * `docs/ops/native-fingerprint.md`.
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
  // The Store binary is built from the production EAS profile, and some of
  // that profile's environment changes native configuration (today,
  // CINCH_VOICE_INTAKE adds the audio plugin and privacy declaration). Hashing
  // with the caller's local environment would therefore compare a different
  // native app from the one EAS actually submitted.
  const eas = JSON.parse(readFileSync(join(root, 'eas.json'), 'utf8'));
  const productionEnv = eas.build?.production?.env ?? {};

  // `expo-updates fingerprint:generate` prints the full source list as JSON.
  // Only `hash` matters here; the sources are what make a DIFF readable, and
  // that is `fingerprint:diff`'s job rather than this script's.
  const out = execFileSync(
    'npx',
    ['expo-updates', 'fingerprint:generate', '--platform', PLATFORM],
    {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      // Config plugins can branch on the EAS profile itself. In particular,
      // the production privacy plugin strips dev-launcher Bonjour keys only
      // when this value is present. Omitting it hashes the local development
      // plist and produces a runtime that no production build actually has.
      env: { ...process.env, ...productionEnv, EAS_BUILD_PROFILE: 'production' },
    },
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
    '  The current tree no longer matches the last submitted Store build.',
    '  Fingerprint runtime policy prevents an OTA from crossing that native',
    '  boundary, so this tree needs a new Store build before it can receive an',
    '  update on its own runtime.',
    '',
    '  What to do:',
    '    · If it is a real native change, this needs a STORE BUILD, not an OTA.',
    '    · After submitting that build: npm run check:fingerprint -- --set',
    '',
  ].join('\n'),
);
process.exit(1);
