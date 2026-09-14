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

## ASC acquisition data IS readable — the path was wrong for five nights (2026-09-05)

**Standing correction, and the most expensive one in this file.** Five briefings (08-30,
08-31, 09-01-od, 09-01n, 09-03n) recorded impressions, page views and App Units as
**"unread — no API key"**, and ledger row A21 (create an ASC API key) sat at or near the top
of Tomorrow's Focus as the row that would unblock them. A21 was never required.

- `POST /analytics/api/v1/data/time-series` — **hyphenated, deprecated, 410 Gone.** This is
  the path every prior session called. The 09-01 correction correctly diagnosed the 410 and
  then drew the wrong conclusion from it.
- `POST /analytics/api/v1/data/timeseries` — **no hyphen, live, 200.** This is what the
  dashboard itself calls. It returns real series. It is finicky under automation (it answers
  reliably only in a short window right after the analytics route first loads, and 400s with
  *"Make sure the URL is correct"* thereafter), so **do not depend on it.**
- **Depend on the dashboard instead.** Whenever the ASC web session is alive, navigate and
  read the rendered table — it is authoritative and it never 400s:

```
Overview (all 30-day totals in one page of text):
  https://appstoreconnect.apple.com/analytics/app/d30/6798479578/overview

Daily series, one measure at a time — the table under the chart carries every day:
  https://appstoreconnect.apple.com/apps/6798479578/analytics/metrics
    ?chartType=singleaxis&dateSpec=d30&frequency=day&measureId=<M>&measureKey=<M>
  <M> ∈ impressionsTotal | pageViewCount | units | redownloads
```

Read it with `get_page_text` or `document.body.innerText` after a ~4 s settle; the
`DATE … Total …` block is the full daily table.

**The source / campaign breakdown IS readable by URL (captured 2026-09-05, engineering
session).** The parameter is `groupByDimensionKey=source` — not `dimensionKey`, which is
what the 09-05 nightly tried:
```
https://appstoreconnect.apple.com/apps/6798479578/analytics/metrics
  ?chartType=singleaxis&dateSpec=d30&frequency=day&groupByDimensionKey=source
  &measureId=<M>&measureKey=<M>
```
`get_page_text` after a ~6 s settle prints a `SOURCE TYPE … App Store Search N · App
Referrer N · App Store Browse N · Web Referrer N` table. If the dropdown is ever needed
under automation: it opens on a `find`-ref click of the *By Date* button, mouse clicks
inside it close it, but **keyboard works** — `ArrowDown ArrowDown ArrowRight` opens the
App Store submenu, six more `ArrowDown`s reach *Source Type*, `Enter` applies it (and
rewrites the URL with the parameter above). 30 days to 09-04: impressions **Search 7,074 ·
App Referrer 32 · Browse 32 · Web 1**; product page views **196 · 32 · 21 · 1**; first-time
downloads **48 · 8 · 1 · 0**. 99% of impressions are Search, and Search's own
impression→PPV is **2.77%** — the listing is underperforming, not the source mix.

