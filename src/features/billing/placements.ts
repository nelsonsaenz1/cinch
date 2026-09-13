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
   * Joining a fourth event, ever, on the free plan —
   * `enforce_event_join_cap()` refusing the membership write. Lifetime, not
   * concurrent: the ledger behind it survives leaving and event deletion, so
   * this is the moment a free account has spent its three.
   *
   * Campaign: **105039** (created 2026-08-31), audience "pro inactive", 100%
   * to paywall 254200.
   */
  EventJoinOverLimit: 'event_join_over_limit',

  /**
   * Hosting an occasion past the plan's ceiling (`event_limit_for_plan()`:
   * 2 / 15 / 100).
   *
   * Same shape as the three above — the database trigger has already refused
   * the insert, so this only decides what to show; its campaign is live in the
   * dashboard (as of 2026-08-31). Were it ever unmatched, nothing is given
   * away: the retry meets the trigger again.
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
   * IT MUST FAIL CLOSED. An unmatched placement proceeds silently — so if the
   * lock lived in Superwall, one campaign misconfiguration would let every
   * free user simply walk through. The lock lives in the app (the
   * `packing_access` campaign is live as of 2026-08-31, but the lock must not
   * depend on it); the paywall is what we show them once they are stopped.
   * Since 2026-09-03 nothing server-side backs this up — `packing-brief` was
   * deleted and the memo is computed on the device — so the app-side lock is
   * the whole lock.
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
   * the one door that behaves differently. The document is published (since
   * 2026-08-17 — docs/design/paywall-publish-runbook.md is satisfied), so the
   * sheet commits frames everywhere; the fail-safe in use-gate.ts remains for
   * genuine load failures.
   */
  RevealComplete: 'reveal_complete',

  /**
   * MB-09 — Standard → Pro, offered from Manage membership.
   *
   * THE SECOND PLACEMENT NO SERVER HAS REFUSED ANYTHING FOR, and unlike
   * `reveal_complete` the person on the other side of it is already paying. An
   * existing member is not at a ceiling; they are being shown a delta, which
   * is why MB-08 draws three entitlement rows out of `plans.ts` and stops.
   *
   * WHY THE TERMS ARE NOT IN THE APP. The atlas draws MB-09 with two term rows
   * whose price positions are "live StoreKit reads", and this app has no
   * StoreKit module — every price it has ever shown came from Superwall
   * rendering its own document. So the app draws the deltas, which it can
   * source, and the CTA opens this placement; the prices, the periods and the
   * purchase itself live on paywall 254200 (Cinch Membership v3), which
   * carries all four products. Nothing about a price or a period is typed into
   * a layout, which is the atlas's actual requirement rather than its sketch.
   *
   * NO TRIAL IS DRAWN BY THE APP. Correction 06 forbids drawing a default
   * trial anywhere in a layout. The products' own offers have moved twice
   * since 2026-08-12 (when all four were `trial_period_days: null`):
   * `cinch.standard.annual` carried a 1-week StoreKit FREE_TRIAL from
   * 2026-08-31, and the 2026-09-10 affordable-membership decision puts the
   * two MONTHLY products ($0.99 Standard, $2.99 Pro) on the primary paywall
   * with no trial at all — the useful free experience precedes a clearly
   * disclosed monthly purchase. Whatever the offer, the paywall document reads
   * it from StoreKit; nothing here states one.
   *
   * Campaign: **"Membership upgrade" (101571)**, created 2026-08-12, audience
   * "no active Pro entitlement" — the same rule as the other four, so the
   * upgrade door is not the one door that behaves differently — 100% to
   * paywall 254200.
   *
   * 254200 is published (since 2026-08-17), so the sheet loads normally.
   * Should it ever fail to, that is not silent here: MB-09 branches on
   * `unavailable` and says so, rather than leaving a button that appears to
   * do nothing.
   */
  MembershipUpgrade: 'membership_upgrade',

  /**
   * RETIRED FROM THE APP 2026-09-10 (A68). No call site presents this any
   * more: the beat it named put every real person's first paywall before her
   * first outfit (4 of 4 lifetime, 0 bought), and the caps' pair rule then
   * silenced `reveal_complete` — the ask that follows the outfit — for a day.
   * The name is kept so the ledger's historical rows keep counting toward the
   * caps and the Superwall campaign (105047) keeps its placement; the first
   * general ask is now `reveal_complete`. The original rationale follows.
   *
   * The Ten has just completed — the moment the closet became real and BEFORE
   * the Reveal starts, independent of it. A dismissible Standard-trial offer:
   * the person has done the work, the number is coming, and this is the one
   * beat between the two where an ask does not interrupt anything.
   *
   * NOTHING HAS BEEN REFUSED HERE, same family as `reveal_complete`, so the
   * same rules bind it: it must stay dismissible, and dismissal continues
   * straight into the Reveal — the ten-pieces-free promise is the wedge, and
   * the Reveal is what was promised. A paywall failure must NEVER block the
   * Reveal either: the integrator goes through `presentPromo()`
   * (present-promo.ts), which resolves on every path — `unavailable`, a
   * thrown SDK error, a cap refusal — so the Reveal proceeds whatever
   * Superwall did or did not draw.
   *
   * A GENERAL PROMO, so `promo-caps.ts` counts it: at most one general ask per
   * rolling day, three per rolling week, and specifically never this and
   * `reveal_complete` back to back — two asks bracketing the Reveal would read
   * as a toll booth on both ends of the same road.
   */
  TenCompleted: 'ten_completed',

  /**
   * A qualified return offer — around day 3 and day 7 — for a free account
   * that never started a trial and has been SHOWN its Reveal —
   * `profiles.reveal_seen_at`, which the Reveal stamps on delivery (ledger A78,
   * 2026-09-13: an outfit COUNT is arithmetic, the stamp is delivery, and the
   * ask was firing on the first). Both qualifications are the point: someone
   * who has seen their own closet dressed knows what the product does, and someone who never
   * trialed has not already told us no.
   *
   * NOT A REFUSAL EITHER — nothing was denied on day 3; the app chose the
   * moment. Which is exactly why it goes through `presentPromo()` and its
   * caps rather than bare `gate.present()`: an offer the app initiates is the
   * kind that becomes nagging, and the caps are the difference. The day-3 /
   * day-7 scheduling itself lives at the call site (it needs the account's
   * clock); this placement is the door, `promo-caps.ts` is the restraint.
   */
  ReturningFree: 'returning_free',
} as const;

export type PlacementName = (typeof Placement)[keyof typeof Placement];
