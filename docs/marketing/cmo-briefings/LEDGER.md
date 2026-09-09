# Action & prediction ledger

Every "Tomorrow's focus" item and every directive lands here the night it is issued.
Nothing leaves this file until it is **done → effect measured** or **killed with a
reason**. The nightly briefing scores this file first — an open item older than 3
nights must be escalated or killed, never silently reprinted.

Format: `| id | issued | item | lane | predicted effect | status | measured effect |`
Lane: OTA (ships in minutes) · BINARY (Apple review) · ASC (metadata/config) · OPS (no code).

## ⏭ READ FIRST — carry-forward for the 2026-09-09 nightly (founder handoff, 09-08 ~22:1xZ)

Four reads that belong to **tomorrow's** session, not to the 09-08 one. None was measurable at
publish time. Do not score any of them off 09-08 data.

| # | read | why it was not readable on 09-08 | where |
|---|---|---|---|
| **1** | **Device receipt of audit ship 7's four update ids** — `01a083b4` (store) · `01a083b6` (b43/44) · `01a083b8` (b45) · `01a083ba` (b46), all manifest-verified at publish | **Nobody had opened the app on them yet — normal for a US night.** An absence here at publish time is not a failed ship. | PostHog `Application Opened` grouped by `properties.$update_id`, excluding `$app_build='1'`. Confirm all **four** fleets, per [[cinch-fleets-and-reach]] — three is the recurring error. |
| **2** | **P23's first post-ship ten-piece closets** — do single-category closets fall below 15%? | A59 shipped *after* the 09-08 briefing. **n = 0 post-ship closets exist yet.** P23 requires n≥8; do not score early, and do not read a small early number as a trend (the P4/P11 lesson). | Supabase: real accounts reaching 10 garments with `created_at` after the ship, `count(distinct category)`. |
| **3** | **Has the floor→paywall-within-a-minute path gone to zero?** | The A59 ship changed where a full, undressable closet routes: Today now sends it to `/the-ten?door=photograph` (TenRepair over the live grid) instead of the add door — which at the free ceiling **was** the `add_garment_over_limit` paywall. | `paywall_impressions` where `placement='add_garment_over_limit'`, and the elapsed gap from the user's 10th item. **Baseline to beat: `11e176c1`** (ten_completed 01:39:33Z → `add_garment_over_limit` 01:40:34Z and again 01:43:48Z — **61 seconds**) and **`a874512d`** (signup 17:28Z → paywall 17:46Z). **Target: zero.** |
| **4** | **P11 on 09-10 and P17 on 09-13** — both fall due, neither is scoreable before its date | P11 is at 16/26 = 61.5% with a ≥60% falsifier and **one non-adder un-falsifies it** (16/27 = 59.3%). P17's lower-bound proxy is 1 of 13, falsifier ≥3. | Score on the due date only. METHODOLOGY: *"do not declare a prediction falsified before its due date if its cohort can still grow."* |

**Also settled after the 09-08 briefing shipped, so its §7 and §17.9 are already partly stale:**
**A12 CLOSED by founder ruling** — every campaign variant routes to paywall 254200, and Standard
annual's 1-week trial has been on the default button since the 09-01 update. The §17.9
contradiction is dissolved in favour of the boot gate's reading, not A12's. **P22 accordingly
scored FALSIFIED** on the re-dated 09-01→09-08 clock: **0 arms-length trial starts across 10
real paywall impressions.** So the ask *was* being made, with a trial, and nobody took it —
which is the opposite of §7's "the monetization question is currently unasked," and the next
thesis has to start from there.

---

## Open

