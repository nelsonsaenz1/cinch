/**
 * Redesign 19 — the auth run: email → code → name → handoff.
 *
 * Everything the four screens DECIDE lives here, so `tests/auth-run-layout.ts`
 * can exercise it directly. The screens themselves draw; they do not choose a
 * sentence, a tone or a height.
 *
 * ── WHAT THIS REDESIGN CHANGED, AND WHAT IT DELIBERATELY DID NOT ────────────
 *
 * Changed: the ASKING. The wordmark header gives way to a back well and a
 * three-step progress bar, so the run has a visible beginning, middle and end
 * (DIRECTIVE §3 · 19: "a progress feeling"). The underline fields become boxed
 * ones. The tray callout becomes a trouble card that carries its own recovery
 * button. The code boxes grow. Every screen ends in exactly ONE filled CTA.
 *
 * NOT changed: the AUTH. Resend cooldown (60s), attempt limit (3), the expired
 * / wrong ambiguity `actions.ts` resolves, the rate-limit window (5 min), and
 * the new-vs-returning handoff routing are all the shipped machinery, reached
 * through the shipped functions. This module renames nothing in `actions.ts`
 * and computes no auth decision — it decides only what is SAID and how tall it
 * is drawn.
 *
 * The welcome / sign-in screen is excluded from this redesign by founder order
 * and nothing here is imported by it.
 *
 * ── THE DIALECT ─────────────────────────────────────────────────────────────
 *
 * `components/auth/chrome.tsx` already explains why this flow carries its own
 * constants rather than the app palette: it is drawn in its own dialect, and
 * several of its values exist nowhere else. `RUN` extends that atlas with the
 * frame's new surfaces. Values that match a palette token are the same hexes.
 *
 * Two eyebrow colours are the ONE place this file departs from the approved
 * frame, and it is the contrast law doing it (see `theme/contrast.ts`):
 *
 *   - the amber eyebrow is drawn #8A6B2B, which is 4.15:1 on the amber card —
 *     below AA_TEXT, and an 11pt tracked line is never large text. #7E6127 is
 *     the same hue one step darker, at 4.82:1.
 *   - the neutral eyebrow is drawn #8A8375, which is 3.19:1 on the neutral
 *     card. `muted` (#6B665C) is the palette's own answer for a quiet line and
 *     lands at 4.84:1.
 *
 * The disabled CTA label and the verifying digits stay at the frame's #A39B8B.
 * Those are the two honest exemptions `contrast.ts` names — a disabled control
 * and a control that is busy — and the house `Button` already spends the same
 * one for the same reason.
 */

/** The three-step run. Handoff is the arrival, not a step. */
export const RUN_STEPS = 3;

export type RunStep = 1 | 2 | 3;

export const EMAIL_STEP: RunStep = 1;
export const CODE_STEP: RunStep = 2;
export const NAME_STEP: RunStep = 3;

/**
 * A step's mark in the progress bar. Three states, not two: a finished step is
 * tan, the current one is oxblood, an unreached one is pale. Two states would
 * make the bar a position indicator; three make it a journey, which is the
 * "progress feeling" the brief asks for.
 */
export type StepTone = 'done' | 'current' | 'upcoming';

export function stepTone(index: RunStep, current: RunStep): StepTone {
  if (index < current) return 'done';
  if (index === current) return 'current';
  return 'upcoming';
}

/** The bar, as the header draws it — one entry per step, in order. */
export function progressTones(current: RunStep): readonly StepTone[] {
  return ([1, 2, 3] as const).map((i) => stepTone(i, current));
}

// ---------------------------------------------------------------------------
// Colour — the run's dialect
// ---------------------------------------------------------------------------

