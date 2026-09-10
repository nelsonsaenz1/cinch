# Affordable membership — the first 100 paying users (release packet, 2026-09-10)

**Status: PREPARED.** Code and tests are on branch `codex/affordable-membership`; nothing
below is live. Purchase availability at the new prices, paywall routing to a monthly-only
document, entitlement delivery and the paying-user report have **not** been verified in
production, so the strategy is not "live" and must not be described as such until §7's
rollout has run and §8's checks pass.

Founder directive (2026-09-10): Standard **$0.99 / month**, Pro **$2.99 / month**, monthly only
on the primary new-customer paywall, no monthly trial, annual products preserved for the people
who hold them, the first promotional ask after the first successful Reveal (A68, shipped
2026-09-10 as OTA `01a088d6…`), and the immediate milestone **100 genuine, active paying
subscribers**. This is a **combined strategy change** — price, packaging and (already, by
A68) paywall timing moved in the same week. It does not isolate the causal effect of price.

---

## 1 · Before / after — the billing map (verified 2026-09-10 00:5x–01:3xZ)

Identifiers, all read live rather than assumed: App Store app **6798479578** · Superwall
project **28319**, app **52618** · subscription group **22290564** ("Cinch Membership") ·
paywall **254200** "Cinch Membership v3" (identifier `cinch-membership-v3-e738-2026-08-09`,
version 14, `non_gated`, all four products attached).

