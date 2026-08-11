-- Alert cooldowns, and the schedule that checks.
--
-- WHY A COOLDOWN IS PART OF THE ALERT AND NOT AN AFTERTHOUGHT
--
-- Every condition worth alerting on here is a STATE, not an event. "Quota is at
-- 82%" stays true for the rest of the billing cycle. An hourly check with no
-- memory would send that email 700 times before the cycle rolled, and the only
-- thing that achieves is teaching the one person who reads it to filter the
-- sender — which is strictly worse than having no alerting, because it also
-- feels like coverage.
--
-- So the claim is made in SQL, in the same statement that records it, for the
-- same reason `claim_catalog_request` is: two concurrent checks must not both
-- believe they are the first to see a condition.

create table commerce_alert_sends (
  key text primary key,
  last_sent_at timestamptz not null default now(),
  send_count integer not null default 1 check (send_count > 0)
);

comment on table commerce_alert_sends is
  'One row per alert KEY (not per firing). Rate-limits alerts that describe a lasting state — see commerce-health/thresholds.ts.';

alter table commerce_alert_sends enable row level security;
-- No policies; service role and security-definer functions only.

-- Returns true exactly once per cooldown window per key. The caller sends mail
-- only when it gets a true, so a false is a suppression rather than an error.
create function claim_commerce_alert(
  p_key text,
  p_cooldown_hours integer default 24
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_last timestamptz;
begin
  select last_sent_at into v_last
    from public.commerce_alert_sends
   where key = p_key
     for update;

  if found and v_last > now() - make_interval(hours => greatest(p_cooldown_hours, 1)) then
    return false;
  end if;

  insert into public.commerce_alert_sends (key)
  values (p_key)
  on conflict (key) do update
     set last_sent_at = now(),
         send_count   = public.commerce_alert_sends.send_count + 1;

  return true;
end;
$$;

revoke execute on function claim_commerce_alert(text, integer)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- The schedule.
--
-- Hourly, at :50 — the one minute in the hour the push jobs (00, 05, 10, 20,
-- 15/30/45) do not already use, for the same reason those are staggered.
--
-- Hourly rather than daily because the condition that matters most, a spent
-- quota, arrives inside a day; and hourly costs nothing now that the cooldown
-- above means a lasting condition mails once.
-- ---------------------------------------------------------------------------
create function commerce_health_invoke()
returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_url        text;
  v_secret     text;
  v_request_id bigint;
begin
  select s.decrypted_secret into v_url
    from vault.decrypted_secrets s where s.name = 'commerce_health_url';
  select s.decrypted_secret into v_secret
    from vault.decrypted_secrets s where s.name = 'push_cron_secret';

  if v_url is null or v_secret is null then
    raise notice
      'commerce_health_invoke: vault secrets commerce_health_url / push_cron_secret are not set. Nothing was checked.';
    return null;
  end if;

  select net.http_post(
           url                  := v_url,
           headers              := jsonb_build_object(
                                     'Content-Type', 'application/json',
                                     'x-cinch-cron', v_secret
                                   ),
           body                 := jsonb_build_object('mode', 'check'),
           timeout_milliseconds := 20000
         )
    into v_request_id;

  return v_request_id;
end;
$$;

revoke execute on function commerce_health_invoke() from public, anon, authenticated;
grant  execute on function commerce_health_invoke() to postgres;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'cinch-commerce-health') then
    perform cron.unschedule('cinch-commerce-health');
  end if;
end $$;

select cron.schedule('cinch-commerce-health', '50 * * * *',
  $$select public.commerce_health_invoke();$$);
