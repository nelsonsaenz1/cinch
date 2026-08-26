-- Event Forwarding: Apple's App Store Server Notifications now land on our own
-- `asc-notifications` edge function (forwarded onward to Superwall), and this
-- ledger records every verified notification — the revenue seam that was
-- invisible when Superwall's dispatcher was the only witness.
-- docs/superwall/webhook-nondelivery-handoff.md, 2026-08-26.

create table public.asc_notifications (
  notification_uuid text primary key,
  notification_type text not null,
  subtype text,
  environment text not null,
  product_id text,
  original_transaction_id text,
  -- The Supabase user id, when the transaction carried one as its
  -- appAccountToken. NULL is the `unattributed` case commerce-health alarms on.
  app_account_token uuid,
  expires_at timestamptz,
  signed_date timestamptz,
  -- applied | no_change | stale | unmapped | unattributed | write_failed
  outcome text not null,
  plan text,
  received_at timestamptz not null default now()
);

comment on table public.asc_notifications is
  'Verified App Store Server Notifications (V2), received first-hand and forwarded to Superwall. Service-role only.';

-- Service-role only: RLS on with no policies. The edge function holds the
-- service key; no client has any business reading a revenue ledger.
alter table public.asc_notifications enable row level security;

create index asc_notifications_received_at_idx on public.asc_notifications (received_at desc);

-- ── commerce_health_report grows a revenue section ──────────────────────────
--
-- The handoff's task 5: "a revenue event with no matching subscriptions row
-- should surface loudly." With the ledger in place that is now a query:
-- `unattributed` and `write_failed` ARE the no-matching-row cases, `unmapped`
-- is a product nobody taught the table. thresholds.ts turns these into alerts.
create or replace function public.commerce_health_report()
 returns jsonb
 language sql
 stable security definer
 set search_path to ''
as $function$
  select jsonb_build_object(
    'at', now(),
    'quota', (
      select jsonb_build_object(
               'provider', q.provider,
               'used', q.used,
               'limit', q.limit_total,
               'remaining', greatest(q.limit_total - q.used, 0),
               'fraction_used', case when coalesce(q.limit_total, 0) > 0
                                     then round(q.used::numeric / q.limit_total, 4)
                                     else null end,
               'reserve', q.reserve,
               'cycle_start', q.cycle_start,
               'cycle_end', public.catalog_cycle_start(q.bill_day, now() + interval '1 month'),
               'bill_day', q.bill_day,
               'cache_write_failures', q.cache_write_failures
             )
        from public.catalog_quota q
       where q.provider = 'datafeedr'
    ),
    'cache', (
      select jsonb_build_object(
               'rows', count(*),
               'live', count(*) filter (where expires_at > now()),
               'expired', count(*) filter (where expires_at <= now()),
               'answered', count(*) filter (where product_count > 0),
               'coverage', case when count(*) > 0
                                then round(
                                  (count(*) filter (where product_count > 0))::numeric / count(*), 4)
                                else null end,
               'total_hits', coalesce(sum(hits), 0)
             )
        from public.catalog_lookups
       where provider = 'datafeedr'
    ),
    'monetisation', (
      select jsonb_build_object(
               'joined_programmes', count(*) filter (where active),
               'networks', coalesce(
                 jsonb_agg(distinct network) filter (where active), '[]'::jsonb)
             )
        from public.commerce_joined_programmes
    ),
    'counters', (
      select coalesce(jsonb_object_agg(
               metric,
               jsonb_build_object('value', value, 'last_at', last_at, 'last_detail', last_detail)
             ), '{}'::jsonb)
        from public.commerce_health
    ),
    'revenue', (
      select jsonb_build_object(
               'events_7d', count(*) filter (where received_at > now() - interval '7 days'),
               'unattributed_7d', count(*) filter (
                 where outcome = 'unattributed' and received_at > now() - interval '7 days'),
               'unmapped_7d', count(*) filter (
                 where outcome = 'unmapped' and received_at > now() - interval '7 days'),
               'write_failed_7d', count(*) filter (
                 where outcome = 'write_failed' and received_at > now() - interval '7 days'),
               'last_event_at', max(received_at)
             )
        from public.asc_notifications
    )
  );
$function$;
