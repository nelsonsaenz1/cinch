# App Store Connect — listing copy and submission answers

Everything App Store Connect asks for, drafted and within Apple's character
limits. Paste as-is; the limits are noted so edits stay legal.

**This file is a mirror, not a source.** Nothing in this repository pushes to
App Store Connect. Every string below is here to be copied into ASC by hand, so
they are given as exact, complete strings with their counts, labelled by the
field they belong in. If you edit one here, it is not live until someone pastes
it.

**Rewriting the search metadata costs nothing right now.** Title, subtitle and
keywords are *version-scoped* metadata: once a version has been released they
can only change alongside a new version submission. **Cinch has not been
released** — the version page still shows "Add Build" — so all three can be
rewritten freely today, as many times as you like, with no update required and
no ranking history to lose. This is the cheapest they will ever be to change.
Promotional text is the exception in the other direction: it is editable at any
time, released or not.

---

## Identity

| Field | Value | Limit |
|---|---|---|
| App Name | `Cinch: Outfit Planner & Closet` | 30 (uses **30**) |
| Subtitle | `Capsule Wardrobe, Packing List` | 30 (uses **30**) |
| Bundle ID | `com.nelsonsaenz.cinch` | — |
| SKU | `cinch-ios-001` | — |
| Primary category | Lifestyle | — |
| Secondary category | Utilities | — |
| Price | Free | — |

**Why neither category is Shopping:** the app does not sell anything, and there
is no store, no wishlist, no cart and no product feed. Listing a non-commerce
app under Shopping invites a reviewer to look for a store that is not there.
Revisit only if a shopping integration actually ships.

**The one place retailer imagery appears, and why it is still not commerce.**
The listing-photo flow (`supabase/functions/garment-search/`) shows a grid of up
to six product photographs from shops. It is worth being precise about this
before a reviewer is: there are no prices, no buy buttons, no affiliate links,
and the app never opens a retailer's site — the only `Linking.openURL` targets
anywhere in `src/` are Cinch's own privacy/support/terms pages, App Store
subscription management, an invite link, a help article and a venue
reservation. The grid exists so a garment the user already owns can wear a
better picture of itself. That is a *photo source*, not a storefront, and the
description now says so in as many words.

### Why the title and subtitle changed (2026-08-10)

The previous pair — `Cinch: AI Closet & Stylist` / `Outfits, chosen with
friends` — spent both search surfaces on the social angle. Per
`docs/design/positioning-contract.md` §2, social is real, shipped and a genuine
differentiator, but **it does not belong in the title, subtitle or keyword
field**, because those are search surfaces and nobody types "chosen with
friends" into the App Store. Social moves down the product page. It is not
removed, not softened, and not hidden: it holds two full sections of the
description, one screenshot, and a custom product page.

What the new pair does:

- **Title** takes the two highest-intent head terms in the category, *outfit
  planner* and *closet*, and drops "AI" and "Stylist". Both survive in the
  keyword field, which Apple indexes separately.
- **Subtitle** claims two lanes no direct competitor claims in their subtitle,
  and both are shipped features rather than aspirations — see the claim trace.

**Dropping "AI" from the title is deliberate and evidenced,** not an oversight.
`docs/app-store/screenshot-directive-v2.md` §1.2 collects the research: Cicek,
Gursoy & Lu (2024) found that mentioning artificial intelligence lowered
purchase intention across all eight product categories tested, and the penalty
is concentrated in identity-adjacent products. Adapty's Lifestyle benchmark has
AI-branded apps converting install-to-trial at 5.31% against a 10.92% category
average. Every direct competitor already has AI in its name, so the word is
parity, not difference.

**One consequence, now discharged:** that directive's §1.2 gave two reasons for
keeping "AI" out of screenshot headlines, and the *first* — "the app name already
carries the signal" — **stopped being true the moment the title dropped AI.** The
recommendation survives on its remaining evidence, which is the stronger half.
The dead reason was retired from the directive on 2026-08-10 and replaced, with
the false premise recorded in place so nobody reinstates it.

---

## Keywords

```
digital,stylist,organizer,clothes,what,wear,ootd,style,calendar,inventory,clothing,ai,travel,weather
```

**Exactly 100 of 100 characters. 14 terms. Zero repeats of any word in the
title or subtitle, and zero stop words.**

That constraint is the whole design of this field, so it is worth stating
plainly: **repetition does not stack.** Apple indexes the app name, the subtitle
and the keyword field as one combined bag of words, and it assembles multi-word
queries by *combining across* those fields. A word that already appears in the
title earns nothing extra by appearing again here — it just spends characters.
So the keyword field contains only words the title and subtitle do not, and the
head terms are assembled at match time:

| Query it assembles | From |
|---|---|
| outfit planner | title |
| closet organizer | title + `organizer` |
| digital closet · digital wardrobe | `digital` + title/subtitle |
| what to wear | `what` + `wear` |
| capsule wardrobe | subtitle |
| packing list · travel packing list | subtitle + `travel` |
| outfit calendar · wardrobe calendar | `calendar` + title/subtitle |
| clothing inventory | `clothing` + `inventory` |
| AI stylist · AI closet | `ai` + `stylist` + title |
| outfit weather · weather outfit | `weather` + title |
| style app · ootd | `style`, `ootd` |

### What was changed from the proposed field, and why

The proposal was
`digital,stylist,organizer,clothes,list,what,to,wear,ootd,style,calendar,inventory,clothing,ai`.

| Change | Reason |
|---|---|
| **Cut `to`** | Apple strips common stop words from the keyword field and re-inserts them when matching phrases. "what to wear" matches from `what` + `wear` alone, so `to` bought nothing and cost 3 characters. |
| **Moved `list` into the subtitle** | The subtitle had four characters spare (see below). Putting *List* there indexes it at subtitle weight, which is higher than keyword weight, **and** frees five characters here. |
| **Added `travel`** | The subtitle now claims packing. Packing without travel misses "travel packing list", "travel outfit", "travel wardrobe" — the highest-intent phrases the packing feature can win. |
| **Added `weather`** | A shipped, genuinely differentiating mechanic (apparent temperature, not the forecast high) that the previous live field carried and the proposal dropped. |
| **Character count corrected** | The proposal was described as 100 characters. It is **93** — seven were left unspent. This field is now exactly 100. |

### One term to re-examine first when real data arrives

`clothes` and `clothing` both appear, at a combined cost of 15 characters.
Apple tokenises them separately, and they sit in different head phrases
("clothes organizer" vs "clothing inventory"), so both is defensible — but it is
the least confident 15 characters in the field and the first thing to test.

> **These strings are inference, not Apple's data.** No popularity scores were
> available when they were written. Before finalising, open a **free Apple Search
> Ads account** (no spend required), use the keyword planner to pull real
> popularity scores (the 5–100 scale) for every term above, and drop anything
> that scores at the floor in favour of a term that does not. Per the CMO, this
> step is not optional — it is the difference between a reasoned guess and a
> ranked field.

---

## Next build — keyword rewrite and storefront localisations (founder order, 2026-09-07)

**Order:** "Do the keyword rewrite and localizations when you cut the next build." These fields
are version-locked, so both land on the version the next build attaches to (1.2.4 or later)
and go live with it. `scripts/asc-listing.mjs` does the work; this section is its input.

### Why localisations first, and what they buy

