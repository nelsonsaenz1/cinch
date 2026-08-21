/**
 * Every sentence on the Privacy & data pages that asserts a fact about this
 * app, with the `file:line` that proves it.
 *
 * This is a `.ts` and not a component on purpose. Atlases 38 and 40 are almost
 * entirely assertions about the app rather than drawings of behaviour, so the
 * wave's contract (docs/design/privacy-invite-help-contract.md §2) requires a
 * claim trace: "no sentence that asserts a fact about the app ships without a
 * `file:line` proving it". Keeping the prose here, beside its citation and
 * away from layout, is what makes that checkable — and what lets
 * `dev-privacy.tsx` render the identical words from fixtures.
 *
 * ── Where this text refuses the atlas ──────────────────────────────────────
 *
 * 1. PD-01 dropped "Season in review": atlas 34 was deferred and the feature
 *    does not exist (contract §3.3).
 * 2. PD-06's "Comments … stay, shown as 'a former member'" is false — every
 *    social table cascades from `auth.users` (contract §3.1).
 * 3. PD-06's "within thirty days" is false — deletion is immediate, and that
 *    immediacy is what satisfies Guideline 5.1.1(v) (contract §3.1).
 * 4. PD-04's `closet/` row is reworded: the archive cannot carry the photos
 *    (contract §3.4).
 * 5. No retention or no-training claim about the AI partner appears anywhere
 *    here. `docs/design/system-safety-contract.md §3` is a standing, launch-
 *    blocking refusal: "treat any retention or training claim as unshippable"
 *    until the provider terms are confirmed in writing. The wave contract's §7
 *    App Privacy table still carries "never used for training"; the older,
 *    more specific refusal wins and the integrator has been told.
 */

import {
  CONSENT_FACTS as SHEET_CONSENT_FACTS,
  type ConsentFact,
} from '@/features/auth/consent-facts';

export type DisclosureRow = {
  title: string;
  body: string;
};

/** One named part of a topic whose detail involves more than one party. */
export type DisclosureSection = {
  title: string;
  body: string;
};

/**
 * One row of the PV-01 index.
 *
 * `gist` is what audit 75/76 actually asks for and what the page did not have:
 * "the collapsed index names all nine categories" and each row "carries a
 * Medium title and a regular gist, so the collapsed index is itself a readable
 * summary". Before this, a reader had to open nothing — the whole disclosure
 * was one continuous card — which meant the first viewport named three
 * categories out of seven and the rest were discoverable only by scrolling
 * through the full text of the ones above them.
 *
 * A gist is a SUMMARY OF THE BODY BELOW IT, never a claim of its own. Every one
 * of them is checkable against the paragraph it heads, and
 * `tests/w3-g4-consent-privacy.test.ts` holds that: no gist may promise
 * something its own body does not say.
 *
 * `body` and `sections` are the same thing at different resolutions — one
 * paragraph, or several when the detail involves genuinely different parties
 * (PV-02's shopping topic separates the listing service, the cache, the shop's
 * own image server and the merchant, because they are four companies).
 */
export type PrivacyTopic = {
  title: string;
  gist: string;
  body?: string;
  sections?: readonly DisclosureSection[];
};

/** PV-01 · the sentence above the index. Both halves hold; see the rows below. */
export const INDEX_INTRO =
  'Your closet lives in your account. Photographs are private, your wear history is yours, and nothing is sold. Every line below opens to the full detail.';

/**
 * PD-01 / PV-01 · the disclosure, as an index.
 *
 * These row descriptions ARE the App Privacy disclosure — the atlas's own rule
 * is that each line of the store card maps to one row here, and that a
 * disclosure added to the listing is added to this page in the same release.
 * So they are written as full sentences and not as labels.
 *
 * ── Where the drawn gists are not used ─────────────────────────────────────
 *
 * PV-01 draws "Weather by city, calendar titles never stored" for the location
 * row. Both halves are wrong about this app and the row's own body says so:
 * the forecast is fetched from a coordinate rounded to two decimals, which is
 * not a city, and the calendar TITLE is sent to the AI partner with the outfit
 * request — so "never stored" answers a question nobody asked while leaving the
 * disclosed thing undisclosed. The gist here summarises the body instead.
 *
 * PV-01 also draws "Email, membership, devices" for the account row. Cinch
 * holds no device list to disclose, and inventing one to match a drawn label
 * would be a disclosure of something the app does not do — the same defect as
 * concealing something it does (see `LINK_HANDLING_ROW`).
 */
