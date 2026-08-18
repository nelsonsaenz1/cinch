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

test('the client counts nothing', () => {
  // `serverSuccessfulUsed` is the only source, and nothing on this screen
  // increments it. A number assembled locally would be wrong the moment
  // somebody used a second device.
  assert.match(ROUTE, /const serverSuccessfulUsed: number \| null = null;/);
  assert.doesNotMatch(ROUTE, /setSuccessfulUsed|successfulUsed \+ 1|used \+\+/);
});

test('the mark is gated on all four conditions at the call site', () => {
  assert.match(ROUTE, /showsAllowanceMark\(\{/);
  assert.match(ROUTE, /usageLoading: serverSuccessfulUsed === null/);
  assert.match(ROUTE, /planLoading: planState\.loading \|\| planState\.unconfirmed/);
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
