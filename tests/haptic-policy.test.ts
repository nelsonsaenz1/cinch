/**
 * UX-07's haptic policy, enforced where it can actually be enforced.
 *
 * The rule is "haptics are limited to committed state changes, selection,
 * success, and destructive confirmation — not routine navigation", and it has
 * two halves. One is checkable and one is not:
 *
 *   · WHICH INTENTS EXIST is a fact about `src/lib/haptics.ts`, and a total
 *     one. If there is no `navigate()` to call, no call site can add a tick to
 *     a push — the policy is enforced by absence, which is the strongest form
 *     available without a renderer.
 *   · WHETHER A GIVEN CALL SITE PICKED THE RIGHT INTENT is a judgement about
 *     what that screen does. No test decides that; a reviewer does.
 *
 * So this file pins the first half hard and does not pretend to the second.
 * What it adds on top is a CENSUS, in the same shape as the low-contrast one in
 * `constitution.test.ts`: every file still importing `expo-haptics` directly is
 * on a frozen list, so the 21 that do today cannot become 22.
 *
 * WHY A CENSUS AND NOT A SWEEP
 *
 * Rewriting 48 call sites across 21 files from one integration session would
 * touch Today, Closet, Explore, Profile and the capture flow — every surface
 * three other lanes are rebuilding in this same program, and every one of those
 * edits would be a conflict returned to the integrator. The shared primitive
 * and the two shared CONTROLS (`Button`, `Chip`, which between them cover the
 * large majority of taps in the app) are converted here; the rest come off the
 * list as their lanes touch them. Same discipline the faint census has used
 * since Wave 3, for the same reason.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';

const code = (path: string) =>
  readFileSync(path, 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const policy = () => code('src/lib/haptics.ts');

// ---------------------------------------------------------------------------
// The intents
// ---------------------------------------------------------------------------

test('the policy exports exactly the six intents the research names', () => {
  // Selection, commit, success, warning, failure, destructive confirmation.
  // `warning` and `failure` are the research's "recoverable error" split — one
  // is "you cannot do that yet", the other is "it did not happen" — and both
  // are named rather than collapsed because UX-08 sends them to different
  // surfaces.
  const src = policy();
  const names = [...src.matchAll(/^ {2}(\w+)\(\) \{$/gm)].map((m) => m[1]);
  assert.deepEqual(names, [
    'selection',
    'commit',
    'success',
    'warning',
    'failure',
    'destructiveConfirm',
  ]);
});

test('there is no navigation intent to reach for', () => {
  // The refusal, enforced by absence. A tab change, a push, a sheet and a
  // scroll all carry their own system feedback; a tick on top is the texture
  // the HIG warns dilutes the ones that mean something.
  const src = policy();
  for (const forbidden of ['navigate', 'open', 'tap', 'scroll', 'dismiss', 'back']) {
    assert.ok(
      !new RegExp(`^ {2}${forbidden}\\(\\) \\{$`, 'm').test(src),
      `lib/haptics gained a "${forbidden}" intent — UX-07 forbids routine navigation haptics`,
    );
  }
});

test('Heavy is spent once, on destructive confirmation, and nowhere else', () => {
  const src = policy();
  const heavy = [...src.matchAll(/ImpactFeedbackStyle\.Heavy/g)];
  assert.equal(heavy.length, 1, 'a second Heavy makes the destructive one ordinary');
  // And the ordinary commit is Light, not the module default of Medium.
  assert.match(src, /commit\(\) \{\s*fire\(\(\) => Haptics\.impactAsync\(Haptics\.ImpactFeedbackStyle\.Light\)\);/);
});

test('every intent is fire-and-forget — none of them returns a promise', () => {
  // A haptic is a garnish on feedback that already exists visually. It no-ops
  // in Low Power Mode, with Taptic off, and during a camera session, and it
  // REJECTS on some of those paths. A call site that could `await` one is a
  // call site where a missing Taptic Engine can block a save.
  const src = policy();
  assert.ok(!/async \w+\(/.test(src), 'an async intent invites `await` on a garnish');
  assert.ok(!/^ {4}return /m.test(src), 'an intent returned a value — they are all void');
  // The single swallow-point, so no intent can forget its own catch.
  assert.match(src, /const fire = \(run: \(\) => Promise<void>\) => \{/);
  assert.match(src, /\.catch\(\(\) => \{\}\)/);
});

// ---------------------------------------------------------------------------
// The census
// ---------------------------------------------------------------------------

/**
 * Files still calling expo-haptics directly. Frozen 2026-08-15 at the UX-01/07
 * integration checkpoint.
 *
 * `Button` and `Chip` came off this list here — they are the two shared
 * controls, and between them they carry most of the app's taps. Everything left
 * belongs to a screen or a feature another lane owns; those come off as their
 * lanes touch them. Delete entries, never add one.
 */
const DIRECT_HAPTICS_DEBT = [
  // The email, code and name screens PAID OFF by redesign 19: all three now
  // fire through `@/lib/haptics`. `sign-in.tsx` stays — the welcome screen is
  // excluded from that redesign by founder order, so nobody touched it.
  'src/app/(auth)/sign-in.tsx',
  // `src/app/(tabs)/index.tsx` PAID OFF by redesign 13: the committed-wear
  // haptic moved into `wear-confirmation-sheet.tsx`, which fires it through
  // this policy module, and Today now has no haptics at all.
  'src/app/capture.tsx',
  'src/app/stylist.tsx',
  'src/app/tour.tsx',
  'src/components/activity/ActivityRow.tsx',
  'src/components/event-outfits/VotePill.tsx',
  'src/components/intake/ColourGrid.tsx',
  'src/components/item/delete-sheet.tsx',
  'src/components/privacy/outlined-accent-button.tsx',
  'src/components/review/review-card.tsx',
  'src/components/today/plate.tsx',
  'src/components/today/reaction-bar.tsx',
  'src/features/closet/use-closet-screen.ts',
];

const sourceFiles = () => {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = `${dir}/${entry}`;
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(ts|tsx)$/.test(entry)) out.push(path);
    }
  };
  walk('src');
  return out;
};

const importsHapticsDirectly = (path: string) =>
  path !== 'src/lib/haptics.ts' && /from ['"]expo-haptics['"]/.test(code(path));

test('no NEW file reaches past the policy to expo-haptics', () => {
  const offenders = sourceFiles()
    .filter(importsHapticsDirectly)
    .filter((f) => !DIRECT_HAPTICS_DEBT.includes(f));
  assert.deepEqual(offenders, [], `import lib/haptics instead:\n${offenders.join('\n')}`);
});

test('the direct-haptics debt list has no stale entries', () => {
  const stale = DIRECT_HAPTICS_DEBT.filter((f) => !importsHapticsDirectly(f));
  assert.deepEqual(stale, [], `converted — delete from DIRECT_HAPTICS_DEBT:\n${stale.join('\n')}`);
});

test('the two shared controls go through the policy', () => {
  // The adoption this checkpoint actually made, pinned so it cannot silently
  // regress to a direct call the next time either file is edited.
  for (const path of ['src/components/ui/button.tsx', 'src/components/ui/chip.tsx']) {
    const src = code(path);
    assert.match(src, /from '@\/lib\/haptics'/, `${path} should import the policy`);
    assert.match(src, /haptics\.selection\(\)/, `${path} should spend the selection intent`);
    assert.ok(!/expo-haptics/.test(src), `${path} still imports expo-haptics directly`);
  }
});
