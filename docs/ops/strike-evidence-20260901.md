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

- Source commits: `8c7a987` (server: trial transition, ledger period types,
  paywall_impressions) + `50c3ca4` (client: presentPromo caps/denominator,
  ten_completed/returning_free/reveal qualification, prices, analytics
  contract). Main fast-forwarded and pushed to `50c3ca4` 2026-09-01 ~02:1xZ.
  Suite at 50c3ca4: 3698 tests / 0 fail / 1 pre-existing skip; typecheck
  clean; lint 0 errors (14 pre-existing warnings, none in touched files).
- Migration `20260901000000_storekit_trial_transition` **applied to production
  2026-09-01 ~01:55Z via MCP**; readback verified: trial grant stopped
  (functional check), paid-wins precedence (`effective_plan('fbd41326…')` =
  'standard', legacy user = 'pro', 33 legacy rows intact), 8-arg
  `claim_superwall_event`, both ledger columns, `paywall_impressions` RLS
  (2 policies, RLS on).
- `superwall-webhook` **deployed** (supabase CLI --use-api, project
  dugizuswuebrmcmvinmi) with periodType/isTrialConversion pass-through.
- Generated DB types refreshed from production (includes paywall_impressions).
- **ASC intro offer LIVE** (created ~02:4xZ by cinch-be, founder-confirmed in
  that chat): FREE_TRIAL / ONE_WEEK / numberOfPeriods=1 on
  `cinch.standard.annual` (6798494368), **175/175 territories** (per-territory
  creation required by the API; readback confirmed), startDate 2026-08-31, no
  endDate. Superwall product 668499 reflects it: trial_period_days=7,
  hasIntroductoryOffer=true.
- **Paywall 254200 republished** (document `iaZg5Z7qnJJTC0IgVq8Fa`, verified
  via runtime URL): Standard Annual is the Default product (selected +
  emphasized on open, card above Pro), live-computed "SAVE 33%" chip (Liquid,
  from the two live Standard prices — no typed constants), legal line
  "{{ trialPeriodDays }} days free, then {{ price }}/year unless canceled."
  conditional on Standard-Annual selection ∧ hasIntroductoryOffer, trial CTA
  variant, footer Restore · Terms · Privacy · Manage Subscription
  (apps.apple.com/account/subscriptions). Monthly products remain accessible.
- **Campaigns wired**: 105047 "Ten completed" (`ten_completed`) and 105048
  "Returning free" (`returning_free`) — audience CEL identical to the other
  six (`["pro"].all(identifier, !device.activeEntitlements.contains(identifier))`),
  enabled, single variant 100% → 254200; created against the placements as
  committed on main (`placements.ts:213` / `:229`). Eight campaigns now route
  to 254200. `trial_expired` (campaign 100436) verified still routing to the
  new document.
- **Legacy-lapse modelling note**: lapsed legacy-promotional users never
  redeemed a StoreKit intro offer, so Apple reports them intro-ELIGIBLE. Their
  `trial_expired` ask now opens on Standard Annual with the trial CTA — model
  that cohort as *trial starts*, not immediate $39.99 conversions.
- OTA/update IDs: _pending (boot gate next; shoes/cores founder change found
  in-flight on the main checkout — being folded in before the cut)_

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

## 3a. Pre-release funnel baseline (PostHog, 30 days to 2026-09-01 ~02:5xZ)

Labelled denominators, `uniq(person_id)`:

| Event | Events | Users |
|---|---:|---:|
| `auth_completed` | 54 | **35** |
| `closet_ready` (the Ten completed) | 22 | 10 |
| `plate_viewed` | 227 | 10 |
| `reveal_phase` (any phase) | 19 | 6 |
| `outfit_set_viewed` | 71 | 6 |
| `paywall_presented` | 30 | 6 |
| `outfit_worn` | 4 | 2 |
| `paywall_unavailable` | 0 | 0 |
| `paywall_converted` | 0 | 0 |

Readings that matter:
- **Paywall presentation reached 6 of 35 authenticated users (17%)** in 30 days
  — above the gate's 8% bar, but on a base of 35 and with no eligibility
  denominator, which is exactly the blindness `paywall_eligible` now fixes.
- **`paywall_unavailable` has never fired.** The use-gate fail-safe has not
  torn down a single presentation in 30 days — the paywall infrastructure is
  not the funnel's problem.
- **`paywall_converted` has never fired** — consistent with $0 MRR and zero
  organic subscribers in Supabase. Its first firing is, by construction, the
  first real purchase evidence (and cannot occur on simulator).
- The 10 → 6 step (`closet_ready` → `reveal_phase`) is the reach gap the Today
  door (8/30) and the Ten-completed path (this release) both address.

