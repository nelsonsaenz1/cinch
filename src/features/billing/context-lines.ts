import { PLANS, type Plan } from './plans';
import { Placement, type PlacementName } from './placements';

/**
 * The line above the paywall headline (MB-02, MB-03 — atlas M-02/M-03).
 *
 * The paywall document itself is Superwall's (`docs/design/
 * membership-packing-contract.md` §3): layout, plan cards, prices, the
 * purchase sheet. The one thing the app writes onto that page is this single
 * line, passed as a `context` param on `registerPlacement` (see `use-gate.ts`)
 * — the document renders `{{context}}` when present and collapses the block
 * when it is absent, which is exactly what `repeat_upsell` needs.
 *
 * Copied verbatim from the contract's §3.1 table. Do not improve the prose —
 * it is frozen there for a reason, and a paraphrase here is a paraphrase the
 * design review never saw.
 */

/**
 * What the packing line needs to name a trip, without this module reaching
 * into `src/features/plan/` for the real `Trip` type. Keeping the shape
 * minimal is what lets a caller hand over just the two facts that matter
 * (`destination.name` and `tripDays(trip)`) instead of this module importing
 * across a unit boundary it does not own.
 */
export type ContextLineOpts = {
  /**
   * The plan the user is on RIGHT NOW, which decides which ceiling they just
   * met.
   *
   * Without this the line is keyed on the placement alone, and a Standard
   * subscriber who fills a 150-piece closet is told "Ten pieces is where the
   * free closet stops. You have ten." That sentence is false twice over, and
   * it is the reason campaign 100436 could not simply be widened to include
   * Standard — the targeting was correct to exclude them until this existed.
   *
   * Defaults to `free`, which is who almost every paywall is shown to.
   */
  plan?: Plan;
  /**
   * The answered trip, when `packing_access` fires with one already on hand.
   * Omit or pass `null` for the ordinary case — the paywall reached from
   * K-01's locked plate, before any question has been asked. NEVER invent a
   * destination or a day count to fill this in; the fallback line exists
   * precisely so nothing has to be guessed.
   */
  trip?: { destinationName: string; days: number } | null;
};

const STATIC_LINES: Partial<Record<PlacementName, string>> = {
  [Placement.OpenStylist]:
    "You asked what to wear to the rehearsal dinner. The stylist has an answer — it's part of Standard.",
  [Placement.AddGarmentOverLimit]:
    'Ten pieces is where the free closet stops — and ten is enough to dress a fortnight. You have ten, and a coat in the camera roll.',
  [Placement.GenerateOutfitOverLimit]:
    "That's this week's three outfits. Members get a new set whenever the day changes on them.",
  [Placement.TrialExpired]:
    'Your two weeks are up. Nothing has been deleted — the closet is exactly where you left it.',
  [Placement.EventHostingOverLimit]:
    "You can join any event you're invited to. Hosting one — and inviting the table — is Standard.",
};

/**
 * The same six moments, met by somebody who is already paying.
 *
 * Only four placements can be reached from Standard. `trial_expired` fires
 * when a trial lapsed to free, so a subscriber never sees it; `packing_access`
 * reads the same either way, because packing is Pro and the free and Standard
 * answer to "why can't I pack" is identical.
 *
 * Every number is interpolated from `PLANS` rather than written into the
 * prose, so a tier change cannot leave a sentence quoting last month's ceiling.
 */
const STANDARD_LINES: Partial<Record<PlacementName, string>> = {
  [Placement.AddGarmentOverLimit]:
    `${PLANS.standard.items} pieces is where Standard stops. Pro holds ${PLANS.pro.items.toLocaleString('en-US')} — the same closet, without the ceiling.`,
  [Placement.GenerateOutfitOverLimit]:
    "That's today's outfits on Standard. Pro's daily ceiling is four times higher, and most days you won't find it.",
  [Placement.OpenStylist]:
    `Standard's ${PLANS.standard.stylist} are spent. Pro doesn't count them.`,
  [Placement.EventHostingOverLimit]:
    `You're hosting ${PLANS.standard.eventHosting} occasions at once, which is where Standard stops. Pro holds ${PLANS.pro.eventHosting}.`,
};

/** §3.1's own fallback, for a packing paywall reached before any trip exists. */
const PACKING_FALLBACK_LINE = 'Pro packs the bag — day by day, from the closet you already own.';

/**
 * The line for one placement, or `null` when the paywall should show no line
 * at all.
 *
 * `repeat_upsell` always returns `null` — MB-01 already handles a paywall
 * with nothing above the headline. Every other placement returns a string;
 * `packing_access` is the one line that is ever computed rather than static,
 * and only ever from real, answered data.
 */
export function contextLineFor(placement: PlacementName, opts: ContextLineOpts = {}): string | null {
  if (placement === Placement.RepeatUpsell) return null;

  // A paying subscriber met a different ceiling than a free one, and telling
  // them the free-tier story is worse than saying nothing.
  if (opts.plan === 'standard') {
    const paid = STANDARD_LINES[placement];
    if (paid) return paid;
  }

  if (placement === Placement.PackingAccess) {
    const trip = opts.trip;
    if (trip && trip.destinationName) {
      const days = `${trip.days} ${trip.days === 1 ? 'day' : 'days'}`;
      return `${days} in ${trip.destinationName}. ${PACKING_FALLBACK_LINE}`;
    }
    return PACKING_FALLBACK_LINE;
  }

  return STATIC_LINES[placement] ?? null;
}
