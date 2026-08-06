# App Store Connect — listing copy and submission answers

Everything App Store Connect asks for, drafted and within Apple's character
limits. Paste as-is; the limits are noted so edits stay legal.

---

## Identity

| Field | Value | Limit |
|---|---|---|
| App Name | `Cinch: AI Closet & Stylist` | 30 (uses 26) |
| Subtitle | `Outfits, chosen with friends` | 30 (uses 28) |
| Bundle ID | `com.nelsonsaenz.cinch` | — |
| SKU | `cinch-ios-001` | — |
| Primary category | Lifestyle | — |
| Secondary category | Utilities | — |
| Price | Free | — |

**Why neither category is Shopping:** the app does not sell anything, and there
is no shopping surface in it at all — no store, no wishlist, no product feed.
Listing a non-commerce app under Shopping invites a reviewer to look for a store
that is not there. Revisit only if a shopping integration actually ships.

---

## Keywords

```
wardrobe,outfit,friends,social,borrow,vote,closet,fashion,ootd,clothes,weather,daily,share,group
```

96 of 100 characters. Deliberately excludes "stylist" and "AI" — those already
appear in the app name, which Apple indexes separately, so repeating them
wastes the budget. Traded out "capsule", "packing", "organizer", "mix", "match"
and "digital" from the solo-app draft to make room for the social terms that
now carry the positioning: friends, social, borrow, vote, share, group.

---

## Promotional text

*170 characters. Editable any time without a new build — use it for seasonal
messaging.*

```
Photograph what you own. Cinch builds your outfit — then your friends help you pick it, vote on looks, and lend you what's missing from theirs.
```

---

## Description

*4,000 character limit. This draft is 3,519 characters — the exact string currently
live in App Store Connect.*

**Accuracy rule for this section.** Every claim below was checked against the
shipping code on 2026-08-06. An earlier draft promised that a borrowed garment
"shows up in your own outfit builder until you give it back" — that is **not
implemented**: `src/features/styling/queries.ts` selects `items` filtered by
`.eq('user_id', userId)`, and nothing joins an approved `borrow_requests` row
into the borrower's wardrobe or composer. The clause was removed. Do not
re-add it until that path actually exists; metadata describing functionality
the binary does not have is a Guideline 2.3.1 rejection.

```
Cinch turns the clothes you and your friends already own into outfits worth wearing — and worth showing up in together.

Photograph each piece and Cinch identifies it — what it is, its colours, how formal it is, how warm it is. That becomes your digital closet. From there it does the part that is actually hard: working out what goes with what.

DECIDE TOGETHER
Post the dinner, the wedding, the trip. Invite your friends. Everyone shares a couple of outfit options from their own closet, everyone votes and comments on everyone else's, and each person walks in wearing the look their friends helped them choose. Nobody is ranked against anybody else — every vote is about one person's options, judged only against each other, by the friends they invited.

BORROW FROM EACH OTHER
See what your friends own, not just what they post. Browse a friend's closet, find the black clutch they never wear, and ask to borrow it. They lend it or say not this time — one tap either way, private between the two of you, and nobody has to make it awkward.

SEE YOUR OWN STORY
Cinch tracks every wear. See your most-worn pieces, the ones sitting untouched, and what you're actually spending per wear — the real story of your closet, not the one you'd guess.

BUILT ONLY FROM WHAT YOU OWN
Every suggestion — yours or a friend's — is assembled from real wardrobes. Nothing is imagined, nothing is a catalogue photo, and nothing is a piece you would have to go and buy first.

IT UNDERSTANDS A WHOLE DAY
A client dinner at seven and drinks at ten are not the same dress code. Cinch finds the one outfit that carries you through both — and tells you the single piece to lose on the way. Type "dinner then drinks after" and it works it out, or connect your calendar and it reads the day for you.

DRESSED FOR THE ACTUAL WEATHER
Cinch uses the apparent temperature where you are, not just the forecast high. It knows a light jacket is not enough at four degrees in a strong wind, and it will not put suede shoes on you in the rain.

REAL COLOUR SENSE
Cinch judges colour the way a stylist does. It knows navy and camel work, that charcoal next to navy looks like a mistake rather than a choice, and that two loud colours need a third piece to calm them down.

IT LEARNS YOU
Like an outfit, skip it, or say why it is wrong — too formal, not your colours, worn too recently. Cinch adjusts from the very first reaction, and shows you in plain English what it thinks it has learned, so you can tell it when it is wrong.

PACK WITHOUT OVERPACKING
Tell Cinch where you are going and for how long. It reads the forecast at your destination and works out the smallest set of clothes that still gives you a different outfit every day — from what you already own.

ASK THE STYLIST ANYTHING
"Dinner at 7, drinks after?" "What am I missing?" The stylist answers using only your real clothes, and tells you honestly when you do not own the right thing rather than inventing something.

WORKS WITHOUT SIGNAL
Outfit building runs entirely on your iPhone. On a plane, in a basement, or with no bars at all, Cinch still dresses you from the closet it has already downloaded. Social features and naming outfits are the only parts that wait for a connection.

PRIVATE BY DEFAULT
Cinch never reads your photo library — iOS hands it only the pictures you tap. Your closet stays private until you choose to share it with a friend. There is no advertising and no tracking across other apps. You can delete your account, and everything in it, from inside the app.
```

---

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

*Live in App Store Connect as of 2026-08-06 (3,082 chars of 4,000).*

