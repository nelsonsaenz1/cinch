import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  DONE_KEY,
  DWELL_MS,
  PAYWALL_DISMISSED_KEY,
  PAYWALL_PRESENTED_KEY,
  PAYWALL_SETTLE_MS,
  PAYWALL_STALE_MS,
  PENDING_MOMENT_KEY,
  REVIEW_MOMENTS,
  WRITE_REVIEW_URL,
  consumeMoment,
  markDone,
  momentRecordedKey,
  paywallInTheWay,
  pendingMoment,
  promptEligible,
  recordMoment,
  reviewCardDue,
  settledIn,
  stampPaywallDismissed,
  stampPaywallPresented,
  type ReviewPromptIo,
} from '../src/features/rating/review-prompt-core';
import { TOUCHPOINT_KEY, touchpointStamp } from '../src/features/rating/rating-touchpoint-core';

/**
 * The review ask fires at a MOMENT — the tenth garment, the Reveal — and
 * not on a timer (ledger A50, 2026-09-06). Six shown, six "later", the
 * rating count parked at six for ten days: that was the timer. These tests
 * execute the whole rule and pin the three call sites that arm it.
 */

const NOW = new Date('2026-09-07T12:00:00.000Z');

function memIo(seed: Record<string, string> = {}): ReviewPromptIo & { store: Map<string, string> } {
  const store = new Map(Object.entries(seed));
  return {
    store,
    read: (k) => store.get(k) ?? null,
    write: (k, v) => void store.set(k, v),
  };
}

test('nothing is asked until a moment has happened', () => {
  const io = memIo();
  assert.equal(promptEligible(io), false);
  assert.equal(pendingMoment(io), null);
  assert.equal(recordMoment(io, 'ten'), true);
  assert.equal(pendingMoment(io), 'ten');
  assert.equal(promptEligible(io), true);
});

test('a moment arms the card once, ever — the observers re-run and must be free', () => {
  const io = memIo();
  assert.equal(recordMoment(io, 'ten'), true);
  consumeMoment(io);
  // Today's `closet_ready` effect runs on every visit past the floor.
  assert.equal(recordMoment(io, 'ten'), false);
  assert.equal(pendingMoment(io), null);
  assert.equal(io.store.get(momentRecordedKey('ten')), 'true');
});

test('the Reveal a minute after the Ten supersedes it — one card, the better beat', () => {
  const io = memIo();
  recordMoment(io, 'ten');
  assert.equal(recordMoment(io, 'reveal'), true);
  assert.equal(pendingMoment(io), 'reveal');
});

test('"not now" spends THAT moment; the next one asks again; two asks is the ceiling', () => {
  const io = memIo();
  recordMoment(io, 'ten');
  consumeMoment(io);
  assert.equal(promptEligible(io), false);
  recordMoment(io, 'reveal');
  assert.equal(promptEligible(io), true);
  consumeMoment(io);
  assert.equal(promptEligible(io), false);
  // Neither can arm it again.
  assert.equal(recordMoment(io, 'ten'), false);
  assert.equal(recordMoment(io, 'reveal'), false);
  assert.equal(REVIEW_MOMENTS.length, 2);
});

test('rate or already-rated ends the ask permanently, and a later moment stays silent', () => {
  const io = memIo();
  recordMoment(io, 'ten');
  markDone(io);
  assert.equal(io.store.get(DONE_KEY), 'true');
  assert.equal(promptEligible(io), false);
  assert.equal(recordMoment(io, 'reveal'), false);
  assert.equal(pendingMoment(io), null);
});

test('a garbled pending value reads as no moment', () => {
  const io = memIo({ [PENDING_MOMENT_KEY]: 'launch' });
  assert.equal(pendingMoment(io), null);
  assert.equal(promptEligible(io), false);
});

test('the settle is a short dwell on the tab root, no page-move clock', () => {
  assert.equal(DWELL_MS, 5_000);
  assert.equal(settledIn(0), false);
  assert.equal(settledIn(DWELL_MS - 1), false);
  assert.equal(settledIn(DWELL_MS), true);
});

test('never over a paywall: open, just closed, stale, clear', () => {
  const io = memIo();
  assert.equal(paywallInTheWay(NOW, io), false);
  // Presented, never dismissed: in the way.
  stampPaywallPresented(new Date(NOW.getTime() - 10_000), io);
  assert.equal(paywallInTheWay(NOW, io), true);
  // Dismissed a second ago: still in the way, the sheet is sliding down.
  stampPaywallDismissed(new Date(NOW.getTime() - 1_000), io);
  assert.equal(paywallInTheWay(NOW, io), true);
  // Dismissed past the settle: clear.
  stampPaywallDismissed(new Date(NOW.getTime() - PAYWALL_SETTLE_MS), io);
  assert.equal(paywallInTheWay(NOW, io), false);
  // A presentation newer than the dismissal is a new sheet.
  stampPaywallPresented(new Date(NOW.getTime() - 500), io);
  assert.equal(paywallInTheWay(NOW, io), true);
  // …unless it is older than the stale ceiling with no dismissal after it:
  // a process killed mid-sheet must not gag the ask forever.
  const io2 = memIo({ [PAYWALL_PRESENTED_KEY]: new Date(NOW.getTime() - PAYWALL_STALE_MS).toISOString() });
  assert.equal(paywallInTheWay(NOW, io2), false);
  const io3 = memIo({ [PAYWALL_PRESENTED_KEY]: 'garbage', [PAYWALL_DISMISSED_KEY]: 'garbage' });
  assert.equal(paywallInTheWay(NOW, io3), false);
});

