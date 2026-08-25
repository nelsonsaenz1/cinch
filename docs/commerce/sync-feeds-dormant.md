# `sync-feeds` is dormant, on purpose

*Audit item 18. Written 2026-08-11. **Activated 2026-08-25** — see Status.*

## Status

**ACTIVE since 2026-08-25** (awin-joined-programmes-directive.md, prompted by
the CICYBELL invitation). What changed:

- The function gained **phase 0**: every run reads Awin's
  `GET /publishers/3030871/programmes?relationship=joined` and reconciles
  `commerce_joined_programmes` from that answer alone — upserting reported
  programmes, deactivating vanished ones, and inserting missing
  `catalog_merchants` rows (`retail-en_US` default, insert-only so operator
  edits survive). The joined list is never hand-maintained.
- `cron.job` **`cinch-feed-sync`**, daily at 08:25 UTC, via
  `feed_sync_invoke()` (migration `20260825120000`, vault secrets
  `feed_sync_url` / `feed_sync_secret`, gate header `x-cinch-feed-sync`,
  `verify_jwt = false` in config.toml like send-push).
- The "fails on every tick" objection below no longer applies: a run with
  zero joined programmes does phase 0's real work and fetches zero feeds.
  First run 2026-08-25: `{"programmes":{"joined":0,"deactivated":0},
  "merchants":0}` — Awin honestly reports nothing joined until the CICYBELL
  acceptance is clicked in the dashboard; the day it is, the next tick
  ingests with no further engineering.

The original rationale below is kept as written — it explains why the
function existed dormant for two weeks and what it deliberately does not gate.

Historical state (2026-08-11 – 2026-08-24): deployed, unscheduled;
`catalog_merchants` and `catalog_products` empty; `AWIN_API_TOKEN` and
`AWIN_PUBLISHER_ID` (3030871) set.

## Why it is not deleted

It is the redundancy plan, not dead code.

Cinch's commerce surfaces are answered today by **Datafeedr**, a licensed
aggregator whose catalogue access requires no merchant approvals — which is the
entire reason a pre-launch app can query 44,027 merchants at all. That is a
single supplier for every shop suggestion and every listing photograph in the
product. `sync-feeds` is the second one: Awin publishes downloadable feeds we
can ingest directly, and once a programme is approved those rows are ours
without a per-request meter or a monthly cap.

So the two are not competing designs. Datafeedr is breadth without approvals and
a hard 10,000-request ceiling; Awin is depth with approvals and no ceiling, for
the handful of merchants that actually matter.

## Why it is not scheduled

**It has nothing to fetch.** Awin feeds are per-advertiser and require an
approved partnership. `commerce_joined_programmes` currently holds zero active
rows, so every feed URL `sync-feeds` could build would return a refusal. A
scheduled job that fails on every tick is worse than an unscheduled one: it
produces noise that trains people to ignore the logs, and it would trip the
`provider_failing` alert that now exists for real failures.

## The condition for switching it on

One thing, and it is not a code change:

> **At least one Awin programme approved**, recorded as an active row in
> `commerce_joined_programmes`.

When that lands:

1. Insert the merchant into `commerce_joined_programmes` (`network = 'awin'`,
   `merchant_id` = Awin's advertiser id). This is also what makes that
   merchant's links legitimately `paid` — see below.
2. Insert the corresponding row into `catalog_merchants` with its feed vertical
   and locale.
3. Schedule `sync-feeds`. Daily is ample; Awin permits no more than 5 requests
   per minute and forbids concurrent requests to one feed, and `FEED_GAP_MS`
   already paces for that.
4. Watch `commerce_health` — `coverage` and `provider_failure` will show whether
   the ingest is actually producing usable rows.

## What it does NOT gate

Three things that are easy to assume are waiting on this, and are not:

- **Shop suggestions.** `gap-shop-match` reads Datafeedr and works now.
- **Listing photographs.** `garment-search` reads Datafeedr and works now.
- **Commission.** Being able to build a tracking URL is not earning from it.
  `commerce_joined_programmes` is the only thing that makes a link `paid`, and
  it is consulted after ranking, purely to label the link truthfully. Every
  result today reads "Open at merchant" and links direct, because that is the
  truth.

Treating `sync-feeds` as the blocker for Datafeedr-backed matching was the
mistake this file exists to prevent a repeat of. The two paths are independent.

## Related

- `supabase/functions/sync-feeds/index.ts` — the function, and why Awin only
- `supabase/functions/_shared/merchants.ts` — the curated shop list, and why the
  suggestion path is narrow while search is wide
- `docs/commerce/network-ids-directive.md` — Awin/Rakuten identifiers
- `docs/decisions/2026-08-11-gap-shop-junk-results.md` — what shipped while this
  was believed to be the blocker
