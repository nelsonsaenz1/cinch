# Funnel, monetization, and production-evidence strike — evidence packet

Started 2026-08-31 ~21:00 ET (2026-09-01 UTC). Integration/release owner: Claude
session cinch-6d [b442aa]. Worktree `/Users/nelsonsaenz/cinch-wt-strike`, branch
`strike/funnel-monetization`, cut from `origin/main` at `e3379fe`.

Working protocol: peer sessions hold ASC/Superwall config (cinch-be) and the
journey harness (cinch-c8); code packets ran as subagents with non-overlapping
file territories (DB/webhook · billing · analytics · wiring); telemetry watch
with cinch-6d [ffa3dc]. Every external write is read-before/one-change/read-back.

## 0. Reconciliation of prior claims (runtime evidence over briefs)

**The briefing's P0 — "Reveal zero→counting regression" — DOES NOT EXIST.**

- PostHog (project 544348), `reveal_phase` by day/phase, 14d window, queried
  2026-09-01 ~01:00Z: full chains (`arriving→zero/counting→settled→cascade→
  complete`) on 8/20–8/21 (build 41); **zero events of any phase 8/22–8/30**;
  8/31: two users (build 45), `arriving→zero` only.
- Cause (a) REACH: the Reveal had no production entrance between the walkthrough
  exit and the Today door shipped 8/30 (`ad2d05e`) — no arrivals, so no phases.
- Cause (b) COMPOSITION: both 8/31 arrivals hold closets with **zero shoes**;
  cores = tops×bottoms×shoes + dresses×shoes (`src/features/closet/outfit-count.ts`),
  so `zero` is the arithmetic truth, not a defect. Verified per-account by the
  telemetry session (items and tags read directly; consent granted; nothing
  pending).
- Main carries the addendum commit `e3379fe` documenting the same conclusion.
- **Open product decision for the founder**: 2 of 4 all-time real Reveal
  audiences were shoeless. Whether cores should require footwear (or the Ten
  should force a shoes slot before the Reveal) is a product call, not a bug.

## 1. Before-state (captured before any change)

### Supabase (production)
- `subscriptions`: 44 rows — 33 live server trials (`plan='free'`,
  `trial_ends_at` future = the future `legacy_promotional_access` cohort),
  2 manual grants (`fbd41326…` standard → 2026-09-25; `8a4ad972…` pro → 2027),
  **zero organic StoreKit subscribers**. Queried 2026-09-01 ~00:55Z.
- Trial mechanism: `handle_new_subscription()` grants `now()+14 days`;
  `effective_plan()` folds any live trial to `pro` unconditionally
  (`supabase/migrations/20260805160000_membership_tiers.sql:70-112`).

### App Store Connect (read 2026-08-31 ~21:15 ET by cinch-be)
- Group "Cinch Membership" id 22290564, app 6798479578; all four products
  APPROVED: `cinch.standard.monthly` 6798493952 ($7.99, scheduled 9/1→$4.99),
  `cinch.standard.annual` 6798494368 ($59.00, scheduled 9/1→$39.99),
  `cinch.pro.monthly` 6798492106 ($14.99→$9.99), `cinch.pro.annual`
  6798493069 ($119.00→$79.99). Introductory offers: **zero on all four**.
- Public App Store version: **1.2.1 build 45** (runtime `813c6d34…`);
  1.2.2 build 46 (runtime `ccfa8345…`) WAITING_FOR_REVIEW (submission
  bdda1528). Builds 43/44 (`c5f00773…`) frozen at OTA `01a040c9`.

### Superwall (org 26053, project 28319)
- Paywall 254200 "Cinch Membership v3" v14 non_gated; product order
  proAnnual(a0, default) / proMonthly / standardAnnual / standardMonthly;
  **no trial copy anywhere**; Restore/Terms/Privacy present.
- Entitlements 55806=pro, 55809=standard. Campaigns: 100436 Limits & trial,
  100596 Packing, 100973 Repeat, 101136 Reveal complete, 101571 Membership
  upgrade, 105039 Event join (all → 254200, audience "pro inactive").

### PostHog
- Closed union in `src/lib/posthog.tsx`; billing events before strike:
  `paywall_presented`, `paywall_unavailable`, `paywall_converted` only.

## 2. Changes (filled at integration)

- Source commits: _pending_
- Migration readbacks: _pending_
- ASC offer resource: _pending_
- Superwall paywall/campaign versions: _pending_
- OTA/update IDs: _pending_

## 3. Rollback procedures

- **OTA**: `eas update:republish` the prior good production group per runtime
  (813c: `19f2cdfc…`; ccfa8345: `03368777…`), or
  `eas update:roll-back-to-embedded` per the 8/26 incident playbook.
- **Migration `20260901000000_storekit_trial_transition.sql`**: restore
  `handle_new_subscription()` and `effective_plan()` bodies from
  `20260805160000_membership_tiers.sql` (their exact prior definitions are in
  that file); the ledger columns and `paywall_impressions` are additive and
  safe to leave. No data is destroyed by the forward migration; the 33 legacy
  trial rows are untouched either way.
- **ASC intro offer**: DELETE `/v1/subscriptionIntroductoryOffers/{id}`
  (resource id recorded at creation) — removes the offer for future
  purchasers; already-started trials run their course under Apple's rules.
- **Superwall paywall**: version-history restore to v14 (the 8/31 price-fix
  content) in the editor; campaigns for `ten_completed`/`returning_free` can
  be paused in the dashboard without touching code (unmatched placements
  proceed silently by design).
- **Client**: every new path is gated behind placements + caps; a paused
  campaign disables presentation with no code change.

## 4. Controlled journey table

_pending — one row per run: identity · device/build/runtime · auth · Ten ·
Reveal phases · outfit viewed · worn · eligibility · placement · presentation ·
product · trial/purchase · entitlement · relaunch · restore · attribution ·
incidents._

## 5. Acquisition gate

_pending criterion-by-criterion verdicts._