export const RUN = {
  /** The back well, and the neutral trouble card's ground. */
  well: '#F0ECE3',
  /** A finished step. */
  stepDone: '#C2B8A4',
  /** An unreached step, the resting field border, the disabled CTA ground. */
  stepUpcoming: '#E4DED2',
  /** A field at rest, and a code box holding a digit. */
  fieldGround: '#FFFFFF',
  /** A field whose control is busy — sending, saving, verifying. */
  fieldBusy: '#F7F4EE',
  /**
   * A placeholder, a disabled CTA's label, a digit under verification. See the
   * header: this is the disabled/busy exemption, spent deliberately.
   */
  quiet: '#A39B8B',
  /**
   * The refusal tone — a malformed address, a code that does not match.
   *
   * NOT the palette's `accentWarm` (#B08A76, 2.61:1), which the contrast law
   * bars from carrying type. This is a darker sibling at 4.80:1 on paper and
   * 5.01:1 on a white code box, so it clears AA_TEXT as drawn. It is separate
   * from `oxblood` on purpose: oxblood is the ACTION colour on these screens
   * (every filled CTA, every link), and a refusal painted in the same red as
   * the button beneath it reads as decoration rather than a warning.
   */
  refusal: '#A85A3C',
  /** The amber trouble card — something outside the user's control went wrong. */
  troubleAmber: '#F4E9D8',
  /** Its eyebrow, darkened from the frame's #8A6B2B for AA. See the header. */
  troubleAmberEyebrow: '#7E6127',
  /** The neutral trouble card's eyebrow — the palette's `muted`. */
  troubleNeutralEyebrow: '#6B665C',
} as const;

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

/**
 * Transcribed from the approved frames at their 2.01× render scale, rounded to
 * the point. The horizontal padding is 24 on all three paper screens; the code
 * boxes alone bleed 4pt wider on each side, which is how six 53pt boxes fit a
 * 393pt screen without shrinking below the frame.
 */
export const PAD = 24;
/** The header row's own inset — the back well is optically flush, not aligned. */
export const HEADER_PAD = 16;
export const BACK_SIZE = 44;
export const BACK_RADIUS = 14;

export const STEP_WIDTH = 22;
export const STEP_HEIGHT = 3;
export const STEP_GAP = 5;

export const HEADLINE_SIZE = 40;
export const SUBLINE_SIZE = 16;
export const STATUS_SIZE = 15;
export const LEGAL_SIZE = 13;
export const EYEBROW_SIZE = 11;
export const CARD_BODY_SIZE = 16;

export const FIELD_HEIGHT = 60;
export const FIELD_RADIUS = 16;
export const FIELD_BORDER = 1.5;
export const FIELD_TEXT_SIZE = 19;

/**
 * The one filled CTA. 54 at the default setting; 64 once the label itself needs
 * the room. Height is the only thing that grows — the frame is explicit that
 * nothing is capped, truncated or scaled down.
 */
export const CTA_HEIGHT = 54;
export const CTA_HEIGHT_AX = 64;
export const CTA_LABEL_SIZE = 17;

export const BOX_HEIGHT = 66;
export const BOX_RADIUS = 16;
export const BOX_GAP = 9;
/**
 * A CEILING on a box's width, never its width.
 *
 * The first build read 66 off the 2× frame export and set it as a fixed sixth
 * of the row, which overflowed: six boxes plus five 9pt gaps plus two 24pt
 * gutters is 447pt against a 393pt screen, so the sixth box ran off the edge.
 * The row is flexible instead — the boxes divide whatever is left after the
 * gaps and the gutters, which is ~50pt on a 393pt device and exactly what the
 * frame draws.
 *
 * The cap still earns its place at the other end: on an iPad-width canvas an
 * unbounded sixth would be 160pt, and six 160pt boxes is a keypad, not a code
 * field. It binds only above ~460pt of usable width. The wrapped
 * accessibility row is deliberately NOT capped — its frame draws boxes wider
 * than they are tall, because that is where the enlarged digit has to fit.
 */
export const BOX_MAX_WIDTH = 66;
/** Below this, `BOX_MAX_WIDTH` is slack and the flex division is what draws. */
export const NARROW_DEVICE_WIDTH = 393;
/** The code row's overhang past the text column. See PAD. */
export const BOX_BLEED = 4;

export const CARD_RADIUS = 16;
export const CARD_PAD = 18;