A localisation is a second 100-character keyword field. Apple indexes several localisations
into one storefront — the widely reported map is **US ← en-US + es-MX**, **UK ← en-GB + en-US**,
**Canada ← en-CA + fr-CA**, **Australia ← en-AU + en-US** (industry-observed behaviour,
not Apple documentation; the sign it is working is App Store Search impressions rising
without a US keyword change). Cinch is English-only and 5 of the 16 arrivals on 09-05/06
were outside the US, so every added English localisation is pure additive reach, and
**es-MX is the one that widens the US field itself**: the terms that did not fit en-US go
there, in English, and the US storefront reads both.

Each new localisation copies the en-US name, subtitle, description, promotional text and
What's New verbatim (the script does this — never leave a localisation half-filled, Apple
rejects the version) and carries its own keyword field. Screenshots are copied from en-US
by the script too; a localisation without screenshots blocks submission.

### The keyword fields

`en-US` — the live field, 100/100, unchanged **until the Search Ads scores exist**:

```
digital,stylist,organizer,clothes,what,wear,ootd,style,calendar,inventory,clothing,ai,travel,weather
```

Ranked swap candidates for en-US, cheapest first — apply only against popularity scores
from a free Apple Search Ads account (the doc above already names this as the gate, and it
is still not done):

| swap out | chars freed | swap in | why |
|---|---|---|---|
| `clothes` | 8 | `fashion` (8) | the doc's own flagged double with `clothing`; "fashion app / fashion planner" is a head query the field has nothing for |
| `digital` | 8 | `lookbook` (9) | "digital closet" is real but the title already wins "closet"; "lookbook" is uncovered |
| `what` | 5 | `daily` (6) | ONLY if the planner shows "what to wear" below the floor — it is likely above it, so this is last |

Two constraints that do not change: nothing already in the name or subtitle, and no stop
words. **If the subtitle moves to candidate A ("Outfits from clothes you own", 09-05
nightly §11.5), `capsule`, `wardrobe`, `packing` and `list` fall out of the subtitle and 27
characters of the keyword field must absorb them** — that trade is the reason to decide the
subtitle and the keywords together, on the same version.

`es-MX` — English terms, the second US field. Nothing that is in en-US, the name or the
subtitle (repetition does not stack across localisations either):

```
outfits,lookbook,fashion,mix,match,virtual,dress,fit,daily,morning,laundry,worn,cost,per,jeans
```
(94 characters. "mix" + "match" assemble "mix and match" with the stop word stripped;
"cost" + "per" join en-US's `wear` for the cost-per-wear query the app's own cover uses —
`wear` is not repeated here because the US storefront reads both fields as one bag.)

`en-GB` — British vocabulary the US field cannot carry, plus the head terms:

```
wardrobe,organiser,jumper,trainers,trousers,outfits,lookbook,fashion,mix,match,daily,dress,what,wear
```
(98 characters. `organiser` with an s; `wardrobe` repeats the subtitle only if the
subtitle stays — drop it for `capsule`-free storefronts if candidate A ships.)

`en-AU` and `en-CA` — same string as en-GB (Australia and Canada share the spellings and
the head terms; Canada additionally reads fr-CA, which is not worth a French field for an
English-only app yet).

### What the script does, in order (`node scripts/asc-listing.mjs`)

1. `read` — prints every version's localisations and the appInfo name/subtitle. Safe.
2. `plan --version 1.2.4` — shows exactly what `apply` would create and patch. Safe.
3. `apply --version 1.2.4` — on an EDITABLE version only (`PREPARE_FOR_SUBMISSION`,
   `DEVELOPER_REJECTED`, `REJECTED`, `METADATA_REJECTED`): patches en-US keywords if the
   doc's string differs, creates the missing appInfo localisations (name + subtitle),
   creates the missing version localisations (description / promo / What's New copied from
   en-US, keywords from this doc), and copies every en-US screenshot set into each new
   localisation. Idempotent; re-running fills whatever is missing.

The build session's checklist: bump `version` in app.config.ts → retake the fingerprint pins →
EAS build with auto-submit (creates the ASC version) → `read` → decide the subtitle → edit the
strings above → `plan` → `apply` → confirm in ASC → submit.

## Promotional text

*170 characters. **The one field on this page that is editable at any time,
without a new version and without review** — released or not. Use it for
seasonal messaging, and change it as often as the season does.*

**In force** (set 2026-09-01 on 1.2.3, carried by 1.2.4, restored on 1.2.5
2026-09-16; `PROMOTIONAL_TEXT` in `scripts/asc-listing.mjs`, pinned by
`tests/asc-listing.test.ts`):

```
Ten pieces is all it takes. Cinch dresses you in clothes you already own — it never invents a garment or asks you to buy one first.
```

131 of 170. The wedge, then the one sentence that answers the category's 1★
pages (invented garments, "buy one first").

⚠️ **A version created through the API carries NO promotional text.** Keywords,
description and What's New come across from the previous version; this field
does not (1.2.5 went live 2026-09-14 with all five localisations blank, ledger
A81). After every `create`, run:

```
node scripts/asc-listing.mjs promo --version <X>
```

It works on a released version — no submission — and `plan` lists a
`set-promo` step for any localisation whose field differs.

**Seasonal candidate** (158 of 170; leads with the wedge, ends on the one
approved marketing constant, `docs/design/positioning-contract.md` §3):

```
Photograph ten things you already own. Cinch works out what goes with what, tells you why, and dresses you every morning from there. Ten pieces is a wardrobe.
```

Seasonal variants live in `docs/aso/custom-product-pages.md`.

---

## Description

*4,000 character limit. **This draft is 3,991 characters** — counted, not
estimated. Rewritten 2026-08-10 to lead with the ten-piece wedge
(`docs/design/positioning-contract.md` §2). Social did not shrink in truth, only
in position: it now sits mid-page in two full sections rather than in sentence
one. Amended the same day to restore `BUILT ONLY FROM WHAT YOU OWN` — see rule 4
below, and the trims that paid for it.*

**Only the first three lines are visible before "more".** They are, in order:
`Ten pieces. That is all Cinch needs before it can dress you.` — then the blank
line — then the opening of the second paragraph. That first sentence is doing
almost all of the work on this page; do not bury it under a feature list.

### The accuracy rule, and the claim trace

**No sentence in this description asserts a fact about the app without a
`file:line` proving it** (`docs/design/positioning-contract.md` §4). The full
trace is below. Four rules are settled and are not up for re-argument:

1. **Borrow-into-outfit-builder is banned.** An earlier draft promised that a
   borrowed garment "shows up in your own outfit builder until you give it
   back". That is **not implemented**: `src/features/styling/queries.ts` selects
   `items` filtered by `.eq('user_id', userId)`, and nothing joins an approved
   `borrow_requests` row into the borrower's wardrobe or composer. Do not re-add
   it until that path exists. Metadata describing functionality the binary does
   not have is a Guideline 2.3.1 rejection.
2. **No competitor is named or compared against**, anywhere in this file.
3. **The outfit count may never appear as a constant** — not here, not in the
   promotional text, not in a screenshot headline, not in an in-app event
   (§3 of the contract). Where the description wants to talk about how many
   outfits ten pieces make, it states **the arithmetic** and leaves the result to
   the app, computed on screen from the user's own closet.