| | Before (live) | After (this packet) |
|---|---|---|
| **Storefront price, USA** | `cinch.standard.monthly` **$4.99** (proceeds $4.24) · `cinch.pro.monthly` **$9.99** ($8.49) · `cinch.standard.annual` $39.99 ($33.99) · `cinch.pro.annual` $79.99 ($67.99). No scheduled changes (`prices` rows carry `startDate: null`, `preserved: false`). | Standard monthly **$0.99** (USA price point `…MTAwMTAifQ`, proceeds $0.84) · Pro monthly **$2.99** (`…MTAwMzYifQ`, proceeds $2.54). Annual **unchanged**. |
| **Territories** | 175 price rows per product, equalised from USA. | Same 175, equalised from the new USA points (Apple generates them from the base point; exceptions surface in ASC's pricing sheet and are listed in §7.2 before submission). |
| **Duration / group / rank** | All four in group 22290564; Pro at level 1, Standard at level 2; monthly and annual at the same level within a tier (crossgrade). `state: APPROVED`. | Unchanged. No new products, no new group. |
| **Intro offers** | `cinch.standard.annual`: 1-week FREE_TRIAL from 2026-08-31 (every territory). The three others: none. | Unchanged. **No trial on either monthly** — deliberately. The annual trial is preserved for the annual product's own subscribers and restores. |
| **Product → entitlement (Superwall)** | 668498 standard.monthly + 668499 standard.annual → entitlement **55809 `standard`**; 668500 pro.monthly + 668501 pro.annual → **55806 `pro`**. | Unchanged. |
| **Product → plan (server)** | `_shared/superwall-plan.ts` `PRODUCT_PLANS`: `*.standard.*` → `standard`, `*.pro.*` → `pro`. Same table drives `asc-plan.ts`. | Unchanged — a price change needs no mapping change. |
| **Active paywall** | 254200 v3: Standard/Pro plates each with a monthly and an annual chip, "SAVE 33%" on Standard, annual pre-selected, CTA **"Try 7 days free — then $39.99/yr"**, note "7 days free, then $39.99/year unless canceled", Restore · Terms · Privacy · Manage Subscription. | A new document **"Cinch Membership v4 — monthly"** (§5) built from 254200: two monthly options only, Standard pre-selected, CTA names the plan and the recurring price from StoreKit, no annual chip, no saving chip, no trial wording; Restore · Terms · Privacy · Manage Subscription kept. |
| **Campaigns / placements** | 100436 Limits & trial (`open_stylist`, `add_garment_over_limit`, `generate_outfit_over_limit`, `trial_expired`, `event_hosting_over_limit`) · 100596 `packing_access` · 100973 `repeat_upsell` · 101136 `reveal_complete` · 101571 `membership_upgrade` · 105039 `event_join_over_limit` · 105047 `ten_completed` (**retired in the app 2026-09-10**, A68) · 105048 `returning_free`. Every variant → 254200 at 100%. Audience on all: no active `pro` entitlement. | Same campaigns, same placements, same audiences. Each variant's paywall flips 254200 → v4 at rollout (§7.4). `ten_completed`'s campaign stays defined and never fires. |
| **Default / pre-selected product** | Standard annual (trial-bearing) — read off the sheet on the keyed gate 09-07 and again 09-10. | Standard monthly. |
| **Existing entitlements (Supabase `subscriptions`, 78 rows)** | 74 `free` (9 internal/family) · 2 `standard` paid periods, both family (`90dc9d33` annual trial → **$39.99 charges 2026-09-12 22:56Z**; one period to 2026-09-25) · 1 `pro` with `trial_ends_at` (Savannah's **gift**, period end 2027-09-01, founder ruling 2026-09-09) · 1 `pro` paid (internal, to 2027-08-07). **0 arms-length paying customers.** | Untouched. No row is edited, cancelled, shortened, regranted or migrated. The family annual charge on 09-12 runs as the renewal-path integration test it already is. |
| **Ledgers** | `asc_notifications`: Production = 1 TEST + 1 `SUBSCRIBED/INITIAL_BUY` (family, `period_type` TRIAL); Sandbox = 11 `DID_RENEW` + 1 `EXPIRED` on `standard.monthly`. `superwall_events`: 13 rows, all sandbox/family. Idempotency: `svix-id` (Superwall) and `notificationUUID` (ASC). | Unchanged. §6's count reads these two ledgers. |
| **Client price display** | Paywall 254200 reads StoreKit. In-app: `plans.ts` hints `$4.99/$39.99/$9.99/$79.99`; **one shipping surface printed a hint** — the Profile row (`membership-copy.ts`: "$4.99 / month · Renews …"). | Paywall v4 reads StoreKit. `plans.ts` hints → `$0.99 / $2.99` (annual hints kept). **No shipping surface prints a hint**: `membership-copy.ts` now prints the term ("Through 10 October"), never a price. Pinned by `tests/paywall-identity.test.ts`. |
| **Public copy** | `web/terms.html` and `web/press.html` still say **$7.99/$59 and $14.99/$119** (two repricings stale — terms.html is the page Apple's reviewer reads). `store.config.json` review notes claim a **14-day app-side grant** that was retired 2026-09-01 (A2). | Both pages say $0.99 / $2.99 monthly with an annual-legacy sentence; review notes describe the free tier as the evaluation path and list the monthly products. **On the branch only — `web/` deploys from `main` on push, so these land at §7.5, not before.** |

## 2 · Scoped changes on `codex/affordable-membership`

| File | Change |
|---|---|
| `src/features/billing/plans.ts` | `monthlyPriceHint` `$4.99 → $0.99`, `$9.99 → $2.99`; docblock records the 2026-09-10 decision and that no layout prints a hint. Limits, quotas, promises: **unchanged**. |
| `src/features/profile/membership-copy.ts` | Subtitle prints `Through <date>` (or nothing), never a price. |
| `src/features/billing/use-gate.ts` | `paywall_presented` carries `paywall` (document identifier) + `products` (comma-joined ids); `paywall_converted` carries `paywall` + `product_id`. Presentation record gains `paywall` / `productId`, both null until presented / purchased. |
| `src/features/billing/placements.ts` | Stale "all four products have no trial" comment replaced with the offer history. |
| `tests/plans.test.ts` · `tests/paywall-identity.test.ts` (new) · `tests/review-prompt.test.ts` (one pin widened to accept `onPresent(info)`) | Pins. |
| `scripts/paying-users.sql` (new) | §6's report, as one read-only query. |
| `web/terms.html` · `web/press.html` · `store.config.json` | Public and reviewer copy (§7.5). |
| `docs/billing/affordable-membership-2026-09-10.md` (this file) · `docs/analytics.md` §events (two properties) | Records. |

**Not changed, on purpose:** `_shared/plans.ts` quotas and `PLAN_LIMITS`, `PRODUCT_PLANS`, `effective_plan()`, the webhook and ASC handlers, `promo-caps.ts`, every migration. Delivery cost at the new price: Standard's ceilings (150 garments, 15 generations/day, 8 stylist chats/month, ~$0.05/month of AI at the 09-09 rates in `docs/ai-models-and-tiers.md`) sit well inside $0.84 net; Pro's soft cap (1,000 garments, 60/day, 100 chats/day) is the one worth watching — at full quota a single Pro account can cost more than $2.54 net a month. Reported here, not "fixed": the quotas stay as they are.

**Test results on the branch (2026-09-10 01:4xZ):** `tsc --noEmit` clean · eslint clean on every touched file · node suite **3,945 pass / 0 fail** (3,944 before + the new pin file; one existing pin widened).

## 3 · First value and the first ask — inspected, verified

1. A free user can finish a usable ten-piece closet — unchanged (ten active pieces free, `item_limit_for_plan`).
2. **The first Reveal succeeds with no promotional paywall in front of it** — A68, live since OTA `01a088d6` (2026-09-10 01:2xZ) on all five runtimes. Keyed-Release gate 01:00Z: tap "See what they make" → Reveal ("Five outfits from ten pieces") → outfit → exit → `reveal_complete` sheet, 15 s after `outfit_set_viewed`; PostHog order proven.
3. The successful Reveal leads to the existing post-Reveal membership opportunity (`reveal_complete`, campaign 101136) — the sheet that will become v4.
4. Dismissing it returns to Today with the free experience intact — gate-proven (plate, wear actions, push card).
5. A failed or undressable Reveal never sells: the zero path presents nothing (`reveal.tsx`, pinned), the thin closet neither stamps nor sells (A61b, 09-09).
6. No rating card over a paywall: `review-prompt-core.ts` waits for the sheet's stamp; **one gate artefact found** — a deep link navigating under an open rating modal leaves The Ten's stop-sheet modal stuck invisibly; not a finger-reachable path, noted in the ledger, not fixed here.

## 4 · Existing customers

Nothing is cancelled, shortened, regranted or migrated. The family annual (`90dc9d33`) charges $39.99 on 2026-09-12 22:56Z exactly as before; Savannah's Pro year is a gift outside every paid count; the internal Pro row stays. Apple applies a **price decrease to existing subscribers automatically** — there are no arms-length monthly subscribers to affect (Production ledger holds none), and the annual prices do not move.

Upgrade / downgrade / cancel / expire / grace / refund keep the verified contract: `GRANTING`/`REVOKING` (Superwall) and `ASC_GRANTING`/`ASC_REVOKING` (Apple) are product-agnostic; `effective_plan()` keeps the 3-day slack; `cancellation` and `billing_issue` still grant through the period (grace) — none of it reads a price.

## 5 · The v4 paywall — BUILT as document 266240 (Superwall editor, 2026-09-10 01:5xZ)

**Paywall 266240 · "Cinch Membership v4 — monthly" · identifier
`cinch-membership-v4--monthly-8b69-2026-09-10`** — duplicated from 254200 in the dashboard and
edited through the editor relay (agent session, 45 tool calls), then saved. The API lists it as
`draft v0, published_at null`; **no campaign points at it**, so nothing a customer can reach has
changed. Edits made, all verified in the editor preview (screenshot in the ledger): the "Save N%"
chip, both annual chips, the trial line and both "/mo billed yearly" stacks deleted; the monthly
chips read `{{ products.standardMonthly.price }} / month` and `{{ products.proMonthly.price }} /
month`; each card's own tap selects its monthly product (indices 3 and 1); the radio dots and the
card borders key off those indices; the CTA reads **"Start Standard — {{ price }} / month"** /
**"Start Pro — {{ price }} / month"** by selection; the legal line reads "Renews monthly at
{{ price }} until you cancel. Cancel any time in your Apple ID subscriptions."; **standardMonthly
is the default product**; close, Restore, Terms, Privacy and Manage Subscription unchanged; all four
products stay attached for restores. The editor preview shows today's StoreKit prices ($4.99 /
$9.99) — they read $0.99 / $2.99 the moment §7.2 propagates, with no further edit.

**Still owed in the editor before §7.4:** the product-unavailable state (price string empty → hide
the chip text and disable the CTA rather than render "Start Standard —  / month"), and an AX /
Dynamic Type pass in the preview. The original build brief follows for reference:

- Name **"Cinch Membership v4 — monthly"**, identifier `cinch-membership-v4-monthly-2026-09-10`.
- Products attached: **all four stay attached** (restore and the `membership_upgrade` route for an existing annual member need them resolvable), but the layout **draws only** `standardMonthly` and `proMonthly`.
- Standard plate: name, the three benefit lines as they are, one price chip bound to `standardMonthly`'s StoreKit price and period (`{{ products.standardMonthly.price }} / {{ period }}`); **selected by default**. Remove the annual chip, the "SAVE 33%" chip, the "/mo billed yearly" arithmetic and the "7 days free…" note.
- Pro plate: same shape, bound to `proMonthly`; "EVERYTHING" chip may stay (it is a benefit word, not a saving).
- CTA: **"Start Standard — {{ products.standardMonthly.price }} / month"** / **"Start Pro — {{ products.proMonthly.price }} / month"**, switching with the selection. The disclosure line under it: "Renews monthly at {{ price }} until cancelled. Cancel any time in your Apple ID subscriptions." No trial words anywhere on the document.
- Keep: close (×) control, Restore, Terms, Privacy, Manage Subscription; the `{{context}}` line (the Reveal's own arithmetic); presentation style fullscreen; `feature_gating: non_gated`.
- **Delayed-price guard:** the price chip and the CTA render only from the StoreKit product's own localized price string. If StoreKit returns no product (propagation, offline), the document's fallback state must show the plan names and **no price**, with the CTA disabled — never a typed "$0.99". The editor's product-unavailable state is where this lives.
- Saved 2026-09-10; **not routed** — no campaign repointed until §7.4.

Why not edit 254200 in place: existing annual subscribers who open Profile → Membership → "See plans" (or `membership_upgrade`) would be shown the monthly-only document — correct for them too (they can only change term through Apple's page, which is linked). The reason to keep v3 is recovery (§7.6): a document that can be re-pointed in one click.

## 6 · Measurement — definitions and baseline

**Primary count — active paying subscribers.** Distinct external customers whose current paid period is backed by a verified, non-zero Production charge (`asc_notifications` `SUBSCRIBED` / `DID_RENEW` / `OFFER_REDEEMED`, not a TRIAL period per the Superwall ledger's `period_type` on the same original transaction), `expires_at` in the future, not refunded/revoked/expired since. Excludes Sandbox, `%cinchstyle.com`, `demo@cinch.app`, `%saenz%`, gifts (no transaction), legacy promotional access and free trials. Auto-renew-off stays in the count until the period ends and is reported separately; billing-retry / grace is a separate line. The query: `scripts/paying-users.sql`. **Baseline 2026-09-10: 0.**

**Alongside it** (same file / PostHog):
- New first-time payers, Standard vs Pro (`SUBSCRIBED` by product id).
- People exposed to the new offer and their conversion: `paywall_presented` / `paywall_converted` where `properties.paywall` = the v4 identifier — the two properties added on this branch. A `paywall_converted` is a client claim; the ledger count is the authority.
- Full activation within 48 h: `auth_completed` → `closet_ready` → `outfit_set_viewed` (or `plate_viewed`) → `outfit_worn` / `look_saved` / plan / friend-decision, per person (existing events; the Growth Scoreboard's own definition).
- Meaningful outfit activity among payers, last 7 days: `outfits_source` / `outfit_set_viewed` / `outfit_worn` for user ids in the active set.
- First and second monthly renewals: `DID_RENEW` count per original transaction, **only over transactions whose period has arrived** (`periods_matured` is printed beside them).
- Refunds, cancellations (intent), billing failures, collected revenue and gross MRR **separately** — the amounts from Superwall's ClickHouse or ASC Sales, never from this database.
- Acquisition spend and cost per payer as diagnostics (Apple Ads "Current week" view; the 09-09 read: $15.39 for 6 installs).

**Stamped on every impression and purchase from this branch:** `placement`, `paywall` (document identifier — the offer version), `products` (what was offered), `product_id` (what was bought). Storefront, displayed price and currency are Apple's and Superwall's fields on the transaction, not the app's — `superwall_events` / ClickHouse carry them; the app deliberately never types a price into an event. App version, build and update id are already on every PostHog event (`$app_version`, `$app_build`, `runtime_version`, `update_id`).

## 7 · Rollout order (nothing here has run)

1. **Merge the branch to `main`** after the founder's release gate. Do not push until step 5 is intended: `web/` deploys from `main` automatically.
2. **Apple price points** — one call per product, USA base point, all territories equalised, effective immediately (Apple applies a decrease to current subscribers; there are none at arm's length). Verify the schema first (`superwall asc docs /v1/subscriptionPrices post`), then:
   ```bash
   superwall asc post /v1/subscriptionPrices -d subscription=6798493952 \
     -d subscriptionPricePoint=eyJzIjoiNjc5ODQ5Mzk1MiIsInQiOiJVU0EiLCJwIjoiMTAwMTAifQ --json   # Standard monthly → $0.99
   superwall asc post /v1/subscriptionPrices -d subscription=6798492106 \
     -d subscriptionPricePoint=eyJzIjoiNjc5ODQ5MjEwNiIsInQiOiJVU0EiLCJwIjoiMTAwMzYifQ --json   # Pro monthly → $2.99
   ```
   Then read back `/v1/subscriptions/<id>/prices?include=subscriptionPricePoint&limit=200` and list any territory whose equalised price Apple adjusted (the `adjustedEqualizations` relation) in this file's §7.2 table before step 4. Prices in ASC do not need App Review; StoreKit propagation is typically minutes to a few hours.
3. **Propagation check** on a keyed sim / device: present `membership_upgrade`, confirm StoreKit's price string reads $0.99 / $2.99 (the v3 document will show it in its monthly chips) before any customer sees v4.
4. **Superwall**: publish **266240** (v4, §5), then repoint every campaign variant (100436, 100596, 100973, 101136, 101571, 105039, 105048 — and 105047 for completeness) from 254200 to 266240. Superwall serves the new document on the next paywall fetch; no app release.
5. **Public copy**: push `main` (terms, press, review notes). Sync the Superwall dashboard product prices (`products` page, "imported from App Store Connect") so the dashboard's own analytics show the new amounts.
6. **Verify live** (§8), then update the Growth Scoreboard's launch line and the CMO ledger. Only then may this packet's status read **live**.

**7.6 Recovery.** Reverting code does **not** restore Apple prices. If the strategy is withdrawn: (a) repoint the campaigns back to 254200 (one click, immediate); (b) raise the two monthly prices back through a scheduled `subscriptionPrices` change — a price **increase** requires Apple's consent flow for existing subscribers unless `preserveCurrentPrice=true` keeps them at $0.99/$2.99, and it takes effect on a future `startDate`; (c) revert `web/` and the review notes. Existing monthly subscribers acquired at $0.99/$2.99 keep that price if `preserveCurrentPrice` is used; that is the cost of the experiment and it is stated here rather than assumed away.

## 8 · Acceptance checklist (state on 2026-09-10)

- [ ] Both monthly products resolve to the intended price and correct entitlement — **prepared** (points identified; entitlement mapping verified unchanged); verify after §7.2.
- [ ] Displayed price, selected product and Apple purchase sheet agree — **after §7.3–7.4**, on a keyed sim with a sandbox tester.
- [x] New-customer paywalls use monthly terms without annual-trial language — **built as 266240, verified in the editor preview 2026-09-10**; the unavailable-price state and an AX pass remain (§5).
- [x] Free first Reveal works before the promotional ask — **verified 2026-09-10 01:00Z** (A68 gate).
- [x] Dismissal leaves the free experience usable — **verified** (same gate).
- [ ] Purchase, cancellation, pending payment, failure, restore, relaunch — sandbox run after §7.4.
- [x] Existing annual subscribers, trial holders and gifts retain access — **no row touched**; `effective_plan()` unchanged (suite green).
- [x] Duplicate billing notifications cannot create extra paying users — `svix-id` / `notificationUUID` idempotency unchanged; `supabase/tests/13_observability_claims.sql` covers it; §6's count is by distinct customer.
- [x] Refund / expiration behaviour — handlers unchanged; suite green.
- [ ] Small-screen, Dynamic Type, VoiceOver on changed screens — the only changed in-app copy is the Profile row subtitle (shorter than before); the paywall is Superwall's document and must be checked in the editor's preview at AX sizes.
- [x] Paid-user and renewal reports use distinct customers and mature cohorts — `scripts/paying-users.sql`.
- [x] No new dependencies, permissions, unrelated features or quota changes.

## 9 · Remaining decisions and owners

| # | decision | owner |
|---|---|---|
| 1 | Run §7.2 (the Apple price change) — irreversible for existing subscribers; there are none at arm's length today | Founder |
| 2 | Publish 266240 and repoint the campaigns (§7.4) — the document is built | Engineering, at the founder's word |
| 3 | The stop rule on Apple Ads (A67: 14 days / ~75 installs / 0 trial starts → pause) is written against **trial starts**, which the monthly offer no longer has. Rewrite to **paid starts**? | Founder — flagged, not changed |
| 4 | Pro's delivery cost at full quota versus $2.54 net (§2) | Founder — reported, not changed |
| 5 | Whether the `membership_upgrade` door for an existing **annual** member should show v4 (monthly only) or route straight to Apple's subscription page | Founder (default: v4, with Manage Subscription on it) |

Review dates: **7 days** and **30 days** after §7.4, then at each renewal maturity (first monthly renewals ≈ launch + 30 d, second ≈ + 60 d). Dates, not thresholds.

## 10 · Recorded, not built — the marketplace hypothesis

A possible future business is a free wardrobe platform supporting clothes sales, purchases and exchanges. Recorded as a hypothesis in `Decisions.md`; a build decision requires completed voluntary transactions between users first. Nothing in this packet adds selling, checkout, listings, messaging, exchange flows or promises of them.
