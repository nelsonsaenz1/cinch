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
 * The six trigger lines are copied verbatim from the contract's §3.1 table.
 * Do not improve the prose — it is frozen there for a reason, and a paraphrase
 * here is a paraphrase the design review never saw. There are exactly two
 * departures from the frozen text, both on the record:
 *
 *   1. NUMBERS. §3.1 spelled its ceilings out in words;
 *      `docs/design/positioning-contract.md` §7 requires them read from
 *      `PLANS` instead, so the digits below derive.
 *   2. `add_garment_over_limit`, REWRITTEN 2026-08-10 on a founder ruling.
 *      §3.1's clause "and ten is enough to dress a fortnight" violates
 *      positioning-contract §3: a fortnight is fourteen days, the canonical ten
 *      makes fourteen outfits, and the sentence is therefore the outfit count
 *      published as a marketing constant with a duration worn over it. §3
 *      forbids exactly that, and forbids it *because* the number is true of
 *      one particular ten and no other — the user who photographs ten tops
 *      gets nothing to wear and would have been promised a fortnight. The
 *      replacement makes the same multiplicative argument with no count and no
 *      duration in it: combinations, not addition, which is provable at
 *      `src/features/closet/outfit-count.ts:110` and is the whole reason a
 *      ceiling on pieces is worth paying to lift.
 *
 * `reveal_complete` is NOT from §3.1 — it postdates it (founder decision D2,
 * positioning-contract §5) and is written against `docs/stylist-voice.md`
 * directly. See `revealLine` for why it is the one line here that can quote a
 * per-user number at all.
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
   * Whether the 14-day trial is still running.
   *
   * `plan` alone cannot answer this: `usePlan()` folds a live trial into
   * `pro`, so a brand-new account and a paying Pro subscriber are the same
   * value. For the five placements that fire after a server refusal that
   * conflation is harmless — a trialing user is Pro server-side too, so they
   * never meet a ceiling and never see one of those paywalls. `reveal_complete`
   * is the exception that makes the distinction load-bearing: it fires whether
   * or not anything was refused, and `handle_new_subscription()` (migration
   * 20260805160000) starts every account on a 14-day trial at signup, so
   * ALMOST EVERY USER WHO REACHES IT IS TRIALING. Telling them the ten stay
   * free is telling them about a ceiling they will not meet for a fortnight.
   *
   * Supplied by `use-gate.ts` from `usePlan()`, next to `plan`, for the same
   * reason `plan` is: the call sites have no business knowing about billing.
   */
  trialing?: boolean;
  /**
   * The user's OWN computed outfit count, from `countOutfits()`
   * (`src/features/closet/outfit-count.ts:110`) — for `reveal_complete`, and
   * for nothing else.
   *
   * THIS IS THE ONLY NUMBER IN THE PRODUCT THAT MAY NOT BE WRITTEN DOWN.
   * `docs/design/positioning-contract.md` §3 permits "ten pieces" as a
   * constant — it is the free cap, identical for everyone, provable in a
   * migration — and forbids the outfit count as one, anywhere, ever: it is a
   * per-user result and it appears only where it is being computed from that
   * user's closet, on screen. That is why this is a parameter and not a
   * default: there is no value this module could fall back to that would not
   * be a fabrication, so a caller with no count gets a line with no number in
   * it (see `revealLine`).
   *
   * Pass the count the Reveal just rendered, unmodified. Do not round it, do
   * not floor it at some minimum, and never pass a count from a closet other
   * than this user's.
   */
  outfitCount?: number | null;
  /**
   * The answered trip, when `packing_access` fires with one already on hand.
   * Omit or pass `null` for the ordinary case — the paywall reached from
   * K-01's locked plate, before any question has been asked. NEVER invent a
   * destination or a day count to fill this in; the fallback line exists
   * precisely so nothing has to be guessed.
   */
  trip?: { destinationName: string; days: number } | null;
};

/**
 * Every number below is read from `PLANS`, never typed into the prose.
 *
 * The module used to do this in one half and not the other — `STANDARD_LINES`
 * interpolated its ceilings while these spelled "Ten" and "three" out in
 * words — and that inconsistency is what identified it as a bug class rather
 * than a house style (`docs/design/positioning-contract.md` §7). A sentence
 * quoting last month's ceiling reads as a lie to the user who just met this
 * month's.
 *
 * The digits are deliberate and they match `STANDARD_LINES` ("150 pieces is
 * where Standard stops") and the packing line ("4 days in Lisbon"). The
 * spelled-out register belongs to the Reveal, which owns `numberWord` in
 * `src/features/onboarding/` — a module this one does not import from and
 * should not, for the same boundary reason `ContextLineOpts` takes two facts
 * about a trip instead of the `Trip` type.
 */
