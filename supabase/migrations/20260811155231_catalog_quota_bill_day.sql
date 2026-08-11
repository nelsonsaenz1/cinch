-- The quota cycle must roll on the PROVIDER's bill day, not on the 1st.
--
-- `claim_catalog_request` computed its cycle as `date_trunc('month', now())`,
-- which silently assumes every provider renews on the 1st. Datafeedr's actual
-- `bill_day` is 11 (read from its own /status endpoint). Those disagree for ten
-- days of every month, and they disagree in the expensive direction: on the 1st
-- our ledger would reset `used` to 0 and start authorising requests as though
-- 10,000 were available, while Datafeedr keeps counting toward a limit that does
-- not reset until the 11th. The failure mode is hitting the provider's hard
-- cutoff (error 301, terminal for the cycle, no overage) while our own gate
-- still says yes — i.e. the gate stops gating exactly when it matters.
--
-- Nothing throws when this is wrong. It just stops working for ten days.

alter table catalog_quota
  add column bill_day smallint check (bill_day is null or bill_day between 1 and 31);

comment on column catalog_quota.bill_day is
  'Day of month the provider resets its own counter. Null means "we do not know", which is treated as the 1st.';

-- The most recent bill-day boundary on or before `p_at`.
--
-- Clamped to the length of the month so a bill_day of 31 resolves to 28/29 in
-- February rather than overflowing into March and reporting a cycle that has
-- not started yet.
create function catalog_cycle_start(p_bill_day smallint, p_at timestamptz default now())
returns date
language plpgsql immutable set search_path = '' as $$
declare
  month_start date := date_trunc('month', p_at)::date;
  day_in_month integer;
  candidate date;
begin
  if p_bill_day is null then
    return month_start;
  end if;

  day_in_month := least(
    p_bill_day,
    extract(day from (month_start + interval '1 month - 1 day'))::integer
  );
  candidate := month_start + (day_in_month - 1);

  -- Not reached yet this month, so the live cycle began last month.
  if candidate > p_at::date then
    month_start := (month_start - interval '1 month')::date;
    day_in_month := least(
      p_bill_day,
      extract(day from (month_start + interval '1 month - 1 day'))::integer
    );
    candidate := month_start + (day_in_month - 1);
  end if;

  return candidate;
end;
$$;

revoke execute on function catalog_cycle_start(smallint, timestamptz)
  from public, anon, authenticated;

create or replace function claim_catalog_request(
  p_provider catalog_provider,
  p_exact boolean default false
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  row public.catalog_quota;
  cycle date;
begin
  select * into row from public.catalog_quota
   where provider = p_provider for update;

  if not found then
    return true;  -- unmetered provider, nothing to claim
  end if;

  -- Computed from the row, because the boundary is the provider's and not the
  -- calendar's. Must be read before the count is compared against the limit.
  cycle := public.catalog_cycle_start(row.bill_day, now());

  if row.cycle_start < cycle then
    update public.catalog_quota
       set cycle_start = cycle, used = 0, updated_at = now()
     where provider = p_provider
    returning * into row;
  end if;

  if row.limit_total is not null then
    if row.used >= row.limit_total then
      return false;
    end if;
    -- Inside the reserve, exact lookups still pass and keyword search does not.
    if not p_exact and row.used >= (row.limit_total - row.reserve) then
      return false;
    end if;
  end if;

  update public.catalog_quota
     set used = used + 1, updated_at = now()
   where provider = p_provider;

  return true;
end;
$$;

revoke execute on function claim_catalog_request(catalog_provider, boolean)
  from public, anon, authenticated;
