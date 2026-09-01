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
| A4 | 08-31 | Re-cut first screenshot + icon for tap-through | ASC | Impression→PPV 4.4% → ≥6% (unique-device basis) | **night 4 — STALE. Gate 09-03 STANDS, no third extension** | screenshot set still v3. The "ASC logged out" excuse is dead: ASC read fine 09-01n; the *analytics endpoint* is 410 Gone (see A21) |
| A7 | 08-31 | Tell the trial cohort they were never charged, before the Sep 11 cliff | OPS | Prevents a 22-person surprise on Sep 11 | **night 3 — blocked on a send** | both broadcasts `status: draft` re-verified 09-01 22:45Z. Superseded operationally by A17. |
| A8 | 09-01 | Attach `ten_completed` / `returning_free` to live Superwall campaigns | config | First non-Reveal qualified ask presented | **half — OTA half closed (see A3 Done); campaign half UNREAD** | zero `ten_completed`/`returning_free` events in PostHog; Superwall dashboard not reached |
| A9 | 09-01 | Read `outfit_reactions` in the ranking path; delete or wire `style_feedback` | OTA | A "hate" removes an outfit from rotation | **open, night 3** | grep rerun a 3rd time → outside generated types, only `styling/mutations.ts:77` — a **`select('id')`** locating a row to delete inside `retractOutfitReaction()`, not an insert (writes go via `rpc('apply_outfit_reaction')`) — and `:94` (the delete). **Nothing reads reactions in the ranking path.** See 09-01n §17.4. 43 reactions / 8 users / **0 readers** |
| A10 | 09-01 | Grant Savannah (`77d25934`) the free year of Pro promised 8/30 | OPS | Founder promise kept to the app's best user (108 items) | **open, night 3 — promise 3 days old** | re-verified 09-01 22:4xZ: `plan='free'`, `current_period_end` null, 108 items, trial ends 2026-09-13 |
| A11 | 09-01 | Reply to both 5★ App Store reviews + to Savannah | OPS | Zero unanswered contacts >48h | **open, night 3 — now VERIFIED, not inferred** | ASC `customerReviews?include=response`: both 8/28 reviews return `response: null`. **4d 14h unanswered.** Savannah ~48h. |
| A12 | 09-01 | Put the trial-bearing product on the paywall's default button | config | The default tap can actually start a trial | open — founder decision, night 2 | — |
| A14 | 09-01 | Ship push permission + token capture | BINARY | `push_tokens` > 0 | open, night 3 | `push_tokens` 0 · `notification_prefs` 0 · `push_sends` 0 (re-verified 09-01n) |
| **A15** | 09-01-od | Fix `clothes_import_failed / reason=row_write_failed` — **narrowed 09-01n: `upload-queue.ts:169` maps it to `Could not create item` / `Could not record upload`, thrown at :706, :758, :806, :1221 — all Supabase insert/update errors, NOT the cutout model.** Also make the event carry the Postgres code. | OTA | Zero `row_write_failed` over 48h + reason carries a PG code | **night 1 — NOT STARTED. Zero commits in 18h51m (last: `632e5e4`, 00:08:55 ET).** | no new failures, but no new import attempts either (last `clothes_import_selected` 16:34:26Z) — denominator zero, no credit |
| **A16** | 09-01-od | Stop `add_garment_over_limit` firing within minutes of failed imports | OTA | No paywall within 10 min of a `clothes_import_failed` for the same person | **night 1 — untouched** | reinforced 09-01n by Acloset's review corpus (its worst-reviewed mechanic is charging to upload more clothes) |
| **A17** | 09-01-od | Enable Resend open+click tracking, seed-test one Apple relay, send Dispatch No. 01 | OPS | First message Cinch has ever sent; reaches the 22 trials expiring by Sep 11 | **night 1 — NOT STARTED** | both broadcasts `status: draft` at 09-01 22:45Z (early read on P6) |
| **A18** | 09-01-od | Give the Today tab something of the user's before they have a closet (or gate entry) | OTA | `clothes_import_selected` rises toward `today_opened` | **new** | baseline: today_opened 35 · stylist_opened 28 · clothes_import_selected 14 (14d, excl. 16 devices) |
| **A19** | 09-01-od | Make `paywall_impressions` record every paywall, not just the capped promo path | OTA | Table matches PostHog `paywall_presented` | **new — measurement debt** | today's only production impression is in PostHog and absent from the table |
| **A20** | 09-01-od | Add `/open`, `/closet`, `/membership` to the AASA components | OTA/web | Email CTAs land inside the app instead of the App Store page | **new** | universal links currently cover only `/i/*` |
| **A21** | 09-01n | Create an App Store Connect API key (Users and Access → Integrations) so impressions/PPV/App Units/source attribution become readable again | OPS | ASC acquisition data readable; P1 re-issuable; A4 scoreable | **new — unblocks 4 dead rows** | `POST /analytics/api/v1/data/time-series` now returns **410 Gone**; the session was never the problem |
| **A22** | 09-01n | Set `promotionalText` — it is `null` and has never once been set | ASC (no review, ~2 min) | First deliberate ASO variable Cinch has moved; copy candidates in 09-01n §13.A | **new** | verified `null` on the live en-US localisation 09-01 22:5xZ |
| **A23** | 09-01n | Ask users to invite (one prompt after `closet_ready`, one after first `outfit_reacted`) | OTA | `invite_shared` > 4 | **new — highest-yield unused mechanic** | 4 shares ever, by 3 people, **3 converted (75%)**; the app's only 5-day-retained user came through it. K ≈ 0.10 |
| **A24** | 09-01n | Gate or seed Daily Social so nobody opens an empty screen | OTA | `daily_social_empty` / `daily_social_opened` < 1.0 | **new** | 25 opens / 25 empties / 4 users / **100%**, 14 days |