| id | issued | item | lane | predicted effect | status | measured effect |
|---|---|---|---|---|---|---|
| **A60** | 09-08n | **⚠️ Condition 5 (blended ARPU ≥ $11) STOPPED being reachable on 2026-08-31 — rewrite the bar, and state which ARPU convention it means** | OPS — founder, tonight | The 1 Nov Five-Conditions verdict stops being scored against a bar the price list cannot clear | **new — TONIGHT'S ALERT and the most consequential row in the file** | Superwall → Products & Entitlements (`/applications/52618/products/v2`), read 2026-09-09 ~00:0xZ, footer *"All products imported from App Store Connect"*: `cinch.standard.monthly` **$4.99/mo** no trial · `cinch.standard.annual` **$39.99/yr, 1wk trial** · `cinch.pro.monthly` **$9.99/mo** no trial · `cinch.pro.annual` **$79.99/yr** no trial. **Amortised ceiling $9.99 gross / $8.49 net @85%.** ⚠️ **The condition was REACHABLE when written (08-24): Pro was $14.99/mo = $12.74 net.** Commit **`50c3ca4`, 2026-08-31 21:49**, repriced `$14.99→$9.99`, `$119→$79.99`, `$59→$39.99` and silently invalidated it; `handoff/d-decisions/DIRECTIVE.md:35` records the $14.99 read from ASC itself, so the old prices were **shipped, not planned**. Three falsification attacks run: a fifth product / two concurrent subs (**fails** — all four are in one ASC subscription group, `docs/superwall/asc-products-directive.md:24`); a 30% Apple rate (**fails** — lowers the ceiling to $6.99); cash-booked vs amortised ARPU (**LANDS** — on cash booking a month with one annual sale clears $11, so the claim binds only on amortised MRR, which is the convention 09-01's "4,500 payers at $11" implies but never states). Downstream: $50K **MRR** needs **5,005** payers at the gross ceiling (not 4,500, and not 5,890 — MRR is gross); **~$43 LTV is void** and must be rebuilt before it is quoted. **Recommendation: (a) rewrite to blended net ARPU ≥ $5.50 — cleared by pro.monthly ($8.49) and pro.annual ($5.67), NOT by standard.monthly ($4.24) or standard.annual ($2.83); (b) state the convention as amortised MRR; (c) do NOT reprice until A12 has presented a trial-bearing button once.** Memory `[[cinch-subscription-products]]` amended; `docs/ai-models-and-tiers.md` §163/§171 still stale. 09-08 §17.1. |
| **A64** | 09-08 ADDENDUM 2 | **⚠️ Split the 09-05/06/07 arrival surge into PAID vs ORGANIC — it has never been done and could not have been done** | OPS — one ASC view | The four-night arrival narrative gets its first attribution that can tell an ad from a search | **new — TONIGHT'S #1. Supersedes the acquisition half of every thesis since 09-06.** | **Apple Ads is LIVE:** two Running US campaigns, `CIN-EXP-003_US_SR_EXACT_…` ($14/day, $88.57/7d, **$3.05 CPA**) and `CIN-EXP-003_US_SR_DISCOV…` ($6/day, $42.73/7d, **$6.10 CPA**); total **$20/day, $131.30/7d, $3.65 avg CPA**, placement **Search Results**. **Apple Search Ads on Search Results is reported by ASC Source Type as `App Store Search`** — so A47's "the surge was 100% App Store Search" cannot distinguish paid from organic and never could. Paid capacity at $20/day ÷ $3.65 ≈ **5.5 installs/day**; the surge above a ~3/day baseline was **+6, +4, +7** on 09-05/06/07. Same order of magnitude. **Run: ASC → Acquisition → Campaigns (or Metrics `groupByDimensionKey=campaignId`), measure `units`, daily, d30.** Scored by **P26**. |
| **A65** | 09-08 ADDENDUM 2 | **Close the stale "Open an Apple Search Ads account" row and reconcile the four weeks it was wrong** | OPS | The ledger stops asserting a thing that is contradicted by the world | **new — CLOSE ON SIGHT** | The row (founder queue §12.7 in the 09-08 briefing, "29 nights since 08-10") asked the founder to open an account **that exists and has been spending.** Also unblocks **A52**: Search Ads popularity scores were the stated gate on the en-US keyword swap, and the account that provides them has been available the whole time. Same failure mode as **§17.9** (A12) — a row kept alive because nobody checked whether the world had moved. |
| **A66** | 09-08 ADDENDUM 2 | **Every lettered sweep section A–G must print a line, including "nothing to report"** | OPS — METHODOLOGY | An omitted section stops being indistinguishable from a section with no news | **new — process defect, amended in METHODOLOGY tonight** | The 09-08 nightly **skipped §F (Channels: TikTok, Instagram, Pinterest, paid) entirely**, and neither the author nor **two adversarial fact-check passes** caught it — because there was no heading to notice the absence of. Cost: a $20/day channel unread for four weeks and a §13 that said *"Nothing else is being spent, and nothing else needs to be."* |
| **A62** | 09-08 ADDENDUM | **Move the push card into the first viewport** — 13 of 19 real people never had it on screen | OTA | `push_tokens` reaches ≥5 within 7 days (**P25**) | **new — the cheapest measured win in the file, and A48 bought it** | **A48 ANSWERED.** Real persons, 5d, exclusions applied: `push_ask_shown` **19** → `push_ask_seen` **6 (32%)** → `push_ask_answered` **2 (33% of those who saw it)** → granted **2/2** → `push_token_registered` **2**. Reconciles exactly with Supabase `push_tokens`=2 and `notification_prefs`=2. Un-excluded reads 22/8/5/4/4 — the extra two grants are audit ship 6's simulator boot gate. **The 13→2 gap is VISIBILITY, not indifference; the "seen-and-ignored" hypothesis held open since 09-06 §8.3 is dead.** A 33% answer rate on a 32% seen rate means the ceiling here is roughly 4 more tokens per 19 arrivals — tripling the push channel in one OTA ship. Does **not** on its own unblock the finish-your-ten note: A59b's constraint (neither grantee holds ten garments) still stands. |
| **A63** | 09-08 ADDENDUM | **Diagnose the five real `auth_failed{reason:'failed'}` persons** — not an alert, a look | OTA | The largest single funnel drop (9 of 37 starters) gets a named cause | **new — deliberately NOT an alert** | 7d real: `auth_failed` 19 events / 10 persons, decomposed **`canceled` 12/8 · `failed` 11/5 · `wrong-code` 3/2**. A45 established 09-05 that a cancel is friction not a lockout (8 of 11 cancellers completed seconds later), so the population of concern is **5 people**, against 37 starters. `auth_completed` is **75.7% (28/37)** — the healthiest this funnel has read. The 08-30 briefing's retracted alert was this exact event read without its `reason` breakdown; not repeating it. |
| **A61c** | 09-08 ADDENDUM | **`zero_reason` is not being written on `reveal_phase phase=zero`** | OTA | An honest zero becomes classifiable (unpairable / unread / no_consent / query_failed) instead of a bare word | **new — instrumentation defect, and it is what blocks A61b** | 14d real `reveal_phase` by person: **arriving 6 → counting 4 → cascade 4 → settled 4 → complete 4**, plus **zero 2** — and **both `zero` rows carry no `zero_reason`.** The property exists precisely to distinguish an honest zero from a failed read (`reveal-zero-core.ts: classifyZero`), and it is absent. Until it is written, **A61b (`d03875a0`'s one-garment Reveal) cannot be answered**, because there is no way to tell whether he saw a true `unpairable` arithmetic or the wreckage of a failed wardrobe read. |
| **A59** | 09-08n | **Make The Ten ask for a SPREAD, not a count** — the counter must name the missing half while the closet is being built, not congratulate at ten | OTA | Single-category closets fall below 1 in 6 among post-ship ten-piece closets (**P23**) | **new — TONIGHT'S #1 product row. A55 was asking the wrong question (§17.5)** | **2 of 15 real ten-piece closets are genuinely single-category and can never be dressed** — `a874512d` (10 bottoms across 4 subcategories: denim shorts / jeans / flare / wide-leg) and `bae15db5` (10 tops across 5: t-shirts / hoodies / polos / sweater). **2 of the last 5.** ⚠️ **The first draft said 4 of 15; two of those four (`ced245be`, `48c98b00`) are an UNTAGGED-intake defect, not composition — see A61.** Falsification held for the two that remain: varied subcategories, specific colours and descriptions, so the classifier did not collapse them. Neither clears `canGenerate`, so **the Reveal door on Today (`src/app/(tabs)/index.tsx:1039`) never opens for them.** Paste-ready copy in 09-08 §11.5. |
| **A59b** | 09-08n | **Tell the nine** — nine real people hold a ten-piece closet and have never seen an outfit; **four** of them clear `canGenerate` right now | OTA | `outfit_generation` rises from a population that already earned it; a Today card, **not** a push | **new — the largest keepable loss in the product** | Of 15 real closets ≥10 garments: **6 have ever generated an outfit**; **4 have `profiles.reveal_seen_at` set** (`77d25934`, **`d03875a0`**, `11e176c1`, `c34290ab`). **10 clear `canGenerate`** on the wardrobe-eligible basis (`status in ('tagged','needs_review','verified')`, unarchived — `queries.ts:152`; `c646253d` shows 18 items but holds 5 eligible), **and 4 of those 10 have never generated.** The Reveal door is offered only while `revealNeverSeen` and nothing has ever gone out to say it is waiting. Push is not the channel: 2 tokens, **0 sends, 0 receipts**, neither grantee qualifies. |
| **A61** | 09-08n | **24 real garments are stuck at `pending_tag` and their owners read as activated** | OTA/OPS | Two ten-piece closets that cannot be dressed become dressable; the activation metric stops counting closets the engine cannot see | **new — found by the fact-check inside A59's own query output, not by the sweep** | `ced245be` (**11 of 11**) and `c646253d` (**12 of 18**) hold rows at `status='pending_tag'`, `category='other'`, `subcategory`/`description` NULL. `useWardrobe()` filters `pending_tag` out, so those rows do not count toward `canGenerate`'s eight — `c646253d` shows 18 items and holds **5** eligible. Both accounts are counted as ten-piece closets by every metric in the briefings and neither can generate. **Distinct from A53** (which is `tagged`-not-`verified`, i.e. tagged but unconfirmed); this is *never tagged at all*. Root cause unknown — batch write that outran the tagger, a consent gate, or a failed queue. |
| **A61b** | 09-08n | **A one-garment closet was delivered a Reveal and then a paywall** | OTA — one look at the zero path | Either the honest-zero exit is stamping too readily, or a completion is being offered over a closet that cannot make one | **new** | `d03875a0` holds **one** item (a dress), has `reveal_seen_at = 2026-09-05 23:07:10.349Z`, and a `reveal_complete` paywall impression **two seconds later** at 23:07:12.989Z. `reveal-zero-core.ts: mayStampSeen` should stamp only on `complete` (requires `zeroReason === null`) or a deliberate exit from an `unpairable` zero. He ran **zero** `outfit_generation` calls, so no outfit existed. He is also one of the **two** push-token grantees, which makes him disproportionately expensive to have disappointed. |
| **A12** | 09-01 · **ESCALATED 09-07n · PRICED 09-08n** | **Put the trial-bearing product on the paywall's default button** — and tonight the ask has a number | ASC/config — **founder decision, night 9** | ≥1 arms-length Production trial start within 7 days of shipping (**P22**) | **✅ CLOSED 2026-09-09 — founder ruling: "close A12 on the gate's evidence." See Closed 2026-09-09.** *(status as of 09-08n follows)* night 9 — and it is worse than "carries no trial." | Paywall 254200's default is `proAnnual` = **$79.99/yr with NO introductory offer**. Only `cinch.standard.annual` ($39.99/yr) carries the 7-day trial. **Ten real impressions across eight real persons, lifetime, zero purchases** — every one of them shown the highest price in the category behind the least free runway in the category: Alta free, Whering free, Acloset free to 100 items, **Indyx $74.99/yr behind a 14-day preview PLUS a 7-day trial**, Stylebook **$4.99 once, no cap**. ⚠️ **Open contradiction:** the audit-ship-6 boot gate (09-07, this file) observed the returning-free paywall's default button reading *"Try 7 days free — then $39.99/yr"*. Either the default differs by placement or A12's premise is stale. **Resolve in the Superwall paywall editor before shipping** — 09-08 could not open 254200's product config under automation. |
| **A55** | 09-07n | **Find out why fifteen ten-piece closets produced two outfits today** — diagnose the route from a usable closet to a Reveal before building anything | OTA (diagnosis first) | `outfit_generation` clears 10 calls on a day by 09-11 (**P20**) | **new — TONIGHT'S #1 product row.** The payoff the whole funnel exists to deliver is running at two events a day | `ai_calls`: `outfit_generation` **2 · 2 · 2** on 09-05/06/07, flat, while `tagging` ran **13 → 29 → 47** (0 failures, 2.45 s mean, $0.044/day). 15 real closets hold ≥10 garments. People are cataloguing and not being dressed. |
| **A54** | 09-07n | **Give A23's audience a handle** — a profile with no handle lands on "Choose a handle first" instead of a share sheet; seed one, or collect it inside the invite card's own flow | OTA | `invite_shared` > 4 becomes reachable for the majority of the card's audience | **new — surfaced by audit ship 6's own boot gate on the night A23 shipped** | **11 of the 15 real ten-piece closets have no handle = 73%** (Supabase, family/internal/gate excluded). **Three quarters** of the card's audience meets a second step before the share sheet. K = 0.10; 4 shares ever, 3 people, 3 converted (75%). |
| **A53** | 09-07n | **Verify tag quality on the 130 unconfirmed garments** — 43% of imported items were never confirmed by their owner | OTA/OPS | `items.status='tagged'` share falls; silent wrong tags stop eroding trust in the closet | **new** | 14d real intake: **174 `verified` / 130 `tagged` / 1 voice-verified = 305 total**, 0 catalog. `tagged` share **130/305 = 42.6%**. Category context: auto-tag accuracy is the #4 complaint by distinct sources across competitors (*"correct about 50% of the time"*). |
| **A12** | 09-01 · **ESCALATED 09-07n** | **Put the trial-bearing product on the paywall's default button** — only `cinch.standard.annual` carries the 7-day FREE_TRIAL offer; Superwall paywall 254200 defaults to `proAnnual`, which has none | ASC/config — **founder decision, night 8** | The default tap can actually start a trial; install→paid becomes interpretable | **night 8 — the LAST mechanical excuse between an ask and a purchase.** Every other blocker (A27 gag, A8 campaigns, A19 measurement, the production rail) is cleared and proven. | **9 real paywall impressions across 8 real persons, lifetime, 0 purchases.** 3 in the last 24h on 3 *distinct* placements (`trial_expired` `d49bfa3c` 18:32:01Z · `ten_completed` `c34290ab` 21:00:49Z · **first-ever `packing_access`** `52ff5b6d` **09-08 00:14:33Z**). Superwall Production 24h: 13 users, **paywall rate 15.38% = 2 of 13** — the third impression is stamped 09-08 and fell outside Superwall's window (lifetime range had been 0–4.35%), $0. Competitive context: Indyx, the only competitor charging a real subscription, gates $74.99/yr behind a **14-day preview + 7-day trial**. |
| **A56** | 09-07n | **Cut a build** — nothing uploaded since 08-31; A4 and A52 are both version-locked | BINARY | One action unblocks both of the rows this briefing keeps pointing at (A4, the oldest open row in the file, and A52, prepared today) | **new — founder action, ~1 hour** | `/iris/v1/builds` 09-07: latest is **47, uploaded 2026-08-31T20:58Z**, all versions `READY_FOR_DISTRIBUTION`, **nothing in review, no ASC banners, no agreement blocks**. A4 is night 11; A52 is prepared, tested and waiting. |
| **A58** | 09-07n | **Reconcile the live annual price before the 09-12 charge** — Superwall's transaction row says `$39.99/yr`, the product memory and every LTV figure in this file say `$59` | OPS — founder, minutes | Every ARPU / LTV / install→paid-value figure in this file's history rests on a price nobody has verified in weeks | **new — RESOLVE BEFORE 2026-09-12 22:56Z** | Superwall Recent Transactions, read 09-07: **"Cinch Membership v3 · $39.99/yr, 7d trial"** for `90dc9d33`. `subscriptions` says `plan='standard'`. [[cinch-subscription-products]] records the four ASC products as $7.99/mo · **$59/yr** · $14.99/mo · $119/yr. Three sources, two prices, no reconciliation. Also resolve the two State-of-Record disputes with it: en-US keywords **100 vs 98** chars, promotional text **131 vs 39** chars — A52's keyword arithmetic depends on the free-character count. |
| **A9** | 09-01 | Read `outfit_reactions` in the ranking path; delete or wire `style_feedback` | OTA | A "hate" removes an outfit from rotation | **night 7 — KILL RECOMMENDED 09-07n, awaiting founder confirmation** | 43 reactions / 8 users / **0 readers**, unchanged for seven nights. `style_feedback` and `tag_corrections` are both **0 rows**. No arriving user has reacted to anything in a fortnight, and `outfit_generation` is running at 2 calls/day — there is nothing to rank. **Re-issue the night A55 produces Reveal volume**, not before; ranking work with no outfits is work with no denominator. |
| **A18** | 09-01-od | Give the Today tab something of the user's before they have a closet | OTA | `clothes_import_selected` rises toward `today_opened` | **night 6 — KILL RECOMMENDED 09-07n, awaiting founder confirmation** | Its metric is being met by other means. Baseline when written: today_opened 35 · stylist_opened 28 · clothes_import_selected 14. Now: 14-day real first-item rate **41.9% → 55.3%**, and **8 of 9** on 09-07 within six hours. The gap the row exists to close is closing without it; **P4 and P11 were both falsified on exactly this movement.** |
| **A33** | 09-02n | Cut every fix for FOUR fleets, not three | OTA | The largest active fleet stops being a blind spot | **✅ CLOSED 09-07n — absorbed into practice** | Audit ship 5 (09-05) and audit ship 6 (09-07) both published to all four live runtimes with manifest verification: `4e646ba0` (store) · `c5f00773` (b43-44) · `813c6d34` (b45) · `ccfa8345` (b46). The correction has held across two consecutive ships and no longer needs a row. |
| **A14** | 09-01 | Ship push permission + token capture | OTA | `push_tokens` > 0 | **✅ CLOSED 09-07n — it was met on 09-05 and never closed.** The row has been reprinting `push_tokens` = 0 for two nights after the condition was satisfied. | `push_tokens` = **2** (`ab7c3624` 09-05 19:10:24Z, `d03875a0` 23:07:24Z), `notification_prefs` = 2, re-verified 09-07. Continued as A44 (shipped) → A48 (shipped). **The live gap is downstream and is NOT this row:** `push_sends` = **0**, because both grantees hold <10 garments so `push_claim_morning_edit` claims neither. Tracked in the §10 directive as "the finish-your-ten note", the highest-value unbuilt message in the product. |
| **A57** | 09-07n | **A Ten home-screen widget** | BINARY | Day-2 re-engagement without a push token | **new — next week; the cheapest structural retention fix in tonight's competitive read** | Locket built a viral product on the widget surface; **Alta shipped one in v2.2.3 (2026-08-27)**. The Ten is exactly one widget's payload. Matters now because `push_tokens` = 2 and `push_sends` = **0** — both grantees hold <10 garments, so `push_claim_morning_edit` claims neither. |
| **A52 — RATIONALE PARTLY RETRACTED 09-07n** | 09-07 | ⚠️ **Read this first: the "5 of 16 recent arrivals were non-US" premise below is retracted** (09-07 §17.1 — A47 read the source split as 100% App Store Search, and the non-US share *fell*, 4/23 since 09-05 vs 8/33 before). **Ship the row anyway** — it is prepared, tested, costs nothing incremental on a build that has to happen, and a second 100-character keyword field via es-MX is worth having regardless. **But score it on the es-MX keyword field alone and expect no non-US lift.** Blocked on **A56**. Also blocked on **A58**: the free-character count is in dispute (en-US keywords read 100 by API tonight vs 98 recorded earlier today), and this row's arithmetic depends on it. Original text follows. |
| **A52** | 09-07 | **Keyword rewrite + storefront localisations on the next build** (founder order 2026-09-07: "do the keyword rewrite and localizations when you cut the next build") | BINARY (version-locked fields ride the next version) | A second 100-character keyword field in the US storefront via es-MX, and en-GB / en-AU / en-CA fields for the storefronts 5 of 16 recent arrivals came from; App Store Search impressions rise without a listing change | **PREPARED, not shipped — waits for the next build.** `scripts/asc-listing.mjs` (`read` / `plan` / `apply --version X`, apply refuses any non-editable version, proven against 1.2.3) + the strings and the checklist in `docs/app-store-listing.md` "Next build"; `tests/asc-listing.test.ts` pins every field ≤100, no stop words, no name/subtitle repeats, no en-US/es-MX overlap. | Live en-US field verified by API at 98/100 and principled (the doc's no-repeat rule); the en-US swap candidates are ranked but **gated on Apple Search Ads popularity scores**, which need an account the founder must open — the doc has said so since 08-10 and it is still undone. Decide the subtitle on the same version: candidate A drops `capsule`/`wardrobe`/`packing`/`list` from the subtitle and 27 keyword characters must absorb them. |
| **A51** | 09-07 | **The website asks for the install** — Smart App Banner (`apple-itunes-app`, with the page's own URL as `app-argument`) on every page including the invite landing page and the `/closet` email fallback; a 1200×630 Open Graph image on every card (the invite link previewed in Messages as text only); JSON-LD `SoftwareApplication` on the home page; `robots.txt` + `sitemap.xml` (both were 404) | web | Every iPhone visit to cinchstyle.com — above all every tapped invite link — shows Apple's own OPEN / VIEW banner for the app; shared invite links render as an image card; Google gets a sitemap | **✅ SHIPPED 2026-09-07 (engineering session, on the founder's "find something else")** | Found by auditing what a phone sees at cinchstyle.com after the A47 read said 99% of arrivals are Search: no banner anywhere, no `og:image`, no robots, no sitemap. Keywords on the live version verified set by API (98/100 chars) — the version page's "0" is a counter artefact (METHODOLOGY). Effect metric: App Referrer / Web Referrer first-time downloads in ASC (baseline 8 / 0 over 30d) and `invite_shared` → arrivals. |
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

## Audit ship 7 — the shape at ten, the thin Reveal, and two dashboards that were never dark (engineering session, read after the 09-08 nightly, 2026-09-09 01:07Z main · side-cuts 01:09Z / 01:11Z / 01:13Z)

Commit `62bea5d` on main. Published to all four live runtimes and manifest-verified:

| runtime | fleet | OTA | branch |
|---|---|---|---|
| 4e646ba0 | 1.2.3 / b47 (store) | `01a083b4-d56e-792d-80a4-ca82a4f7d60b` | main |
| c5f00773 | 1.2.0 / b43-44 | `01a083b6-b499-7ec2-82fc-31416320ab1e` | ota/c5f00773-a59 |
| 813c6d34 | 1.2.1 / b45 | `01a083b8-8a89-7741-b6bf-764aa406c5fe` | ota/813c-a59 |
| ccfa8345 | 1.2.2 / b46 | `01a083ba-33d0-7cd0-9572-9bab52025c7e` | ota/ccfa8345-a59 |

**Two of the nightly's "unread" systems read fine from here, and both changed rows.** PostHog
answers HogQL through the `posthog` MCP (`execute-sql`) and Superwall answers through the
`superwall` CLI (`paywalls list`, `campaigns list`, and the `asc` proxy for App Store Connect
itself); neither needs the browser session that expired. METHODOLOGY carries the recipes. Every
per-person claim below is PostHog, not a Supabase proxy.

Rows moved:
- **A59 ✅ SHIPPED (OTA) — and the diagnosis moved before the fix did.** Both single-category
  closets came through the **import door**, never The Ten: `a874512d` fired
  `clothes_import_selected` ×10 (09-05 17:30–17:42Z) and `bae15db5` ×10 (09-07 23:25–23:45Z),
  and neither ever opened `/the-ten`. The Ten's own card already names the missing half
  (`starterCardCopy`, the `core` gap: "Add a top. An outfit is a top with a bottom, or a
  dress…") — it never reached them. The counter they DID meet was Today's floor at ten, and it
  read **"Ten pieces in. Zero more pieces to go. A top is what turns this into outfits."** with
  one action, **"Add a top"**, whose door at the free ceiling is `add_garment_over_limit`:
  `a874512d` tapped it and met the paywall **39 seconds** after `closet_floor_shown`
  (17:45:45Z → `paywall_presented` 17:46:24Z), then never came back. So the fix is on Today, not
  in The Ten: `floorProgressLine` (closet-floor-copy.ts) says at ten *"Ten pieces in — but an
  outfit needs a top with a bottom, or a dress. A top is what turns this into outfits."* (no
  nought, no digit), the action becomes **"Swap a piece for a top"**, and it opens
  `/the-ten?door=photograph` — the Reveal's own repair loop, `TenRepair` over the live grid,
  where a filled position is re-read or replaced without buying anything. Pinned by
  `tests/closet-floor-copy.test.ts`. §11.5's third string is adopted in that form; the first two
  (at four and eight pieces) already exist on the floor as "A top is what turns this into
  outfits." **P23 stands as the effect metric**; a second, sharper one is the pair
  `closet_floor_shown` → `paywall_presented {add_garment_over_limit}` inside a minute for a
  ten-piece closet — that path is gone.
- **A59b ❌ KILLED — it counted the wrong thing.** `ai_calls.outfit_generation` is the server
  *enhancement* (asked only for a complex note, an event-formality conflict or a measured
  near-tie — `should-enhance.ts`); Today's plates are generated on the device and an ordinary
  morning writes no `ai_calls` row at all. The instrument for "was dressed" is PostHog
  `outfits_source` (plates on screen) and `outfit_set_viewed` (a Reveal plate). All four
  "eligible, never generated" closets have them: `89d85597` `outfits_source` ×2 + a Reveal
  visit on 08-31; `9a21ba7f` ×1; `fed827cc` ×3 plus `reveal_door_shown` ×3; `c34290ab` a
  completed Reveal (`outfit_set_viewed`, 09-07 21:01Z). Every closet that clears `canGenerate`
  has been shown outfits; "nine real people who have never seen an outfit" is false and no
  card is owed. The keepable loss is A59's population, not this one. METHODOLOGY amended.
- **A61 ✅ ANSWERED — no build.** Both untagged closets predate the 08-26 consent gate:
  `c646253d` last signed in **08-18** (13 rows pending), `ced245be` **08-20** (11), both
  `ai_consent_version = null`, `profiles.updated_at` = the 09-03 sharing migration. The T-10b
  pending-consent floor on Today (shipped 08-31) and the Reveal's consent door already handle
  exactly this state the moment either person opens the app; nothing more to build. What was
  wrong is the *count*: every "ten-piece closet" query in the briefings ran over raw `items`.
  Rule added to METHODOLOGY — closet-size denominators filter to
  `status in ('tagged','needs_review','verified') and not is_archived`.
- **A61b ✅ SHIPPED (OTA).** Root cause, from PostHog: `d03875a0` used the **voice walkthrough**
  (`intake_started` 23:06:13Z → `intake_committed` 23:07:07Z, one dress via catalogue search),
  and `walkthrough/review.tsx` replaces to `/reveal` regardless of closet size.
  `countOutfits` of one dress is honestly **1**, the sequence completed at 23:07:10Z, the stamp
  landed, `paywall_eligible {ok}` fired at 23:07:12Z and the sheet at :13 — over a closet Today
  floored two seconds later with "start with ten pieces." Fix: a **thin** closet
  (`belowActivationFloor` on the same settled read) still sees its number, but
  `mayStampSeen('complete', null, thin)` refuses the stamp and `maySellOnExit({paying, offline,
  thin})` skips the membership moment; both are pure in `reveal-zero-core.ts` and executed by
  `tests/reveal-zero-core.test.ts`. The honest zero's exits are unchanged.
- **A12 — the contradiction in 09-08 §17.9 dissolves, and the row is probably already met.**
  `superwall campaigns list`: **every** campaign variant points at paywall **254200** —
  `returning_free` (105048), `ten_completed` (105047), `reveal_complete` (101136) and the
  limits campaign (100436) alike. So the 09-07 boot gate's *"Try 7 days free — then $39.99/yr"*
  default button **was paywall 254200**, not a different document. `superwall paywalls list`:
  254200 carries all four products (`proAnnual`, `proMonthly`, `standardAnnual`,
  `standardMonthly`), updated 2026-09-01 01:53Z. ASC via the proxy: the **only** introductory
  offer in the group is `cinch.standard.annual`'s 1-week FREE_TRIAL, `startDate 2026-08-31`.
  The one fact the API cannot state is which product the layout pre-selects — and that is
  precisely what the gate read off the screen. **Recommendation: close A12 as met since
  2026-09-01 on the gate's evidence, or confirm with one editor look; either way P22's clock
  started 09-01, not "when A12 ships" — and on that dating it has already run seven days with
  zero arms-length trial starts.** The founder decision that remains is the *price*, not the
  button.
- **§16.8 ✅ the independent price read.** ASC's own USA price points via `superwall asc get
  /v1/subscriptions/<id>/prices`: standard.monthly **$4.99** (proceeds $4.24) ·
  standard.annual **$39.99** ($33.99) · pro.monthly **$9.99** ($8.49) · pro.annual **$79.99**
  ($67.99). A60's ceiling ($9.99 gross / $8.49 net) is confirmed from Apple, not from a
  document. `docs/ai-models-and-tiers.md` §163/§171 amended with a dated note.
- **A53 — half shipped, half a founder question.** The duplicated word ("Blue denim denim
  shorts", 12 rows across 7 closets) is the model's: `description` is written verbatim from
  the tagger. One rule added to `TAG_SYSTEM_PROMPT` ("do not repeat the material when the
  garment type already names it") and `tag-item` redeployed (`--use-api`). The **colour
  disagreement has a mechanism, not a model error**: the name a reader sees (`pieceName` →
  `colors[0].name`) is the on-device pixel sampler's nearest table name over the cutout
  (`upload-queue.ts:601`), while the description's colour is the model's word — "sage /
  taupe / steel" for light-wash denim is the sampler, and it overwrites the model's
  `colorNames`. Which source should NAME a piece is a product call, so it is surfaced rather
  than changed: the model for the word, the pixels for the swatch, is the obvious split.
- **A48's read, done (PostHog, since 09-07 20:00Z, harness excluded):** `push_ask_shown`
  5 `{floor}` + 1 `{usable}`; `push_ask_seen` **5 + 1 — seen equals shown for every person**;
  `push_ask_answered` **0**. The card is in the viewport and declined. Per the row's own
  rule the fix is the sentence, which is the founder's.
- **09-08 §16.1 (PostHog dark) is closed as a gap** — see METHODOLOGY "PostHog and Superwall
  are readable WITHOUT a browser session". Also read there: `auth_code_bounced` and
  `auth_cancel_hint_taken` have never fired (taxonomy), which is a zero, not a typo.

Keyed-Release boot gate: **PASSED** (xcodebuild Release + production Superwall key, fresh install on "Cinch iPhone 17 Pro",
01:03–01:06Z). The QA closet `sim-test+j00` was retagged in SQL to **ten × bottom/jeans** for the
run (originals snapshotted, restored at 01:08Z and verified) — the first gate of a *shape* state.
Cover → email door → OTP via Resend read-back → `auth_completed` 01:04:35Z → Today's floor with
the six-tile tray, headline "Start with ten pieces", body **"Ten pieces in — but an outfit needs a
top with a bottom, or a dress. A top is what turns this into outfits."**, one filled action
**"Swap a piece for a top"** (`closet_floor_shown` + `push_ask_shown {floor}` 01:04:37Z,
`push_ask_seen {floor}` 01:04:49Z on the scroll) → tap → **The Ten, "TEN OF TEN · Every well is
taken"**, all ten photographs live, and the repair plate under them: *"That's ten pieces — but not
a week of outfits yet. Cinch can't find a pair of shoes or a top in what you've filed…"* — the
designed repair loop, no paywall. The Hermes bundle carries the em-dash sentence in its UTF-16
string table (`strings` will not find it; grep the bytes as `utf-16-le`). **Not exercised on the
sim:** the thin Reveal (needs the voice walkthrough with one committed piece); its rule is pure
and executed by `tests/reveal-zero-core.test.ts`, and reveal.tsx's wiring is source-pinned by
`tests/reveal-page.test.ts`. **One nit seen on the gate, not fixed:** the push card under a full
undressable closet still reads *"Once your ten are in…"* — the floor's conditional sentence, now
stale for a closet that has ten in. Copy call for the founder (`push/ask-spec.ts`, pinned by
`tests/push-ask.test.ts`).

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
| **P26** | 09-08 ADDENDUM 2 | **Of the first-time downloads on 09-05, 09-06 and 09-07, at least half of the excess over a 3/day baseline will prove campaign-attributed** (i.e. the surge was substantially paid) | Fewer than half of the surge-above-baseline installs carry an Apple Search Ads campaign token in ASC's Campaigns view | the next run that can read ASC → Acquisition → Campaigns | new. Baseline: surge excess **+6 (09-05), +4 (09-06), +7 (09-07)** = 17 installs; paid capacity ≈ 5.5/day at $20/day ÷ $3.65 CPA. **Issued deliberately in the direction that makes me most wrong about the last four nights** — if it holds, the "arrivals moved 6× with nothing shipped" narrative that killed the 09-06 retention thesis was a paid acquisition curve read as organic demand. |
| **P25** | 09-08 ADDENDUM | **Within 7 days of the push card being moved into the first viewport (A62), `push_tokens` reaches ≥5** | Fewer than 5 rows in `push_tokens` 7 days after the ship | A62 + 7d | new. Baseline **2**. Derived from A48's measured rates: 19 shown / 6 seen (32%) / 2 answered (33% of seen) / 2 granted (100% of answered). If seen-rate goes to ~80% at the same answer and grant rates, 19 arrivals yield ~5 tokens. **Void if A62 does not ship.** |
| **P22** | 09-08n | **Within 7 days of a trial-bearing product reaching the default paywall button (A12), at least one arms-length Production trial start** | No `asc_notifications` row with `environment='Production'` + a subscription type whose `app_account_token` maps to an account that is **neither `%cinchstyle.com` / `demo@cinch.app` nor `%saenz%`**, within 7 days of the change | A12 + 7d | ❌ **FALSIFIED 2026-09-09, on the re-dated clock.** A12 closed on the gate's evidence: the trial-bearing product (`cinch.standard.annual`, 1-week FREE_TRIAL live in ASC since 2026-08-31) has been paywall 254200's default button since the paywall's 2026-09-01 01:53Z update — every campaign variant points at 254200, so the 09-07 gate's "Try 7 days free — then $39.99/yr" reading IS the button every placement shows. The 7-day window therefore ran **09-01 → 09-08** and is over. `asc_notifications`, `environment='Production'`: one `TEST` (08-26) and one `SUBSCRIBED/INITIAL_BUY` (09-05, **`%saenz%` family, excluded by the falsifier**). **Zero arms-length trial starts across 10 real impressions / 8 real persons in the window.** The falsifier as written is met. What this settles: the ask HAS been made, with a trial on the button, to eight strangers, and none took it — the "no trial on the default" excuse is gone. What it does not settle (n=8, METHODOLOGY's twenty-people rule): whether the price, the moment, or the product is the reason. Re-issue as a 20-impression test, not a 7-day one. |
| **P23** | 09-08n | **Of real accounts reaching 10 garments AFTER a spread prompt ships (A59), fewer than 1 in 6 will hold a single-category closet** | ≥15% single-category among post-ship ten-piece real closets, measured at n≥8 | A59 + n≥8 | new. Baseline after the fact-check's correction: **2 of 15 = 13.3%** genuinely single-category — the other two `cats=1` rows (`ced245be`, `48c98b00`) are **A61's untagged-intake defect**, not composition — and **2 of the last 5**. **Falsifier revised down from ≥25% to ≥15% before issue:** a ≥25% bar against a 13.3% baseline is not a test. Void if A59 does not ship. |
| **P24** | 09-08n | **The 7-day real signup total for 09-09→09-15 will be below 27** — spike decay stated flat, so P16 does not carry the whole argument | ≥27 real (internal/family/gate-excluded) signups over 09-09→09-15 | 09-15 | new. Baseline: 09-02→09-08 = **27** (1·0·1·7·6·9·3); 08-26→09-01 = 22. |
| **P4** | 09-01 | *(SCORED 09-08n — DUE DATE REACHED)* | ≥55% of real profiles created 09-01→09-08 hold ≥1 item | 09-08 | ❌ **FALSIFIED.** **18 of 29 = 62.1%**, seven points clear of the bar. ⚠️ **Denominator caveat the prediction did not carry:** A49's `reap_unverified_signups()` has deleted never-verified, garment-less rows hourly since 09-07 — precisely the zero-item accounts in this denominator (9 reaped on 09-07 alone), mechanically raising the rate. The falsification survives the margin, but this is **not the denominator P4 was written against** and METHODOLOGY requires saying so. This is the third consecutive falsified *activation-pessimism* prediction (P13, P4, P11-provisional) and it lands exactly where METHODOLOGY's "right about return, wrong about finishing" split predicts. |
| **P21** | 09-07n | *(SCORED 09-08n — one day after issue)* | Any one of 09-08/09/10 below 5 real signups | 09-11 | ❌ **FALSIFIED.** 09-08 ran **3** real arms-length signups (UTC day, read 23:47Z). The matched pair resolved in a single day **in favour of the pessimistic member (P16)**. ⚠️ **Do not file this as vindication of pessimism about users** — P16/P21 is a *spike-decay* prediction, a third category with its own strong base rate, not a "will users finish / come back" prediction. Binned as such in 09-08 §4. |
| **P16** | 09-06 | *(SCORED 09-08n)* | ≥4 real signups on **all three** of 09-08/09/10 | 09-11 | ✅ **HELD — settled three days early, scored against the falsifier rather than the prose.** 09-08 ran **3**, so "≥4 on all three" is already unsatisfiable. The 09-08 briefing's first draft wrote "one more day below 4 and it holds," which scores the prose; METHODOLOGY requires scoring what the falsifier said. **P16 and P21 were both decided by the same single data point on the same night** — one day of arrivals resolving a matched pair, not a week of accumulating evidence. |
| **P19** | 09-07n | *(status 09-08n)* | — | — | **VOID — A4 has not shipped (night 12).** Not scoreable and deliberately not reprinted as though it were. ⚠️ Second-order risk: **P14 is at 4.23% against its own ≥4.5% falsifier**, so P14 may falsify *without A4 ever shipping*, which would make P19 meaningless in a second way. |
| **P19** | 09-07n | **Impression→PPV clears 4.5% on at least one day within 7 days of a new screenshot set going live** — A4's effect stated as a number, and the deliberate mirror of P14 | No day ≥4.5% (total basis) in the 7 days after the new set is live | 7 days after A4 ships | new. **Void and unscoreable if A4 does not ship** — say so rather than reprinting it. Baseline: 30d **3.53%** (291/8,232); 09-05 3.96%, 09-06 3.47%. Gate answered 09-05 and re-derived tonight: **99.2% of impressions are Search (8,166/8,232) and Search's own impression→PPV is 2.89% (236/8,166)** — the "2.77%" quoted since 09-05 was computed on that night's smaller Search denominator and should not be carried forward. |
| **P20** | 09-07n | **`outfit_generation` clears 10 calls on at least one day by 2026-09-11** — the Reveal-reachability thesis (A55) stated as a number | No day above 10 calls in the window | 09-11 | new. Baseline **2 · 2 · 2** on 09-05/06/07 against tagging 13 → 29 → 47, with 15 real ten-piece closets standing. |
| **P21** | 09-07n | **≥5 real arms-length signups on each of 09-08, 09-09 and 09-10** — issued deliberately AGAINST my own demonstrated pessimism bias, and the direct opposite of P16 the same week. I expect to lose one of the two. | Any one of those three days below 5 real (family/internal/**gate**-excluded) signups | 09-11 | new. Baseline 09-05 **7** · 09-06 **6** · 09-07 **9**. Read P16 and P21 as a matched pair: they cannot both hold, and which one falls is the actual measurement. |
| **P4** | 09-01 | *(status 09-07n — due tomorrow)* | ≥55% of real profiles created 09-01→09-08 hold ≥1 item | 09-08 | **PROVISIONALLY FALSIFIED — running 17 of 27 = 63.0%.** One day of arrivals remains and each new profile enters the denominator before its item can arrive. **Rescore on the due date; do not quote as settled.** Re-derived twice tonight (EXISTS and items-side `group by`), identical. |
| **P11** | 09-02n | *(status 09-07n)* | ≥60% of real profiles created 09-03→09-10 hold ≥1 garment | 09-10 | **PROVISIONALLY FALSIFIED — running 15 of 24 = 62.5%** against a 14/30 = 47% baseline when written. ⚠️ **Reversible: the cohort has three days left to grow and 15/26 = 57.7% un-falsifies it — two more non-adders reverse the verdict.** Rescore 09-10. Context: 14-day real first-item rate moved **41.9% (09-06) → 55.3% (09-07)**; on 09-07 itself, 8 of 9 within six hours. |
| **P17** | 09-06 | *(status 09-07n)* | ≥3 of the cohort fire `Application Opened` on day ≥2 | 09-13 | ⚠️ **UNSCOREABLE AS WRITTEN** — the falsifier names `Application Opened` and PostHog is dark (09-07 §16.1). Scored instead on a strict *lower-bound* Supabase proxy (`profiles.updated_at` / `items` / `ai_calls` on a later day): **2 of 13 confirmed** — `ebf5529d` at **+31.1 h** (returned, added items, ran an AI call) and `fed827cc` at **+20.3 h** (11 garments). `84b137db` (+0.0 h) is a midnight-UTC rollover and does **not** count. **⚠️ Population restated 15 → 13**: A49's reaper deleted two 09-05 orphans (the `san***` typo-and-retry pair) that were never real users — see 09-07 §17.2. Smaller population makes falsification *harder*, so this is the conservative direction. **`d49bfa3c` (+405.8 h, 19 garments, hit `trial_expired`) is OUTSIDE the cohort and cannot move this row** — relevant to the thesis, not to the score. The proxy can only undercount; one more falsifies. |
| **P16** | 09-06 | *(status 09-07n)* | ≥4 real signups on **all three** of 09-08/09/10 | 09-11 | **window opens 09-08; trending hard against me.** 09-07 ran **9** real arms-length signups (11 raw, minus 2 engineering gate accounts — see METHODOLOGY "gate accounts on public mail domains"). Matched against the new **P21**. |
| **P18** | 09-06 | *(status 09-07n)* | any Production subscription row whose `app_account_token` is neither internal nor `%saenz%` | 09-20 | **on track.** 0 of 9 lifetime real paywall impressions have converted. `asc_notifications` unchanged: 1 Production `SUBSCRIBED/INITIAL_BUY` (family, `period_type=TRIAL`, `outcome=applied`), 1 Production `TEST`, 11 Sandbox `DID_RENEW`, 1 Sandbox `EXPIRED/VOLUNTARY` (09-07 01:29Z), 1 Sandbox `TEST`. Payments & Financial Reports Aug 2026: *"no data available."* |
| **P14** | 09-05 | *(status 09-07n)* | any day ≥4.5% impression→PPV with set v3 live | 09-12 | **HOLDS.** Screenshot set v3 re-verified live tonight by iTunes artwork URLs (`01-ten … 05-table`) — **night 11**. Readable days: 09-05 17/429 = **3.96%**, 09-06 23/663 = **3.47%**. 30d 291/8,232 = **3.53%**. ASC lags a day, so 09-07 is not yet published. |
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

## Closed 2026-09-09

| id | disposition |
|---|---|
| **A12** | ✅ **CLOSED by founder ruling 2026-09-09 ("close A12 on the gate's evidence"), night 10.** The evidence: (1) the audit-ship-6 Keyed-Release boot gate (09-07, production Superwall key) read the default button as *"Try 7 days free — then $39.99/yr"* on Standard annual; (2) `superwall campaigns list` (09-08) shows **every** campaign variant — `returning_free` 105048, `ten_completed` 105047, `reveal_complete` 101136, the limits campaign 100436, `packing_access` 100596, `repeat_upsell` 100973, `membership_upgrade` 101571, `event_join_over_limit` 105039 — pointing at paywall **254200**, so the gate's placement and A12's paywall are the same document; (3) `superwall paywalls list`: 254200 holds all four products, last updated **2026-09-01 01:53Z**; (4) ASC via the proxy: `cinch.standard.annual` is the only product in group 22290564 with an introductory offer (FREE_TRIAL, ONE_WEEK, `startDate 2026-08-31`). **Premise retired:** the 09-01 row's "defaults to `proAnnual`, which has none" described the paywall before its 09-01 update; the 09-07 and 09-08 nightlies escalated it on that stale premise while the ledger's own engineering entry flagged the contradiction (09-08 §17.9). **Consequence:** P22 is scored on the re-dated clock (falsified — see Predictions), and the remaining monetisation decision is the **price**, not the button (A60). Not verified tonight: the editor's own "default product" field — the founder chose to close on the on-screen reading rather than spend the editor look. |
| **12.1 (Savannah)** | ✅ **RULED by the founder 2026-09-09: "Savannah's pro year is a gift."** `77d25934`'s `subscriptions` row (`plan='pro'`, `current_period_end=2027-09-01`, set by hand 09-01) is a **comped grant**, not a purchase and not a trial. `trial_ends_at = 2026-09-13` on that row is inert — nothing charges and nothing lapses on it. Standing instruction for every briefing: she is outside the install→paid denominator by design (Condition 1 will never see her), outside the paying-user count, and never a churn risk. **The family trial (`90dc9d33`, $39.99 on 2026-09-12 22:56Z) was not ruled on** — it runs unless cancelled. |

## Closed 2026-09-08

| id | disposition |
|---|---|
| **A58** | ✅ **ANSWERED.** All three disputes settled from primary sources tonight. **(1) Price:** live products are `standard.monthly` **$4.99** · `standard.annual` **$39.99 + 1wk trial** · `pro.monthly` **$9.99** · `pro.annual` **$79.99** — Superwall's ASC-imported Products page AND `src/features/billing/plans.ts:95,140-153` agree; `[[cinch-subscription-products]]` ($7.99/$59/$14.99/$119) and `docs/ai-models-and-tiers.md` §163/§171 were **CORRECT WHEN WRITTEN and went stale on 2026-08-31** — commit `50c3ca4` repriced, and `handoff/d-decisions/DIRECTIVE.md:35` records the $14.99 read from ASC itself, so the old prices were **shipped, not planned**. Memory amended 09-08; the doc is not. ⚠️ `plans.ts:95,140-153` **corroborates but is not an independent source** — its `*PriceHint` fields are hints while the paywall reads StoreKit (see A60 and 09-08 §16.8). **(2) en-US keywords = 100/100 chars, ZERO free** — the ledger's "98" was wrong; **A52's keyword swap has no spare budget, every addition is a forced trade.** **(3) Promotional text = 131 chars of 170**, not 39 — A47's figure was wrong; 39 chars are free. Consequence spawned: **A60**. |
| **A55** | ✅ **ANSWERED, and its framing was wrong** — it assumed the closets were usable and asked about routing. **2 of 15 real ten-piece closets are genuinely single-category** (`a874512d`, `bae15db5`) and **2 more** (`ced245be`, `48c98b00`) hold garments the tagger never processed. On the wardrobe-eligible basis **10 of 15 clear `canGenerate`** and **4 of those 10 have never generated**; `reveal_seen_at` is set for **4** real people (`77d25934`, `d03875a0`, `11e176c1`, `c34290ab`). Split into **A59** (make The Ten ask for a spread), **A59b** (tell the four currently-eligible people an outfit is waiting), **A61** (24 garments stuck at `pending_tag`) and **A61b** (`d03875a0`'s one-garment Reveal). Also established: **`profiles.reveal_seen_at` IS a Reveal instrument** (migration `20260830190000`, stamps only on a delivered moment, never on mount) — 09-07 §16.5's "there is no Reveal-completion instrument" is retracted. And the footwear theory is dead: `77d25934` holds **zero** shoes and has run **80** generations; footwear gates `starterReadiness` (The Ten's copy) but not `canGenerate` (the engine) — `repeat.ts:58`, "SHOES MULTIPLY, NEVER GATE." |
| **A9** | ❌ **KILLED** after 8 nights. 45 `outfit_reactions`, 8 users, **0 readers**, last reaction 09-06; `style_feedback` and `tag_corrections` both **0 rows**. Killed rather than reprinted a ninth time, per the ledger's own 3-night rule. **Re-issue the night A59/A59b produce Reveal volume** — ranking work with no outfits has no denominator. |
| **A18** | ❌ **KILLED** after 7 nights. Its metric is being met by other means: 14-day real first-item rate is **55.1%**, and **P4 was falsified today on exactly this movement** (62.1% vs a <55% falsifier). |
| **A14** | (already closed 09-07) — restated: `push_tokens` **2**, `notification_prefs` **2**, `push_sends` **0**, **`push_receipts` 0**. The live gap is A59b's, not this row's. |

## Closed 2026-09-07

| id | item | closed with | measured effect |
|---|---|---|---|
| **A47** | Re-authenticate ASC and read the 09-05/06 Source Type breakdown | **✅ ANSWERED 09-07 (founder re-authenticated; read by URL)** — and it **killed the featuring hypothesis** | Surge is **100% App Store Search**: 30d-to-09-06 impressions Search **8,166** / App Referrer 32 (+0) / Browse 32 (+0) / Web 2; first-time downloads Search **64** (+16). Impressions on the surge days were *ordinary* (429, 663 vs 837 on 09-04); **PPV→download jumped to 52.9% and 30.4%** against 22.8%. Re-verified independently tonight — the 09-07 dashboard reproduces every figure (8.23K / 291 / 73). Corroborating kill of the non-US "featuring signature": since 09-05 the non-US share **fell** (4 of 23 = 17%) vs before 09-05 (8 of 33 = 24%); what actually changed is East-Coast concentration, America/New_York 5-of-33 → **13-of-23**. See 09-07 §17.1. |
| **A48** | Make the push card report visibility, not mount | **✅ SHIPPED (OTA, audit ship 6)** — **effect UNREADABLE tonight** | `push_ask_seen {closet}` ships on all four runtimes, proven on the boot gate (`{floor}` 20:04:59Z shown → 20:05:33Z seen on the scroll; `{usable}` 20:07:27.68Z shown → 20:07:28.36Z seen inside the first viewport). The read that decides seen-and-declined vs never-in-viewport requires PostHog, which is dark (09-07 §16.1). Two minutes once the session is restored. |
| **A49** | Catch the bounced sign-in code; stop minting an `auth.users` row per code request | **✅ SHIPPED AND FULLY LIVE 09-07 21:40Z** | Founder set `RESEND_READ_API_KEY`; a fresh throwaway bounce answered `{bounced: true}` **ten seconds** after the send and a delivered address answered `false`. `reap_unverified_signups()` hourly at :43 — **9 orphan rows reaped on the first run**, `auth.users` 71 → 62, never-verified now 0. **Nightly consequence, now standing: signup denominators drop by the day's orphan count, and a `last_sign_in_at IS NULL` row older than a day is always either <24h old or an Apple account.** |
| **A50** | Move the review prompt to a moment of delight | **✅ SHIPPED (OTA, audit ship 6)** — effect unreadable tonight | Timer retired; armed by `ten` / `reveal` moments only, never over a paywall, two asks maximum, `moment` on both events. Gate-proven: `review_prompt_shown {moment: ten}` five seconds after `today_opened`, over the plate. **The scoreboard it must move: `review_prompt_action` was "later" 6 of 6, and the rating count has now been 6 for ELEVEN days** (re-verified tonight, avg 5.0, 2 written reviews both answered). |
| **A23** | Ask users to invite | **✅ SHIPPED (OTA, audit ship 6), night 6 — and it immediately produced A54** | One card on Today after the push card, drawn when the closet is usable. Gate-proven end to end (`push_ask_answered {not_now}` 20:08:00.40Z → `invite_ask_shown` 20:08:00.45Z → invite screen). **But the gate also found that 11 of the 15 real ten-piece closets have no handle**, so two thirds of the audience hits "Choose a handle first" instead of a share sheet → **A54**. |
| **A51** | The website asks for the install | **✅ SHIPPED 09-07** | Smart App Banner on every page (invite and `/closet` carry their own URL as `app-argument`), 1200×630 OG card, JSON-LD `SoftwareApplication`, `robots.txt` + `sitemap.xml` (both previously 404). **Scoring problem, stated now: its effect metric is ASC App Referrer / Web Referrer downloads — baseline 8 / 0 over 30d, and tonight still 32 PPV / 8 downloads and 2 PPV / 0 downloads. Vercel Web Analytics has been off for 13 asks, so the web half is permanently unattributable.** If A51 is to be scored, that is the one thing that would do it (09-07 §16.4). |

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
