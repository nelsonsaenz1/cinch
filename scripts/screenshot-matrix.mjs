#!/usr/bin/env node
/**
 * The screen matrix: named screens × three device widths, at a chosen Dynamic
 * Type size, with a baseline to compare against.
 *
 * Audit item 50. Kept separate from item 49's component snapshots on purpose:
 * those run in CI with no Xcode and no simulator, this cannot. Wiring them
 * together would either fail CI on a missing simulator or hand the component
 * tests a dependency they do not need.
 *
 *   node scripts/screenshot-matrix.mjs                 # capture a run
 *   node scripts/screenshot-matrix.mjs --baseline      # capture AS the baseline
 *   node scripts/screenshot-matrix.mjs --diff          # capture, then compare
 *   node scripts/screenshot-matrix.mjs --size large    # a different type size
 *   node scripts/screenshot-matrix.mjs --only truncation
 *
 * ⚠ PREREQUISITE: BLANK THE SUPERWALL KEY BEFORE ANY RUN ⚠
 *
 * `superwall.tsx` sets `testModeBehavior: __DEV__ ? 'always' : 'automatic'`,
 * so every cold launch of a DEV build paints a full-screen "Test Mode Active"
 * sheet over the app. This script photographs that sheet on every device and
 * every screen — and then reports a serene "12 unchanged, 0 changed" while
 * having captured nothing of the app at all. That near-miss is the reason this
 * warning is at the top of the file rather than in a doc.
 *
 * Superwall only mounts when `EXPO_PUBLIC_SUPERWALL_API_KEY_IOS` is set
 * (`PAYWALLS_ENABLED` in superwall.tsx), and `.env.example` ships it blank, so
 * a fresh clone already runs without the sheet. On a machine that sets it — on
 * this one it is in `.env.local`, not `.env` — blank the VALUE, keeping the
 * key, then restart Metro with its cache cleared:
 *
 *     EXPO_PUBLIC_SUPERWALL_API_KEY_IOS=
 *     npx expo start --dev-client -c
 *
 * Passing it empty on the command line is NOT enough: Expo's own dotenv load
 * re-exports the file's value over the inherited one. And `EXPO_PUBLIC_` vars
 * are inlined at bundle time, so a warm Metro cache keeps serving the old
 * value however many times you relaunch the app.
 *
 * Put it back when the run is done. The env files are gitignored, so nothing
 * will warn you that you left the app keyless.
 *
 * VERIFY IT WORKED: `today` and `closet` must have different hashes. Two
 * screens with the same hash means either the sheet is covering both, or a
 * deep link did not navigate — see `collisions()`, which now fails the run
 * rather than leaving that to whoever remembers to look.
 *
 * PREREQUISITE: the dev
 * client installed on each simulator. `--install` copies the app bundle from a
 * device that has it to the ones that do not, which is far quicker than three
 * `expo run:ios` builds and guarantees all three run the SAME binary.
 *
 * WHY NAMED SCREENS AND NOT A TAP SCRIPT
 *
 * Every screen below is reached by a deep link. A scripted tap sequence breaks
 * the moment a layout moves, which is how this kind of harness ends up deleted;
 * a URL keeps working. It also makes the matrix deterministic — the same run
 * produces the same screens in the same order, which is the precondition for
 * diffing at all.
 *
 * WHY THE DIFF IS EXACT-MATCH AND NOT PERCEPTUAL
 *
 * A tolerance threshold is a number someone has to defend, and the honest
 * value depends on the device, the OS version and the screen. Exact bytes need
 * no defending: the run either reproduces the baseline or it does not, and a
 * human looks at the pair when it does not. The failure mode of a perceptual
 * differ — quietly passing a real regression that fell under the threshold —
 * is worse than the failure mode of this one, which is being told to look.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const BUNDLE_ID = 'com.nelsonsaenz.cinch';
const METRO = 'http://localhost:8081';
const BASELINE = join('shots', 'baseline');

/**
 * Three widths, chosen to bracket the range rather than sample it evenly: the
 * narrowest body the app must survive, the standard, and the widest. A layout
 * that holds at both ends holds in between.
 */
