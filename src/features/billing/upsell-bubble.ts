import { PLANS, type Plan } from './plans';

/**
 * The free-tier bubble Today opens with — what it says, to whom, and how often.
 *
 * Founder order, 2026-08-18: a free account opening the app should be told, once,
 * what its membership actually is and what changing it would do. Everything hard
 * about that request is honesty, so the decision and the copy live here as pure
 * functions with no React and no hooks in them — the component draws what this
 * returns, and `tests/upsell-bubble.test.ts` can check every plan state without a
 * renderer, a session or a Superwall key.
 *
 * ── THE MEMBERSHIP LAW, RESTATED FOR THIS SURFACE ─────────────────────────
 *
 * `docs/design/positioning-contract.md` §7 and the run's standing rules: every
 * number is read from `plans.ts`, no price is ever typed into a layout, and
 * nothing may claim a trial, a discount or a deadline that the plan state does
 * not actually hold. Three specific refusals follow, and each of them is a line
 * of code below rather than a promise in prose:
 *
 *   1. NO TRIAL COPY WITHOUT A TRIAL. The trialing branch runs only when
 *      `trialing` is true AND there is a real `trialEndsAt` in the future to
 *      count from. A trial with no end date on record produces NO BUBBLE, not a
 *      bubble with a guessed fortnight in it. `usePlan` reads `trial_ends_at`
 *      straight off the subscription row, so this is the account's own date.
 *   2. NO NUMBER THIS MODULE INVENTED. The only figures in the copy are
 *      `PLANS.*` and the day count computed from that timestamp. There is no
 *      outfit count here — `context-lines.ts` explains at length why that one is
 *      per-user and may never be written down — and no price, because the app
 *      has no StoreKit and every price it has ever shown was Superwall
 *      rendering its own document.
 *   3. NO URGENCY. "3 days left in your trial" is a fact about a date. It is not
 *      followed by an exclamation, a countdown, an offer that expires, or a
 *      claim that anything is about to be lost — because nothing is: the trial
 *      lapsing pauses features, and the closet stays exactly where it was.
 *      `TrialExpired`'s own line already promises that ("Nothing has been
 *      deleted"), and this must not contradict it a fortnight earlier.
 *
 * ── WHO SEES NOTHING ──────────────────────────────────────────────────────
 *
 * A paying member. `usePlan` folds a live trial into `pro`, so "already paying"
 * is `plan !== 'free' && !trialing` — checking the plan alone would silence the
 * trial bubble for every account in the product, since
 * `handle_new_subscription()` starts everyone on one. And an UNREAD plan sees
 * nothing either: `usePlan` answers `free` while loading and after a failed read,
 * which is the right default for a gate (refuse nothing) and the wrong one for a
 * sentence — the same distinction `CapacityNote` draws, for the same reason.
 */

export type UpsellBubbleKind = 'trial' | 'free';

export type UpsellBubbleView = {
  kind: UpsellBubbleKind;
  eyebrow: string;
  headline: string;
  body: string;
};

/**
 * The two controls: one door out, one way to be left alone.
 *
 * Audit 2026-09-02 · 7 ("establish one primary action per visual zone") retired
 * the third. The card used to carry a filled oxblood CTA, a "Not now" text
 * button UNDER it and a dismiss disc beside the headline — three controls for a
 * yes/no question. The row now has one action, which is the row itself, and one
 * dismissal, which is the disc; `UPSELL_COPY.dismiss` went with the button that
 * spoke it.
 */
export const UPSELL_COPY = {
  /**
   * "See plans" — the words `placements.ts` already uses for this door, where
   * `repeat_upsell` is described as the offer made "once the copy has honestly
   * explained why". Not "Upgrade now", which is a verb with a deadline behind it.
   */
  cta: 'See plans',
  /** The X. A label, because a glyph alone is not a name. */
  close: 'Dismiss',
} as const;

/**
 * Whole days between now and the trial's end.
 *
 * Rounded UP, and that is the honest direction rather than the flattering one:
 * an account with thirty hours left has one full day and a bit, and telling it
 * "1 day left" understates what it holds. Anything already past returns 0, which
 * the caller treats as "no trial to describe" — `usePlan` would have set
 * `trialing` false by then anyway, and this is the belt to that brace.
 */
export function trialDaysLeft(endsAt: Date | null, now: Date): number {
  if (!endsAt) return 0;
  const ms = endsAt.getTime() - now.getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.ceil(ms / 86_400_000);
}