export const PRIVACY_TOPICS: readonly PrivacyTopic[] = [
  {
    title: 'Your closet photos',
    // Summarises the body: private to the account, reached through signed
    // links (`features/closet/use-image-urls.ts`), and the three doors.
    gist: 'Private to you, reached through signed links. Three things send one.',
    // Kept: both buckets are the user's own and are walked by name at deletion
    // (`supabase/functions/delete-account/index.ts:58`).
    // Sent, in THREE cases, not the two this row used to name:
    //   1. tagging (`supabase/functions/tag-item/index.ts`);
    //   2. the listing match — `garment-search`'s `match` action signs the
    //      item's own photo and attaches it (`garment-search/index.ts`,
    //      `matchListing`; the attachment is built in
    //      `garment-search/provider.ts`, `openRouterWebProvider.match`);
    //   3. THE COLOUR SWATCH, which nothing disclosed until 2026-08-10.
    //      Describing a piece can carry a photograph too: `pickColourSwatch()`
    //      (`src/features/ingest/use-garment-search.ts:151-176`) opens the
    //      library picker, re-encodes what was tapped at 256px, and sends it as
    //      a data URL on the SEARCH request — attached to the model message at
    //      `garment-search/provider.ts` (`search`, the `swatchDataUrl` part).
    //      It is a small photograph, but it is a photograph, and "two cases"
    //      was an undercount of exactly the kind this file exists to prevent.
    // Naming only tagging is the sentence the contract bans by name
    // (Appendix A.1, row 3); naming only two is the same mistake one door on.
    // Sells/advertises: `docs/design/system-safety-contract.md §3` lists
    // "We never sell it or advertise against it" as a claim Cinch controls.
    body: 'Kept on Cinch’s servers so they load on any device. A photo leaves this phone in three cases: when a piece is tagged, when you ask Cinch to match a piece against a product listing, and when you attach one to show the true color of something you are describing. Cinch never sells them and never advertises against them.',
  },
  {
    title: 'Wears and plans',
    // The gist carries the caveat rather than hiding it one tap down: "kept
    // until you delete them" alone would read as "and nobody else sees any of
    // it", which the body then contradicts.
    gist: 'Kept until you delete them. A friend can see a piece’s wear count.',
    // "Lately" and "The Ten" are live; "Season in review" is not (contract
    // §3.3 — atlas 34 deferred).
    // Owner-only outfits and calendar: `20260803154431_initial_schema.sql:168`,
    // `:224` (Appendix A.2 #4).
    // The honest caveat: `friend_items` projects `wear_count, last_worn_at`
    // (`20260808110000_friend_closet_privacy_layer.sql:45`) and
    // `FriendItemCard.tsx:120` prints it — so "visible to you only", which the
    // atlas writes, is not true of the count.
    body: 'The dates behind Lately and The Ten. Which outfit you wore on which day is yours alone — no friend can see it. A friend looking at your closet does see how many times a piece has been worn.',
  },
  {
    title: 'Where you are, and what is on today',
    // NOT PV-01's "Weather by city, calendar titles never stored" — see the
    // header above this array. The gist names the two things that leave.
    gist: 'A coarse location for the forecast. Event titles go with the outfit request.',
    // ── A ROW THE ATLAS DOES NOT DRAW, AND THE CONTRACT GETS WRONG ─────────
    //
    // Atlas 38 writes "no location" into the Account details row, and the
    // wave contract's §7 App Privacy card lists Location under "Not
    // collected". Both are false, and this is the one row on the page written
    // against the contract rather than from it.
    //
    // Location: `expo-location` is a dependency and
    // `src/features/context/use-style-context.ts:162-168` requests
    // when-in-use permission and takes a fix. `features/context/weather.ts:43`
    // sends it to Open-Meteo, rounded to two decimals — coarse by
    // construction, and the file says that is deliberately Apple's Coarse
    // Location threshold. The permission string is declared at
    // `app.config.ts:392`. Reverse geocoding runs on device.
    //
    // Calendar: `app.config.ts:430` declares the permission and
    // `use-style-context.ts:130` reads today's entries. Formality is judged on
    // device by a regex table (`use-style-context.ts:34-47`) — but the event
    // TITLE is then sent up with the outfit request
    // (`src/features/styling/use-outfits.ts:133-137`). That is a category of
    // personal data leaving the phone that nothing in the app discloses today.
    body: 'If you allow it, Cinch reads your location to fetch the local forecast — rounded to about half a mile before it is sent, never stored on our servers, never in the background. If you allow it, Cinch also reads today’s calendar entries to judge how dressy the day is; the title of an event goes to our AI partner with the outfit request, so leave the permission off if that is not something you want sent.',
  },
  {
    title: 'Account details',
    gist: 'Your handle, your email and your friends. No contacts, no ad identifier.',
    // Handle + email: `profiles`, and the sign-in is a six-digit code to that
    // address. Friends: two `follows` rows (`20260807100000_social_graph_
    // blocks_borrow.sql:102`).
    // Not findable by strangers: `public_profiles` filters `visibility =
    // 'public'` (`20260804200000_public_boundary_tenant_integrity_and_
    // commands.sql:52`), `social_profiles` returns only people already related
    // to you (`20260808110000_friend_closet_privacy_layer.sql:123`),
    // `profiles.visibility` defaults to `'private'`
    // (`20260803210000_styling_learning_social.sql:230`) and nothing in `src/`
    // writes it (contract §3.2).
    // No ad identifier: ATT is not requested and IDFA is not read (contract
    // §4.2). No contacts: there is no contacts permission or dependency —
    // `expo-contacts` is not in package.json and no NSContacts key is declared.
    // "No location" is NOT claimed here; see the row above.
    body: 'Your handle, your email, and the friends you have added. Search only turns up people you are already connected to — there is no public profile to find. Cinch never asks for your contacts and never reads an advertising identifier.',
  },
  {
    // ── A CATEGORY THE PAGE HAS NEVER DISCLOSED, AND SHIPS ─────────────────
    //
    // PV-01 draws an Analytics row and the page had none. It is not a drawing
    // of something aspirational: `eas.json` sets
    // `EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN` on both the preview and production
    // profiles, so a store build measures. Every sentence below is a line of
    // `src/lib/posthog.tsx` read back:
    //
    //   · the client is null without a token (`:39`, `:49-51`) — hence
    //     "when it is configured" is NOT written: on the builds a user can
    //     install, it is;
    //   · the only identifier is the Supabase user UUID (`:18-24`);
    //   · no email, no display name, no photograph, no stylist question, no
    //     plan note, no calendar title (`:19-21`);
    //   · session replay off (`:52-56`);
    //   · touch autocapture off, BECAUSE the accessibility labels it would
    //     record are garment names (`:675-680`);
    //   · screens come from the router pathname with no params (`:685-687`);
    //   · person properties are plan, trial state and closet size — three
    //     counts and enums (`features/analytics/analytics-properties.tsx`);
    //   · uncaught exceptions and unhandled rejections are captured, console
    //     capture deliberately is not (`:83-88`).
    title: 'How the app is used',
    gist: 'Screens and counts. Never a photograph, a garment name or your email.',
    body: 'Cinch measures which screens are opened and counts things like which plan you are on and how many pieces you have, so it can tell whether a change helped. The only name attached to any of it is your Cinch account id. Your email, your photographs, your garment names, your stylist questions, your plan notes and your calendar titles are never sent — screen names come from the route, with nothing filled in, and Cinch does not record taps or replay your screen. If the app crashes, the error itself is reported.',
  },
  {
    // ── PV-02, and correction 03 ───────────────────────────────────────────
    //
    // The old page said nothing about the catalogue at all, and the AI-consent
    // page's fact 7 carried the whole story in one paragraph. Four parties are
    // involved and they are not the same party, which is why this is the one
    // topic with sub-sections.
    title: 'Shopping partners',
    gist: 'Listing search, what the cache keeps, shop pictures, and paid links.',
    sections: [
      {
        title: 'Searching listings',
        // `garment-search` answers a typed description from Datafeedr's
        // licensed catalogue with `GARMENT_SEARCH_ALLOW_UNLICENSED` defaulting
        // to false, so no web search runs on this path and no model sees the
        // words (see fact 7 under CONSENT_FACTS below, and its citations).
        body: 'When you type what a garment is, those words go to Datafeedr, a company that licenses product listings from shops. Who you are, what is in your closet and who your friends are do not go with them.',
      },
      {
        title: 'What the cache keeps',
        // Correction 03. The honest version, from
        // `supabase/functions/_shared/catalog.ts`: `cacheKey()` (:340-355) is a
        // SHA-256 of the provider, mode, brand and normalised query;
        // `retainableTerms()` (:498-504) returns a SORTED, DEDUPLICATED subset
        // of a fixed vocabulary, capped at `MAX_RETAINED_TERMS = 12` (:488).
        // The sentence itself is discarded — `:722` says so in those words.
        //
        // Saying "nothing is cached" would have been simpler and false, and the
        // reason it matters is the reason the cache exists: Datafeedr meters
        // requests, so the row is what stops the same question being paid for
        // twice.
        body: 'Your sentence is not kept. What can remain is a scrambled key made from it, and a set of at most twelve ordinary garment words drawn from a fixed list — navy, wool, crewneck — held in no order, so the same question does not have to be asked twice. Nothing in that row points back to you.',
      },
      {
        title: 'Loading the pictures',
        body: 'The pictures beside each result are the shops’ own, and your phone loads each one from the shop itself. That means the shop’s server sees a request from your device. Nothing about your Cinch account goes with it.',
      },
      {
        title: 'Opening a merchant',
        // Correction 14 / D-4: the label is per row, evaluated from that
        // merchant's confirmed-joined programme state
        // (`features/commerce/use-shop-match.ts`), and both labels live in
        // `features/commerce/copy.ts`. Written here in the same words the Gap
        // Feed and the help articles use.
        //
        // Group 5 stopped this sentence quoting the unpaid label verbatim. It
        // used to say every other row reads “Open at merchant”, which is still
        // exactly what a friend's-piece sheet prints (`linkDisclosure`) but no
        // longer what a Gap Feed row prints — GF-02 names the shop instead,
        // “Open at Uniqlo”, so a reader looking for the quoted words would not
        // find them. The fact being disclosed did not change; only one of the
        // two surfaces' wording did, so this describes the marker rather than
        // transcribing a string that now varies.
        body: 'Some merchants have a paid arrangement with Cinch. A row for one of those is marked “Paid link” and may earn Cinch a commission if you buy; every other row just says it opens the shop, and does nothing else. Which rows you are shown, and the order they are in, are worked out from your closet before any shop is consulted.',
      },
    ],
  },
];

