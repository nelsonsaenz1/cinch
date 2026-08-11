// tests/piece-counts.test.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

// src/features/onboarding/reveal-copy.ts
var WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
  "twenty"
];
function numberWord(n) {
  return WORDS[n] ?? String(n);
}

// src/features/styling/thresholds.ts
var MIN_CLOSET_FOR_OUTFITS = 8;

// src/features/help/articles.ts
var ceiling = (v) => v.toLocaleString("en-US");
var cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
var MANAGE_SUBSCRIPTIONS_URL = "https://apps.apple.com/account/subscriptions";
var HELP_ARTICLES = [
  // ── Getting started ──────────────────────────────────────────────────────
  {
    id: "closet-size",
    group: "getting-started",
    question: "How many pieces should I put in?",
    // Ten active / thirty total: features/billing/plans.ts:74-75 (`items: 10`,
    // `storedItems: 30`), enforced in the database by
    // 20260808190000_free_closet_is_ten.sql:29 and split into the two ceilings
    // by 20260808190100_active_and_stored_limits.sql. `storedItems` is
    // documented in plans.ts:30-38 as "every row the account holds, stored
    // pieces included" — so thirty is the total, not thirty on top of ten, and
    // the sentence says "in total" rather than "more".
    //
    // Eight, and a top and a bottom or a dress: `MIN_CLOSET_FOR_OUTFITS` in
    // features/styling/thresholds.ts, paired with `canGenerate` in
    // features/styling/queries.ts, where a `base_top` or a `mid_layer` counts
    // as the top.
    //
    // This was the last literal in the file, and it was one because the
    // constant could not be imported: it lived in `queries.ts`, which pulls in
    // react-query and supabase, and the test bundler cannot follow that as far
    // as React Native. Lifting it into an import-free leaf closed that — the
    // three "eight"s below are now the constant itself, so the prose cannot
    // drift from the engine.
    //
    // Storage frees a slot: features/closet/storage.ts:16 — "a stored piece
    // FREES AN ACTIVE SLOT and still occupies a stored one" — and :32-35 for
    // nothing being lost.
    body: [
      `${cap(numberWord(PLANS.free.items))}, to begin with. That is the free closet: ${ceiling(PLANS.free.items)} pieces in rotation, ${ceiling(PLANS.free.storedItems)} in total once you count what you have put away \u2014 and it is meant as a working number rather than a taste of one. ${cap(numberWord(PLANS.free.items))} you actually reach for beats forty you photographed once.`,
      `Cinch starts building outfits at ${numberWord(MIN_CLOSET_FOR_OUTFITS)} pieces, and it needs a top and a bottom, or a dress, before it can assemble anything at all. ${cap(numberWord(MIN_CLOSET_FOR_OUTFITS))} jumpers is not a closet it can dress you from; ${numberWord(MIN_CLOSET_FOR_OUTFITS)} pieces that cover you head to toe is.`,
      `Moving something to storage frees a slot in rotation, so the ${numberWord(PLANS.free.items)} is a curation rather than a wall. Nothing is lost on the way in or out: the photograph, the wear count and the cost figure all wait for the piece to come back.`
    ],
    related: ["photo-quality", "what-paying-buys"],
    keywords: ["limit", "minimum", "how much", "add", "items", "wardrobe", "ten", "archive"]
  },
  {
    id: "photo-quality",
    group: "getting-started",
    question: "Do my photos have to look good?",
    // No quality requirements at all: contract A.2 #12 — no blur check, no
    // minimum resolution, no rejection path anywhere in src/app/capture.tsx.
    // The one line the camera prints is guidance, at capture.tsx:863: "One
    // garment, plain background". So: "works best with", never "must".
    //
    // On-device cutout: src/lib/bg-removal.ts:1-35 — Apple Vision's
    // `VNGenerateForegroundInstanceMaskRequest` behind a local Expo module,
    // iOS 17+, does not run in the Simulator. :19-24 records that Vision is
    // trained on salient subjects rather than garments and will sometimes lift
    // the hanger, which is why the third paragraph says so instead of
    // promising a clean plate.
    //
    // The original is kept: features/closet/mutations.ts:222-231 — the upload
    // queue writes `original.jpg` alongside the thumb, cutout and plate.
    body: [
      "No. There is no quality check anywhere in Cinch \u2014 no blur test, no minimum resolution, nothing that can turn a photograph away. Whatever you shoot goes in, and a dim one on the bedroom floor counts the same as a good one.",
      "It works best with one garment on a plain background, which is what the line on the camera screen is asking for. That is a preference, not a rule: it is simply the shot the cutout has the easiest time with.",
      "The cutout runs on your phone \u2014 Apple\u2019s own subject lifting, on iOS 17 and later \u2014 so nothing has to leave the device to be tidied up. It is trained on subjects rather than on clothes, so now and again it takes the hanger with the coat. Your original photograph is kept exactly as you shot it either way."
    ],
    related: ["closet-size", "morning-edit"],
    keywords: ["camera", "picture", "blurry", "lighting", "background", "cutout", "quality"]
  },
  {
    id: "morning-edit",
    group: "getting-started",
    question: "What is the morning edit?",
    // The push carries no look: supabase/functions/send-push/copy.ts:68-78 —
    // `morningEditPayload()` is the fixed sentence "The day’s look is ready to
    // read", with the comment "Not 'your look is X'. See the docblock: the
    // server does not have one."
    //
    // Built on the phone: supabase/functions/generate-outfits/index.ts:24-28 —
    // "this function does not generate outfits. The on-device beam search does
    // that, in about ten milliseconds, and sends up its best dozen. This adds
    // taste and language." The engine is src/lib/styling/generate.ts.
    //
    // It degrades rather than fails: generate-outfits/index.ts:30-36 — offline
    // or rate-limited, the client keeps real ranked outfits and the engine's
    // own explanation.
    body: [
      "Your outfits are put together on your phone. A search runs across your closet against the weather and what you have worn lately, and lands on a shortlist in about the time the screen takes to draw.",
      "Then a short AI step reads that shortlist, picks the best few and writes the note that goes with them. If it cannot be reached \u2014 no signal, a slow morning at the other end \u2014 you still get real outfits, ranked and weather-appropriate, in the engine\u2019s own words.",
      "The notification itself carries no look. It says the day\u2019s edit is ready to read and nothing more, because at that hour the server does not have one; the edit is assembled when you open Today."
    ],
    related: ["photo-quality", "closet-size"],
    keywords: ["notification", "push", "today", "suggestion", "outfit", "ai", "daily"]
  },
  // ── Friends & borrowing ──────────────────────────────────────────────────
  {
    id: "who-sees-my-closet",
    group: "friends",
    question: "Who can see my closet?",
    // Mutual, no request queue: `is_friend` at
    // 20260807100000_social_graph_blocks_borrow.sql:102 — two `follows` rows
    // plus no block, evaluated live.
    //
    // Search finds only people you are connected to: contract §3.2. The
    // `ilike` search at features/social-graph/queries.ts:236-258 runs against
    // two views, never the table — `public_profiles` filters
    // `visibility = 'public'` (20260804200000:52), `social_profiles` returns
    // only people already related to you (…privacy_layer.sql:123), and
    // `profiles.visibility` defaults to `private` (20260803210000:230) with no
    // code in `src/` ever writing it.
    //
    // Wear counts DO cross — the atlas's sentence reversed:
    // …privacy_layer.sql:45 projects `wear_count` and `last_worn_at` into
    // `friend_items`, and components/social/FriendItemCard.tsx:118 prints it
    // under every card.
    //
    // Per-item price never crosses; only a mean cost-per-wear does:
    // …privacy_layer.sql:83-92. Planned and unshared outfits never cross:
    // `outfits` and `outfit_calendar` are owner-only
    // (20260803154431_initial_schema.sql:168, :224) and no outfit table
    // reaches the friend layer.
    //
    // Removal is immediate and silent: features/social-graph/mutations.ts:60-88
    // — "No notification fires anywhere; silence is always ambiguous."
    body: [
      "Friends, and only friends. Friendship here is mutual: you add someone, they add you back, and that is the whole handshake \u2014 there is no request sitting in a queue waiting to be approved. There is no public profile and no discover tab, and search turns up only people you are already connected to, so a stranger typing your handle finds nothing.",
      "A friend sees every piece in your active closet \u2014 what it is, what you have marked as lendable, and how many times you have worn it. Wear counts do cross: they are printed on the card, under the piece.",
      "What stays with you is the price of any one thing, and every outfit you planned, changed or never shared. A friend sees an average cost per wear across the closet and no figure for a single piece. Removing a friend takes effect at once and quietly \u2014 nobody is told, and your closet leaves their app the next time they open it."
    ],
    related: ["hide-a-piece", "lending-loop"],
    keywords: ["privacy", "visible", "see", "public", "stranger", "handle", "search", "follower"]
  },
  {
    id: "lending-loop",
    group: "friends",
    question: "What happens when I lend something?",
    // Lendable by default: `alter table items add column borrowable boolean
    // not null default true` at …social_graph_blocks_borrow.sql:123. The
    // owner's toggle is features/social-graph/mutations.ts:212-224, whose
    // docblock states the piece stays visible either way — "only the borrow
    // affordance comes and goes".
    //
    // The loop's four moves are the transition trigger at
    // …social_graph_blocks_borrow.sql:206-214: the owner may take pending to
    // approved or declined and approved to returned; the requester may take
    // pending to canceled, and nothing else.
    //
    // "Waits on Activity" is literal: `borrow_request` is one of the feed's
    // kinds, read owner-side straight off `borrow_requests`
    // (20260810100100_activity_feed.sql:61, :148-150), and
    // features/activity/sentence.ts:238-243 writes the line.
    //
    // No dates and no deposits is a claim about the SHAPE of the row: the
    // table at :125-139 holds item, owner, requester, event, message, status
    // and timestamps. There is no due date to remind anybody about.
    body: [
      "Every piece you add is lendable the moment it lands, and you can switch that off one piece at a time. Switching it off does not hide anything \u2014 the piece still sits in your closet where friends can see it; only the ask disappears.",
      "A friend asks, and the request waits on Activity until you answer. You lend it or you decline, and declining is one tap with nothing to compose. Until you have answered, the person who asked can take the request back.",
      "When it comes home you mark it returned and the loop closes. There are no due dates, no reminders and no deposits: Cinch keeps the record of who has what, and the rest is a conversation between two people who know each other."
    ],
    related: ["who-sees-my-closet", "hide-a-piece"],
    keywords: ["borrow", "lend", "loan", "return", "request", "borrowable"]
  },
  {
    id: "hide-a-piece",
    group: "friends",
    question: "Can I hide a piece from friends?",
    // There is no privacy toggle. `closet_hidden`, `stat_pieces_hidden`,
    // `stat_wears_hidden` and `stat_cost_per_wear_hidden` exist on `profiles`
    // (…privacy_layer.sql:22-25) and the migration says at :18 that the toggle
    // UI "lands in a later Profile session; until then no row ever flips
    // these". Nothing in `src/` writes them. So the article does not mention
    // them; a column with no switch is not an answer.
    //
    // Storage is the lever, and it works because `friend_items` filters
    // `where not i.is_archived` (…privacy_layer.sql:44). The same filter is on
    // `item_owned_by_friend` (:106-113), so the derivatives stop serving too.
    //
    // The side effect, which is the reason this article exists: the styling
    // read filters `.eq('is_archived', false)` at
    // features/styling/queries.ts:116, so a stored piece leaves the engine.
    //
    // Nothing is lost, and a restore can be refused: features/closet/storage.ts
    // :32-35 and :61-71 — `items_enforce_limit_on_restore` fails a restore into
    // a full active closet with `closet_limit_reached`.
    body: [
      "There is no per-piece privacy switch. The one way to take something out of a friend\u2019s view today is to move it to storage \u2014 a stored piece is not in the closet a friend reads, and its photographs stop being served along with it.",
      "That has a cost worth knowing before you use it. A stored piece also leaves the styling engine: Cinch stops building outfits from it, and stops counting it as part of the wardrobe it dresses you from. Storage is a way to put something down, not a way to keep wearing it in private.",
      "Nothing is deleted. Storage keeps every photograph, every wear and every figure, and restoring puts the piece back where it was. The only thing that can turn a restore away is a rotation that is already full, and then storing something else makes the room."
    ],
    related: ["who-sees-my-closet", "closet-size"],
    keywords: ["hide", "private", "storage", "archive", "secret", "stored", "remove"]
  },
  // ── Membership ───────────────────────────────────────────────────────────
  {
    id: "what-paying-buys",
    group: "membership",
    question: "What do I get for paying?",
    // Closet sizes, both ceilings, from features/billing/plans.ts:72-103 —
    // free 10/30, standard 150/450, pro 1000/3000 — mirrored on the server at
    // supabase/functions/_shared/plans.ts (`PLAN_ITEM_LIMITS`,
    // `PLAN_STORED_ITEM_LIMITS`) and enforced in the database by migrations
    // 20260805160000 and 20260808190100.
    //
    // Event hosting from plans.ts:79/89/99 — 2 / 15 / 100, mirroring
    // `event_limit_for_plan()` in 20260807103000.
    //
    // The styling lines are the PRODUCT PROMISE, quoted from plans.ts:77, :87,
    // :97 — "A few each week", "A fresh outfit every day", "Unlimited" — and
    // NOT the enforced ceilings, which are deliberately higher: the server's
    // plans.ts docblock says at length that the enforced number is an abuse
    // control sitting above the promise so a failed provider call cannot spend
    // somebody's week. Printing 5-a-week or 15-a-day here would be printing an
    // anti-abuse threshold as a feature.
    //
    // The one enforced number that IS printed is Pro's stylist cap, because
    // plans.ts:97 calls it "Unlimited" and the server caps it at 100 a day
    // (_shared/plans.ts, `pro.stylist_chat`). "Unlimited" would be the false
    // sentence; the real number is both true and more reassuring than the word.
    // Standard's thirty a month is the same figure on both sides (plans.ts:88
    // and the server's `standard.stylist_chat`), so it is printed flat.
    //
    // No prices. plans.ts:56-69 gives the reason in its own words: the paywall
    // reads StoreKit and formats in the device locale, "because a price typed
    // into a layout is wrong in every country but one". A help article is a
    // layout.
    // All six ceilings, both hosting rows and Standard's message allowance now
    // interpolate. This paragraph is a comparison table said out loud, which is
    // why it is the file's clearest case for the QUOTED register (see the
    // module docblock): six ceilings spanning 10 to 3,000 cannot be half
    // spelled and half not, and "a thousand and three thousand" was the
    // hardest clause in the article to parse for the number it was quoting.
    //
    // Standard's messages read straight off `PLANS.standard.stylist`, which is
    // already the phrase "30 messages a month" — the display string and the
    // sentence are now the same characters.
    //
    // Pro's hundred a day is the one figure here that does NOT derive, and
    // cannot: the client's `PLANS.pro.stylist` says "Unlimited" on purpose, and
    // the real cap lives server-side in supabase/functions/_shared/plans.ts
    // (`pro.stylist_chat`), which this module may not reach. It is printed as a
    // numeral for consistency with its neighbours, and the note above already
    // carries its citation.
    body: [
      `Room, first of all. Free holds ${ceiling(PLANS.free.items)} pieces in rotation and ${ceiling(PLANS.free.storedItems)} in total; Standard holds ${ceiling(PLANS.standard.items)} and ${ceiling(PLANS.standard.storedItems)}; Pro holds ${ceiling(PLANS.pro.items)} and ${ceiling(PLANS.pro.storedItems)}. That is the difference you feel soonest, because it is the one that decides whether your whole wardrobe fits.`,
      `Then the styling. Free builds a few fresh sets a week. Paying makes it a fresh set every morning with real room to re-roll, and opens the stylist \u2014 the conversation, as distinct from the daily edit \u2014 which free does not include at all: ${PLANS.standard.stylist} on Standard, and 100 a day on Pro, which is further than any conversation about clothes has ever gone.`,
      `And hosting: ${ceiling(PLANS.free.eventHosting)} occasions running at once on free, ${ceiling(PLANS.standard.eventHosting)} on Standard, ${ceiling(PLANS.pro.eventHosting)} on Pro. What each tier costs is shown at the point of purchase in your own currency rather than typed into a page like this one, where it would be right in exactly one country.`
    ],
    related: ["how-to-cancel", "closet-size"],
    keywords: ["plan", "pro", "standard", "free", "upgrade", "subscription", "price", "cost", "tier"]
  },
  {
    id: "how-to-cancel",
    group: "membership",
    question: "How do I cancel?",
    // The destination is Apple's own subscriptions screen, the same URL
    // profile.tsx:411 opens from the Manage row (contract A.2 #16).
    //
    // Nothing is deleted on the way down. The closet ceiling is enforced
    // `before insert on items` (20260805160000_membership_tiers.sql:284-285)
    // and `before update of is_archived` for a restore
    // (20260808190100_active_and_stored_limits.sql:130-131). Neither fires on
    // an existing row, so a closet that is over the free line after a
    // downgrade stays exactly as it is; only adding and restoring are refused
    // until it is back under.
    body: [
      "In your Apple account, not in here. Cinch never holds the subscription \u2014 the App Store does \u2014 so cancelling is the same two taps it is for everything else you pay for on this phone.",
      "The button below opens that screen directly. Cancelling stops the renewal; it does not cut the period you have already paid for, and nothing about Cinch changes until that period ends.",
      "After it does, the closet ceiling drops back to the free one \u2014 and nothing is deleted. A closet that is over the line stays whole, every piece and every photograph where you left it. You simply cannot add another until it is back under, and putting something into storage is enough to make the room."
    ],
    related: ["what-paying-buys", "closet-size"],
    keywords: ["cancel", "unsubscribe", "refund", "stop", "billing", "renew", "downgrade"],
    action: { label: "Open subscriptions", url: MANAGE_SUBSCRIPTIONS_URL }
  }
];
function articleById(id) {
  if (!id) return null;
  return HELP_ARTICLES.find((a) => a.id === id) ?? null;
}

