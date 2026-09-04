# CMO briefing methodology — read before writing a briefing

There is no automated pipeline; each briefing is authored by a session. These
rules bind every author, human or agent. Amend them here, not in a briefing.

## Exclude Apple review devices from every funnel number

**Standing correction (2026-08-30).** The 08-30 briefing's headline funnel
alarm — "auth_failed fired 102× across 26 users; roughly a third of arrivals
hit a broken sign-in" — was **Apple App Review devices, not users**. Proof:
the cohort also entered the email flow 61× with zero completions, zero send
failures, zero wrong-code events (both rails "dead" with no error trail);
geo was 5× Cupertino CA + 7× null (Apple's review proxies); bursts aligned
with review passes on builds 41→45. Real-user auth in the same window:
Apple 24 starters → 22 completed.

Before quoting ANY auth/funnel/DAU number:

1. Build the exclusion cohort: persons whose events are auth-only
   (`auth_started`/`auth_failed`/`$identify`-class) with zero
   `auth_completed`, AND whose `$geoip_city_name` is `Cupertino` or null.
2. Exclude them from every count. In HogQL:
   ```sql
   WITH review_devices AS (
     SELECT person_id FROM events
     GROUP BY person_id
     HAVING countIf(event = 'auth_completed') = 0
        AND countIf(event NOT IN ('auth_started','auth_failed','$identify','$set',
                                  'Application Opened','Application Became Active',
                                  'Application Backgrounded','update_check_started',
                                  'update_check_finished')) = 0
        AND (anyIf(properties['$geoip_city_name'], properties['$geoip_city_name'] != '') = 'Cupertino'
             OR max(properties['$geoip_city_name']) = '')
   )
   ... WHERE person_id NOT IN (SELECT person_id FROM review_devices)
   ```
3. Expect a fresh burst around EVERY App Review (each submission → a day or
   two of Cupertino auth attempts). Since 2026-08-31, apple `auth_failed`
   events carry a bounded `code` property — review-device failures label
   themselves with `ERR_*` codes.
4. If a number would flip a verdict depending on the exclusion, print both
   and say so.

## Denominator before diagnosis (2026-08-31)

**Standing correction.** Three consecutive briefings (08-28, 08-30, 08-31) opened
with a bold ALERT that a later session had to retract. All three failed the same
way: a cause was inferred from *absent events* without first establishing how
many users could possibly have produced them.

The 08-31 case is the clearest. The alert claimed a code regression breaking the
Reveal between phases `zero` and `counting`. In fact **no user had ever run
`zero → counting`** — `zero` was terminal by design — and the "full chain" seen
on 8/20–21 was two different users' event streams interleaved by date. The
phases went quiet 8/21→8/31 because **nobody arrived**: the Reveal was reachable
only from The Ten's finish until the Today door shipped 8/30.

Before writing any ALERT:

1. **Establish the denominator.** How many users were *eligible* to hit this
   step, and by what route did they get there? Zero completions out of zero
   arrivals is not a defect. Silence usually means nobody came.
2. **Verify sequences per `person_id`, never by daily aggregate.** Two users'
   streams on one day are indistinguishable from one user progressing then
   failing. This is exactly how 08-31 went wrong.
3. **Check what shipped.** `git log --since="36 hours ago"` — a new door or
   entry point explains a burst; its absence explains a silence.
4. **Run a falsification pass.** State the claim, then run a second,
   differently-shaped query *designed to disprove it*. Without that second
   query it is a HYPOTHESIS and must be labelled one, not an ALERT.
5. A terminal state is not a failure. `reveal_phase phase=zero` with
   `zero_reason` (unpairable | unread | no_consent | query_failed) is an honest
   answer, not a break.

No alert is better than a retracted one.

## Exclude the journey harness / dev builds too (2026-09-01)

Review devices are not the only non-users. **Persons with `$app_build = "1"` are dev
builds or the controlled journey harness**, not customers. On 2026-09-01 person
`115d6391` fired 311 events across every surface of the app in 90 minutes, including the
first end-to-end `reveal_phase` completion since 8/21 and five `paywall_presented`
events. Every one of those would have been a false headline.

Signature to look for, any one of which is enough to quarantine:
- `$app_build` is `"1"` or otherwise not a real build number (real fleet: 45, 46);
- >100 events from one person inside a couple of hours spanning nearly every event name;
- activity that begins minutes after an engineering commit lands.

Add the exclusion alongside the review-device CTE. A completion on a dev build is
evidence the **code** works. It is never evidence a **user** did anything.

## Denominator, restated for step-level claims (2026-09-01)

Before calling any step "the bottleneck", print the absolute user count at *every* step
above it from the DB, not from event counts. On 2026-09-01 the Reveal had been the
headline for three nights; its 10-day production audience turned out to be **two people**,
while 19 users were being lost at "add your first garment" in the same data. The last
visible step in a funnel is not the largest loss — it is just the one where the numbers
get small enough to look broken.

Prefer Supabase denominators over PostHog for population questions (`profiles`, `items`
per user). Instrumentation undercounts: `clothes_import_completed` showed 12 importers
where the `items` table showed 15.

## Review devices now browse — the auth-only CTE under-excludes (2026-09-01)

**Standing correction.** The §1 CTE above missed **16 of 16** Apple review passes on
2026-09-01, because review devices no longer only attempt auth — they fire `$screen`,
`today_opened`, `weather_state` and more, so the `countIf(event NOT IN (…)) = 0` test
fails and they survive the filter. Taken at face value they read as "17 people could not
sign in", a leak the same size as the real first-item leak. There was one real person.

**Use this signature instead** (it caught all 16 and kept the one genuine failure):

```sql
select person_id from events where timestamp > now() - interval 14 day
group by person_id
having has(groupArray(properties['$app_build']), '1')            -- dev / harness
    or ( countIf(event = 'auth_completed') = 0
         and countIf(event = 'auth_started') >= 2
         and dateDiff('second', min(timestamp), max(timestamp)) < 600
         and anyIf(properties['$geoip_city_name'],
                   properties['$geoip_city_name'] != '')
             in ('Cupertino','Sunnyvale','') )
```

The tell is the shape, not the geography: **7–12 `auth_started` inside a 100–250-second
window, 30–50 total events, and exactly one `$app_build` per historical build number**
(32, 34, 36, 41, 44, 45, 46, 47 — one review pass each). Sunnyvale is Apple too.

A person who fails auth over a *long* span, or only a handful of times, is a customer:
`ab374450` (Stuart FL, build 46, 3 attempts in 23 seconds, 2026-08-31) is the only real
sign-in failure in fourteen days.

## Internal accounts are not signups (2026-09-01)

Supabase `profiles` includes ~10–11 internal accounts. Exclude them from **every**
population number, not just funnel ones:

```sql
where u.email not like '%@cinchstyle.com'
  and u.email <> 'demo@cinch.app'
  and u.email not in ('lisa.2wxrklc.paid@icloud.com','lisa.2wxrkclc.paid@icloud.com')
```

On 2026-09-01, **three of the four profiles created that day were QA accounts and two of
them held ≥10 items**. Reading the day's first-item rate off the raw table gives 75%; the
real figure is one signup. The canonical list of internal accounts lives in
`docs/marketing/email/PROGRAM.md` §2 and should be kept in sync.

Also: `style_profiles` has one row per profile and is **created by a trigger on signup**.
It is *not* evidence that anyone completed onboarding — 47 of 48 rows have an empty
`summary`. Use `style_profile_saved` in PostHog for that.

## Other standing gotchas

- `reveal_complete` is a Superwall placement, not a PostHog event; the
  canonical funnel is `ehsnjWzL`; tab opened-events fire on NativeTabs mount
  unless gated on focus — see the memory note `cinch-posthog-metric-gotchas`.
- Superwall data reads through `superwall query` (ClickHouse, `sw.events_rep`,
  timestamp column is `ts`); the CLI session usually outlives the dashboard
  session — probe `superwall whoami` before declaring it logged out.

## ASC Analytics is 410 Gone — stop calling it "logged out" (2026-09-01, nightly)

**Standing correction.** Three briefings (08-30, 08-31, 09-01-od) recorded impressions,
page views and App Units as unread because "the ASC session was logged out." That
diagnosis was wrong every time. The session is fine. The **endpoint** is dead:

```
POST https://appstoreconnect.apple.com/analytics/api/v1/data/time-series
→ 410  "This URL is deprecated. To access data outside of the App Store Connect web
        dashboard, please refer to the Analytics Reports API."
```

What still works from a logged-in ASC tab, and should be used every night:

```js
// versions + store state
GET /iris/v1/apps/6798479578/appStoreVersions?limit=5
    &fields[appStoreVersions]=versionString,appStoreState,createdDate,releaseType
// review text AND whether a developer reply exists (relationships.response.data === null)
GET /iris/v1/apps/6798479578/customerReviews?limit=20&include=response&sort=-createdDate
// promo text / keywords in force
GET /iris/v1/appStoreVersions/<versionId>/appStoreVersionLocalizations
    ?fields[appStoreVersionLocalizations]=locale,promotionalText,keywords,whatsNew
```

Also useful and unauthenticated: `itunes.apple.com/lookup?id=6798479578&country=us` gives
live version, `currentVersionReleaseDate` (the exact moment a build went live), rating and
rating count; `itunes.apple.com/search?term=…&entity=software` gives competitor ratings
without a session.

**Impressions, PPV, App Units and source/campaign attribution remain unreadable until an
App Store Connect API key exists** (Users and Access → Integrations → App Store Connect
API). That is ledger row A21. Until it lands, write *unread — no API key*, and never write
*logged out* again.

## `closet_floor_shown` is not an empty-closet event (2026-09-01, nightly)

It fires on the closet surface generally — persons with **123** and **51** garments have
fired it, and on 09-01 it fired 0.8s after `today_opened` alongside a `$screen`, the
NativeTabs mount pattern. Do **not** use `closet_floor_shown → clothes_import_selected`
as a step conversion; the 09-01-od briefing did and had to downgrade the claim to a
hypothesis the same night.

For "did this signup ever add a garment", use Supabase: real `profiles` in the window
versus `count(distinct user_id)` in `items`. That denominator needs no instrumentation and
has agreed with PostHog's `auth_completed` to within one on three consecutive nights.

## The internal-account filter was wrong for a month (2026-09-02)

**Standing correction.** The filter in §"Internal accounts are not signups" uses
`email not like '%@cinchstyle.com'`, which **does not match `@mail.cinchstyle.com`** —
the `@` is not adjacent to `cinchstyle.com` in a subdomain address. Two probe accounts
(`launch-probe@mail.cinchstyle.com`, `hello@mail.cinchstyle.com`) were counted as real
users in every briefing that quoted a "real profiles" number.

**Use this instead** (drop the `@`, so subdomains are caught):

```sql
where lower(coalesce(u.email,'')) not like '%cinchstyle.com'
  and lower(coalesce(u.email,'')) <> 'demo@cinch.app'
  and lower(coalesce(u.email,'')) not in
      ('lisa.2wxrklc.paid@icloud.com','lisa.2wxrkclc.paid@icloud.com')
```

Full list of accounts the old filter missed: `qa-closet-recut-verify@`, `sim-test@`,
`launch-probe@mail.`, `hello@mail.`, `fixture-ada@`, `sim-test+j00@`, `simtestf31@`,
`sim-test+ja@` — all `cinchstyle.com`.

**Also pending a founder ruling: five `%saenz%` accounts** (`nelsonsaenz1@`, `jaysaenz99@`,
`avasaenz06@`, `karencsaenz@`, `colesaenz5@`) hold **57 items**, wrote **one of the two
5★ App Store reviews** ("Saenz AE"), and supplied **the only response to Dispatch No. 01**.
Until ruled on, print family-included and family-excluded figures wherever the split
changes a verdict — on 09-02 the 14-day first-item rate was 17/33 (52%) including them and
15/30 (50%) excluding them, and the Dispatch response rate was 1/23 versus 0/22.

## Email engagement: a plain-text send cannot report opens (2026-09-02, nightly)

The 29 conversion notes of 2026-09-02 were sent **plain text**. A plain-text email carries
no tracking pixel, so Resend's `opened` / `open_rate` are not merely undercounted — they
are **structurally incapable of being non-zero**. The 09-02 midday briefing hedged this as
"the pixel is measurably blinder than the product analytics"; that was too weak.

- For text batches, **do not print open rate at all.** Write *unreadable — text send*.
- Judge every send by **in-app events keyed on the recipients' `distinct_id`s**, which is
  also the only measure that survives Gmail/Yahoo image proxying on HTML sends.
- `delivered` is still meaningful and should still be printed.

## Read the message before diagnosing the response (2026-09-02, nightly)

0 of 29 recipients opened the app in 11 hours. Before reaching for any behavioural
explanation, I opened the delivered message via `get-email`. **It contains no link** — no
button, no universal link, not even an App Store link; the call to action is the sentence
"inside the app under Membership." All three HTML templates in `docs/marketing/email/`
point their CTA at `apps.apple.com/app/id6798479578`, a store page for people who already
have the app.

The rule this generalises to: **an outbound result is not a user signal until the artefact
has been read.** Before attributing a campaign result to audience behaviour, fetch the
thing that was actually sent and check that acting on it was possible. Note also that the
causal claim ("the missing link caused the zero") remains a HYPOTHESIS — 11 hours is short
and cold email to lapsed free users is low-yield regardless. What is a fact is that the
offer shipped with no way to accept it.

## Count the fleets before writing "all fleets" (2026-09-02, nightly)

Every ledger row from 09-01 onward said OTA fixes shipped "to all three fleets."
There are **four** with active users. `Application Opened`, 14d, excluding
`$app_build='1'`, by `update_id` runtime:

| runtime | builds | persons / returning | last open |
|---|---|---|---|
| `813c6d34` | 45 (1.2.1) | 22 / 11 | 09-02 |
| **`c5f00773`** | **43–44 (1.2.0)** | **21 / 10** | **09-02** |
| `18938ff9` | 40–41 | 11 / 10 | 08-27 (stale) |
| `ccfa8345` | 46 (1.2.2) | 6 / 2 | 09-01 |
| `4e646ba0` | 47 (1.2.3, store-current) | 5 / 2 | 09-02 |

`c5f00773` is frozen at OTA `01a049c3` (8/31) and received neither A15 nor A16. **The
store-current fleet is the *smallest*.** Enumerate runtimes from the data before claiming
coverage, and verify each via a `u.expo.dev` manifest fetch *and* a production
`Application Opened` carrying the new update id. Persons whose `update_id` does not start
`01a0…` are running the embedded bundle (first-launch-only installs) — not an OTA failure.

## ASC has two distinct failures — 410 and 401 (2026-09-03, nightly)

The 09-01 correction taught "stop writing *logged out*, the endpoint is 410." Tonight the
session **was** genuinely logged out, and the distinction matters because the unblocks differ:

- `POST /analytics/api/v1/data/time-series → 410 Gone` — permanent. Only an **App Store
  Connect API key** fixes it (ledger A21). Write *unread — no API key*.
- Any `/iris/v1/...` call returning **`401 NOT_AUTHORIZED`**, or a navigation landing on
  `appstoreconnect.apple.com/login?...&authResult=FAILED` — the **browser session** has
  expired. Nelson must re-authenticate with 2FA. Write *unread — session expired*.

Probe both every night; do not infer one from the other. When the session is 401, build
state, the review queue, agreement banners, promo-text verification and featuring status
are all unread, and the briefing must say so rather than reprinting last night's values.

Unauthenticated fallbacks that still work and should be used when ASC is 401:
`itunes.apple.com/lookup?id=6798479578&country=us` (live version, release moment, rating,
rating count, screenshot count, description, release notes) and
`itunes.apple.com/us/rss/customerreviews/id=6798479578/sortBy=mostRecent/json`
(full written review text and version — but **not** whether a developer reply exists).

## The competitor list must be verified by track id, not by search term (2026-09-03)

Searching iTunes for a competitor by **name** silently returns the wrong app. "Alta"
returned *CoreX-ROBOT* (id 6739418161, 0 ratings, 2024) on every prior run, so every "Alta"
line in every prior briefing described an unrelated app. The rotation also omitted the
category's largest players entirely.

**Pin these track ids and look them up directly:**

| app | id |
|---|---|
| Dressly: AI Outfit Maker | 6738174180 |
| Alta Daily: Digital AI Closet | 6481705400 |
| Whering | 1519461680 |
| Stylebook | 335709058 |
| Fits — Outfit Planner & Closet | 6447482321 |
| Acloset | 1542311809 |
| Indyx | 1599179405 |
| Cladwell | 1140550878 |
| Pureple | 1076555394 |
| Combyne | 1224833673 |
| StyleDNA | 1439466895 |
| **Cinch** | **6798479578** |

Rank the table by **rating count**, not by familiarity. When a new name appears in a search
result above one of these, add it to the table rather than discarding it.

## Establish the denominator for the *business*, not only for the step (2026-09-03)

Six consecutive briefings led with monetization while the arrival rate fell 15 → 3 real
daily actives. Each individual claim was denominator-checked; the *framing* was not. Every
conversion rate in this document has a denominator of about three people a day, which
makes all of them unfalsifiable noise.

Before choosing what a briefing leads with, print the top-of-funnel absolute number
(installs, real DAU) and ask whether any downstream rate could move the business at that
volume. If it could not, the lead is distribution, whatever else broke that day.

## `paywall_eligible` is a denominator, not a success (2026-09-02)

`presentPromo` fires `paywall_eligible` on **every** call, offered or not
(`present-promo.ts`). Read the `eligible` boolean and `reason` before concluding anything:

- `eligible: true, reason: 'ok'` → the ask was made; expect `paywall_presented` to follow.
- `eligible: false, reason: 'not_free'` → **the user is inside a trial.** The trial fold in
  `use-gate.ts` raises a trialing account above `'free'`, so a row reading `plan='free'`
  with a future `trial_ends_at` is silently unaskable. This is the cause of
  install→paid = 0% (see 2026-09-02 §8.1, ledger A27).
- `reason: 'trialing' | 'caps_unknown' | cap reasons` → deliberate suppressions.
- `reason: 'import_failure_grace'` → A16's ten-minute window.

**Never count `paywall_eligible` as an impression**, and never infer a broken Superwall
campaign from "eligible fired, presented did not" without checking the `eligible` flag —
on 09-02 that would have blamed the campaign layer for a trial-state suppression.