4. **"Nothing is a catalogue photo" may never be printed again.** The version of
   this description that is live in App Store Connect today — the pre-2026-08-10
   social-first text, still unreplaced — carries the section

   > BUILT ONLY FROM WHAT YOU OWN
   > Every suggestion — yours or a friend's — is assembled from real wardrobes.
   > Nothing is imagined, nothing is a catalogue photo, and nothing is a piece
   > you would have to go and buy first.

   The middle clause is **false against the shipping build**. `garment-search`'s
   `import` action downloads a retailer's `og:image` and makes it the garment's
   own `image_path` and `thumb_path`
   (`supabase/functions/garment-search/index.ts`, `importImage` — `:538`, the
   write at `:641`), so a piece added through Describe or a pasted link *is*
   wearing a catalogue photograph; the `attach` action puts one in front of a
   photographed piece as its display image (`attachListing` — `:892`, the write
   at `:995`). **Line numbers in that file drift** — it is under active edit —
   so the function names are the durable half of every citation here. A reviewer
   who reads that sentence and then opens Describe finds the contradiction in
   about thirty seconds. That is Guideline 2.3.1 on a claim already under review.

   **What survives is the half that is true and provable**, and it is the more
   valuable half: outfits are assembled only from garments the user owns. What a
   garment's *picture* may be is a separate question with a separate, honest
   answer — your photograph, or, if you chose it, the retailer's, for a piece you
   told Cinch you own. The two must never be collapsed back into one absolute.

#### What changed on 2026-08-10, and what paid for it

The description was at 3,997 of 4,000, so restoring the section meant finding
room. **No traced claim was dropped** — what went was explanatory tail. In full,
so nobody has to diff it:

| Was | Is | Kind |
|---|---|---|
| *(no such section — the wedge-first rewrite dropped it entirely)* | `BUILT ONLY FROM WHAT YOU OWN` / "Every outfit is assembled from garments in your own closet. Cinch never invents a piece, and never suggests one you would have to go and buy — there is no shop in it. A garment's picture is your photograph, or, if you chose it, the retailer's own shot of a piece you told Cinch you own." | **added** (+287) |
| "Garment photos go to an AI partner for identification, and Cinch asks before the first one is ever sent." | "Garment photos go to an AI partner to be identified, and — if you ask — to be matched against a product listing. Cinch asks before the first one is sent." | **corrected** — naming tagging as the only door is the sentence `src/features/privacy/copy.ts:68` bans by name |
| "…a perceptual colour space, where equal numeric steps look like equal steps to the eye." | "…a perceptual colour space." | trimmed (explanation) |
| "…decide that navy and camel work, and that charcoal beside navy reads as a mistake." | "…decide that navy and camel work." | trimmed (second example) |
| "…over this knit. The stylist writes it online; the scoring notes write it when you are not." | "…over this knit." | trimmed — the offline claim already lands in `THE MATHS RUNS ON YOUR PHONE` |
| "A client dinner at seven…" | "Dinner at seven…" | trimmed |
| "…what it has learned, so you can correct it." | "…what it has learned." | trimmed |
| "It reads the forecast at your destination…" | "It reads the forecast there…" | trimmed |
| "It answers using only your real clothes, and tells you when you don't own the right thing rather than inventing one." | "It tells you when you don't own the right thing rather than inventing one." | trimmed — the first clause is now the new section's job |
| "Nobody is ranked against anybody else — every vote is about one person's options, judged only against each other." | "Nobody is ranked against anybody else." | trimmed (the claim, without its gloss) |
| "…everyone votes and comments…" / "what you actually spend per wear" / "Removing one is a separate, deliberate act, and it says so before it deletes anything." | "…votes and comments…" / "what you spend per wear" / "Removing one is separate and deliberate, and says so before it deletes anything." | trimmed (wording only) |

#### Claim trace — every factual sentence in the description

