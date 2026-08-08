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
} as const;

export type PlacementName = (typeof Placement)[keyof typeof Placement];