```
SIGNING IN
Sign in with Apple, or with any email address. Please use any Apple ID — no invite code is required. The email option sends a sign-in link that opens the app back up via the cinch:// scheme.

SEEDING A CLOSET
Cinch styles you from clothes you own, so a brand-new account starts empty and the Today tab will say it needs about ten pieces before it can build outfits.

To see the app working end to end, tap "Add clothes" on the Today tab and select any 10-12 photos of clothing from the device library. Tagging takes a few seconds per item. Once tagged, the Today tab shows three complete outfits with reasoning.

TESTING THE SOCIAL FEATURES — PLEASE READ
The friends, events, voting and borrowing features described in our App Store description require TWO accounts, because they are all built around inviting someone you know. A single reviewer account cannot exercise them.

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
Reporting: the "..." menu on any comment and on any user profile, with categorized reasons.

SUBSCRIPTIONS
The app grants 14 days of full access on first launch. This is an app-side grant, NOT a StoreKit introductory offer, so no purchase is required to evaluate the app and no trial is started in the sandbox. The paywall appears after the grant expires. All social features (friends, events, voting, comments, borrowing) are free on every tier.

PERMISSIONS
Location and Calendar are both optional and the app is fully functional without either. Declining location falls back to a default city, which the app states on screen. Camera is used only to photograph garments.

AI PROCESSING
Garment photos are sent to OpenRouter for identification. The user is asked to consent in-app before the first image is ever sent (Guideline 5.1.2(i)), and the consent sheet names the processor and the data categories. Outfit generation itself runs on-device.

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

**Uploaded and verified 2026-08-06 — five frames, in order.** Built per
`docs/app-store/screenshots/` (sources in `src/`, one HTML per frame).

| # | File | Screen | Headline |
|---|---|---|---|
| 1 | `01-today.png` | Today — the daily outfit plate | "Dressed in a *minute.*" |
| 2 | `02-event.png` | Event detail — Dana's birthday dinner | "The group chat, *answered.*" |
| 3 | `03-closet.png` | Closet — profile, stats, most-worn | "You own 54 pieces. *Nine, never worn.*" |
| 4 | `04-stylist.png` | Stylist — recommendation + honesty moment | "A stylist that *never* sells you anything." |
| 5 | `05-plan.png` | Plan — the week against the forecast | "The week, *already decided.*" |

The order carries the argument: daily habit, then the social differentiator,
then data, honesty, planning. **Do not reorder.**

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
| Report mechanism | **Partial** | Backend is solid — `content_reports` with RLS, rate limiting, auto-hide at 3 reporters. But the UI only exposes it on **comments** and **profiles**. Outfit posts — the headline UGC — plus items and event titles have no report affordance, though `report_subject` already enumerates them |
| Block abusive users | **Implemented, with a leak** | `user_blocks`, `on_block_sever_graph()`, `BlockedList.tsx`, reachable from Profile. But `blocked_between` is absent from the event-content select policies, so a blocked user's looks, votes and comments stay visible inside a shared event |
| Published contact info | Partial | Support URL is live and in the listing; no dedicated abuse-report address |
| Age gate | **Missing** | No birthdate column, no check. Spec §7.4.7 wanted 16+ for social |
| Deletion cascade | Implemented | `delete-account` relies on `on delete cascade` from `auth.users`; every social table carries the FK |

Two caveats worth knowing: `comments.tsx` already tells users *"Reports are
reviewed within 24 hours"* while nothing notifies anyone that a report was
filed; and `events.host_id ... on delete cascade` means a host deleting their
account destroys the whole event including other attendees' looks.

### Before the filter and gate are actually live

Both are database migrations, so they do nothing until pushed:

```bash
supabase db push          # applies both migrations
npm run gen:types         # REQUIRED — until this runs, use-social-terms.ts
                          # does not typecheck: database.ts has no
                          # social_terms_version column
supabase test db          # 08_ugc_moderation.sql, 25 assertions
```

Then load a real denylist as service_role. The migration seeds seven common
profanities as a starter set and deliberately ships **no slurs** — a slur list
hand-typed into a migration is both incomplete and unpleasant to maintain. Use
a maintained source (LDNOOBW or a commercial feed); the insert statement is in
the migration's closing comment.

**Remaining 1.2 exposure after these two:** report affordance on outfit posts
(the headline UGC is still unreportable), the block leak inside shared events,
and the age gate. None of the three is large; all three are visible to a
reviewer who goes looking.

---

## Submission checklist

Metadata — done:

- [x] Privacy policy URL, live and public
- [x] Support URL, live and public
- [x] Subtitle, promotional text, description, keywords (social-first, verified live)
- [x] Copyright
- [x] App Review contact name / phone / email
- [x] App Review notes, including two-account social test instructions
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
- [x] **Screenshots** — five frames uploaded to the 6.9" slot, verified in order
- [x] **Guideline 1.2** — content filter (migration `20260808100000`)
- [x] **Guideline 1.2** — EULA gate (migration `20260808101000`)
- [ ] Push both migrations, `npm run gen:types`, load a real denylist
- [ ] Wire `SocialTermsSheet` into the social entry points
- [ ] **Guideline 1.2** — report affordance on outfit posts, block leak in event policies, age gate
- [ ] **EU Digital Services Act trader status** — still "Set Up" on the App
      Information page. Without it the app can be removed from sale in the EU
- [ ] Review screenshot on each of the four subscriptions
- [ ] Apple Developer Program enrollment ($99/yr)
- [ ] Apple Team ID → `eas.json`
- [ ] `ascAppId` → `eas.json` (Apple ID is `6798479578`)
- [x] App icon — `assets/images/icon.png`, 1024×1024, no alpha; rides in the
      build, there is nothing to upload to App Store Connect
- [ ] A real device test pass
