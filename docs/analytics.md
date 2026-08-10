# Analytics — what PostHog is for, and what we do with it

**Project:** Cinch (id `544348`) · org "Nelson's Team" · US cloud · timezone UTC
**Status:** instrumented in the app, no production traffic yet
**Last reviewed:** 2026-08-06

---

## 1. What PostHog is for

PostHog answers **four questions**, in this order. Everything below exists to
serve one of them. If a chart doesn't serve one of them, don't build it.

| # | Question | Why it's the question |
| --- | --- | --- |
| 1 | **Does the closet actually get built?** | Cinch is worthless with an empty closet, and filling it costs the user real effort — photographing garments is the highest-friction onboarding of any app in this category. This is where users die. **The ask is now ten pieces, not thirty:** the free closet is ten active items (`supabase/migrations/20260808190000_free_closet_is_ten.sql:29`) and the first run walks the user through them one named slot at a time (The Ten → The Reveal, `src/app/tour.tsx` → `src/app/the-ten.tsx`). That makes the funnel shorter but does not make this question less important — it moves the death point earlier. |
| 2 | **Does it become a morning habit?** | The product is "a lookbook that regenerates every day." If people don't come back in the morning, we've built a novelty. |
| 3 | **Does the habit hit a wall worth paying to remove?** | Revenue here is not persuasion, it's limits. **Ten active garments free**, not thirty — the limit moved on 2026-08-08. If nobody reaches ten, nobody pays, and no amount of paywall design fixes that. |
| 4 | **Is the AI good enough to trust?** | Bad tags poison every outfit built from that garment, permanently and invisibly. Model quality is measurable, and it has a direct spend decision attached. |

### What PostHog is explicitly *not* for

- **Not revenue reporting.** Superwall is the system of record for MRR, trials,
  churn and refunds. PostHog receives purchase *events* so they can appear in
  funnels — it never becomes the number we quote.
- **Not the plan authority.** `subscriptions.plan` in Supabase is authoritative,
  written only by the Superwall webhook. PostHog mirrors it for segmentation.
- **Not AI cost accounting.** That's the `ai_calls` table in Supabase, which has
  real token counts. PostHog counts *actions*, not dollars.
- **Not session replay.** Deliberately off. Every screen is either the user's own
  wardrobe photographs or a private stylist conversation. Turning it on is a
  privacy-manifest change and an App Store answer change, not a config tweak.

---

## 2. What is instrumented today

Twelve events, a closed TypeScript union in [`src/lib/posthog.tsx`](../src/lib/posthog.tsx)
so a typo can't silently fork a funnel. Screen views are manual (expo-router
hides its NavigationContainer, so SDK screen autocapture would record every
screen as `index`). Touch autocapture is off because accessibility labels in
this app *are* garment names.

| Event | Fires when | Properties |
| --- | --- | --- |
| `clothes_import_selected` | Photos chosen for import | `source` (library/camera), `count` |
| `clothes_import_completed` | One garment uploaded, tagged, saved | `path` (queue/sweep) |
| `garment_search_used` | Garment described in words instead of photographed | `stage` |
| `cutout_result` | On-device background removal finishes | `outcome`, `subjectCount` |
| `garment_reviewed` | AI tags confirmed or corrected | `corrected` (bool) |
| `outfit_reacted` | Outfit liked or dismissed | `liked`, `source` |
| `outfit_worn` | Outfit marked as actually worn | — |
| `outfit_planned` | Outfit placed on a day in the week plan | — |
| `stylist_question_answered` | Stylist replied successfully | `outfitCount` |
| `stylist_questionnaire_completed` | Guided brief tapped through | — |
| `outfit_shared` | Share sheet opened for an outfit card | — |
| `paywall_presented` | Server refused, upgrade offered | `placement` |

Plus PostHog's own `Application Opened` / `Application Backgrounded` /
`Application Updated` from `captureAppLifecycleEvents`, and `$screen` from
`useScreenTracking`.

**The only identifier sent is the Supabase user UUID.** No email, no name, no
garment photo, no stylist question, no city, no calendar title. That line is
load-bearing: `app.config.ts` declares email as collected for *App Functionality
only*, and sending it to a third-party analytics vendor would make both the
privacy manifest and the App Store privacy answers false — which is a review
hold, not an ethics footnote.

### 2a. Gaps that will bite — flagging these now

These are the difference between an analytics install that answers §1 and one
that produces charts nobody can act on. None of them require sending anything
sensitive.

