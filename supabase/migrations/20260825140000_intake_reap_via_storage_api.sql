-- The intake-audio reaper, moved to the right side of the storage API.
--
-- `public.reap_intake_audio()` (20260810140300) deleted straight from
-- `storage.objects`, and the platform's `storage.protect_delete()` trigger
-- refuses exactly that — so from 2026-08-10 the hourly cron failed on every
-- tick (364 failures by 2026-08-25) while the recordings it existed to remove
-- outlived the 24-hour promise. Deletion must go through the storage API, and
-- the storage API lives in an edge function: `reap-intake-audio`.
--
-- The split this migration leaves behind: SQL FINDS, THE API DELETES.
-- `stale_intake_audio()` answers "which paths are older than 24 hours" in one
-- indexed read — reading `storage.objects` is allowed, only deleting is not —
-- and the edge function removes what it names. Walking the bucket with
-- `list()` per user folder would spend a request per person who ever recorded
-- to learn what one query knows.
--
-- ── NO CREDENTIAL LIVES IN THIS FILE ───────────────────────────────────────
--
-- Same discipline as 20260825120000_feed_sync_cron.sql: the two values are
-- read from Vault BY NAME at the moment of the call.
--
--   intake_reap_url     https://<project>.supabase.co/functions/v1/reap-intake-audio
--   intake_reap_secret  matches the function's INTAKE_REAP_SECRET
--
-- No service key: `reap-intake-audio` runs with `verify_jwt = false`
-- (config.toml) and the `x-cinch-intake-reap` header is the whole gate, the
-- same shape as sync-feeds. Until both secrets exist the schedule is inert —
-- `intake_reap_invoke` writes a notice and returns rather than raising,
-- because a cron job that errors every hour buries the log that explains why.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- The read half. Full object names ('userId/handle.m4a'), which is the path
-- shape `storage.remove()` takes relative to the bucket.
create or replace function public.stale_intake_audio()
returns setof text
language sql
security definer
set search_path = ''
as $$
  select o.name
    from storage.objects o
   where o.bucket_id = 'intake-audio'
     and o.created_at < now() - interval '24 hours'
   order by o.created_at
$$;

comment on function public.stale_intake_audio() is
  'Paths in intake-audio older than the 24-hour promise. Read-only half of the reaper; the reap-intake-audio edge function deletes what this names.';

revoke execute on function public.stale_intake_audio() from public, anon, authenticated;
grant  execute on function public.stale_intake_audio() to postgres, service_role;

-- The broken direct-delete version. Nothing calls it after the reschedule
-- below, and leaving it would invite exactly the regression this fixes.
drop function if exists public.reap_intake_audio();

-- The invoker the cron actually runs.
create or replace function public.intake_reap_invoke()
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
    from vault.decrypted_secrets s where s.name = 'intake_reap_url';
  select s.decrypted_secret into v_secret
    from vault.decrypted_secrets s where s.name = 'intake_reap_secret';

  if v_url is null or v_secret is null then
    raise notice
      'intake_reap_invoke: vault secrets intake_reap_url / intake_reap_secret are not both set. No reap ran.';
    return null;
  end if;

  select net.http_post(
           url                  := v_url,
           headers              := jsonb_build_object(
                                     'Content-Type', 'application/json',
                                     'x-cinch-intake-reap', v_secret
                                   ),
           body                 := '{}'::jsonb,
           timeout_milliseconds := 30000
         )
    into v_request_id;

  return v_request_id;
end;
$$;

revoke execute on function public.intake_reap_invoke() from public, anon, authenticated;
grant  execute on function public.intake_reap_invoke() to postgres;

do $$
begin
  if exists (select 1 from cron.job j where j.jobname = 'cinch-reap-intake-audio') then
    perform cron.unschedule('cinch-reap-intake-audio');
  end if;
end;
$$;

-- Same name, same hour-mark as the original: the job's identity is "the
-- intake-audio backstop", and its history of 364 failures should sit next to
-- its recovery in one place.
select cron.schedule('cinch-reap-intake-audio', '17 * * * *',
                     $sql$select public.intake_reap_invoke();$sql$);
