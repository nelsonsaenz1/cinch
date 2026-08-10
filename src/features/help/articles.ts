/**
 * The eight articles, as data.
 *
 * A `.ts` file with no React and no React Native import anywhere in its
 * transitive graph, because `tests/help-search.test.ts` bundles it with esbuild
 * and esbuild cannot parse React Native's Flow source. Nothing here may reach
 * for `@/lib/supabase`, a component, or a hook. The screens read it; it reads
 * two pure modules and nothing else.
 *
 * Those two are `features/billing/plans.ts` (no imports at all) and
 * `features/onboarding/reveal-copy.ts`, whose only import is `countOutfits`
 * from `features/closet/outfit-count.ts`, whose only import is `import type`
 * from `@/lib/styling` and therefore erases at compile time. Both are already
 * bundled by `tests/plans.test.ts` and `tests/reveal-copy.test.ts`, so the
 * no-React rule is proved rather than assumed. One module is deliberately NOT
 * imported and cannot be — see the `MIN_CLOSET_FOR_OUTFITS` note on the
 * closet-size article.
 *
 * ── The two number registers ──────────────────────────────────────────────
 *
 * `docs/design/positioning-contract.md` §7 requires every count here to derive
 * from `PLANS` rather than be typed into the prose, and the obvious mechanical
 * fix — `numberWord()` everywhere — does not work, because `numberWord` spells
 * 0–20 and returns numerals above that. "ten pieces in rotation, 30 in total"
 * is the sentence that mechanical fix produces, and it is worse than the
 * literal it replaced.
 *
 * So there are two registers and one rule for choosing between them:
 *
 *   SPOKEN → `numberWord`. A number the article is saying out loud as its
 *   answer. "Ten, to begin with." "Cinch starts building outfits at eight
 *   pieces." Always inside `numberWord`'s range by construction, because a
 *   number a person says in a sentence is a small one.
 *
 *   QUOTED → `ceiling()`, a numeral with a thousands separator. A limit being
 *   stated as a limit, especially in a list of them. This is already the
 *   app's register for exactly these figures — `context-lines.ts:140` ships
 *   "150 pieces is where Standard stops. Pro holds 1,000" — so the help page
 *   and the paywall now agree, which they did not before.
 *
 * THE TWO NEVER SHARE A CLAUSE. That is the whole point of having a rule: a
 * list containing any number above twenty is a list of numerals, or half of it
 * spells and half of it does not. It is also why `numberWord` was left alone
 * rather than extended to spell "one thousand" — it lives in
 * `features/onboarding/` and sets the REVEAL's register, where a headline of
 * "Ten pieces. Fourteen outfits." is the point and "One hundred and forty-four
 * outfits." would not be.
 *
 * Rhetorical numbers are neither and derive from nothing: "beats forty you
 * photographed once" is an argument, not a fact about the product, and there
 * is no constant it could read from.
 *
 * ── Why every sentence carries a citation ─────────────────────────────────
 *
 * These paragraphs are assertions about the app on the page whose whole job is
 * being trustworthy. The build contract (docs/design/privacy-invite-help-
 * contract.md §2) forbids shipping one without a `file:line` behind it, and its
 * Appendix A.1 names six sentences that read perfectly and are false — several
 * of which the Help atlas itself contains. Three of them were drawn on HS-02
 * and HS-01 and had to be rewritten here:
 *
 *   * "They do not see how often you wear something." They do.
 *     `friend_items` projects `wear_count` and `last_worn_at`
 *     (20260808110000_friend_closet_privacy_layer.sql:45) and
 *     `components/social/FriendItemCard.tsx:118` prints it as the card caption.
 *   * "…no way to find you by searching." Search exists; it finds people you
 *     are already connected to (`social_profiles`, …privacy_layer.sql:123) and
 *     nobody else, because `profiles.visibility` defaults to `private` and no
 *     code in `src/` ever writes it. Contract §3.2 — the precision edit is to
 *     say what search does, not to deny it.
 *   * "You can hide a piece." There is no privacy toggle. `closet_hidden` and
 *     `stat_*_hidden` exist in the database (…privacy_layer.sql:22-25) with no
 *     UI writing them; storage is the only lever, and it costs the piece its
 *     place in the styling engine.
 *
 * The per-article comments below carry the rest of the trace.
 *
 * ── House rules the atlas sets, applied here ──────────────────────────────
 *
 * "Answers, not deflection": no article ends by suggesting the reader write in.
 * "The voice does not change at the edges": no support-desk register anywhere.
 * Every apostrophe is U+2019, as everywhere else in the app.
 */