**The version page's field counters are not field lengths (2026-09-07).** The 1.2.3
version page rendered `Keywords ? 0` while the API (`appStoreVersionLocalizations`) carried a
98-character keyword string on every live version — and its "What's New 3,641" was the
description's length. Read keywords, description and What's New from the API, never from the
page's counters. The live keyword string as of 09-07: `digital,stylist,organizer,clothes,what,
wear,ootd,style,calendar,inventory,clothing,ai,travel,weather` — a version-locked field; changing
it takes a new version and build.

**Three distinct ASC failures now, not two.** Probe each; never infer one from another:

| symptom | meaning | what to write |
|---|---|---|
| `/analytics/api/v1/data/time-series` → 410 | wrong path, permanent | nothing — use `timeseries` or the dashboard |
| any `/iris/v1/...` → 401, or a redirect to `login?...authResult=FAILED` | browser session expired; Nelson must re-auth with 2FA | *unread — session expired* |
| session alive, dashboard renders | data is available | **read it** |

## A falsifier must carry its own population exclusions (2026-09-06)

**Standing correction.** P3 read: *"No reconciled production purchase will exist by 2026-09-14.
Falsifier: any `asc_notifications` row with `environment='Production'` + a subscription type."*
On 09-05 a **founder-family** account (`jaysaenz99@`, one of the five `%saenz%` accounts) started a
**7-day free trial** on `cinch.standard.annual`. That produced a Production `SUBSCRIBED` row with
`outcome=applied` — satisfying the falsifier literally while collecting **$0** and proving nothing
about demand.

Every funnel query in this document carefully excludes internal accounts, family accounts, review
devices and `$app_build='1'`. **Predictions had been exempt from that discipline, and should not
be.** Rules:

1. A prediction about *customer* behaviour must name its exclusions **inside the falsifier text**,
   not rely on the reader applying them.
2. A prediction about money must say whether a trial start counts. `period_type: TRIAL` on a
   Superwall `initial_purchase` means $0 has changed hands; only a `DID_RENEW` / non-trial period
   is revenue.
3. A falsifier that has to be reinterpreted after the fact is not a falsifier. Score it against
   what it said, record the specification error, and re-issue it correctly.

## Do not name a binding constraint in a week the top-of-funnel number moved (2026-09-06)

**Standing correction, from the Sunday retro.** The thesis has now been retracted three times in
six nights: monetization-blocked (08-31) → distribution-starved (09-03) → listing/tap-through
(09-05) → day-2 retention (09-06). Each retraction was correct that the *previous* stage had
stopped binding. Each new thesis was named too fast, from a denominator too small to support it.

Before writing "the binding constraint is X":

1. Print the top-of-funnel absolute for the week **and** the prior week. If it moved more than
   ~50%, every downstream rate is measured against a shifting denominator.
2. In that case, label the thesis **provisional** in the text and say what stable denominator
   would confirm it.
3. A cohort of fewer than ~15 cannot support a strong retention claim. `0 of 8` is consistent with
   a true rate as high as ~20%. Say so in the same paragraph as the claim.

## ASC has a *third* mode: dark on the night it matters (2026-09-06)

The 09-05 correction established the `timeseries` path and the dashboard URLs. Tonight the session
was **401** (`login?...authResult=FAILED`) on the one night arrivals moved 6×, so the acquisition
question of the week went unanswered.

Operational consequence: **probe ASC first, not last.** If it returns 401, the briefing's top
Tomorrow's-Focus row is "the founder re-authenticates with 2FA" — it is a two-minute OPS action
that gates A4, source attribution and any impression-based prediction. Do not spend the run's
effort elsewhere and discover the gap at write-up time.

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

## Engineering gate accounts now use public mail domains (2026-09-07)

**Standing correction.** The internal-account filter (`%cinchstyle.com`, `demo@cinch.app`, the two
`lisa.*` addresses) missed **`cinchbounce0907@gmail.com`** and **`cinchbounce0907b@gmail.com`** —
both minted by audit ship 6's own deliberate bounce test on 09-07. Taken at face value they
inflated the day's real signup count from **9 to 11**, a 22% overstatement on the headline
scoreboard line, and both would have counted as "signed up and never added a garment" in the
first-item denominator.

They cannot be caught by domain, because the whole point of a bounce test is to use a real public
mail provider. Add the prefix to the standard exclusion:

```sql
when lower(coalesce(u.email,'')) like 'cinchbounce%' then 'gate'
```

**The general rule, which matters more than the prefix:** before quoting any day's signup,
first-item or DAU number, **read that day's engineering-session log in LEDGER.md and subtract the
accounts it says it created.** Audit ship 6 named both addresses in its own write-up; the numbers
were only wrong because the filter was applied without reading it. Gate accounts are identifiable
by the combination `last_sign_in_at IS NULL` + 0 items + created inside the session's timestamp
window.

Related: A49's `reap_unverified_signups()` now deletes never-verified rows hourly at :43, so a
gate account minted by a bounce test disappears within ~24h. Same-night briefings will see it;
later ones will not, which makes a night-of undercount and a retrospective overcount equally
possible. Always state which.

## A pessimism claim needs 20 people and 3 days (2026-09-07)

**Standing correction, and the most-repeated error in this file.** Five consecutive predictions
that users would fail to do something have all been falsified:

| id | claim | actual |
|---|---|---|
| P13 | real DAU will not exceed 6 on any day 09-04→09-10 | 10 and 8 |
| P4 | <55% of 09-01→09-08 real profiles hold ≥1 item | **63.0%** |
| P11 | <60% of 09-03→09-10 real profiles hold ≥1 garment | **62.5%** |
| — (prose) | "D1 retention on the 09-05 cohort is zero" | 2 of 13 returned at +20h and +31h |
| — (prose) | "the binding constraint is arrivals; no product work moves it" | arrivals moved 6× with nothing shipped |

**⚠️ The first draft of this section said "every prediction about whether a mechanism would work
has held — 6 of 6 (P5b, P8, P9, P10, P12, P15)." That was wrong, and the error is worth
preserving.** P8, P9 and P12 are predictions about *user behaviour*, not mechanisms — P8 and P12
are "fewer than N of 29 recipients will open the app", P9's own ledger text calls it "a prediction
that Cinch *succeeds*". They were misfiled into the mechanism column because they held, which made
the asymmetry look total. **A taxonomy assembled after the fact to fit an argument is the most
dangerous artefact this file can produce.** Bin predictions by their *subject* the night they are
issued, not by their outcome the night they are scored.

Binned honestly, the record is not "users always surprise me." It is sharper:

| kind | held | failed |
|---|---|---|
| Will a **mechanism** work? | P5b, P10, P15 | P6, P7 *(both falsified by the founder acting — the good kind)* |
| Will users **come back** after being away? | **P2** (0 of 7 expired trials returned) · **P8** (2 of 29) · **P12** (3 of 29) | — |
| Will users **finish** a step they have already started? | — | **P13** · **P4** · **P11** |

**The finding: I am reliably right when I predict users will not come *back*, and reliably wrong
when I predict users will not *finish*.** Three for three each way. Re-engagement pessimism has
been correct every time; activation pessimism has been wrong every time. Weight accordingly, and
note that the 09-06 "day-2 return is binding" call sat on the wrong side of this line — it treated
a *finishing* population as a *returning* one — which is precisely why it collapsed in a day.

**The rule:** a claim that *users will not do something* may not be stated without the word
**provisional** unless it rests on **≥20 distinct people** observed over **≥3 days**. Below that
threshold, write the number and the denominator and stop. This binds the briefing's own thesis
section: on 2026-09-07 it forced "the binding constraint has moved to the ask" (n=8) down to
"*candidate* constraint". A claim that *a mechanism does or does not work* is not covered — those
have been reliable at n=1, because a wire either carries a signal or it does not.

**Corollary — do not declare a prediction falsified before its due date if its cohort can still
grow.** On 09-07 P11 was first written up as "❌ FALSIFIED, three days early" at 15 of 24 = 62.5%
against a ≥60% falsifier. But every profile created in the remaining three days enters the
denominator immediately while its first item may arrive later, so **15/26 = 57.7% un-falsifies
it** — two non-adders reverse the verdict. Early reads are "provisionally falsified, rescore on
the due date."

**Corollary on calendar-boundary retention.** "D1 = 0 of 8" was computed with a UTC-calendar-day
test, which scores a return at **+20 hours** as a failure and a return at **+30 minutes across
midnight** as a success. Both errors occurred in the 09-05/06 cohort. Measure returns in
**elapsed hours since that person's own signup**, never in calendar days, and state the threshold.

## When PostHog is dark, Supabase is a lower bound — say which (2026-09-07)

PostHog's session expires independently of ASC's. When it is dark, arrivals, activation, closets,
paywall impressions and a *return* proxy are all reconstructable from Supabase — but only as a
**lower bound**, and the briefing must say so.

| want | Supabase substitute | direction of error |
|---|---|---|
| `Application Opened` / DAU | union of `items.created_at`, `profiles.updated_at`, `ai_calls.created_at`, `paywall_impressions.shown_at`, `push_tokens.last_seen_at` | **undercounts** — a user who opens and does nothing is invisible |
| retention / day-≥2 return | same union, `min(ts) - auth.users.created_at > 20h` | **undercounts** |
| paywall impressions | `paywall_impressions` (complete since A19, 09-05) | exact — corroborated row-for-row against Superwall on 09-07 |
| signups | `auth.users` with the internal/family/**gate** filter | exact |

Two traps found the hard way:
- **`auth.users.last_sign_in_at` is useless as a return proxy.** It does not move on session
  refresh; on 09-07 all thirteen members of the 09-05/06 cohort read `hrs_span = 0.0`.
- **A bulk SQL update looks exactly like a retention spike.** The 09-03 wind-down (A27) touched
  29 rows and renders as "29 real returning users" in any `profiles.updated_at` proxy. Exclude
  known migration and clamp timestamps before reading the series.

## UTC day vs rolling 24 hours — label every window (2026-09-07)

**Standing correction.** Three separate counts were wrong in one night's first draft because the
sources use different windows and the briefing mixed them silently:

- Superwall's Overview reports a **rolling 24 hours**. Supabase queries here are written on the
  **UTC calendar day**. ASC reports UTC days and **publishes one day late**.
- On 09-07 the third real paywall impression (`packing_access`, `52ff5b6d`) is stamped
  **2026-09-08 00:14:33Z**. It is inside "the last 24 hours" and outside "09-07". Glossing
  Superwall's `15.38%` as "3 of 13" therefore produced an arithmetic impossibility — 3/13 is 23%;
  the rate was **2 of 13**.
- The same leak moved the "since 09-05" signup total (23 rows includes a 09-08 00:11Z signup
  against a 7+6+9 = 22 UTC-day sum).

**Rule: every window in a scoreboard row carries its own label** — "UTC day", "rolling 24h",
"30d to <date>". When a fraction is offered as the gloss on a rate from another system, recompute
the fraction in *that system's* window or do not print it.

**Related, and the correct instinct:** a signup at 23:59Z whose first item lands at 00:01Z is one
session, not a day-2 return. Elapsed-hours-since-that-person's-signup is the only safe basis for
retention (see "A pessimism claim needs 20 people"), and it is the same discipline.

## Do not carry a rate forward when its denominator has grown (2026-09-07)

Search's own impression→PPV was measured at **2.77%** on 09-05 (196 / 7,074). It was quoted
unchanged on 09-07, by which time the 30-day window had rolled to **236 / 8,166 = 2.89%**. A rate
computed on a rolling window is only valid for the night it was computed. Recompute, or print the
date the rate belongs to. The same applies to "99.1%" → **99.2%** Search share, and to the "94%-US
baseline" quoted on 09-06 which measured **76%** when finally checked (09-07 §17.1).

## A condition that has never been non-zero has never been tested (2026-09-08)

**Standing correction, and the most expensive strategic one in this file.** Five Conditions #5
asks for **blended monthly ARPU ≥ $11**. It has read `❌ $0` in every briefing since 08-24 — for
a true reason, since nobody has ever paid. Because it was failing for the right reason, nobody
ever audited whether it *could* pass. On 09-08 the live App Store price list was read for the
first time: **$4.99/mo · $39.99/yr · $9.99/mo · $79.99/yr**, an amortised ceiling of **$9.99
gross / $8.49 net of Apple's 15%**.

**The condition was NOT unreachable for its entire life — and the 09-08 briefing's first draft
said it was, which is itself an instructive error.** When Condition 5 was written on 2026-08-24,
Pro monthly was **$14.99 = $12.74 net**, comfortably above the bar. Commit **`50c3ca4`,
2026-08-31 21:49**, repriced (`$14.99→$9.99`, `$119→$79.99`, `$59→$39.99`) and silently
invalidated a strategic gate written a week earlier. `handoff/d-decisions/DIRECTIVE.md:35`
records the $14.99 read from App Store Connect itself, so the old prices were **shipped, not
planned**. Eight briefings then scored a broken gate without noticing.

**Scope caveat that must travel with the claim:** the $8.49 ceiling amortises annual plans over
twelve months. On a *cash-booked* ARPU convention a month containing one $79.99 annual sale
clears $11 easily. This file has always used amortised MRR implicitly (09-01's "$50K = ~4,500
paying users at $11" is only coherent as recurring monthly revenue) but has never said so.
**State the convention whenever the claim is used.**

The rules this generalises to:

1. **Before a verdict date, re-derive every threshold against the system's own maxima.** A gate
   is only a test if passing it is physically possible. Do this once per gate, in writing, not
   on the verdict night.
2. **A metric that has been zero every night is an untested instrument, not a settled result.**
   Zero is the reading you get from a working thermometer in a cold room *and* from a broken one.
3. **A gate written against a constant must be re-derived whenever that constant changes.** The
   08-31 repricing was a commit like any other and nothing connected it to a strategic gate from
   the week before. When a price, cap or quota moves, `grep` the briefings and METHODOLOGY for
   every threshold that depends on it — the same night.
4. **Prices, caps, quotas and limits are load-bearing constants and drift silently.** They live in
   four places here — App Store Connect, Superwall's imported product table, `src/features/billing/plans.ts`,
   and the strategy docs — and on 09-08 the first three agreed while `docs/ai-models-and-tiers.md`
   and the `[[cinch-subscription-products]]` memory still carried the **pre-08-31** prices
   ($7.99/$59/$14.99/$119). **Read the price from Apple's import, never from a doc** — including
   `plans.ts`, whose `monthlyPriceHint` / `annualPriceHint` are, by its own docblock, hints while
   *"the paywall itself reads StoreKit."* They corroborate; they do not independently measure. A
   genuinely independent second read is a StoreKit product fetch or the ASC subscription-price API.
   Everything derived from price — LTV, CPI ceilings, the $50K user count — is void until rebuilt.
5. **MRR is gross.** Apple's commission is a cost, not a reduction in MRR. Do not divide an MRR
   target by a net-of-commission ARPU; the 09-08 briefing's first draft did and produced a third
   wrong $50K figure. $50K MRR ÷ $9.99 = **5,005**; $50K *net proceeds* ÷ $8.49 = 5,890.

**Where to read the live price list:** Superwall → Products & Entitlements
(`/applications/52618/products/v2`). Its footer says *"All products imported from App Store
Connect"*, so it is Apple's list. Corroborate against `src/features/billing/plans.ts`.

## Read the engineering log for CONTRADICTIONS, not just for its numbers (2026-09-08)

The 09-07 rule said: before quoting a day's signup or funnel number, read that day's
engineering-session log in LEDGER.md and subtract the accounts it created. **That is too narrow.**

On 2026-09-07 the audit-ship-6 entry recorded, from a Keyed-Release boot gate on a real
Production Superwall key, that the returning-free paywall's default button *"already reads 'Try 7
days free — then $39.99/yr' … so **A12's premise that the default tap cannot start a trial may be
stale**; worth one look in the Superwall editor."* **The same night's briefing escalated A12 to
the founder queue on the opposite premise**, and the 09-08 briefing built a thesis section on it
before catching the contradiction while writing the ledger.

**The rule: an engineering session's log can close, contradict or invalidate an OPEN ROW, not only
supply numbers. Diff it against `## Open` every night.** A sentence containing "may be stale",
"worth one look", "premise", or a named row id is a scoring event and must be resolved or
explicitly deferred with a reason — never read past.

