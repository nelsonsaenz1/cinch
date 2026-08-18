/**
 * The stylist, as drawn and as wired. Redesign 16.
 *
 * The decisions are `tests/stylist-spec.test.ts` and the payloads are
 * `tests/stylist-privacy.test.ts`. What is left is the PAGE: that a door
 * reaches no network, that the three denial classes stay apart in the code
 * that produces them, that a local fact never spends, and that no backend
 * moved.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { CAPACITY_HELD_COPY } from '../src/features/stylist/stylist-spec';

const ROUTE_RAW = readFileSync('src/app/stylist.tsx', 'utf8');
const CHAT_RAW = readFileSync('src/features/stylist/use-chat.ts', 'utf8');
const PARTS_RAW = readFileSync('src/components/stylist/sheet-parts.tsx', 'utf8');
const stripped = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const ROUTE = stripped(ROUTE_RAW);
const CHAT = stripped(CHAT_RAW);
const PARTS = stripped(PARTS_RAW);

// ---------------------------------------------------------------------------
// Route ownership
// ---------------------------------------------------------------------------

test('the stylist is a sheet route, not a tab and not a navigator', () => {
  assert.doesNotMatch(ROUTE, /createStackNavigator|Tabs\.Screen|<Stack\.Navigator/);
  // And it is not under (tabs).
  assert.ok(readFileSync('src/app/stylist.tsx', 'utf8').length > 0);
});

// ---------------------------------------------------------------------------
// A door reaches nothing
// ---------------------------------------------------------------------------

test('NO DOOR CALLS THE MODEL', () => {
  const at = ROUTE.indexOf('const openDoor');
  const body = ROUTE.slice(at, ROUTE.indexOf('const doorCards'));
  // The two legal outcomes: open the on-device questionnaire, or seed the
  // composer. Nothing sends.
  assert.doesNotMatch(body, /\bask\(|submit\(|supabase|fetch\(/, body);
  assert.match(body, /questionnaire\.start\(door\.action\.entry\)/);
  assert.match(body, /setDraft\(door\.action\.seed\)/);
});

test('the doors come from the spec, in its order', () => {
  assert.match(ROUTE, /DOORS\.map\(/);
  assert.match(ROUTE, /starts=\{doorCards\}/);
});

test('door wells use the owner’s own garments, never stock artwork', () => {
  const at = ROUTE.indexOf('const doorCards');
  const body = ROUTE.slice(at, at + 700);
  assert.match(body, /resolve\(/);
  assert.match(body, /items\[i\]\?\.platePath/);
  // No bundled illustration, no remote asset, no product shot.
  assert.doesNotMatch(ROUTE, /require\('\.\.\/.*assets|unsplash|placeholder\.com/i);
});

test('a door well with no garment takes the same neutral ground', () => {
  assert.match(PARTS, /className="bg-sand overflow-hidden"/);
  assert.match(PARTS, /\{imageUri \? \(/);
});

// ---------------------------------------------------------------------------
// Denials stay apart
// ---------------------------------------------------------------------------

test('consent, plan, quota and transport are four separate branches', () => {
  assert.match(CHAT, /err\.message === 'ai_consent_required'/);
  assert.match(CHAT, /denial\?\.kind === 'plan_excluded'/);
  assert.match(CHAT, /denial\?\.kind === 'quota_exceeded'/);
});

test('ONLY A TRANSPORT FAILURE EARNS A RETRY', () => {
  // A refusal would refuse identically on retry, so offering one is a dead
  // control that also spends nothing and teaches nothing.
  assert.match(CHAT, /const retryable = !consent && !denial;/);
  assert.match(CHAT, /if \(retryable\) failedAsks\.current\.set\(/);
});

test('a retry reuses the failed turn rather than adding one', () => {
  // No duplicate bubble and no lost pending message.
  assert.match(CHAT, /failedAsks/);
  assert.match(ROUTE, /onRetry=\{\(\) => retry\(message\.id\)\}/);
});

// ---------------------------------------------------------------------------
// Local facts spend nothing
// ---------------------------------------------------------------------------

test('a local fact answer returns before anything is sent', () => {
  const at = CHAT.indexOf('tryFactAnswer');
  assert.ok(at > -1, 'the local fact path is gone');
  // The fact path resolves the turn without reaching the edge function.
  const after = CHAT.slice(at, at + 900);
  assert.doesNotMatch(after, /functions\.invoke/, after);
});

test('the model boundary is the only place that sends', () => {
  assert.equal((CHAT.match(/functions\.invoke\(/g) ?? []).length, 1);
});

// ---------------------------------------------------------------------------
// The allowance is never inferred
// ---------------------------------------------------------------------------

test('THE CLIENT COUNTS NOTHING — it reads the server and never derives', () => {
  // Redesign 16's first pass hard-coded this to null, so the mark shipped
  // dark. It is now fed by the server's own settled allowance, which is a
  // strictly stronger claim: the value exists AND it is not the client's.
  //
  // Nothing here increments, decrements or seeds a count. A number assembled
  // locally would be wrong the moment somebody used a second device, and a
  // wrong allowance is a promise the server will break.
  assert.match(ROUTE, /allowance: serverAllowance,\s*\n\s*\} = useChat\(/);
  assert.match(ROUTE, /allowanceDisplay\(serverAllowance\?\.successfulUsed \?\? null\)/);
  assert.doesNotMatch(ROUTE, /setSuccessfulUsed|successfulUsed \+ 1|used \+\+|remaining -/);
});

test('the hook only ever assigns the allowance from a server response', () => {
  const chat = stripped(readFileSync('src/features/stylist/use-chat.ts', 'utf8'));
  const writes = [...chat.matchAll(/setAllowance\([^)]*\)/g)].map((m) => m[0]);
  assert.ok(writes.length > 0, 'the allowance is never assigned');
  for (const w of writes) {
    // From a settled reply, or from the fact a 429 carried. Never arithmetic.
    assert.match(w, /setAllowance\((result\.allowance|carried)\)/, w);
  }
  // And the reader is total, on the exact Standard contract rather than on
  // "finite and not negative" — which accepted 2.5 of 5, and accepted a limit
  // of eight, the one number this page may never show.
  assert.match(chat, /if \(!isInt\(limit\) \|\| !isInt\(used\) \|\| !isInt\(remaining\)\) return null;/);
  assert.match(chat, /if \(limit !== STANDARD_PROMISE\) return null;/);
  assert.match(chat, /if \(used < 0 \|\| used > STANDARD_PROMISE\) return null;/);
  assert.match(chat, /if \(remaining < 0 \|\| remaining > STANDARD_PROMISE\) return null;/);
  assert.match(chat, /if \(used \+ remaining !== STANDARD_PROMISE\) return null;/);
});

test('the mark is gated on all four conditions at the call site', () => {
  assert.match(ROUTE, /showsAllowanceMark\(\{/);
  assert.match(ROUTE, /usageLoading: serverAllowance === null/);
  assert.match(ROUTE, /planLoading: planState\.loading \|\| planState\.unconfirmed/);
});

test('a 503 allowance failure is retryable and is not a paywall or an outage', () => {
  const chat = stripped(readFileSync('src/features/stylist/use-chat.ts', 'utf8'));
  assert.match(chat, /read503\(error\)\) === 'allowance_unavailable'/);
  assert.match(chat, /response\.status !== 503/);
  // Read locally rather than by broadening the shared denial classifier, which
  // Today, the Reveal and the gap feed also use.
  // Asserted on drawn code: `use-gate.ts`'s own comment already explains that
  // a 503 is deliberately not a denial — which is the rule this relies on —
  // and a grep over prose would read that explanation as a violation.
  const gate = stripped(readFileSync('src/features/billing/use-gate.ts', 'utf8'));
  assert.doesNotMatch(gate, /allowance_unavailable/);
  assert.doesNotMatch(gate, /status === 503|status !== 503/);
  // Retryable: the server declined to guess, not to serve.
  assert.match(chat, /const retryable = !consent && !denial;/);
});

test('A HELD SLOT IS ITS OWN STATE, AND NOT EXHAUSTION', () => {
  const chat = stripped(readFileSync('src/features/stylist/use-chat.ts', 'utf8'));
  assert.match(chat, /read503\(error\)\) === 'stylist_capacity_held'/);
  // Read at 503, so it never travels the 429 route that opens the paywall.
  const gate = stripped(readFileSync('src/features/billing/use-gate.ts', 'utf8'));
  assert.doesNotMatch(gate, /stylist_capacity_held/);
  // Retryable, because waiting is exactly what fixes it.
  assert.match(chat, /const held = !consent && !denial && !unavailable && \(await isCapacityHeld\(err\)\);/);
});

test('THE HELD-SLOT LINE CLAIMS NO SUCCESSES AND NAMES NO OTHER DEVICE', () => {
  // Read from the spec, which is the one copy the hook and the fixture both
  // draw — so the evidence frame and the shipping sentence cannot drift.
  const line = CAPACITY_HELD_COPY.body;
  const chat = stripped(readFileSync('src/features/stylist/use-chat.ts', 'utf8'));
  assert.match(chat, /\? CAPACITY_HELD_COPY\.body/);
  assert.ok(line.length > 0, 'the held-slot copy is gone');
  // It says nothing was spent, which is true, and offers a retry.
  assert.match(line, /No successful chat was used/);
  // It does not say the month is spent — the mark beside it says four of five.
  assert.doesNotMatch(line, /this month|used all|out of chats|upgrade/i);
  // And it does not disclose that a second device, session or person exists.
  assert.doesNotMatch(line, /device|phone|someone|somebody|another user|session|elsewhere|signed in/i);
});

test('a held slot still updates the mark from the fact it carried', () => {
  const chat = stripped(readFileSync('src/features/stylist/use-chat.ts', 'utf8'));
  // Both refusals carry the allowance, so the number beside either one is the
  // server's and not a guess.
  assert.match(chat, /if \(denial\?\.kind === 'quota_exceeded' \|\| held\) \{/);
});

// ---------------------------------------------------------------------------
// Scope
// ---------------------------------------------------------------------------

test('no new package, permission, vendor or recipient', () => {
  assert.doesNotMatch(ROUTE_RAW, /expo-location|expo-notifications|expo-contacts|expo-av|Camera|Microphone/i);
  assert.doesNotMatch(ROUTE_RAW, /requestPermission|Permissions\./);
});

test('no purchase link, price or commerce surface', () => {
  assert.doesNotMatch(ROUTE, /\$\d|£\d|€\d|checkout|buy now|Linking\.openURL/i);
});

test('ZERO BACKEND CHANGE — the edge function and its quota helper are untouched', () => {
  // Verified as a filesystem fact by the ledger's `git status supabase/`; this
  // asserts the client did not take authority instead. The server decides, and
  // the client renders what it is told.
  assert.doesNotMatch(ROUTE, /PLAN_LIMITS|claim_ai_quota|allowanceFor/);
  assert.match(ROUTE, /showsAllowanceMark/);
});

test('the trial is server-owned — no client timer anywhere', () => {
  assert.doesNotMatch(ROUTE, /trialEndsAt|setTimeout[\s\S]{0,80}trial|14 ?days/i);
  // The screen reads `trialing` from the verified plan and nothing else.
  assert.match(ROUTE, /planState\.trialing/);
});
