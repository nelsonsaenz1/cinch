-- Read a cache row and count the hit in one atomic statement.
--
-- Two round trips (select, then update hits) would be a race and, worse, would
-- make `hits` optional in practice — the first person debugging a slow path
-- would drop the update and the only honest measure of whether this cache earns
-- its keep would quietly become zero. PostgREST cannot express `hits = hits + 1`
-- without a function, so the function is the way to keep the counter truthful.
--
-- `is_hit` distinguishes the two states the caller MUST NOT conflate:
--   no row / expired  -> is_hit false -> ask the provider
--   row, products null-> is_hit true, products null -> CACHED MISS, do not ask
-- Conflating them turns every unfindable garment back into a paid request on
-- every retry, and obscure garments are exactly the ones people re-describe.
create function read_catalog_cache(p_cache_key text)
returns table (is_hit boolean, products jsonb)
language plpgsql security definer set search_path = '' as $$
begin
  return query
    update public.catalog_lookups
       set hits = hits + 1
     where cache_key = p_cache_key
       and expires_at > now()
    returning true, catalog_lookups.products;

  if not found then
    return query select false, null::jsonb;
  end if;
end;
$$;

revoke execute on function read_catalog_cache(text) from public, anon, authenticated;