/**
 * Kept for the App Privacy mapping, which is written against "what is stored"
 * rather than against the index's shape.
 *
 * The four rows that were this array before PV-01 are the first four topics,
 * by reference — the store card maps to those four, and `PRIVACY_TOPICS`'s two
 * new entries are a data flow the listing already declares (analytics) and one
 * that stores nothing at all (the catalogue).
 */
export const STORED_ROWS: readonly PrivacyTopic[] = PRIVACY_TOPICS.slice(0, 4);

/**
 * PD-01 · the "Link handling" row (contract §4.1, §7).
 *
 * Held apart from the three above because it renders if and only if
 * `DEFERRED_LINKS_AVAILABLE` — the attribution SDK's stable release predates
 * the New Architecture and its New-Arch rewrite pins `react-native <0.85`
 * against this app's 0.86, so it may never land in the binary
 * (`src/features/invite/native.ts:33-45`). A disclosure of something the app
 * does not do is exactly as wrong as concealing something it does.
 *
 * What the provider receives: the SDK's install/click attribution, which is a
 * device-scoped identifier. What it never receives: anything from the closet —
 * `src/features/invite/native.ts:54-60` gives it a one-method surface that
 * returns a handle and nothing else.
 */
export const LINK_HANDLING_ROW: PrivacyTopic = {
  title: 'Link handling',
  gist: 'An install identifier goes to Branch when you arrive from an invite.',
  body: 'When you install Cinch from someone’s invite link, an install identifier goes to Branch, our link provider, so the invite reaches the right person. It is not an advertising identifier, and Branch never sees anything from your closet.',
};