| Claim | Proof | Verdict |
|---|---|---|
| Ten pieces is the closet Cinch is built around; the ten-piece closet is free | `supabase/migrations/20260808190000_free_closet_is_ten.sql:29` (`item_limit_for_plan('free') = 10`) | **PROVED** |
| The ten are three tops, two bottoms, a dress, two pairs of shoes, a coat and a bag | `src/features/onboarding/ten-slots.ts:70-84` (`canonicalTen()`) | **PROVED** |
| Decline the dress and that position becomes another top or bottom | `src/features/onboarding/ten-slots.ts:1-14` ("declining redirects the slot rather than dropping it"); `declineSlot` / `redirectLabel` in `ten-copy.ts:128` | **PROVED** |
| Cinch identifies what a piece is, its colours, how formal, how warm | `supabase/functions/_shared/tag-schema.ts:51-58, 90-94` (`category`, `subcategory`, colours, `formalityScore`, `warmthScore`) | **PROVED** |
| The arithmetic is tops × bottoms × shoes, plus dresses × shoes | `src/features/closet/outfit-count.ts:110` (`countOutfits`) | **PROVED** |
| It counts what your ten make and shows you the number | `src/app/reveal.tsx:13, 22-25` — `countOutfits` + `RevealCount`, computed on screen from that user's tally | **PROVED** (per-user computation, not a constant) |
| Every outfit is assembled from garments in your own closet | `src/features/styling/queries.ts:110-124` (`useWardrobe` selects `items` with `.eq('user_id', userId)` and nothing else); `src/lib/styling/generate.ts:15-17` builds only from that array; `src/features/styling/use-outfits.ts:168-172` drops any model pick whose `candidateId` is not in the on-device shortlist | **PROVED** |
| Cinch never invents a piece, and never suggests one you would have to go and buy | Same three, plus `supabase/functions/_shared/outfit-schema.ts` — the model returns a `candidateId`, never a garment. The stylist answers from the closet and says so when nothing fits (`docs/stylist-voice.md` §3 DO 2) | **PROVED** |
| There is no shop in it | No store, wishlist, product feed or checkout exists anywhere in `src/`; the only `Linking.openURL` targets are Cinch's own privacy/support/terms URLs, App Store subscription management, an invite link, a help article and a venue reservation (`src/` audited term by term, 2026-08-10) — **a retailer product page is never opened**, which is also what keeps "Unrestricted Web Access: No" true | **PROVED** |
| A garment's picture is your photograph, or — if you chose it — the retailer's own shot of a piece you told Cinch you own | The retailer image only ever arrives through a flow the user starts and confirms: `import` from a tile the user tapped (`supabase/functions/garment-search/index.ts`, `importImage` at `:538`, write at `:641`) and `attach` from a candidate the user picked (`attachListing` at `:892`, write at `:995`). Both are consent-gated server-side before anything is fetched (`:238-247`), and `detachListing` puts the user's own photograph back — surfaced as "Remove listing photo" at `src/app/item/[id].tsx:940-956` | **PROVED** |
| Outfits are assembled and scored on the iPhone, in milliseconds | `src/lib/styling/generate.ts:15-17`; `src/features/styling/use-outfits.ts:64-70` | **PROVED** |
| Colour is judged in OKLCH, a perceptual colour space | `src/lib/color/oklch.ts:1-22`; `src/lib/color/harmony.ts:28, 62-63` (`hueDistance`, `deltaE` over OKLCH) | **PROVED** |
| Hue distance, chroma and lightness contrast decide the pairing | `src/lib/color/harmony.ts:57-172` (`pairHarmony`), `:174` (`analyzePalette`) | **PROVED** |
| Colour carries more weight than any other rule | `src/lib/styling/score.ts:55-65` — `palette: 1.4` is the largest default weight | **PROVED** |
| A language model never sees your closet — only a shortlist of a dozen outfits | `src/features/styling/use-outfits.ts:17` (`SHORTLIST = 12`), `:118-144` (only slot/name/colour/formality for the twelve candidates leaves the device) | **PROVED** |
| The model re-ranks on taste and writes the sentence underneath | `src/features/styling/use-outfits.ts:70-72, 168-185`; `supabase/functions/generate-outfits/index.ts:24` | **PROVED** |
| Every outfit comes with its reason | `src/lib/styling/generate.ts:286-300` — `explain()` always returns a non-empty string; `use-outfits.ts:50`, `src/app/(tabs)/index.tsx:59`, `src/components/plan/day-row.tsx:73`; the model path requires `reasoning` (`supabase/functions/_shared/outfit-schema.ts:29`) and falls back to the engine's sentence when it returns nothing (`use-outfits.ts:183-185`) | **PROVED, narrowed** — see below |
| Apparent temperature, not the forecast high | `src/features/context/weather.ts:46, 70` (`apparent_temperature`) | **PROVED** |
| A light jacket is not enough at four degrees in a strong wind | `src/lib/styling/generate.ts:88` (`targetWarmth(feelsLikeC, windKph)`); `src/lib/styling/features.ts` `weatherRule` | **PROVED** |
| It will not put suede shoes on you in the rain | `src/lib/styling/garment.ts:100` (`RAIN_HOSTILE` includes suede); `src/lib/styling/features.ts:159` | **PROVED** |
| Dinner at seven and drinks at ten are handled as one outfit | `src/lib/styling/features.ts:381-393` (`multiEventRule`); `src/lib/styling/score.ts:195-199` gates rather than averages | **PROVED** |
| Connect your calendar and it reads the day | `src/features/context/use-style-context.ts:2, 61` (`Calendar.getEventsAsync`) | **PROVED** |
| It learns from a like, a skip, or a stated reason | `src/lib/styling/score.ts:225-302` (`updateWeights`, `updateAffinities`) | **PROVED** |
| It shows you in plain English what it has learned | `src/lib/styling/score.ts:323-344` (`describeWeights`) | **PROVED** |
| Packing works out the smallest set that still dresses every day differently | `src/features/plan/packing.ts:56-72` (`buildPackingList`) | **PROVED** |
| …and says so plainly when a day cannot be filled | `src/features/plan/packing.ts:44-52` (`unfilled`) | **PROVED** |
| The stylist answers from real clothes and says when you do not own the right thing | `docs/stylist-voice.md` §3 DO 2 and §7 exchange 2; `supabase/functions/_shared/chat-schema.ts` | **PROVED** |
| Events: invite, post options, vote, comment | `src/app/event/[id]/outfits.tsx`; `src/features/event-outfits/**` | **PROVED** |
| Nobody is ranked against anybody else | `docs/stylist-voice.md` §9 rule 1; `docs/social/product-spec.md` §5 | **PROVED** |
| Browse a friend's closet and ask to borrow one tap either way | `supabase/migrations/20260807100000_social_graph_blocks_borrow.sql:158`; `src/components/social/borrow-lend-sheet.tsx` | **PROVED** |
| Cinch records every wear; most-worn, untouched, cost per wear | `src/features/diary/entry.ts:18` (`costPerWear`); `src/features/boards/board-lines.ts:82-89`; `src/features/stylist/intent.ts:161-178` | **PROVED** |
| Storage is reversible and keeps the photograph and the wear history | `src/features/closet/storage.ts:12-51`, `:53-71`; `src/app/storage.tsx:16-22` | **PROVED** |
| Removing a piece is separate and deliberate, and says so first | `src/features/closet/mutations.ts:267-311`; `src/app/storage.tsx:67-78, 240` ("Delete permanently") | **PROVED** |
| iOS hands Cinch only the pictures you tap | `app.config.ts:13` (`NSPhotoLibraryUsageDescription` deliberately suppressed); `src/features/ingest/use-capture.ts:20, 124` | **PROVED** |
| Garment photos go to an AI partner, and Cinch asks before the first one is sent | `src/features/auth/consent-facts.ts:36-39`; `supabase/functions/generate-outfits/index.ts:118` | **PROVED** |
| There is no advertising and no tracking across other apps | No ad SDK in `package.json` (dependency list audited term by term — no AdMob, AppLovin, Unity Ads, IronSource, Audience Network, AppsFlyer, Adjust, Branch); `app.config.ts:174-180` — `NSPrivacyTracking: false`, `NSPrivacyTrackingDomains: []` | **PROVED** |
| You can delete your account and everything in it from inside the app | `src/app/profile.tsx:132, 547`; `supabase/functions/delete-account` | **PROVED** |

#### The four claims the contract flagged as unverified

| Claim, as the letter wrote it | Verdict | What shipped instead |
|---|---|---|
| "OKLCH perceptual colour maths, **not an LLM guessing**" | **Half true as written. Rewritten.** | The shortlist genuinely is deterministic and on-device — beam search plus a linear model, colour scored in OKLCH (`generate.ts:15-17`, `harmony.ts:62-63`, `score.ts:55-65`). But a model *is* in the loop: it re-ranks the twelve and writes the prose (`use-outfits.ts:70-72`). "Not an LLM guessing" implies the whole thing is deterministic, which is false. The description says the precise thing instead: the maths builds and scores the outfits on the phone, the model never sees the closet, and its job is to re-rank a shortlist of twelve and write the sentence. That is both more accurate **and** the better claim, because it explains *why* the suggestions are grounded. |
| "**Every** suggestion decomposes into a stated reason" | **"Every" survives. "Decomposes" does not.** | There is no code path that renders a suggested outfit without a reasoning string — `explain()` always returns one, and the model path is schema-required and falls back to `explain()` if it returns nothing. So "every outfit comes with its reason" is true. But `generate.ts:295` is a generic fallback (`'A solid, wearable combination from your closet.'`) for the case where no rule produced a note, and that sentence does not decompose into anything. The description claims presence, not decomposition. |
| "No ads, **ever**" | **Cut the "ever".** | The present tense is provable — no ad SDK, `NSPrivacyTracking: false`, `NSPrivacyTrackingDomains: []`. "Ever" is a promise about the future, which no `file:line` can prove. Shipped as "There is no advertising and no tracking across other apps." |
| "**Nothing is ever lost**" | **Cut. The absolute is false.** | Removing a piece is a **hard delete that destroys its photographs** — `src/features/closet/mutations.ts:267-311` argues at length for exactly that, and `src/app/storage.tsx:78` labels the control "Delete permanently". Account deletion is irreversible too, and `src/app/profile.tsx:212` carries the standing instruction "Never promise a rollback." What *is* provable is the reversible half, and that is what shipped: Storage keeps the photograph and the wear history and you can bring the piece back; removing is a separate, deliberate act that says so before it deletes. |

### The string

