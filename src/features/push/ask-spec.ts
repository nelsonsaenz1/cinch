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
 * So this is the ask, in context: one card on Today, drawn only once the
 * closet can actually dress the reader (`canGenerate`), because the morning
 * edit has nothing to say before then. Turning it on IS switching the
 * channel on — the same `askPushPermission` the Settings switch calls, the
 * same `notification_prefs` row the sender's claim reads. The atlas's rule
 * holds; the switch just came to the reader.
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

export interface PushAskInput {
  /** `PUSH_AVAILABLE` — the binary has the native module. */
  available: boolean;
  /** iOS's answer so far. `undefined` while the read is in flight. */
  permission: PushPermission | undefined;
  /** `canGenerate(items)` and the wardrobe read settled. */
  closetUsable: boolean;
  /** Whether this install has answered the card. `undefined` while the read is in flight. */
  answered: boolean | undefined;
}

/**
 * Whether the card is drawn. Every `undefined` reads as "not yet", so the
 * card can only ever arrive late, never flash and vanish.
 *
 * `undetermined` only: a grant means there is nothing to ask (and the
 * Settings path registers the token); a denial means iOS will not show the
 * prompt again, and a card whose action does nothing is worse than no card.
 */
export function shouldOfferPushAsk(input: PushAskInput): boolean {
  return (
    input.available &&
    input.permission === 'undetermined' &&
    input.closetUsable &&
    input.answered === false
  );
}

export const PUSH_ASK_COPY = {
  kicker: 'MORNING EDIT',
  /**
   * The promise is the channel's own description, restated in the card's
   * voice — one note, at the hour, nothing else. No numeral in the headline
   * and no urgency, the Today card's taste bar.
   */
  line: (at: MorningEditTime = DEFAULT_MORNING_EDIT_TIME): string =>
    `Tomorrow’s look, ready when you wake up. One note at ${morningEditLabel(at)}am, nothing else.`,
  action: 'Turn on',
  dismiss: 'Not now',
} as const;

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