/** PD-01 · the closing line. Verbatim from the atlas; both halves hold. */
export const SELLS_NOTHING_FOOTER =
  'Cinch sells nothing and runs no advertising. There is no third party with a copy of your closet.';

/**
 * PV-01 · the three rows that open a page rather than a paragraph.
 *
 * The atlas draws all nine rows as expanders. Three of them are not paragraphs:
 * AI partners carries a live setting and the control that withdraws it, export
 * carries a request button and a history, and deletion carries a typed
 * confirmation. Expanding them in place would either duplicate those controls
 * or put a destructive action inside a disclosure row, so they keep their
 * chevron and their page. The gist is what changes: it now names the category
 * in the collapsed index, which is what audit 75 asks for.
 *
 * The AI row's gist is not here — it is live state (`consentStatusLine`), built
 * in `app/privacy.tsx` from the consent record and the ledger.
 */
export const EXPORT_TOPIC_GIST = 'Four data files and photos.html, a link to every picture.';
export const DELETE_TOPIC_GIST = 'Runs immediately, while you wait. What is left afterwards.';

// ---------------------------------------------------------------------------
// CN-01 · the ask itself
// ---------------------------------------------------------------------------

/**
 * The sheet's title and opening sentence — correction 01.
 *
 * NOT part of the consent record. `CONSENT_FACTS` is the wording a user agreed
 * to and the privacy page quotes it back; these two lines are the frame around
 * it, and they were wrong in a way worth fixing: the sheet said "To do it, the
 * photo has to leave your phone", which conflated two operations that are not
 * the same operation and are not gated by the same thing.
 *
 *   · Cutting the garment out of its background is Apple Vision, on the device.
 *     `modules/garment-cutout/ios/SubjectLift.swift` runs
 *     `VNGenerateForegroundInstanceMaskRequest` against a `CGImage` — the model
 *     behind "Copy Subject" in Photos. There is no network in that module and
 *     no consent check near it, so it keeps working for somebody who declines.
 *   · Naming the piece and guessing its details is the model call, and it is
 *     the only thing this sheet is asking about (`supabase/functions/tag-item`).
 *
 * A reader who thinks they are consenting to the cutout is consenting to the
 * wrong thing, and a reader who declines because they want to keep the cutout
 * loses nothing they were trying to keep.
 */