```
Ten pieces. That is all Cinch needs before it can dress you.

Photograph ten things you already own — three tops, two bottoms, a dress, two pairs of shoes, a coat and a bag. Don't wear dresses? Say so, and that position becomes another top or bottom. Cinch identifies each piece: what it is, its colours, how formal it is, how warm it is.

Then it does the arithmetic: tops times bottoms times shoes, plus dresses times shoes. It counts what your ten actually make, shows you the number, and dresses you in the first one.

You don't have to photograph your whole wardrobe first. Ten pieces is a wardrobe, and the ten-piece closet is free.

BUILT ONLY FROM WHAT YOU OWN
Every outfit is assembled from garments in your own closet. Cinch never invents a piece, and never suggests one you would have to go and buy — there is no shop in it. A garment's picture is your photograph, or, if you chose it, the retailer's own shot of a piece you told Cinch you own.

THE MATHS RUNS ON YOUR PHONE
Outfits are assembled and scored on your iPhone, in milliseconds, from your real garments — which is why Cinch still dresses you on a plane, or with no bars at all. Colour is judged in OKLCH, a perceptual colour space. Hue distance, chroma and lightness contrast are what decide that navy and camel work. Colour carries more weight than any other rule.

A language model never sees your closet. It sees a shortlist of a dozen outfits the maths already built, re-ranks them on your taste, and writes the sentence underneath.

EVERY OUTFIT COMES WITH ITS REASON
Not a score, not a percentage — a sentence. Why this coat, on this day, over this knit.

DRESSED FOR THE ACTUAL WEATHER
Cinch uses the apparent temperature where you are, not the forecast high. It knows a light jacket is not enough at four degrees in a strong wind, and it will not put suede shoes on you in the rain.

IT UNDERSTANDS A WHOLE DAY
Dinner at seven and drinks at ten are not the same dress code. Type "dinner then drinks after" and Cinch finds the one outfit that carries both — or connect your calendar and it reads the day for you.

IT LEARNS YOU
Like an outfit, skip it, or say why it is wrong — too formal, not your colours, worn too recently. Cinch adjusts from the first reaction, and shows you in plain English what it has learned.

PACK WITHOUT OVERPACKING
Tell Cinch where you are going and for how long. It reads the forecast there and works out the smallest set of clothes that still gives you a different outfit every day — and says so plainly when a day can't be filled.

ASK THE STYLIST ANYTHING
"Dinner at 7, drinks after?" "What am I missing?" It tells you when you don't own the right thing rather than inventing one.

STILL TORN? ASK YOUR FRIENDS
Post the dinner, the wedding, the trip. Invite the people going. Everyone shares a couple of options from their own closet, votes and comments, and each person walks in wearing the look their friends helped them choose. Nobody is ranked against anybody else.

BORROW FROM EACH OTHER
Browse a friend's closet, find the black clutch they never wear, and ask to borrow it. They lend it or say not this time — one tap either way, private between the two of you.

SEE YOUR OWN STORY
Cinch records every wear: your most-worn pieces, the ones sitting untouched, and what you spend per wear.

NOTHING VANISHES BY ACCIDENT
Taking a piece out of rotation is reversible: Storage keeps the photograph and every wear you logged, and you can bring it back. Removing one is separate and deliberate, and says so before it deletes anything.

PRIVATE BY DEFAULT
Cinch never reads your photo library — iOS hands it only the pictures you tap. Garment photos go to an AI partner to be identified, and — if you ask — to be matched against a product listing. Cinch asks before the first one is sent. Your closet stays private until you share it with a friend. There is no advertising and no tracking across other apps. You can delete your account, and everything in it, from inside the app.
```

## What's New (version 1.0)

```
First release.
```

---

## URLs

| Field | Value |
|---|---|
| Privacy Policy URL | `https://www.cinchstyle.com/privacy` |
| Support URL | `https://www.cinchstyle.com/support` |
| Marketing URL | `https://www.cinchstyle.com` |

The site is live on its own domain now, so these no longer point at the
Vercel preview host. All three are reachable without a login — the
deployment-protection issue that returned 302 to everything, including to
Apple's reviewers, was on the old `*.vercel.app` URL and does not apply here.

---

## Age rating

**Live state as configured in App Store Connect (verified 2026-08-06):**
calculated rating **4+**, with regional exceptions (Brazil A6, Korea ALL,
Vietnam 00+). The questionnaire is a seven-step wizard; steps 2–6 (mature
themes, medical, sexuality, violence, chance-based) are all **None/No**, which
is correct for Cinch.

Step 1 (Features) is the one that matters now that social has shipped:

| Question | Answer | Why |
|---|---|---|
| Parental Controls | No | none in the app |
| Age Assurance | No | **no age gate is implemented** — see the compliance section below |
| Unrestricted Web Access | No | Cinch opens only its own fixed privacy/support URLs via `Linking.openURL`; no in-app browser |
| **User-Generated Content** | **Yes** | correct — comments, event titles, look captions, profile fields |
| Social Media | No | defensible: there is no feed, no discovery, no public amplification. Events are invite-only and content never spreads beyond a member list — this matches the permanent non-goals in `docs/social/product-spec.md` §7.1 |
| Social Media Disabled for Users Under 13 | No | consistent with Social Media = No |
| **Messaging and Chat** | **No** | *judgment call, decided 2026-08-06 to leave as No.* Cinch has no DM inbox or chat surface; free text is confined to comments inside an invite-only event and a one-line note on a borrow request. The conservative reading would be Yes (a borrow message is one-to-one free text). Revisit if a reviewer challenges it. |
| Advertising | No | no ads |

Do **not** answer "None to every content question" — that older instruction
predates the social features and would now be a false declaration.

---

## App privacy (must match `app.config.ts` exactly)

Apple cross-checks these answers against the compiled `PrivacyInfo.xcprivacy`.
A mismatch is a review hold, so the two must be filled in from the same list.

**Live state (published in App Store Connect, verified 2026-08-06):** eight data
types declared.

| Data type | Collected | Linked to user | Used for tracking | Purpose |
|---|---|---|---|---|
| Photos or Videos | Yes | Yes | No | App Functionality, Product Personalization |
| Other User Content | Yes | Yes | No | App Functionality, Product Personalization |
| Coarse Location | Yes | **No** | No | App Functionality |
| Email Address | Yes | Yes | No | App Functionality |
| Name | Yes | Yes | No | App Functionality |
| User ID | Yes | Yes | No | App Functionality, Analytics |
| Purchase History | Yes | Yes | No | App Functionality |
| Product Interaction | Yes | Yes | No | Analytics |

"Other User Content" covers the free-text plans and calendar event titles that
go to the model — and now also the social UGC: outfit-post captions, comments,
event titles and dress-code notes, borrow-request messages, and profile
bio/display name. It is the easiest one to forget, because it is not a field
users think of as content.

Answer **No** to "Do you or your third-party partners use data for tracking?"

---

## Export compliance

The app uses only HTTPS. Answer:

- Uses encryption: **Yes**
- Qualifies for exemption: **Yes** — standard encryption only, via the operating system
- Result: no CCATS filing, no annual self-classification report

Set `ITSAppUsesNonExemptEncryption: false` in `app.config.ts` to stop App Store
Connect asking on every single upload.

---

## Notes for App Review

*Last pasted into App Store Connect 2026-08-06, at 3,082 chars. **The block
below has been rewritten since (now 3,997 of 4,000) and is NOT what ASC
currently holds** — it must be re-pasted before submission. See the checklist.*

**Six changes, all already in the block below.** The first two are from the
2026-08-10 wave; the third is a stale fact that was under-claiming a safety
control to a reviewer — `WHERE THE SAFETY CONTROLS ARE` listed reporting on
comments and profiles only, and shared looks now carry it too
(`src/components/event-outfits/OutfitPostCard.tsx:268-375`). The last three are
the listing-photo disclosure, described after them.