/** The dot that leads a busy label, and the handoff's three-dot rest mark. */
export const DOT_SIZE = 5;
export const DOT_GAP = 9;

/**
 * The setting at which the code row stops being one line of six.
 *
 * Reused rather than redeclared — `AX_STACK_SCALE` is already the app's single
 * "this is where compositions change" threshold, and a second number here would
 * make the auth run relayout at a different moment from every other screen.
 */
export { AX_STACK_SCALE } from '@/features/closet/dynamic-type';

/**
 * Six boxes in one row, or three-by-two.
 *
 * The largest-accessibility-text frame draws the wrap, and it has to: a digit
 * set at 1.8× needs a box wider than a sixth of the screen, and the alternative
 * to wrapping is shrinking the digit — which is the one thing the frame's
 * accessibility note forbids. Two rows of three, never two of two-and-four.
 */
export const CODE_LENGTH = 6;
export const CODE_ROW_COLUMNS = 3;

/**
 * Email and SMS clients commonly copy codes with spaces, punctuation or a
 * short label attached. Normalise before applying the six-digit ceiling so a
 * paste such as `123 456` does not lose its final digit.
 */
export function codeDigits(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, CODE_LENGTH);
}

export function codeColumns(large: boolean): number {
  return large ? CODE_ROW_COLUMNS : CODE_LENGTH;
}

// ---------------------------------------------------------------------------
// Copy — email
// ---------------------------------------------------------------------------

export const EMAIL_HEADLINE = 'What’s your email?';
export const EMAIL_SUBLINE = 'We’ll send a six-digit code.';
export const EMAIL_PLACEHOLDER = 'you@example.com';
export const EMAIL_FIELD_LABEL = 'Email address';
export const EMAIL_INVALID = 'That doesn’t look like an email address.';
export const EMAIL_CTA = 'Send code';
export const EMAIL_CTA_SENDING = 'Sending…';
export const LEGAL_PREFIX = 'By continuing you agree to our ';

// ---------------------------------------------------------------------------
// Copy — phone
// ---------------------------------------------------------------------------

/**
 * Whether the welcome screen offers the phone door at all.
 *
 * FALSE until the Twilio provider is connected in Supabase's dashboard and the
 * toll-free number is carrier-verified — a visible door into a flow whose
 * texts cannot send would fail every user who chose it. The phone screens
 * ship dark behind this flag (reachable by route, drawn nowhere), so flipping
 * it is a one-line OTA once the provider is live.
 */
export const PHONE_SIGN_IN_ENABLED = false;

export const PHONE_STEP: RunStep = 1;
export const PHONE_HEADLINE = 'What’s your number?';
/**
 * The ordinary subline — `email.tsx`'s own shape (one short line, the same
 * size as every other run screen's), rather than the full consent paragraph.
 * P2 #41: that paragraph "gives the SMS legal explanation nearly the same
 * visual weight as the action" when it sits in this slot; `PHONE_SUBLINE`
 * below still carries the required wording, just as a footnote near the
 * legal links rather than as the headline's own supporting line.
 */
export const PHONE_TAGLINE = 'We’ll text a one-time six-digit code to this number.';
// Twilio toll-free verification requires the opt-in screen to carry the full
// consent disclosure: brand name, message purpose, frequency, rates, HELP/STOP.
// Rendered as a compact footnote beside the Terms/Privacy line, not as the
// screen's headline subline — see `PHONE_TAGLINE` and `phone.tsx`.
export const PHONE_SUBLINE =
  'Cinch will text a one-time six-digit sign-in code to this number. Message frequency varies by sign-in. Message and data rates may apply. Reply HELP for help or STOP to opt out.';
// An example the validator itself would accept — NANP forbids an exchange
// starting with 0/1, so the film-famous (555) 123-4567 would be refused.
export const PHONE_PLACEHOLDER = '(555) 234-5678';
export const PHONE_FIELD_LABEL = 'Phone number';
export const PHONE_INVALID = 'That doesn’t look like a phone number.';
export const PHONE_CTA = 'Send code';
export const PHONE_CTA_SENDING = 'Sending…';

