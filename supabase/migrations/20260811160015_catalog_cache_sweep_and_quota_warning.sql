-- Two loose ends from the catalogue work.
--
-- 1 · `sweep_catalog_cache()` existed and was never scheduled.
--
-- The workload here is mostly long-tail misses — obscure garments, described
-- once, cached as a negative, never asked for again. Those rows are exactly the
-- ones that accumulate and never get read, so an unswept cache grows without
-- bound in the one shape where the growth is pure dead weight. Daily is ample:
-- the function only deletes rows already expired for a further seven days, so
-- nothing a lookup could still have used is ever removed.
select cron.schedule(
  'cinch-catalog-cache-sweep',
  '35 4 * * *',
  $$select public.sweep_catalog_cache();$$
);

-- 2 · Warn when the metered quota crosses 80%.
--
-- Datafeedr has no overage billing: at the limit it starts returning error 301
-- and keeps doing so until the bill day. So the interesting moment is not the
-- cutoff, it is the point where the cutoff becomes predictable while there is
-- still time to act.
--
-- This raises a WARNING into the Postgres log rather than inventing an alerting
-- channel this repo does not have. It fires only on the request that CROSSES
-- the threshold, not on every request after it — a warning that repeats
-- thousands of times is one nobody reads.
create or replace function claim_catalog_request(
  p_provider catalog_provider,
  p_exact boolean default false
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  row public.catalog_quota;
  cycle date;
  threshold integer;
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

    -- Crossing 80%, once.
    threshold := (row.limit_total * 8) / 10;
    if row.used < threshold and row.used + 1 >= threshold then
      raise warning
        'catalog quota: % has used %/% requests (80%%) this cycle, resets %',
        p_provider, row.used + 1, row.limit_total,
        public.catalog_cycle_start(row.bill_day, now() + interval '1 month');
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
