/**
 * The moments at which a paywall may appear.
 *
 * These strings are a contract with the Superwall dashboard: a campaign matches
 * on the placement name, so a typo does not throw — it silently means "no
 * campaign matched" and the action proceeds unpaywalled. Renaming one is a
 * two-sided change, closer to a column rename than a refactor.
 *
 * WHERE THE NUMBERS LIVE, because it is not here and it is not Superwall.
 *
 * `plans.ts` holds the per-plan ceilings and `claim_ai_quota` enforces them in
 * Postgres. That is the authority, and it has to be: a limit enforced by the
 * client is a limit an attacker edits out. Superwall is not asked whether the
 * user may add a 31st garment — the server already answered that.
 *
 * So a placement is registered at the moment the server has said no, or is
 * about to. Superwall's job is deciding *what to show* at that moment — which
 * paywall, which price, which variant, whether to show one at all — and that
 * genuinely is campaign configuration, changeable without a release.
 */
export const Placement = {
  /**
   * Adding a garment the current plan has no room for.
   *
   * Registered *before* the camera opens, not after the photo is taken. Making
   * someone photograph and background-remove a jacket and then telling them
   * their closet is full is how you earn a one-star review.
   */
  AddGarmentOverLimit: 'add_garment_over_limit',

  /**
   * An outfit request past the plan's allowance — `claim_ai_quota` returning
   * exhausted for `outfit_generation`.
   */
  GenerateOutfitOverLimit: 'generate_outfit_over_limit',

  /**
   * The stylist, which free excludes outright rather than rations.
   *
   * `claim_ai_quota` distinguishes these: `plan_excluded` means the plan never
   * had it, and should offer an upgrade; exhaustion means the allowance ran out
   * and resets. Both land here, but the paywall copy should not be the same —
   * telling a free user to "try again tomorrow" describes a day that never
   * comes.
   */
  OpenStylist: 'open_stylist',

  /**
   * The 14-day trial has lapsed and the account never subscribed.
   *
   * Not tied to an action, unlike the three above — this is the general
   * "your trial ended" moment, registered on app open when `usePlan()` reports
   * `trialing` has gone false and the plan fell back to `free`.
   */
  TrialExpired: 'trial_expired',

  /**
   * Hosting an occasion past the plan's ceiling (`event_limit_for_plan()`:
   * 2 / 15 / 100).
   *
   * Same shape as the three above — the database trigger has already refused
   * the insert, so this only decides what to show. Note the Superwall campaign
   * for this one does not exist yet: an unmatched placement proceeds without a
   * paywall, and the retry meets the trigger again, so nothing is given away.
   * The moment is simply undesigned until the campaign is created.
   */
  EventHostingOverLimit: 'event_hosting_over_limit',

  /**
   * Packing — the one surface that is membership-only outright.
   *
   * THE SHAPE IS DIFFERENT FROM EVERY PLACEMENT ABOVE, and the difference is
   * the point. The others are registered *after* a server has already refused
   * something; Superwall only decides what to show. Packing has no server
   * refusal to wait for, because planning a trip is not a row in a table — it
   * is a screen. So the app itself is the gate: `usePackingAccess` reads the
   * entitlement from `usePlan()` and refuses to render the questionnaire for a
   * free account, and this placement is the conversion surface offered at that
   * moment.
   *
   * IT MUST FAIL CLOSED. An unmatched placement proceeds silently, and there is
   * currently no `packing_access` campaign in the dashboard — so if the lock
   * lived in Superwall, every free user would simply walk through. The lock
   * lives in the app; the paywall is what we show them once they are stopped.
   * The server backs this up independently: `packing-brief` claims the
   * `stylist_chat` allowance, which free is excluded from, so even a patched
   * client gets a 402 rather than a brief.
   */
  PackingAccess: 'packing_access',

  /**
   * "See plans", offered from The Repeat's third-wear panel and its exhausted
   * state (Directive 5).
   *
   * Same shape as `EventHostingOverLimit`: nothing has been refused by a
   * server here, because a repeat is not a refusal — it is a true fact about a
   * ten-piece closet's arithmetic (docs/design/free-tier-contract.md). This
   * placement is the door the copy offers once it has honestly explained why
   * the outfit repeated; if no campaign matches it yet, the tap simply does
   * nothing, same as any other unmatched placement.
   */
  RepeatUpsell: 'repeat_upsell',

  /**
   * The Reveal has just landed, and the user is looking at the number their
   * own ten pieces make (founder decision D2,
   * docs/design/positioning-contract.md §5).
   *
   * THE ONLY PLACEMENT IN THIS FILE THAT NO SERVER HAS REFUSED ANYTHING FOR,
   * and every other property of it follows from that. `add_garment_over_limit`
   * and its siblings are registered after the database has already said no, so
   * their copy can name a ceiling the user has genuinely met. Nobody has met
   * anything here. The user has photographed ten pieces, watched
   * `countOutfits()` do the arithmetic, and is — by
   * `handle_new_subscription()` in migration 20260805160000 — fourteen days
   * into a Pro trial with no limit anywhere near them.
   *
   * So this placement may not borrow the ceiling story. `context-lines.ts`
   * branches on `trialing` for exactly this moment, and the line it returns
   * says what is true: the trial has everything open, or (for an account whose
   * trial has since lapsed) the ten stay free and membership is for the next
   * piece.
   *
   * IT MUST STAY DISMISSIBLE. D2's phrasing is load-bearing — dismissing lands
   * on Today with the free tier intact, because the ten-pieces-free promise is
   * the wedge and a paywall that eats it makes the positioning a lie. Two
   * things enforce that and both matter:
   *
   *   - Paywall **254200** is `feature_gating: non_gated`, so Superwall runs
   *     the `feature()` block on dismissal as well as on purchase. A gated
   *     paywall (253377 still is one) would swallow `onGranted` on close, and
   *     a caller that navigated from `onGranted` alone would strand the user
   *     on the Reveal.
   *   - `present()` resolves on every path anyway — `granted`, `declined` or
   *     `unavailable` — so the integrator's rule is to move on whatever comes
   *     back, never to branch navigation on the outcome. See the note above
   *     `GateOutcome` in use-gate.ts.
   *
   * Campaign: **"Reveal complete" (101136)**, created 2026-08-10, audience
   * "no active Pro entitlement", 100% to paywall 254200 — the same audience
   * and the same document as the other three campaigns, so this cannot become
   * the one door that behaves differently. Note the document is still
   * unpublished (`published_at: null`), which is the standing revenue blocker
   * in docs/design/paywall-publish-runbook.md and not specific to this
   * placement: until it is published every placement here resolves to a sheet
   * that never commits a frame, and the fail-safe in use-gate.ts tears it down.
   */
  RevealComplete: 'reveal_complete',
} as const;

export type PlacementName = (typeof Placement)[keyof typeof Placement];
