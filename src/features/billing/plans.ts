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
   * are the tripwires). Posting, voting, commenting and borrowing stay free
   * on every tier, because a group feature is only as good as its weakest
   * member's tier.
   */
  readonly eventHosting: number;
  /**
   * Lifetime events a free account may ENTER — host seat or accepted invite —
   * before membership. Null = uncapped. Founder directive 2026-08-21: "3
   * events all-time until you get a paid account." The enforcing copy is
   * `event_join_limit_for_plan()` + `enforce_event_join_cap()` in migration
   * 20260826000000, counting an insert-once ledger that survives leaving and
   * event deletion — all-time means all-time. This copy exists so screens can
   * explain the boundary without a round trip; the trigger is the boundary.
   */
  readonly eventJoins: number | null;
  /** Null on free; filled from StoreKit once billing ships, not hard-coded. */
  readonly monthlyPriceHint: string | null;
  /**
   * The yearly price, for surfaces that quote both — K-01's gate quotes the
   * pair ("$9.99/mo · $79.99/yr") exactly as the atlas draws it.
   *
   * A HINT, like the monthly one, and for the same reason: the paywall itself
   * reads StoreKit and formats in the device locale, because a price typed
   * into a layout is wrong in every country but one. These two exist so a
   * screen can name the tier without a round trip. The approved 2026-08-31
   * repricing: Standard $4.99 / $39.99, Pro $9.99 / $79.99 — change these only
   * alongside the App Store Connect products, or the hint quotes a price the
   * purchase sheet contradicts.
   *
   * NO TRIAL WORDING may ever join these hints (correction 06): in-app copy
   * never states a trial duration as a constant — the paywall document reads
   * the live StoreKit offer, which is the only copy that cannot go stale.
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
    // One at a time on free (founder directive 2026-08-28, was 2). Mirrors
    // `event_limit_for_plan()` — migration 20260828170000 is the enforcing
    // copy; this one only writes the sentence.
    eventHosting: 1,
    eventJoins: 3,
    monthlyPriceHint: null,
    annualPriceHint: null,
  },
  standard: {
    name: 'Standard',
    items: 150,
    storedItems: 450,
    outfits: 'A fresh outfit every day',
    outfitPromise: { count: 1, period: 'day' },
    stylist: '5 chats a month',
    eventHosting: 15,
    eventJoins: null,
    monthlyPriceHint: '$4.99',
    annualPriceHint: '$39.99',
  },
  pro: {
    name: 'Pro',
    items: 1000,
    storedItems: 3000,
    outfits: 'Unlimited',
    outfitPromise: null,
    stylist: 'Unlimited',
    eventHosting: 100,
    eventJoins: null,
    monthlyPriceHint: '$9.99',
    annualPriceHint: '$79.99',
  },
} as const satisfies Record<Plan, PlanCopy>;
