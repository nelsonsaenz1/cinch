// tests/context-lines.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";

// src/features/billing/plans.ts
var PLANS = {
  free: {
    name: "Free",
    items: 10,
    storedItems: 30,
    outfits: "A few each week",
    // Three a week, against an enforced five — see the field's own note.
    outfitPromise: { count: 3, period: "week" },
    stylist: "Not included",
    eventHosting: 2,
    monthlyPriceHint: null,
    annualPriceHint: null
  },
  standard: {
    name: "Standard",
    items: 150,
    storedItems: 450,
    outfits: "A fresh outfit every day",
    outfitPromise: { count: 1, period: "day" },
    stylist: "30 messages a month",
    eventHosting: 15,
    monthlyPriceHint: "$7.99",
    annualPriceHint: "$59"
  },
  pro: {
    name: "Pro",
    items: 1e3,
    storedItems: 3e3,
    outfits: "Unlimited",
    outfitPromise: null,
    stylist: "Unlimited",
    eventHosting: 100,
    monthlyPriceHint: "$14.99",
    annualPriceHint: "$119"
  }
};

// src/features/billing/placements.ts
var Placement = {
  /**
   * Adding a garment the current plan has no room for.
   *
   * Registered *before* the camera opens, not after the photo is taken. Making
   * someone photograph and background-remove a jacket and then telling them
   * their closet is full is how you earn a one-star review.
   */
  AddGarmentOverLimit: "add_garment_over_limit",
  /**
   * An outfit request past the plan's allowance — `claim_ai_quota` returning
   * exhausted for `outfit_generation`.
   */
  GenerateOutfitOverLimit: "generate_outfit_over_limit",
  /**
   * The stylist, which free excludes outright rather than rations.
   *
   * `claim_ai_quota` distinguishes these: `plan_excluded` means the plan never
   * had it, and should offer an upgrade; exhaustion means the allowance ran out
   * and resets. Both land here, but the paywall copy should not be the same —
   * telling a free user to "try again tomorrow" describes a day that never
   * comes.
   */
  OpenStylist: "open_stylist",
  /**
   * The 14-day trial has lapsed and the account never subscribed.
   *
   * Not tied to an action, unlike the three above — this is the general
   * "your trial ended" moment, registered on app open when `usePlan()` reports
   * `trialing` has gone false and the plan fell back to `free`.
   */
  TrialExpired: "trial_expired",
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
  EventHostingOverLimit: "event_hosting_over_limit",
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
  PackingAccess: "packing_access",
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
  RepeatUpsell: "repeat_upsell",
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
  RevealComplete: "reveal_complete"
};

// src/features/billing/context-lines.ts
var STATIC_LINES = {
  [Placement.OpenStylist]: "You asked what to wear to the rehearsal dinner. The stylist has an answer \u2014 it's part of Standard.",
  // Names the ceiling ONCE. The §7 sweep interpolated `PLANS.free.items` into
  // all three of §3.1's spelled-out tens, which left the line reading
  // "10 … 10 … 10" — mechanically correct and unreadable. The user has just
  // been refused at the cap, so the cap needs saying once; the second and third
  // mentions were only ever there because the prose was written around a word.
  [Placement.AddGarmentOverLimit]: `${PLANS.free.items} pieces is where the free closet stops. Outfits come out of the combinations rather than the count, which is why a closet grows faster than it fills. There's a coat in your camera roll.`,
  [Placement.GenerateOutfitOverLimit]: `That's this ${PLANS.free.outfitPromise.period}'s ${PLANS.free.outfitPromise.count} outfits. Members get a new set whenever the day changes on them.`,
  [Placement.TrialExpired]: "Your two weeks are up. Nothing has been deleted \u2014 the closet is exactly where you left it.",
  [Placement.EventHostingOverLimit]: "You can join any event you're invited to. Hosting one \u2014 and inviting the table \u2014 is Standard."
};
var STANDARD_LINES = {
  [Placement.AddGarmentOverLimit]: `${PLANS.standard.items} pieces is where Standard stops. Pro holds ${PLANS.pro.items.toLocaleString("en-US")} \u2014 the same closet, without the ceiling.`,
  [Placement.GenerateOutfitOverLimit]: "That's today's outfits on Standard. Pro's daily ceiling is four times higher, and most days you won't find it.",
  [Placement.OpenStylist]: `Standard's ${PLANS.standard.stylist} are spent. Pro doesn't count them.`,
  [Placement.EventHostingOverLimit]: `You're hosting ${PLANS.standard.eventHosting} occasions at once, which is where Standard stops. Pro holds ${PLANS.pro.eventHosting}.`
};
var PACKING_FALLBACK_LINE = "Pro packs the bag \u2014 day by day, from the closet you already own.";
function revealLine(opts) {
  const count = opts.outfitCount;
  const counted = typeof count === "number" && Number.isFinite(count) && count > 0 ? `${count} outfit${count === 1 ? "" : "s"} from ${PLANS.free.items} pieces. ` : null;
  if (opts.trialing) {
    return `${counted ?? ""}Your trial has everything open \u2014 membership is what keeps it that way.`;
  }
  if ((opts.plan ?? "free") !== "free") return null;
  return counted ? `${counted}Those stay free \u2014 membership is for the next piece, and everything it multiplies.` : `The free closet holds ${PLANS.free.items} pieces. Membership is for the ones after that.`;
}
function contextLineFor(placement, opts = {}) {
  if (placement === Placement.RepeatUpsell) return null;
  if (placement === Placement.RevealComplete) return revealLine(opts);
  if (opts.plan === "standard") {
    const paid = STANDARD_LINES[placement];
    if (paid) return paid;
  }
  if (placement === Placement.PackingAccess) {
    const trip = opts.trip;
    if (trip && trip.destinationName) {
      const days = `${trip.days} ${trip.days === 1 ? "day" : "days"}`;
      return `${days} in ${trip.destinationName}. ${PACKING_FALLBACK_LINE}`;
    }
    return PACKING_FALLBACK_LINE;
  }
  return STATIC_LINES[placement] ?? null;
}