export function phoneSendFailedTrouble(): Trouble {
  return {
    tone: 'amber',
    eyebrow: 'COULDN’T SEND THE CODE',
    body: 'Nothing was sent to that number. Your account is fine.',
    action: TRY_AGAIN,
  };
}

// ---------------------------------------------------------------------------
// Copy — code
// ---------------------------------------------------------------------------

export const CODE_HEADLINE = 'Enter the code';
export const CODE_CHANGE = 'Change email';
export const CODE_CHANGE_PHONE = 'Change number';
export const CODE_RESEND_PROMPT = 'Didn’t get it?';
export const CODE_RESEND_ACTION = 'Resend code';
export const CODE_RESENDING = 'Sending a new code…';
export const CODE_CHECKING = 'Checking…';

export function sentToLine(email: string): string {
  return `Sent to ${email}`;
}

export function resentToLine(email: string): string {
  return `A new code is on its way to ${email}`;
}

/**
 * The countdown, in the frame's own grammar — "47s", not "0:47".
 *
 * The clock face said "you are being timed"; the bare seconds say "this is
 * nearly over", which is the truthful reading of a sixty-second wait. The
 * duration itself is untouched: `RESEND_COOLDOWN_S` is the shipped 60.
 */
export const RESEND_COOLDOWN_S = 60;

export function cooldownLine(secondsLeft: number): string {
  return `You can ask for another code in ${Math.max(1, Math.ceil(secondsLeft))}s.`;
}

/** Three tries per code, counted down out loud rather than hidden. */
export const MAX_ATTEMPTS = 3;

const TRY_WORDS: Record<number, string> = { 2: 'Two tries left', 1: 'One try left' };

/**
 * The wrong-code line. Spelt-out numbers to two, because "2 tries left" reads
 * like a scoreboard and this is a sentence somebody is being told.
 */
export function wrongCodeLine(attemptsLeft: number): string {
  if (attemptsLeft <= 0) return 'That code isn’t right. Send another to try again.';
  return `That code isn’t right. ${TRY_WORDS[attemptsLeft] ?? `${attemptsLeft} tries left`}.`;
}

// ---------------------------------------------------------------------------
// Copy — name
// ---------------------------------------------------------------------------

export const NAME_HEADLINE = 'What should we call you?';
export const NAME_SUBLINE = 'A first name is enough.';
export const NAME_PLACEHOLDER = 'First name';
export const NAME_FIELD_LABEL = 'First name';
export const NAME_CTA = 'Continue';
export const NAME_CTA_SAVING = 'Saving…';

// ---------------------------------------------------------------------------
// Copy — handoff
// ---------------------------------------------------------------------------

/**
 * The arrival, on full oxblood.
 *
 * The shipped screen greeted a new account by the hour ("Good evening, Priya").
 * The frame replaces that with a welcome, and it is right to: the hour is a
 * fact about the clock, and the first thing a brand-new account should be told
 * is that it has arrived somewhere. `greetingForHour` is untouched and still
 * serves Today, which is where a time-of-day greeting actually earns its place.
 */
export function handoffHeadline(isNew: boolean, name: string | null): string {
  const base = isNew ? 'Welcome to Cinch' : 'Welcome back';
  return name ? `${base}, ${name}.` : `${base}.`;
}

export function handoffSubline(isNew: boolean): string {
  return isNew ? 'Let’s put a few pieces in your closet.' : 'Your closet is where you left it.';
}

/** The held beat, unchanged from the shipped screen. */
export const NEW_BEAT_MS = 1900;
export const RETURNING_BEAT_MS = 1400;
export const REDUCED_BEAT_MS = 900;

export function beatMs(isNew: boolean, reduced: boolean): number {
  if (reduced) return REDUCED_BEAT_MS;
  return isNew ? NEW_BEAT_MS : RETURNING_BEAT_MS;
}

// ---------------------------------------------------------------------------
// Trouble — the card, and which one to draw
// ---------------------------------------------------------------------------