1. **No person properties.** We send the UUID and nothing else. That means **no
   analysis can be segmented by plan, by closet size, or by cohort** — which
   makes most of §5 impossible as built. Setting `plan`, `garment_count`,
   `trialing` and `signup_week` via `posthog.identify(id, {...})` is
   non-identifying and unlocks everything. *This is the highest-value fix on
   the list.*
2. **No outfit impression event.** `outfit_reacted` records likes and dismissals
   but nothing records that an outfit was *seen*. So we can measure absolute
   likes and never a **like rate** — and the like rate is the direct read on
   whether the styling engine is any good.
3. **No purchase event in PostHog.** Superwall knows about purchases; PostHog
   doesn't. So `paywall_presented → subscribed` cannot be measured, and question
   #3 has no bottom half. Fix belongs in the webhook (see §7), not the app.
4. **No sign-up funnel.** Magic-link sign-in has no events, so a drop between
   "opened app" and "has an account" is invisible.
5. **`outfit_worn` carries no properties.** Fixed by (1) — once plan and closet
   size are person properties, the event doesn't need them.

---

## 3. The daily review — 5 minutes, every morning

Build this as one dashboard, **"Daily"**. The discipline is that it is short
enough that it actually gets read. Four tiles.

**1 · Instrumentation health.** Event volume by name, last 24h vs prior 24h.
You are not reading this for insight — you are reading it to catch an event
that stopped firing after a release. A funnel that quietly loses its middle step
looks like a product collapse for a week before anyone checks the deploy log.

**2 · Activation.** New users → `clothes_import_completed ≥ 1` → `≥ 10` → `≥ 30`.
Run as a funnel with a 7-day window. This is question #1 and it is the number
that matters most in the first six months.

**3 · Technical quality.** `cutout_result` broken out by `outcome`. A rising
`failed`/`unsupported-device` share is a silent product degradation — the user
sees a bad cutout and blames the app, never files a bug, and churns. **This tile
has a spend decision attached:** if `failed + unsupported-device` sits above
~10% of cutouts, server-side matting becomes worth paying for. Below that it
isn't.

**4 · Money-adjacent.** `paywall_presented` by `placement`, plus purchases once
§7 lands. Which of the four walls people actually hit is the input to where the
paywall design effort goes.

### Weekly (Monday, ~20 minutes)

- **Retention curve**, cohorted by signup week, with `Application Opened` as the
  return event. Watch the W1→W4 shape, not the absolute number.
- **The threshold analysis** in §4 — the single most valuable recurring query.
- **Correction rate**: `garment_reviewed` where `corrected = true`, trended.
  Rising means model drift or a bad prompt change. This is the honest read on
  whether the tagging model is holding up, and it is the trigger to re-run the
  50-photo eval in `docs/ai-models-and-tiers.md`.
- **Like rate** and `outfit_worn` per active user — is the styling engine
  actually being trusted, or just browsed?

---

## 4. The one analysis that matters most

> **At what closet size does retention jump?**

Cinch has a combinatorial floor. With 8 garments the outfit engine has almost
nothing to work with and every suggestion is a repeat; with 40 it has real
range. Somewhere in between there is a threshold — call it **N** — above which
the product stops feeling thin and starts feeling like a stylist.

**How to run it:** cohort users by garments completed in their first 7 days
(buckets: 1–9, 10–19, 20–29, 30–49, 50+). Plot week-4 retention for each bucket.
Look for the knee.

**N determines almost every product decision we have:**

> **This table was written against a 30-item free tier and its arithmetic has
> not been re-derived** (noted 2026-08-10). The free closet is now **ten active
> pieces**, so every row below should be read as "N versus the limit", not "N
> versus 30". At a limit of ten, the middle row's danger case — the wall landing
> exactly where value lands — is the *likely* case rather than one branch of
> three, and it is why the free tier is deliberately built so that ten pieces
> already compute a real set of outfits (`docs/design/free-tier-contract.md`)
> rather than being a teaser. Rewriting the thresholds honestly needs real
> traffic; do not guess new numbers into this table.

| If N is… | Then |
| --- | --- |
| **~12–15** | The free tier at 30 is generous — users reach real value well before the wall, so the wall converts on capacity, not on desperation. Onboarding should target ~15 garments and stop asking. |
| **~25–30** | The free limit sits almost exactly at the value threshold. Dangerous: users hit the paywall at the same moment they first understand the product. Either raise the free limit or make onboarding aggressively push past N before the wall appears. |
| **~40+** | The free tier never lets anyone reach value, and the whole funnel is broken regardless of paywall design. The limit must move. |

