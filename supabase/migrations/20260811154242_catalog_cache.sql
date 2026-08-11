-- ===========================================================================
-- The catalogue lookup cache.
--
-- WHY THIS EXISTS AT ALL, AND WHY IT IS THE WHOLE COST STORY.
--
-- Every provider we can legally use is metered, and two of the three meter
-- REQUESTS rather than results:
--
--   Datafeedr  10,000 requests/month on the $49 Starter plan, 100 products
--              per request, HARD CUTOFF at the limit (error 301) with no
--              overage billing. That is ~333 requests/day.
--   Amazon     1 TPS / 8,640 TPD for a new account, and access is revoked
--              after 30 consecutive days with no qualifying sales.
--   Sovrn      100 req/s, no documented monthly cap.
--
-- 333 requests/day is nothing if each user lookup costs one request. It is
-- enormous if lookups are shared. The saving move is that garment lookups are
-- massively duplicated ACROSS users: "black reformation midi dress" is not a
-- personal query, it is a global one. One request answers it for everybody who
-- ever asks again. So the cache is keyed on the NORMALISED QUERY, not on the
-- user — a per-user cache would be a rounding error, a global one is the
-- difference between viable and not.
--
-- The second saving is batching. Datafeedr bills one request whether it
-- returns 1 product or 100, so we always ask for 100 and cache every row. A
-- naive client that asks for 6 tiles burns the same quota and throws 94 rows
-- away.
--
-- WHY NEGATIVE RESULTS ARE CACHED TOO.
--
-- A miss costs exactly as much as a hit. Without negative caching, an
-- unfindable garment ("my nan's cardigan") is re-queried every time anybody
-- describes it, and obscure items are precisely the ones people re-describe.
-- Negative rows get a shorter TTL than hits, because a miss is more likely to
-- become a hit than a hit is to become wrong.
--
-- WHY TTL IS PER PROVIDER AND NOT ONE NUMBER.
--
-- Amazon's Associates policy is explicit: "You will not store or cache Product
-- Advertising Content consisting of an image, but you may store a link to
-- Product Advertising Content consisting of an image for up to 24 hours", and
-- non-image content is also capped at 24 hours. That is a contractual ceiling,
-- not a tuning knob, so it lives in the schema as a CHECK rather than in
-- application code where somebody would eventually raise it for performance.
-- Datafeedr feeds refresh daily at best, so a week is honest there.
-- ===========================================================================

create type catalog_provider as enum ('datafeedr', 'sovrn', 'amazon');

create table catalog_lookups (
  -- sha256 of (provider || mode || normalised query). Deterministic so two
  -- users phrasing the same garment the same way collide on purpose.
  cache_key      text primary key check (char_length(cache_key) = 64),
  provider       catalog_provider not null,
  -- 'keyword' | 'barcode' | 'url'. Exact modes are cheaper AND better, so the
  -- caller tries them first; recording which one answered lets us see whether
  -- that ordering is actually paying off.
  mode           text not null check (mode in ('keyword', 'barcode', 'url')),
  -- Kept for debugging and for rebuilding the cache after a schema change.
  -- NOT a user identifier: normalisation strips everything personal.
  query          text not null check (char_length(query) between 1 and 400),
  -- The full provider payload, already normalised to our own shape. Null is a
  -- real value here and means "asked, found nothing" — see negative caching.
  products       jsonb,
  product_count  integer not null default 0 check (product_count >= 0),
  fetched_at     timestamptz not null default now(),
  expires_at     timestamptz not null,
  -- How many times this row was served instead of a provider call. The only
  -- honest measure of whether the cache is earning its keep.
  hits           integer not null default 0 check (hits >= 0),

  -- Amazon's 24-hour ceiling, enforced where it cannot be quietly widened.
  constraint catalog_amazon_ttl_ceiling check (
    provider <> 'amazon' or expires_at <= fetched_at + interval '24 hours'
  ),
  -- A row that claims products must have them, and vice versa. Cheap guard
  -- against a provider adapter that half-fails and writes an empty hit.
  constraint catalog_count_matches_payload check (
    (products is null and product_count = 0)
    or (products is not null and product_count > 0)
  )
);

-- The only query path that matters: "is there a live answer for this key".
-- Partial on expiry is pointless (expires_at moves), so it is a plain btree
-- and the freshness test rides in the WHERE clause.
create index catalog_lookups_expiry on catalog_lookups (expires_at);
create index catalog_lookups_provider_fetched on catalog_lookups (provider, fetched_at desc);

alter table catalog_lookups enable row level security;
-- No policies. Service role only: this table is an infrastructure cache, not
-- user data, and a client that can read it can enumerate what other people are
-- searching for.

-- ---------------------------------------------------------------------------
-- Provider quota ledger.
--
-- Datafeedr stops dead at the monthly limit rather than billing overage, so
-- "how many requests have we spent this cycle" is not telemetry, it is a
-- control input. The provider's own /status endpoint is authoritative but
-- costs a request to read; this table is the local running count that lets us
-- refuse a call BEFORE spending the request that would have failed.
-- ---------------------------------------------------------------------------
create table catalog_quota (
  provider     catalog_provider primary key,
  -- Start of the current billing cycle. Datafeedr renews on bill_day.
  cycle_start  date not null,
  used         integer not null default 0 check (used >= 0),
  -- Mirrored from the provider on the last /status read. Null = unknown, which
  -- the caller must treat as "do not throttle", never as "unlimited".
  limit_total  integer check (limit_total is null or limit_total > 0),
  -- Below this many remaining, only exact-mode (barcode/url) lookups are
  -- allowed through. Keyword search is the speculative one, so it is what gets
  -- cut first when the tank runs low.
  reserve      integer not null default 500 check (reserve >= 0),
  updated_at   timestamptz not null default now()
);

alter table catalog_quota enable row level security;

insert into catalog_quota (provider, cycle_start, reserve) values
  ('datafeedr', date_trunc('month', now())::date, 500),
  ('sovrn',     date_trunc('month', now())::date, 0),
  ('amazon',    date_trunc('month', now())::date, 0);

-- ---------------------------------------------------------------------------
-- Claim a provider request, or refuse it.
--
-- Returns true if the caller may spend one request. SECURITY DEFINER and
-- service-role-only by grant: the client never reaches this, only the Edge
-- Function does. Atomic because two concurrent lookups must not both believe
-- they took the last request of the month.
-- ---------------------------------------------------------------------------
create function claim_catalog_request(
  p_provider catalog_provider,
  p_exact boolean default false
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  row public.catalog_quota;
  cycle date := date_trunc('month', now())::date;
begin
  select * into row from public.catalog_quota
   where provider = p_provider for update;

  if not found then
    return true;  -- unmetered provider, nothing to claim
  end if;

  -- Roll the cycle before reading the count, so the first call of a new month
  -- is not refused by last month's total.
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

-- ---------------------------------------------------------------------------
-- Sweep expired rows. Cheap, and keeps the table from growing without bound on
-- a workload that is mostly long-tail misses.
-- ---------------------------------------------------------------------------
create function sweep_catalog_cache() returns integer
language sql security definer set search_path = '' as $$
  with gone as (
    delete from public.catalog_lookups
     where expires_at < now() - interval '7 days'
    returning 1
  )
  select count(*)::integer from gone;
$$;

revoke execute on function sweep_catalog_cache() from public, anon, authenticated;
