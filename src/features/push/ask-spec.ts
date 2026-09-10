import { DEFAULT_MORNING_EDIT_TIME, morningEditLabel, type MorningEditTime } from '@/features/push/channels';
import type { PushPermission } from '@/features/push/permission';

/**
 * The morning-edit ask — the decision, the copy and the event shapes, as pure
 * data so `tests/push-ask.test.ts` can execute them.
 *
 * ── WHY THIS EXISTS (ledger A14, 2026-09-04) ──────────────────────────────
 *
 * The store binary has carried `expo-notifications` and the `aps-environment`
 * entitlement since build 43 (read from build 47's signed IPA and its
 * embedded provisioning profile on 2026-09-04), the Notifications screen has
 * been reachable from Settings the whole time, and `push_tokens` has held
 * zero rows for six nights. Nobody was ever asked. Atlas 37's rule — "the
 * system permission is requested the first time a channel is switched on,
 * not at launch and not during the tour" — was kept to the letter, and the
 * switch it refers to lives two taps into Settings where 51 people have not
 * found it.
 *
 * So this is the ask, in context: one card on Today. Turning it on IS
 * switching the channel on — the same `askPushPermission` the Settings switch
 * calls, the same `notification_prefs` row the sender's claim reads. The
 * atlas's rule holds; the switch just came to the reader.
 *
 * ── UNGATED FROM THE ACTIVATION FLOOR (ledger A44, 2026-09-05) ────────────
 *
 * The first cut drew the card only once the closet could be dressed, on the
 * reasoning that the morning edit has nothing to say before then. The 09-05
 * nightly read the consequence: three real people were running the push
 * build, all three held zero garments, `push_ask_shown` from a real person
 * was zero. The ask sat downstream of the exact step the funnel loses people
 * at, so push — the channel that exists to bring people back — could only
 * reach people who did not need bringing back.
 *
 * Now the card draws as soon as the wardrobe read has settled, floor or not,
 * and the SENTENCE moves instead of the gate: on the floor it promises the
 * edit for "when your closet is ready", which is exactly what the sender does —
 * `push_claim_morning_edit` (migration 20260905000000) claims nobody whose
 * closet is under the floor, so a grant made at zero pieces produces no note
 * until the closet clears it. The promise and the behaviour are the same
 * sentence.
 *
 * ── THE FLOOR SENTENCE, REWRITTEN (founder decision 12.9, 2026-09-10) ─────
 *
 * The first floor sentence was "Once your ten are in, tomorrow's look is
 * ready when you wake up." Read back after `push_ask_seen` existed: ten real
 * people were shown the card, nine saw it, and NONE answered — not Turn on,
 * not Not now — and eight of the ten met it on the floor, with zero to nine
 * garments. A promise about a closet the reader does not have, counted in a
 * number she has not reached, was being looked at and walked past. It was
 * also wrong for the one closet the floor holds at ten: a full but
 * undressable closet (A59) has "ten in" and still cannot be dressed. So the
 * sentence now names the state the sender actually waits for — the closet
 * being READY — the channel's own word (channels.ts: "when the day's look is
 * ready to read") — and says what the note does for it, every morning.
 *
 * ── ONCE, EVER ────────────────────────────────────────────────────────────
 *
 * Either answer ends the card for this install (AsyncStorage, the app's
 * card-dismissal idiom — see `use-trip-reminder.ts`). "Not now" does not
 * come back tomorrow: a person who declined a notification and is then asked
 * again by the same screen is being nagged, and Settings is where a changed
 * mind goes. iOS enforces the same for its own prompt.
 */

/** AsyncStorage key. One per install, never per account — a dismissal is a fact about a phone. */
export const PUSH_ASK_ANSWERED_KEY = 'cinch.push.morning-ask.answered';

/**
 * Set when iOS granted but the `notification_prefs` write did not land. The
 * sender's claim JOINS that table, so a granted permission with no row is a
 * person who said yes and will never hear from us — the card cannot come back
 * (the permission is no longer `undetermined`), so the write is retried on the
 * next Today mount instead, and the key cleared when it lands.
 */
export const PUSH_ASK_PENDING_WRITE_KEY = 'cinch.push.morning-ask.pending-write';

/**
 * What Today knows about the closet when the card is decided.
 *
 *   - `unread`  — the wardrobe read is loading or failed: not yet.
 *   - `floor`   — read, and under Today's activation floor (`belowActivationFloor`).
 *   - `usable`  — read, and the plate is drawn from it.
 *
 * The product's floor, not the engine's eight: the card's floor sentence
 * says "ten", and the sender's guard counts to ten, so the gate that picks
 * the sentence has to be the one that agrees with both.
 */
export type PushAskCloset = 'unread' | 'floor' | 'usable';

export interface PushAskInput {
  /** `PUSH_AVAILABLE` — the binary has the native module. */
  available: boolean;
  /** iOS's answer so far. `undefined` while the read is in flight. */
  permission: PushPermission | undefined;
  /** The wardrobe read's verdict — see `PushAskCloset`. */
  closet: PushAskCloset;
  /** Whether this install has answered the card. `undefined` while the read is in flight. */
  answered: boolean | undefined;
}