We do not know N and cannot guess it. It is the first thing real traffic buys
us, and it is worth protecting the instrumentation that measures it above
everything else on the list.

---

## 5. Insights to build (in order)

Numbered because they should be built in this order — each one is only
interpretable once the ones above it are in place.

1. **Activation funnel** — install → account → tour → first garment → 10 (the
   free closet, and the end of The Ten) → 30. Segment by `source` (camera vs
   library): if camera converts far worse, the capture flow is the problem, not
   the ask. Note the denominators this needs mostly do not exist yet —
   `docs/design/positioning-contract.md` §9 catalogues the gap.
2. **The threshold analysis** (§4).
3. **Retention curve by signup cohort**, and separately by activation bucket.
   The second is the honest one — blended retention is dominated by people who
   never activated and tells you nothing.
4. **Habit depth** — `outfit_worn` per active user per week, trended. This is
   the closest thing to a "is this a daily product" number.
5. **Paywall funnel** — `paywall_presented` → purchase, split by `placement`.
   Expectation to test: `add_garment_over_limit` converts best, because a closet
   the user photographed themselves is sunk cost they can feel. `reveal_complete`
   is the new one to watch against it — it fires with *no* sunk cost and no
   refusal, immediately after the first outfit.
6. **Stylist engagement** — `stylist_question_answered` per user, and the
   questionnaire completion rate. The stylist is the Standard-tier hook; if
   nobody uses it, the tier's value proposition is wrong.
7. **Quality trend** — correction rate and cutout outcome, both trended weekly.
8. **Feature reach** — `outfit_planned`, `outfit_shared`, `garment_search_used`
   as a share of actives. This tells us what to *stop* building.

---

## 6. What the output actually is — the growth decision

All of the above collapses into **three go/no-go reads**. This is the section
that matters; everything above is machinery for producing it.

### Read 1 — Is the product real? *(activation)*

**Metric:** share of new accounts that complete ≥10 garments within 7 days.

- **Above ~40%** → onboarding works. Spend on acquisition.
- **20–40%** → the ask is too heavy. Fix onboarding before spending a dollar on
  marketing; acquisition into a leaky funnel just buys expensive churn.
- **Below 20%** → the core interaction is wrong, not the copy. Stop and rethink
  capture.

### Read 2 — Is it a habit? *(retention)*

**Metric:** week-4 retention of *activated* users (≥N garments).

- **Above ~30%** → this is a daily product and worth scaling.
- **15–30%** → useful but occasional. Viable as a subscription, but growth will
  have to come from acquisition rather than compounding.
- **Below 15%** → nobody's morning changed. No paywall or price fixes this.

### Read 3 — Does the habit pay? *(monetization)*

**Metric:** share of activated users who reach a limit, times paywall→purchase
conversion. Superwall reports the second half; PostHog reports the first.

- Reaching the wall is the leading indicator. **If few users ever hit 30
  garments, the free tier is too generous and the ceiling is a pricing problem.**
  If many hit it and few convert, it's a paywall or value-communication problem —
  and those are cheap to fix by comparison.

### The single number

If only one thing gets watched:

> **The number of users who wore an outfit Cinch suggested, in each of the last
> four weeks.**

Not installs, not signups, not MRR. It is the only metric that is simultaneously
activation, retention and product truth — it cannot be gamed by marketing, and
it cannot rise unless the app is genuinely doing its job. **If that number
compounds week over week, grow the app. If it's flat while installs rise, the
funnel is leaking and acquisition is a waste of money. If it falls, stop
shipping features and fix the core loop.**

Everything else on this page is diagnosis. That number is the diagnosis's
subject.

---

## 7. Wiring still to do

**In this channel (infrastructure):**

- Forward purchase events from the Superwall webhook to PostHog so §5.5 is
  measurable. The webhook already receives `initial_purchase`, `renewal`,
  `expiration` and friends, and it already knows the Supabase user id — a
  PostHog capture with that `distinct_id` closes the funnel without the app
  needing to know anything.
- Build the "Daily" dashboard (§3) once events exist.
- Decide whether PostHog reverse-proxies through our own domain. Not urgent —
  it matters for ad-blocker evasion on web, and this is a native app.

**Handed off to the app developer:**

- The person properties in §2a.1 — `plan`, `garment_count`, `trialing`,
  `signup_week`. This is the one that unblocks the most analysis.
- An outfit impression event (§2a.2).
- Sign-up funnel events (§2a.4).

**Blocked on launch:** everything else. There is no data yet, and every threshold
in §6 is a prior to be replaced by a measurement, not a target to hit.
