/**
 * UX-08 / DE-08 — the feedback hierarchy as a truth table, plus the shared
 * toast's contract.
 *
 * `feedbackSurface` is the rule three lanes have to answer their `Alert.alert`
 * inventory against, which is exactly why it is a pure function and not a
 * paragraph in a design doc: a paragraph gets read three ways. Every row below
 * is a real shape from the audit, so a change to the ordering inside that
 * function has to explain which of these it means to move.
 *
 * The plan is explicit that the inventory is criterion-driven and that
 * "uninventoried safety-critical blocking behaviour remains unchanged", so this
 * file does NOT assert a count of remaining `Alert.alert` call sites. That
 * number is the lanes' to move, and a test that pinned it here would fail on
 * every lane's commit for reasons that have nothing to do with the shared rule.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { feedbackRationale, feedbackSurface } from '../src/components/ui/feedback';

const code = (path: string) =>
  readFileSync(path, 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

// ---------------------------------------------------------------------------
// The rule
// ---------------------------------------------------------------------------

test('only an irreversible act blocks', () => {
  // Delete a garment, delete an account, leave an event for good.
  assert.equal(feedbackSurface({ destructive: true }), 'alert');
  // And it outranks everything, including a choice: "delete, or archive?" is
  // still a destructive decision and still deserves the stop.
  assert.equal(feedbackSurface({ destructive: true, choice: true }), 'alert');
  assert.equal(
    feedbackSurface({ destructive: true, needsRecovery: true, fieldScoped: true }),
    'alert',
  );
});

test('a menu is a sheet, never a modal alert', () => {
  assert.equal(feedbackSurface({ choice: true }), 'sheet');
  // A choice one of whose options is a retry is still a choice.
  assert.equal(feedbackSurface({ choice: true, needsRecovery: true }), 'sheet');
});

test('a message about one field goes to that field', () => {
  // A taken handle, a malformed date. Pulling it into a band across the top
  // makes the reader hunt for which of six inputs is meant.
  assert.equal(feedbackSurface({ fieldScoped: true }), 'inline');
  assert.equal(feedbackSurface({ fieldScoped: true, blocksTask: true }), 'inline');
  assert.equal(feedbackSurface({ fieldScoped: true, needsRecovery: true }), 'inline');
});

test('a recoverable failure of the whole surface goes to the band', () => {
  // "Planning failed", "Offline", "Short closet" — the ten causes NoticeBand was
  // built for, and the shape that keeps a recovery visible and persistent.
  assert.equal(feedbackSurface({ needsRecovery: true }), 'noticeBand');
  assert.equal(feedbackSurface({ blocksTask: true }), 'noticeBand');
});

test('success and low-risk confirmation pass without a tap', () => {
  assert.equal(feedbackSurface({}), 'toast');
  // "Copied", "Saved", "Invite sent". Nothing lost, nothing to decide, nothing
  // to recover — the three conditions, all absent.
});

test('a recovery action is never left on a five-second timer', () => {
  // The refusal that makes this hierarchy safe rather than merely quieter: a
  // failure with a way back can NEVER resolve to `toast`, because a toast is a
  // window the user can lose by looking away.
  const shapes = [
    { needsRecovery: true },
    { needsRecovery: true, blocksTask: true },
    { needsRecovery: true, fieldScoped: true },
    { needsRecovery: true, choice: true },
    { needsRecovery: true, destructive: true },
  ];
  for (const shape of shapes) {
    assert.notEqual(feedbackSurface(shape), 'toast', `${JSON.stringify(shape)} put a recovery on a timer`);
  }
});

test('the function is total — every combination lands somewhere', () => {
  // Five booleans, 32 shapes, no undefined. A classifier with a hole is a
  // classifier that sends the hole's cases back to `Alert.alert`.
  const keys = ['destructive', 'choice', 'blocksTask', 'needsRecovery', 'fieldScoped'] as const;
  const surfaces = new Set<string>();
  for (let mask = 0; mask < 32; mask++) {
    const kase = Object.fromEntries(keys.map((k, i) => [k, Boolean(mask & (1 << i))]));
    const surface = feedbackSurface(kase);
    assert.ok(
      ['alert', 'sheet', 'inline', 'noticeBand', 'toast'].includes(surface),
      `${JSON.stringify(kase)} → ${surface}`,
    );
    // Every classification carries an argument a reviewer can read.
    assert.ok(feedbackRationale(kase).length > 20);
    surfaces.add(surface);
  }
  // And all five surfaces are actually reachable — a branch nothing routes to
  // is a branch that has silently died.
  assert.equal(surfaces.size, 5);
});

// ---------------------------------------------------------------------------
// The shared toast
// ---------------------------------------------------------------------------

test('the undo contract survives the host', () => {
  // `toast.tsx` does not time itself out on purpose: "the 5-second window is a
  // data-layer fact (the mutation actually fires when it closes), so the timer
  // lives with the mutation." The host adds a DEFAULT timer for confirmations
  // that have no such window, and must not quietly take that window away from
  // the ones that do.
  const src = code('src/components/ui/toast-host.tsx');
  assert.match(src, /if \(onAction && duration !== null\) \{/);
  assert.match(src, /throw new Error\(/);
  // The component itself still owns no timer.
  assert.ok(!/setTimeout/.test(code('src/components/ui/toast.tsx')));
});

test('a toast is announced, and queued rather than interrupting', () => {
  // `accessibilityRole="alert"` is the right role but is not reliably spoken on
  // iOS when the element mounts inside an already-rendered tree — and the host
  // is, by design, a tree that has been rendered since launch.
  const src = code('src/components/ui/toast-host.tsx');
  assert.match(src, /AccessibilityInfo\.announceForAccessibilityWithOptions\(message, \{ queue: true \}\)/);
  assert.match(code('src/components/ui/toast.tsx'), /accessibilityRole="alert"/);
});

test('the host is mounted once, at the root', () => {
  const layout = code('src/app/_layout.tsx');
  assert.match(layout, /import \{ ToastHost \} from '@\/components\/ui\/toast-host'/);
  assert.equal([...layout.matchAll(/<ToastHost>/g)].length, 1);
  // Outside the query provider: it is chrome with no data of its own, and a
  // confirmation must not be torn down by the cache purge on sign-out.
  assert.ok(
    layout.indexOf('<ToastHost>') < layout.indexOf('<PersistQueryClientProvider'),
    'the toast host must wrap the query provider, not sit inside it',
  );
});

test('NoticeBand still announces itself politely', () => {
  // The band is where every recoverable failure now lands, so its live region
  // is load-bearing for the whole hierarchy rather than a detail of one screen.
  assert.match(code('src/components/ui/notice-band.tsx'), /accessibilityLiveRegion="polite"/);
});