export const CONSENT_ASK_TITLE = 'Naming your garments';
export const CONSENT_ASK_LEAD =
  'Cutting a garment out of its background happens on this phone. Naming it and guessing its details is what needs a model.';

/**
 * CN-01's footer — the honest limit of the claim, and the resolution of the
 * atlas's open claim 1 (model-provider retention).
 *
 * `docs/design/system-safety-contract.md §3` is a standing, launch-blocking
 * refusal: treat any retention or training claim about the AI partner as
 * unshippable until the provider terms are confirmed in writing. That refusal
 * is normally a reason NOT to write a sentence. Here it is the sentence: Cinch
 * states what it controls, and says plainly that what a partner keeps is the
 * partner's own terms rather than promising zero retention on their behalf.
 *
 * The routing pin is a claim about ROUTING and lives in the record's second
 * fact, where it is worded to stay inside what is enforced. Nothing here widens
 * it.
 */
export const CONSENT_ASK_FOOTER =
  'What each partner keeps is set by their own terms. Cinch does not claim otherwise here. You can change this in Settings either way.';

// ---------------------------------------------------------------------------
// PD-02 · AI consent
// ---------------------------------------------------------------------------

/**
 * The consent disclosure, re-read rather than re-summarised.
 *
 * The first four are the four facts `ConsentSheet` puts in front of a new
 * user, word for word — the atlas's rule is that "the withdrawal screen shows
 * the original wording, not a summary of it", so a paraphrase here would break
 * the page's own rule.
 *
 * IMPORTED, NOT DUPLICATED. The first four come from
 * `@/features/auth/consent-facts`, which the sheet reads too — one array, two
 * screens. They were briefly transcribed here instead, because the sheet is a
 * `.tsx` and this file is bundled by esbuild for the test runner, which cannot
 * parse React Native's Flow source; the fix was to move the shared sentences
 * into a module with no React in it rather than to keep two copies.
 *
 * The last two facts are NOT in the sheet, and that is the point of adding
 * them — this page is the disclosure, and the sheet is shown at tagging time
 * and describes only that moment.
 *
 *   5. The other photo doors. `garment-search`'s `match` action signs the
 *      user's own photo and sends it to a vision model
 *      (`garment-search/index.ts`, `matchListing`; attached in `provider.ts`),
 *      and its `search` action can carry a 256px colour swatch picked from the
 *      library (`src/features/ingest/use-garment-search.ts:151-176`). Appendix
 *      A.1 bans by name the sentence that omits the first; the second was
 *      simply missed until 2026-08-10 and is now named here and on the web
 *      policy in the same release.
 *   6. What travels that is not a photograph. `generate-outfits` receives a
 *      description of the assembled pieces AND the title of each of today's
 *      calendar events (`src/features/styling/use-outfits.ts:133-137`); the
 *      stylist chat receives a digest, the assembled outfits and the typed
 *      question, never photographs (`stylist-chat/index.ts:23`, `:137`).
 *      Nothing in the app said so before this page.
 *   7. Where a DESCRIBED garment's picture comes from. Rewritten 2026-08-11,
 *      because the answer changed and a privacy page that lags the code is
 *      worse than one that says less. Until that day every listing lookup ran
 *      an Exa web search; `garment-search` now answers a description from
 *      Datafeedr's licensed catalogue instead, with
 *      `GARMENT_SEARCH_ALLOW_UNLICENSED` defaulting to false, so the web path
 *      is not consulted at all. The old sentence described traffic that no
 *      longer happens — it was accurate when written and became false the hour
 *      the switch was thrown.
 *   8. The one search that DOES still run. Naming a brand from the user's own
 *      photograph is a vision judgement a product feed cannot make, so `match`
 *      keeps the web provider under `GARMENT_SEARCH_ALLOW_UNLICENSED_MATCH`.
 *      The routing-pin hole therefore still exists, on that path only:
 *      `garment-search/provider.ts` records in `completeWithWebSearch` that
 *      OpenRouter's guarantees are documented as NOT applying to plugin
 *      traffic. `docs/ai-provider-terms.md` §2.4 quotes the exclusion; §4
 *      forbids any sentence implying the search is covered, which is why this
 *      one says the opposite in plain words — and why it now says WHICH search,
 *      rather than implying every listing lookup is one.
 */