## Predictions being scored

| id | made | prediction | falsifier | due | verdict |
|---|---|---|---|---|---|
| P2 | 08-31 | Trials expiring Sep 1–14 will silently churn: <10% of expired-trial users open the app in the 7 days after expiry | ≥10% return | 09-08 first read | **strongly supported, and the 09-01 read corrected** — of 11 expired trials, 3 are internal and 1 is Nelson's own; of the **7 genuine customers, 0 returned**. 0 of 11 ever saw a paywall. |
| P3 | 09-01 | No reconciled production purchase will exist by 2026-09-14 23:59 ET | Any `asc_notifications` row with `environment='Production'` + a subscription type, **or** a non-sandbox `superwall_events` purchase | 09-14 | **on track** — re-verified 09-01 22:4xZ: 8 rows total, the only `Production` row is a `TEST`; `superwall_events` 6 rows all sandbox, 0 reconciled |
| P4 | 09-01 | Of profiles created 09-01→09-08, <55% will hold ≥1 item by 09-08 (14d clean baseline 14/31 = 45%) | ≥55% | 09-08 | n=1 real signup so far (has an item) — unscoreable. **Baseline restated on the clean denominator.** |
| ~~P5~~ | 09-01-od | *(original form)* live defect in the `ccfa8345` line | two persons × ≥10 clean imports on `ccfa8345` | 09-05 | **RESTATED 09-01n** — falsifier going stale: the fleet migrates to 1.2.3 from 18:44Z, so `ccfa8345` stops being the population. Replaced by P5b. |
| **P5b** | 09-01n | `row_write_failed` is a code defect, not device- or account-specific: it will appear again from a **different** production person | No `row_write_failed` from any person other than `ea34762e` in the window | 09-08 | — |
| **P7** | 09-01n | The store lever stays untouched: `promotionalText` still `null` | Any non-null `promotionalText` on the live en-US `appStoreVersionLocalizations` | 09-03 | — |
| **P6** | 09-01-od | The ops rail will not move: Dispatch No. 01 will still be `status: draft` | `list-broadcasts` shows `dd6c8ce6…` or `864e0059…` at any status other than `draft` | 09-04 | — |

