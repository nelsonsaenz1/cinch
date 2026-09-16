import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

/**
 * Ledger A84 (2026-09-16) — the Reveal's ask reports its own close.
 *
 * `fb473c32`'s `reveal_complete` on build 49 carried no `paywall_dismissed`
 * while three other placements did the same night. Mechanism: a non-gated
 * close resolves `registerPlacement` FIRST; the Reveal's exit awaits the gate
 * and replaces to Today on that tick; `usePlacement` subscribes `onDismiss`
 * per hook instance from an effect, so the unmount cancels it and the
 * dismissal reaches nobody. The gate now HOLDS a feature-settled presentation
 * that drew until its `onDismiss` is read, or DISMISS_HOLD_MS — and these pin
 * the wiring, since the SDK cannot run under node.
 */
const GATE = readFileSync('src/features/billing/use-gate.ts', 'utf8');
const REVEAL = readFileSync('src/app/reveal.tsx', 'utf8');

test('a feature-settled presentation that drew is held for its own onDismiss', () => {
  assert.match(GATE, /const DISMISS_HOLD_MS = 1_500;/);
  const hold = GATE.indexOf("if (outcome === 'granted' && reason === 'feature' && shown === target) {");
  assert.ok(hold !== -1, 'the hold condition is exactly feature + drew + close unread');
  const block = GATE.slice(hold, hold + 900);
  assert.match(block, /target\.release = finish;/);
  assert.match(block, /target\.releaseTimer = setTimeout\(finish, DISMISS_HOLD_MS\);/);
  assert.match(block, /return;/);
  // Held AFTER `inFlight` is cleared, so the hold never blocks the next ask.
  const settleStart = GATE.indexOf('const settle = useCallback(');
  const cleared = GATE.indexOf('inFlight = null;', settleStart);
  assert.ok(settleStart !== -1 && cleared !== -1 && cleared < hold, 'inFlight is cleared before the hold');
  // The release is idempotent: the timer and onDismiss can both call it.
  assert.match(block, /const finish = \(\) => \{\s*if \(!target\.release\) return;/);
});

test('onDismiss reads the result first and releases the hold after', () => {
  const onDismiss = GATE.indexOf('onDismiss: (_info, result)');
  assert.ok(onDismiss !== -1);
  const body = GATE.slice(onDismiss, GATE.indexOf('onSkip:', onDismiss));
  const held = body.indexOf('const held = target.release;');
  const emit = body.indexOf("track('paywall_dismissed'");
  const release = body.indexOf('if (held) held();');
  const arm = body.indexOf('arm(target, GRANT_GRACE_MS');
  assert.ok(held !== -1 && emit !== -1 && release !== -1 && arm !== -1);
  assert.ok(held < emit && emit < release && release < arm, 'read, emit, release, then arm');
});

test('a held purchase writes its receipt one tick after the caller resumes', () => {
  // The caller resumes on the microtask queue; a caller that replaces its
  // route on resolution (the Reveal → Today) would otherwise replace the
  // thanks screen. The push waits one macrotask and lands on top.
  assert.match(GATE, /if \(held\) setTimeout\(\(\) => reportConversion\(target\), 0\);\s*else reportConversion\(target\);/);
});

test('every presentation starts with nothing held', () => {
  assert.match(GATE, /presentedAt: null,\s*release: null,\s*releaseTimer: null,\s*\};/);
});

test('the Reveal still awaits the gate on one path and replaces after', () => {
  // Nothing here changed in reveal.tsx by design — the hold is the gate's.
  const present = REVEAL.indexOf('await presentPromo(gate, Placement.RevealComplete');
  const replace = REVEAL.indexOf("router.replace('/(tabs)')", present);
  assert.ok(present !== -1 && replace !== -1 && replace > present);
});
