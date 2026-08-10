-- The export safety net.
--
-- The app invokes `build-export` itself the moment a row is created, so in the
-- ordinary case this cron never has anything to do. It exists for the case
-- that call does not land: the app was killed between the RPC and the invoke,
-- the network dropped, the function cold-started past the client's patience.
--
-- Without it a row stranded in `pending` is worse than a failure. `failed` is
-- forgiven by the daily limit (20260810120400); `pending` is not, deliberately,
-- because an export being built is work in progress and a second request would
-- race it. So a stranded row is a user locked out of their own data for
-- twenty-four hours by a dropped packet.
--
-- ── NO CREDENTIAL LIVES IN THIS FILE ───────────────────────────────────────
--
-- Same discipline as 20260810110200_push_cron.sql: a migration is a text file
-- in a git repository, so the three values are read from Vault BY NAME at the
-- moment of the call. They are created out of band by the founder and are
-- never handled, echoed or stored by the session that wrote this file:
--
--   export_build_url     https://<project>.supabase.co/functions/v1/build-export
--   export_sweep_secret  matches the function's EXPORT_SWEEP_SECRET
--   export_service_key   a service-role JWT, to satisfy verify_jwt
--
-- THE THIRD ONE IS WHY THIS NEEDS TWO CREDENTIALS RATHER THAN ONE.
-- `build-export` runs with `verify_jwt: true`, so the request needs a valid
-- JWT — but the anon key is also a valid JWT, and it ships inside the app.
-- Anyone who pulled it out of the binary could start a sweep. The
-- `x-cinch-export-sweep` header is what actually distinguishes the cron, and
-- the JWT only gets it past the platform gate.
--
-- UNTIL ALL THREE EXIST THE SCHEDULE IS INERT. `export_invoke` finds nothing,
-- writes a notice and returns — it does not raise, because a cron job that
-- errors every five minutes buries the log that would explain why.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create function public.export_invoke()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url        text;
  v_secret     text;
  v_key        text;
  v_request_id bigint;
begin
  select s.decrypted_secret into v_url
    from vault.decrypted_secrets s where s.name = 'export_build_url';
  select s.decrypted_secret into v_secret
    from vault.decrypted_secrets s where s.name = 'export_sweep_secret';
  select s.decrypted_secret into v_key
    from vault.decrypted_secrets s where s.name = 'export_service_key';

  if v_url is null or v_secret is null or v_key is null then
    raise notice
      'export_invoke: vault secrets export_build_url / export_sweep_secret / export_service_key are not all set. No sweep ran.';
    return null;
  end if;

  -- Asynchronous, like push_invoke: the request is queued and the id comes
  -- back immediately, so a slow assembly cannot hold a cron worker open. The
  -- consequence is that this cannot report what was built — `data_exports` is
  -- the record, written by the function that did the work.
  select net.http_post(
           url                  := v_url,
           headers              := jsonb_build_object(
                                     'Content-Type', 'application/json',
                                     'Authorization', 'Bearer ' || v_key,
                                     'x-cinch-export-sweep', v_secret
                                   ),
           body                 := '{}'::jsonb,
           timeout_milliseconds := 30000
         )
    into v_request_id;

  return v_request_id;
end;
$$;

revoke execute on function public.export_invoke() from public, anon, authenticated;
grant  execute on function public.export_invoke() to postgres;

do $$
begin
  if exists (select 1 from cron.job j where j.jobname = 'cinch-export-sweep') then
    perform cron.unschedule('cinch-export-sweep');
  end if;
end;
$$;

-- Every ten minutes. The function bounds itself to 25 rows an invocation, and
-- the ordinary case is zero — this is a net, not a conveyor. Ten minutes is
-- short enough that a dropped invoke is invisible against an assembly the copy
-- already describes as taking a while, and long enough that a quiet database
-- is not woken every minute for nothing.
select cron.schedule('cinch-export-sweep', '*/10 * * * *',
                     $sql$select public.export_invoke();$sql$);