## Superwall's dashboard reads more than the briefings have assumed (2026-09-08)

Two corrections to the standing "only Last-24-Hours is machine-readable" note:

- **The range control DOES respond to `form_input` on its `<select>`** even though it ignores URL
  parameters. `find` for "Last 24 Hours" → `form_input` the combobox ref with `"Last 7 Days"` →
  wait ~7s → `get_page_text`. 7d, 30d, 90d and custom are all reachable this way.
- **Superwall's "Paywall Rate" is `(new users in the window who saw a paywall) / (new users in the
  window)`** — not impressions over users, and not all-users. Verified 09-08: Superwall reported
  12.5% on 40 new users (= 5); `paywall_impressions` held **10** rows across 8 persons in the same
  window (every real row is dated 09-04 or later, so all 10 fall inside any 7-day window ending
  09-08), of whom exactly **5 signed up inside it**. A session that compares the raw impression
  count to the rate will read a contradiction that is not there.

## The itunes review-RSS URL in this file was wrong (2026-09-08)

`itunes.apple.com/us/rss/customerreviews/id=<ID>/sortBy=mostRecent/json` returns an **empty body**.
The working form is:

```
https://itunes.apple.com/rss/customerreviews/id=<ID>/sortBy=mostRecent/json?cc=us
```

Also: the pinned competitor track-id list (09-03) protects against name-search substitution but
**cannot detect delisting**. On 09-08, Pureple (1076555394), Combyne (1224833673) and StyleDNA
(1439466895) all returned `resultCount:0` from `lookup` and an empty review feed. Write **unread,
`resultCount:0`** — do not infer removal from the storefront, and do not fall back to a name search.

## PostHog and Superwall are readable WITHOUT a browser session (2026-09-08, engineering)

Two nights of "PostHog — UNREAD, session expired" were a browser problem, not a data problem.
The engineering session reads both through tools that hold their own credentials:

| system | how | what it answered on 09-08 |
|---|---|---|
| **PostHog** | the `posthog` MCP `exec` tool — `call execute-sql {"query": "<HogQL>"}` (also `query-trends`, `query-funnel`, `query-retention`, `persons-list`) | per-person event streams for `a874512d`, `bae15db5`, `d03875a0`; the A48 shown-vs-seen read; the four eligible-never-generated closets' Today history |
| **Superwall** | `superwall` CLI (`superwall whoami --json` → `paywalls list --project 28319 --app 52618 --json`, `campaigns list …`) | paywall 254200 carries all four products; every campaign variant points at 254200 — `returning_free` (105048), `ten_completed` (105047) and `reveal_complete` (101136) included |
| **App Store Connect prices** | `superwall asc get "/v1/subscriptions/<id>/prices?filter[territory]=USA&include=subscriptionPricePoint"` and `…/introductoryOffers` | the independent price read §16.8 asked for: $4.99 / $39.99 / $9.99 / $79.99, proceeds $4.24 / $33.99 / $8.49 / $67.99; the only intro offer is standard.annual's 1-week FREE_TRIAL, `startDate 2026-08-31` |

HogQL gotchas: alias every aggregate (`count() as n`) and avoid `first`/`last` as aliases;
`distinct_id` is the Supabase user id, so `distinct_id like 'a874512d%'` joins the two systems.
`$app_build != '1'` is the harness exclusion. Taxonomy warnings name events that have never
fired (`auth_code_bounced`, `auth_cancel_hint_taken` as of 09-08) — that is a zero, not a typo.

**The `returning_free` vs 254200 "contradiction" (09-08 §17.9) was never one.** Every campaign
routes to the same paywall, so what the 09-07 boot gate saw on `returning_free` IS paywall
254200. What the API cannot say is which product the layout pre-selects — that is a fact about
the paywall document, readable only in the editor (or by presenting it on a keyed sim and reading
the button).

## `ai_calls.outfit_generation` does not measure "saw an outfit" (2026-09-08, engineering)

Today's plates are generated **on the device** (`generateOutfits`, `use-outfits.ts` stage 1).
The server call recorded as `outfit_generation` is the *enhancement* — asked only for a complex
note, a formality conflict between events, or a measured near-tie (`should-enhance.ts`). An
ordinary morning makes zero `ai_calls` rows and still draws three outfits.

So "6 of 15 ten-piece closets have ever generated an outfit" (09-08 §8.1/§8.2, A59b) counted
the wrong thing. The instrument for *was dressed* is PostHog: `outfits_source` (plates on
Today's screen, per visit) and `outfit_set_viewed` (a Reveal plate). Re-read on 09-08: **all
four** of the "never generated" eligible closets (`89d85597`, `9a21ba7f`, `fed827cc`,
`c34290ab`) have `outfits_source` or `outfit_set_viewed` events — every one of them has been
shown outfits. Use `ai_calls.outfit_generation` for AI cost and for the stylist's server work,
never for delivery.

## Count activated closets on the wardrobe-eligible basis (2026-09-08, engineering)

`items` with `status = 'pending_tag'` are invisible to `canGenerate` (`useWardrobe` filters
to `tagged` / `needs_review` / `verified`). A "ten-piece closet" query over raw `items` counts
`ced245be` (11 pending, 0 eligible) and `c646253d` (13 pending, 5 eligible) as activated. Add
`and status in ('tagged','needs_review','verified') and not is_archived` to every closet-size
denominator. Both of those closets predate the 08-26 consent gate (last sign-in 08-18 and
08-20, `ai_consent_version` null); the T-10b floor and the Reveal's consent door already
handle them the moment either person opens the app. Nothing more to build; A61 is a
measurement rule.

## Print a line for EVERY lettered section of the sweep — including "nothing to report" (2026-09-08)

**Standing correction, and the most embarrassing in this file.** On 2026-09-08 the nightly
skipped **§F (Channels: TikTok, Instagram, Pinterest, paid) entirely** and nobody — including
the author and two adversarial fact-check passes — noticed, because **an omitted section looks
exactly like a section with no news in it.** The founder asked "you're going to Apple Ads
insights, right?" and the answer was no.

What was missed: **two Apple Search Ads campaigns Running in the US at a combined $20/day,
$131.30 spent in 7 days, avg CPA $3.65** — the largest line item in the business, against a
briefing that said in §13 *"Dollars: $0.044/day of AI. Nothing else is being spent, and nothing
else needs to be."*

Rules:

1. **Every lettered section A–G gets a printed line, every night.** If there is nothing to
   report, write "nothing live" and the date it was last checked. A section with no heading is
   a defect; a heading with "nothing to report" is a reading.
2. **Read paid spend from the ad platform, never infer it from the ledger.** The ledger had
   been carrying "Open an Apple Search Ads account — 29 nights open" as a live founder decision
   for four weeks while the account existed and was spending. A ledger row is a record of what
   someone once believed, not a source of truth about the world. Same failure mode as §"Read
   the engineering log for CONTRADICTIONS."
3. **Apple Search Ads with a `Search Results` placement is reported by ASC's Source Type
   dimension as `App Store Search`.** These are NOT distinguishable in the Source Type
   breakdown. **Any claim that traffic is "organic search" requires the Campaigns / campaign-token
   view, not the Source Type view.** A47's "the surge was 100% App Store Search" — quoted as
   organic in the 09-06, 09-07 and 09-08 briefings — could never have separated the two.

**Where to read it:** `app-ads.apple.com` → Advanced → the ad account → Campaigns (spend, CPA,
budget, status). Cross-check installs against ASC → Analytics → Acquisition → **Campaigns**, or
Metrics with `groupByDimensionKey=campaignId`. Both should agree; if they disagree, ASC's token
attribution wins. Gotcha: the Apple Ads date-range control did not accept a preset change under
automation on 09-08 — it defaults to Last 7 Days, so **state the window explicitly** and do not
assume you are looking at 30 days.


## A ship's effect is not readable on the night it ships (2026-09-08)

Audit ship 7 published four OTA update ids at ~21:1xZ on a US night. **Zero devices had opened
the app on them by publish time, and that is normal, not a failure.** The same is true of every
behavioural row a ship creates: A59's spread copy cannot be scored until real accounts reach ten
garments *after* the ship, which on current arrival rates is days away, and P23's own falsifier
names n≥8.

Rules for the night after a ship:

1. **Absence of device receipt at publish time is not evidence of a bad ship.** Verify the
   manifest, record the update ids, and read receipt the *following* night — grouped by
   `properties.$update_id` on `Application Opened`, across **all four** fleets
   ([[cinch-fleets-and-reach]]; "three fleets" is the recurring error).
2. **Never score a ship's behavioural prediction off the ship night's data.** The population that
   could satisfy it does not exist yet. This is the same defect as declaring P11 falsified three
   days early, in a different costume.
3. **When a ship changes a route, name the baseline it has to beat, in the ledger, on the night
   it ships.** A59 rerouted a full undressable closet away from the add door (which at the free
   ceiling raised `add_garment_over_limit`); the number to beat is `11e176c1`'s **61 seconds**
   from tenth garment to paywall. A "did it work?" with no pre-recorded baseline is unanswerable
   a week later.

## Apple Ads has been running since 2026-08-25 — "App Store Search" is not "organic" (2026-09-09, engineering)

The founder's Apple Ads account (`app-ads.apple.com`, "Nelson Saenz_ads", app id 23675390) has run
two US Search Results campaigns since **2026-08-25**: `CIN-EXP-003_US_SR_EXACT` ($14/day, ten exact
keywords) and `CIN-EXP-003_US_SR_DISCOVERY` ($6/day, Search Match). 30 days to 09-09: **$243.70,
5,868 impressions, 223 taps, 55 installs, CPA $4.43**; `[outfit planner]` alone is 42 of the 55.

ASC App Analytics counts Search Ads taps under the **App Store Search** source type. So every
"99% App Store Search" line since A47, the 09-05/06 surge read as "the same searchers, more of them
installing", and the 30-day 83 first-time downloads all contain paid installs — roughly two thirds of
them. Rules from tonight:
- **Read ASC Analytics → Sources → Campaigns** (Apple Search Ads appears there per campaign) before
  any attribution claim, and print organic Search as `Search − Campaigns`.
- **Every install→paid, LTV and CPI figure now has a real CPI beside it:** $3.60 on the working term,
  $4.43 blended. Quote it.
- **Popularity scores live in the Add Keywords sheet** (Ad Group → Keywords → Add Keywords; type
  candidates, read the dots, **Cancel**). Read 09-09: `fashion` 3, `clothes` 3, `what` 3, `closet` 3,
  `outfit` 3; `lookbook`, `daily`, `digital`, `capsule wardrobe`, `packing list`, `stylist`, `ootd`,
  `outfit ideas`, `clothes organizer` all **1**. The three doc'd en-US swaps are a wash (3→3, 1→1) or
  a loss (3→1): **do not swap en-US**.
- Discovery's Search Match spend matches Russian and Arabic marketplace queries (`лемана про`,
  `озон`, `shopee`, `gucci morty`); its 11 installs cost $7.76 each. A founder decision, not a
  measurement — but never count its installs as category demand.

## ASC impressions and page views CONTAIN the ad impressions and ad taps (2026-09-09, nightly)

**Standing correction, and it invalidates every tap-through figure since 09-05.** Apple Search
Ads on the Search Results placement is counted by App Store Connect not only under the
`App Store Search` source type for downloads (09-08 rule) but in **impressions and product page
views too**. 7 UTC days 09-02→09-08: Apple Ads reported **2,791 impressions / 120 taps / 40
installs**; ASC reported **4,231 impressions / 138 page views / 42 first-time downloads**. Two
thirds of the impressions and seven eighths of the page views A4 was gated on were ads.

Rules:
1. **The paid/organic split is `ASC − Apple Ads`, per UTC day, on all three measures.** ASC's own
   Campaigns view (Acquisition → Campaigns, and `groupByDimensionKey=campaignId`) answers *"There
   isn't enough data to display campaigns"* for this app — Apple Search Ads does not surface there.
   Do not wait for it.
2. **Never quote an ASC impression→PPV while a Search Results campaign is running** without
   subtracting the ad impressions and taps first, and then say how small the residual is. The
   organic residual on 09-09 was ~1,440 → ~18 → ~2 a week — too small to carry a listing thesis.
3. **The listing's own pull is readable from Apple Ads:** tap-through rate per exact keyword
   (`[outfit planner]` 13.9% over 30 days) isolates the product page against a known query. Gate
   A4-class work on that, not on ASC.
4. **Apple Ads "Installs (Total)" over-counts relative to ASC first-time downloads** by
   redownloads and (on other placements) view-through installs. Bound it with ASC's `redownloads`
   series (2 over 30 days here) before treating a match as identity.
5. **Print Apple Ads' "Last updated … UTC" stamp every night.** On 09-09 the report was stamped
   04:30Z, an hour after a campaign launched; its $0.00 was unread, not zero. Charts → Installs
   (Total) → Daily gives the per-day series that the campaign table does not.
6. **Apple Ads' "Last 7 days" preset ENDS YESTERDAY** (2026-09-10, engineering). The campaign
   table, the keyword table and the chart all default to it, and a campaign launched today
   reads $0.00 / 0 impressions on every one of them — that is what the 09-09 "$0 across 19
   Running keywords" was. Read a launch day on **"Current week"** or **"Yesterday"** (the picker
   under the date field); the "Last updated … UTC" stamp is printed under the Charts tab, not
   on the tables. A67 on 09-09 by the 12:05Z stamp: $15.39 / 78 / 11 / 6 installs.

## PostHog: `Application Opened` fires under the ANONYMOUS distinct_id (2026-09-09, nightly)

`distinct_id like '<supabase uid>%'` joins the two systems for identified events, but
`Application Opened` (and `Application Installed`, `$screen` before sign-in) is stamped with the
device's anonymous id. A return query written as `distinct_id like … and event='Application
Opened'` returned **0 for all 13** of the 09-05/06 cohort on the first run. Use the person:

```sql
… where person_id in (select person_id from events
                      where distinct_id like '<uid>%' and timestamp > now() - interval 14 day)
```

That form found `fed827cc` at +20.4 h, which 09-08 §17.3 had declared "does not reproduce" on
the Supabase proxy. PostHog `person_id`s are not Supabase ids either — `747c69f2` (PostHog) is
`ee61db9a` (Supabase); print which system an eight-character id comes from.

## A fifth fleet appears the day a store build releases (2026-09-09, nightly)

1.2.4 / build 48 was approved and live the day it was submitted, and **8 real devices were on
runtime `8f293d64` before the nightly ran** — with no OTA published for it. Every OTA from
2026-09-09 targets **five** runtimes: `8f293d64` (b48, store) · `4e646ba0` (b47) · `c5f00773`
(b43–44) · `813c6d34` (b45) · `ccfa8345` (b46). The store-current fleet is, again, the one
without a published update. Re-enumerate runtimes from `Application Opened` the night after any
release; do not carry "four fleets" forward by memory.

## Denominator-zero is a reason to wait, never a reason to kill a row triggered by a user action (2026-09-11)

**Standing correction.** The 09-09 briefing recommended killing **A28** ("stop enforcing the closet
cap as a write failure") because "no free user has hit the cap since 09-06 — denominator zero." In
the next 36 hours three real people produced **34 `clothes_import_failed {closet_limit_reached}`**
events (28 from one person in six minutes) and none returned. The defect had not gone; arrivals had
been low. A row whose trigger is a *user action* has a denominator that refills with every arrival.
Kill on effort or on a changed mechanism; on a zero denominator, write *waiting* and keep the row.

## Read Apple Ads on "Yesterday" and "Today", and a price change needs its own read the day it lands (2026-09-11)

- The campaign table's "Last 7 days" ends yesterday (09-10 rule). For a per-day series without the
  Charts tab, click the date field → **Yesterday** / **Today**; each gives one UTC day per campaign.
  09-10 read that way: A67 $27.20 / 154 / 19 / 6.
- ASC subscription prices: `/iris/v1/subscriptions/<id>/prices?include=subscriptionPricePoint,territory&limit=200`
  returns 175 rows with the territory id on `relationships.territory`; filter USA in code. **Do not
  send `filter[territory]=USA`** — the browser automation guard blocks any URL containing that
  query shape ("Cookie/query string data"). Once a scheduled price becomes current, its
  `startDate` reads **null** — "no scheduled rows" is how you know the change landed.
- **`subscriptionPricePoint.proceeds` is Apple's figure at the standard 30% commission** on the
  09-11 read ($0.70 on $0.99). The 09-08 read reported 85%. Until the Small Business Program status
  is confirmed (founder 12.11), print both and label which rate a net figure assumes.
- **A price decrease reaches existing subscribers automatically at their next renewal.** The
  family annual charges $9.99 on 09-12, not the $39.99 quoted since 09-05.

## `itunes.apple.com/lookup` cannot be navigated to under automation — fetch it (2026-09-11)

Navigating a tab to the lookup URL triggers a download (text/javascript content type) and the tab
does not change; `get_page_text` then reads whatever was there before. Use
`fetch('https://itunes.apple.com/lookup?id=…&country=us')` from any page's JS context (CORS is
open) and parse the response; the same applies to the review RSS.