- **`SEEDING A CLOSET` was rewritten for D1.** The old paragraph told the
  reviewer a new account starts on an empty Today tab and that they should add
  10–12 photos by hand. That is no longer the first run: decision D1
  (`docs/design/positioning-contract.md` §5) makes The Ten the default, and
  `src/app/tour.tsx:96` → `exitDestination()`
  (`src/features/onboarding/tour-state.ts:120-124`) now routes the camera exit to
  `/the-ten` for any closet under the free cap, ending on The Reveal. A note
  describing a flow the reviewer will not see is the worst kind to leave in: it
  makes an accurate build look broken. The replacement is 283 characters
  including its header.
- **`SUBSCRIPTIONS` moved above `TESTING THE SOCIAL FEATURES` for D2.** A
  dismissible paywall now presents immediately after The Reveal
  (`src/app/reveal.tsx:130`, placement `reveal_complete`). A reviewer meets it
  roughly thirty seconds into a fresh install, so the paragraph explaining the
  14-day app-side grant — the thing that makes it an offer rather than a wall —
  has to be the one they read first.
- **`LISTING PHOTOS` is new, and it is the important one.** The app pulls
  product imagery off the open web and can make it a garment's picture
  (`supabase/functions/garment-search/`). A reviewer opening Describe meets six
  retailer photographs about a minute into a fresh install, and a note that does
  not mention it turns a legitimate feature into something that looks concealed.
  The paragraph says what the three doors are, that each is opened by a tap,
  that the image is chosen by the user, and that nothing is for sale — which is
  also the answer to "why is this not in the Shopping category".
- **`AI PROCESSING` now names the second door and the search engine.** It said
  photographs go to OpenRouter for identification, full stop. They also go to a
  vision model with a web-search plugin that OpenRouter runs through **Exa**
  (`supabase/functions/garment-search/provider.ts`, the `plugins` block).
  Declaring one processor when the binary uses two is the kind of mismatch App
  Privacy is cross-checked for.
- **`SIGNING IN` said "sends a sign-in link"**, which stopped being true when
  the app moved to a six-digit code (`src/features/auth/actions.ts:136`, `:195`;
  `src/app/(auth)/code.tsx`). A reviewer waiting for a link that never arrives
  is a rejection over nothing.

```
SIGNING IN
Sign in with Apple, or with any email address. Please use any Apple ID — no invite code is required. The email option sends a six-digit code, typed on the next screen.

SEEDING A CLOSET
Cinch styles you from clothes you own, so a new account is walked through photographing ten pieces. Any ten clothing photos from the device library will do. Tagging takes a few seconds each, and the screen after it shows the first complete outfit with its reasoning.

LISTING PHOTOS — YOU WILL MEET THIS
Cinch can put a retailer's own product photograph on a garment. Three doors, all opened by the user: "Describe" (they type what they own; Cinch searches and offers up to six product images); pasting a product link (Cinch reads that page's image and shows it for confirmation); and "Find the listing photo" on a piece already photographed — that photo goes to a vision model with a web search, the retailer is then named on the item screen, and "Remove listing photo" restores the user's own photograph, which is never altered or deleted. Nothing is fetched without a tap; nothing is saved without the user choosing an image. Cinch sells nothing, has no affiliate links and never opens a retailer's site. Every call here is refused server-side until AI consent is given.

SUBSCRIPTIONS
The app grants 14 days of full access on first launch. This is an app-side grant, NOT a StoreKit introductory offer, so no purchase is required to evaluate the app and no trial is started in the sandbox. A membership page is offered once, right after the closet-setup screen described above; it can be dismissed and the app is fully usable without it. All social features (friends, events, voting, comments, borrowing) are free on every tier.

TESTING THE SOCIAL FEATURES — PLEASE READ
The friends, events, voting and borrowing features require TWO accounts, because they are built around inviting someone you know. A single reviewer account cannot exercise them.

We are happy to provide two pre-populated, already-connected demo accounts so you can test this immediately — please contact nelsonsaenz1@yahoo.com and we will supply credentials within a few hours.

To test with your own two accounts instead:
1. Sign in on two devices/simulators with two Apple IDs. Add a few garments to each closet.
2. Account A: Plan tab -> "Events" segment -> "+ New event" to create an event.
3. Account A: open the event -> "Invite" -> share the invite link to Account B.
4. Account B: open the link, join the event. Both now see the event on the Plan tab.
5. Either account: from the event, share an outfit to the group, then vote on and comment on the other person's look.
6. Friends and borrowing: Today tab -> avatar (top right) -> Profile -> "Friends & borrowing". Open a friend, browse their closet, and tap a borrowable item to request it. The owner responds from Profile -> Borrow requests.

WHERE THE SAFETY CONTROLS ARE
Blocking: any friend or profile row -> "..." menu -> Block. Blocked users are managed at Profile -> Friends & borrowing -> Blocked.
Reporting: the "..." menu on any shared look, on any comment and on any user profile, with categorized reasons.

PERMISSIONS
Location and Calendar are optional and the app is fully functional without either. Declining location falls back to a default city, which the app states on screen. Camera is used only to photograph garments.

AI PROCESSING
Garment photos go to OpenRouter to be identified and, when the user asks for a listing photo, to a vision model with a web-search plugin that OpenRouter runs through Exa. The user is asked to consent in-app before the first image is ever sent (Guideline 5.1.2(i)), and the consent sheet names the processor and the data categories. Both doors are disclosed in our privacy policy and on the in-app Privacy page. Outfit generation itself runs on-device.

ACCOUNT DELETION
Profile tab, bottom of the screen, "Delete account". Deletion is immediate and removes all uploaded photos and data, including social content.
```

---

## App icon

**There is no app-icon upload field in App Store Connect, and looking for one
is a dead end.** Verified 2026-08-06: the version page has exactly three file
inputs (Previews and Screenshots, Routing App Coverage File, Review
Attachment), and the App Information page has none. Apple retired the separate
1024×1024 upload years ago — the marketing icon is read out of the build's
asset catalog and appears on the product page once a build is processed.

So the icon is an `app.config.ts` concern, and it is already correct:

| | Path | Size | Mode | Verdict |
|---|---|---|---|---|
| **Ships** | `assets/images/icon.png` (referenced by `app.config.ts:72`) | 1024×1024 | RGB, no alpha | correct |
| Working file | `Cinch App Icon.png` (repo root) | 512×512 | RGBA, alpha 0–255 | **do not use** |

There is no `ios.icon` override, so the top-level `icon` is what gets compiled.

The root file is the same artwork and is a trap worth naming, because its
filename reads more official than the real one. It fails three ways at once:
half the required resolution, a real alpha channel (Apple rejects any
transparency in an app icon), and **rounded corners baked into the artwork**.
That last one is the subtle one — iOS applies the superellipse mask itself, so
a pre-rounded icon renders with the corners clipped twice and a translucent
fringe. Never point `app.config.ts` at it; regenerate from source at 1024×1024,
square, full-bleed, no alpha.

---

## Screenshots

### Currently live (v1) — social-first, now superseded

**Uploaded and verified 2026-08-06 — five frames, in order.** Built per
`docs/app-store/screenshots/` (sources in `src/`, one HTML per frame).