export const CONSENT_FACTS: readonly ConsentFact[] = [
  // The four the sheet asks with, verbatim and by reference.
  ...SHEET_CONSENT_FACTS,
  {
    lead: 'Three doors, not one.',
    rest: ' A photo leaves this phone when a piece is tagged, when you ask Cinch to match a piece against a product listing, and when you attach one to show the true color of a piece you are describing. Nothing else in the app sends a photograph.',
  },
  {
    lead: 'And some words, without a photo.',
    rest: ' When Cinch writes about an outfit it sends a description of the pieces, and — if you have given it your calendar — the titles of today’s events, so the note can mention what you are dressing for. The stylist chat sends your question and that same description. No photograph goes with either.',
  },
  {
    lead: 'Describing a piece asks a catalog, not the open web.',
    rest: ' When you type what a garment is, those words go to Datafeedr, a company that licenses product listings from shops, and the pictures that come back are the shops’ own — supplied by them for this purpose. No web search runs, and no AI model sees those words. And while you are choosing from the results, your phone loads each picture from the shop itself, so those shops see a request from your device.',
  },
  {
    lead: 'Photographing a piece to name its brand still runs a web search, and the rule above does not cover it.',
    rest: ' Reading a brand off your own photograph is something a catalog cannot do, so that one search is carried out by Exa rather than by our AI partner. The routing rule — only models that are not allowed to learn from what they receive — covers the model and not the search, so what that search is made of is handled under Exa’s policy rather than anything Cinch can hold anyone to for you.',
  },
];

/**
 * PD-02 · "If you withdraw".
 *
 * What stops: all three Edge Functions read `ai_consent_version` and refuse
 * with `ai_consent_required` when it is null (`src/features/auth/use-consent.ts:
 * 99-119`), so tagging, the stylist chat and the AI rerank all stop.
 * What keeps working: outfits are built on-device by the beam search in
 * `src/lib/styling/generate.ts` and never needed the network (Appendix A.1,
 * row 4). Tags already written stay on the items — nothing rewrites `ai_tags`
 * on revoke.
 */
export const WITHDRAW_CONSEQUENCE =
  'Tagging new pieces stops, so does the listing match, and so does the stylist chat. Your closet stays exactly as it is, the tags already written stay on your items, and outfit suggestions keep coming — Cinch builds those on your phone and they never needed the AI.';

/** PD-03 · the confirmation sheet, in the present tense. */
export const WITHDRAW_SHEET_BODY =
  'Tagging and listing matches stop straight away. Adding a piece will ask you for color, cut and fabric instead. Nothing already in your closet changes or disappears.';

/**
 * PD-02 · the not-granted state, which the atlas does not draw.
 *
 * Consent is re-given through `ConsentSheet` and never a bare toggle:
 * `use-consent.ts:116-119` — "consent that was withdrawn has to be given again
 * in full, with the disclosure in front of the user, or it is not consent".
 */
export const WITHOUT_CONSENT =
  'Nothing is being sent. Adding a piece asks you for its color, cut and fabric, and the stylist chat is off. Outfit suggestions keep working — Cinch builds those on your phone.';

