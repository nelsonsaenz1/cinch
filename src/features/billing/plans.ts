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
  /** Closet size. Mirrors item_limit_for_plan(). */
  readonly items: number;
  /**
   * What the UI promises for outfit suggestions. Deliberately BELOW the server
   * ceiling — the server keeps slack so a failed provider call does not spend a
   * free user's whole week. See the note in the server's plans.ts.
   */
  readonly outfits: string;
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
}

export const PLANS: Record<Plan, PlanCopy> = {
  free: {
    name: 'Free',
    items: 10,
    outfits: 'A few each week',
    stylist: 'Not included',
    eventHosting: 2,
    monthlyPriceHint: null,
  },
  standard: {
    name: 'Standard',
    items: 150,
    outfits: 'A fresh outfit every day',
    stylist: '30 messages a month',
    eventHosting: 15,
    monthlyPriceHint: '$7.99',
  },
  pro: {
    name: 'Pro',
    items: 1000,
    outfits: 'Unlimited',
    stylist: 'Unlimited',
    eventHosting: 100,
    monthlyPriceHint: '$14.99',
  },
} as const;
