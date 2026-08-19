/**
 * Redesign 19 — the auth run's contract: email → code → name → handoff.
 *
 * Written to the shape the rest of the wave set: everything the run DECIDES
 * lives in `auth-run-spec.ts` and is imported and exercised directly; the drawn
 * body is asserted as TEXT, because esbuild cannot parse React Native's Flow
 * source and there is no renderer here.
 *
 * `tests/auth-email.test.ts` already pins `isValidEmail` / `normalizeEmail` and
 * the sign-in wordmark's line box. Neither is duplicated. What this file holds
 * is the RUN's contract — and, above all, the two boundaries the brief drew
 * around it:
 *
 *   1. the welcome / sign-in screen is excluded from the redesign, so nothing
 *      in the run may reach into it and it may not reach into the run;
 *   2. the auth itself is unchanged — the attempt limit, the cooldown, the
 *      rate-limit window and the handoff routing are the shipped machinery,
 *      restyled rather than rewritten.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  AX_STACK_SCALE,
  BOX_BLEED,
  BOX_GAP,
  BOX_MAX_WIDTH,
  CODE_LENGTH,
  CODE_ROW_COLUMNS,
  CODE_STEP,
  CTA_HEIGHT,
  CTA_HEIGHT_AX,
  EMAIL_STEP,
  MAX_ATTEMPTS,
  NAME_STEP,
  NARROW_DEVICE_WIDTH,
  PAD,
  RATE_LIMIT_S,
  RESEND_COOLDOWN_S,
  RUN,
  RUN_STEPS,
  beatMs,
  codeColumns,
  cooldownLine,
  expiredTrouble,
  handoffHeadline,
  handoffSubline,
  nameFailedTrouble,
  offlineTrouble,
  progressTones,
  rateLimitBody,
  rateLimitedTrouble,
  resendFailedTrouble,
  sendFailedTrouble,
  showsOwnCta,
  stepTone,
  thrownTrouble,
  wrongCodeLine,
} from '../src/features/auth/auth-run-spec';
import { contrastRatio, AA_TEXT } from '../src/theme/contrast';

/**
 * Comments across the run discuss the rules they are obeying — the handoff's
 * docblock names `greetingForHour` and `toured_at` precisely to say it does NOT
 * use them. Only code counts, so every assertion about what a file DOES runs
 * against a comment-stripped copy. Same helper, and the same reason, as
 * `tests/type-weight.test.ts`.
 */
const code = (src: string) =>
  src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const read = (path: string) => code(readFileSync(path, 'utf8'));

const EMAIL_RAW = read('src/app/(auth)/email.tsx');
const CODE_RAW = read('src/app/(auth)/code.tsx');
const NAME_RAW = read('src/app/(auth)/name.tsx');
const HANDOFF_RAW = read('src/app/(auth)/handoff.tsx');
const PARTS_RAW = read('src/components/auth/run-parts.tsx');
const SPEC_RAW = read('src/features/auth/auth-run-spec.ts');
const SIGN_IN_RAW = read('src/app/(auth)/sign-in.tsx');

const RUN_SCREENS = [
  ['email', EMAIL_RAW],
  ['code', CODE_RAW],
  ['name', NAME_RAW],
  ['handoff', HANDOFF_RAW],
] as const;

// ---------------------------------------------------------------------------
// The hard wall — the welcome screen is not part of this redesign
// ---------------------------------------------------------------------------

test('the welcome screen imports nothing the redesign introduced', () => {
  // The founder excluded it by name. The cheapest way for it to change anyway
  // is for somebody to reach for a shiny new part while they are in the folder,
  // so the import list is the thing under guard rather than the rendering.
  for (const module of ['run-parts', 'auth-run-spec', 'auth-run-fixtures']) {
    assert.ok(
      !SIGN_IN_RAW.includes(module),
      `sign-in.tsx must not import ${module} — the welcome screen is out of scope`,
    );
  }
});

test('the run does not reach into the welcome screen', () => {
  // The other direction, and the subtler one: a shared component pulled OUT of
  // sign-in.tsx into the run would make the two files move together forever.
  for (const [name, raw] of RUN_SCREENS) {
    // `sign-in-errors.ts` is a shared leaf and stays fair game; the SCREEN is
    // what may not be reached into.
    assert.ok(
      !raw.includes('(auth)/sign-in'),
      `${name}.tsx must not import from the welcome screen`,
    );
  }
  assert.ok(!PARTS_RAW.includes('(auth)/sign-in'), 'run-parts.tsx must not reach the welcome screen');
});

