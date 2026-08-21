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

const ROUTE_RAW = readFileSync('src/app/(tabs)/stylist.tsx', 'utf8');
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

test('the stylist is a tab screen, not a navigator of its own', () => {
  // AMENDED 2026-08-20: it WAS a sheet off Today, and this test held that. The
  // founder overruled the sheet — "I barely know stylist exists" — so the
  // route now lives under (tabs) and earns a bar slot. What survives of the
  // old law is the half that was never about presentation: the screen owns no
  // navigator, declares no registration of its own, and the path is still
  // /stylist so every caller and deep link is untouched.
  assert.doesNotMatch(ROUTE, /createStackNavigator|Tabs\.Screen|<Stack\.Navigator/);
  assert.ok(readFileSync('src/app/(tabs)/stylist.tsx', 'utf8').length > 0);
  // The tab bar carries it, and the root stack no longer registers a sheet.
  const bar = readFileSync('src/app/(tabs)/_layout.tsx', 'utf8');
  assert.match(bar, /name="stylist"/);
  assert.doesNotMatch(readFileSync('src/app/_layout.tsx', 'utf8'), /name="stylist"/);
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

// ---------------------------------------------------------------------------
// Packet S — the ceiling, the strip, the keyboard, the fifth bar
// ---------------------------------------------------------------------------

test('THE SEND HAS A CEILING — no turn may pend forever', () => {
  // `invoke` carries no timeout of its own; without the race, a flaky network
  // was an infinite greyed disc with no failed turn and no retry.
  assert.match(CHAT, /Promise\.race\(\[/);
  assert.match(CHAT, /setTimeout\(\(\) => reject\(new Error\(SEND_TIMED_OUT\)\), SEND_CEILING_MS\)/);
  // And the race wraps the one send rather than adding a second one.
  assert.equal((CHAT.match(/functions\.invoke\(/g) ?? []).length, 1);
});

test('a timeout settles as a RETRYABLE failed turn with its own honest sentence', () => {
  // The sentinel is read in the catch, where `retryable = !consent && !denial`
  // already classifies it as transport — the only retryable kind.
  assert.match(CHAT, /err\.message === SEND_TIMED_OUT/);
  assert.match(CHAT, /\? SEND_TIMED_OUT_COPY\.body/);
  assert.match(CHAT, /const retryable = !consent && !denial;/);
});

test('restored history is filtered before it can reach the wire, twice', () => {
  // Once at restore — an empty row draws no ghost bubble — and once in the
  // history builder, so a bad row that slips past can still never block
  // composing. The server 400s the whole request over one empty string.
  assert.match(CHAT, /restored\.filter\(\(m\) => keepsRestoredRow\(m\.text, m\.outfits\.length\)\)/);
  assert.match(CHAT, /const priorTurns = sendableHistory\(messages\);/);
});

test('a disabled workload is read at 503 and does not fall to the outage line', () => {
  assert.match(CHAT, /read503\(error\)\) === WORKLOAD_DISABLED_503/);
  assert.match(CHAT, /\? WORKLOAD_DISABLED_COPY\.body/);
  // Ordered after the two allowance 503s, so neither is shadowed.
  assert.match(CHAT, /!unavailable && !held && \(await isWorkloadDisabled\(err\)\)/);
});

test('THE DOORS SURVIVE THE FIRST CHAT — a strip renders whenever a thread exists', () => {
  // The opening grid renders only for an empty thread, which used to bury all
  // five doors — /recreate’s only app-wide entry among them — forever after
  // the first-ever chat.
  assert.match(ROUTE, /showsDoorStrip\(messages\.length\) \? <DoorStrip doors=\{DOORS\} onOpen=\{openDoor\} \/> : null/);
  // Through the SAME handler, so a pill tap fires the same doorTapped index
  // and reaches no model — the openDoor test above already holds that body.
  assert.match(PARTS, /export function DoorStrip/);
  assert.doesNotMatch(PARTS.slice(PARTS.indexOf('function DoorStrip')), /supabase|fetch\(|track\(/);
});

test('the opening skeleton draws one bar per door, counted off the spec', () => {
  // Four hard-coded bars resolved into five doors — a skeleton that grows a
  // row on arrival reads as a bug, which is what it was.
  const at = PARTS.indexOf('export function OpeningSkeleton');
  const body = PARTS.slice(at, at + 800);
  assert.match(body, /DOORS\.map\(\(door\) =>/);
  assert.doesNotMatch(body, /\[0, 1, 2, 3\]/);
});

test('the tab screen hands the keyboard back and offsets for the bar it sits over', () => {
  // Drag-to-dismiss on the transcript, taps kept for the retry buttons and
  // plates, and the avoiding view corrected for the tab context — the
  // sheet-era offset of 0 left the composer floating a tab-bar height above
  // the keyboard.
  assert.match(ROUTE, /keyboardDismissMode="interactive"/);
  assert.match(ROUTE, /keyboardShouldPersistTaps="handled"/);
  assert.match(ROUTE, /keyboardVerticalOffset=\{stylistKeyboardOffset\(insets\.bottom\)\}/);
});

test('a send while one is pending is refused with feedback, never swallowed', () => {
  const at = ROUTE.indexOf('const submit');
  const body = ROUTE.slice(at, at + 900);
  assert.match(body, /if \(isSending\) \{/);
  assert.match(body, /Haptics\.selectionAsync/);
});
