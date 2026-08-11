# `sync-feeds` is dormant, on purpose

*Audit item 18. Written 2026-08-11.*

## Status

**Deployed, unscheduled, and reading nothing.** `sync-feeds` runs only when
something calls it, and nothing does — there is no `cron.schedule` entry for it
and there will not be one until the condition below is met.

| Object | Kind | Rows | State |
| --- | --- | --- | --- |
| `sync-feeds` | edge function | — | deployed, no schedule |
| `catalog_merchants` | table | 0 | empty |
| `catalog_products` | table | 0 | empty |
| `AWIN_API_TOKEN` | secret | — | set |
| `AWIN_PUBLISHER_ID` | secret | — | set (3030871) |

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
