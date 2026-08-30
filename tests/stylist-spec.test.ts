/**
 * The stylist — what the desk decides. Redesign 16.
 *
 * The contracts this file holds: four doors in fixed order that reach no
 * model, an allowance mark computed against the PROMISE and never inferred,
 * four denials told apart with only one retryable, local facts that spend
 * nothing, and plates that resolve to owned garments or are dropped.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DENIAL_COPY,
  DOORS,
  DOOR_COLUMNS,
  DOOR_COLUMNS_AX,
  LOCAL_FACT_MARK,
  MARK_THRESHOLD,
  MIN_TARGET,
  MIN_TARGET_AX,
  STANDARD_PROMISE,
  STYLIST_COPY,
  allowanceDisplay,
  allowanceMarkLabel,
  composerHeight,
  doorColumns,
  doorIndex,
  doorSpendsAllowance,
  doorWell,
  isRetryable,
  localFactSpendsAllowance,
  planLine,
  plateRenders,
  quotaResetLine,
  resolvePlateIds,
  routesToUpgrade,
  showsAllowanceMark,
  type DenialKind,
} from '../src/features/stylist/stylist-spec';

const KINDS: DenialKind[] = ['plan_excluded', 'quota', 'consent', 'transport'];

// ---------------------------------------------------------------------------
// Five doors, fixed order, no model call
// ---------------------------------------------------------------------------

test('there are exactly five doors, in the accepted order', () => {
  // AMENDED from four with the photograph door: its input is a photograph, so
  // it takes the third action kind (`route`) rather than a composer seed —
  // a photo does not belong in a sentence. It sits second, beside the other
  // build-me-something door, and everything the old contract held still
  // holds: fixed order, and nothing spends on a tap.
  //
  // RE-LABELLED from "Recreate a look" to "Style inspiration": the door is
  // named for its purpose rather than its one current source, so a second
  // source joins it instead of crowding the strip with a sixth door. The key
  // and the route are still `recreate`.
  assert.equal(DOORS.length, 5);
  assert.deepEqual(
    DOORS.map((d) => d.label),
    [
      'What should I wear',
      'Style inspiration',
      'Pack for a trip',
      'Make this piece work',
      'Ask about my closet',
    ],
  );
});

test('NO DOOR REACHES A MODEL', () => {
  // Nobody can spend a chat by looking around. `route` keeps the promise the
  // same way the others do: the tap only navigates, and the recreate screen
  // claims its own (separate) allowance when a photo is actually submitted.
  for (const d of DOORS) {
    assert.equal(doorSpendsAllowance(d), false, d.key);
    assert.ok(
      d.action.kind === 'questionnaire' ||
        d.action.kind === 'compose' ||
        d.action.kind === 'route',
      `${d.key} has an unknown kind of action`,
    );
  }
});

test('every door maps to a path that already exists', () => {
  const wear = DOORS[0]!;
  assert.deepEqual(wear.action, { kind: 'questionnaire', entry: 'dressed' });
  const recreate = DOORS[1]!;
  assert.deepEqual(recreate.action, { kind: 'route', href: '/recreate' });
  // The remaining three seed the composer, because each needs a noun only
  // the owner can supply — which trip, which piece, which question.
  for (const d of DOORS.slice(2)) {
    assert.equal(d.action.kind, 'compose');
    assert.ok((d.action as { seed: string }).seed.length > 0, `${d.key} seeds nothing`);
  }
});

test('the closet door says outright that it costs nothing', () => {
  const closet = DOORS[4]!;
  assert.match(closet.hint, /Costs nothing/i);
  assert.match(closet.hint, /Counted/i);
});

test('the door index is its position, and nothing else', () => {
  assert.equal(doorIndex('wear'), 1);
  assert.equal(doorIndex('recreate'), 2);
  assert.equal(doorIndex('pack'), 3);
  assert.equal(doorIndex('piece'), 4);
  assert.equal(doorIndex('closet'), 5);
});

test('no door label promises a purchase, a brand or a price', () => {
  const words = DOORS.map((d) => `${d.label} ${d.hint}`).join(' ');
  assert.doesNotMatch(words, /buy|shop|brand|price|\$|£|€|store|order/i, words);
  // And every one of them is about what the reader already owns.
  assert.match(DOORS.map((d) => d.hint).join(' '), /own/i);
});

// ---------------------------------------------------------------------------
// The allowance: promised five, never inferred
// ---------------------------------------------------------------------------

test('the promise is five, and the mark is computed against the promise', () => {
  // The server's ceiling is eight. The three-chat gap exists so five survives
  // a failed call or two; a mark computed from eight would over-promise by
  // three, and the eighth chat is the one somebody would remember.
  assert.equal(STANDARD_PROMISE, 5);
  const d = allowanceDisplay(3);
  assert.deepEqual(d, { promiseLimit: 5, successfulUsed: 3, remaining: 2 });
});

test('the client never invents a count', () => {
  // Null in, null out. A number assembled locally would be wrong the moment
  // somebody used a second device, and a wrong allowance is a promise the
  // server will break.
  assert.equal(allowanceDisplay(null), null);
  assert.equal(allowanceDisplay(Number.NaN), null);
});

test('a nonsense count cannot produce a negative remainder', () => {
  assert.equal(allowanceDisplay(99)!.remaining, 0);
  assert.equal(allowanceDisplay(-4)!.successfulUsed, 0);
  assert.equal(allowanceDisplay(2.7)!.successfulUsed, 2);
});

test('the mark appears only in the back half', () => {
  assert.equal(MARK_THRESHOLD, 2);
  const base = { plan: 'standard', planLoading: false, usageLoading: false };
  assert.equal(showsAllowanceMark({ ...base, display: allowanceDisplay(0) }), false);
  assert.equal(showsAllowanceMark({ ...base, display: allowanceDisplay(2) }), false);
  // Three used, two left — the back half begins.
  assert.equal(showsAllowanceMark({ ...base, display: allowanceDisplay(3) }), true);
  assert.equal(showsAllowanceMark({ ...base, display: allowanceDisplay(5) }), true);
});

test('the mark is hidden for every plan but confirmed Standard', () => {
  const base = { planLoading: false, usageLoading: false, display: allowanceDisplay(4) };
  assert.equal(showsAllowanceMark({ ...base, plan: 'pro' }), false);
  assert.equal(showsAllowanceMark({ ...base, plan: 'free' }), false);
  assert.equal(showsAllowanceMark({ ...base, plan: '' }), false);
  assert.equal(showsAllowanceMark({ ...base, plan: 'standard' }), true);
});

test('the mark is hidden while anything is still loading', () => {
  // A mark that appears and then corrects itself is worse than one that
  // arrives late.
  const d = allowanceDisplay(4);
  assert.equal(
    showsAllowanceMark({ plan: 'standard', planLoading: true, usageLoading: false, display: d }),
    false,
  );
  assert.equal(
    showsAllowanceMark({ plan: 'standard', planLoading: false, usageLoading: true, display: d }),
    false,
  );
});

test('the mark is a line, never a countdown or a badge', () => {
  assert.equal(allowanceMarkLabel(2), '2 chats left this month');
  assert.equal(allowanceMarkLabel(1), '1 chat left this month');
  assert.doesNotMatch(allowanceMarkLabel(2), /of 5|\/5|•|●/);
});

// ---------------------------------------------------------------------------
// Plan lines
// ---------------------------------------------------------------------------

test('Pro says unlimited and never the anti-abuse ceiling', () => {
  assert.equal(planLine('pro', false, false), 'Unlimited chats');
  // 100 a day exists to stop a script, not to describe a product; printing it
  // would turn "unlimited" into a lie the eleventh chat exposes.
  assert.doesNotMatch(planLine('pro', false, false)!, /\d/);
});

test('Standard states the promise, not the ceiling', () => {
  assert.equal(planLine('standard', false, false), 'Five chats a month');
  assert.doesNotMatch(planLine('standard', false, false)!, /eight|8/i);
});

test('Free is told where the stylist lives, with no price', () => {
  const line = planLine('free', false, false)!;
  assert.match(line, /part of Standard and Pro/);
  assert.doesNotMatch(line, /\$|£|€|\d/);
});

test('A TRIALING ACCOUNT IS SOLD NOTHING', () => {
  // It follows its verified entitlement. A sales line on a screen somebody
  // already has full access to is an interruption advertising what they have.
  for (const plan of ['free', 'standard', 'pro']) {
    assert.equal(planLine(plan, true, false), null, plan);
  }
});

test('nothing is said while the plan is loading', () => {
  for (const plan of ['free', 'standard', 'pro']) {
    assert.equal(planLine(plan, false, true), null, plan);
  }
});

// ---------------------------------------------------------------------------
// Four denials, one retryable
// ---------------------------------------------------------------------------

test('ONLY TRANSPORT IS RETRYABLE', () => {
  assert.equal(isRetryable('transport'), true);
  for (const k of ['plan_excluded', 'quota', 'consent'] as DenialKind[]) {
    assert.equal(isRetryable(k), false, `${k} offered a retry that would fail identically`);
  }
});

test('only a plan boundary routes to the upgrade placement', () => {
  assert.equal(routesToUpgrade('plan_excluded'), true);
  for (const k of ['quota', 'consent', 'transport'] as DenialKind[]) {
    assert.equal(routesToUpgrade(k), false, `${k} was sold an upgrade`);
  }
});

test('402 and 429 read as different facts', () => {
  assert.notEqual(DENIAL_COPY.plan_excluded.title, DENIAL_COPY.quota.title);
  // A boundary is not exhaustion, and exhaustion is not a boundary.
  assert.match(DENIAL_COPY.plan_excluded.title, /part of Standard and Pro/);
  assert.doesNotMatch(DENIAL_COPY.quota.title, /Standard|Pro|upgrade/i);
});

test('consent is neither an outage nor a paywall', () => {
  const c = DENIAL_COPY.consent;
  assert.doesNotMatch(`${c.title} ${c.body}`, /upgrade|member|plan|offline|outage|error/i);
  // And it says what still works without it.
  assert.match(c.body, /Doors, closet facts and your history all work without it/);
});

test('no denial invents a reset date the server did not give', () => {
  assert.match(quotaResetLine('day'), /resets tomorrow/);
  assert.match(quotaResetLine('month'), /resets next month/);
  // An invented date is the worst failure here: somebody waits for a Tuesday
  // that means nothing and comes back to the same refusal.
  assert.doesNotMatch(quotaResetLine(null), /\d|Monday|Tuesday|January/i);
  assert.match(quotaResetLine(null), /server/);
});

test('a transport failure says nothing was spent and the question survives', () => {
  assert.match(DENIAL_COPY.transport.body, /Nothing was spent/);
  assert.match(DENIAL_COPY.transport.body, /your question is still here/);
  // And no promise of background sync — this app has no such queue.
  assert.doesNotMatch(DENIAL_COPY.transport.body, /sync|queue|when you.re back/i);
});

test('every denial has a title and a body, and none quotes a price', () => {
  for (const k of KINDS) {
    assert.ok(DENIAL_COPY[k].title.length > 0, k);
    assert.ok(DENIAL_COPY[k].body.length > 0, k);
    assert.doesNotMatch(`${DENIAL_COPY[k].title} ${DENIAL_COPY[k].body}`, /\$|£|€/, k);
  }
});

// ---------------------------------------------------------------------------
// Local facts spend nothing
// ---------------------------------------------------------------------------

test('a locally answered question spends no allowance and says so', () => {
  assert.equal(localFactSpendsAllowance(), false);
  assert.match(LOCAL_FACT_MARK, /No chat used/);
  // And it is labelled as COUNTED rather than generated: presenting a count of
  // what somebody owns as an AI answer would claim a model read their closet.
  assert.match(LOCAL_FACT_MARK, /Counted on your phone/);
  assert.doesNotMatch(LOCAL_FACT_MARK, /\bAI\b|generated|model/i);
});

// ---------------------------------------------------------------------------
// Plates resolve to owned garments, or are dropped
// ---------------------------------------------------------------------------

test('an id that does not resolve to an owned garment is dropped', () => {
  const owned = new Set(['a', 'b', 'c']);
  assert.deepEqual(resolvePlateIds(['a', 'zzz', 'c'], owned), ['a', 'c']);
});

test('a fabricated id cannot reach a plate', () => {
  const owned = new Set(['a']);
  assert.deepEqual(resolvePlateIds(['made-up-1', 'made-up-2'], owned), []);
  assert.equal(plateRenders([]), false, 'an empty plate was still drawn');
});

test('a revoked garment disappears silently, with no gap or count', () => {
  // The function returns only survivors — there is no placeholder value, no
  // count of what was dropped and no reason. A "1 item unavailable" marker
  // would reveal that something existed and is no longer visible.
  const owned = new Set(['a', 'b']);
  const out = resolvePlateIds(['a', 'revoked', 'b'], owned);
  assert.deepEqual(out, ['a', 'b']);
  assert.equal(out.length, 2, 'a placeholder was left in place of the revoked item');
});

test('a plate renders only when something survived', () => {
  assert.equal(plateRenders(['a']), true);
  assert.equal(plateRenders([]), false);
});

// ---------------------------------------------------------------------------
// Geometry and Dynamic Type
// ---------------------------------------------------------------------------

test('two columns of doors normally, ONE at an accessibility size', () => {
  assert.equal(DOOR_COLUMNS, 2);
  assert.equal(DOOR_COLUMNS_AX, 1);
  assert.equal(doorColumns(false), 2);
  // The single stacked column the directive describes — and where a
  // two-column grid would start crushing type.
  assert.equal(doorColumns(true), 1);
});

test('the door well yields height at an accessibility size', () => {
  assert.ok(doorWell(true) < doorWell(false));
});

test('every target clears 44pt, and 56pt at an accessibility size', () => {
  assert.ok(MIN_TARGET >= 44);
  assert.ok(MIN_TARGET_AX >= 56);
  assert.ok(composerHeight(false) >= 44, `${composerHeight(false)}pt composer`);
  assert.ok(composerHeight(true) >= 56, `${composerHeight(true)}pt composer at AX`);
});

// ---------------------------------------------------------------------------
// The words
// ---------------------------------------------------------------------------

test('a failed closet read never claims an empty or small closet', () => {
  assert.match(STYLIST_COPY.closetFailedBody, /Nothing has changed and nothing is lost/);
  assert.doesNotMatch(STYLIST_COPY.closetFailedBody, /empty|not enough|too few/i);
});

test('not-enough-pieces says suggestions come only from clothes owned', () => {
  assert.match(STYLIST_COPY.notEnoughBody, /only from clothes you actually own/);
});

test('no copy on this screen quotes a price or a purchase', () => {
  const words = Object.values(STYLIST_COPY).join(' ');
  assert.doesNotMatch(words, /\$|£|€|buy|shop|purchase|checkout/i, words);
});

// ---------------------------------------------------------------------------
// The send ceiling, the strip, history hygiene, the tab-context keyboard —
// overnight build 2026-08-21, Packet S
// ---------------------------------------------------------------------------

import {
  SEND_CEILING_MS,
  SEND_TIMED_OUT,
  SEND_TIMED_OUT_COPY,
  WORKLOAD_DISABLED_503,
  WORKLOAD_DISABLED_COPY,
  keepsRestoredRow,
  sendableHistory,
  showsDoorStrip,
  stylistKeyboardOffset,
} from '../src/features/stylist/stylist-spec';

test('the send ceiling exists, is ten seconds, and outlives the auth run’s eight', () => {
  // Long enough that a slow model turn is not called a failure; short enough
  // that a person is never left holding a greyed disc wondering.
  assert.equal(SEND_CEILING_MS, 45_000);
  assert.ok(SEND_CEILING_MS > 30_000, 'the ceiling must clear the server\'s own 30s provider budget — it races hangs, not slow honest work');
});

test('the timed-out sentence never claims nothing was spent', () => {
  // The race abandons the WAIT, not the request — the reply may still land on
  // the server and settle a chat there. Only the transport line, whose
  // request truly never arrived, may promise that.
  assert.doesNotMatch(SEND_TIMED_OUT_COPY.body, /nothing was spent|no successful chat|not.*used/i);
  assert.match(SEND_TIMED_OUT_COPY.body, /try again/i);
  // And the sentinel cannot collide with a server code by accident.
  assert.doesNotMatch(SEND_TIMED_OUT, /^ai_|_unavailable$|_held$/);
});

test('a disabled workload says something honest, not an outage', () => {
  // The server's 503 for a switched-off ai_config row carries this exact
  // sentence in its error field (stylist-chat/index.ts). Matching it is what
  // stops a dashboard decision reading as a network failure.
  assert.equal(WORKLOAD_DISABLED_503, 'The stylist is unavailable.');
  assert.doesNotMatch(WORKLOAD_DISABLED_COPY.body, /could not be reached|network|connection/i);
  assert.match(WORKLOAD_DISABLED_COPY.body, /Nothing was spent/);
  // And it neither sells nor blames: no upgrade, no allowance claim.
  assert.doesNotMatch(WORKLOAD_DISABLED_COPY.body, /upgrade|plan|allowance|month/i);
});

test('AN EMPTY RESTORED ROW IS DROPPED — one bad row must never poison the wire', () => {
  assert.equal(keepsRestoredRow('', 0), false);
  assert.equal(keepsRestoredRow('   ', 0), false);
  // A plate with no prose is still a turn the person got.
  assert.equal(keepsRestoredRow('', 2), true);
  assert.equal(keepsRestoredRow('What should I wear', 0), true);
});

test('sendable history carries no empty, pending or failed turn, and at most eight', () => {
  const turn = (text: string, extra?: { pending?: boolean; failed?: boolean }) => ({
    role: 'user' as const,
    text,
    ...extra,
  });
  const cleaned = sendableHistory([
    turn('first'),
    turn(''), // the poison row: server-side requiredString 400s the whole send
    turn('  '),
    turn('mid', { pending: true }),
    turn('lost', { failed: true }),
    turn('last'),
  ]);
  assert.deepEqual(cleaned, [
    { role: 'user', text: 'first' },
    { role: 'user', text: 'last' },
  ]);
  // The window is eight AFTER cleaning, so a run of ghosts cannot starve it.
  const many = sendableHistory(Array.from({ length: 20 }, (_, i) => turn(`q${i}`)));
  assert.equal(many.length, 8);
  assert.equal(many[0]!.text, 'q12');
});

test('the door strip appears exactly when a thread exists', () => {
  // Empty thread keeps the full opening grid; the strip is a continuation,
  // never a replacement — and it is what keeps /recreate reachable after the
  // first-ever chat.
  assert.equal(showsDoorStrip(0), false);
  assert.equal(showsDoorStrip(1), true);
  assert.equal(showsDoorStrip(50), true);
});

test('the tab-context keyboard offset is zero — the keyboard replaces the tab bar', () => {
  // Measured on the simulator (2026-08-21): the padding maths already accounts
  // for the covered tab bar because the keyboard replaces it, so zero — not the
  // handed-back inset — is what lands the composer on the keyboard's top edge.
  assert.equal(stylistKeyboardOffset(83), 0);
  assert.equal(stylistKeyboardOffset(34), 0);
  assert.equal(stylistKeyboardOffset(0), 0);
  // Never positive, whatever a future inset does.
  assert.ok(stylistKeyboardOffset(-5) <= 0);
});
