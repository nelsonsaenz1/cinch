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
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const baselinePath = join(root, 'fingerprint.json');
const PLATFORM = 'ios';

/**
 * The commit Store build 40 (1.1.0) was built from, and the runtime EAS
 * stamped on it. Together they are the CONTROL for this script: a method that
 * cannot reproduce a known-good answer is not evidence about anything, and this
 * one silently could not for a while. `--verify-control` runs it.
 */
const CONTROL_COMMIT = 'ac06aec83105c0d9e0eb88a9d361ce4da1863432';
const CONTROL_HASH = '18938ff9525bc2baed62a52ceb514ebefd438c1f';

/**
 * WHY THIS DOES NOT HASH THE WORKING DIRECTORY.
 *
 * It used to, and it was wrong twice over — badly enough that it asserted a
 * native change that did not exist and demanded a redundant Store build.
 *
 * 1. THE INSTALL LAYOUT, which is the one that actually moves the hash.
 *    `@expo/fingerprint` hashes the RESOLVED PATH of every autolinked package.
 *    A store-and-symlink `node_modules` (this repo has been installed by Deno,
 *    whose layout is `node_modules/.deno/<pkg>@<ver>/node_modules/<pkg>/…`)
 *    therefore hashes completely different sources from the flat `npm ci` tree
 *    EAS installs from `package-lock.json`. Observed: 73 sources and
 *    `b07ed5b2…` locally against 168 and `d9cb8c3b…` on an `npm ci` tree of the
 *    identical commit.
 *
 * 2. UNTRACKED LOCAL ARTIFACTS, `ios/` above all. It is gitignored
 *    (`.gitignore:46`) and excluded from the upload by `.easignore:66`, so EAS
 *    never sees it, but a local run picks it up as a `bareNativeDir` source.
 *    Measured, that one is inert — a gitignored directory hashes as empty, so
 *    it moves the source COUNT (168 → 169) and not the hash, which is why the
 *    old baseline recorded 169 sources and still matched EAS. It is fenced off
 *    anyway: "inert today" is not a property worth depending on, and an `ios/`
 *    that stopped being gitignored would poison the hash for real.
 *
 * Both are closed structurally rather than by a flag. The fingerprint is taken
 * over `git archive <rev>` — the tracked tree and nothing else, so no untracked
 * or gitignored artifact can reach it by construction — with a clean `npm ci`
 * from the committed lockfile. That is what EAS uploads and what EAS installs.
 *
 * NOT DONE HERE, DELIBERATELY: none of this is a `fingerprint.config.js`.
 * That file would be uploaded and honoured by EAS too, so excluding paths in it
 * would change the CANONICAL runtime and orphan every binary already in the
 * field. The rule this script exists to enforce is that the hash is EAS's to
 * define; the script's job is to compute the same one, not a friendlier one.
 */
function easEquivalentFingerprint(rev = 'HEAD') {
  const work = mkdtempSync(join(tmpdir(), 'cinch-fingerprint-'));
  try {
    // The tracked tree at `rev`, and nothing else. This is the poisoning fix:
    // there is no working directory here to be poisoned by.
    execFileSync('sh', ['-c', `git archive ${rev} | tar -x -C ${JSON.stringify(work)}`], {
      cwd: root,
      stdio: ['ignore', 'ignore', 'inherit'],
    });

    if (existsSync(join(work, 'ios')) || existsSync(join(work, 'android'))) {
      throw new Error(
        'a native directory is tracked in git; this script assumes the ' +
          'managed/CNG shape that `.easignore` uploads. Re-check the gate.',
      );
    }

    // What EAS installs: the committed lockfile, flat.
    execFileSync('npm', ['ci', '--prefer-offline', '--no-audit', '--no-fund'], {
      cwd: work,
      stdio: ['ignore', 'ignore', 'inherit'],
      env: { ...process.env, npm_config_ignore_scripts: '' },
    });

    return fingerprintOf(work);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

function fingerprintOf(projectRoot) {
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
      cwd: projectRoot,
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

/**
 * `--verify-control`: prove the METHOD before trusting the verdict.
 *
 * Computing at the commit Store build 38 was built from must reproduce the
 * runtime EAS stamped on build 38. If it does not, this script is measuring
 * something other than what EAS measures and its "the native layer has changed"
 * is worthless — which is exactly the state it was in.
 */
if (process.argv.includes('--verify-control')) {
  const control = easEquivalentFingerprint(CONTROL_COMMIT);
  const head = easEquivalentFingerprint('HEAD');
  const lines = [
    '',
    'fingerprint: control verification',
    '',
    `  build 38 commit ${CONTROL_COMMIT.slice(0, 7)}  ${control.hash}  ${control.sources} sources`,
    `  HEAD            ${gitHead().padEnd(7)}  ${head.hash}  ${head.sources} sources`,
    `  EAS runtime on builds 37/38     ${CONTROL_HASH}`,
    '',
  ];
  const controlOk = control.hash === CONTROL_HASH;
  const headOk = head.hash === CONTROL_HASH;
  lines.push(
    controlOk
      ? '  ✓ the method reproduces the runtime EAS stamped on build 40.'
      : '  ✗ the method does NOT reproduce build 38’s runtime — do not trust its verdict.',
  );
  lines.push(
    headOk
      ? '  ✓ HEAD carries that same runtime: an OTA reaches build 40.'
      : '  · HEAD differs from build 38’s runtime — that is a real native change.',
  );
  lines.push('');
  console.log(lines.join('\n'));
  process.exit(controlOk ? 0 : 1);
}

const { hash, sources } = easEquivalentFingerprint();

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
    '    · Confirm the method first: npm run check:fingerprint -- --verify-control',
    '      It recomputes build 38’s own commit and must reproduce the runtime EAS',
    '      stamped on build 38. If that fails, this verdict is measuring the wrong',
    '      thing and is not evidence of a native change — fix the method, not the app.',
    '    · If the control passes, this is a real native change: it needs a STORE',
    '      BUILD, not an OTA.',
    '    · After submitting that build: npm run check:fingerprint -- --set',
    '',
  ].join('\n'),
);
process.exit(1);