| # | File | Screen | Headline |
|---|---|---|---|
| 1 | `01-today.png` | Today — the daily outfit plate | "Dressed in a *minute.*" |
| 2 | `02-event.png` | Event detail — Dana's birthday dinner | "The group chat, *answered.*" |
| 3 | `03-closet.png` | Closet — profile, stats, most-worn | "You own 54 pieces. *Nine, never worn.*" |
| 4 | `04-stylist.png` | Stylist — recommendation + honesty moment | "A stylist that *never* sells you anything." |
| 5 | `05-plan.png` | Plan — the week against the forecast | "The week, *already decided.*" |

These five lead with the daily habit and put social in slot 2. They are still
what is in App Store Connect and they are still uploaded correctly, so **nothing
breaks by leaving them there** until the replacements are rendered.

### The wedge-first set (v3) — headlines and rationale

**These are headlines and reasoning only. The renderings are a design job for
the founder,** against the geometry, palette and type rules already specified in
`docs/app-store/screenshot-directive-v2.md` §3 — which are unchanged and remain
correct.

| # | Screen | Headline | Subline | Job |
|---|---|---|---|---|
| 1 | The Ten — the ten-slot grid, six filled, camera on the seventh | "Ten pieces is a *wardrobe.*" | Photograph ten things you already own. That is the whole setup. | Kill the objection that kills installs, in slot 1. |
| 2 | Today — the daily outfit plate | "Dressed in a *minute.*" | Built on your phone from what you own, for today's weather and today's plans. | The daily payoff, and the reason to keep it. |
| 3 | Today — the reason line under the plate, enlarged | "Every outfit, *explained.*" | Not a score. A sentence: why this coat, on this day, over this knit. | Strike at the category's most consistent one-star complaint. |
| 4 | Stylist — the honesty moment | "It tells you *no.*" | Nothing you own works for black tie? It says exactly that, instead of inventing a gown you don't have. | Trust. Nobody else in the category will run this frame. |
| 5 | Event detail — two looks, votes landing | "Still torn? *Ask the group.*" | Post the dinner, invite the people going, and settle it between two looks you already own. | The differentiator, in full, where the 11% who scroll will meet it. |

**Optional sixth**, if a slot is going spare: Closet — "54 pieces. *Nine, never
worn.*" / "Cinch counts every wear — cost-per-wear, the favourites, the ones you
keep skipping." This is the retention argument and it is the frame that hurts
least to lose.

**Why this order.** 91% of App Store visitors never scroll portrait screenshots
and search results render only three frames, so 1–3 must each stand alone
(`screenshot-directive-v2.md` §1.1). Frames 1–3 here are, in order: *you only
need ten pieces*, *and then you are dressed*, *and it tells you why*. That is
the entire positioning, complete, before anyone taps anything. Frames 4 and 5
are the reward for scrolling — and putting social at 5 rather than 1 is a change
of **position, not of claim**: it keeps two description sections, a screenshot,
and a whole custom product page.

**Constraints these headlines already satisfy:** ≤ 5 words, ≤ 2 lines, and short
enough to set at the mandatory 140px minimum in the 1080px measure (~15
characters per line). No frame prints an outfit count — `docs/design/positioning-contract.md`
§3 forbids it in every static surface, and frame 1 deliberately says "a wardrobe"
where the temptation is to say a number.

### `screenshot-directive-v2.md` has been re-pointed (2026-08-10)

It exists and it is still unbuilt, but it is no longer aimed at the wrong frame
1. All three corrections have been applied to it:

- **§2's frame table** — frame 1 is now The Ten, not "The table", and §2.2
  carries a new frame-1 spec written against `src/app/the-ten.tsx`. §2.1 maps
  every old §4 frame spec onto its new slot. Its own §1.4 ("the upload objection
  is the category's open wound") is the argument for the change and was already
  written there; it was just landing on the wrong slot. Frame 2, "The upload",
  is cut from the gallery — its `12 of 47` counter is also no longer honest
  about a ten-piece free tier.
- **§1.2's first reason** for keeping "AI" out of headlines — "the app name
  already carries the signal" — has been retired, with the dead premise named
  in place so it cannot be reinstated. The recommendation stands on the research
  and on two reasons that do not depend on the title.
- **§2's dropped frame** — the Plan/week frame stays out of the gallery but is
  now flagged as a required render for the custom product page
  (`docs/aso/custom-product-pages.md`).

Everything else in that document — canvas, palette, type, the 140px headline
minimum, the squint test, "real UI only", no faces, no invented social proof —
is unchanged and binding.

### Two things that are easy to get wrong here

**The version page is the wrong place to upload these.** It exposes only an
iPhone **6.5"** slot, which accepts 1242 × 2688 / 1284 × 2778 — and *not*
1290 × 2796. Uploading there fails. The correct target is the **6.9" Display**
slot, reachable via *View All Sizes in Media Manager*; it accepts
1260 × 2736, 1320 × 2868 **or 1290 × 2796**, and explicitly covers
"iPhone 6.5", 6.7" or 6.9" Displays". Once populated, the 6.5" slot on the
version page flips to "Using 6.9" Display" and inherits the same five frames.
One set is genuinely all that is needed.

**Uploading all five in one action scrambles the order.** A single multi-file
upload landed them 02, 03, 01, 04, 05 — and since only the first three appear on
the App Store install sheets, that quietly buries the Today frame. Upload them
**one at a time, in sequence**, waiting for each to finish processing. Verified
correct after a fresh reload.

**No iPad set, deliberately.** `supportsTablet: false` in `app.config.ts`, so
App Store Connect shows the iPad tab but never requires it. Leave it empty; do
not generate one.

Do not crop, resize, letterbox or re-encode these files — they are already
exactly 1290 × 2796. If a future slot demands another resolution, re-render from
`docs/app-store/screenshots/src/` rather than stretching the PNGs.

Licensing: every garment photograph traces to `assets/garments/MANIFEST.md`, all
commercial-use with no attribution requirement. Frame 5 uses no photographs.

---

## Guideline 1.2 — user-generated content (audited 2026-08-06)

Apple applies this the moment the listing advertises social features, which it
now does. Audited against the shipping code; `docs/social/product-spec.md` §7.4
called every one of these MVP-blocking.

| Requirement | State | Evidence |
|---|---|---|
| Filter objectionable content | **Closed** — migration `20260808100000` | `moderation_terms` denylist (service-role only), leet/repeat/spacing normalisation, word-boundary matching, `BEFORE INSERT OR UPDATE` triggers on comment bodies, post captions, event title/note/dress code, borrow messages, and profile name/username/bio. Covered by `supabase/tests/08_ugc_moderation.sql` |
| EULA / terms gate before posting | **Closed** — migration `20260808101000` | `profiles.social_terms_version` + `social_terms_at`, `has_accepted_social_terms()`, `BEFORE INSERT` triggers on every content-creating and space-joining table. Client: `use-social-terms.ts` + `SocialTermsSheet`. Blocking and reporting are deliberately **not** gated |
| Report mechanism | **Closed for the headline UGC** | Backend is solid — `content_reports` with RLS, rate limiting, auto-hide at 3 reporters. The UI exposed it only on comments and profiles when this was audited; **outfit posts now carry it too** (`src/components/event-outfits/OutfitPostCard.tsx:268-375`, share/report/block/retire overflow). Items and event titles still have no affordance, though `report_subject` enumerates them |
| Block abusive users | **Closed** | `user_blocks`, `on_block_sever_graph()`, `BlockedList.tsx`, reachable from Profile. The leak recorded here — `blocked_between` absent from the event-content select policies — was fixed by migration `20260807120000_event_content_block_filter`, which adds it to all five event-content read paths including the two SECURITY DEFINER views, and by `20260809160000_block_retracts_votes` |
| Published contact info | Partial | Support URL is live and in the listing; no dedicated abuse-report address |
| Age gate | **Missing** | No birthdate column, no check. Spec §7.4.7 wanted 16+ for social |
| Deletion cascade | Implemented | `delete-account` relies on `on delete cascade` from `auth.users`; every social table carries the FK |

Two caveats worth knowing: `comments.tsx` already tells users *"Reports are
reviewed within 24 hours"* while nothing notifies anyone that a report was
filed; and `events.host_id ... on delete cascade` means a host deleting their
account destroys the whole event including other attendees' looks.

### Before the filter and gate are actually live

**Both migrations are pushed and the types are regenerated** (verified against
the live migration list, 2026-08-10), so only the denylist step below is still
outstanding. The sequence is kept for reference and for any fresh environment:

```bash
supabase db push          # applies both migrations
npm run gen:types         # REQUIRED — until this runs, use-social-terms.ts
                          # does not typecheck: database.ts has no
                          # social_terms_version column
supabase test db          # 08_ugc_moderation.sql, 25 assertions
```

Then load a real denylist as service_role. **This has not been done** —
`moderation_terms` still holds exactly the seven rows the migration seeds
(counted 2026-08-10). It deliberately ships **no slurs**: a slur list hand-typed
into a migration is both incomplete and unpleasant to maintain. Use a maintained
source (LDNOOBW or a commercial feed); the insert statement is in the migration's
closing comment.

**Remaining 1.2 exposure:** the real denylist, and the **age gate** — no
birthdate column and no check exist. The other two items recorded here are now
closed (see the table above). Neither remaining one is large; both are visible to
a reviewer who goes looking.

---

## Submission checklist

Metadata — done:

- [x] Privacy policy URL, live and public
- [x] Support URL, live and public
- [ ] **Title, subtitle, keywords, promotional text, description** — all five
      rewritten wedge-first on 2026-08-10 and **not yet pasted into App Store
      Connect**. ASC still holds the social-first strings. Free to change: the
      app is unreleased, so version-scoped metadata carries no cost
- [ ] Pull real popularity scores for every keyword from a free Apple Search Ads
      account before pasting the keyword field
- [x] Copyright
- [x] App Review contact name / phone / email
- [ ] **App Review notes** — rewritten 2026-08-10 for D1 and D2 (new
      `SEEDING A CLOSET`, `SUBSCRIPTIONS` moved up), then again the same day for
      the listing-photo disclosure (new `LISTING PHOTOS`, `AI PROCESSING` names
      Exa, `SIGNING IN` says code not link) and **not yet re-pasted**. ASC still
      holds the 2026-08-06 text, which describes a first run that no longer
      exists
- [ ] **Retire the catalogue-photo absolute in ASC.** The live description still
      says "nothing is a catalogue photo" and the shipping build makes that
      false — see rule 4 above. **Pasting the new description is what fixes it**,
      and until it is pasted this is the single largest 2.3.1 exposure on the
      page. Nothing in this repository pushes to ASC
- [ ] **Record the source on imported garments.** A piece added through Describe
      or a pasted link keeps the retailer's photograph as its own `image_path`
      but stores **no** `listing_source_url` / `listing_source_label`
      (`supabase/functions/garment-search/index.ts`, `importImage` — the insert
      names only `user_id`, `status` and `description`, and the client's `source`
      field is accepted and dropped). The item screen therefore prints its
      "Listing photo · &lt;retailer&gt;" colophon (`src/app/item/[id].tsx:873-875`)
      for pieces matched from the user's own photograph and prints nothing at all
      for imported ones. An imported garment is the case where the credit matters
      most, so this is a real gap — it is a `garment-search` change, not a copy
      one, and no wording can stand in for it
- [x] Age rating questionnaire (UGC declared Yes → 4+)
- [x] App Privacy, published, 8 data types
- [x] Pricing and availability (free, 175 regions, tax category set)
- [x] Four subscriptions created, priced, and localized in the Cinch Membership group
- [x] In-app account deletion (Guideline 5.1.1(v))
- [x] AI processing consent (Guideline 5.1.2(i))
- [x] Hand-written purpose strings for camera, location, calendar
- [x] Privacy manifest with real collected-data types
- [x] `eas.json` build profiles
- [x] `ITSAppUsesNonExemptEncryption: false`

Hard blockers — outstanding:

- [ ] **A build** — nothing uploaded; the version page still shows "Add Build"
- [x] **Screenshots** — five v1 frames uploaded to the 6.9" slot, verified in
      order. Not a blocker; the wedge-first v3 set replaces them when rendered
- [x] Re-point `docs/app-store/screenshot-directive-v2.md` — all three
      corrections applied 2026-08-10
- [ ] **Render the v3 screenshot set** against the re-pointed directive, plus the
      Plan/week frame for the custom product page
- [ ] `docs/aso/in-app-events.md` — three events drafted, none created in ASC,
      and each needs a real in-app surface before submission
- [ ] `docs/aso/custom-product-pages.md` — three pages drafted, none created in
      ASC (they need the v3 screenshots first)
- [x] **Guideline 1.2** — content filter (migration `20260808100000`)
- [x] **Guideline 1.2** — EULA gate (migration `20260808101000`)
- [x] Push both migrations — `ugc_text_filter` and `social_terms_gate` are both
      applied on the live project (verified against the migration list
      2026-08-10), and `src/types/database.ts` is regenerated
- [ ] **Load a real denylist** — still the seeded starter set. `moderation_terms`
      holds **7 rows**, which is the seven profanities the migration ships.
      Verified by query 2026-08-10
- [x] Wire `SocialTermsSheet` into the social entry points — `useSocialTermsGate`
      is called from `explore.tsx`, `friends/index.tsx`, `friends/[userId].tsx`,
      `event/new.tsx`, `event/[id]/outfits.tsx`, `event/[id]/post.tsx`,
      `event/[id]/invite.tsx`, `activity.tsx` and `use-comment-thread.tsx`
- [ ] **Guideline 1.2** — **age gate only.** The other two are closed: outfit
      posts carry the report affordance (`OutfitPostCard.tsx:268-375`), and the
      event block leak was fixed by migration
      `20260807120000_event_content_block_filter` plus
      `20260809160000_block_retracts_votes`. No birthdate column and no age
      check exists anywhere in `supabase/migrations/` or `src/`
- [ ] **EU Digital Services Act trader status** — still "Set Up" on the App
      Information page. Without it the app can be removed from sale in the EU
- [ ] Review screenshot on each of the four subscriptions
- [ ] Apple Developer Program enrollment ($99/yr)
- [x] Apple Team ID → `eas.json` — `THR27ADF4P`, `eas.json:54`
- [x] `ascAppId` → `eas.json` — `6798479578`, `eas.json:53`
- [x] App icon — `assets/images/icon.png`, 1024×1024, no alpha; rides in the
      build, there is nothing to upload to App Store Connect
- [ ] A real device test pass