// tests/piece-counts.test.ts
var read = (p) => readFileSync(p, "utf8");
var bodyOf = (id) => articleById(id).body.join("\n");
test("the closet-size article quotes the free tier, not a copy of it", () => {
  const body = bodyOf("closet-size");
  assert.ok(body.includes(`${PLANS.free.items} pieces in rotation`), body);
  assert.ok(body.includes(`${PLANS.free.storedItems} in total`), body);
  assert.ok(body.startsWith(`${numberWord(PLANS.free.items).replace(/^./, (c) => c.toUpperCase())},`), body);
});
test("the tier article quotes all six ceilings from PLANS", () => {
  const body = bodyOf("what-paying-buys");
  for (const plan of ["free", "standard", "pro"]) {
    const { items, storedItems, eventHosting } = PLANS[plan];
    assert.ok(body.includes(items.toLocaleString("en-US")), `${plan} active ceiling missing: ${body}`);
    assert.ok(body.includes(storedItems.toLocaleString("en-US")), `${plan} stored ceiling missing: ${body}`);
    assert.ok(body.includes(eventHosting.toLocaleString("en-US")), `${plan} hosting ceiling missing: ${body}`);
  }
  assert.ok(body.includes(PLANS.standard.stylist), body);
});
test("no tier ceiling is spelled out in words anywhere in the help copy", () => {
  const spelled = [
    /\bthirty in total\b/i,
    /\ba hundred and fifty\b/i,
    /\bfour hundred and fifty\b/i,
    /\ba thousand and three thousand\b/i,
    /\bthirty messages\b/i,
    /\bfifteen on Standard\b/i,
    /\btwo occasions\b/i
  ];
  const prose = HELP_ARTICLES.flatMap((a) => a.body).join("\n");
  for (const pattern of spelled) {
    assert.ok(!pattern.test(prose), `a ceiling is spelled into the prose again: ${pattern}`);
  }
});
test("the two number registers never share a clause", () => {
  const small = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty)\b/i;
  for (const article of HELP_ARTICLES) {
    for (const paragraph of article.body) {
      for (const clause of paragraph.split(/[;:]|,\s|\s—\s|\.\s/)) {
        if (!/\d/.test(clause)) continue;
        assert.ok(
          !small.test(clause),
          `${article.id} mixes a spelled number and a numeral in one clause: "${clause.trim()}"`
        );
      }
    }
  }
});
test("the eight in the closet-size article is the engine floor, not a guess", () => {
  const body = bodyOf("closet-size");
  assert.ok(
    body.includes(`at ${numberWord(MIN_CLOSET_FOR_OUTFITS)} pieces`),
    `the engine floor is ${MIN_CLOSET_FOR_OUTFITS} and the article says something else:
${body}`
  );
  assert.notEqual(
    MIN_CLOSET_FOR_OUTFITS,
    PLANS.free.items,
    "the engine floor and the free cap have converged \u2014 the article says both, as different things"
  );
});
test("the free paywall line names the cap once and derives it", () => {
  const line = contextLineFor(Placement.AddGarmentOverLimit);
  assert.deepEqual(
    line.match(/\d+/g),
    [String(PLANS.free.items)],
    `the cap is quoted more than once, or a second number crept in: ${line}`
  );
  assert.ok(!/\bten\b/i.test(line), `the cap is spelled out again: ${line}`);
});
test("the .tsx surfaces still interpolate rather than spell", () => {
  const cases = [
    // C-05's ask is `PIECES_ASKED`, the constant that also draws the pips —
    // deliberately not `PLANS.free.items`; see the constant's own note.
    {
      path: "src/components/closet/example-closet.tsx",
      must: ["numberWord(PIECES_ASKED)", "length: PIECES_ASKED"]
    },
    // P-03's empty week and S-09's too-small closet both ask for the free cap.
    { path: "src/app/(tabs)/plan.tsx", must: ["numberWord(PLANS.free.items)"] },
    { path: "src/components/stylist/stylist-states.tsx", must: ["numberWord(PLANS.free.items)"] }
  ];
  for (const { path, must } of cases) {
    const source = read(path);
    for (const needle of must) {
      assert.ok(source.includes(needle), `${path} no longer derives its count: expected ${needle}`);
    }
    for (const line of source.split("\n")) {
      const code = line.trim();
      if (code.startsWith("//") || code.startsWith("*") || code.startsWith("/*")) continue;
      assert.ok(
        !/(Photograph six pieces|about ten pieces)/i.test(code),
        `${path} spells its count again: ${code}`
      );
    }
  }
});
