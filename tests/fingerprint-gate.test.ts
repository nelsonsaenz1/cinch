/**
 * The release gate that cried wolf.
 *
 * `check:fingerprint` asserted "THE NATIVE LAYER HAS CHANGED" against a tree
 * whose native layer had not changed at all, and a release ledger carried that
 * forward into "main cannot ship as an OTA; a new store build is required".
 * Both were false. The script was hashing the working directory, which differs
 * from what EAS uploads and installs in two ways:
 *
 *   1. the install layout — `@expo/fingerprint` hashes RESOLVED PATHS, and this
 *      repo's `node_modules` is a Deno store of symlinks rather than the flat
 *      `npm ci` tree EAS installs (73 sources / `b07ed5b2…` against 168 /
 *      `d9cb8c3b…` for the identical commit);
 *   2. untracked local artifacts, `ios/` above all — gitignored and excluded by
 *      `.easignore:66`, so EAS never receives it.
 *
 * These pin the SHAPE of the repair, which is what a future edit can quietly
 * undo. The live proof — recomputing build 38's own commit and getting back the
 * runtime EAS actually stamped on build 38 — costs an `npm ci` per revision, so
 * it is opt-in rather than in the default suite:
 *
 *     CINCH_FINGERPRINT_CONTROL=1 npm test
 *
 * or, equivalently and more directly:
 *
 *     npm run check:fingerprint -- --verify-control
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import process from 'node:process';
import { test } from 'node:test';

const script = readFileSync('scripts/check-fingerprint.mjs', 'utf8');
const body = script.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const BUILD_38_COMMIT = '9345eb29fc4403652aa1edde96cd5112cafe637c';
const BUILD_38_RUNTIME = 'd9cb8c3b77a5e69d793dcdbd2aec1484f54cb3c6';

test('the control is the commit Store build 38 was built from, and its EAS runtime', () => {
  assert.match(body, new RegExp(`CONTROL_COMMIT = '${BUILD_38_COMMIT}'`));
  assert.match(body, new RegExp(`CONTROL_HASH = '${BUILD_38_RUNTIME}'`));

  // And the recorded baseline is that same runtime, so "unchanged" means
  // "still what the store binary carries" rather than "still what some earlier
  // local run happened to produce".
  const baseline = JSON.parse(readFileSync('fingerprint.json', 'utf8'));
  assert.equal(baseline.hash, BUILD_38_RUNTIME);
  assert.equal(baseline.platform, 'ios');
});

test('the fingerprint is taken over the tracked tree, never the working directory', () => {
  // `git archive` is the whole poisoning fix: there is no working directory in
  // the hashed tree, so no untracked or gitignored artifact can reach it.
  assert.match(body, /git archive \$\{rev\}/);
  assert.match(body, /tar -x -C/);

  // And the install EAS performs, from the committed lockfile.
  assert.match(body, /'npm',\s*\['ci'/);

  // The generator must run against the extracted tree. Hashing `root` is the
  // exact regression this file exists to catch.
  assert.match(body, /cwd: projectRoot/);
  // Scoped to `fingerprintOf` itself: `gitHead()` below it reads the real repo
  // on purpose, so slicing to end-of-file would assert against the wrong thing.
  const generator = body.slice(
    body.indexOf('function fingerprintOf'),
    body.indexOf('function gitHead'),
  );
  assert.ok(generator.length > 0);
  assert.doesNotMatch(
    generator,
    /cwd: root/,
    'the generator is pointed back at the working directory',
  );
});

test('a tracked native directory is refused rather than silently hashed', () => {
  assert.match(body, /existsSync\(join\(work, 'ios'\)\)/);
  assert.match(body, /existsSync\(join\(work, 'android'\)\)/);
});

test('the repair does not change the canonical runtime', () => {
  // A `fingerprint.config.js` would be uploaded and honoured by EAS too, so
  // excluding paths there would move the runtime every shipped binary is keyed
  // to. The fix belongs in the script, which only observes.
  // "Is this file there?" via `readdirSync`, the convention the other suites
  // keep, rather than widening the declared `node:fs` surface for one call.
  const rootEntries = readdirSync('.');
  assert.ok(
    !rootEntries.includes('fingerprint.config.js') &&
      !rootEntries.includes('fingerprint.config.ts'),
    'a fingerprint config would redefine the runtime EAS and the store binaries agree on',
  );
  assert.doesNotMatch(body, /ignorePaths/);
});

test('a failing verdict sends the reader to the control before the conclusion', () => {
  // The previous message went straight from a mismatch to "this needs a STORE
  // BUILD", which is how a measurement bug turned into a release decision.
  const failure = script.slice(script.indexOf('THE NATIVE LAYER HAS CHANGED'));
  assert.match(failure, /--verify-control/);
  assert.match(failure, /fix the method, not the app/);
});

test('release-ota still refuses to publish without this gate', () => {
  const ota = readFileSync('scripts/release-ota.mjs', 'utf8');
  assert.match(ota, /run\('npm', \['run', 'check:fingerprint'\]/);
});

test('no fingerprint input has moved since the commit build 38 was built from', () => {
  /**
   * The cheap half of the runtime question, and the half that catches the
   * accident rather than the intent.
   *
   * `@expo/fingerprint` hashes a specific, small set of inputs. A packet that
   * only moves JavaScript around — this one moved 205 files and 22,592 lines —
   * must not touch any of them, because doing so changes the runtime version
   * every shipped binary is keyed to and turns an OTA into a Store build.
   *
   * It is easy to trip by reflex: adding an npm script for a dev helper, or a
   * .gitignore line for a generated symlink, both move the hash. So the input
   * set is compared to `9345eb2` directly instead of trusted.
   *
   * This does not replace the real computation — a dependency's own native
   * content can move without any of these files changing — which is why
   * `--verify-control` exists. It is the fast guard in front of it.
   */
  /**
   * Recorded object ids rather than `git diff <build-38-commit> HEAD`.
   *
   * The diff version was written here first and failed in CI with "fatal: bad
   * object 9345eb2" — `actions/checkout` clones shallow, so the commit build 38
   * was built from is simply not in the CI checkout. Comparing recorded ids
   * needs nothing but HEAD, which every checkout has, and it says the same
   * thing: these are the exact trees and blobs that produced runtime
   * d9cb8c3b… on the binary in the store.
   */
  const AT_BUILD_38: Record<string, string> = {
    'package.json': 'b100309deb0b216591c1caff64405122d0f20d09',
    'package-lock.json': 'b4b6f7ca4cdecc8538c19fadbc627f0cd841790b',
    'app.config.ts': '6d5a05554bdd8a652988699f9bfdc79ee907b15f',
    'eas.json': 'ee59b14e9b048b9121f5dbf39ae8d2052a3641e6',
    '.easignore': '6e70ea0a25678378d28a4f9816b770010d72c8f3',
    '.gitignore': 'f43ce861f415104d72feca1b6475fc5f10fbdb37',
    plugins: 'ce9652504be622efc4ea13d46209a3c6eb478e37',
    modules: 'f3aa0195a79b86ddc347781d88bf2c01c34ccd70',
  };

  const moved: string[] = [];
  for (const [path, expected] of Object.entries(AT_BUILD_38)) {
    const actual = execFileSync('git', ['rev-parse', `HEAD:${path}`], {
      encoding: 'utf8',
    }).trim();
    if (actual !== expected) moved.push(`${path}  ${expected} -> ${actual}`);
  }

  assert.deepEqual(
    moved,
    [],
    `these are native fingerprint inputs and have moved since build 38:\n${moved.join('\n')}\n` +
      'If that is deliberate, the tree needs a Store build, not an OTA, and these\n' +
      'recorded ids should be re-taken at the moment that build is submitted.',
  );
});

// The live one. Opt-in: two `npm ci` installs and two fingerprints.
test(
  'CONTROL: build 38’s commit and HEAD both reproduce the runtime EAS stamped on build 38',
  { skip: process.env.CINCH_FINGERPRINT_CONTROL ? false : 'set CINCH_FINGERPRINT_CONTROL=1' },
  () => {
    const out = execFileSync('node', ['scripts/check-fingerprint.mjs', '--verify-control'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    assert.match(out, /the method reproduces the runtime EAS stamped on build 38/);
    assert.match(out, /HEAD carries that same runtime/);
    const hashes = [...out.matchAll(/\b([0-9a-f]{40})\b/g)].map((m) => m[1]);
    assert.ok(hashes.length >= 3);
    for (const h of hashes) assert.equal(h, BUILD_38_RUNTIME);
  },
);
