/**
 * Membership tiers, client copy.
 *
 * MIRRORS the server. The enforcing copies are:
 *   - supabase/functions/_shared/plans.ts   (AI allowances)
 *   - migration 20260805160000              (closet size, in the database)
 *
 * Nothing here is a control. The client cannot be trusted to stop at a limit —
 * a user with a proxy simply calls the Edge Function directly, and items are
 * inserted straight into Postgres. These numbers exist so the UI can *say* what
 * the limit is without a round trip, and so a user hits a designed screen
 * instead of an error the moment they cross it.
 *
 * Change these only alongside the two files above. Drifting numbers show up as
 * "Cinch told me I had 5 left and then refused", which reads as a bug rather
 * than a boundary.
 */

export type Plan = 'free' | 'standard' | 'pro';

export interface PlanCopy {
  readonly name: string;
  /**
   * The ACTIVE closet — what Cinch styles from and what the grid shows.
   * Archived pieces are excluded. Mirrors item_limit_for_plan().
   */
  readonly items: number;
  /**
   * Every row the account holds, stored pieces included. Mirrors
   * item_total_limit_for_plan().
   *
   * Two numbers rather than one because storing a piece has to genuinely make
   * room — a closet whose only exit is payment is the failure The Wall was
   * designed to avoid — while "archive everything" must not become unlimited
   * free storage. Three times the active limit is the compromise: curating ten
   * out of a real wardrobe works, holding a thousand does not.
   */
  readonly storedItems: number;
  /**
   * What the UI promises for outfit suggestions. Deliberately BELOW the server
   * ceiling — the server keeps slack so a failed provider call does not spend a
   * free user's whole week. See the note in the server's plans.ts.
   */
  readonly outfits: string;
  /**
   * The same promise as a NUMBER, for the sentences that have to say it out
   * loud rather than describe it.
   *
   * `outfits` above is a display phrase and cannot be interpolated into
   * "That's this week's N outfits" — which is why that line carried a literal
   * "three" until 2026-08-10 (positioning-contract.md §7 catalogues it). The
   * phrase and the number are the same fact stated twice, so they move
   * together or not at all.
   *
   * This is the PRODUCT PROMISE, deliberately below the enforced ceiling, for
   * the reason spelled out at length in supabase/functions/_shared/plans.ts:
   * free is promised three a week and allowed five, and the gap is the slack
   * that survives a failed provider call. Quote the promise to users; never
   * the ceiling. `tests/plans.test.ts` holds the promise under the ceiling.
   *
   * Null on Pro, which promises no number at all — "Unlimited" is the whole
   * copy, and inventing a figure to fill this in would contradict it.
   */
  readonly outfitPromise: { readonly count: number; readonly period: 'day' | 'week' } | null;
  readonly stylist: string;
  /**
   * Upcoming, un-canceled events the user may HOST at once. Mirrors
   * event_limit_for_plan() in migration 20260807103000 — change one, change
   * the other (supabase/tests/06_event_boundary.sql and tests/plans.test.ts
   * are the tripwires). Hosting is the only social act that is plan-gated:
   * joining, posting, voting, commenting and borrowing are free on every
   * tier, because a group feature is only as good as its weakest member's
   * tier.
   */
  readonly eventHosting: number;
  /** Null on free; filled from StoreKit once billing ships, not hard-coded. */
  readonly monthlyPriceHint: string | null;
  /**
   * The yearly price, for surfaces that quote both — K-01's gate says
   * "$14.99/mo · $119/yr" exactly as the atlas draws it.
   *
   * A HINT, like the monthly one, and for the same reason: the paywall itself
   * reads StoreKit and formats in the device locale, because a price typed
   * into a layout is wrong in every country but one. These two exist so a
   * screen can name the tier without a round trip. Verified against the
   * Superwall products on 2026-08-09 — cinch.pro.annual $119.00,
   * cinch.standard.annual $59.00.
   */
  readonly annualPriceHint: string | null;
}

/**
 * `satisfies` rather than a `Record<Plan, PlanCopy>` annotation, so that
 * `PLANS.free.outfitPromise` reads as the object it is instead of
 * `… | null`. Every tier is still checked against `PlanCopy` — the constraint
 * is enforced, it is just not allowed to widen the free tier's promise back
 * into a maybe that `context-lines.ts` would then have to assert away.
 * `PLANS[plan]` still types as a `PlanCopy` for every `Plan`.
 */
export const PLANS = {
  free: {
    name: 'Free',
    items: 10,
    storedItems: 30,
    outfits: 'A few each week',
    // Three a week, against an enforced five — see the field's own note.
    outfitPromise: { count: 3, period: 'week' },
    stylist: 'Not included',
    eventHosting: 2,
    monthlyPriceHint: null,
    annualPriceHint: null,
  },
  standard: {
    name: 'Standard',
    items: 150,
    storedItems: 450,
    outfits: 'A fresh outfit every day',
    outfitPromise: { count: 1, period: 'day' },
    stylist: '30 messages a month',
    eventHosting: 15,
    monthlyPriceHint: '$7.99',
    annualPriceHint: '$59',
  },
  pro: {
    name: 'Pro',
    items: 1000,
    storedItems: 3000,
    outfits: 'Unlimited',
    outfitPromise: null,
    stylist: 'Unlimited',
    eventHosting: 100,
    monthlyPriceHint: '$14.99',
    annualPriceHint: '$119',
  },
} as const satisfies Record<Plan, PlanCopy>;
