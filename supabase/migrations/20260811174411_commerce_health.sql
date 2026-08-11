-- Commerce health: the facts that say whether this feature is working.
--
-- WHY A COUNTER TABLE RATHER THAN A LOG
--
-- Most of the health report is already derivable and is NOT duplicated here:
-- quota comes from `catalog_quota`, cache size and coverage from
-- `catalog_lookups.product_count`, paid eligibility from
-- `commerce_joined_programmes`. Storing those twice would only create a second
-- number that can disagree with the first.
--
-- Three things are not derivable, because they happen inside a request and
-- leave no row behind: how many links we served direct versus paid, how often
-- the provider failed, and how often a suggestion came back empty. Those are
-- counters — one row per metric, incremented in place. A per-event log would be
-- a table that grows forever to answer a question that is only ever asked as a
-- total.
--
-- `last_at` / `last_detail` carry the most recent occurrence, which is the
-- other half of "last failure": a count of 400 failures is much less useful
-- than knowing the last one was four minutes ago and said "quota refused".

create table commerce_health (
  metric text primary key,
  value bigint not null default 0 check (value >= 0),
  last_at timestamptz,
  -- Short, and never provider text or a user's words. See the note on
  -- `note_commerce_metric` for what may go here.
  last_detail text check (last_detail is null or length(last_detail) <= 200),
  updated_at timestamptz not null default now()
);

comment on table commerce_health is
  'In-request counters for the commerce surfaces. Everything derivable from catalog_quota, catalog_lookups or commerce_joined_programmes is deliberately NOT stored here.';

alter table commerce_health enable row level security;
-- No policies. Reached only by security-definer functions and the service role;
-- there is nothing here a signed-in user has any business reading.

-- Seeded so the report can distinguish "zero so far" from "never wired up".
insert into commerce_health (metric) values
  ('suggestions_served'),
  ('suggestions_empty'),
  ('links_direct'),
  ('links_paid'),
  ('provider_failure'),
  ('rows_refused_as_irrelevant');

-- ---------------------------------------------------------------------------
-- The one writer.
--
-- `p_detail` is for OUR OWN short constant strings — 'quota_refused',
-- 'transport_error', the slot name. It must never carry provider response text
-- or anything a user typed: this table is unattributed but it is not anonymous
-- if a sentence someone wrote ends up in it, which is the same rule
-- `catalog_lookups.terms` is built around.
-- ---------------------------------------------------------------------------
create function note_commerce_metric(
  p_metric text,
  p_delta bigint default 1,
  p_detail text default null
) returns void
language sql security definer set search_path = '' as $$
  insert into public.commerce_health (metric, value, last_at, last_detail, updated_at)
  values (p_metric, greatest(p_delta, 0), now(), left(p_detail, 200), now())
  on conflict (metric) do update
     set value       = public.commerce_health.value + greatest(excluded.value, 0),
         last_at     = now(),
         last_detail = coalesce(excluded.last_detail, public.commerce_health.last_detail),
         updated_at  = now();
$$;

revoke execute on function note_commerce_metric(text, bigint, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The report.
--
-- One function so that every consumer — the health endpoint, the alert check,
-- a human at a SQL prompt — is looking at the same numbers computed the same
-- way. A report assembled separately in three places is three reports.
--
-- Deliberately returns raw facts and no verdicts. Whether 81% of quota is fine
-- depends on the day of the cycle, and that judgement belongs where the
-- thresholds are written down, not baked into the numbers.
-- ---------------------------------------------------------------------------
create function commerce_health_report()
returns jsonb
language sql stable security definer set search_path = '' as $$
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
               -- Coverage: of everything we have ever paid to ask, how much
               -- came back with anything at all. A falling number means the
               -- catalogue is answering fewer of our questions, which is the
               -- earliest signal that a slot recipe or the merchant allowlist
               -- has drifted away from what the feeds actually carry.
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
    )
  );
$$;

revoke execute on function commerce_health_report() from public, anon, authenticated;