## Done

| id | issued | item | lane | predicted effect | closed | measured effect |
|---|---|---|---|---|---|---|
| A1 | 08-31 | Account Holder accepts updated Apple Developer Program License Agreement | OPS | Unblocks all binary submissions | **09-01 ✅** | Free Apps Agreement Active eff. Aug 31 2026; 1.2.2 build 46 approved <1h and READY_FOR_SALE. |
| A2 | 08-31 | Decide the trial: drop the auto-gift, or convert to a real StoreKit intro offer | OPS→BINARY | Creates the first-ever path to a production purchase | **09-01 ✅** | Migration `20260901014553` applied. ASC carries a 7-day FREE_TRIAL on `cinch.standard.annual`, 175 territories. **Confirmed working 09-01-od:** the day's one real signup (`5184643a`) has `trial_ends_at = null` — the server no longer gifts a trial. |
| A3 | 08-31 | Add a paywall path not dependent on the Reveal | OTA | `paywall_presented` > 1/day | **09-01-od ✅** | Both OTAs published **and confirmed serving**: production `Application Opened` events carry `01a05b05…` (runtime ccfa8345) and `01a05b0d…` (runtime 813c6d34). First production `paywall_presented` since 8/30 fired today — but via the pre-existing `add_garment_over_limit`, not the new placements (→ A8). |
| A6 | 08-31 | Founder decision: should outfit cores require footwear? | OPS | Shoeless closets get outfits instead of a zero | **09-01 ✅** | `150a7a5`: `outfits = (tops×bottoms + dresses) × max(shoes,1)`. |
| A13 | 09-01 | Instrument where signup→first-item stops | OTA | A named drop-off step | **09-01-od ✅ closed — but its framing was DOWNGRADED 09-01n §17.1: `closet_floor_shown` is not an empty-closet event (fires for users with 123 items), so the step name is a HYPOTHESIS. The *loss* stands on Supabase: 31 real 14-day signups → 14 with ≥1 garment.** | The events already existed. Of 31 who fired `closet_floor_shown`, **13 fired `clothes_import_selected` and 18 never did** (14 selectors total, 14d, per person, 16 devices excluded). Supabase agrees: 31 real signups → 14 holding ≥1 item. |
| A25 | — | **1.2.3 / build 47 approved and released** | BINARY | — | **09-01n ✅ (Apple's doing, not ours)** | Submitted 2026-09-01T04:08Z, `READY_FOR_SALE` **18:44:53Z — 14h37m end-to-end.** Carries the library door, the persisting category edit, bounded catalogue titles, the flicker fix and the one-ask rating window. **Does NOT contain a fix for `row_write_failed`** (submitted 9h before the defect was found). |

## Killed

| id | issued | item | killed | reason |
|---|---|---|---|---|
| P1 | 08-31 | Impression-decay prediction | 09-01-od | Unscoreable on two consecutive runs — ASC has been unreadable both times. A prediction that cannot be measured is not accountability, it is decoration. Re-issue the same claim the night ASC reads. |
| A5 | 08-31 | Enable Vercel Web Analytics | 09-01n **recommended** | **Thirteenth ask.** Re-verified off via API 09-01 22:5xZ (`web_analytics_not_enabled`). Twelve unanswered asks is itself the answer. Web Referrer installs are permanently **unread**; state that in Data Gaps and stop spending a ledger row on it. Awaiting founder confirmation (09-01n §12.3). |
| — | 08-10 | Organic-content test (kill-criteria week 4, gate Sep 7) | 09-01-od **recommended** | Best post 41 views, 0 attributable installs, no posts since 8/28. The gate will be missed on a test that was never run; extending it costs another week. Awaiting founder confirmation (§12 item 4). |