const DEVICES = [
  { name: 'iPhone 17e', label: 'narrow' },
  { name: 'iPhone 17 Pro', label: 'standard' },
  { name: 'iPhone 17 Pro Max', label: 'wide' },
];

/**
 * The screens, each with the GROUP it is allowed to look identical to.
 *
 * `group` exists because of a run that produced twelve captures and four
 * distinct screens. `/` and `/closet` both sit behind the auth gate, so on a
 * signed-out simulator they render the same welcome screen — legitimately,
 * and byte for byte. Without somewhere to say that out loud, the harness has
 * two bad options: fail every run on a signed-out machine, or drop the
 * identical-capture check that catches the failures that are NOT legitimate.
 *
 * So it is declared instead. Two captures may share bytes only if they share a
 * group; anything else is the harness photographing one screen twice, and
 * fails the run. `gate` collapsing to one screen is therefore expected and
 * reported, while a fixture colliding with anything is still an error.
 *
 * The fixtures are the part a baseline can actually hold still: no account, no
 * production data, no live weather, and the same bytes on any machine. The
 * gate screens are captured for the record and for whoever is looking at the
 * pair by eye, not because their bytes mean much.
 *
 * Three slashes, always. `cinch://dev-controls` parses "dev-controls" as the
 * HOST and expo-router never sees a path, so the app stays wherever it was.
 */
const SCREENS = [
  // `diffable: false` is the other half of the same admission. On a signed-out
  // simulator these two are the welcome screen; on a signed-in one they are
  // live closet data and a Today that prints the date, the weather and a
  // freshly computed outfit. Their bytes are SUPPOSED to move. Counting that
  // as a regression would paint the run red on every honest day, and a harness
  // that cries wolf gets ignored exactly when it is right.
  //
  // They are still captured, still named, still hashed and still reported —
  // just under a heading that says what they are, and out of the verdict.
  { id: 'today', url: 'cinch:///', group: 'gate', diffable: false },
  { id: 'closet', url: 'cinch:///closet', group: 'gate', diffable: false },
  { id: 'truncation', url: 'cinch:///dev-truncation', group: 'truncation' },
  { id: 'controls', url: 'cinch:///dev-controls', group: 'controls' },
];

const argv = process.argv;
const arg = (flag, fallback) => {
  const i = argv.indexOf(flag);
  return i === -1 ? fallback : argv[i + 1];
};
const has = (flag) => argv.includes(flag);

const size = arg('--size', 'accessibility-extra-extra-extra-large');
const only = arg('--only', null);
const asBaseline = has('--baseline');
const wantDiff = has('--diff');
const outDir = asBaseline ? BASELINE : arg('--out', join('shots', 'run'));

const sh = (args, opts = {}) =>
  execFileSync('xcrun', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });

function udidFor(name) {
  const rows = sh(['simctl', 'list', 'devices', 'available']).split('\n').filter((l) => l.includes('('));
  // A project-specific clone ("Cinch iPhone 17 Pro") wins — it is the one with
  // a signed-in account on it.
  const row =
    rows.find((l) => l.trim().startsWith(`Cinch ${name} (`)) ??
    rows.find((l) => l.trim().startsWith(`${name} (`));
  return row?.match(/\(([0-9A-F-]{36})\)/)?.[1] ?? null;
}

function ensureBooted(udid) {
  const line = sh(['simctl', 'list', 'devices']).split('\n').find((l) => l.includes(udid)) ?? '';
  if (line.includes('(Booted)')) return;
  sh(['simctl', 'boot', udid]);
  // Blocks until usable — the difference between a screenshot of the app and
  // a screenshot of a black box.
  sh(['simctl', 'bootstatus', udid, '-b']);
}