test('the one verdict: every "no" is a wait, and only the pending moment is a "yes"', () => {
  const io = memIo();
  const base = { now: NOW, onTabRoot: true, dwelledMs: DWELL_MS, io };
  assert.equal(reviewCardDue(base), null, 'no moment');
  recordMoment(io, 'reveal');
  assert.equal(reviewCardDue(base), 'reveal');
  assert.equal(reviewCardDue({ ...base, onTabRoot: false }), null, 'off a tab root');
  assert.equal(reviewCardDue({ ...base, dwelledMs: 100 }), null, 'not settled');
  stampPaywallPresented(NOW, io);
  assert.equal(reviewCardDue(base), null, 'a sheet is up');
  stampPaywallDismissed(new Date(NOW.getTime() + PAYWALL_SETTLE_MS), io);
  const later = new Date(NOW.getTime() + PAYWALL_SETTLE_MS * 2);
  assert.equal(reviewCardDue({ ...base, now: later }), 'reveal', 'the sheet has gone');
  io.write(TOUCHPOINT_KEY, touchpointStamp(later));
  assert.equal(reviewCardDue({ ...base, now: later }), null, 'another rating surface just fired');
  // None of those waits spent the moment.
  assert.equal(pendingMoment(io), 'reveal');
});

test('the review URL is the store’s composer, not the listing', () => {
  assert.match(WRITE_REVIEW_URL, /^https:\/\/apps\.apple\.com\/app\/id6798479578\?action=write-review$/);
});

// ---------------------------------------------------------------------------
// The wiring — the moments are armed where the beats happen, and nowhere else
// ---------------------------------------------------------------------------

const read = (p: string) => readFileSync(p, 'utf8');

test('the Ten and Today arm `ten` beside their closet_ready observers; the Reveal arms `reveal` at its exit', () => {
  const ten = read('src/app/the-ten.tsx');
  const today = read('src/app/(tabs)/index.tsx');
  const reveal = read('src/app/reveal.tsx');
  assert.match(ten, /trackOnce\('closet_ready', \{ route: 'the_ten', pieces: items\.length \}\);\s*(\/\/[^\n]*\n\s*)*noteReviewMoment\('ten'\);/);
  assert.match(today, /trackOnce\('closet_ready', \{ route: 'capture', pieces: items\.length \}\);\s*(\/\/[^\n]*\n\s*)*noteReviewMoment\('ten'\);/);
  // Before the membership moment, so the card follows the sheet.
  const exitAt = reveal.indexOf("noteReviewMoment('reveal')");
  assert.ok(exitAt > reveal.indexOf('const goToToday = async () => {'));
  assert.ok(exitAt < reveal.indexOf('presentPromo(gate, Placement.RevealComplete'));
  // Nowhere else.
  const all = [ten, today, reveal, read('src/components/rating/review-prompt.tsx')].join('\n');
  assert.equal((all.match(/noteReviewMoment\(/g) ?? []).length, 3);
});

test('the gate stamps every sheet for the card; the card imports no SDK', () => {
  const gate = read('src/features/billing/use-gate.ts');
  assert.match(gate, /onPresent: \((?:info)?\) => \{[\s\S]{0,1600}stampPaywallPresented\(new Date\(\), reviewPromptIo\);/);
  assert.match(gate, /onDismiss: \(_info, result\) => \{[\s\S]{0,300}stampPaywallDismissed\(new Date\(\), reviewPromptIo\);/);
  const card = read('src/components/rating/review-prompt.tsx');
  assert.doesNotMatch(card, /expo-superwall|use-gate|usePlan|use-plan/);
  // The timer is gone: no session counter, no page-move clock.
  assert.doesNotMatch(card, /recordSession|MOVES_BEFORE_PROMPT|30_000/);
  assert.match(card, /reviewCardDue\(\{ now, onTabRoot, dwelledMs, io \}\)/);
  // Both events carry the moment; "later" consumes it and never marks done.
  assert.match(card, /track\('review_prompt_shown', \{ moment: shownMoment \}\)/);
  assert.match(card, /const later = \(\) => \{\s*consumeMoment\(io\);\s*track\('review_prompt_action', \{ action: 'later', moment: shownMoment \}\);/);
  assert.doesNotMatch(card.slice(card.indexOf('const later')), /markDone/);
});