/**
 * CN-02 · the declined path, drawn as a configuration rather than a punishment.
 *
 * The longer list first, because it is the whole product; the shorter list
 * second, because it is three things.
 *
 * ── Correction 01, which this app can actually make ────────────────────────
 *
 * The atlas's correction is that cutting a garment out of its background is
 * on-device and survives a declined consent. It is right, and this repository
 * proves it: `modules/garment-cutout/ios/SubjectLift.swift` runs Apple Vision's
 * `VNGenerateForegroundInstanceMaskRequest` — the model behind "Copy Subject"
 * in Photos — against a `CGImage` on the device. There is no network in that
 * module and no consent check anywhere near it.
 *
 * ── Where the drawn list is wrong about THIS app ───────────────────────────
 *
 * CN-02 lists "packing" among the things that still work, and as of the
 * deterministic-AI work it is RIGHT again. It was wrong for one release:
 * `packing-brief` read `ai_consent_version` and refused with
 * `ai_consent_required`, exactly as `tag-item` and `stylist-chat` still do.
 * That call is gone — `features/plan/packing-memo.ts` composes the memo from
 * the forecast, the closet and the capsule the phone already computed, so
 * packing works with AI processing switched off, offline, and without
 * spending any allowance.
 *
 * The drawn "what does not" list also omits the stylist chat, which stops
 * (`use-consent.ts:99-119`). `WITHDRAW_CONSEQUENCE` above has always named it,
 * so leaving it out here would make two screens disagree about the same fact.
 */
export const WITHOUT_CONSENT_WORKS =
  'Photographing a piece, cutting it out of its background, describing it in words, outfits, the diary, the plan, packing and everything social. Cinch asks you for the two things it would otherwise have guessed.';

export const WITHOUT_CONSENT_LOST =
  'Guessed names, color and fabric; finding a piece from a product link; and the stylist chat.';

// ---------------------------------------------------------------------------
// PD-04 · Export your data
// ---------------------------------------------------------------------------

export type ManifestRow = {
  /** The file's real name inside the archive, or what the entry is. */
  name: string;
  body: string;
};

/**
 * The manifest is the page.
 *
 * The atlas's first row was `closet/` — "Every photo at full size, plus a CSV
 * of the details." That is not what arrives. A Supabase Edge Function cannot
 * assemble a multi-hundred-megabyte archive inside its memory and time budget,
 * and the closets that most need an export are exactly the ones that would
 * fail; the founder's call was data in the zip, photos as time-limited links
 * (contract §3.4). Naming the actual files is the whole point of this screen,
 * so the row is reworded rather than removed.
 */
export const MANIFEST_ROWS: readonly ManifestRow[] = [
  { name: 'closet.csv', body: 'Every piece, with its details as you have them today.' },
  { name: 'wears.csv', body: 'Every date and what you wore on it.' },
  { name: 'plans.csv', body: 'Occasions, dates and the looks you planned.' },
  { name: 'account.json', body: 'Handle, email, join date, friend handles.' },
  {
    // Named `photos.html` rather than `photos`, because that is the file's real
    // name — `build-export/assemble.ts:351` writes it and
    // `build-export/mail.ts:144-145` names it in the email the user is holding
    // when they read this page. A manifest whose whole purpose is naming the
    // actual files should not be the one row that describes a file instead.
    name: 'photos.html',
    body: 'An index of links to every original photo at full size, rather than the images themselves — a closet of photographs is far too large to put inside one file. The links work for a while and then stop, so download them when the email arrives.',
  },
];

/**
 * PV-03 · the line above the manifest.
 *
 * Five files, named, because correction 15's point is that the export is not
 * "a bundle with your photographs in it" — the photographs are links with an
 * expiry, and a user who files the download and comes back in a month finds the
 * data intact and the pictures gone. `build-export/assemble.ts:13-14` lists the
 * same five.
 */
export const EXPORT_CONTENTS_LINE =
  'Five files: closet.csv, wears.csv, plans.csv, account.json, and photos.html with a link to every picture.';

/**
 * PV-03 · the sentence the Ready state adds.
 *
 * The important thing, said at the only moment it can still be acted on. The
 * links inside `photos.html` are the same short-lived signed URLs as the
 * archive's own (`build-export/mail.ts:147`), so "they expire" is the file's
 * behaviour and not a policy this page is inventing. No number: nothing sets a
 * fixed window that this page could print, and PD-05 prints the real date off
 * the row when the row carries one.
 */