/** Copy the installed app from a device that has it to one that does not. */
function installFrom(sourceUdid, targetUdid) {
  const app = sh(['simctl', 'get_app_container', sourceUdid, BUNDLE_ID, 'app']).trim();
  sh(['simctl', 'install', targetUdid, app]);
}

/**
 * Pre-approve our own URL scheme.
 *
 * A simulator that has never been asked shows a modal "Open in Cinch?" the
 * first time `simctl openurl` uses a custom scheme, and `openurl` then BLOCKS
 * until somebody taps it. Nothing here can tap: the run stalls, times out, and
 * every screen after it photographs the same alert — which is precisely how
 * this harness once produced twelve confident, identical captures.
 *
 * Tapping Open writes these two keys and the prompt never returns, so writing
 * them directly is the same approval by a route a script can take. Both forms
 * are needed: the bare scheme for `cinch:///…` and the bundle id for the
 * `com.nelsonsaenz.cinch://expo-development-client/…` launch link.
 *
 * Cheap and idempotent, so it runs on every device on every run rather than
 * waiting to be remembered after the next stall.
 */
function approveScheme(udid) {
  for (const from of ['cinch', BUNDLE_ID]) {
    sh([
      'simctl',
      'spawn',
      udid,
      'defaults',
      'write',
      'com.apple.launchservices.schemeapproval',
      `com.apple.CoreSimulator.CoreSimulatorBridge-->${from}`,
      '-string',
      BUNDLE_ID,
    ]);
  }
}

/**
 * Tell expo-dev-client its onboarding has been seen.
 *
 * On a fresh install the dev client raises a "This is the developer menu"
 * sheet over the app. It is the same sheet on every route, so a run captures
 * one screen as many times as there are screens — the second way this harness
 * has produced a set of confident, identical PNGs.
 *
 * This is the flag the sheet's own dismiss button sets, so setting it here is
 * the same act, minus the tap this script cannot perform.
 */
function finishDevMenuOnboarding(udid) {
  sh([
    'simctl',
    'spawn',
    udid,
    'defaults',
    'write',
    BUNDLE_ID,
    'EXDevMenuIsOnboardingFinished',
    '-bool',
    'YES',
  ]);
}

if (has('--install')) {
  const source = DEVICES.map((d) => udidFor(d.name)).find((u) => {
    if (!u) return false;
    try {
      sh(['simctl', 'get_app_container', u, BUNDLE_ID, 'app']);
      return true;
    } catch {
      return false;
    }
  });
  if (!source) {
    console.log('No simulator has the dev client. Build it once: npx expo run:ios');
    process.exit(1);
  }
  for (const d of DEVICES) {
    const u = udidFor(d.name);
    if (!u || u === source) continue;
    ensureBooted(u);
    installFrom(source, u);
    console.log(`installed on ${d.name}`);
  }
  console.log('All three now run the same binary.');
  process.exit(0);
}

const screens = only ? SCREENS.filter((s) => s.id === only) : SCREENS;
if (!screens.length) {
  console.log(`No screen named "${only}". Known: ${SCREENS.map((s) => s.id).join(', ')}`);
  process.exit(1);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

console.log(`content size : ${size}`);
console.log(`screens      : ${screens.map((s) => s.id).join(', ')}`);
console.log(`output       : ${outDir}${asBaseline ? '   (this run IS the baseline)' : ''}\n`);

/**
 * Make Metro build the bundle before the first device asks for it.
 *
 * Without this, a run started straight after a source edit races the rebuild:
 * the first device gets the old bundle and the later ones get the new one, so
 * the run captures two different versions of the app and calls it a matrix.
 * That is how a freshly written baseline came back CHANGED against a capture
 * of the identical source — the baseline was the stale half.
 *
 * Requesting the bundle over HTTP blocks until Metro has finished building it,
 * which is exactly the wait needed. Failures here are not fatal: this only
 * removes a race, and a run against a Metro that is already warm is fine.
 */
function warmMetro() {
  // The app's real entry. `/index.bundle` is the bare-React-Native path and
  // 404s on an expo-router project — which it did here, silently, while the
  // line below cheerfully printed a number nobody read.
  const url = `${METRO}/node_modules/expo-router/entry.bundle?platform=ios&dev=true`;
  try {
    const code = execFileSync('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', url], {
      encoding: 'utf8',
      timeout: 300_000,
    }).trim();
    if (code === '200') {
      console.log('metro        : bundle ready');
    } else {
      // Loud, because a warm-up that quietly does nothing is worse than none:
      // it buys the confidence without the wait.
      console.log(`metro        : HTTP ${code} — NOT warmed, captures may race a rebuild`);
    }
  } catch {
    console.log('metro        : could not reach it — captures may race a rebuild');
  }
}