/**
 * Whether the card is drawn. Every `undefined` (and an unread closet) reads
 * as "not yet", so the card can only ever arrive late, never flash and
 * vanish — and never draw the wrong sentence for a closet it has not read.
 *
 * `undetermined` only: a grant means there is nothing to ask (and the
 * Settings path registers the token); a denial means iOS will not show the
 * prompt again, and a card whose action does nothing is worse than no card.
 */
export function shouldOfferPushAsk(input: PushAskInput): boolean {
  return (
    input.available &&
    input.permission === 'undetermined' &&
    input.closet !== 'unread' &&
    input.answered === false
  );
}

export const PUSH_ASK_COPY = {
  kicker: 'MORNING EDIT',
  /**
   * The promise is the channel's own description, restated in the card's
   * voice — one note, at the hour, nothing else. No numeral in the headline
   * and no urgency, the Today card's taste bar.
   *
   * Two sentences for two closets. On the floor the promise is CONDITIONAL
   * and says so — "when your closet is ready" — because that is precisely
   * when the sender starts (A44); "ready" rather than a count, because the
   * floor also holds full closets that cannot be dressed (12.9). The hour is
   * the only numeral either sentence carries, for the same taste bar.
   */
  line: (closet: Exclude<PushAskCloset, 'unread'>, at: MorningEditTime = DEFAULT_MORNING_EDIT_TIME): string =>
    closet === 'floor'
      ? `When your closet is ready, Cinch will dress it every morning. One note at ${morningEditLabel(at)}am, nothing else.`
      : `Tomorrow’s look, ready when you wake up. One note at ${morningEditLabel(at)}am, nothing else.`,
  action: 'Turn on',
  dismiss: 'Not now',
} as const;

/** `push_ask_shown`'s one property: which sentence was on screen. */
export function pushAskShownProps(
  closet: Exclude<PushAskCloset, 'unread'>,
): { closet: Exclude<PushAskCloset, 'unread'> } {
  return { closet };
}

// ---------------------------------------------------------------------------
// Seen, not mounted — ledger A48, 2026-09-06
// ---------------------------------------------------------------------------

/**
 * `push_ask_shown` fires on the card's MOUNT (on a focused Today). The 09-06
 * nightly read 13 people shown → 2 answered, and falsified "short sessions"
 * as the cause: the longest post-ask session (4.4 h) answered nothing and the
 * three heaviest importers ignored it. Two explanations were left standing —
 * seen and uninteresting, or never in the viewport — and a mount event
 * cannot tell them apart. It is the same defect A34 recorded for
 * `explore_shop_feed_loaded`, and `explore_shop_shelf_reached` is the same
 * fix: measure the card's own y against the scroll and the viewport, and
 * report `push_ask_seen` the first time enough of it is on screen.
 *
 * "Enough" is {@link PUSH_ASK_SEEN_DEPTH} points of the card past the bottom
 * of the USABLE viewport — the eyebrow and the first line of the sentence,
 * not just a sliver of tray — and the usable viewport stops
 * {@link PUSH_ASK_TAB_BAR_OCCLUSION} above the ScrollView's own bottom,
 * because the floating tab bar covers that band (the same 96 both of Today's
 * ScrollViews pad their content by for that reason). Stricter than the
 * shelf's top-edge rule on purpose: a card that was "seen" only as a hidden
 * strip under the tab bar would put the 11-person silence right back where
 * it started.
 *
 * Pure, so `tests/push-ask.test.ts` executes it — and a worklet, so the
 * happy path's UI-thread scroll handler can call it without a JS round trip
 * per frame.
 */
export const PUSH_ASK_SEEN_DEPTH = 40;
export const PUSH_ASK_TAB_BAR_OCCLUSION = 96;

export function pushAskSeen(m: {
  /** The card's y within the scroll content. */
  cardTop: number;
  /** The ScrollView's own height. */
  viewportHeight: number;
  scrollOffset: number;
}): boolean {
  'worklet';
  if (m.cardTop < 0 || m.viewportHeight <= 0) return false;
  const usableBottom = m.scrollOffset + m.viewportHeight - PUSH_ASK_TAB_BAR_OCCLUSION;
  return usableBottom >= m.cardTop + PUSH_ASK_SEEN_DEPTH;
}

// ---------------------------------------------------------------------------
// Event shapes — bounded enums and booleans, nothing else
// ---------------------------------------------------------------------------

export type PushAskAction = 'turn_on' | 'not_now';

export function pushAskAnsweredProps(action: PushAskAction): { action: PushAskAction } {
  return { action };
}

/** iOS's answer. `unsupported` never reaches analytics — no ask is ever made on that binary. */
export type PushPermissionOutcome = Exclude<PushPermission, 'unsupported'>;

export function pushPermissionResultProps(
  result: PushPermissionOutcome,
  prompted: boolean,
): { result: PushPermissionOutcome; prompted: boolean } {
  return { result, prompted };
}

/** Why a token did not land. `mint` is Expo/APNs refusing a token; `write` is the upsert. */
export type PushTokenFailure = 'mint' | 'write';

export function pushTokenRegisteredProps(
  outcome: { ok: true } | { ok: false; reason: PushTokenFailure },
): { ok: boolean; reason?: PushTokenFailure } {
  return outcome.ok ? { ok: true } : { ok: false, reason: outcome.reason };
}
