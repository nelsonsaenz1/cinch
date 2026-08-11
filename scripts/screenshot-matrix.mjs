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
 * ⚠ PREREQUISITE THAT IS NOT YET SATISFIED ON THIS MACHINE ⚠
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
 * a fresh clone already runs without the sheet. On a machine whose `.env` sets
 * it, the variable must be blanked for a matrix run — and passing it on the
 * command line is NOT enough, because Expo's own dotenv load re-exports the
 * `.env` value over it. It has to be blank in `.env` itself.
 *
 * That is a change to a developer's local environment, so this script does not
 * make it. Until it is made, treat any run as unverified: check one capture by
 * eye before trusting a diff.
 *
 * VERIFY IT WORKED: `today` and `closet` must have different hashes. Two
 * screens with the same hash means either the sheet is covering both, or a
 * deep link did not navigate.
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
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
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
 * The screens. Each is reachable by deep link and renders without a populated
 * account, which is what makes the matrix reproducible on any machine.
 */
const SCREENS = [
  // Three slashes. `cinch://plan` parses "plan" as the HOST and expo-router
  // never sees a path, so the app stays wherever it was — which is how a run
  // silently captures the same screen twice. Caught by two screenshots having
  // identical hashes.
  { id: 'today', url: 'cinch:///' },
  { id: 'truncation', url: 'cinch:///dev-truncation' },
  { id: 'closet', url: 'cinch:///closet' },
  { id: 'plan', url: 'cinch:///plan' },
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

let captured = 0;
for (const device of DEVICES) {
  const udid = udidFor(device.name);
  if (!udid) {
    console.log(`  ${device.label.padEnd(9)} ${device.name} — not available, skipped`);
    continue;
  }

  try {
    ensureBooted(udid);
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

if (asBaseline) {
  console.log(`Baseline written to ${BASELINE}. Commit it only if you mean to.`);
  process.exit(0);
}

if (wantDiff) {
  if (!existsSync(BASELINE)) {
    console.log(`\nNo baseline at ${BASELINE}. Create one: --baseline`);
    process.exit(1);
  }
  const digest = (p) => createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 12);
  const names = readdirSync(outDir).filter((n) => n.endsWith('.png')).sort();
  let changed = 0;
  let missing = 0;

  console.log('\ndiff against baseline');
  for (const name of names) {
    const b = join(BASELINE, name);
    if (!existsSync(b)) {
      console.log(`  NEW      ${name}`);
      missing += 1;
      continue;
    }
    const same = digest(b) === digest(join(outDir, name));
    console.log(`  ${same ? 'same    ' : 'CHANGED '} ${name}`);
    if (!same) changed += 1;
  }

  console.log(
    `\n${names.length - changed - missing} unchanged, ${changed} changed, ${missing} new.`,
  );
  if (changed) {
    console.log(`Compare by eye: open ${BASELINE}/<name> and ${outDir}/<name>`);
    console.log('If the change is intended, re-baseline: --baseline');
  }
  process.exit(changed ? 1 : 0);
}

if (captured < DEVICES.length * screens.length) {
  console.log('A missing device usually means the dev client is not installed:');
  console.log('  node scripts/screenshot-matrix.mjs --install');
}