import { PLANS } from '@/features/billing/plans';
import { numberWord } from '@/features/onboarding/reveal-copy';
import { MIN_CLOSET_FOR_OUTFITS } from '@/features/styling/thresholds';

/**
 * The QUOTED register — a ceiling stated as a ceiling. `toLocaleString` is what
 * puts the comma in 1,000, and it is the same call `context-lines.ts:140`
 * makes for the same figure, so the paywall and the help page cannot print Pro
 * differently.
 */
const ceiling = (v: number) => v.toLocaleString('en-US');

/** Sentence-initial spelled numbers. `reveal-copy`'s own `cap` is private. */
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export type HelpGroupId = 'getting-started' | 'friends' | 'membership';

export type HelpGroup = {
  readonly id: HelpGroupId;
  /** The tracked eyebrow over the group, and the eyebrow on each answer page. */
  readonly title: string;
};

/** The three groups, in the order HS-01 draws them. */
export const HELP_GROUPS: readonly HelpGroup[] = [
  { id: 'getting-started', title: 'Getting started' },
  { id: 'friends', title: 'Friends & borrowing' },
  { id: 'membership', title: 'Membership' },
];

export type HelpAction = {
  readonly label: string;
  readonly url: string;
};

export type HelpArticle = {
  readonly id: string;
  readonly group: HelpGroupId;
  /** Written the way somebody says it out loud — the atlas's own rule. */
  readonly question: string;
  /** Three short paragraphs. Under a minute, start to finish. */
  readonly body: readonly string[];
  /** Ids of the two adjacent worries, for the Related card. */
  readonly related: readonly string[];
  /**
   * Words a reader might search that the question and body do not already
   * contain. Never a synonym farm — the index below already tokenises the
   * whole article, so this is only for the vocabulary that genuinely differs
   * from ours ("archive" for storage, "unsubscribe" for cancel).
   */
  readonly keywords: readonly string[];
  /** An action the answer itself is, rather than describes. Membership only. */
  readonly action?: HelpAction;
};

/**
 * Apple's subscription management screen.
 *
 * `src/app/profile.tsx:52` and `src/app/membership-thanks.tsx:18` each hold
 * their own copy of this literal and both are outside Unit H's territory, so
 * this is a third — declared here rather than imported, because importing
 * `profile.tsx` for a string would pull a whole screen into the article data
 * and break the no-React rule above. If the three are ever consolidated, this
 * is one of them; the value is identical by inspection.
 */
export const MANAGE_SUBSCRIPTIONS_URL = 'https://apps.apple.com/account/subscriptions';

