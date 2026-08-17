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
 * The screens. Every one is a `__DEV__` fixture route, every one is diffed, and
 * every one must be distinct from its neighbours on the same device.
 *
 * `today` and `closet` used to point at the real `cinch:///` and
 * `cinch:///closet`. Both sit behind the auth gate, so on a signed-out
 * simulator they render the same welcome screen: a run produced twelve
 * captures of three actual screens and the harness had been taught to call
 * that expected. The fixtures are two genuinely different screens, and they
 * are the part a baseline can hold still — no account, no production data, no
 * live weather, the same bytes on any machine.
 *
 * The ids are deliberately unchanged. Artifact filenames stay
 * `today--narrow.png` and `closet--wide.png` across this rework, so a baseline
 * comparison and a reviewer's bookmarks both keep working.
 *
 * Three slashes, always. `cinch://dev-controls` parses "dev-controls" as the
 * HOST and expo-router never sees a path, so the app stays wherever it was.
 */
/**
 * REAL ROUTES, NOT FIXTURES — AND WHY THIS LIST CHANGED.
 *
 * This matrix used to deep-link to `dev-today`, `dev-closet`, `dev-truncation`
 * and `dev-controls`. `9a92767` ("Take the 205 design fixtures out of the
 * router") moved every `dev-*` screen to `src/dev-fixtures/`, outside the
 * router root, so no route is generated for them any more and all four links
 * navigated nowhere. The run did not error — it captured whatever the app was
 * already showing, four times — and `collisions()` then failed it for four
 * identical hashes. That is why no release PNGs or manifest have been produced
 * since the fixture move; the harness broke silently and stayed broken.
 *
 * Pointing it back at the fixtures is not available: `_layout.tsx:162` bounces
 * `dev-*` in release builds on purpose, and `tests/dev-route-exclusion.test.ts`
 * fails if one compiles into the bundle. So the matrix now shoots the shipping
 * screens.
 *
 * THE COST OF THAT, STATED PLAINLY: fixtures were deterministic and these are
 * not. A real screen renders the signed-in account's own data, so the exact-byte
 * diff only means something when the run and the baseline came from the SAME
 * simulator with the SAME account and no data changed between them — which is
 * what the "Cinch iPhone 17 Pro" clone in `udidFor()` is for. Re-baseline
 * (`--baseline`) after any deliberate content change, or the diff reports the
 * data moving rather than the layout.
 *
 * Ordered so the four tabs come first, then the surfaces added in the last two
 * days — Private Circles (`groups`) had no coverage here at all.
 */
const SCREENS = [
  { id: 'today', url: 'cinch:///(tabs)' },
  { id: 'closet', url: 'cinch:///(tabs)/closet' },
  { id: 'explore', url: 'cinch:///(tabs)/explore' },
  { id: 'plan', url: 'cinch:///(tabs)/plan' },
  { id: 'groups', url: 'cinch:///groups' },
  { id: 'activity', url: 'cinch:///activity' },
  { id: 'settings', url: 'cinch:///settings' },
  { id: 'visibility', url: 'cinch:///privacy/visibility' },
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

/**
 * Take away the dev client's floating gear.
 *
 * expo-dev-menu paints a draggable circular button in its own always-on-top
 * window. It is not part of the app, but it IS part of the PNG, and at
 * accessibility-extra-extra-extra-large the text it lands on has nowhere left
 * to reflow — the gear sits on top of the copy this matrix exists to check.
 * A screenshot of an overlapped paragraph proves nothing about the layout.
 *
 * `EXDevMenuShowFloatingActionButton` is the key the library's own toggle
 * writes (node_modules/expo-dev-menu/ios/Modules/DevMenuPreferences.swift:9);
 * `showFloatingActionButton` reads it straight back out of UserDefaults, and
 * the Info.plist value is only a REGISTERED default, so an explicit write in
 * the app domain wins.
 *
 * Must land before the launch below. Visibility is recomputed on app events —
 * RCTContentDidAppear and menu show/hide — not on a defaults change, so a
 * write to a running app leaves the gear on screen for the whole run. The
 * capture loop terminates the app and relaunches it after this, which is what
 * makes the flag take.
 *
 * Cheap and idempotent, so every device every run.
 */
function hideDevMenuFloatingButton(udid) {
  sh([
    'simctl',
    'spawn',
    udid,
    'defaults',
    'write',
    BUNDLE_ID,
    'EXDevMenuShowFloatingActionButton',
    '-bool',
    'NO',
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
    hideDevMenuFloatingButton(udid);
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
 * Two captures with identical bytes are one screen photographed twice. No
 * exemptions: this check once carried an allowance for screens declared to be
 * legitimately identical, and the allowance is exactly what let a pair of
 * auth-gated routes photograph the welcome screen twice and pass.
 *
 * `today` and `closet` MUST differ at every width. They are the pair that
 * collided, they are the reason this rework happened, and they are now two
 * distinct fixture routes with nothing left to excuse them.
 *
 * The same shape of failure has arrived four ways — the Test Mode sheet, the
 * dev-menu onboarding, a two-slash deep link, and the auth gate — each
 * producing a full set of confident, identical PNGs. All four were found by
 * hand; this runs on every capture so the fifth is not.
 *
 * Compared WITHIN a device: the same screen at two widths is legitimately
 * different, and two devices sharing a width would legitimately match.
 */
function collisions(dir) {
  const seen = new Map();
  const clashes = [];
  for (const name of readdirSync(dir)
    .filter((n) => n.endsWith('.png'))
    .sort()) {
    const key = `${name.split('--')[1]}:${digest(join(dir, name))}`;
    const twin = seen.get(key);
    if (twin) clashes.push(`${twin} == ${name}`);
    else seen.set(key, name);
  }
  return clashes;
}

const clashes = captured ? collisions(outDir) : [];

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

  // The stamp is kept, but it no longer excuses anything: the fixtures pin
  // their own weather and copy and print no date, so an older baseline is not
  // a reason for a diff. If the day moved AND bytes moved, that is a change in
  // the app, not a change in the calendar — say so rather than letting the next
  // reader reach for the old excuse.
  const meta = existsSync(join(BASELINE, META))
    ? JSON.parse(readFileSync(join(BASELINE, META), 'utf8'))
    : null;
  if (meta && meta.day !== simDay()) {
    console.log(`\n⚠ baseline captured ${meta.day}; today is ${simDay()}.`);
    console.log('  The fixtures do not print the date, so age alone does NOT explain a diff.');
  }
  if (meta && meta.size !== size) {
    console.log(`\n⚠ baseline is ${meta.size}, this run is ${size}. Nothing will match.`);
  }

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

  // Every capture is judged. The fixtures hold still by construction, so there
  // is no longer a screen whose bytes are allowed to wander out of the verdict.
  console.log('\ndiff against baseline');
  for (const name of names) {
    const verdict = compare(name);
    console.log(`  ${verdict.padEnd(8)} ${name}`);
    if (verdict === 'CHANGED') changed += 1;
    if (verdict === 'NEW') missing += 1;
  }

  console.log(`\n${names.length - changed - missing} unchanged, ${changed} changed, ${missing} new.`);
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