test('the run leaves the Apple path alone', () => {
  // Apple sign-in lives on the welcome screen. The run must not have grown its
  // own copy of it, and the handoff — the funnel Apple lands in — must still
  // read the session rather than assume the email path put a name in params.
  for (const [name, raw] of RUN_SCREENS) {
    assert.ok(
      !raw.includes('expo-apple-authentication'),
      `${name}.tsx must not touch Apple sign-in`,
    );
  }
  assert.match(HANDOFF_RAW, /supabase\.auth\s*\n?\s*\.getUser\(\)/);
  assert.match(HANDOFF_RAW, /router\.replace\('\/\(auth\)\/name'\)/);
});

// ---------------------------------------------------------------------------
// The auth is unchanged — only the asking was restyled
// ---------------------------------------------------------------------------

test('the shipped auth constants survived the redesign', () => {
  assert.equal(MAX_ATTEMPTS, 3);
  assert.equal(RESEND_COOLDOWN_S, 60);
  assert.equal(RATE_LIMIT_S, 300);
  assert.equal(CODE_LENGTH, 6);
});

test('the code screen still submits on the sixth digit and has no button', () => {
  // The sixth digit submitting is why this screen has no Continue control, and
  // adding one is the most plausible way to break autofill's happy path.
  assert.match(CODE_RAW, /digits\.length === CODE_LENGTH\) void verify\(digits\)/);
  // One RunButton on the screen, and it is the accessibility-size resend — the
  // ordinary composition draws an inline action instead.
  assert.equal((CODE_RAW.match(/<RunButton/g) ?? []).length, 1);
  assert.match(CODE_RAW, /large \? \(/);
});

test('one hidden field still drives the boxes, so one-time-code autofill lands', () => {
  assert.match(CODE_RAW, /textContentType="oneTimeCode"/);
  assert.match(CODE_RAW, /autoComplete="one-time-code"/);
  assert.match(CODE_RAW, /maxLength={CODE_LENGTH}/);
  // Exactly one TextInput: six real fields would break autofill and the paste.
  // `<TextInput\s` — the JSX open tag. `useRef<TextInput>(null)` is a type
  // argument, not a second field, and matching it would make this vacuous.
  assert.equal((CODE_RAW.match(/<TextInput\s/g) ?? []).length, 1);
});

test('a resend still resets the attempt count and starts the cooldown', () => {
  assert.match(CODE_RAW, /setAttemptsLeft\(MAX_ATTEMPTS\)/);
  assert.match(CODE_RAW, /setCooldown\(RESEND_COOLDOWN_S\)/);
});

test('the email send still races the eight-second ceiling', () => {
  // The button must never sit on "Sending…" forever. This is the shipped race.
  assert.match(EMAIL_RAW, /Promise\.race/);
  assert.match(EMAIL_RAW, /8000/);
});

