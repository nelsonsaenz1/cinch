/**
 * UX-07 — the haptic policy, as the only door onto expo-haptics.
 *
 * The rule the research states is one sentence: "Haptics are limited to
 * committed state changes, selection, success, and destructive confirmation —
 * not routine navigation." What the app had instead was 48 direct calls across
 * 21 files, every one of them deciding for itself, and the decision each made
 * was invisible at the call site: `Haptics.impactAsync(Heavy)` says how strong,
 * never what happened.
 *
 * So this module exports INTENTS, not strengths. `commit()` is a fact about the
 * app — a write landed — and which taptic engine call expresses it is this
 * file's business and nobody else's. That inversion is what makes the policy
 * checkable: `tests/haptic-policy.test.ts` can assert "no product file imports
 * expo-haptics directly" and "there is no navigation intent to reach for",
 * neither of which is expressible against 48 scattered `impactAsync` calls.
 *
 * ── The refusal ──────────────────────────────────────────────────────────────
 *
 * There is deliberately no `navigate()`, no `open()`, no `tap()`. A tab change,
 * a push, a sheet presentation and a scroll all arrive with their own system
 * feedback, and adding a tick to them is the texture Apple's HIG warns about:
 * "overusing haptics can dilute their meaning". If a future call site wants a
 * tick for navigation, it has to add the intent here and argue with this
 * paragraph and with the test.
 *
 * ── Why every call is fire-and-forget ────────────────────────────────────────
 *
 * Haptics silently no-op in Low Power Mode, when Taptic is disabled in
 * Settings, while a camera session is active, and on any device without a
 * Taptic Engine. They also reject rather than resolve on some of those paths.
 * A haptic is therefore NEVER the feedback — it is a garnish on feedback that
 * already exists visually — and a rejected promise must never reach the user or
 * eat the press. Each function swallows its own failure and returns `void`, not
 * a promise, so no call site can accidentally `await` a garnish.
 *
 * There is also no Reduce Motion branch here, and that is correct rather than an
 * omission: Reduce Motion governs on-screen movement. The system setting that
 * governs haptics is the Taptic toggle itself, and iOS applies it below this
 * layer — which is precisely why these calls no-op rather than needing a guard.
 * `usePressFeedback` is where the motion half of UX-07 lives.
 *
 * SDK 57 surface used (docs.expo.dev/versions/v57.0.0/sdk/haptics):
 * `selectionAsync()`, `impactAsync(ImpactFeedbackStyle)`,
 * `notificationAsync(NotificationFeedbackType)`. `performAndroidHapticsAsync`
 * is Android-only and unused — the app is iOS-first and the three above are
 * cross-platform.
 */

import * as Haptics from 'expo-haptics';

/** Best-effort by construction. See the header: a haptic is never the feedback. */
const fire = (run: () => Promise<void>) => {
  try {
    void run().catch(() => {});
  } catch {
    // A synchronous throw from the native module — an unsupported platform,
    // typically. Same answer as a rejection: nothing happens, nobody is told.
  }
};

/**
 * The intents. Named for what HAPPENED, never for how hard it buzzes.
 *
 * Grouped into one object rather than exported as loose functions so a call site
 * reads `haptics.commit()` — the noun makes it obvious at a glance that a policy
 * is being spent, and it keeps the census in the policy test to a single
 * identifier.
 */
export const haptics = {
  /**
   * A selection changed — a chip toggled, a segment moved, a colour picked, a
   * button that commits something discrete.
   *
   * The lightest of the three, and the only one that may fire on a mere tap:
   * `selectionAsync` maps to UISelectionFeedbackGenerator, which iOS itself
   * reserves for a value changing under the finger.
   */
  selection() {
    fire(() => Haptics.selectionAsync());
  },

  /**
   * A committed state change with weight behind it — a garment saved, an RSVP
   * sent, an outfit worn, a multi-select entered.
   *
   * `Light`, not `Medium`. The default is Medium and it is too much for a write
   * that also produces a visible result; the tick is confirming the finger's
   * timing, not announcing the write.
   */
  commit() {
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  },

  /**
   * An operation SUCCEEDED after being in doubt — an upload finished, a sync
   * landed, an invite was accepted.
   *
   * Not for every successful write: a save that was never going to fail does not
   * need announcing, and `commit()` is the tick for those. Reserve this for the
   * ones where the user was waiting.
   */
  success() {
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  },

  /**
   * A recoverable problem the user has to notice — a validation refusal, an
   * upload that needs retrying.
   *
   * Pairs with an INLINE message or a NoticeBand, per UX-08; a warning buzz with
   * nothing on screen to read is a riddle. See `components/ui/feedback.ts`.
   */
  warning() {
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  },

  /**
   * An operation FAILED and the user's intent did not happen.
   *
   * Same pairing rule as `warning()`: the recovery must be readable and
   * reachable on screen. The haptic marks the moment; it never carries the news.
   */
  failure() {
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
  },

  /**
   * The confirmation tap on a DESTRUCTIVE, irreversible act — deleting a
   * garment, deleting an account, leaving an event for good.
   *
   * `Heavy`, and the only Heavy in the app. It fires on the confirm inside the
   * alert or sheet, never on the button that OPENS it: the opening tap is a
   * navigation, and giving it the destructive weight teaches the user to fear a
   * control that is still perfectly safe.
   */
  destructiveConfirm() {
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
  },
} as const;

export type HapticIntent = keyof typeof haptics;