const STATIC_LINES: Partial<Record<PlacementName, string>> = {
  [Placement.OpenStylist]:
    "You asked what to wear to the rehearsal dinner. The stylist has an answer — it's part of Standard.",
  // Names the ceiling ONCE. The §7 sweep interpolated `PLANS.free.items` into
  // all three of §3.1's spelled-out tens, which left the line reading
  // "10 … 10 … 10" — mechanically correct and unreadable. The user has just
  // been refused at the cap, so the cap needs saying once; the second and third
  // mentions were only ever there because the prose was written around a word.
  [Placement.AddGarmentOverLimit]:
    `${PLANS.free.items} pieces is where the free closet stops. Outfits come out of the combinations rather than the count, which is why a closet grows faster than it fills. There's a coat in your camera roll.`,
  [Placement.GenerateOutfitOverLimit]:
    `That's this ${PLANS.free.outfitPromise.period}'s ${PLANS.free.outfitPromise.count} outfits. Members get a new set whenever the day changes on them.`,
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
 * `reveal_complete` — the line that quotes the user's own arithmetic back to
 * them, and the only one in this module that can.
 *
 * Two things make it different from every other line here, and both change the
 * copy rather than just the plumbing.
 *
 * FIRST, NOTHING HAS BEEN REFUSED. The other five fire after a server has
 * already said no, so they can name a ceiling the user has genuinely met. This
 * one fires on a delight: ten photographs went in, `countOutfits()` came out,
 * and the number on screen is what the last ten minutes bought. It is the
 * highest-intent moment in the product and also the one where a sales pitch
 * would be most obviously a sales pitch. So the line states the arithmetic,
 * says what stays free, and stops. It does not ask for anything; the paywall
 * below it already does.
 *
 * SECOND, ALMOST EVERYONE WHO SEES IT IS TRIALING. `handle_new_subscription()`
 * starts a 14-day trial at signup, and The Reveal is minutes later, so the free
 * ceilings are a fortnight away from mattering to them. "The ten stay free" is
 * true but irrelevant, and reads as a threat about a wall they cannot see. The
 * trialing branch says the true thing instead.
 *
 * A PAYING subscriber gets `null` — the block collapses and MB-01 shows no line
 * at all. There is no honest version of this sentence for somebody who already
 * bought the thing it is selling, and `STANDARD_LINES` is not a fit either:
 * those describe a Standard ceiling that a Reveal has not gone anywhere near.
 *
 * The count is never invented. `positioning-contract.md` §3 makes the outfit
 * number a per-user computed result and forbids it as a constant anywhere else,
 * so a call with no count — or a zero, which is R-05, the honest empty Reveal —
 * drops to a line that names no number rather than reaching for a plausible one.
 */
function revealLine(opts: ContextLineOpts): string | null {
  const count = opts.outfitCount;
  const counted =
    typeof count === 'number' && Number.isFinite(count) && count > 0
      ? `${count} outfit${count === 1 ? '' : 's'} from ${PLANS.free.items} pieces. `
      : null;

  if (opts.trialing) {
    return `${counted ?? ''}Your trial has everything open — membership is what keeps it that way.`;
  }

  if ((opts.plan ?? 'free') !== 'free') return null;

  return counted
    ? `${counted}Those stay free — membership is for the next piece, and everything it multiplies.`
    : `The free closet holds ${PLANS.free.items} pieces. Membership is for the ones after that.`;
}

/**
 * The line for one placement, or `null` when the paywall should show no line
 * at all.
 *
 * `repeat_upsell` always returns `null`, and `reveal_complete` returns it for
 * anyone already paying — MB-01 already handles a paywall with nothing above
 * the headline. The other five always return a string.
 *
 * Two lines are computed rather than static, and both only ever from real
 * data the caller already has on screen: `packing_access` from an answered
 * trip, `reveal_complete` from this user's own outfit count. Neither will
 * invent its input.
 */
export function contextLineFor(placement: PlacementName, opts: ContextLineOpts = {}): string | null {
  if (placement === Placement.RepeatUpsell) return null;

  // MB-09 has already said everything a line here could: three delta rows and
  // the promise that nothing already held is lost. A context line above the
  // headline would be a fourth restatement of the same move, on the surface
  // whose whole job is now the TERMS. Explicit rather than falling through to
  // the `STATIC_LINES` lookup, so this reads as a decision and not an omission.
  if (placement === Placement.MembershipUpgrade) return null;

  // Ahead of the plan branch below, because it does its own — a trial reads as
  // `pro` here, and this is the one placement a trialing user ever reaches.
  if (placement === Placement.RevealComplete) return revealLine(opts);

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