export const HELP_ARTICLES: readonly HelpArticle[] = [
  // ── Getting started ──────────────────────────────────────────────────────
  {
    id: 'closet-size',
    group: 'getting-started',
    question: 'How many pieces should I put in?',
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
      `${cap(numberWord(PLANS.free.items))}, to begin with. That is the free closet: ${ceiling(PLANS.free.items)} pieces in rotation, ${ceiling(PLANS.free.storedItems)} in total once you count what you have put away — and it is meant as a working number rather than a taste of one. ${cap(numberWord(PLANS.free.items))} you actually reach for beats forty you photographed once.`,
      `Cinch starts building outfits at ${numberWord(MIN_CLOSET_FOR_OUTFITS)} pieces, and it needs a top and a bottom, or a dress, before it can assemble anything at all. ${cap(numberWord(MIN_CLOSET_FOR_OUTFITS))} jumpers is not a closet it can dress you from; ${numberWord(MIN_CLOSET_FOR_OUTFITS)} pieces that cover you head to toe is.`,
      `Moving something to storage frees a slot in rotation, so the ${numberWord(PLANS.free.items)} is a curation rather than a wall. Nothing is lost on the way in or out: the photograph, the wear count and the cost figure all wait for the piece to come back.`,
    ],
    related: ['photo-quality', 'what-paying-buys'],
    keywords: ['limit', 'minimum', 'how much', 'add', 'items', 'wardrobe', 'ten', 'archive'],
  },
  {
    id: 'photo-quality',
    group: 'getting-started',
    question: 'Do my photos have to look good?',
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
      'No. There is no quality check anywhere in Cinch — no blur test, no minimum resolution, nothing that can turn a photograph away. Whatever you shoot goes in, and a dim one on the bedroom floor counts the same as a good one.',
      'It works best with one garment on a plain background, which is what the line on the camera screen is asking for. That is a preference, not a rule: it is simply the shot the cutout has the easiest time with.',
      'The cutout runs on your phone — Apple’s own subject lifting, on iOS 17 and later — so nothing has to leave the device to be tidied up. It is trained on subjects rather than on clothes, so now and again it takes the hanger with the coat. Your original photograph is kept exactly as you shot it either way.',
    ],
    related: ['closet-size', 'morning-edit'],
    keywords: ['camera', 'picture', 'blurry', 'lighting', 'background', 'cutout', 'quality'],
  },
  {
    id: 'morning-edit',
    group: 'getting-started',
    question: 'What is the morning edit?',
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
      'Your outfits are put together on your phone. A search runs across your closet against the weather and what you have worn lately, and lands on a shortlist in about the time the screen takes to draw.',
      'Then a short AI step reads that shortlist, picks the best few and writes the note that goes with them. If it cannot be reached — no signal, a slow morning at the other end — you still get real outfits, ranked and weather-appropriate, in the engine’s own words.',
      'The notification itself carries no look. It says the day’s edit is ready to read and nothing more, because at that hour the server does not have one; the edit is assembled when you open Today.',
    ],
    related: ['photo-quality', 'closet-size'],
    keywords: ['notification', 'push', 'today', 'suggestion', 'outfit', 'ai', 'daily'],
  },

  // ── Friends & borrowing ──────────────────────────────────────────────────
  {
    id: 'who-sees-my-closet',
    group: 'friends',
    question: 'Who can see my closet?',
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
      'Friends, and only friends. Friendship here is mutual: you add someone, they add you back, and that is the whole handshake — there is no request sitting in a queue waiting to be approved. There is no public profile and no discover tab, and search turns up only people you are already connected to, so a stranger typing your handle finds nothing.',
      'A friend sees every piece in your active closet — what it is, what you have marked as lendable, and how many times you have worn it. Wear counts do cross: they are printed on the card, under the piece.',
      'What stays with you is the price of any one thing, and every outfit you planned, changed or never shared. A friend sees an average cost per wear across the closet and no figure for a single piece. Removing a friend takes effect at once and quietly — nobody is told, and your closet leaves their app the next time they open it.',
    ],
    related: ['hide-a-piece', 'lending-loop'],
    keywords: ['privacy', 'visible', 'see', 'public', 'stranger', 'handle', 'search', 'follower'],
  },
  {
    id: 'lending-loop',
    group: 'friends',
    question: 'What happens when I lend something?',
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
      'Every piece you add is lendable the moment it lands, and you can switch that off one piece at a time. Switching it off does not hide anything — the piece still sits in your closet where friends can see it; only the ask disappears.',
      'A friend asks, and the request waits on Activity until you answer. You lend it or you decline, and declining is one tap with nothing to compose. Until you have answered, the person who asked can take the request back.',
      'When it comes home you mark it returned and the loop closes. There are no due dates, no reminders and no deposits: Cinch keeps the record of who has what, and the rest is a conversation between two people who know each other.',
    ],
    related: ['who-sees-my-closet', 'hide-a-piece'],
    keywords: ['borrow', 'lend', 'loan', 'return', 'request', 'borrowable'],
  },
  {
    id: 'hide-a-piece',
    group: 'friends',
    question: 'Can I hide a piece from friends?',
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
      'There is no per-piece privacy switch. The one way to take something out of a friend’s view today is to move it to storage — a stored piece is not in the closet a friend reads, and its photographs stop being served along with it.',
      'That has a cost worth knowing before you use it. A stored piece also leaves the styling engine: Cinch stops building outfits from it, and stops counting it as part of the wardrobe it dresses you from. Storage is a way to put something down, not a way to keep wearing it in private.',
      'Nothing is deleted. Storage keeps every photograph, every wear and every figure, and restoring puts the piece back where it was. The only thing that can turn a restore away is a rotation that is already full, and then storing something else makes the room.',
    ],
    related: ['who-sees-my-closet', 'closet-size'],
    keywords: ['hide', 'private', 'storage', 'archive', 'secret', 'stored', 'remove'],
  },

  // ── Membership ───────────────────────────────────────────────────────────
  {
    id: 'what-paying-buys',
    group: 'membership',
    question: 'What do I get for paying?',
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
      `Then the styling. Free builds a few fresh sets a week. Paying makes it a fresh set every morning with real room to re-roll, and opens the stylist — the conversation, as distinct from the daily edit — which free does not include at all: ${PLANS.standard.stylist} on Standard, and 100 a day on Pro, which is further than any conversation about clothes has ever gone.`,
      `And hosting: ${ceiling(PLANS.free.eventHosting)} occasions running at once on free, ${ceiling(PLANS.standard.eventHosting)} on Standard, ${ceiling(PLANS.pro.eventHosting)} on Pro. What each tier costs is shown at the point of purchase in your own currency rather than typed into a page like this one, where it would be right in exactly one country.`,
    ],
    related: ['how-to-cancel', 'closet-size'],
    keywords: ['plan', 'pro', 'standard', 'free', 'upgrade', 'subscription', 'price', 'cost', 'tier'],
  },
  {
    id: 'how-to-cancel',
    group: 'membership',
    question: 'How do I cancel?',
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
      'In your Apple account, not in here. Cinch never holds the subscription — the App Store does — so cancelling is the same two taps it is for everything else you pay for on this phone.',
      'The button below opens that screen directly. Cancelling stops the renewal; it does not cut the period you have already paid for, and nothing about Cinch changes until that period ends.',
      'After it does, the closet ceiling drops back to the free one — and nothing is deleted. A closet that is over the line stays whole, every piece and every photograph where you left it. You simply cannot add another until it is back under, and putting something into storage is enough to make the room.',
    ],
    related: ['what-paying-buys', 'closet-size'],
    keywords: ['cancel', 'unsubscribe', 'refund', 'stop', 'billing', 'renew', 'downgrade'],
    action: { label: 'Open subscriptions', url: MANAGE_SUBSCRIPTIONS_URL },
  },
];

/** One article by id, or null. Never throws — a bad deep link is not a crash. */
export function articleById(id: string | null | undefined): HelpArticle | null {
  if (!id) return null;
  return HELP_ARTICLES.find((a) => a.id === id) ?? null;
}

export function groupTitle(id: HelpGroupId): string {
  return HELP_GROUPS.find((g) => g.id === id)?.title ?? '';
}

/** The articles of one group, in declaration order. */
export function articlesInGroup(id: HelpGroupId): readonly HelpArticle[] {
  return HELP_ARTICLES.filter((a) => a.group === id);
}

/**
 * The Related card's two entries, resolved and de-duplicated.
 *
 * Filtering out the article itself and anything that does not resolve means a
 * typo in `related` costs a missing link rather than a blank row or a loop.
 */
export function relatedArticles(article: HelpArticle): readonly HelpArticle[] {
  const seen = new Set<string>([article.id]);
  const out: HelpArticle[] = [];
  for (const id of article.related) {
    if (seen.has(id)) continue;
    const found = articleById(id);
    if (!found) continue;
    seen.add(id);
    out.push(found);
  }
  return out;
}
