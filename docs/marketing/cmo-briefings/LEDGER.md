# Action & prediction ledger

Every "Tomorrow's focus" item and every directive lands here the night it is issued.
Nothing leaves this file until it is **done → effect measured** or **killed with a
reason**. The nightly briefing scores this file first — an open item older than 3
nights must be escalated or killed, never silently reprinted.

Format: `| id | issued | item | lane | predicted effect | status | measured effect |`
Lane: OTA (ships in minutes) · BINARY (Apple review) · ASC (metadata/config) · OPS (no code).

## Open

| id | issued | item | lane | predicted effect | status | measured effect |
|---|---|---|---|---|---|---|
| **A47** | 09-06 | **Re-authenticate App Store Connect (2FA), then read the 09-05/09-06 Source Type breakdown** — `groupByDimensionKey=source`, 30d | OPS — two minutes of the founder's time | The 6× arrival discontinuity gets a name (Search / Browse / App Referrer / Web Referrer), A4 is gateable again, P14 becomes scoreable | **✅ ANSWERED 2026-09-07 ~21:0xZ — the founder re-authenticated; read by URL in Chrome.** The surge is **100% App Store Search**, and it is NOT an impression step: 30d-to-09-06 by source, impressions Search **8,166** (+1,092 since 09-04 = exactly 09-05's 429 + 09-06's 663) · App Referrer 32 (+0) · Browse 32 (+0) · Web 2 (+1); PPV Search **236** (+40) · 32 · 21 · 2; first-time downloads Search **64** (+16 = 9 + 7) · 8 · 1 · 0. Daily: impressions 09-05 **429** / 09-06 **663** (09-04: 837 — LOWER than the day before the surge); PPV **17 / 23** (baseline ~20/day — flat); first-time downloads **9 / 7** (baseline ~3). So impressions and page views were ordinary and **PPV→download jumped to 53% and 30%** against a 22.8% baseline. No category or featuring placement, no Browse, no referrer: the same searchers, the same page, more of them installing. Small n (17 and 23 page views), so treat the mechanism as HYPOTHESIS; the source attribution is a FACT. **P14 rescored: HOLDS** — 3.96% and 3.47% against a ≥4.5% falsifier. State of record also read: 1.2.3 / build 47 Ready for Distribution, nothing in review, promotional text present (39 chars). Review-answered status not read from the web (the route redirects); use the API key. | ASC returns `login?...authResult=FAILED` on both `/analytics/…` and `/iris/…` — the 401 failure, not the 410 one. Impressions, PPV, downloads, source, build-in-review, agreement banners and review-answered status are ALL unread on the night arrivals moved 6×. Circumstantial evidence for a category/featuring placement: **5 of 16 arrivals are non-US** (Delhi, Baku, Dammam, Erbil, St Helens) against a 94%-US baseline; a Cupertino device browsed build 47 on 09-05 02:34Z with no submission in flight; Resend received a 09-03 PeerPush directory listing. All three are checkable the moment the session lives. |
| **A48** | 09-06 | **Make the push card report visibility, not mount** — add the `explore_shop_shelf_reached` treatment to the Today card and emit `push_ask_seen` distinct from `push_ask_shown` | OTA | The 13→2 answer gap gets a cause; A44's effect becomes readable | **✅ SHIPPED 2026-09-07 (audit ship 6)** — `push_ask_seen {closet}` from a 40pt-inside-the-usable-viewport rule, pure + worklet, both ScrollViews; read shown vs seen next | `push_ask_shown` 13 persons (11 floor / 2 usable) → `push_ask_answered` **2** → granted **2/2**. Falsified the session-length explanation: `c61b8cb0` stayed **15,907 s (4.4 h)** after the ask and answered nothing; `a2f996cb` stayed 3,790 s and imported **10** garments; `863a69ed` imported **14**. Full table in 09-06 §8.3. Two explanations remain — seen-and-ignored vs never-in-viewport — and this row is the instrument that separates them. |
| **A49** | 09-06 | **Catch the bounced sign-in code, and stop minting an `auth.users` row per code request** | OTA + OPS | A user whose address hard-bounces is told, instead of waiting forever on "check your email" | **✅ SHIPPED 2026-09-07 (audit ship 6)** — bounce card on the code screen via the new `auth-code-status` edge read of Resend; `reap_unverified_signups()` hourly, **9 orphan rows reaped on the first run** (71 → 62 users) | 09-05 17:35:53Z a code to `sanasharifi@gmail.com` **bounced** (Resend). 83 s later the same person requested one at `sanasharifi179@gmail.com` — she found her own typo — and it delivered. She never signed in, holds 0 items. **Both attempts created `auth.users` rows** (`19ac8a5b`, `2b65f685`, both `last_sign_in_at = NULL`) because `shouldCreateUser` mints on send. `auth_address_refused` correctly did not fire — the address was syntactically valid. Orphan rows also inflate every signup denominator. |
| **A50** | 09-06 | **Move the review prompt to a moment of delight** — fire after the first completed Reveal or the tenth garment, not on a timer | OTA | `review_prompt_action` stops being 100% "later"; the rating count moves off 6 | **✅ SHIPPED 2026-09-07 (audit ship 6)** — armed by `ten` / `reveal` moments only, timer retired, never over a paywall, `moment` on both events | `review_prompt_shown` **6** → `review_prompt_action` **"later" 6 of 6** in four days. Rating count has been **6 for ten days**. Apple caps the native prompt at three per user per year, so every "later" destroys an impression that cannot be recovered. Six people built ten-piece closets this week and none was asked at a moment they had just been delighted. Competitive context: Cinch converts users better than apps with 1,000–30,000 ratings (09-06 §9) and has six. |
| **A4** | 08-31 · **RESURRECTED 09-05** | **Re-cut the first screenshot + icon** (and consider subtitle candidate A, "Outfits from clothes you own") | ASC — **confirm lane**: editing a live version's screenshots/subtitle requires a new version submission; only promotional text is review-free | Impression→PPV 3.50% → ≥5% (total basis) within 7 days of the new set going live | **GATE ANSWERED 09-05 — SHIP.** Source Type read by URL (audit ship 5): **99.1% of impressions are Search** (7,074 of 7,139); Search's own impression→PPV is **2.77%**. The listing is underperforming for people who searched for it. Awaiting the founder's design afternoon. | 30d: **7,139 impressions → 250 page views → 57 downloads**. Impression→PPV **3.50%** (09-04: 1.43%); PPV→download **22.8%** — the page converts fine, the tap does not. Screenshot set v3 untouched **9 nights**. **Gate: read the Source Type breakdown first** (09-05 §16.1) — if the impressions are Browse rather than Search, do not ship this. |
| **A44** | 09-05 | **Ungate the push ask from the activation floor** — fire the Morning Edit card after `style_profile_saved`, not after `canGenerate` | OTA + DB | First non-zero `push_tokens` row from a real user | **✅ SHIPPED 09-05 (audit ship 5) — card on the floor with a conditional sentence; claim guarded at ten; sim-proven end to end; QA rows cleared** | OTA `01a06c9f` confirmed on **3 real devices** (`c61b8cb0` 09-04 16:42Z, `9504a3ed` 23:52Z, `590709c2` 09-05 04:49Z). `push_ask_shown` = **0** from all three, because all three hold **0 items** so `canGenerate` never passes. 14d denominators: `style_profile_saved` 23 persons vs `clothes_import_completed` 14. The ask is gated behind the step the funnel is losing. Scored by **P15**. |
| **A45** | 09-05 | **Give a cancelled Apple sign-in a visible second door** — one line on the first cancel: "Trouble with Apple sign-in? Use your email instead" | OTA | A canceller who does not self-recover reaches the email door instead of leaving | **✅ SHIPPED 09-05 (audit ship 5) — `auth_cancel_hint_shown/taken`; a true cancel is untestable on the sim (no Apple ID), wiring source-pinned** | 11 of 39 auth starters fired `auth_failed{canceled}` in 14d. **8 of 11 completed seconds later** (table in 09-05 §8.3) — so this is friction, not a lockout, and the alert was withdrawn. The 3 who did not: `ab374450` (Stuart), `070c10b5` (4 cancels / 105 s / never signed in), `46451076` (Bismarck, gone in 6 s). `auth-apple-diagnosis.test.ts` deliberately keeps cancels out of the escalation — this is the revisit the 09-04 ledger asked for. |
| **A46** | 09-05 | **Diagnose the Explore shelf's zero product opens** — is it invisible or are the products wrong? | OTA | `explore_shop_product_opened` > 0, or a written reason it never will be | **INSTRUMENTED 09-05 (audit ship 5) — the wire is proven live (first-ever open, from the sim); `explore_opened` / `explore_shop_shelf_shown {cards,paid}` / `explore_shop_shelf_reached` decide invisible vs unwanted from the next real visits** | 10 persons fired `explore_shop_feed_loaded` **43 times** in 14 days. `explore_shop_product_opened` does not appear in the 14-day event stream **at all — 0, lifetime**, across A29's shelf, A30's slot mapper and audit ship 3's closet-affinity ranking. Three ships, no reader. |
| **A21** | 09-01n | Create an App Store Connect API key | OPS | Source-attribution automation; ASC readable without a browser | **DEMOTED 09-05 — no longer blocking.** Kept for automation only. | **Its premise was wrong.** `/analytics/api/v1/data/time-series` (hyphen) is 410; the live path is `/analytics/api/v1/data/timeseries`, and the ASC Analytics **dashboard** renders impressions/PPV/downloads in a browser tab whenever the session is alive. Five briefings recorded acquisition as "unread — no API key." Full account in 09-05 §17.1; METHODOLOGY amended. |
| **A19** | 09-01-od | Make `paywall_impressions` record every paywall, not just the promo path | OTA | Table matches PostHog `paywall_presented` | **✅ SHIPPED 09-05 (audit ship 5) — the row is written from use-gate's `onPresent` for every placement; caps unaffected** | 14d: `paywall_presented` **5** vs `paywall_eligible` **3**; the `add_garment_over_limit` path fires neither eligibility nor a table row. The table did correctly capture both real `trial_expired` impressions on 09-04 (`e931d02b` 01:52:19Z, `1b35b7b6` 16:42:59Z) — so the promo path works and the tap path is blind. |
| **A14** | 09-01 | **Ship push permission + token capture** | ~~BINARY~~ → OTA | `push_tokens` > 0 | **night 6 — TONIGHT'S #1, and the only row that moves the 09-03 thesis** | `push_tokens` 0 · `notification_prefs` 0 · `push_sends` 0, re-verified 09-03. Proof of consequence: the 14:00Z trial wind-down freed 37 accounts and **reached one person in eleven hours** (`901a935d`, Grand Rapids, 13-second session, no auth). Also gates the daily-streak mechanic identified in 09-03n §9. |
| **A42** | 09-03n | **Instrument and fix the email sign-in code path** — distinguish code-requested / code-entered / code-wrong | OTA | Tomorrow's first-screen loss has a name | **new** | Today's only real signup `ef579e79` (Salem, 04:55:16Z, provider `email`) has **`last_sign_in_at = NULL` and 0 items**; PostHog shows `auth_started` ×2 at 04:54:50 / 04:54:58 and the app backgrounded at 04:55:19 — 32-second session. The other two real installs (Fort Wayne 11:59Z, Grand Rapids 20:10Z) **never fired `auth_started` at all**, leaving in 21s and 13s. |
| **A41** | 09-03n | **Reseed the QA closets under their own storage prefix, and cap the signing retry** | OPS (service-role) + OTA | `image_sign_failed` stops being the largest event stream in the product | **new — surfaced by the 09-02 audit as a service-role task and not done** | `image_sign_failed` **112 events, 768 of 768 requests failed**, 2026-09-03 03:30:29Z → 09-04 00:28:26Z, still looping at write time. One person, `$app_build='1'` (harness). Not a customer signal — but it is an uncapped retry loop against Supabase storage and it drowns the event stream. |
| **A43** | 09-03n | **Fix the competitor tracking list** | OPS | The nightly benchmarks Cinch against the actual field | **new — measurement correction** | "Alta" in the rotation resolves to *CoreX-ROBOT* (id 6739418161, 0 ratings, 2024) — every prior "Alta" line was a different app. The list also omits **Dressly: AI Outfit Maker** (id 6738174180, 29,483 ratings, 4.40, shipped 09-03), **Alta Daily: Digital AI Closet** (id 6481705400, 13,863, 4.88) and **Fits** (id 6447482321, 5,224, 4.59) — the 1st, 2nd and 5th largest apps in the category by rating volume. Corrected table in 09-03n §9. |
| A4 | 08-31 | Re-cut first screenshot + icon for tap-through | ASC | Impression→PPV 4.4% → ≥6% (unique-device basis) | **night 5 — STALE. Gate 09-03 is 1 day out, ship or kill** | screenshot set still v3. Every other ASC lever moved 09-01 23:1xZ (promo text); this did not. Note the gate is unscoreable until A21 lands — kill on effort grounds, not measurement grounds |
| A7 | 08-31 | Tell the trial cohort they were never charged, before the Sep 11 cliff | OPS | Prevents a 22-person surprise on Sep 11 | **✅ DONE — AMENDED 09-02 01:5xZ per the A27 conversion:** the 21 originals were cancelled and replaced by **29 notes** (whole live-trial cohort, incl. the 8 post-Sep-11 expirers), same 09-02 14:00Z send, now announcing the Sep-3 wind-down + membership offer | covers the whole Sep-11 cliff cohort, relay addresses included (A26 resolved). **Before they send, confirm A27** — if trials are being converted rather than expired, the closing line should carry the offer. Scored by P8. |
| A8 | 09-01 | Attach `ten_completed` / `returning_free` to live Superwall campaigns | config | First non-Reveal qualified ask presented | **SCORED 09-02 — OTA half WORKS, campaign half still UNREAD, and a second blocker found** | Both placements fired from a real user 09-02 00:20:56Z / 00:21:25Z — the OTA half is proven. Both resolved `eligible:false / not_free` (→ A27), so the campaign half was never reached and remains unverifiable. Superwall dashboard unread, night 3. |
| **A27** | 09-02 | **Resolve the 31 live gifted trials — they suppress every promo ask** (`presentPromo` → `eligible:false / not_free` because the trial fold raises plan above 'free') | OPS (SQL) + founder | First `paywall_eligible {eligible:true}` from a real customer; the first possible purchase | **new — TONIGHT'S #1, and the named cause of install→paid = 0%** | 31 real users gagged, 15 holding garments, 22 expiring by Sep 11 — leaving **exactly 6 real users in the whole database who can currently be shown a promo paywall**, 5 of them already-expired non-returners. Proof: person `d128173e` completed The Ten + a full 5-phase Reveal 09-02 00:20:56–00:21:25Z, fired `paywall_eligible` twice, both `eligible:false / not_free`, while her `subscriptions.plan` reads `'free'`. Recommendation: **convert, don't revoke**, and let A7's note land first. **✅ EXECUTED 09-02 01:5xZ on the founder's word:** all 29 live gifted trials shortened to `least(trial_ends_at, 2026-09-03T14:00Z)` (4 natural Sep-3 ends untouched); the 21 scheduled A7 notes CANCELLED and replaced by 29 amended notes (same 09-02 14:00Z send) that announce the Sep-3 wind-down and carry the membership offer — 24h notice, nobody ends silently, and the 8 post-Sep-11 expirers the original note missed are now covered. From 09-03 14:00Z the askable population is 35, not 6. First possible `paywall_eligible {eligible:true}` from a real customer: any session after that moment. |
| **A28** | 09-02 | **Stop enforcing the closet cap as a write failure** — catch `closet_limit_reached` before the batch, show one wall with the count, keep the picked photos | OTA | Zero `row_write_failed` on capacity grounds | **new — the larger half of A15** | person `149268b9` (Chicago, build 47): 46 failures in 44s, **100% preceded by `closet_capacity_state='active_full'`**, then `add_garment_over_limit` 10s later. She has not reopened the app. |
| **A29** | 09-02 | **Explore partner shelf** — parameterless `partner-feed` (owned catalogue, trackingUrl links, fails closed), PartnerShopSection behind C-03 with paid disclosure | OTA+edge | Partner products purchasable from Explore | **✅ SHIPPED same day, through three narrowing founder rulings** (all partners → clothes only → fashion brands only). OTA `01a06205` + 3 edge deploys, boot-gated, sim-verified after each ruling (40 → 24 → 24-all-CICYBELL cards). Effect metric: first non-internal `explore_shop_product_opened {shelf:'partner'}` — baseline 0. | gear brands (TideWe/Piscifun/brkox/SAILO/Giftlab) joined+synced but shelfless by founder edit (`PARTNER_FEED_MERCHANT_IDS`); gap-shop-match separately pinned (`OWNED_GAP_MERCHANT_IDS=['124976']`) |
| **A30** | 09-02 | **Ingest slot mapper matched prefixes** — `cap` in "Captain", `ring\b` in "Spring"; 16 LEGO frames classified headwear | edge | No non-garment row ever carries a garment slot | **✅ SHIPPED — SLOT_RULES bounded both sides, plurals explicit; full resync recomputed every slot** (brkox headwear 16→0, BONHEUR all-jewelry). Found BY the clothes-only ruling. Test executes the rules parsed from source. | also cleans the slot data gap-shop-match reads |
| **A31** | 09-02n | **Make the 14:00Z wind-down reach a running app** — wire `focusManager` (or invalidate `['subscription']` on foreground) and fix the client trial fold to match the server (paid > trial) | OTA | A session already running sees the trial end at 14:00Z, not on some later cold start | **new — TONIGHT'S #1, 13 hours to the event** | audit F-LC-4 / F-LC-5: `refetchOnWindowFocus` false, no `focusManager`; three docblocks claim otherwise. Client fold outranks paid (`use-plan.ts:141`) against server (`20260901000000:104-115`) |
| **A32** | 09-02n | **Ship A20's universal links, then re-send the conversion note with something tappable in it** | OTA/web + OPS | Any in-app event attributable to an email recipient — currently zero | **new — ESCALATED from A20** | the 29 delivered notes contain **no link of any kind**; all three HTML templates point their CTA at `apps.apple.com/app/id6798479578`, a store page for people who already have the app. 0 of 29 opened in 11h. Audit F-DATA-7 deferred this on "no consumer exists yet" — the consumer existed 11h earlier |
| **A33** | 09-02n | **Cut every A28/A15 fix for FOUR fleets, not three** | OTA | The largest active fleet stops being a blind spot | **new — measurement correction with a shipping consequence** | audit F-DATA-1: `c5f00773` (builds 43-44, 1.2.0) = **21 persons / 10 returning / last open 09-02**, never received A15 or A16. Every "all three fleets" row since 09-01 is wrong |
| **A27b** | 09-02n | **One trial holder escaped the clamp** — `bef15daf` (10 garments) still reads `trial_ends_at = 2026-09-04T13:34Z` | OPS (SQL) | 30 of 30 end together; nobody stays gagged an extra day on a wrong date | **new** | A27 was specified `least(trial_ends_at, 2026-09-03T14:00Z)`; this row is later. She also received a note naming Sep 3 |
| **A27** | 09-02 | *(scored 09-03n)* | | | **✅ DONE — EXECUTED AND MEASURED** | The clamp fired at 14:00Z. Supabase 09-04 01:03Z: **live trials 30 → 3** (1 real overdue = A27b, 1 real to 09-14, 1 internal); **askable population 6 → 37** (33 real + 4 family, `plan='free'` with no future `trial_ends_at`). **Effect on the funnel: zero.** In the 11 hours after 14:00Z exactly one non-harness person opened the app (13s, no auth); `paywall_eligible` fired **0 times**. The row did what it said and the room was empty — see 09-03n §7. |
| **A27b** | 09-02n | *(status 09-03n)* | OPS (SQL) | — | **night 2 — ESCALATED, ~12h left** | Still `trial_ends_at = 2026-09-04 13:34:42Z`, `plan='free'`, 10 garments. She was emailed a Sep-3 date. Decide before the clock does. |
| **A32** | 09-02n | *(status 09-03n)* | OTA/web + OPS | — | **✅ BOTH HALVES SHIPPED — scoring by P12** | Web half verified live 09-04 00:5xZ by independent fetch: `cinchstyle.com/closet` returns 200 and leads with `[Open in Cinch](cinch://closet)`, App Store as explicit secondary. Email half **delivered 22:00Z 09-03** — 29 recipients, two cohorts ("Your N pieces are still there" / "It only takes ten photos"), 6 duplicate re-cuts correctly `canceled`. **3 hours elapsed at write time: 0 of 29 have fired any event** (PostHog, `timestamp > 2026-09-03 22:00:00`, only person returned is the `$app_build='1'` harness). Scored by **P12** on 09-06. |
| **A37** | 09-03 | *(status 09-03n)* | OPS (env) | — | **✅ DONE — verified live** | `cinchstyle.com/i/nelson` now renders "Nelson Saenz added you on Cinch" with a send-to-phone action; the `/#waitlist` route is gone. Note for A23: on a desktop UA the only action is a `mailto:` — worth one look on an iPhone UA before the invite prompts ship. |
| **A39** | 09-03 | *(status 09-03n)* | OPS (copy) | — | **open, night 2** | `reengage.html` fixed and used for tonight's send. `dispatch.html`, `release.html`, `welcome.html` still `width="600"` / `max-width:520px` with no `width:100%`. |
| **A24** | 09-01n | *(status 09-03n)* | FOUNDER | — | **✅ CLOSED by founder ruling 09-03** | Sharing ON by default (migration 20260903010000); 51/51 profiles sharing. Effect metric not yet exercisable: `daily_social_empty` last fired **08-31**, before the flip — nobody has opened the surface since. |
| A9 | 09-01 | Read `outfit_reactions` in the ranking path; delete or wire `style_feedback` | OTA | A "hate" removes an outfit from rotation | **open, night 5** | grep rerun a 3rd time → outside generated types, only `styling/mutations.ts:77` — a **`select('id')`** locating a row to delete inside `retractOutfitReaction()`, not an insert (writes go via `rpc('apply_outfit_reaction')`) — and `:94` (the delete). **Nothing reads reactions in the ranking path.** See 09-01n §17.4. 43 reactions / 8 users / **0 readers** |
| A12 | 09-01 | Put the trial-bearing product on the paywall's default button | config | The default tap can actually start a trial | open — founder decision, night 2 | — |
| A14 | 09-01 | Ship push permission + token capture | BINARY | `push_tokens` > 0 | open, night 3 | `push_tokens` 0 · `notification_prefs` 0 · `push_sends` 0 (re-verified 09-01n) |
| ~~A15~~ | 09-01-od | **MERGED INTO A28 on 09-02n.** Audit F-A28 proves **both** clusters are the closet cap — the Ludlow user had 11 completions, then full → delete → room → 1 completion → full. The "two different causes" line in three briefings is retracted. `code` remains null on all 66 events (both clusters predate the OTA) and there have been **zero import attempts in 24h**, so the discriminator still has no data. Original row kept below for its evidence. | | | | |
| **A15 (orig)** | 09-01-od | Fix `clothes_import_failed / reason=row_write_failed` — **narrowed 09-01n: `upload-queue.ts:169` maps it to `Could not create item` / `Could not record upload`, thrown at :706, :758, :806, :1221 — all Supabase insert/update errors, NOT the cutout model.** Also make the event carry the Postgres code. | OTA | Zero `row_write_failed` over 48h + reason carries a PG code | **instrumentation half SHIPPED TO ALL THREE FLEETS** — `01a05f44` (4e646ba0), side-cuts `01a05f55` (ccfa8345 — the Ludlow user's fleet) and `01a05f54` (813c6d34), all manifest-verified 09-01 23:3xZ. The four throw sites embed the PostgrestError code; `clothes_import_failed` carries it as bounded `code`. The defect itself stays open until a fleet build emits a code and the write is fixed against it. | no new failures, but no new import attempts either (last `clothes_import_selected` 16:34:26Z) — denominator zero, no credit |
| ~~**A16**~~ | 09-01-od | **KILLED 09-02n — the row was wrong, and it was mine.** Audit F-A16: *every* `AddGarmentOverLimit` presentation in the source is reached by a user tap (closet door, capture sheet, The Ten, storage, gap feed, garment-search sheet), so the grace silenced a paywall the user had asked for; it was also per-process, not per-user. `import-failure-grace.ts` + its test staged for deletion; the `use-gate.ts` check removed. Replaced by A28's `import-failure-classify.ts`, which distinguishes a capacity refusal from a genuine write failure instead of muting both. **Lesson: I inferred user intent from an event sequence without reading the call sites.** Original text below. | | | | |
| **A16 (orig)** | 09-01-od | Stop `add_garment_over_limit` firing within minutes of failed imports | OTA | No paywall within 10 min of a `clothes_import_failed` for the same person | **SHIPPED TO ALL THREE FLEETS** — `01a05f44` (4e646ba0) + side-cuts `01a05f55` (ccfa8345) / `01a05f54` (813c6d34), manifest-verified 09-01 23:3xZ. Ten-minute grace in `import-failure-grace.ts`; gate resolves 'unavailable' and emits `paywall_eligible / import_failure_grace` per suppression, so the guard is measurable. Flat rule: any terminal import failure suppresses, whatever its reason. | reinforced 09-01n by Acloset's review corpus (its worst-reviewed mechanic is charging to upload more clothes) |
| **A18** | 09-01-od | Give the Today tab something of the user's before they have a closet (or gate entry) | OTA | `clothes_import_selected` rises toward `today_opened` | **new** | baseline: today_opened 35 · stylist_opened 28 · clothes_import_selected 14 (14d, excl. 16 devices) |
| **A19** | 09-01-od | Make `paywall_impressions` record every paywall, not just the capped promo path | OTA | Table matches PostHog `paywall_presented` | **new — measurement debt** | today's only production impression is in PostHog and absent from the table |
| **A20** | 09-01-od | Add `/open`, `/closet`, `/membership` to the AASA components | OTA/web | Email CTAs land inside the app instead of the App Store page | **new** | universal links currently cover only `/i/*` |
| **A21** | 09-01n | Create an App Store Connect API key (Users and Access → Integrations) so impressions/PPV/App Units/source attribution become readable again | OPS | ASC acquisition data readable; P1 re-issuable; A4 scoreable | **new — unblocks 4 dead rows** | `POST /analytics/api/v1/data/time-series` now returns **410 Gone**; the session was never the problem |
| **A23** | 09-01n | Ask users to invite (one prompt after `closet_ready`, one after first `outfit_reacted`) | OTA | `invite_shared` > 4 | **✅ SHIPPED 2026-09-07 (audit ship 6), night 6** — the `closet_ready` card on Today, after the push card; the `outfit_reacted` prompt deliberately not built (superset audience) | 4 shares ever, by 3 people, **3 converted (75%)**; the app's only 5-day-retained user came through it. K ≈ 0.10 |
| **A24** | 09-01n | Gate or seed Daily Social so nobody opens an empty screen | ~~OTA~~ → **FOUNDER** | `daily_social_empty` / `daily_social_opened` < 1.0 | **REFRAMED 09-02n — this is not a defect** | audit F-DATA-6: every `daily_social_empty` carries `reason=nobody_sharing`; **1 of 50 profiles has sharing on, 6 follow rows, 0 reactions.** The surface already renders a "go first" hero. The only lever is the sharing DEFAULT, which the privacy constitution puts OFF. **Recommendation: do not flip it** — hide the Day section until ≥1 friend shares, and stop counting `nobody_sharing` as a defect |
| **A34** | 09-02n | **`explore_shop_feed_loaded` fires ungated inside a react-query `queryFn`** (`use-shop-feed.ts:61`, `use-partner-feed.ts:48`) — gate on visit | OTA | The event counts shelf visits, not launches and refetches | **new — A29's baseline is contaminated by it** | audit F-AN-1. I used this event three times on 09-02 (40 → 24 → 24) as the shelf's verification instrument; it was a valid *sim* check of the wire, never evidence anyone looked |
| **A32** | 09-02n | **Ship A20's universal links, then re-send the conversion note with something tappable in it** | OTA/web + OPS | Any in-app event attributable to an email recipient — currently zero | **half built 09-03, BLOCKED on a web deploy + founder approval** | Web half written and not deployed: AASA claims `/closet` (a **real app route**, so no binary and no OTA — the `applinks:cinchstyle.com` entitlement is host-scoped and already in build-47 source), `web/vercel.json` rewrites it, `web/api/open.js` answers for anyone without the app. Email half built: 29 personalised notes, two cohorts, one CTA at `https://cinchstyle.com/closet`, seeds delivered 12:07Z. **Live site still 404s on `/closet` and the live AASA still claims only `/i/*`.** Falsification of the 09-02 zero re-run 09-03 12:0xZ: 27 of the 29 recipients resolve as PostHog `distinct_id`s, 2894 events historically, **max timestamp 09-02 06:59:20Z — before the 14:00Z send.** Still 0 of 29 at 15h. |
| **A37** | 09-03 | **`APP_LIVE` is not set in Vercel — every invite tap lands on a waitlist** | OPS (env) | The referral loop's CTA reaches the App Store instead of `/#waitlist` | **new — found while building A32, and it is the cheapest fix on this list** | `web/api/invite.js:56` gates the store link behind `process.env.APP_LIVE === '1'`. Fetched 09-03 with an iPhone UA, live `/i/<handle>` renders **"Join the list" → `cinchstyle.com/#waitlist`** while `itunes.apple.com/lookup?id=6798479578` returns `resultCount: 1`. A23 wants more invites; those invites have been pointing at a waitlist the whole time. |
| ~~**A38**~~ | 09-03 | **No universal link has ever been verified opening the app on a real device** | OPS | — | **RESOLVED 09-03 — and it was NOT the entitlement.** Build 47's signed IPA entitlements carry `com.apple.developer.associated-domains = ["applinks:cinchstyle.com"]` and its embedded provisioning profile allows associated-domains (`*`) — read from the binary by the engineering session, so the EAS capability-sync fear in `app.config.ts:180-198` never materialised. Apple's CDN also serves the `/closet` component (`app-site-association.cdn-apple.com/a/v1/cinchstyle.com`). | **The real constraint is the DEVICE-side AASA cache.** iOS fetches a domain's AASA at app **install/update** time and otherwise only on a slow periodic schedule; **an OTA update is not an install.** Every phone that installed Cinch before 09-03 still holds a cached AASA without `/closet`, so the universal link will not fire for them — they land on `web/api/open.js`. `/i/*` still deep-links for everyone because that component has been in every cached copy since 08-10. Clears itself on the next App Store build (every updater re-fetches). Mitigated meanwhile by the `cinch://closet` door added to the fallback page. |
| **A40** | 09-03 | **Give the `/closet` fallback page a `cinch://` door** — a recipient who already owns Cinch was being shown "Get Cinch" | OTA/web | A recipient with the app installed reaches their closet, not the App Store listing | **✅ SHIPPED + verified live 09-03** | Found by reasoning through A38's cache finding: with a stale AASA, every installed recipient lands on the fallback and the page's only action told them to install an app they already have. Page now leads with `cinch://closet` (resolves via expo-router default matching to `src/app/(tabs)/closet.tsx`; scheme `cinch` at `app.config.ts:139`, no `+native-intent` to intercept) and keeps the App Store as an explicit secondary, because a custom-scheme link is inert when the app is absent and must never be the sole action. |
| **A39** | 09-03 | **All three HTML templates overflow a 375px viewport** | OPS (copy) | Email renders inside the phone it is read on | **new — `reengage.html` fixed, the other three are not** | `dispatch.html`, `release.html` and `welcome.html` set `width="600"` with only `max-width:520px` and no `width:100%`, so the card is 520px wide on a 375px phone. Rendered and screenshotted 09-03 at 375×812. **Dispatch No. 01 was sent that way to 23 people on 09-01.** |

## Audit ship 6 — seen not mounted, the moment not the timer, the bounce, and the ask (engineering session, read after the 09-06 nightly, 2026-09-07 20:14Z main · side-cuts 20:23Z / 20:35Z / 20:45Z)

Commit `20573e9` on main. Published to all four live runtimes and manifest-verified:

| runtime | fleet | OTA | branch |
|---|---|---|---|
| 4e646ba0 | 1.2.3 / b47 (store) | `01a07d81-c9d9-7c1d-8536-388a3a9cabcd` | main |
| c5f00773 | 1.2.0 / b43-44 | `01a07d8a-294d-7040-a95a-d7cb39c23144` | ota/c5f00773-a48 |
| 813c6d34 | 1.2.1 / b45 | `01a07d95-c5d6-78e2-b5ca-da07495e311b` | ota/813c-a48 |
| ccfa8345 | 1.2.2 / b46 | `01a07d9e-f4dd-7a2e-9926-457c5f1a32a9` | ota/ccfa8345-a48 |

**A47 is not engineering work and is untouched:** App Store Connect still needs the founder's
2FA. Nothing below reads ASC.

Rows moved:
- **A48 ✅ SHIPPED (OTA).** The push card now hands its own y up through `onLayout` (the shop
  shelf's arrangement) and Today reports `push_ask_seen {closet}` — `trackOnce`, same property
  as `push_ask_shown` — the first time enough of the card is on screen. "Enough" is stricter
  than the shelf's top-edge rule on purpose: the card's top **40pt** inside the viewport
  **above the 96pt tab-bar band** (`pushAskSeen` in `push/ask-spec.ts`, a pure function AND a
  worklet, executed by `tests/push-ask.test.ts`). The floor's plain ScrollView checks from JS on
  every layout and scroll; the happy path's Reanimated scroll handler checks on the UI thread and
  hops to JS exactly once. Read next: `push_ask_shown` vs `push_ask_seen` per closet. Shown ≫
  seen → the card sits below the fold (fix: move it up). Seen ≈ shown and still 2 of 13 → it was
  looked at and declined (fix: the sentence).
- **A50 ✅ SHIPPED (OTA) — the per-session timer is retired.** The review card is armed by a
  MOMENT and nothing else: `ten` (the `closet_ready` predicate crossing, from either route — and,
  once, for every closet already past it, so the twelve ten-piece closets get asked on their next
  visit) and `reveal` (the Reveal's exit). Each moment arms the card once per install, ever; the
  card draws on the next tab root after a 5-second settle and **never over a paywall** —
  `use-gate.ts` stamps every sheet's present/dismiss into the same kv store and the card waits
  while one is up or within 3s of it closing (a wait is never a spend). "Not now" consumes THAT
  moment; the next one asks again; two asks is the ceiling. Rate / already still end it forever.
  Both events now carry `moment: ten | reveal`. Session counting is gone. Effect metric: the
  `later` share of `review_prompt_action` (was 6 of 6) and the rating count (6 for ten days).
- **A49 ✅ SHIPPED (OTA + edge + DB).** *Client:* after a send the code screen asks
  `auth-code-status` at 5s / 12s / 25s (restarted by a resend, stopped by a typed digit) and, on a
  yes, draws "THAT EMAIL BOUNCED — the code came straight back — that address doesn't seem to
  exist" with one door, **Use a different email → back to the address screen**, and fires
  `auth_code_bounced {method: email}`. *Edge:* `auth-code-status` (deployed 2026-09-07 via
  `--use-api`, `verify_jwt = false` because the asker has no session yet) reads Resend's own
  list of sent mail and answers **only** `{ bounced }` — never delivered/opened, never an id —
  for the newest sign-in-code mail to that address inside 15 minutes; every failure answers
  `false` (a person with a working address must never be told it bounced). No webhook, no
  table, no new standing configuration. Smoke: `{ bounced: false }` 200 for the 09-05 address
  (outside the window), 400 for a non-string. *DB:* migration `20260907000000` —
  `reap_unverified_signups()` deletes `auth.users` rows that are OTP-minted, never confirmed,
  never signed in, older than 24h and garment-less (cascade = `delete-account`'s own path);
  pg_cron `cinch-reap-unverified-signups` hourly at :43. **Run once by hand at ~19:2xZ: 9 rows
  reaped** (both `san***` rows from the 09-05 typo-and-retry, `ef579e79` Salem, and six older
  ones from 08-06 → 08-31), `auth.users` 71 → 62, `profiles` → 62, never-verified now 0. The
  client cannot stop the mint (Supabase issues an OTP only to a user that exists), so the row is
  kept no longer than the code is good for. **Nightly note:** signup denominators drop by 9 and
  will keep dropping by the day's orphan count; a `last_sign_in_at IS NULL` row older than a day
  is now always <24h old or an Apple account.
- **A23 ✅ SHIPPED (OTA), night 6.** One card on Today, the morning-edit card's shape exactly,
  drawn when the closet can be dressed (`pushAskCloset === 'usable'`) and **only once the push
  card has been answered** (one card at a time under the plate; push first, because day-2 return
  is the binding constraint). "Share your link" → the invite screen, which owns the share sheet
  and `invite_shared`; "Not now" retires it for the install. Events: `invite_ask_shown`
  (`trackOnce`) → `invite_ask_answered {share | not_now}` → the existing `invite_shared`. The
  second prompt the 09-01 row named (after the first `outfit_reacted`) is NOT built — the plate
  already draws this card for every usable closet, which is a superset of that audience.
  Effect metric unchanged: `invite_shared` > 4.
- **Data gap §16.6 answered by grep:** of the seven names the nightly could not verify,
  **none exists** in `src/lib/posthog.tsx` — `closet_opened`, `packing_opened`, `trips_opened`,
  `events_opened`, `voice_intake_started`, `circles_opened`, `saved_looks_opened` are all
  not-instrumented. The tab-level opened events that DO exist are `today_opened`,
  `stylist_opened`, `plan_opened`, `explore_opened` (A46). Feature-adoption for closet / packing /
  trips / events / voice / circles / saved looks is **unread, not zero**.

**A49's read half went LIVE at 21:40Z — the founder set `RESEND_READ_API_KEY`; a fresh throwaway bounce (`cinchbounce0907b@gmail.com`, Resend `bounced` 21:40:37Z) answered `{ bounced: true }` from the deployed function ten seconds after the send, and a delivered address answered `false`. The paragraph below records the state before that and why it was not done from here.**

**A49's read half is FAIL-CLOSED until the founder sets one secret.** The function log at
20:03:27Z says why the sim's real bounce came back `false`: `auth-code-status: Resend list
answered 401`. `RESEND_API_KEY` in Supabase is the send-only key the mail functions were
written against (support-mail/mail.ts says so), and Resend refuses its list call. Creating a
new Resend key and storing it is a credential and a standing-config change, so it was not
done from here. **Founder, two minutes:** Resend → API Keys → create with full access →
`supabase secrets set RESEND_READ_API_KEY=re_…`. The function already prefers that name and
needs no redeploy; until then every answer is `{ bounced: false }` — the pre-A49 screen,
nothing worse — and the 401 line in the function log is the pending signal. The client half
(the watch, the card, the door, `auth_code_bounced`) is source-pinned by
`tests/auth-code-bounce.test.ts` and could not be drawn live for that reason. **Residue:** the
gate's deliberate bounce minted `cinchbounce0907@gmail.com` (Resend: `bounced`, 20:02:34Z); the
reaper deletes it at the first :43 after 20:02Z on 09-08.

**Data gap §16.6 (nightly): none of the seven feature-adoption names exist in
`src/lib/posthog.tsx`** (`closet_opened`, `packing_opened`, `trips_opened`, `events_opened`,
`voice_intake_started`, `circles_opened`, `saved_looks_opened`). Only `today_opened`,
`stylist_opened`, `plan_opened` and `explore_opened` exist as tab-level opens. Those seven
features are **unread, not zero**.

Keyed-Release boot gate: **PASSED** (xcodebuild Release + production Superwall key, fresh
install on "Cinch iPhone 17 Pro", 20:02–20:08Z). Cover → email door → a deliberately
nonexistent Gmail address → code screen (Resend recorded the hard bounce within seconds; the
card stayed hidden for the reason above) → Change email → cover → `sim-test+ja` (0 garments)
via Resend read-back → Today floor with the card at the fold → **`push_ask_shown {floor}`
20:04:59Z, `push_ask_seen {floor}` 20:05:33Z on the scroll** (the rule held the card as
unseen while only its eyebrow cleared the tab-bar band — conservative by design) → Not now →
card retired. Fresh install → `sim-test+j00` (10 garments) → plate → **`push_ask_shown
{usable}` 20:07:27.68Z, `closet_ready` .76Z, `push_ask_seen {usable}` 20:07:28.36Z (inside
the first viewport), `review_prompt_shown {moment: ten}` 20:07:32.70Z — five seconds after
`today_opened`, over the plate, no sheet in the way — `review_prompt_action {later, ten}`,
`push_ask_answered {not_now}` 20:08:00.40Z, `invite_ask_shown` 20:08:00.45Z** (the invite
card took the slot the instant the push card left it) → Share your link → the invite screen.
**One thing the gate surfaced for the founder:** a profile with no handle lands on the invite
screen's "Choose a handle first" step rather than a share sheet — the screen's own existing
behaviour, now one tap from Today — and **8 of the 12 real ten-piece closets have no handle**
(Supabase, family/internal excluded). Two thirds of A23's audience meet a second step before
the share sheet. Worth a founder look: choose the handle inside the card's flow, or seed one.

## Audit ship 5 — the floor, the second door, the ledger row and the shelf's own numbers (engineering session, read after the 09-05 nightly, 2026-09-05 17:39Z main · side-cuts 17:48Z / 17:55Z / 18:03Z)

Commits `ee8e651` + `067651c` on main. Published to all four live runtimes and manifest-verified:

| runtime | fleet | OTA | branch |
|---|---|---|---|
| 4e646ba0 | 1.2.3 / b47 (store) | `01a072a7-3706-7f29-885f-7d170272c9ea` | main |
| c5f00773 | 1.2.0 / b43-44 | `01a072af-9d67-7315-b2e0-aa754cf7ee8a` | ota/c5f00773-a44 |
| 813c6d34 | 1.2.1 / b45 | `01a072b5-f164-700c-aa57-34f22cdf831a` | ota/813c-a44 |
| ccfa8345 | 1.2.2 / b46 | `01a072bd-7efa-736f-853e-baa13ce43f6e` | ota/ccfa8345-a44 |

**The gate on A4 is answered, and it says ship.** The Source Type breakdown the 09-05 nightly
could not capture reads by URL — the parameter is `groupByDimensionKey=source`, not
`dimensionKey` (METHODOLOGY amended with the URL and the keyboard recipe for the dropdown).
30 days to 09-04:

| source | impressions | product page views | first-time downloads |
|---|---|---|---|
| App Store Search | **7,074** | 196 | 48 |
| App Referrer | 32 | 32 | 8 |
| App Store Browse | 32 | 21 | 1 |
| Web Referrer | 1 | 1 | 0 |

**99.1% of impressions are Search**, and Search's own impression→PPV is **2.77%** — lower than
the blended 3.50%, because the referrer traffic converts at 100%. The listing is
underperforming for people who searched for it, which is the one case §7's evidence-against
paragraph said would make A4 the right call. PPV→download on Search is 24.5%, ordinary. A4 is
unblocked; the design afternoon is the founder's.

Rows moved:
- **A44 ✅ SHIPPED (OTA) + migration applied.** The card no longer waits for `canGenerate`:
  Today draws it under the floor's doors as well as on the plate, and the SENTENCE moves
  instead of the gate — on the floor it reads "Once your ten are in, tomorrow's look is ready
  when you wake up. One note at 7:30am, nothing else." The claim keeps that promise:
  `push_claim_morning_edit` (migration `20260905000000_morning_edit_needs_a_closet`, applied
  via MCP 16:5xZ) claims nobody with fewer than ten garments, so a grant made at zero pieces
  produces its first note the morning after the tenth lands; `tests/push-ask.test.ts` holds
  the literal against `TODAY_ACTIVATION_FLOOR`. `push_ask_shown` now carries `closet: floor |
  usable`, so the floor audience is a number. **Proven on the keyed sim** as the zero-garment
  QA account `sim-test+ja`: floor → card → Turn on → iOS sheet → Allow → `push_tokens` +
  `notification_prefs` rows at 17:26:38Z → card retired; PostHog carries `push_ask_shown
  {closet: floor}` → `push_ask_answered {turn_on}` → `push_permission_result {granted,
  prompted}` → `push_token_registered {ok}`. The guard was then checked against that exact
  row: token yes, prefs yes, items 0 → not claimable. **QA rows deleted afterwards; all three
  push tables read 0 again** — the nightly's first nonzero is a real person. Effect metric
  unchanged: `push_tokens > 0` from a non-internal user; P15's falsifier is now reachable.
  **Open follow-on for the founder, not built:** a person who grants on the floor and never
  adds a tenth piece receives nothing, by design — push is still not used to bring anyone
  back. A "finish your ten" note would be a new channel with a new promise on the
  preferences screen, and that is a product decision.
- **A45 ✅ SHIPPED (OTA).** After the first cancelled Apple sheet the cover draws one line
  under the button — "Trouble with Apple sign-in? Use your email instead." — which IS the
  email door (same `onEmail`, so `auth_started {method: email}` follows). Two events:
  `auth_cancel_hint_shown` (once per visit) and `auth_cancel_hint_taken`. The real-failure
  count stays out of the cancel branch, pinned. **Gate limit, stated:** the simulator holds no
  Apple ID, so Apple's sheet there is a system alert whose Close reports `failed /
  ERR_REQUEST_UNKNOWN`, not a cancel — the second attempt correctly showed the existing
  "isn't finishing on this phone" toast and the hint correctly stayed hidden. A true cancel
  needs a phone; the wiring is held by `tests/auth-apple-diagnosis.test.ts`. Effect metric:
  among persons with `auth_failed {canceled}`, the share who reach `auth_completed` (any
  method) — baseline 8 of 11.
- **A19 ✅ SHIPPED (OTA).** `paywall_impressions` is now written from `use-gate.ts`'s
  `onPresent`, beside `paywall_presented`, for EVERY placement; `presentPromo` no longer
  writes it. The caps only ever counted `GENERAL_PROMO_PLACEMENTS`, so the contextual rows
  that now land change no verdict (pinned by a new promo-caps test). One deliberate change: a
  campaign SKIP used to spend the allowance; a skip draws nothing and now records nothing.
  Effect metric: `paywall_impressions` rows = `paywall_presented` events, per placement.
  Not exercised on the sim tonight (the QA account under the floor reaches no paywall);
  the call sits one line under the proven `track('paywall_presented')` and the seam is
  source-pinned.
- **A46 — diagnosed to the point the data allows, and instrumented for the rest.** Fact one:
  `explore_shop_product_opened` was absent from PostHog's *taxonomy* — never fired, lifetime,
  not even by the harness that loaded 979 cards on 09-01/03 (the 09-02 "40 → 24 → 24"
  verifications were feed-load counts, never taps). Fact two, from the sim tonight: **the wire
  is not dead** — the first `explore_shop_product_opened {shelf: partner}` in the project's
  history fired at 17:27:19Z when a CICYBELL card was tapped on the keyed build and opened
  the merchant page. So the zero is behavioural or visibility, not a broken event. Three new
  events decide which: `explore_opened` (Explore had no opened-event; the shelf's reads were
  standing in as the page's denominator), `explore_shop_shelf_shown {cards, paid}` (including
  the zero, reported by the page when both reads settle — `fetchStatus === 'idle'`, so the
  empty closet's self-disabled read counts as settled), and `explore_shop_shelf_reached`
  (the grid's top edge inside the viewport, checked from the shelf's layout, the viewport's
  layout and the scroll — the gate run found the shelf inside the first viewport of a
  near-empty page with no scroll event at all). Sim run: `explore_opened` →
  `explore_shop_feed_loaded {partner, 24}` → `explore_shop_shelf_shown {cards: 6, paid: 6}`
  → `explore_shop_product_opened`. Real-user denominator to date is tiny: 3 real persons
  loaded the feed since 09-02. Read next: `shelf_shown` with cards>0 and `shelf_reached`
  against `product_opened` — if reached ≫ opened the products are wrong; if shown ≫ reached
  the shelf is below the fold.

Keyed-Release boot gate: PASSED on the final bundle (xcodebuild Release + production
Superwall key into the scratchpad, fresh install on "Cinch iPhone 17 Pro"): cover → Apple
(system alert, two real failures, escalation toast) → email door → OTP via Resend read-back
→ Today floor with the card under the doors → Turn on → Allow → rows → card retired →
Explore → shelf → card tap → merchant page → Stylist floor. Rebuilt incrementally after the
shelf-reached fix and re-checked on Explore.

## Audit ship 2026-09-03 (engineering session, read after the 09-02 nightly)

Commit `200388c` on main. Reports: `docs/eng/audit-2026-09-02/` (FINDINGS.md, ten agent
reports, three verification passes). Published to **all four** live runtimes and
manifest-verified at u.expo.dev:

| runtime | fleet | OTA | branch |
|---|---|---|---|
| 4e646ba0 | 1.2.3 / b47 (store) | `01a06505-3926-75d7-a6ea-48a1ef0a490e` | main |
| c5f00773 | 1.2.0 / b43-44 (largest active, had never received A15/A16) | `01a06507-0ab4-7b18-ade9-42254ebea54f` | ota/c5f00773-audit |
| 813c6d34 | 1.2.1 / b45 | `01a06508-e96f-79e1-84ef-3e137c1abe05` | ota/813c-audit |
| ccfa8345 | 1.2.2 / b46 | `01a0650a-7c89-7c33-a902-ed2177fce407` | ota/ccfa8345-audit |

Device receipt is NOT yet proven: no production `Application Opened` carried these ids at
publish time (03:2xZ). The next briefing should look for them before crediting anything.

Rows moved:
- **A28 ✅ shipped** — batch admitted by count (`batch-capacity.ts`); first refusal parks
  the job and everything behind it as `held` (one `clothes_import_failed` with `held: n`,
  `reason: closet_limit_reached|storage_limit_reached`, `stage: writing`); released only
  when the client's picture of room has changed since the refusal. Effect metric:
  `clothes_import_failed` per person per batch ≤ MAX_CONCURRENCY (3), never 46.
- **A16 ✅ reverted in code** (the nightly killed the row; the code followed).
- **A9 ✅ shipped** — `reaction-ranking.ts`: thumbs change ranking (±0.06, 45-day
  half-life, core-keyed) in ONE sort with the favourite bonus. Effect metric: a disliked
  core drops out of the top three on the next generation.
- **A31 ✅ shipped** — `focusManager` wired to AppState; subscription query refetches on
  foreground; client fold mirrors `effective_plan` (paid > trial; lapsed paid = free).
- **A33 ✅ shipped** — four fleets, see table.
- **A34 ✅ shipped** — shelf reads wait for an Explore visit.
- **NEW A35 ✅ shipped (billing)** — `isStale` compared ISO strings in two spellings, so a
  tie was unreachable and every expiry would have been dropped as stale; now compares
  instants, revocations at a tie apply, plan changes at a tie apply. `effective_plan`
  honours `current_period_end + 3d`. `asc-notifications` claims its ledger row first.
  Never fired in production (no purchases) — fixed ahead of the first one.
- **NEW A36 ✅ applied (DB)** — `authenticated` held TRUNCATE/TRIGGER/REFERENCES on 19
  public tables (RLS does not govern TRUNCATE). Revoked; pgTAP plan 15→17 pins it.
- **Styling** — shoeless closets get cores in The Repeat (12/25 live closets); knit-only
  closets dress in heat; solid garments lose a phantom pattern scale.

Founder decisions surfaced, not made: A24 (sharing default), A27b (one trial holder
outside the clamp), the heat gate for knit cores when shirts exist (taste), the Ten's
"Filing three pieces" masthead over an all-parked batch (taste), Plan showing one outfit
for four days on the QA closet (worth a look, not diagnosed).

## Audit ship 2 — the founder follow-ups and the visual/usability directive (2026-09-03 04:5xZ)

Commits bb53d4d…8af1fc0 on main (seven merged UX clusters + three verification passes;
reports in `docs/eng/audit-2026-09-02/`: verification-ux.md, verification-ux-2.md, p0-images.md).
Published to all four runtimes and manifest-verified:

| runtime | fleet | OTA | branch |
|---|---|---|---|
| 4e646ba0 | 1.2.3 / b47 (store) | `01a0657b-a0d9-7d9b-9818-040fecb9e811` | main |
| c5f00773 | 1.2.0 / b43-44 | `01a0657d-be8c-73c1-9c10-4753f4f4bc05` | ota/c5f00773-ux |
| 813c6d34 | 1.2.1 / b45 | `01a0657f-3010-7748-a202-24a992834ca0` | ota/813c-ux |
| ccfa8345 | 1.2.2 / b46 | `01a06580-a3ef-7407-b752-917aa034941a` | ota/ccfa8345-ux |

(01a06579 on 4e646ba0 was superseded within minutes by 01a0657b — the weapons veto.)

Founder orders executed:
- **Sharing ON by default** — migration 20260903010000 applied 02:44Z; 49 never-chosen profiles switched on
  from that instant (boundary semantics untouched: nothing worn before crosses); 50/50 now sharing. A24 → closed
  by ruling. Effect metric: `daily_social_empty / daily_social_opened` falls below 1.0 once any two mutuals share.
- **packing-brief** — deleted (function + source); the on-device memo IS the feature; packing's Pro lock is
  client-side only now (documented).
- **Device receipt of the 02:0xZ OTAs (01a06505/07/08/0a)**: NOT PROVEN — zero real `Application Opened`
  carried any of them by 04:5xZ (US night; no real person opened the app after publish). The nightly should
  look for these ids AND the 01a0657b/7d/7f/80 set.

Directive items shipped (by number): 2 5 6 7 8 9(AX) 10 11 12 13 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31
32 33 34 35 36 37 38 39 40 41 42 43 44 45 46 47 48 49 50 51 52 53 54 55 56 57 58 59 60 61 62 63 64. P0 #1 diagnosed
as a QA-fixture defect (rows pointing at another user's storage prefix; real users unaffected) with one real
residue fixed (three thumb-only tiles). Founder/taste items surfaced, not made: #9's default-size fade (C-03 forbids
it), #4 header grammar on two deliberately different screens, Compose's tray button removed, the Explore doors row
hidden while the circle is empty (Invite lives in the ellipsis sheet), Reveal numeral 150→108, Wall Swap's
"Choose/Chosen" wording, the partner shelf stays ungated (founder-curated merchants), the QA closets need
re-seeding under their own storage prefixes (service-role task). Marketing items 65–69 are assets/copy for the
founder; only #39 (welcome line) was code.

## Audit ship 3 — "like your closet" (2026-09-03 ~12:30Z)

Founder question answered NO and fixed: the Explore shelf had matched only the KIND of garment and the
closet's colours. `src/features/explore/closet-affinity.ts` (commit 0ed4df4; partner veto 30f86f0) now folds
the wardrobe on the device into a profile — department (women / men / unisex, inferred from garments coded one
way in retail, confident only on lopsided evidence, or from `profiles.gender_presentation` when set — it is
null for all 51 today), mean formality, print share, fabrics, brands, palette — and scores every family
from the merchant's own words (weights: gender .30 · formality .25 · palette .20 · fabric .10 · pattern .10 ·
brand .05). A confident department mismatch is dropped; everything else is an order. The browse request is
unchanged (nothing about the closet travels). The title veto now applies to partner rows too: CICYBELL's
catalogue holds **428 concealed-carry bags** and one reached Explore as a "Backpack" on the boot-gate build.

| runtime | OTA |
|---|---|
| 4e646ba0 (store) | `01a06727-4318-75bb-915b-4317e3f39dc1` |
| c5f00773 | `01a06729-90fd-7fb4-a470-744bae5cb2ca` |
| 813c6d34 | `01a0672b-c42f-77f9-8a11-4952e61e145f` |
| ccfa8345 | `01a0672d-b95c-7fdb-9609-7ee88b0dba95` |

All four manifest-verified. Device receipt of the overnight ship is now PROVEN on two fleets (b45 → 01a0657f
at 10:00Z, b47 → 01a0657b at 04:54Z). Effect metric for the ranking: `explore_shop_product_opened` per
`explore_shop_feed_loaded` (was 0 / 39 lifetime). No store build was needed at any point — every change was
JS, edge function or database; the native fingerprint is still 4e646ba0.

## Audit ship 4 — the ask (engineering session, read after the 09-03 nightly, 2026-09-04 13:33Z main · side-cuts after)

Commit `3d82f94` on main. Published to all four live runtimes and manifest-verified:

| runtime | fleet | OTA | branch |
|---|---|---|---|
| 4e646ba0 | 1.2.3 / b47 (store) | `01a06c9f-e32e-744e-bcf6-458b0b018946` | main |
| c5f00773 | 1.2.0 / b43-44 | `01a06ca2-a6ca-7c97-9335-d5dc047026ba` | ota/c5f00773-push |
| 813c6d34 | 1.2.1 / b45 | `01a06ca4-b963-78fe-97bf-d21ce01fd4b8` | ota/813c-push |
| ccfa8345 | 1.2.2 / b46 | `01a06ca6-8112-7dd0-b4f0-98cbd6def808` | ota/ccfa8345-push |

**The correction that reorders the ledger: A14 was never BINARY.** Build 47's signed IPA
(`codesign -d --entitlements` on the Mach-O; `security cms -D` on the embedded profile) carries
`aps-environment: production`, and `expo-notifications` has been in package.json and the plugin
list since 2026-08-09 (bc50051) — i.e. in every build from 43 on. `PUSH_AVAILABLE` is true on all
four fleets, Settings → Notifications has been reachable the whole time, and the pg_cron senders
(morning edit every 15 min, receipts, prunes) are active in production. `push_tokens = 0` for six
nights because the only ask lived behind a settings switch that 51 people did not find. The
08-09 comment the lane came from ("the module is only in the binary once a store build has been
cut") was true when written and stale by build 43. Six nights of the #1 row were spent waiting
for a review cycle that was never required.

Rows moved:
- **A14 ✅ SHIPPED (OTA, not BINARY)** — a once-per-install card on Today, drawn only once
  `canGenerate` passes and iOS still reads `undetermined`: "MORNING EDIT — Tomorrow’s look, ready
  when you wake up. One note at 7:30am, nothing else." Turn on = the same `askPushPermission` the
  Settings switch calls (registers the token on a grant) + a full-set `notification_prefs` upsert
  with `morning_edit: true`, because `push_claim_morning_edit` JOINS that table and a person with
  no row is invisible to the sender. Either answer retires the card for that install. Four events
  make the ask scoreable: `push_ask_shown` → `push_ask_answered {turn_on|not_now}` →
  `push_permission_result {granted|denied, prompted}` → `push_token_registered {ok, reason?}`.
  Effect metric: `push_tokens > 0` — and now a denominator (`push_ask_shown`) to read it against.
  **APNs key verified 13:5xZ** (EAS GraphQL, `iosAppCredentials.pushKey`): key `7C8C7X2U76`,
  team `THR27ADF4P`, uploaded 2026-08-10, App Store profile active to 2027-08-06. Sends are not
  blocked on credentials. **Test push 13:5xZ** to the QA simulator's token through Expo's push
  API: ticket `ok`, receipt `BadDeviceToken` (APNs 400). That is the expected answer for a
  simulator token — APNs accepted Expo's provider JWT (a key problem would read
  `InvalidProviderToken` / 403) and rejected the token itself, because a simulator mints a
  sandbox token and the app ships to the production gateway. End-to-end delivery on a real
  device is the one thing this session cannot prove; it needs a phone. The QA account's
  `push_tokens` and `notification_prefs` rows were deleted afterwards so both tables read 0 —
  the nightly's first nonzero is a real person, not the fixture. The first real `push_sends`
  row is now purely a function of someone tapping Turn on before their local 07:30.
- **A42 ✅ SHIPPED** — the code path has three beats now: `auth_address_refused
  {invalid|offline}` (the address screen's own refusals), `auth_code_sent {resend}` (the server
  accepted; with `shouldCreateUser` this is also the moment the account row appears — which is
  exactly `ef579e79`'s state), `auth_code_entered {attempt}` (six digits submitted, BEFORE the
  request). Outcomes stay `auth_completed` / `auth_failed {wrong-code|expired-code|network}`.
  Tomorrow's loss has a name. Note for the nightly: today's arrival `070c10b5` (iOS 26.6.1, b46)
  cancelled the Apple sheet FOUR times in 105 s and entered the email door three times without
  ever submitting an address — the same 26.6.1 that produced every `apple/failed` lockout on
  08-30. `canceled` ×4 in under two minutes is not a person changing their mind; it may be the
  sheet failing and reporting a cancel. `auth-apple-diagnosis.test.ts` deliberately keeps
  cancels out of the "use email instead" escalation; worth revisiting with one more day of data.
- **A41 ✅ DONE (data half) / falsified (code half)** — the 20 QA rows (`simtestf31`,
  `sim-test+j00`) now point at objects copied under their own prefixes (40 uploads via
  `supabase --experimental storage cp`, rows rewritten 13:0xZ). `image_sign_failed` last fired
  12:58Z. **The "uncapped retry loop" framing was wrong:** nothing retries — `createSignedUrls`
  reports per-path failures inline and never throws, so react-query's retry never engages. The
  168 events over 33 h are the designed 50-minute renewal across ~4 subscriptions on one
  simulator (the booted "Cinch iPhone 17 Pro", `$app_build='1'`, signed in as fay) that was left
  running on this Mac. 1,146 signing requests in 33 h is not a bill. No cap added; the fixture
  was the defect and it is fixed.
- **A39 ✅ DONE** — `dispatch.html`, `release.html`, `welcome.html` now `width="520"` +
  `style="width:100%; max-width:520px"`, the shape `reengage.html` already had.
- **A27b — closed by the clock.** `bef15daf`'s trial ended at 13:34:42Z on its own: `effective_plan` read `pro` at 13:34:34Z and `free` at 13:34:49Z. She holds 10 garments, is now askable, and was told Sep 3 — one customer's date was a day early in the note, nobody was clamped. No further action.

Device receipt of audit ship 3 — the nightly's open question — is now proven on a THIRD fleet:
`070c10b5` (b46) installed at 03:57:32Z on the embedded bundle and fired `Application Opened` on
`01a0672d` twenty seconds later. b45 and b47 were proven yesterday; c5f00773 (b43/44) remains the
one fleet with no observed receipt of any 09-03 ship.

Keyed-Release boot gate: PASSED twice on the final bundle (xcodebuild Release + production Superwall key into the scratchpad, installed over the sideloaded "Cinch iPhone 17 Pro" app). First run: cover → email door → OTP via Resend read-back → returning-free paywall fired (note: its default button already reads "Try 7 days free — then $39.99/yr" on Standard annual, so **A12's premise that the default tap cannot start a trial may be stale**; worth one look in the Superwall editor) → Today with the reseeded closet's photographs on the plate → Morning Edit card → Turn on → iOS sheet → Allow → `push_tokens` row (an `ExponentPushToken`, minted on the simulator) + `notification_prefs` row (`morning_edit=true`, 07:30) at 13:29:02Z → card retired. Second run (fresh install, final bundle): card drawn with both actions on one baseline → Not now → retired. PostHog carries the whole chain from both runs: `auth_started` → `auth_code_sent {resend:false}` → `auth_code_entered {attempt:1}` → `auth_completed` → `push_ask_shown` → `push_ask_answered {turn_on}` → `push_permission_result {granted, prompted:true}` → `push_token_registered {ok:true}`; and `push_ask_shown` → `push_ask_answered {not_now}`. Gotcha for the next gate: a sim build with `CODE_SIGNING_ALLOWED=NO` cannot reach the keychain, so SecureStore refuses the sign-in before a code is sent ("this build can't reach the device's keychain") — build with the default ad-hoc signing.

Verifier pass (Opus, adversarial, read-only) on the diff before publish: five CONFIRMED defects in the first cut of the hook, all fixed before the gate: (1) `push_ask_shown` fired off `show` alone while the card sits behind the activation floor, offline and "nothing works" gates, and latched so it never fired when the card later drew; (2) no `useTabVisited` gate, the bug `use-tab-visited.ts` exists to prevent; (3) once-per-mount, not once-per-install; (4) the grant path composed the prefs write from a render closure that could be `undefined` and would have written defaults over an existing row; (5) a failed prefs write silently retired the card with a granted permission the sender could never see. The card now reports its own mount (`trackOnce`, visited only), the write is composed from the server via `fetchQuery` at the moment of writing, and a failed write is recorded under a pending key and retried on the next mount. Also moved `auth_code_sent` from `actions.ts` to the screens' `result.ok` branch, because the address screens race the send against an 8-second ceiling and a late success would have double-counted.

## Predictions being scored

| id | made | prediction | falsifier | due | verdict |
|---|---|---|---|---|---|
| P2 | 08-31 | Trials expiring Sep 1–14 will silently churn: <10% of expired-trial users open the app in the 7 days after expiry | ≥10% return | 09-08 first read | **strongly supported, and the 09-01 read corrected** — of 11 expired trials, 3 are internal and 1 is Nelson's own; of the **7 genuine customers, 0 returned**. 0 of 11 ever saw a paywall. |
| P3 | 09-01 | No reconciled production purchase will exist by 2026-09-14 23:59 ET | Any `asc_notifications` row with `environment='Production'` + a subscription type, **or** a non-sandbox `superwall_events` purchase | 09-14 | **on track** — re-verified 09-01 22:4xZ: 8 rows total, the only `Production` row is a `TEST`; `superwall_events` 6 rows all sandbox, 0 reconciled |
| P4 | 09-01 | Of profiles created 09-01→09-08, <55% will hold ≥1 item by 09-08 (14d clean baseline 14/31 = 45%) | ≥55% | 09-08 | n=1 real signup so far (has an item) — unscoreable. **Baseline restated on the clean denominator.** |
| ~~P5~~ | 09-01-od | *(original form)* live defect in the `ccfa8345` line | two persons × ≥10 clean imports on `ccfa8345` | 09-05 | **RESTATED 09-01n** — falsifier going stale: the fleet migrates to 1.2.3 from 18:44Z, so `ccfa8345` stops being the population. Replaced by P5b. |
| **P5b** | 09-01n | `row_write_failed` is a code defect, not device- or account-specific: it will appear again from a **different** production person | No `row_write_failed` from any person other than `ea34762e` in the window | 09-08 | **✅ CONFIRMED 09-02, six days early** — person `149268b9` (Chicago, build 47), **46 events 22:56:36–22:57:20Z**. Falsifier not met. Follow-on: the two clusters have **different causes** (Chicago = closet cap, Ludlow = unexplained) → A28 + A15 |
| **P8** | 09-02 | Of the never-charged notes sending 09-02 14:00Z, **<3 recipients open the app within 72h** — the arms-length email test the Dispatch could not run (its only responder was founder-family). *Restated 09-02 01:5xZ: the batch became 29 conversion notes (A27); denominator updated, threshold kept.* | ≥3 distinct non-internal recipients fire `Application Opened` by 2026-09-05 14:00Z | 09-05 | — |
| **P9** | 09-02 | **A real customer will see a paywall sheet within 7 days** — a prediction that Cinch *succeeds*, issued deliberately against my own pessimism bias | No `paywall_presented` from any non-internal, non-harness person by 2026-09-09 23:59 ET | 09-09 | — |
| **P10** | 09-02n | **A real customer will fire `paywall_eligible {eligible: true}`** — the narrow, mechanical half of P9; should resolve within hours of the 09-03 14:00Z wind-down if A31 lands | No such event from any non-internal, non-`$app_build='1'` person | 09-06 | — |
| **P11** | 09-02n | **The first-garment rate will not move on A28 alone.** Of real profiles created 09-03→09-10, **<60%** hold ≥1 garment by 09-10 (14d baseline 17/34 = 50%; family-excluded 14/30 = 47%) | ≥60% | 09-10 | — |
| **P8** | 09-02 | *(status 09-02n)* | — | 09-05 | **11 of 72 hours elapsed, 0 of 29 — strongly on track.** Falsification query + result printed in 09-02-nightly §8.2 |
| **P9** | 09-02 | *(status 09-02n)* | — | 09-09 | **live, and 09-03 14:00Z decides it.** Realistic denominator computed: of 30 trial holders, **23 opened in 7d, 4 in 48h, 1 in 24h** — and there is no push and no email link with which to prompt any of them |
| **P7** | 09-01n | The store lever stays untouched: `promotionalText` still `null` | Any non-null `promotionalText` on the live en-US `appStoreVersionLocalizations` | 09-03 | **FALSIFIED 09-01 23:1xZ** — set to candidate 1, verified in the PATCH response. |
| **P12** | 09-03n | **Fewer than 5 of the 29 re-engagement recipients will fire any in-app event within 72h of the 22:00Z send** — the first arms-length email test that carried a working link | ≥5 distinct non-internal recipients fire `Application Opened` by 2026-09-06 22:00Z | 09-06 | **0 of 29 at 3h.** |
| **P13** | 09-03n | **Real DAU will not exceed 6 on any day 09-04 → 09-10** — the arrivals thesis stated as a number: if the constraint is distribution, no product work this week moves it | Any single day with ≥7 distinct persons firing `Application Opened`, excluding `$app_build='1'` and geo ∈ {Cupertino, Sunnyvale} | 09-10 | 14-day series: 3 · 4 · 6 · 13 · 7 · 7 · 15 · 2 · 4 · 4 · 1 · 2 · 1 · 4 |
| **P8** | 09-02 | *(status 09-03n)* | — | 09-05 | **59 of 72 hours elapsed, still 0 of 29 — on track to hold.** Note the 22:00Z 09-03 re-send is a *different* batch and is scored by P12, not P8. |
| **P9** | 09-02 | *(status 09-03n)* | — | 09-09 | **weakened.** The blocker P9 depended on is gone (A27 executed 14:00Z) and it produced no paywall — because no eligible person opened the app. 6 days left, ~3 real arrivals/day, 0 auth completions today. |
| **P10** | 09-02n | *(status 09-03n)* | — | 09-06 | **on track to hold (i.e. I expect to be right and would rather not be).** Zero `paywall_eligible` of any kind in 30h; the mechanical precondition is satisfied and the behavioural one is not. |
| **P11** | 09-02n | *(status 09-03n)* | — | 09-10 | n=1 real profile created 09-03 (`ef579e79`), **0 items**. Running 0/1. |
| **P3** | 09-01 | *(status 09-03n)* | — | 09-14 | **on track.** `asc_notifications` 10 rows: 8× Sandbox `DID_RENEW`, 1× Production `TEST`, 1× Sandbox `TEST`. `superwall_events` 8 rows, all sandbox renewals, 0 reconciled. |
| **P6** | 09-01-od | The ops rail will not move: Dispatch No. 01 will still be `status: draft` | `list-broadcasts` shows `dd6c8ce6…` or `864e0059…` at any status other than `draft` | 09-04 | **FALSIFIED 09-01 23:17Z** — both broadcasts sent, 3 days before the deadline. The ops rail moved. |
| **P8** | 09-02 | *(RESOLVED 09-05)* | ≥3 recipients open in 72h | 09-05 14:00Z | **✅ HELD — 2 of 29.** `91ea7ed8` (Searcy, 09-04 01:52Z) and `c61b8cb0` (Georgia, 09-04 16:42Z), both confirmed Resend recipients. **Confound noted:** both landed *after* the 09-03 22:00Z second send, so these two data points are more plausibly P12's than P8's. |
| **P9** | 09-02 | *(RESOLVED 09-05)* | No `paywall_presented` from a non-internal, non-harness person by 09-09 | 09-09 | **✅ CONFIRMED, 5 days early — and it was the optimistic prediction.** Two real customers, both 09-04, both placement `trial_expired`: `91ea7ed8` 01:52:13Z and `c61b8cb0` 16:42:49Z. Corroborated server-side in `paywall_impressions`. On 09-03 I annotated this row "weakened"; the annotation was wrong and the prediction was right. |
| **P10** | 09-02n | *(RESOLVED 09-05)* | No `paywall_eligible {eligible:true}` from a real customer | 09-06 | **✅ CONFIRMED.** `91ea7ed8` 09-04 01:52:12.672Z and `c61b8cb0` 09-04 16:42:48.723Z, both `{eligible: true, reason: 'ok', placement: 'trial_expired'}` — **11h52m after the A27 wind-down**, exactly the mechanism A27 was executed to unblock. The chain A26 → A32 → A27 → A31 fired end to end for the first time. |
| **P14** | 09-05 | **Impression→PPV will not exceed 4.5% on any day through 09-12 while screenshot set v3 remains live** — the listing thesis stated as a number | Any single day with PPV/impressions ≥4.5% (total basis) with set v3 in force | 09-12 | baseline 30d **3.50%**; daily since 08-27: 2.5 · 6.1 · 1.7 · 3.2 · 2.9 · 3.0 · 5.4 · 2.6 · **1.43** |
| **P15** | 09-05 | **`push_tokens` will still be 0 on 09-12 unless A44 ships** — push is gated behind the step the funnel is losing | Any `push_tokens` row from a non-internal user while the `canGenerate` gate is still in place | 09-12 | 3 real devices on the push OTA, `push_ask_shown` = 0, all three hold 0 items |
| **P11** | 09-02n | *(status 09-05)* | — | 09-10 | **0 of 3 — strongly on track to hold.** Real profiles created 09-03→09-05: `ef579e79` (0 items), `deecb775` (0), `963e7c16` (0). |
| **P4** | 09-01 | *(status 09-05)* | — | 09-08 | **1 of 5 = 20%, on track to hold** (<55%). `48c98b00` 10 items; `cf6d222a`, `ef579e79`, `deecb775`, `963e7c16` all 0. |
| **P12** | 09-03n | *(status 09-05)* | — | 09-06 22:00Z | **2 of 29 at 40h**, falsifier ≥5. On track to hold. Both returners confirmed recipients — but see 09-05 §8.1: two returners on 09-04 is the *median* day (base rate 1–4/day, 08-31 produced four with no email at all). **The email cannot be credited.** |
| **P13** | 09-03n | *(status 09-05)* | — | 09-10 | **Holding at the boundary.** 09-04 real DAU = **6** (falsifier is ≥7); 09-05 partial = 1. |
| **P3** | 09-01 | *(status 09-05)* | — | 09-14 | **on track.** `asc_notifications` 12 rows: 10× Sandbox `DID_RENEW` (outcome `stale`), 1× Production `TEST`, 1× Sandbox `TEST`. `superwall_events` 10 rows, all sandbox renewals on one app_user_id (Nelson's), 0 reconciled. |
| **P2** | 08-31 | *(status 09-05)* | — | 09-08 | **supported.** 35 expired trials among real users; 2 returned in the 7 days after the 09-03 14:00Z wind-down (`e931d02b`, `1b35b7b6`) ≈ **5.7%**, against a <10% threshold. |
| **P13** | 09-03n | *(RESOLVED 09-06)* | any day with ≥7 real persons firing `Application Opened` | 09-10 | **❌ FALSIFIED, four days early — and it was the pessimistic claim.** Real DAU **09-05 = 10**, **09-06 = 8**. Full 10-day series: 15 · 7 · 7 · 13 · 6 · 4 · 3 · 6 · **10** · **8**. The prediction's whole point was "if the constraint is distribution, no product work this week moves it"; arrivals moved 6× with **no listing change and no build** (screenshot set v3 night 10, icon/name/keywords/promo text all unchanged). See 09-06 §17.3 — third consecutive pessimistic prediction to fail. |
| **P3** | 09-01 | *(RESOLVED 09-06)* | any `asc_notifications` row with `environment='Production'` + a subscription type | 09-14 | **❌ FALSIFIED — on the letter, and the falsifier was badly written.** 09-05 22:56:56.664Z: `SUBSCRIBED / INITIAL_BUY`, `environment=Production`, `cinch.standard.annual`, txn `60003360…`, **`outcome=applied`**, `subscriptions.current_period_end=2026-09-12 22:56:55Z`. **But `app_account_token 90dc9d33…` = `jays***@yahoo.com`, a `%saenz%` founder-family account, and `period_type=TRIAL` — $0 collected, real MRR still $0.** The falsifier named no population exclusion, so a family trial start satisfies it while proving nothing about demand. Scored falsified because a falsifier reinterpreted after the fact is not a falsifier. **Re-issued correctly as P18.** METHODOLOGY amended. |
| **P15** | 09-05 | *(RESOLVED 09-06)* | any `push_tokens` row from a non-internal user **while the `canGenerate` gate is still in place** | 09-12 | **✅ CONFIRMED — the conditional was exactly right.** Tokens stayed 0 for the entire life of the gate; A44 removed it at 09-05 17:39Z; the first real token appeared **91 minutes later** (`ab7c3624`, 19:10:24Z), the second at 23:07:24Z. Falsifier never met — no token was ever minted while the gate stood. The prediction correctly identified the gate as the sole blocker. |
| **P12** | 09-03n | *(RESOLVED 09-06 22:00Z)* | ≥5 distinct non-internal recipients fire `Application Opened` in 72h | 09-06 | **✅ HELD — 3 of 29.** Full-window query and result printed in 09-06 §8.5: `['6111e64b','c61b8cb0','91ea7ed8']`. Per-day 2 · 2 · 1, distinct union **3**, falsifier ≥5. Combined with P8 (2 of 29), the re-engagement channel has been tested twice — once linkless, once with a working link — and returned inside the base rate both times. Channel killed. |
| **P11** | 09-02n | *(status 09-06)* | — | 09-10 | **7 of 18 = 38.9%, on track to hold** (falsifier ≥60%). Denominator grew from 3 to 18 on the arrival surge, so this is now a real read rather than an n=3 placeholder. |
| **P4** | 09-01 | *(status 09-06)* | — | 09-08 | **9 of 21 = 42.9%, on track to hold** (falsifier ≥55%). 14-day first-item rate across all real family-excluded signups: **18 of 43 = 41.9%**. |
| **P14** | 09-05 | *(status 09-07, engineering read)* | — | 09-12 | **HOLDS on the two days it could not read last night: 09-05 17/429 = 3.96%, 09-06 23/663 = 3.47%**, screenshot set v3 still live. Prior note: **UNSCOREABLE 09-06 — ASC session expired.** No impression or PPV data was readable. Screenshot set v3 is confirmed still live by iTunes artwork URLs (`01-ten … 05-table`, unchanged), so the prediction's precondition holds; only the measurement is missing. Rescore on A47. |
| **P16** | 09-06 | **The arrival surge is not durable** — real daily signups fall below 4 on at least two of the three days 09-08 → 09-10 | ≥4 real (family-excluded) signups on **all three** days | 09-11 | new. Baseline: 09-01→09-04 ran 2 · 1 · 1 · 1; 09-05 = 9, 09-06 = 6. *Written deliberately against my own demonstrated pessimism bias — read sceptically.* |
| **P17** | 09-06 | **The 09-05/06 cohort will not retain** — of the 15 real signups created 09-05 00:00Z → 09-07 00:00Z, **fewer than 3** fire `Application Opened` on any day ≥2 days after their own signup | ≥3 do | 09-13 | new. Baseline: 09-05 cohort **D1 = 0 of 8**; D1 has been at or near zero since 08-29. This is the binding-constraint thesis stated as a number. |
| **P18** | 09-06 | **No arms-length production purchase** — no `asc_notifications` row with `environment='Production'` and a subscription notification type whose `app_account_token` maps to an account that is **neither internal (`%cinchstyle.com`, `demo@cinch.app`) nor `%saenz%` family** | any such row | 09-20 | new — **P3 rewritten with the population exclusion its falsifier should have carried.** Current state: 1 Production row, family, trial, $0. |

## Closed 2026-09-06

| id | item | closed with | measured effect |
|---|---|---|---|
| **A46** | Diagnose the Explore shelf's zero product opens | **✅ ANSWERED — the products are wrong, not invisible** | A46's own decision rule ("reached ≫ opened → products wrong; shown ≫ reached → below the fold") resolved on the first real traffic the new instruments saw. 6 real persons: `explore_shop_shelf_shown` **equals** `explore_shop_shelf_reached` in **every** row — the shelf is never below the fold — and `explore_shop_product_opened` is **1 event across all of history**, at 09-05 17:27:19.974Z, from the simulator's own gate run. **Zero real taps, lifetime, across three ships (A29 shelf, A30 slot mapper, audit ship 3 closet-affinity ranking).** Resource call: stop building it (09-06 §13). |
| **A44** | Ungate the push ask from the activation floor | **✅ SHIPPED AND MEASURED — the night's best ship, with a follow-on** | `push_ask_shown` **13 persons** (11 `{closet: floor}`, 2 `{closet: usable}`) → answered **2** → granted **2/2** → **two real `push_tokens` rows**, the first non-internal tokens in the project's history (`ab7c3624` 09-05 19:10:24Z, `d03875a0` 23:07:24Z). The floor gate was the blocker exactly as diagnosed. **Follow-on A48**: 11 of 13 answered neither way and session length is falsified as the cause. **Note for the founder:** both grantees hold <10 garments, so `push_claim_morning_edit` claims neither and `push_sends` is still 0 — nobody will receive a notification until one reaches ten. The "finish your ten" note A44 deliberately did not build is now the highest-value unbuilt message in the product. |
| **A19** | Make `paywall_impressions` record every paywall | **✅ CONFIRMED IN PRODUCTION** | Three `add_garment_over_limit` rows now sit in `paywall_impressions` (`a874512d` 09-05 17:46:24Z; `11e176c1` 09-06 01:40:34Z and 01:43:48Z) — the placement the table was structurally blind to before 09-05. The table also captured the first-ever `ten_completed` (01:39:33Z) and `reveal_complete` (09-05 23:07:12Z) impressions. |
| **A45** | Second door after a cancelled Apple sign-in | **✅ LIVE IN PRODUCTION — 3 real impressions** | `auth_cancel_hint_shown` fired for **3 real persons** in 4 days; `auth_cancel_hint_taken` **0**. Wire proven on real devices, which the simulator could not do (no Apple ID). `auth_failed{canceled}` 10 events / 6 persons in the same window. Too early to score the recovery rate; baseline remains 8 of 11. |

## Killed 2026-09-06

| id | item | killed | reason |
|---|---|---|---|
| — | **Organic content test** (kill-criteria week 5) | 09-07 gate reached | Best post 41 views, **0 attributable installs, no posts since 08-28 (10 days)**. Five weeks, one metric, never run. This would have been the fourth extension of a row with no work behind it. Killed on the gate per the 09-05 recommendation. |
| — | **The re-engagement email channel** | 09-06 | Two sends (09-02 14:00Z, 09-03 22:00Z), 58 delivered messages, one with no link and one with a working one. **P8 held (2 of 29) and P12 held (3 of 29 across the full 72h window, falsifier ≥5).** Both results sit inside the ordinary 1–4/day returner base rate. The channel has now been tested twice and produced nothing distinguishable from noise. Stop issuing ledger rows for it. |

## Closed 2026-09-05

| id | item | closed with | measured effect |
|---|---|---|---|
| **A8** | Attach `ten_completed` / `returning_free` to live Superwall campaigns | **✅ PROVEN IN PRODUCTION** — the campaign half is no longer unread | Two real customers were served a paywall on the `trial_expired` placement (09-04 01:52Z, 16:42Z) and `returning_free` presented on the 09-04 gate build. The campaign layer resolves, renders and presents. Four nights of "dashboard unread" answered by production behaviour instead. |
| **A14** | Push permission + token capture | **✅ SHIPPED (OTA, not BINARY) + device receipt PROVEN** | OTA `01a06c9f-e32e-744e-bcf6-458b0b018946` running on 3 real devices. `push_tokens` still 0 — **but the denominator is 0**: the card is gated on `canGenerate` and all three users hold 0 items. Not a failed ship. Continued as **A44**. |
| **A41** | Reseed the QA closets / cap the signing retry | **✅ DONE — verified by absence** | `image_sign_failed` does not appear in the 14-day event stream at all. On 09-03 it was the single largest event stream in the product (112 events / 768 failed requests). Gone. |
| **A42** | Instrument the email sign-in code path | **✅ SHIPPED, awaiting a real user** | `auth_code_sent` / `auth_code_entered` fire correctly on the gate build (`9b4a86d2`, 09-04 13:27Z and 13:30Z, both full chains). **No real user has used the email door since the ship** — every arrival 09-04/09-05 came through Apple. The instrument is live and untested by a customer. |
| **A43** | Fix the competitor tracking list | **✅ DONE** | Corrected by-track-id table in use, 09-05 §9. Alta Daily 13,963 (+100 in 2 days) · Dressly 29,556 (+73) · Cinch 6 (+0). Pureple/Combyne/StyleDNA returned no US result this run — flagged. |
| **A39** | HTML templates overflow a 375px viewport | **✅ DONE 09-04** | `dispatch/release/welcome.html` now `width="520"` + `width:100%`. |
| **A27b** | One trial holder outside the clamp | **✅ CLOSED BY THE CLOCK 09-04 13:34Z** | `bef15daf`'s trial ended on its own; `effective_plan` pro→free across 13:34:34→13:34:49Z. Nobody was clamped; one note carried a date a day early. |

## Done

| id | issued | item | lane | predicted effect | closed | measured effect |
|---|---|---|---|---|---|---|
| A1 | 08-31 | Account Holder accepts updated Apple Developer Program License Agreement | OPS | Unblocks all binary submissions | **09-01 ✅** | Free Apps Agreement Active eff. Aug 31 2026; 1.2.2 build 46 approved <1h and READY_FOR_SALE. |
| A2 | 08-31 | Decide the trial: drop the auto-gift, or convert to a real StoreKit intro offer | OPS→BINARY | Creates the first-ever path to a production purchase | **09-01 ✅** | Migration `20260901014553` applied. ASC carries a 7-day FREE_TRIAL on `cinch.standard.annual`, 175 territories. **Confirmed working 09-01-od:** the day's one real signup (`5184643a`) has `trial_ends_at = null` — the server no longer gifts a trial. |
| A3 | 08-31 | Add a paywall path not dependent on the Reveal | OTA | `paywall_presented` > 1/day | **09-01-od ✅** | Both OTAs published **and confirmed serving**: production `Application Opened` events carry `01a05b05…` (runtime ccfa8345) and `01a05b0d…` (runtime 813c6d34). First production `paywall_presented` since 8/30 fired today — but via the pre-existing `add_garment_over_limit`, not the new placements (→ A8). |
| A6 | 08-31 | Founder decision: should outfit cores require footwear? | OPS | Shoeless closets get outfits instead of a zero | **09-01 ✅** | `150a7a5`: `outfits = (tops×bottoms + dresses) × max(shoes,1)`. |
| A13 | 09-01 | Instrument where signup→first-item stops | OTA | A named drop-off step | **09-01-od ✅ closed — but its framing was DOWNGRADED 09-01n §17.1: `closet_floor_shown` is not an empty-closet event (fires for users with 123 items), so the step name is a HYPOTHESIS. The *loss* stands on Supabase: 31 real 14-day signups → 14 with ≥1 garment.** | The events already existed. Of 31 who fired `closet_floor_shown`, **13 fired `clothes_import_selected` and 18 never did** (14 selectors total, 14d, per person, 16 devices excluded). Supabase agrees: 31 real signups → 14 holding ≥1 item. |
| A25 | — | **1.2.3 / build 47 approved and released** | BINARY | — | **09-01n ✅ (Apple's doing, not ours)** | Submitted 2026-09-01T04:08Z, `READY_FOR_SALE` **18:44:53Z — 14h37m end-to-end.** Carries the library door, the persisting category edit, bounded catalogue titles, the flicker fix and the one-ask rating window. **Does NOT contain a fix for `row_write_failed`** (submitted 9h before the defect was found). |
| A10 | 09-01 | Grant Savannah the free year of Pro promised 8/30 | OPS | Founder promise kept | **09-02 ✅ verified in DB** | `subscriptions` reads `plan='pro'`, `current_period_end=2027-09-01`. Reply delivered 23:08Z. |
| A11 | 09-01 | Reply to both 5★ App Store reviews + to Savannah | OPS | Zero unanswered contacts >48h | **09-02 ✅ verified in ASC** | `customerReviews?include=response`: both now `answered: true`. Support inbox clean. First night with zero unanswered customer contacts anywhere. |
| A17 | 09-01-od | Enable Resend tracking, seed-test a relay, send Dispatch No. 01 | OPS | First message Cinch has ever sent | **09-02 ✅** | 23 recipients 23:17Z + 13 relay redeliveries 23:39Z, all `delivered`. **Effect: 1 of 23 acted, and that 1 is founder-family — HYPOTHESIS only, see 09-02 §8.2.** Real test is P8. |
| A22 | 09-01n | Set `promotionalText` — it is `null` and has never been set | ASC | First deliberate ASO variable moved | **09-02 ✅ verified live** | Candidate 1 verbatim on the live 1.2.3 en-US localisation, re-read independently tonight. Falsified P7. **Unmeasurable until A21.** |
| A26 | 09-01 | Register `mail.cinchstyle.com` with Apple Private Email Relay | OPS | 14 of 37 real accounts become emailable | **09-02 ✅ delivery proven** | Post-registration seed delivered 23:30Z; 13 owed copies redelivered 23:39Z; all 14 contacts restored. Residue: SPF TXT (`v=spf1 include:amazonses.com ~all`) still to add on apex + mail. in Cloudflare; delivery works on DKIM regardless. |

## Killed

| id | issued | item | killed | reason |
|---|---|---|---|---|
| P1 | 08-31 | Impression-decay prediction | 09-01-od | Unscoreable on two consecutive runs — ASC has been unreadable both times. A prediction that cannot be measured is not accountability, it is decoration. Re-issue the same claim the night ASC reads. |
| **A16** | 09-01-od | The ten-minute paywall grace after a failed import | 09-02n | **Wrong, and it was my row.** Every `AddGarmentOverLimit` presentation in the source is a user tap, so the grace silenced a paywall the user asked for; it was per-process, not per-user. Reverted by the 09-02 audit (F-A16) and replaced by A28's failure classification. Full account in 09-02-nightly §17.1. |
| **A4** | 08-31 | Re-cut first screenshot + icon for tap-through | 09-02n **recommended** | **Night 6, gate 09-03, and unscoreable until A21 lands.** Six consecutive nights lost to work with measurable effects is itself the verdict. Killed on effort grounds, not measurement grounds — the caption copy is preserved in 09-02-nightly §11.4 and the row should be re-issued the night ASC reads. Awaiting founder confirmation (§12.3). |
| A5 | 08-31 | Enable Vercel Web Analytics | 09-01n **recommended** | **Thirteenth ask.** Re-verified off via API 09-01 22:5xZ (`web_analytics_not_enabled`). Twelve unanswered asks is itself the answer. Web Referrer installs are permanently **unread**; state that in Data Gaps and stop spending a ledger row on it. Awaiting founder confirmation (09-01n §12.3). |
| — | 08-10 | Organic-content test (kill-criteria week 4, gate Sep 7) | 09-01-od **recommended** | Best post 41 views, 0 attributable installs, no posts since 8/28. The gate will be missed on a test that was never run; extending it costs another week. Awaiting founder confirmation (§12 item 4). |
