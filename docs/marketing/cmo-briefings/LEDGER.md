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
| A3 | 08-31 | Add a paywall path not dependent on the Reveal (Ten completion, returning-free d3/d7, trial_expired) | OTA | `paywall_presented` > 1/day | **open, night 2 — code shipped `50c3ca4`, NOT LIVE** | `paywall_impressions` 0 rows; no OTA published for the strike commits |
| A4 | 08-31 | Re-cut first screenshot + icon for tap-through | ASC | Impression→PPV 4.4% → ≥6% (unique-device basis) | open, night 2 | unscoreable — ASC series ends 8/30 |
| A5 | 08-31 | Enable Vercel Web Analytics (**11th ask**) | OPS | Web Referrer becomes readable | **STALE — escalated 09-01** | verified off via API: `web_analytics_not_enabled` |
| A7 | 08-31 | Tell the trial cohort they were never charged, before the Sep 11 cliff | OPS | Prevents 24-person surprise on Sep 11 | open, night 2 | blocked in practice: `push_tokens` 0, Resend contacts 0 — no channel exists |
| A8 | 09-01 | Publish the strike OTA **and** attach `ten_completed` / `returning_free` Superwall campaigns | OTA + config | First non-Reveal paywall presented within 48h; `paywall_impressions` leaves zero | open | — |
| A9 | 09-01 | Read `outfit_reactions` in the ranking path (suppress `-1` item sets, weight `+1`); delete or wire `style_feedback` | OTA | A "hate" removes an outfit from rotation; first learning mechanism in the product | open | — |
| A10 | 09-01 | Grant Savannah (`77d25934`) the free year of Pro promised 8/30, then send the drafted reply | OPS | Founder promise kept to the app's best user (108 items) | open | — |
| A11 | 09-01 | Reply to both 5★ App Store reviews (unanswered since 8/28) | OPS | Zero unanswered reviews >48h | open | — |
| A12 | 09-01 | Put the trial-bearing product on the paywall's default button (or add the offer to `proAnnual`) | config | The default tap can actually start a trial | open — founder decision | — |
| A13 | 09-01 | Instrument where signup→first-item stops, *before* designing the fix | OTA | A named drop-off step for the 19 lost users | open | — |
| A14 | 09-01 | Ship push permission + token capture | BINARY | `push_tokens` > 0; a re-engagement surface exists at all | open | — |

## Predictions being scored

| id | made | prediction | falsifier | due | verdict |
|---|---|---|---|---|---|
| P1 | 08-31 | The 8/27 impression surge is Apple re-indexing and will decay toward a ~200–400/day floor without creative changes | Impressions hold ≥600/day through 9/2 | 09-02 | **carried — unscoreable 09-01, Apple series ends 8/30** |
| P2 | 08-31 | Trials expiring Sep 1–14 will silently churn: <10% of expired-trial users open the app in the 7 days after expiry | ≥10% return | 09-08 first read | **early evidence supports** — of 10 already-expired trials, 1 shows genuine post-expiry activity (`195a2399`; `fbd41326` is the manual grant) = 10%, at the boundary. 0 of 10 ever saw a paywall |
| P3 | 09-01 | No reconciled production purchase will exist by 2026-09-14 23:59 ET | Any `asc_notifications` row with `environment='Production'` + a subscription type, **or** a non-sandbox `superwall_events` purchase, by that date | 09-14 | — |
| P4 | 09-01 | Signup→first-item is the binding constraint and will not self-correct: of profiles created 09-01→09-08, <55% will hold ≥1 item by 09-08 (14d baseline 15/34 = 44%) | ≥55% | 09-08 | — |

## Done

| id | issued | item | lane | predicted effect | closed | measured effect |
|---|---|---|---|---|---|---|
| A1 | 08-31 | Account Holder accepts updated Apple Developer Program License Agreement | OPS | Unblocks all binary submissions | **09-01 ✅** | Free Apps Agreement Active eff. Aug 31 2026; submission bdda1528 cleared and **1.2.2 build 46 is READY_FOR_SALE**, approved <1h after submission. The block was real and is gone. |
| A2 | 08-31 | Decide the trial: drop the auto-gift, or convert to a real StoreKit intro offer | OPS→BINARY | Creates the first-ever path to a production purchase | **09-01 ✅** | Migration `20260901014553` applied — `handle_new_subscription` no longer writes `trial_ends_at`. ASC now carries a **7-day FREE_TRIAL intro offer on `cinch.standard.annual` across 175 territories** (start 2026-08-31). Apple can see a trial for the first time. Residual: 33 legacy trials still fold to `pro` until expiry; offer exists on only 1 of 4 products → A12. |
| A6 | 08-31 | Founder decision: should outfit cores require footwear? | OPS | Shoeless closets get outfits instead of a zero | **09-01 ✅** | `150a7a5`: `outfits = (tops×bottoms + dresses) × max(shoes,1)`. Shoes multiply, no longer gate. Both shoeless closets (108 items, 10 items) now compute outfits. Reveal ran `arriving→settled→complete` for the first time since 8/21 — **on a dev build (`$app_build`="1"), not production.** |

## Killed

_(move rows here with the reason)_
