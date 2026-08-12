import type { PlacementName } from './placements';
import { Placement } from './placements';

/**
 * What MB-06 (`src/app/membership-thanks.tsx`) needs to hand the user back to
 * the thing they were doing — recorded by `use-gate.ts` at the moment a real
 * purchase or restore completes, per the contract's §7:
 *
 *   "The gate records the originating placement and the route that raised
 *    it. On `granted`, the app navigates back to that route and the button
 *    is labelled from the placement."
 *
 * A PLAIN MODULE VARIABLE, not React state or context, on purpose and for the
 * same reason `use-gate.ts`'s own `inFlight` is one: the writer (`present()`,
 * inside a Superwall event callback) and the one reader that matters
 * (`membership-thanks.tsx`, mounted fresh by a `router.push` a moment later)
 * are never the same render tree, so there is nothing for React state to
 * usefully re-render. Read once, on mount, and that is the whole contract.
 */
export type PaywallOrigin = {
  placement: PlacementName;
  /** The route `present()` was called from — what "back" means here. */
  route: string;
};

let origin: PaywallOrigin | null = null;

/** Called by `use-gate.ts` the instant a purchase or restore is confirmed. */
export function recordPaywallOrigin(next: PaywallOrigin): void {
  origin = next;
}

/**
 * Read without consuming. `membership-thanks.tsx` calls this once, in a
 * `useState` initializer, so a later purchase elsewhere in the app (the
 * membership section in Settings, say) cannot rewrite the origin out from
 * under an already-open thanks screen.
 */
export function peekPaywallOrigin(): PaywallOrigin | null {
  return origin;
}

/**
 * Called once the thanks screen has used the origin — on the "Back to…" tap,
 * or on unmount if the user swipes away instead. Leaving a stale origin
 * around would misattribute a LATER, unrelated grant (`trial_expired` firing
 * on next app open, say) to this session's placement.
 */
export function clearPaywallOrigin(): void {
  origin = null;
}

/**
 * The return button's label, keyed by the placement that opened the paywall
 * — contract §7: "the button is labelled from the placement (`open_stylist`
 * → 'Back to the stylist'; `packing_access` → 'Back to the trip')."
 *
 * `null` origin (the screen was reached with nothing recorded — a cold
 * relaunch mid-purchase, say) gets the plain fallback rather than a guess at
 * what the user was doing.
 */
export function returnLabelFor(placement: PlacementName | null): string {
  switch (placement) {
    case Placement.OpenStylist:
      return 'Back to the stylist';
    case Placement.AddGarmentOverLimit:
      return 'Back to your closet';
    case Placement.GenerateOutfitOverLimit:
      return "Back to today's outfits";
    case Placement.EventHostingOverLimit:
      return 'Back to your event';
    case Placement.PackingAccess:
      return 'Back to the trip';
    case Placement.RepeatUpsell:
      return "Back to today's outfit";
    case Placement.RevealComplete:
      // The Reveal is still underneath — `router.back()` returns to it with
      // the count and the first plate exactly as they were, which is the
      // screen this user was in the middle of reading. Named for the thing on
      // it rather than for the screen, which has no name a user would know.
      return 'Back to your first outfit';
    case Placement.MembershipUpgrade:
      // MB-09 is still underneath, and it is a real page — the delta table
      // this member was reading when they went to look at the terms. Named for
      // what is on it rather than for "membership", which would be ambiguous
      // with the page one further back.
      return 'Back to the comparison';
    case Placement.TrialExpired:
    case null:
      // Not tied to a single interrupted action — see placements.ts's own
      // note on `TrialExpired` firing on app open rather than on a refusal.
      return 'Continue';
  }
}
