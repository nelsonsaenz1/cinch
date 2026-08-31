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

## Other standing gotchas

- `reveal_complete` is a Superwall placement, not a PostHog event; the
  canonical funnel is `ehsnjWzL`; tab opened-events fire on NativeTabs mount
  unless gated on focus — see the memory note `cinch-posthog-metric-gotchas`.
- Superwall data reads through `superwall query` (ClickHouse, `sw.events_rep`,
  timestamp column is `ts`); the CLI session usually outlives the dashboard
  session — probe `superwall whoami` before declaring it logged out.
