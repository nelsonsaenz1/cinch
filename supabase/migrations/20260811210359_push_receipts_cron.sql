-- Audit 25: the clock for the receipt collector.
--
-- Reuses `push_send_url` and `push_cron_secret` rather than asking for two more
-- Vault entries. That is deliberate: every new secret is a founder step, and a
-- founder step that has not happened yet is a feature that silently does
-- nothing. This posts to the same function behind the same gate, and is told
-- apart by its body — `{"mode":"receipts"}` instead of `{"channel":…}`. The
-- five channels stay exactly as they are, so the three-way pin between
-- `push_sends`' CHECK, the app's channel list and the sender's dispatch table
-- is untouched.
create function push_receipts_invoke()
returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_url        text;
  v_secret     text;
  v_request_id bigint;
begin
  select s.decrypted_secret into v_url
    from vault.decrypted_secrets s where s.name = 'push_send_url';
  select s.decrypted_secret into v_secret
    from vault.decrypted_secrets s where s.name = 'push_cron_secret';

  if v_url is null or v_secret is null then
    -- Notice, not raise. A cron job that errors every few minutes buries the
    -- log line that would explain why.
    raise notice 'push_receipts_invoke: vault secrets are not set. No receipts collected.';
    return null;
  end if;

  select net.http_post(
           url                  := v_url,
           headers              := jsonb_build_object(
                                     'Content-Type', 'application/json',
                                     'x-cinch-cron', v_secret
                                   ),
           body                 := jsonb_build_object('mode', 'receipts'),
           timeout_milliseconds := 20000
         )
    into v_request_id;

  return v_request_id;
end;
$$;

revoke execute on function push_receipts_invoke() from public, anon, authenticated;
grant  execute on function push_receipts_invoke() to postgres;

do $$
declare v_job text;
begin
  foreach v_job in array array['cinch-push-receipts', 'cinch-push-receipts-prune']
  loop
    if exists (select 1 from cron.job j where j.jobname = v_job) then
      perform cron.unschedule(v_job);
    end if;
  end loop;
end;
$$;

-- Every ten minutes at :07 past, which keeps it off the :00/:05 sends. A ticket
-- sent at :00 is first asked about at :17 — past Expo's fifteen-minute floor
-- without adding a schedule just to be precise about it.
select cron.schedule('cinch-push-receipts', '7,17,27,37,47,57 * * * *',
                     $sql$select public.push_receipts_invoke();$sql$);

-- Alongside the sends prune at 03:40, ten minutes later so they do not contend.
select cron.schedule('cinch-push-receipts-prune', '50 3 * * *',
                     $sql$select public.push_receipts_prune();$sql$);