export type UpsellBubbleInput = {
  plan: Plan;
  /** A live paid row or StoreKit entitlement — `PlanState.paid`. */
  paid: boolean;
  trialing: boolean;
  trialEndsAt: Date | null;
  /** True while `usePlan` is still reading, or after the read failed. */
  unknown: boolean;
  now: Date;
};

/**
 * What this account should be shown, or null for nothing at all.
 *
 * The order of the branches is the order of the refusals: an unread plan first,
 * then a paying member, then the trial — and only what is left is the free
 * account the founder asked about.
 */
export function upsellBubbleFor(input: UpsellBubbleInput): UpsellBubbleView | null {
  if (input.unknown) return null;

  // Already paying — a receipt, not an audience. `paid` rather than
  // `plan !== 'free' && !trialing`: a paid row that still carries a future
  // trial date is paying, and told otherwise it would read "N days left in
  // your trial" over its own subscription (verification, UX-2).
  if (input.paid) return null;
  if (input.plan !== 'free' && !input.trialing) return null;

  if (input.trialing) {
    const days = trialDaysLeft(input.trialEndsAt, input.now);
    // A trial the account cannot prove the end of. Nothing is drawn rather than
    // a sentence with a plausible number in it — refusal 1, above.
    if (days <= 0) return null;

    return {
      kind: 'trial',
      eyebrow: 'YOUR TRIAL',
      headline: `${days} ${days === 1 ? 'day' : 'days'} left in your trial`,
      // What LAPSING does, in the two places it is felt, and what it does not
      // do. The ceiling is read from `plans.ts`; the stylist and packing are
      // named as pausing rather than vanishing because that is what happens —
      // free is excluded from `stylist_chat`, and `usePackingAccess` stops
      // rendering the questionnaire. The closet is untouched either way.
      //
      // Audit 2026-09-02 · 6 dropped the opening "Until then everything is
      // open": the headline has just said how many days are left, so the clause
      // was a feature inventory in front of the one fact that matters.
      body:
        `After it, the closet styles from ${PLANS.free.items} active pieces and ` +
        `the stylist and trip packing pause. Nothing you have added goes anywhere.`,
    };
  }

  return {
    kind: 'free',
    eyebrow: 'MEMBERSHIP',
    // ── AUDIT 2026-09-02 · 6 · THE OUTCOME LEADS, THE ARITHMETIC DEFERS ─────
    //
    // This said "Your closet holds 10 active pieces on Free" over "Standard
    // opens 150 of them and 15 occasions at once. Pro packs a trip out of the
    // closet you already own." Three tiers, four figures and two feature names
    // in two sentences, on a screen whose subject is what to wear today:
    // "membership copy is feature-dense and plan-centric. Lead with the user
    // outcome and defer tier arithmetic to Membership."
    //
    // So the headline is what changes for the reader, the body is the one
    // constraint they are actually inside, and the comparison between tiers
    // happens on Membership — which is where every figure is stated in full,
    // beside the price only Superwall may render.
    //
    // WHAT DID NOT CHANGE: no tier's contents moved, and nothing here is now
    // less true. "Active" is still load-bearing — `PLANS.free.items` mirrors
    // `item_limit_for_plan()`, which excludes archived pieces, and a flat "10
    // pieces" would understate what the account may hold. The stylist is named
    // because it is the one paid feature BOTH tiers carry (`plans.ts`:
    // Standard "5 chats a month", Pro "Unlimited", free "Not included"); trip
    // packing is deliberately absent, because it is Pro alone and naming it
    // here would sell a tier the feature is not on.
    headline: 'Style from more of your closet',
    body:
      `Free styles from ${PLANS.free.items} active pieces at a time. Membership ` +
      `raises the ceiling and opens the stylist.`,
  };
}

/**
 * The once-per-app-open latch.
 *
 * MODULE STATE, NOT STORAGE, and the difference is the whole requirement. A
 * marker in `AsyncStorage` — which is how `use-trial-expired.ts` correctly does
 * its own once-per-LAPSE guarantee — would make this bubble a thing the user has
 * to dismiss forever exactly once, and the founder asked for the opposite: shown
 * at most once per app open, and never a nag. A module-level flag is scoped to
 * the JS runtime, so it clears on a cold start and on nothing else. That is the
 * definition of "this session" with no key to migrate and no state to leak
 * between accounts.
 *
 * Claimed rather than read, so two mounts in one commit cannot both win it.
 */
let claimed = false;

/** True for the first caller after an app open, false for every one after. */
export function claimUpsellBubble(): boolean {
  if (claimed) return false;
  claimed = true;
  return true;
}

/** Tests only — there is no cold start in a test process. */
export function resetUpsellBubble(): void {
  claimed = false;
}