export const EXPORT_SAVE_WHILE_LINKS_LAST =
  'Open photos.html and save the pictures while the links last — they are full resolution and they expire.';

/** PD-04 · the line under the manifest. Your export is of your own rows. */
export const FRIENDS_NOT_INCLUDED =
  'Friends’ closets are not included — those are theirs to export.';

/**
 * PD-04 · the line under the button.
 *
 * One a day is enforced in `request_data_export()`
 * (`20260810120000_data_exports.sql:76-82`). The atlas also promises "the link
 * expires after seven days"; nothing sets `expires_at` in the migration, so
 * the number is not this page's to state. PD-05 prints the real expiry off the
 * row instead.
 */
export const EXPORT_LIMIT_NOTE =
  'One request a day. The links in the email stop working after a while — if yours have, ask for a fresh export.';

// ---------------------------------------------------------------------------
// PD-06 · Delete your account
// ---------------------------------------------------------------------------

/**
 * Three time horizons, as the atlas invented them — which is a genuinely good
 * shape — filled with true ones.
 *
 * The atlas wrote "Within thirty days" and "Comments you left on a friend's
 * look stay, shown as 'a former member'". Both are false.
 * `supabase/functions/delete-account/index.ts:8-13` deletes immediately and
 * names "we will process this within 30 days" as a thing that does NOT satisfy
 * Guideline 5.1.1(v); every social table cascades
 * (`20260807102000_event_outfits_votes_comments.sql:17`, `:62`, `:109`).
 */
export const DELETION_HORIZONS: readonly DisclosureRow[] = [
  {
    // PV-04 · correction 16 retitles the three horizons, and the new titles are
    // better than the old ones for the reason the correction gives: "the moment
    // you confirm" reads like the first step of a schedule, and there is no
    // schedule. "While you wait" says the thing that makes this screen satisfy
    // Guideline 5.1.1(v) at all.
    title: 'While you wait',
    // Storage before the auth user, both buckets, while you wait:
    // `delete-account/index.ts:14-19`, `:58`, `:151-224`.
    body: 'Every photo you uploaded is deleted from Cinch’s storage — your closet and your profile picture — and then the account itself. It happens while you wait. There is no queue and no thirty-day window; being able to do it here, now, is what the App Store asks of us.',
  },
  {
    title: 'In the same breath',
    // Every table carries `on delete cascade` from auth.users; the function
    // relies on it deliberately rather than enumerating tables
    // (`delete-account/index.ts:29-33`). Comments/votes/posts: the three lines
    // cited above.
    body: 'Deleting the account cascades through every table Cinch has: your pieces, wears, plans, boards and friendships, and every comment, vote and post you left on a friend’s look. Those are erased, not renamed — nothing of yours reappears under “a former member”.',
  },
  {
    title: 'What is left afterwards',
    // The two documented exceptions, named because concealing them is not
    // defensible: `content_reports` has no FK to the subject on purpose
    // (`20260807100000_social_graph_blocks_borrow.sql:69-72`), and
    // `ai_calls.user_id` is `on delete set null`
    // (`20260807122000_ai_calls_survive_churn.sql:43`).
    body: 'Two things, both on purpose. If somebody reported you, that report keeps what they wrote — a report has to outlive the thing it is about, or moderation stops working. And the ledger of what our AI cost keeps one row per call for accounting, with the link to you cut: no name, no item, no photo.',
  },
];

/**
 * PD-06 / PV-04 · the panel above the buttons.
 *
 * PV-04 draws a third section headed "Cannot be undone", and its first two
 * sentences — there is no restore, export first if you want to keep any of it —
 * are true and were only implied here. They are folded into this panel rather
 * than added as a fourth horizon, because the horizons are a description of
 * what deletion DOES and this is the instruction beside the button.
 *
 * ── The sentence that is not here, and must not be ─────────────────────────
 *
 * PV-04's third section ends "Comments you left in other people's events stay,
 * shown without your name." That is the same claim this file's header has
 * refused since it was written, one phrasing along: every social table cascades
 * from `auth.users` (`20260807102000_event_outfits_votes_comments.sql:17`,
 * `:62`, `:109`), so those comments are erased, not anonymised. The second
 * horizon says so in those words. Printing the drawn sentence would tell a user
 * that something of theirs survives deletion when nothing does.
 */
export const EXPORT_FIRST_NOTE =
  'This cannot be undone and there is no restore. Export first if you want to keep any of it — after this there is nothing left to send.';
