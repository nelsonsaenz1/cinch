-- sync-feeds wakes up — awin-joined-programmes-directive.md §1.2.
--
-- The wake condition in docs/commerce/sync-feeds-dormant.md ("at least one
-- Awin programme approved") is being met via CICYBELL, and the function now
-- carries phase 0: it reads Awin's joined-programmes answer and reconciles
-- `commerce_joined_programmes` itself, so the schedule is what keeps that
-- table honest even on a day no feed changes.
--
-- Same shape as push_invoke (20260810110200): a security-definer function
-- reads the URL and shared secret from Vault and posts through pg_net,
-- returning immediately. The response lands in `net._http_response`; the
-- durable record of what a sync did is `catalog_merchants.synced_at` /
-- `sync_error` and the row counts in `commerce_health_report()`.
--
-- Vault secrets `feed_sync_url` / `feed_sync_secret` are inserted out of band
-- (values do not belong in a committed file). The function raises a notice
-- and does nothing when they are absent — an unconfigured database skips the
-- sync rather than posting garbage.

create function public.feed_sync_invoke()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url        text;
  v_secret     text;
  v_request_id bigint;
begin
  select s.decrypted_secret into v_url
    from vault.decrypted_secrets s where s.name = 'feed_sync_url';
  select s.decrypted_secret into v_secret
    from vault.decrypted_secrets s where s.name = 'feed_sync_secret';

  if v_url is null or v_secret is null then
    raise notice
      'feed_sync_invoke: vault secrets feed_sync_url / feed_sync_secret are not set. No sync ran.';
    return null;
  end if;

  select net.http_post(
           url                  := v_url,
           headers              := jsonb_build_object(
                                     'Content-Type', 'application/json',
                                     'x-cinch-feed-sync', v_secret
                                   ),
           body                 := '{}'::jsonb,
           -- The programmes read is quick but a first feed ingest is not;
           -- pg_net only needs to outlive the handoff, not the whole run.
           timeout_milliseconds := 30000
         )
    into v_request_id;

  return v_request_id;
end;
$$;

revoke execute on function public.feed_sync_invoke() from public, anon, authenticated;
grant  execute on function public.feed_sync_invoke() to postgres;

-- Daily. Awin's own limit is 5 requests/minute per publisher and the function
-- paces feeds with FEED_GAP_MS; one tick a day at a minute nothing else uses
-- (see 20260810110200 for the stagger reasoning).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'cinch-feed-sync') then
    perform cron.unschedule('cinch-feed-sync');
  end if;
end;
$$;

select cron.schedule('cinch-feed-sync', '25 8 * * *', $$select public.feed_sync_invoke()$$);
