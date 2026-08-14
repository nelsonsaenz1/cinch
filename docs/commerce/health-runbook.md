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

## CLOSED: alert and export mail are delivering

**Verified 2026-08-11:** the replacement sending-only Resend key is live. The
alert path delivers, holds its cooldown only after a successful delivery, and
releases a failed claim. The export sweep also builds the archive and delivers
the ready email.

| Check | Evidence |
| --- | --- |
| Commerce alert | Delivered, Resend message `61139235-6546-4572-86ca-6b7cf6d54118` |
| Cooldown | Second invocation returned `{"ok":true,"alerts":[],"suppressed":1}`; `send_count = 1` with `last_sent_at = 2026-08-11 20:00:43+00` |
| Cleanup | `cache_write_failures = 0`; `commerce_alert_sends` empty |
| Export | Replacement archive ready at `2026-08-11 20:38:25+00`, 3,121 bytes |
| Export email | Delivered, Resend message `889ada13-c455-4065-b7cc-06aaf1772bdd` |

The export sweep requires three Vault entries: `export_build_url`,
`export_sweep_secret`, and `export_service_key`. The lowercase Vault
`export_sweep_secret` must exactly match the Edge Function secret
`EXPORT_SWEEP_SECRET`. A scheduled cron run can report `succeeded` while
`export_invoke()` returns `NULL` when those entries are absent, so verify the
function result—not only `cron.job_run_details`—after rotating either value.

### Historical failure and diagnosis

Before the rotation, `commerce-health` reached Resend and got **HTTP 400
`validation_error`**, and the request did not appear in the Resend account's API
log at all.

### The payload is not the problem — measured, not assumed

The byte-identical message was sent through the same account by other means and
was accepted:

| | |
| --- | --- |
| Verified | 2026-08-11 |
| Message ID | `9de8f908-3f48-48a8-b2ed-ab83da251a91` |
| From | `Cinch <hello@mail.cinchstyle.com>` |
| Subject | `[warning] Cinch commerce: 1 catalogue cache writes have failed` |
| Result | accepted, delivered |

Same `from`, same subject, same `text`/`html` shape `commerce-health/mail.ts`
builds. The sender address, the domain, the recipient and the body are all fine.

### What that left

`RESEND_API_KEY` itself. The connected account holds exactly two keys:

| Key | Created |
| --- | --- |
| `Claude Code` | 2026-08-05 20:02 UTC |
| `Vercel web (inbound)` | 2026-08-11 12:09 UTC |

`RESEND_API_KEY` was set on the Supabase project at **2026-08-11 16:13 UTC** —
matching neither creation time. So it is either a key from a different Resend
account, or the `(inbound)` key, whose name suggests it was created for
*receiving* and would therefore lack **Sending access**. Either produces exactly
this failure: a 400 rejected before it is attributed to the account we can see.

### Rotation procedure

Rotating this requires the key value to pass through a transcript and a shell
history, which is the one thing Claude does not do with credentials on this
project. Two steps:

1. In the Resend account that owns `mail.cinchstyle.com`, create an API key with
   **Sending access**. Name it something like `cinch-edge-sending` so it is
   never confused with the inbound key again.
2. ```bash
   supabase secrets set RESEND_API_KEY=<the-new-key> --project-ref dugizuswuebrmcmvinmi
   ```

### Then verify — both sends, in order

The first alert must **arrive**, and the second must be suppressed **by the
cooldown having already delivered** — not suppressed because it never sent.

```sql
-- 1. clean slate, then trip one real condition
delete from commerce_alert_sends;
update catalog_quota set cache_write_failures = 1 where provider = 'datafeedr';

-- 2. first fire — expect mail "sent", and an email in the inbox
select public.commerce_health_invoke();
select content::text from net._http_response order by id desc limit 1;
--    {"ok":true,"alerts":["cache_write_failures"],"mail":"sent"}

-- 3. second fire — expect SUPPRESSED, with the claim still held
select public.commerce_health_invoke();
select content::text from net._http_response order by id desc limit 1;
--    {"ok":true,"alerts":[],"suppressed":1}
select key, send_count, last_sent_at from commerce_alert_sends;
--    cache_write_failures | 1 | <a timestamp from step 2, NOT a century ago>

-- 4. put it back
update catalog_quota set cache_write_failures = 0 where provider = 'datafeedr';
delete from commerce_alert_sends;
```

Step 3 is the one that matters. `send_count = 1` with a recent `last_sent_at`
means the cooldown is holding a *successful* delivery. If `last_sent_at` is a
century in the past, `release_commerce_alert` fired — the mail failed and the
suppression is the wrong kind.

Then confirm both appear in Resend's log and record the **timestamp and message
IDs** in the table above. Never the key.

### And build-export

The same key backs "your export is ready". It refuses politely rather than
failing the export, so the archive still appears in the app and nobody is told by
email. After rotating, trigger an export and confirm that mail arrives too —
same rule: record the message ID here, not the key. The 2026-08-11 verification
above exercised the production request RPC, scheduled sweep, archive write and
Resend delivery.

## Related

- `supabase/functions/commerce-health/thresholds.ts` — the rules
- `docs/commerce/sync-feeds-dormant.md` — why the Awin ingest is not scheduled
- `docs/decisions/2026-08-11-gap-shop-junk-results.md` — what this monitoring
  exists because of