warmMetro();

let captured = 0;
for (const device of DEVICES) {
  const udid = udidFor(device.name);
  if (!udid) {
    console.log(`  ${device.label.padEnd(9)} ${device.name} — not available, skipped`);
    continue;
  }

  try {
    ensureBooted(udid);
    approveScheme(udid);
    finishDevMenuOnboarding(udid);
    // BEFORE launching. An app reads the category at mount, so setting it
    // afterwards photographs the old layout.
    sh(['simctl', 'ui', udid, 'content_size', size]);
    // Freeze the status bar, or nothing is comparable: the clock advances
    // between runs and every byte-identical screen reads as CHANGED. This is
    // what makes the matrix deterministic rather than merely repeatable. 9:41
    // is Apple's own convention for the same reason.
    sh([
      'simctl',
      'status_bar',
      udid,
      'override',
      '--time',
      '9:41',
      '--batteryState',
      'charged',
      '--batteryLevel',
      '100',
      '--wifiMode',
      'active',
      '--wifiBars',
      '3',
      '--cellularMode',
      'active',
      '--cellularBars',
      '4',
      '--dataNetwork',
      'wifi',
    ]);
    try {
      sh(['simctl', 'terminate', udid, BUNDLE_ID]);
    } catch {
      /* not running is the normal state on a device just booted */
    }

    sh([
      'simctl',
      'openurl',
      udid,
      `${BUNDLE_ID}://expo-development-client/?url=${encodeURIComponent(METRO)}`,
    ]);
    execFileSync('sleep', ['26']); // cold bundle

    for (const screen of screens) {
      sh(['simctl', 'openurl', udid, screen.url]);
      execFileSync('sleep', ['5']);
      const file = join(outDir, `${screen.id}--${device.label}.png`);
      sh(['simctl', 'io', udid, 'screenshot', '--type=png', file]);
      console.log(`  ${screen.id.padEnd(11)} ${device.label.padEnd(9)} → ${basename(file)}`);
      captured += 1;
    }
  } catch (err) {
    // One device failing must not cost the other two.
    console.log(`  ${device.label.padEnd(9)} ${device.name} — FAILED: ${err.message.split('\n')[0]}`);
  }
}

console.log(`\n${captured}/${DEVICES.length * screens.length} captured.`);

const digest = (p) => createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 12);

/** The day the simulator thinks it is. Today's header prints it. */
const simDay = () => new Date().toDateString();
const META = 'matrix.json';

/**
 * Two captures with identical bytes are one screen photographed twice — unless
 * they were declared to share a `group`. The undeclared kind is how the Test
 * Mode sheet, the dev-menu onboarding and a two-slash deep link each produced
 * a full set of confident, identical PNGs. All three were found by hand; this
 * runs on every capture so the fourth one is not.
 *
 * Compared WITHIN a device: the same screen at two widths is legitimately
 * different, and two devices sharing a width would legitimately match.
 */
const groupOf = (name) => SCREENS.find((s) => s.id === name.split('--')[0])?.group;

