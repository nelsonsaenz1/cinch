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
| **A14** | 09-01 | **Ship push permission + token capture** | BINARY | `push_tokens` > 0 | **night 6 — TONIGHT'S #1, and the only row that moves the 09-03 thesis** | `push_tokens` 0 · `notification_prefs` 0 · `push_sends` 0, re-verified 09-03. Proof of consequence: the 14:00Z trial wind-down freed 37 accounts and **reached one person in eleven hours** (`901a935d`, Grand Rapids, 13-second session, no auth). Also gates the daily-streak mechanic identified in 09-03n §9. |
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
| **A23** | 09-01n | Ask users to invite (one prompt after `closet_ready`, one after first `outfit_reacted`) | OTA | `invite_shared` > 4 | **new — highest-yield unused mechanic** | 4 shares ever, by 3 people, **3 converted (75%)**; the app's only 5-day-retained user came through it. K ≈ 0.10 |
| **A24** | 09-01n | Gate or seed Daily Social so nobody opens an empty screen | ~~OTA~~ → **FOUNDER** | `daily_social_empty` / `daily_social_opened` < 1.0 | **REFRAMED 09-02n — this is not a defect** | audit F-DATA-6: every `daily_social_empty` carries `reason=nobody_sharing`; **1 of 50 profiles has sharing on, 6 follow rows, 0 reactions.** The surface already renders a "go first" hero. The only lever is the sharing DEFAULT, which the privacy constitution puts OFF. **Recommendation: do not flip it** — hide the Day section until ≥1 friend shares, and stop counting `nobody_sharing` as a defect |
| **A34** | 09-02n | **`explore_shop_feed_loaded` fires ungated inside a react-query `queryFn`** (`use-shop-feed.ts:61`, `use-partner-feed.ts:48`) — gate on visit | OTA | The event counts shelf visits, not launches and refetches | **new — A29's baseline is contaminated by it** | audit F-AN-1. I used this event three times on 09-02 (40 → 24 → 24) as the shelf's verification instrument; it was a valid *sim* check of the wire, never evidence anyone looked |
| **A32** | 09-02n | **Ship A20's universal links, then re-send the conversion note with something tappable in it** | OTA/web + OPS | Any in-app event attributable to an email recipient — currently zero | **half built 09-03, BLOCKED on a web deploy + founder approval** | Web half written and not deployed: AASA claims `/closet` (a **real app route**, so no binary and no OTA — the `applinks:cinchstyle.com` entitlement is host-scoped and already in build-47 source), `web/vercel.json` rewrites it, `web/api/open.js` answers for anyone without the app. Email half built: 29 personalised notes, two cohorts, one CTA at `https://cinchstyle.com/closet`, seeds delivered 12:07Z. **Live site still 404s on `/closet` and the live AASA still claims only `/i/*`.** Falsification of the 09-02 zero re-run 09-03 12:0xZ: 27 of the 29 recipients resolve as PostHog `distinct_id`s, 2894 events historically, **max timestamp 09-02 06:59:20Z — before the 14:00Z send.** Still 0 of 29 at 15h. |
| **A37** | 09-03 | **`APP_LIVE` is not set in Vercel — every invite tap lands on a waitlist** | OPS (env) | The referral loop's CTA reaches the App Store instead of `/#waitlist` | **new — found while building A32, and it is the cheapest fix on this list** | `web/api/invite.js:56` gates the store link behind `process.env.APP_LIVE === '1'`. Fetched 09-03 with an iPhone UA, live `/i/<handle>` renders **"Join the list" → `cinchstyle.com/#waitlist`** while `itunes.apple.com/lookup?id=6798479578` returns `resultCount: 1`. A23 wants more invites; those invites have been pointing at a waitlist the whole time. |
| ~~**A38**~~ | 09-03 | **No universal link has ever been verified opening the app on a real device** | OPS | — | **RESOLVED 09-03 — and it was NOT the entitlement.** Build 47's signed IPA entitlements carry `com.apple.developer.associated-domains = ["applinks:cinchstyle.com"]` and its embedded provisioning profile allows associated-domains (`*`) — read from the binary by the engineering session, so the EAS capability-sync fear in `app.config.ts:180-198` never materialised. Apple's CDN also serves the `/closet` component (`app-site-association.cdn-apple.com/a/v1/cinchstyle.com`). | **The real constraint is the DEVICE-side AASA cache.** iOS fetches a domain's AASA at app **install/update** time and otherwise only on a slow periodic schedule; **an OTA update is not an install.** Every phone that installed Cinch before 09-03 still holds a cached AASA without `/closet`, so the universal link will not fire for them — they land on `web/api/open.js`. `/i/*` still deep-links for everyone because that component has been in every cached copy since 08-10. Clears itself on the next App Store build (every updater re-fetches). Mitigated meanwhile by the `cinch://closet` door added to the fallback page. |
| **A40** | 09-03 | **Give the `/closet` fallback page a `cinch://` door** — a recipient who already owns Cinch was being shown "Get Cinch" | OTA/web | A recipient with the app installed reaches their closet, not the App Store listing | **✅ SHIPPED + verified live 09-03** | Found by reasoning through A38's cache finding: with a stale AASA, every installed recipient lands on the fallback and the page's only action told them to install an app they already have. Page now leads with `cinch://closet` (resolves via expo-router default matching to `src/app/(tabs)/closet.tsx`; scheme `cinch` at `app.config.ts:139`, no `+native-intent` to intercept) and keeps the App Store as an explicit secondary, because a custom-scheme link is inert when the app is absent and must never be the sole action. |
| **A39** | 09-03 | **All three HTML templates overflow a 375px viewport** | OPS (copy) | Email renders inside the phone it is read on | **new — `reengage.html` fixed, the other three are not** | `dispatch.html`, `release.html` and `welcome.html` set `width="600"` with only `max-width:520px` and no `width:100%`, so the card is 520px wide on a 375px phone. Rendered and screenshotted 09-03 at 375×812. **Dispatch No. 01 was sent that way to 23 people on 09-01.** |

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
  **One thing still unverified:** whether the APNs `.p8` is uploaded to Expo. That gates SENDS,
  not token capture; the signature if it is missing is `push_token_registered {ok:false,
  reason:'mint'}` after a grant. Founder: `eas credentials --platform ios` → push key.
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
