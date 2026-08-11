// tests/help-search.test.ts
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
function articlesInGroup(id) {
  return HELP_ARTICLES.filter((a) => a.group === id);
}
function relatedArticles(article) {
  const seen = /* @__PURE__ */ new Set([article.id]);
  const out = [];
  for (const id of article.related) {
    if (seen.has(id)) continue;
    const found = articleById(id);
    if (!found) continue;
    seen.add(id);
    out.push(found);
  }
  return out;
}

// src/features/help/search.ts
function tokenize(input) {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/['’]/g, "").split(/[^a-z0-9]+/).filter((t) => t.length > 1);
}
var WEIGHT = { question: 6, keyword: 3, body: 1 };
function index(articles) {
  return articles.map((article) => ({
    article,
    question: tokenize(article.question),
    keywords: article.keywords.flatMap((k) => tokenize(k)),
    body: article.body.flatMap((p) => tokenize(p))
  }));
}
var INDEX = index(HELP_ARTICLES);
function hits(field, token) {
  return field.some((word) => word.startsWith(token));
}
function scoreOne(entry, token) {
  if (hits(entry.question, token)) return WEIGHT.question;
  if (hits(entry.keywords, token)) return WEIGHT.keyword;
  if (hits(entry.body, token)) return WEIGHT.body;
  return 0;
}
function searchHelp(query) {
  const tokens = tokenize(query);
  if (tokens.length === 0) return HELP_ARTICLES;
  const scored = [];
  INDEX.forEach((entry, order) => {
    let total = 0;
    for (const token of tokens) {
      const s = scoreOne(entry, token);
      if (s === 0) return;
      total += s;
    }
    scored.push({ article: entry.article, score: total, order });
  });
  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  return scored.map((s) => s.article);
}
function alsoAsk(query, count = 3) {
  const tokens = tokenize(query);
  const scored = INDEX.map((entry, order) => ({
    article: entry.article,
    score: tokens.reduce((sum, token) => sum + scoreOne(entry, token), 0),
    order
  })).filter((s) => s.score > 0).sort((a, b) => b.score - a.score || a.order - b.order).map((s) => s.article);
  const out = [...scored];
  for (const fallback of DEFAULT_ASKS) {
    if (out.length >= count) break;
    if (out.some((a) => a.id === fallback)) continue;
    const article = HELP_ARTICLES.find((a) => a.id === fallback);
    if (article) out.push(article);
  }
  return out.slice(0, count);
}
var DEFAULT_ASKS = ["closet-size", "who-sees-my-closet", "what-paying-buys"];
var NOT_BUILT = [
  {
    id: "watch",
    triggers: ["watch", "watchos", "wearable", "applewatch"],
    // "Watch" alone is a garment word — somebody cataloguing a wristwatch as a
    // piece is asking a closet question, not a platform one.
    unless: ["closet", "piece", "item", "accessory", "jewellery", "jewelry", "add", "tag"],
    answer: "There is no Cinch app for Apple Watch, so nothing here covers it. If that is what you were after, that is the whole answer."
  },
  {
    id: "ipad",
    triggers: ["ipad", "tablet"],
    answer: "Cinch is built for iPhone. It will install on an iPad and run at phone size, but nothing about it is designed for that screen and there is no iPad version behind the scenes."
  },
  {
    id: "android",
    triggers: ["android", "pixel", "samsung", "galaxy"],
    answer: "Cinch is iPhone only. The part that lifts a garment off its background is Apple\u2019s, and it runs on the phone rather than on a server \u2014 so an Android version is a rebuild rather than a recompile, and there is not one."
  },
  {
    id: "web",
    triggers: ["web", "website", "browser", "desktop", "mac", "laptop", "computer", "chrome"],
    answer: "There is no Cinch on the web. cinchstyle.com is a page about the app, not the app \u2014 your closet lives on your phone and in your account, and the phone is the only way in."
  },
  {
    id: "widget",
    triggers: ["widget", "widgets", "complication", "lockscreen"],
    answer: "There is no home-screen widget. The morning edit arrives as a notification and opens Today; that is the whole of it."
  }
];
var GENERIC_MISS = "Nothing here covers that. The set is short on purpose and it grows from what people write in about, so a question asked often enough becomes an article.";
function emptyAnswerFor(query) {
  const tokens = tokenize(query);
  if (tokens.length === 0) return GENERIC_MISS;
  const joined = new Set(tokens);
  for (let i = 0; i < tokens.length - 1; i += 1) {
    joined.add(`${tokens[i]}${tokens[i + 1]}`);
  }
  for (const entry of NOT_BUILT) {
    if (!entry.triggers.some((t) => joined.has(t))) continue;
    if (entry.unless?.some((u) => joined.has(u))) continue;
    return entry.answer;
  }
  return GENERIC_MISS;
}

// tests/help-search.test.ts
var ids = (query) => searchHelp(query).map((a) => a.id);
test("eight articles, three groups, the split the atlas names", () => {
  assert.equal(HELP_ARTICLES.length, 8);
  assert.equal(articlesInGroup("getting-started").length, 3);
  assert.equal(articlesInGroup("friends").length, 3);
  assert.equal(articlesInGroup("membership").length, 2);
});
test("every article is three paragraphs and every related id resolves", () => {
  for (const article of HELP_ARTICLES) {
    assert.equal(article.body.length, 3, `${article.id} should be three paragraphs`);
    for (const id of article.related) {
      assert.ok(articleById(id), `${article.id} points at a missing article: ${id}`);
      assert.notEqual(id, article.id, `${article.id} relates to itself`);
    }
    assert.equal(relatedArticles(article).length, article.related.length);
  }
});
test("no article ends by suggesting you write in \u2014 the atlas rule, asserted", () => {
  const deflections = [/write to us/i, /contact (us|support)/i, /get in touch/i, /reach out/i];
  for (const article of HELP_ARTICLES) {
    const last = article.body[article.body.length - 1];
    for (const pattern of deflections) {
      assert.ok(!pattern.test(last), `${article.id} ends by deflecting: ${last}`);
    }
  }
});
test("the banned sentences are not in the copy", () => {
  const banned = [
    /do not see how often you wear/i,
    /can.?t see how often you wear/i,
    /no way to find you by searching/i,
    /you can hide (your closet|individual stats)/i,
    /photos are only ever sent for tagging/i,
    /generated for you overnight/i,
    /erases everything/i
  ];
  const prose = HELP_ARTICLES.flatMap((a) => a.body).join("\n");
  for (const pattern of banned) {
    assert.ok(!pattern.test(prose), `banned sentence present: ${pattern}`);
  }
});
test("tokenising folds case, accents and the typographic apostrophe", () => {
  assert.deepEqual(tokenize("Caf\xE9 Borrow"), ["cafe", "borrow"]);
  assert.deepEqual(tokenize("a friend\u2019s closet"), ["friends", "closet"]);
  assert.deepEqual(tokenize("a b ai"), ["ai"]);
  assert.deepEqual(tokenize("   ...   "), []);
});
test("an empty query is the whole set, not an empty result", () => {
  assert.equal(searchHelp("").length, HELP_ARTICLES.length);
  assert.equal(searchHelp("   ").length, HELP_ARTICLES.length);
});
test("a prefix hits without a stemmer", () => {
  assert.ok(ids("photo").includes("photo-quality"));
  assert.ok(ids("borrow").includes("lending-loop"));
});
test("the question outranks the body", () => {
  assert.equal(ids("cancel")[0], "how-to-cancel");
  assert.equal(ids("lend")[0], "lending-loop");
  assert.equal(ids("hide")[0], "hide-a-piece");
});
test("every token must hit \u2014 one miss and the article is out", () => {
  assert.ok(ids("apple").length > 0);
  assert.deepEqual(ids("apple watch"), []);
  assert.deepEqual(ids("android"), []);
});
test("results are stable for equally-scored queries", () => {
  const first = ids("closet");
  const second = ids("closet");
  assert.deepEqual(first, second);
});
test("People also ask is always three, and never empty", () => {
  assert.equal(alsoAsk("apple watch").length, 3);
  assert.equal(alsoAsk("zzzzz").length, 3);
  assert.equal(alsoAsk("").length, 3);
  assert.ok(alsoAsk("apple watch").some((a) => a.id === "how-to-cancel"));
});
test("the suggestion rail never repeats an article", () => {
  const suggested = alsoAsk("closet photo borrow");
  assert.equal(new Set(suggested.map((a) => a.id)).size, suggested.length);
});
test("the five things Cinch has not built are answered by name", () => {
  assert.match(emptyAnswerFor("apple watch"), /Apple Watch/);
  assert.match(emptyAnswerFor("does it work on ipad"), /iPhone/);
  assert.match(emptyAnswerFor("android app"), /iPhone only/);
  assert.match(emptyAnswerFor("web version"), /no Cinch on the web/);
  assert.match(emptyAnswerFor("home screen widget"), /no home-screen widget/);
});
test("anything else gets the honest generic sentence, not an apology", () => {
  const generic = emptyAnswerFor("qwertyuiop");
  assert.match(generic, /Nothing here covers that/);
  assert.doesNotMatch(generic, /sorry|apolog/i);
  assert.equal(emptyAnswerFor(""), generic);
});
test("no empty answer promises a future release", () => {
  const answers = [
    "apple watch",
    "ipad",
    "android",
    "web",
    "widget",
    "qwertyuiop"
  ].map(emptyAnswerFor);
  for (const answer of answers) {
    assert.doesNotMatch(answer, /coming soon|not yet|on the roadmap|working on/i, answer);
  }
});
test('"watch" as a garment word does not trigger the platform answer', () => {
  assert.doesNotMatch(emptyAnswerFor("add a watch to my closet"), /Apple Watch/);
});