test('email validation still waits for blur or submit', () => {
  // Flagging per keystroke tells somebody their address is wrong while they are
  // still typing it. `onChangeText` may only CLEAR the flag.
  const onChange = EMAIL_RAW.slice(EMAIL_RAW.indexOf('onChangeText={(t) => {'));
  const body = onChange.slice(0, onChange.indexOf('}}'));
  assert.ok(!body.includes('setInvalid(true)'), 'validation must not run per keystroke');
  assert.match(EMAIL_RAW, /onBlur=\{\(\) => \{/);
});

test('thrown failures still surface rather than going silent', () => {
  for (const [name, raw] of [
    ['email', EMAIL_RAW],
    ['code', CODE_RAW],
  ] as const) {
    assert.match(raw, /describeThrownSignInError/, `${name}.tsx must surface a thrown failure`);
  }
});

test('the handoff still holds its beat and still ranks an invite above the tour', () => {
  assert.equal(beatMs(true, false), 1900);
  assert.equal(beatMs(false, false), 1400);
  assert.equal(beatMs(true, true), 900);
  assert.equal(beatMs(false, true), 900);
  // The ordering atlas 39 states, and the once-only `take`.
  const invite = HANDOFF_RAW.indexOf('takePendingInvite()');
  const tour = HANDOFF_RAW.indexOf('shouldShowTour(tourGate)');
  assert.ok(invite > 0 && tour > invite, 'an invite must be taken before the tour is offered');
  assert.ok(!HANDOFF_RAW.includes('toured_at'), 'the handoff must not write toured_at');
});

// ---------------------------------------------------------------------------
// The progress feeling — the thing the brief actually asked for
// ---------------------------------------------------------------------------

test('the run is three steps and each screen claims its own', () => {
  assert.equal(RUN_STEPS, 3);
  assert.equal(EMAIL_STEP, 1);
  assert.equal(CODE_STEP, 2);
  assert.equal(NAME_STEP, 3);
  assert.match(EMAIL_RAW, /step={EMAIL_STEP}/);
  assert.match(CODE_RAW, /step={CODE_STEP}/);
  assert.match(NAME_RAW, /step={NAME_STEP}/);
});

test('the bar reads as a journey, not a position', () => {
  // Three tones, not two — a finished step must look different from an
  // unreached one or the bar says only "you are on step two of something".
  assert.deepEqual(progressTones(1), ['current', 'upcoming', 'upcoming']);
  assert.deepEqual(progressTones(2), ['done', 'current', 'upcoming']);
  assert.deepEqual(progressTones(3), ['done', 'done', 'current']);
  assert.equal(stepTone(1, 3), 'done');
  assert.equal(stepTone(3, 1), 'upcoming');
});

test('the handoff carries no progress bar', () => {
  // It is the arrival, not a fourth step. A bar here would promise more to come.
  assert.ok(!HANDOFF_RAW.includes('RunHeader'), 'the handoff is not a step in the run');
});

test('the name screen offers no way back', () => {
  // The account exists by then. A back chevron would point at a code screen
  // whose code has already been spent.
  assert.ok(!NAME_RAW.includes('onBack'), 'the name screen has nothing behind it');
  assert.match(EMAIL_RAW, /onBack=/);
  assert.match(CODE_RAW, /onBack=/);
});

// ---------------------------------------------------------------------------
// One filled CTA per screen
// ---------------------------------------------------------------------------

test('a card that carries its own button takes the screen’s CTA over', () => {
  // Two filled oxblood buttons on one screen is the brief's rule broken by
  // accretion, and it is exactly what happens if the outer CTA keeps drawing
  // under a card with a "Try again" in it.
  assert.equal(showsOwnCta(sendFailedTrouble()), false);
  assert.equal(showsOwnCta(offlineTrouble()), false);
  assert.equal(showsOwnCta(expiredTrouble()), false);
  assert.equal(showsOwnCta(resendFailedTrouble()), false);
  assert.equal(showsOwnCta(nameFailedTrouble()), false);
  assert.equal(showsOwnCta(thrownTrouble('anything')), false);

  // The rate limit has nothing to press, so the screen keeps its own button —
  // disabled, because the whole point is that it cannot be used yet.
  assert.equal(showsOwnCta(rateLimitedTrouble(120)), true);
  assert.equal(showsOwnCta(null), true);

  assert.match(EMAIL_RAW, /showsOwnCta\(shownTrouble\)/);
  assert.match(NAME_RAW, /showsOwnCta\(trouble\)/);
});

test('every trouble names what did NOT happen', () => {
  // The failure copy's whole job is stopping somebody believing a code is in
  // flight when it is not, or that their account is broken when it is not.
  assert.match(offlineTrouble().body, /Nothing has been sent/);
  assert.match(sendFailedTrouble().body, /Your account is fine/);
  assert.match(rateLimitedTrouble(60).body, /Codes already sent still work/);
  assert.match(resendFailedTrouble().body, /already in your inbox still works/);
  assert.match(nameFailedTrouble().body, /signed in either way/);
});

test('the amber cards offer a retry and the neutral ones do not offer the same one twice', () => {
  // Tone is a claim about blame: amber means "try again", neutral means the
  // system is behaving and the same request is not the answer.
  assert.equal(offlineTrouble().tone, 'amber');
  assert.equal(sendFailedTrouble().tone, 'amber');
  assert.equal(resendFailedTrouble().tone, 'amber');
  assert.equal(nameFailedTrouble().tone, 'amber');
  assert.equal(rateLimitedTrouble(60).tone, 'neutral');
  assert.equal(expiredTrouble().tone, 'neutral');
  // An expired code's recovery is a NEW code, never the same one again.
  assert.equal(expiredTrouble().action, 'Send a new code');
  assert.equal(rateLimitedTrouble(60).action, null);
});

// ---------------------------------------------------------------------------
// Copy that counts
// ---------------------------------------------------------------------------

test('the rate limit counts down instead of asserting a stale five', () => {
  assert.match(rateLimitBody(300), /5 minutes/);
  assert.match(rateLimitBody(240), /4 minutes/);
  // Never "0 minutes", and never a plural one.
  assert.match(rateLimitBody(60), /1 minute\./);
  assert.match(rateLimitBody(1), /1 minute\./);
  assert.match(rateLimitBody(0), /1 minute\./);
  assert.ok(!rateLimitBody(0).includes('1 minutes'));
});

test('the cooldown line never reaches zero seconds', () => {
  assert.match(cooldownLine(47), /47s\./);
  assert.match(cooldownLine(1), /1s\./);
  // A "0s" that lingers for a frame reads as broken; the floor is one.
  assert.match(cooldownLine(0), /1s\./);
});

test('the tries are counted out loud, in words', () => {
  assert.equal(wrongCodeLine(2), 'That code isn’t right. Two tries left.');
  assert.equal(wrongCodeLine(1), 'That code isn’t right. One try left.');
  // Spent: the sentence stops counting and points at the recovery instead.
  assert.equal(wrongCodeLine(0), 'That code isn’t right. Send another to try again.');
  assert.ok(!wrongCodeLine(0).includes('0'));
});

test('a new account is welcomed and a returning one is recognised', () => {
  assert.equal(handoffHeadline(true, 'Priya'), 'Welcome to Cinch, Priya.');
  assert.equal(handoffHeadline(false, 'Priya'), 'Welcome back, Priya.');
  // The session read can fail. A nameless greeting must still be a sentence.
  assert.equal(handoffHeadline(false, null), 'Welcome back.');
  assert.equal(handoffHeadline(true, null), 'Welcome to Cinch.');
  assert.match(handoffSubline(true), /closet/);
  assert.match(handoffSubline(false), /where you left it/);
});

test('the hour greeting is what the arrival says to a new account', () => {
  // INVERTED 2026-08-18, by founder order.
  //
  // Redesign 19 argued that the hour is a fact about the clock and that a
  // brand-new account should be told it has arrived somewhere instead, so it
  // swapped `greetingForHour` for "Welcome to Cinch" and this test guarded the
  // swap. The founder reverted that beat: the arrival greets by the hour
  // again, and "Welcome back" is still what a returning account gets.
  //
  // The test is kept rather than deleted, pointing the other way, because the
  // thing worth pinning was never which sentence won — it was that ONE screen
  // owns the greeting. `handoffHeadline` / `handoffSubline` remain exported
  // and tested just below; they are simply no longer what the screen draws,
  // and leaving them under test is what makes the swap reversible again.
  assert.match(HANDOFF_RAW, /greetingForHour\(new Date\(\)\.getHours\(\)\)/);
  assert.match(HANDOFF_RAW, /'Welcome back'/);
});

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------

test('the code row wraps rather than shrinking its digits', () => {
  assert.equal(codeColumns(false), CODE_LENGTH);
  assert.equal(codeColumns(true), CODE_ROW_COLUMNS);
  // Three-by-two, never two-and-four: 6 must divide by the wrapped count.
  assert.equal(CODE_LENGTH % CODE_ROW_COLUMNS, 0);
});

test('the code row cannot overflow the screen', () => {
  // THE REGRESSION THIS PINS, because the simulator caught it and no unit test
  // did: the boxes were laid out on a percentage basis, which is a share of the
  // container and does NOT include the gaps. Six sixths plus five 9pt gaps plus
  // two 24pt gutters is wider than the screen, so the sixth box hung off the
  // right edge.
  const needed = PAD * 2 - BOX_BLEED * 2 + BOX_MAX_WIDTH * CODE_LENGTH + BOX_GAP * (CODE_LENGTH - 1);
  assert.ok(
    needed > NARROW_DEVICE_WIDTH,
    `six ${BOX_MAX_WIDTH}pt boxes need ${needed}pt — if this ever fits, the note below is stale`,
  );
  // Which is exactly why the width must be a CEILING reached by division, never
  // a fixed size. `flex: 1` with a zero basis divides what is left after the
  // gaps; a percentage basis is what overflowed.
  const row = PARTS_RAW.slice(PARTS_RAW.indexOf('export function CodeBoxes'));
  assert.match(row, /\{ flex: 1, flexBasis: 0, maxWidth: BOX_MAX_WIDTH \}/);
  assert.ok(
    !/maxWidth: `\$\{100 \/ columns\}%`/.test(row),
    'a percentage width does not account for the gaps between the boxes',
  );

  // And the division has to leave a box a real one on the narrowest device.
  const perBox =
    (NARROW_DEVICE_WIDTH - (PAD * 2 - BOX_BLEED * 2) - BOX_GAP * (CODE_LENGTH - 1)) / CODE_LENGTH;
  assert.ok(perBox > 40, `a box would be ${perBox.toFixed(1)}pt wide`);
  assert.ok(perBox < BOX_MAX_WIDTH, 'the ceiling must be slack at phone widths, not the width');
});

test('the run changes composition at the app’s one threshold', () => {
  // Not a second number. A run that relayouts at a different setting from every
  // other screen is a different app to the person moving the slider.
  assert.equal(AX_STACK_SCALE, 1.5);
  for (const [name, raw] of [
    ['email', EMAIL_RAW],
    ['code', CODE_RAW],
    ['name', NAME_RAW],
  ] as const) {
    assert.match(raw, /fontScale >= AX_STACK_SCALE/, `${name}.tsx must read the real setting`);
  }
});

test('the CTA grows rather than truncating', () => {
  assert.ok(CTA_HEIGHT_AX > CTA_HEIGHT, 'the button must gain height, not clip its label');
  // Nothing in the run may cap or ellipsise a label.
  for (const raw of [PARTS_RAW, EMAIL_RAW, CODE_RAW, NAME_RAW]) {
    assert.ok(!raw.includes('ellipsizeMode'));
    assert.ok(!raw.includes('numberOfLines'));
  }
});

test('every control the run draws clears the 44pt floor', () => {
  // The back well is a literal 44; every other control routes through
  // MIN_TAP_TARGET rather than hoping its content is tall enough.
  assert.match(SPEC_RAW, /BACK_SIZE = 44/);
  assert.match(PARTS_RAW, /height: BACK_SIZE/);
  assert.match(PARTS_RAW, /minHeight: Math\.max\(MIN_TAP_TARGET, height\)/);
  assert.match(PARTS_RAW, /minHeight: MIN_TAP_TARGET/);
});

test('the resend action is a control, not a text span pretending to be one', () => {
  // The shipped screen gave the link a text span and apologised for it with a
  // minHeight on the paragraph. A span cannot hold a 44pt box.
  assert.match(PARTS_RAW, /export function RunInlineAction/);
  const inline = PARTS_RAW.slice(PARTS_RAW.indexOf('export function RunInlineAction'));
  assert.match(inline, /accessibilityRole="button"/);
  assert.match(inline, /minHeight: MIN_TAP_TARGET/);
});

test('the progress bar is one element to VoiceOver, not three anonymous bars', () => {
  assert.match(PARTS_RAW, /accessibilityRole="progressbar"/);
  assert.match(PARTS_RAW, /Step \$\{step\} of/);
});

test('the wrong-code count is announced, not only drawn', () => {
  // The line is the only place the remaining tries exist, and a colour change
  // plus a shake says nothing to a screen reader.
  assert.match(CODE_RAW, /AccessibilityInfo\.announceForAccessibility\(wrongCodeLine\(left\)\)/);
});

// ---------------------------------------------------------------------------
// The contrast law
// ---------------------------------------------------------------------------

test('every colour the run sets as type clears AA on its own ground', () => {
  // The approved frames drew two eyebrows below 4.5:1. They are darkened here,
  // and this is the assertion that stops the frame's values being restored by
  // somebody eyedropping the PNG later.
  const pairs: readonly (readonly [string, string, string])[] = [
    ['amber eyebrow', RUN.troubleAmberEyebrow, RUN.troubleAmber],
    ['neutral eyebrow', RUN.troubleNeutralEyebrow, RUN.well],
    ['refusal on paper', RUN.refusal, '#FBFAF6'],
    ['refusal in a box', RUN.refusal, RUN.fieldGround],
  ];
  for (const [what, fg, bg] of pairs) {
    const ratio = contrastRatio(fg, bg);
    assert.ok(ratio >= AA_TEXT, `${what}: ${fg} on ${bg} is ${ratio.toFixed(2)}:1, needs ${AA_TEXT}`);
  }
});

test('the refusal colour is not the palette clay the law bars from type', () => {
  // "Clay never type" — accentWarm is 2.61:1 and may not carry a sentence. The
  // run's refusal is a darker sibling that clears AA, and the distinction is
  // worth pinning because the two are a shade apart to the eye.
  assert.notEqual(RUN.refusal, '#B08A76');
  assert.ok(contrastRatio('#B08A76', '#FBFAF6') < AA_TEXT);
});

test('the quiet tone is spent only where WCAG exempts it', () => {
  // `RUN.quiet` is 2.64:1 and is deliberately below the line. It may dress a
  // placeholder, a disabled label or a busy control — never live type. The
  // guard is that it appears in run-parts only, and never on a resting text
  // colour, so a future screen cannot quietly adopt it for a sentence.
  assert.ok(contrastRatio(RUN.quiet, '#FBFAF6') < AA_TEXT);
  for (const [name, raw] of RUN_SCREENS) {
    assert.ok(!raw.includes('RUN.quiet'), `${name}.tsx must not set the disabled tone as type`);
  }
});

// ---------------------------------------------------------------------------
// Hygiene the wave requires
// ---------------------------------------------------------------------------

test('the screens type no colours of their own', () => {
  // Every hex in the run belongs to the spec or to the auth atlas. A literal on
  // a screen is a colour nobody can trace, which is what the wave's no-hex rule
  // exists to prevent.
  for (const [name, raw] of RUN_SCREENS) {
    const hexes = raw.match(/#[0-9A-Fa-f]{6}/g) ?? [];
    assert.deepEqual(hexes, [], `${name}.tsx types a hex: ${hexes.join(', ')}`);
  }
});

test('the run goes through the haptic policy rather than around it', () => {
  // The shipped screens imported expo-haptics directly and were named as
  // exemptions in tests/haptic-policy.test.ts. They no longer need to be.
  for (const [name, raw] of RUN_SCREENS) {
    assert.ok(!raw.includes('expo-haptics'), `${name}.tsx must use @/lib/haptics`);
  }
  assert.match(EMAIL_RAW, /haptics\./);
  assert.match(CODE_RAW, /haptics\./);
  assert.match(NAME_RAW, /haptics\./);
});

test('the run adds no native module', () => {
  // OTA compatibility is law, and the rule this test exists for is "no module
  // that is not already in the binary" — not "no Skia".
  //
  // Redesign 19 removed Skia from the handoff and this loop covered all four
  // screens. On 2026-08-18 the founder reverted the handoff's visual beat to
  // its pre-19 form, which brings back the two-stop gradient over the blurred
  // photograph, and with it the Skia canvas. That is safe for exactly the
  // reason it was safe before 19: Skia never left the app. `sign-in.tsx` —
  // the welcome screen, excluded from the redesign and therefore never
  // restyled away from it — draws with Skia today, as does
  // `components/event-outfits/OutfitPostCard.tsx`, so the module ships in
  // every binary the handoff can be OTA'd into.
  //
  // The three ASKING screens stay under the flat ban. They gained nothing
  // native in the redesign and there is no frame that wants a canvas on them,
  // so an import appearing there would be somebody reaching for a tool rather
  // than restoring a decision.
  const OTA_SAFE_NATIVE = new Set(['handoff']);
  for (const [name, raw] of RUN_SCREENS) {
    if (OTA_SAFE_NATIVE.has(name)) continue;
    assert.ok(!raw.includes('@shopify/react-native-skia'), `${name}.tsx must stay JS-only`);
  }
  // The exemption is only honest while the claim under it holds: if Skia ever
  // leaves the welcome screen, the handoff's canvas stops being free and this
  // fails here rather than in a crash on somebody's phone.
  assert.match(SIGN_IN_RAW, /@shopify\/react-native-skia/);
});

test('reduced motion is honoured by the parts that move', () => {
  // The shake and the dots are the only motion in the run.
  assert.match(CODE_RAW, /if \(shakeTick === 0 \|\| reduced\) return;/);
  assert.match(PARTS_RAW, /useReducedMotion/);
  const dots = PARTS_RAW.slice(PARTS_RAW.indexOf('export function RunDots'));
  assert.match(dots, /if \(reduced\) return;/);
});