## An OTA does not reach every first session (2026-09-11)

`checkAutomatically: ON_LOAD` with `fallbackToCacheTimeout: 1500` launches the new bundle only if
it downloads inside 1.5 s; otherwise the first session runs the embedded bundle and the
coordinator offers "Restart now". Grouped by `update_id` two days after audit ship 9: build 48 —
14 persons embedded-only, 7 on the ship, 2 on ship 8. A fix to the *first session* (A28, A68) is
fully in force only after the next store build; score its first-session effect on
`update_id`-matched persons only.

## Apple Ads back-fills installs for hours — read both sides of an attribution match the same night (2026-09-11, evening)

The campaign table's "Last 7 days" total for 09-04→09-10 read **46** installs at 14:30Z and **50** at
22:1xZ 09-11 — the same window, eight hours apart, no campaign change. Apple's own banner says reporting
"may not reflect data received in the last three hours"; in practice attribution lands later than that.
Rules:
- A paid-vs-ASC comparison (P28-class) is valid only when Apple Ads and ASC are read **on the same night
  for the same UTC day**, and the read time is printed beside both.
- A "Today" read of Apple Ads is a floor, not a count. Print it as "to ~HH:MMZ".
- Do not restate a prior night's install figure without saying which read it came from.

## Two runs in one day get two files (2026-09-11)