/**
 * The tone is a claim about BLAME, not about severity.
 *
 * `amber` says something went wrong out there and the user may retry — so the
 * card carries the retry button. `neutral` says the system is working
 * correctly and is asking for patience — a rate limit, an expired code — so
 * there is either nothing to press or the press is "send a fresh one", never
 * "try the same thing again".
 */
export type TroubleTone = 'amber' | 'neutral';

export type Trouble = {
  readonly tone: TroubleTone;
  readonly eyebrow: string;
  readonly body: string;
  /** The filled button inside the card. `null` when there is nothing to press. */
  readonly action: string | null;
};

export const TRY_AGAIN = 'Try again';
export const SEND_NEW_CODE = 'Send a new code';

/** The rate-limit window Supabase enforces, and the sentence has always named. */
export const RATE_LIMIT_S = 300;

/**
 * "Try again in 4 minutes" — the frame's own line, and the reason it counts.
 *
 * The shipped copy said "five minutes" flat, which is a number that is wrong
 * for all but the first second of the wait. Counting is presentation over the
 * SAME constant: nothing here calls the server, shortens the window, or decides
 * whether a send is allowed. When the count reaches zero the screen simply
 * stops refusing and the next press goes through `sendEmailCode` exactly as
 * before.
 */
export function rateLimitBody(secondsLeft: number): string {
  const minutes = Math.max(1, Math.ceil(secondsLeft / 60));
  const unit = minutes === 1 ? 'minute' : 'minutes';
  return `Try again in ${minutes} ${unit}. Codes already sent still work.`;
}

export function offlineTrouble(): Trouble {
  return {
    tone: 'amber',
    eyebrow: 'YOU’RE OFFLINE',
    body: 'Sending a code needs a connection. Nothing has been sent.',
    action: TRY_AGAIN,
  };
}

export function sendFailedTrouble(): Trouble {
  return {
    tone: 'amber',
    eyebrow: 'COULDN’T SEND THE CODE',
    body: 'Nothing was sent to that address. Your account is fine.',
    action: TRY_AGAIN,
  };
}

export function rateLimitedTrouble(secondsLeft: number): Trouble {
  return {
    tone: 'neutral',
    eyebrow: 'TOO MANY REQUESTS',
    body: rateLimitBody(secondsLeft),
    action: null,
  };
}

export function expiredTrouble(): Trouble {
  return {
    tone: 'neutral',
    eyebrow: 'CODE EXPIRED',
    body: 'That code has run out. Send a fresh one and we’ll try again.',
    action: SEND_NEW_CODE,
  };
}

export function resendFailedTrouble(): Trouble {
  return {
    tone: 'amber',
    eyebrow: 'COULDN’T SEND ANOTHER CODE',
    body: 'The code already in your inbox still works if you have it.',
    action: TRY_AGAIN,
  };
}

export function nameFailedTrouble(): Trouble {
  return {
    tone: 'amber',
    eyebrow: 'COULDN’T SAVE THAT',
    body: 'You’re signed in either way — this is only your name.',
    action: TRY_AGAIN,
  };
}

/**
 * A failure that was THROWN rather than returned — the storage layer escaping.
 *
 * It keeps `describeThrownSignInError`'s sentence as the body rather than
 * flattening it into one of the cards above, because that sentence is the only
 * thing that distinguishes "no keychain access" from "the network died", and
 * the shipped screens were explicit that it must surface rather than be silent.
 */
export function thrownTrouble(message: string): Trouble {
  return { tone: 'amber', eyebrow: 'SOMETHING WENT WRONG', body: message, action: TRY_AGAIN };
}

/**
 * Whether the screen's own CTA is still on show.
 *
 * A card that carries its own button IS the call to action — drawing the outer
 * one underneath it would put two filled oxblood buttons on a screen the brief
 * says gets exactly one. A card without a button (the rate limit) leaves the
 * outer CTA in place, disabled, so the screen still shows what it is for.
 */
export function showsOwnCta(trouble: Trouble | null): boolean {
  return trouble === null || trouble.action === null;
}
