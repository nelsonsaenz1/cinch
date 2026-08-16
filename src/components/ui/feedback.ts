/**
 * UX-08 / DE-08 — the feedback hierarchy, as a decision anyone can run.
 *
 * The repository audit counted 43 blocking `Alert.alert` calls. Most of them are
 * not decisions: they are a failed upload, a copied link, a saved edit — news
 * the user can read and act on in place, delivered instead by a modal that stops
 * the app, steals focus, and has to be dismissed before the thing it is talking
 * about can even be seen again.
 *
 * The implementation plan is explicit that this is "a criterion-driven call-site
 * inventory", not a sweep, and that "uninventoried safety-critical blocking
 * behaviour remains unchanged". So this file is the CRITERION, and it is
 * deliberately not a component: the integration owner's job is the shared rule,
 * and the route-local migrations belong to the lanes that own those routes. A
 * worker classifies a call site by answering four questions here, and the answer
 * is the same answer every other lane would have got.
 *
 * ── The order, and why it is this order ──────────────────────────────────────
 *
 * The questions are asked most-restrictive first, because every surface below
 * the one that fits is cheaper for the user and none of them is a safe default:
 *
 *   1. Is it DESTRUCTIVE or irreversible?      → blocking alert
 *   2. Is it a CHOICE between named options?   → sheet
 *   3. Does it BLOCK the user's task until
 *      they act, or is it about a specific
 *      field they can see?                     → inline
 *   4. Is it a recoverable failure of the
 *      surface as a whole?                     → NoticeBand
 *   5. Otherwise — success, low-risk
 *      confirmation                            → toast
 *
 * ── The refusals ─────────────────────────────────────────────────────────────
 *
 * · A blocking alert is for a decision with consequences, never for news. "Your
 *   photo failed to upload" is news; it belongs where the photo is, with the
 *   retry attached.
 * · The recovery action is never hidden. A toast that reports a failure has to
 *   carry the retry, which is why `needsRecovery` forces anything failing out of
 *   `toast` — a five-second window is not somewhere to put the only way back.
 * · Success is never blocking. Not one of the 43 needs a tap to acknowledge that
 *   something worked.
 * · Nothing here is silent. Every surface this returns is announced: `Toast` is
 *   `accessibilityRole="alert"`, `NoticeBand` is `accessibilityLiveRegion=
 *   "polite"`, and an inline message under a field is reached by focus order.
 */

/**
 * Where a piece of feedback belongs.
 *
 * `alert` is `Alert.alert`; `sheet` is the app's existing form-sheet dialect;
 * `inline` is a message rendered next to the thing it is about; `noticeBand` is
 * `components/ui/notice-band`; `toast` is `components/ui/toast` via the host.
 */
export type FeedbackSurface = 'alert' | 'sheet' | 'inline' | 'noticeBand' | 'toast';

export type FeedbackCase = {
  /**
   * The act cannot be undone — a delete, an account closure, a permanent leave.
   *
   * The ONLY thing that earns a blocking alert. Note this is a property of the
   * ACT, not of how bad the developer feels about it: an irreversible act the
   * user explicitly asked for still gets the alert, and a reversible one does
   * not get it however alarming it sounds.
   */
  destructive?: boolean;
  /**
   * The user must pick between two or more named options that are not
   * "confirm/cancel". A menu, in other words — and a menu in a modal alert is
   * the shape iOS stopped using years ago.
   */
  choice?: boolean;
  /**
   * The message is about a specific field or row the user can see, or the task
   * genuinely cannot proceed until it is dealt with.
   */
  blocksTask?: boolean;
  /**
   * Something failed and there is a way back — a retry, a re-auth, a different
   * route. Forces the message off the toast: see the refusals above.
   */
  needsRecovery?: boolean;
  /**
   * The message concerns one nameable field rather than the surface as a whole.
   * Splits `inline` from `noticeBand` — a bad handle belongs under the handle
   * field; "planning failed" belongs across the top of the plan.
   */
  fieldScoped?: boolean;
};

/**
 * Classify one call site. Total, deterministic, and the whole of the rule.
 *
 * Pure and dependency-free on purpose: this is the thing three lanes have to
 * agree on, so it must be runnable in a test rather than quoted from a doc. See
 * `tests/feedback-hierarchy.test.ts`, which walks the truth table.
 */
export function feedbackSurface(kase: FeedbackCase): FeedbackSurface {
  // 1. Irreversible. The one blocking case, and it outranks everything —
  //    including `choice`: "Delete this, or archive it?" is still a destructive
  //    decision and still deserves the stop.
  if (kase.destructive) return 'alert';

  // 2. A menu is a sheet. Ordered above the task/recovery questions because a
  //    choice with a recoverable option in it is still a choice.
  if (kase.choice) return 'sheet';

  // 3. Field-scoped goes inline whether or not it blocks — a message about a
  //    field belongs at the field, and pulling it up into a band across the top
  //    makes the reader hunt for which of six inputs is meant.
  if (kase.fieldScoped) return 'inline';

  // 4. Blocking or recoverable, about the surface as a whole: the band. It
  //    persists, it names a CAUSE as a word, and it can carry up to two peer
  //    recoveries.
  if (kase.blocksTask || kase.needsRecovery) return 'noticeBand';

  // 5. Everything left is success or low-risk confirmation. Nothing was lost,
  //    nothing needs deciding, and there is nothing to recover — so it may pass
  //    without a tap.
  return 'toast';
}

/**
 * The sentence to put in a review comment when a call site changes surface.
 *
 * Exists because "this should be a toast" is an assertion and this is an
 * argument — and because the alert inventory is being carried out by three
 * lanes who each need to justify the same move to the same reviewer.
 */
export function feedbackRationale(kase: FeedbackCase): string {
  const surface = feedbackSurface(kase);
  switch (surface) {
    case 'alert':
      return 'Irreversible — a blocking alert is correct and stays.';
    case 'sheet':
      return 'A choice between named options; a menu belongs in a sheet, not a modal alert.';
    case 'inline':
      return 'Scoped to one field — the message belongs at the field, where the fix is.';
    case 'noticeBand':
      return kase.needsRecovery
        ? 'Recoverable failure of the whole surface — NoticeBand keeps the recovery visible and persistent.'
        : 'Blocks the task — NoticeBand states the cause and persists until it is dealt with.';
    case 'toast':
      return 'Success or low-risk confirmation: nothing lost, nothing to decide, nothing to recover.';
  }
}