// tests/context-lines.test.ts
test("open_stylist names the question the user actually asked", () => {
  assert.equal(
    contextLineFor(Placement.OpenStylist),
    "You asked what to wear to the rehearsal dinner. The stylist has an answer \u2014 it's part of Standard."
  );
});
test("add_garment_over_limit is the free closet, not fifty", () => {
  assert.equal(
    contextLineFor(Placement.AddGarmentOverLimit),
    `${PLANS.free.items} pieces is where the free closet stops. Outfits come out of the combinations rather than the count, which is why a closet grows faster than it fills. There's a coat in your camera roll.`
  );
});
test("add_garment_over_limit does not publish an outfit count as a duration", () => {
  const line = contextLineFor(Placement.AddGarmentOverLimit);
  const durations = /\bfortnight|\bweeks?\b|\bmonths?\b|\bdays?\b|\bevery (morning|day)\b/i;
  assert.ok(!durations.test(line), `promises a span of time it cannot know: ${line}`);
  const numbers = line.match(/\d+/g) ?? [];
  assert.deepEqual(numbers, [String(PLANS.free.items)], `more than the cap is quoted: ${line}`);
});
test("generate_outfit_over_limit is this week, not today", () => {
  assert.equal(
    contextLineFor(Placement.GenerateOutfitOverLimit),
    `That's this week's ${PLANS.free.outfitPromise.count} outfits. Members get a new set whenever the day changes on them.`
  );
});
test("the free lines quote PLANS rather than a frozen copy of it", () => {
  const garments = contextLineFor(Placement.AddGarmentOverLimit);
  assert.ok(garments.includes(String(PLANS.free.items)), garments);
  assert.ok(!/\bTen\b|\bten\b/.test(garments), `still spells the piece count out: ${garments}`);
  const outfits = contextLineFor(Placement.GenerateOutfitOverLimit);
  assert.ok(outfits.includes(String(PLANS.free.outfitPromise.count)), outfits);
  assert.ok(!/\bthree\b/.test(outfits), `still spells the outfit promise out: ${outfits}`);
});
test("trial_expired reassures nothing was deleted", () => {
  assert.equal(
    contextLineFor(Placement.TrialExpired),
    "Your two weeks are up. Nothing has been deleted \u2014 the closet is exactly where you left it."
  );
});
test("event_hosting_over_limit names Standard, not Pro", () => {
  assert.equal(
    contextLineFor(Placement.EventHostingOverLimit),
    "You can join any event you're invited to. Hosting one \u2014 and inviting the table \u2014 is Standard."
  );
});
test("repeat_upsell has no line \u2014 MB-01 collapses the block", () => {
  assert.equal(contextLineFor(Placement.RepeatUpsell), null);
});
test("packing_access falls back to the cityless line before any trip is answered", () => {
  assert.equal(
    contextLineFor(Placement.PackingAccess),
    "Pro packs the bag \u2014 day by day, from the closet you already own."
  );
  assert.equal(
    contextLineFor(Placement.PackingAccess, {}),
    "Pro packs the bag \u2014 day by day, from the closet you already own."
  );
  assert.equal(
    contextLineFor(Placement.PackingAccess, { trip: null }),
    "Pro packs the bag \u2014 day by day, from the closet you already own."
  );
});
test("packing_access interpolates the destination and duration once a trip is answered", () => {
  assert.equal(
    contextLineFor(Placement.PackingAccess, { trip: { destinationName: "Lisbon", days: 4 } }),
    "4 days in Lisbon. Pro packs the bag \u2014 day by day, from the closet you already own."
  );
});
test('a one-day trip says "day", not "days"', () => {
  const line = contextLineFor(Placement.PackingAccess, { trip: { destinationName: "Porto", days: 1 } });
  assert.equal(line, "1 day in Porto. Pro packs the bag \u2014 day by day, from the closet you already own.");
});
test("every placement is accounted for \u2014 nothing falls through to undefined behaviour", () => {
  for (const placement of Object.values(Placement)) {
    const line = contextLineFor(placement);
    assert.ok(line === null || typeof line === "string", `${placement}: ${String(line)}`);
  }
});
test("a Standard subscriber is never told the free-tier story", () => {
  for (const placement of [
    Placement.AddGarmentOverLimit,
    Placement.GenerateOutfitOverLimit,
    Placement.OpenStylist,
    Placement.EventHostingOverLimit
  ]) {
    const free = contextLineFor(placement, { plan: "free" });
    const standard = contextLineFor(placement, { plan: "standard" });
    assert.ok(standard, `${placement} has no Standard line`);
    assert.notEqual(standard, free, `${placement} reuses the free line`);
    assert.ok(
      !standard.toLowerCase().includes("free closet"),
      `${placement} tells a paying subscriber about the free closet: ${standard}`
    );
  }
});
test("the Standard lines quote the real ceilings, not a frozen copy of them", () => {
  const garments = contextLineFor(Placement.AddGarmentOverLimit, { plan: "standard" });
  assert.ok(garments.includes(String(PLANS.standard.items)), garments);
  assert.ok(garments.includes(PLANS.pro.items.toLocaleString("en-US")), garments);
  const events = contextLineFor(Placement.EventHostingOverLimit, { plan: "standard" });
  assert.ok(events.includes(String(PLANS.standard.eventHosting)), events);
  assert.ok(events.includes(String(PLANS.pro.eventHosting)), events);
});
test("no plan given reads as free \u2014 the tier almost every paywall is shown to", () => {
  for (const placement of Object.values(Placement)) {
    assert.equal(contextLineFor(placement), contextLineFor(placement, { plan: "free" }), placement);
  }
});
test("reveal_complete interpolates the count it was given, and only that count", () => {
  const fourteen = contextLineFor(Placement.RevealComplete, { outfitCount: 14 });
  const six = contextLineFor(Placement.RevealComplete, { outfitCount: 6 });
  assert.ok(fourteen.startsWith("14 outfits"), fourteen);
  assert.ok(six.startsWith("6 outfits"), six);
  assert.notEqual(fourteen, six);
  assert.ok(!six.includes("14"), six);
});
test('reveal_complete says "outfit" for a closet that makes one', () => {
  const line = contextLineFor(Placement.RevealComplete, { outfitCount: 1 });
  assert.ok(line.startsWith("1 outfit from"), line);
  assert.ok(!line.includes("1 outfits"), line);
});
test("reveal_complete invents no number when it is given none", () => {
  for (const opts of [{}, { outfitCount: null }, { outfitCount: 0 }, { outfitCount: Number.NaN }]) {
    const line = contextLineFor(Placement.RevealComplete, opts);
    assert.ok(typeof line === "string" && line.length > 0, JSON.stringify(opts));
    assert.ok(!/outfit/.test(line), `claims outfits it never counted: ${line}`);
    assert.ok(!/NaN|null|undefined/.test(line), line);
  }
});
test("reveal_complete tells a trialing user about the trial, not the free ceiling", () => {
  const line = contextLineFor(Placement.RevealComplete, {
    plan: "pro",
    trialing: true,
    outfitCount: 14
  });
  assert.ok(line.startsWith("14 outfits"), line);
  assert.ok(line.includes("trial"), line);
  assert.ok(!line.includes("free"), `promises a free ceiling to a user who has Pro: ${line}`);
});
test("reveal_complete says nothing at all to somebody already paying", () => {
  for (const plan of ["standard", "pro"]) {
    assert.equal(contextLineFor(Placement.RevealComplete, { plan, outfitCount: 14 }), null, plan);
  }
});
test("reveal_complete on a lapsed trial names what stays free", () => {
  const line = contextLineFor(Placement.RevealComplete, {
    plan: "free",
    trialing: false,
    outfitCount: 14
  });
  assert.ok(line.includes(String(PLANS.free.items)), line);
  assert.ok(line.includes("free"), line);
});
test("trial expiry and packing read the same on every plan", () => {
  for (const placement of [Placement.TrialExpired, Placement.PackingAccess]) {
    assert.equal(
      contextLineFor(placement, { plan: "standard" }),
      contextLineFor(placement, { plan: "free" }),
      placement
    );
  }
});
