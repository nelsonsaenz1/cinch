# Commerce health: runbook

*Audit items 17 and 26. Written 2026-08-11.*

## Reading the report

```bash
curl -s -X POST https://dugizuswuebrmcmvinmi.supabase.co/functions/v1/commerce-health \
  -H 'content-type: application/json' \
  -H "x-cinch-cron: $PUSH_CRON_SECRET" \
  -d '{"mode":"report"}' | jq
```

Or from SQL, without the environment half:

```sql
select jsonb_pretty(commerce_health_report());
```

The endpoint adds what the database cannot see — whether each credential is
configured, and how many merchants are allowlisted. **Presence only**: no key,
no prefix, no length, because a "starts with df_" in an ops email is still a
piece of a credential.

## The check

`pg_cron` posts `{"mode":"check"}` hourly at **:50** (`cinch-commerce-health`).
Anything `thresholds.ts` returns is mailed to `OPS_ALERT_EMAIL`.

Alerts are rate-limited **per key**, not per firing, because every condition
here is a state rather than an event: "quota is at 82%" stays true for the rest
of the cycle, and an hourly mail about it would send 700 times.

A failed send **releases** the claim so the next tick retries. That matters
precisely when the mail provider is itself unhealthy, which is the moment you
least want the system to go quiet.

## The alerts

| Key | Fires when | Cooldown |
| --- | --- | --- |
| `provider_unconfigured` | `DATAFEEDR_ACCESS_ID`/`KEY` unset | 6h |
| `unlicensed_fallback_on` | `GARMENT_SEARCH_ALLOW_UNLICENSED` is `true` | 6h |
| `quota_critical` | ≥95% of the Datafeedr cycle used | 12h |
| `quota_warning` | ≥80% | 24h |
| `cache_write_failures` | any failed cache write | 24h |
| `coverage_degraded` | <50% of lookups returned anything, on ≥50 lookups | 24h |
| `provider_failing` | >10% of suggestions failed, or any failure with no successes | 6h |
| `paid_links_without_programmes` | a link was labelled paid with no active joined programme | 1h |

Every one of these is invisible from the app. A spent quota, a failing cache
write and a stale merchant list all render as an empty shop row, which is a
state Cinch shows legitimately every day. Nothing that already surfaces as an
error to a user is alerted on.

`paid_links_without_programmes` is the inverse of the others: it fires when we
are *claiming* to earn from links while nothing is joined. It should be
unreachable — `paid` is computed from the table — so if it ever fires, the label
and the table have come apart and the app is telling users something untrue
about money. Hence the one-hour cooldown.

Thresholds are tested (`tests/commerce-health.test.ts`). A threshold reads
correctly, does nothing for four months, and is then the only thing between a
silent failure and a bill; `>=` and `>` look equally right on the page.

---

## OPEN: alert mail is not delivering

**Status as of 2026-08-11: the alert path is proven to fire and proven not to
deliver.**

`commerce-health` reaches Resend and gets **HTTP 400 `validation_error`**. The
request does not appear in the Resend account's own API log at all.

What is known:

- `RESEND_API_KEY` is set as an edge-function secret.
- `mail.cinchstyle.com` is **verified**, sending enabled, on the Resend account
  the tooling is connected to.
- The `from` address and payload shape match a send that succeeded from that
  account (via Auth SMTP) earlier the same day.

The most likely explanation is that **`RESEND_API_KEY` belongs to a different
Resend account** from the one that owns the verified domain — which would
produce exactly this: a 400 rejected before it is logged against the account we
can see.

**This is a founder action.** I cannot inspect or rotate the key without
handling the credential.

To resolve:

1. In the Resend account that owns `mail.cinchstyle.com`, create an API key with
   **Sending access** only.
2. `supabase secrets set RESEND_API_KEY=… --project-ref dugizuswuebrmcmvinmi`
3. Verify end to end without waiting for a real failure:

```sql
update catalog_quota set cache_write_failures = 1 where provider = 'datafeedr';
delete from commerce_alert_sends where key = 'cache_write_failures';
select public.commerce_health_invoke();
-- then, a few seconds later:
select content::text from net._http_response order by id desc limit 1;
-- expect: {"ok":true,"alerts":["cache_write_failures"],"mail":"sent"}
update catalog_quota set cache_write_failures = 0 where provider = 'datafeedr';
delete from commerce_alert_sends;
```

The `mail` field carries `reason:status:errorName` on failure — the error
**class** only, never the body, which quotes the request back.

Note that `build-export`'s "your export is ready" mail uses the same key and is
therefore also not delivering. It refuses politely rather than failing the
export, so the archive still appears in the app; nobody is told by email.

## Related

- `supabase/functions/commerce-health/thresholds.ts` — the rules
- `docs/commerce/sync-feeds-dormant.md` — why the Awin ingest is not scheduled
- `docs/decisions/2026-08-11-gap-shop-junk-results.md` — what this monitoring
  exists because of