When a daytime run and a nightly both land on the same date, the second is `YYYY-MM-DD-nightly.md`
(precedent: 2026-09-01). The nightly's scoreboard "prior" column is the daytime run, and every window
label must say so — "since 14:30Z" is not "today".

## Apple bills a renewal before `expires_at` — never schedule the read at expiry (2026-09-13)

Both 09-11 runs told the next session to read the family annual's renewal "at 22:56Z 09-12", the
subscription's `expires_at`. Apple signed the Production `DID_RENEW` at **14:59:14Z**, eight hours
earlier (renewals are attempted inside the 24 h before expiry). A session that reads *at* expiry finds
the row already applied; a session that reads *for* a row stamped at expiry and does not find one would
write a false "renewal did not fire". Read renewals by `original_transaction_id` over the whole prior
day, and print the `signed_date`, not the expected time. Also observed: the price decrease reached the
existing subscriber (charged $9.99, not $39.99), and Superwall books the proceeds at **70%** ($7) — that
is Superwall's model, not Apple's ledger; the Small Business Program question (12.11) is still open.

## `returning_free`'s "valid outfit result" is arithmetic, not delivery (2026-09-13)

`placements.ts` describes `returning_free` as a return offer for an account that "already holds at least
one valid outfit result". `use-returning-free.ts` implements that as `outfitCount ≥ 1`, where the count is
Today's `countOutfits(tallyOf(items))` — a tally over the wardrobe, satisfiable by a top and a bottom the
person has never been shown together. On 09-13 `faaec810` (5 garments, `reveal_seen_at` null) returned
after 127 h and was asked for money two seconds after the app opened. When a placement's precondition
says "has an outfit", check whether the code means *could have* or *has seen*; only `reveal_seen_at` /
`outfit_set_viewed` mean the latter. Ledger A78.