function collisions(dir) {
  const seen = new Map();
  const expected = [];
  const clashes = [];
  for (const name of readdirSync(dir)
    .filter((n) => n.endsWith('.png'))
    .sort()) {
    const key = `${name.split('--')[1]}:${digest(join(dir, name))}`;
    const twin = seen.get(key);
    if (!twin) seen.set(key, name);
    else if (groupOf(twin) === groupOf(name)) expected.push(`${twin} == ${name}`);
    else clashes.push(`${twin} == ${name}`);
  }
  return { expected, clashes };
}

const { expected, clashes } = captured
  ? collisions(outDir)
  : { expected: [], clashes: [] };

if (expected.length) {
  console.log('\nidentical, and declared so (same group — the auth gate collapses when signed out):');
  for (const e of expected) console.log(`  ${e}`);
}
if (clashes.length) {
  console.log('\nIDENTICAL CAPTURES — that is not two screens, it is one, twice:');
  for (const c of clashes) console.log(`  ${c}`);
  console.log('Blank EXPO_PUBLIC_SUPERWALL_API_KEY_IOS and restart Metro with -c, or');
  console.log('check the deep link — `cinch://plan` parses "plan" as the HOST.');
  process.exit(1);
}

if (asBaseline) {
  writeFileSync(
    join(BASELINE, META),
    `${JSON.stringify({ day: simDay(), size, screens: screens.map((s) => s.id) }, null, 2)}\n`,
  );
  console.log(`Baseline written to ${BASELINE}. shots/ is gitignored: this baseline is local.`);
  process.exit(0);
}

if (wantDiff) {
  if (!existsSync(BASELINE)) {
    console.log(`\nNo baseline at ${BASELINE}. Create one: --baseline`);
    process.exit(1);
  }

  // Today's header prints the date, so a baseline from another day differs for
  // a reason that is not a regression. Saying so before the table is the
  // difference between a harness people trust and one they learn to ignore.
  const meta = existsSync(join(BASELINE, META))
    ? JSON.parse(readFileSync(join(BASELINE, META), 'utf8'))
    : null;
  if (meta && meta.day !== simDay()) {
    console.log(`\n⚠ baseline captured ${meta.day}; today is ${simDay()}.`);
    console.log("  Today's header prints the date, so it WILL differ. Re-baseline first.");
  }
  if (meta && meta.size !== size) {
    console.log(`\n⚠ baseline is ${meta.size}, this run is ${size}. Nothing will match.`);
  }

  const isDiffable = (name) =>
    SCREENS.find((s) => s.id === name.split('--')[0])?.diffable !== false;
  const names = readdirSync(outDir)
    .filter((n) => n.endsWith('.png'))
    .sort();
  let changed = 0;
  let missing = 0;

  const compare = (name) => {
    const b = join(BASELINE, name);
    if (!existsSync(b)) return 'NEW';
    return digest(b) === digest(join(outDir, name)) ? 'same' : 'CHANGED';
  };

  console.log('\ndiff against baseline');
  for (const name of names.filter(isDiffable)) {
    const verdict = compare(name);
    console.log(`  ${verdict.padEnd(8)} ${name}`);
    if (verdict === 'CHANGED') changed += 1;
    if (verdict === 'NEW') missing += 1;
  }

  const informational = names.filter((n) => !isDiffable(n));
  if (informational.length) {
    console.log('\nnot diffable — live data by design, reported but not counted:');
    for (const name of informational) console.log(`  ${compare(name).padEnd(8)} ${name}`);
  }

  const judged = names.length - informational.length;
  console.log(`\n${judged - changed - missing} unchanged, ${changed} changed, ${missing} new.`);
  if (changed) {
    console.log(`Compare by eye: open ${BASELINE}/<name> and ${outDir}/<name>`);
    console.log('If the change is intended, re-baseline: --baseline');
  }
  process.exit(changed || missing ? 1 : 0);
}

if (captured < DEVICES.length * screens.length) {
  console.log('A missing device usually means the dev client is not installed:');
  console.log('  node scripts/screenshot-matrix.mjs --install');
}
