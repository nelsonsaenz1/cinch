#!/usr/bin/env node
/**
 * Capture the app across three device widths at a chosen Dynamic Type size.
 *
 * Audit item 50. This is the OTHER half of the test scaffolding, kept separate
 * from item 49's component snapshots on purpose: those run in CI with no
 * simulator and no Xcode, this one cannot. Wiring them together would mean
 * either CI failing on a missing simulator or the component tests inheriting a
 * dependency they do not need.
 *
 * WHAT IT DOES AND DOES NOT DO
 *
 * It boots each device, sets the content size, points the dev client at Metro
 * and captures a screenshot per device into a run directory. It does NOT drive
 * navigation — where the app lands is where it shoots. Deep links are the way
 * to reach a specific screen (`--url`), because a scripted tap sequence breaks
 * every time a layout moves and is the reason UI-automation suites get deleted.
 *
 * It does NOT diff. Producing three PNGs side by side is the expensive part;
 * comparing them is a human looking at a folder, or `git diff` once a baseline
 * is committed. A pixel-differ would need a baseline per device per OS version
 * and would go red on every unrelated system font change.
 *
 *   node scripts/screenshot-matrix.mjs                       # AX5, all three
 *   node scripts/screenshot-matrix.mjs --size large          # default type
 *   node scripts/screenshot-matrix.mjs --out shots/before    # name the run
 *   node scripts/screenshot-matrix.mjs --url cinch://plan    # a deep link
 *
 * PREREQUISITE: Metro must already be running (`npx expo start --dev-client`),
 * and each simulator must already have the dev client installed. This script
 * deliberately does not build — a build belongs to whoever changed native code.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const BUNDLE_ID = 'com.nelsonsaenz.cinch';
const METRO = 'http://localhost:8081';

/**
 * Three widths, chosen to bracket the range rather than sample it evenly:
 * the narrowest body the app must survive, the standard, and the widest.
 * A layout that holds at 375 and 440 holds in between.
 */
const DEVICES = [
  { name: 'iPhone 17e', label: 'narrow' },
  { name: 'iPhone 17 Pro', label: 'standard' },
  { name: 'iPhone 17 Pro Max', label: 'wide' },
];

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i === -1 ? fallback : process.argv[i + 1];
};

const size = arg('--size', 'accessibility-extra-extra-extra-large');
const outDir = arg('--out', join('shots', `${size}-${Date.now()}`));
const deepLink = arg('--url', null);

const sh = (args, opts = {}) =>
  execFileSync('xcrun', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });

/** Resolve a device name to a UDID, preferring an existing "Cinch " variant. */
function udidFor(name) {
  const list = sh(['simctl', 'list', 'devices', 'available']);
  // A project-specific clone (e.g. "Cinch iPhone 17 Pro") wins: it is the one
  // with the dev client and a signed-in account on it.
  const rows = list.split('\n').filter((l) => l.includes('('));
  const exact = rows.find((l) => l.trim().startsWith(`Cinch ${name} (`));
  const plain = rows.find((l) => l.trim().startsWith(`${name} (`));
  const row = exact ?? plain;
  if (!row) return null;
  return row.match(/\(([0-9A-F-]{36})\)/)?.[1] ?? null;
}

function ensureBooted(udid) {
  const state = sh(['simctl', 'list', 'devices']).split('\n').find((l) => l.includes(udid)) ?? '';
  if (state.includes('(Booted)')) return;
  sh(['simctl', 'boot', udid]);
  // `bootstatus -b` blocks until the device is actually usable, which is the
  // difference between a screenshot of the app and a screenshot of a black box.
  sh(['simctl', 'bootstatus', udid, '-b']);
}

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

console.log(`content size: ${size}`);
console.log(`output:       ${outDir}\n`);

let captured = 0;
for (const device of DEVICES) {
  const udid = udidFor(device.name);
  if (!udid) {
    console.log(`  ${device.label.padEnd(9)} ${device.name} — not available, skipped`);
    continue;
  }

  try {
    ensureBooted(udid);
    // BEFORE launching. A running app reads the category at mount; setting it
    // after gives a screenshot of the old layout.
    sh(['simctl', 'ui', udid, 'content_size', size]);
    // Not-running is the normal state on a device this script just booted,
    // and `simctl terminate` exits non-zero for it. Swallowed on purpose:
    // failing here would report "could not capture" for a device that was
    // simply idle.
    try {
      sh(['simctl', 'terminate', udid, BUNDLE_ID]);
    } catch {
      /* was not running */
    }

    const target = deepLink ?? `${BUNDLE_ID}://expo-development-client/?url=${encodeURIComponent(METRO)}`;
    sh(['simctl', 'openurl', udid, target]);

    // Metro's first bundle for a cold device is slow; a short sleep beats a
    // flaky poll against a log this script does not own.
    execFileSync('sleep', ['25']);

    const file = join(outDir, `${device.label}-${device.name.replace(/\s+/g, '-')}.png`);
    sh(['simctl', 'io', udid, 'screenshot', '--type=png', file]);
    console.log(`  ${device.label.padEnd(9)} ${device.name} → ${file}`);
    captured += 1;
  } catch (err) {
    // One device failing must not cost the other two. The common causes are a
    // dev client that was never installed and a simulator mid-boot.
    console.log(`  ${device.label.padEnd(9)} ${device.name} — FAILED: ${err.message.split('\n')[0]}`);
  }
}

console.log(`\n${captured}/${DEVICES.length} captured.`);
if (captured < DEVICES.length) {
  console.log('A missing device usually means the dev client is not installed on it:');
  console.log('  npx expo run:ios --device "<name>"');
}