## The review RSS cannot be fetched from an `appstoreconnect.apple.com` tab (2026-09-13)

`fetch('https://itunes.apple.com/rss/customerreviews/…')` from a page on `appstoreconnect.apple.com`
fails CORS (`Failed to fetch`), while `itunes.apple.com/lookup` from the same tab succeeds. The sandbox
shell has no route to `itunes.apple.com` either. Use the `web_fetch` tool for the review feed (it returns
the full JSON), or run the fetch from a `us.posthog.com` / `superwall.com` tab. Do not write "unread"
for a competitor's reviews because one origin refused the call.

## Two runs on 09-11, none on 09-12 — the Sunday run's "prior" column is the 09-11 evening run (2026-09-13)

When a nightly is skipped, the next briefing's scoreboard "prior" is the last run that happened, every
window in the delta is labelled with both endpoints, and any prediction that fell due on the skipped day
is scored on the next run with a note that it is one day late. No row is silently reprinted across a
gap: 09-13 scored A4 (night 18) and A61 (night 5) that a 09-12 run would have had to score.

## All four browser sessions can expire together — probe all four before anything else (2026-09-14)

On 09-14 ASC (`login?…authResult=FAILED`), PostHog (`/login?next=`), Superwall (`auth.superwall.com`) and Apple
Ads (`idmsa.apple.com`) were all logged out at once, on the night build 49 went live. Rules:

1. **Probe the four dashboards in the first five minutes of the run**, not when each section comes up. If all
   four are dark, the run is a Supabase / `web_fetch` / Resend / Vercel run and the briefing says so in its
   first line; Tomorrow's #1 is the four sign-ins.
2. **The sandbox has no network** (`curl us.posthog.com` → 000). The `posthog` MCP `exec` tool and the
   `superwall` CLI that the engineering sessions use are **not** in the nightly's tool list; do not write "read
   via the CLI" unless the tool is actually present.
3. **Superwall's `/applications/52618/overview` 404s**; `/applications/52618` is the entry (it redirects to auth
   when logged out).
4. **Four simultaneous expiries suggests a Chrome profile reset, not four coincidences.** If it recurs after a
   re-auth, ask about the profile before asking for another login.
5. A prediction due on a dark night is scored on the Supabase lower-bound proxy **only in the direction the proxy
   cannot be wrong in** (a hold on a return-pessimism claim), labelled, with a rescore owed the next night.

## The iTunes `lookup` edge is inconsistent across read paths — no competitor deltas from a single read (2026-09-14)

Dressly read 29,836 ratings / 2.9.5 on 09-13 (browser-tab fetch) and 29,662 / 2.9.4 on 09-14 (`web_fetch`);
Alta 14,527 → 14,380. Rating counts do not fall by 150 in a day; different CDN edges lag by different amounts.
Print competitor deltas only when consecutive nights used the **same** read path, and never from one read. The
absolute figure is fine to print with its read path named.
