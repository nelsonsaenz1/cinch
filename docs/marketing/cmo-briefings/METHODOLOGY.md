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

## Other standing gotchas

- `reveal_complete` is a Superwall placement, not a PostHog event; the
  canonical funnel is `ehsnjWzL`; tab opened-events fire on NativeTabs mount
  unless gated on focus — see the memory note `cinch-posthog-metric-gotchas`.
- Superwall data reads through `superwall query` (ClickHouse, `sw.events_rep`,
  timestamp column is `ts`); the CLI session usually outlives the dashboard
  session — probe `superwall whoami` before declaring it logged out.