## 3b. Evidence item #1 — the silent trial is dead (CONFIRMED)

Fresh signup **after** the migration: `sim-test+j00@cinchstyle.com`, user
`4b827726-5539-4f37-8eca-6936e994df93`, created 2026-09-01 01:54:27Z. Readback
from `public.subscriptions`: **`plan='free'`, `trial_ends_at=NULL`.** Full
new-account onboarding ran (OTP → name → lifestyle questionnaire → tour →
Today). The shipped client handles NULL correctly:
`trial-expired-core.ts` guards `!marker → 'not_lapsed'`, so no fresh account
can receive a spurious trial-expired interrupt.

Identity recipe proven for the journey block (`sim-test+jNN@cinchstyle.com`,
OTP read from Resend sent-mail keyed on the exact plus-alias).

## 3c. Privacy check — stale prior-account state (INVESTIGATED, NOT A DEFECT)

During canary setup, a peer session wiped the app's data container
(Documents/AppSupport/Preferences/Caches) instead of signing out, then signed
in as a new account and saw the previous account's outfit names, closet-count
card, and one reveal-paywall context line.

**Source review clears the product.** Two independent purges exist and both
name this scenario:
- `src/features/auth/use-session.ts:45-54` — `queryClient.clear()` (not
  invalidate) on `SIGNED_IN` / `SIGNED_OUT` / `USER_UPDATED`.
- `src/app/_layout.tsx:52-77` (`usePersistedCachePurge`) — erases the
  dehydrated SQLite blob on the same events, with the comment "On a shared
  device that means user B watching user A's closet paint in," and a stated
  rationale for handling the auth EVENT rather than `signOut()` (account
  deletion, revoked refresh token, and the magic-link callback all move the
  session without it).

The observed bleed came from a container surgery that fires no auth event and
is not reachable by a real user. **Journey protocol therefore requires a real
fresh install per run, never container wipes or in-install account switching**
— and one journey will deliberately perform a genuine in-app sign-out followed
by sign-in as a different identity, to convert this from a code reading into a
runtime observation.

## 4. Controlled journey table

_pending — one row per run: identity · device/build/runtime · auth · Ten ·
Reveal phases · outfit viewed · worn · eligibility · placement · presentation ·
product · trial/purchase · entitlement · relaunch · restore · attribution ·
incidents._

## 4a. Attribution — what works and what does not

Examined 2026-09-01 ~03:0xZ, source-verified:

- **Production App Store destination: WORKS.** v1.2.1 build 45 is live and
  installable; ASC records downloads by source (Search / Browse / App Referrer
  / Web Referrer) and those numbers are read in the CMO briefings.
- **Campaign-token attribution: NOT IMPLEMENTED.** No AdServices /
  `attributionToken` path exists in the client (`grep` over `src/`), so Apple
  Search Ads campaign tokens cannot be resolved to installs. No paid campaign
  is live, so nothing is being lost today — but a paid campaign launched
  tomorrow would be measurable only at ASC's own source granularity, not per
  campaign inside the product funnel.
- **Deferred (cold-install) invite attribution: SHIMMED, NOT FUNCTIONAL.**
  `src/features/invite/native.ts` is a deliberate shim: the attribution SDK
  package is not installed (the stable release predates the New Architecture;
  the New-Arch rewrite pins `react-native <0.85` and this app runs 0.86). The
  file documents this and the honest fallback — install, then tap the link
  again. Every other invite route (app installed, already signed in, handle
  gone, android/desktop) works without it.
- **In-product referral attribution: WORKS** via universal links and
  `profiles.invited_by`; `invite_shared/_opened/_converted` fire.

## 5. Acquisition gate

| # | Condition | Verdict |
|---|---|---|
| 1 | Reveal succeeds in ≥95% of controlled valid journeys | _pending journeys_ |
| 2 | Production destination and campaign attribution work | **PARTIAL — see §4a.** Destination PASS; campaign-token attribution NOT IMPLEMENTED; deferred-install attribution shimmed. |
| 3 | Eligible paywall presentation >8% in the controlled funnel | _pending journeys_ (30d baseline: 6/35 authed users = 17%, no eligibility denominator existed before this release) |
| 4 | Purchase and restore pass end to end | **BLOCKED — device required.** The iOS Simulator cannot complete App Store sandbox purchases against real ASC products (confirmed live 2026-08-31: purchase tap dead-ends at Apple sign-in). Needs a physical device + sandbox Apple ID. Not inferable from configuration. |
| 5 | No critical auth, billing, crash, privacy or dead-route incident open | _assessed at end of run_ |
