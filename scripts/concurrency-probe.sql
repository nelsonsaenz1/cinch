-- A calibrated concurrency probe. Audit item 27 was verified with this.
--
-- WHY IT EXISTS
--
-- Proving a lock works needs two database sessions overlapping in real time,
-- and this project has no way to open a second one: `dblink` demands a password
-- in the connection string, Docker is not installed so there is no local stack,
-- and the MCP tooling holds exactly one connection. What IS available is
-- `pg_net`, whose background worker dispatches HTTP asynchronously through a
-- curl multi handle — so N posts to a PostgREST RPC really do run in N separate
-- backends at the same time.
--
-- WHY IT IS CALIBRATED, AND WHY THAT MATTERS MORE THAN THE RESULT
--
-- A concurrency test that passes proves nothing on its own: it cannot tell
-- "the lock worked" apart from "the requests never actually overlapped". So the
-- probe runs TWO functions with an identical artificially widened window — a
-- 50ms sleep between counting and inserting — differing only in whether they
-- take the lock. If the control does not FAIL, the run is void and says nothing
-- about the real one.
--
-- Recorded result, 2026-08-11, twelve concurrent requests against a limit of 3:
--
--   t_claim_racy    (no lock, 50ms window)   11 got through   ← the old shape
--   t_claim_locked  (advisory lock, same)     3 got through
--   claim_support_send (shipped, no sleep)    3 got through, from 20 requests
--
-- HOW TO RUN IT
--
-- Through the Supabase MCP `execute_sql`, or any single connection to the
-- project database, in the four steps below. The service key is read from the
-- Vault inside the statement and is never selected, printed or returned.
--
-- CLEAN UP AFTERWARDS. Step 4 is not optional: the scaffolding functions are
-- unlocked-by-design and must not be left in a production database.

-- ── 1. Scaffolding ─────────────────────────────────────────────────────────

create or replace function t_claim_locked(p_user_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_hour integer; v_id uuid;
begin
  perform pg_advisory_xact_lock(
    ('x' || substr(replace(p_user_id::text, '-', ''), 1, 8))::bit(32)::integer,
    ('x' || substr(replace(p_user_id::text, '-', ''), 9, 8))::bit(32)::integer
  );
  select count(*) into v_hour from public.support_sends s
   where s.user_id = p_user_id and s.sent_at >= now() - interval '1 hour';
  perform pg_sleep(0.05);
  if v_hour >= 3 then return null; end if;
  insert into public.support_sends (user_id, topic)
  values (p_user_id, 'locked') returning id into v_id;
  return v_id;
end; $$;

-- The shape the endpoint had before audit 27: count, then insert, nothing held.
create or replace function t_claim_racy(p_user_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_hour integer; v_id uuid;
begin
  select count(*) into v_hour from public.support_sends s
   where s.user_id = p_user_id and s.sent_at >= now() - interval '1 hour';
  perform pg_sleep(0.05);
  if v_hour >= 3 then return null; end if;
  insert into public.support_sends (user_id, topic)
  values (p_user_id, 'racy') returning id into v_id;
  return v_id;
end; $$;

-- ── 2. Fire. Change `t_claim_racy` to `t_claim_locked` for the second run. ──
--
-- Replace <PROJECT_REF> with the project ref. Wait a few seconds between
-- dispatching and counting — `net.http_post` returns as soon as the request is
-- queued, not when it completes.

do $$
declare u uuid; v_key text; i int;
begin
  select id into u from auth.users order by created_at limit 1;
  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'export_service_key';

  delete from support_sends where user_id = u;   -- fresh slate

  for i in 1..12 loop
    perform net.http_post(
      url := 'https://<PROJECT_REF>.supabase.co/rest/v1/rpc/t_claim_racy',
      headers := jsonb_build_object('Content-Type','application/json',
                                    'apikey', v_key,
                                    'Authorization', 'Bearer ' || v_key),
      body := jsonb_build_object('p_user_id', u),
      timeout_milliseconds := 15000);
  end loop;
end $$;

-- ── 3. Count ───────────────────────────────────────────────────────────────

select topic,
       count(*) as got_through,
       3 as the_limit,
       count(*) > 3 as over_the_limit
  from support_sends
 where user_id = (select id from auth.users order by created_at limit 1)
 group by topic;

-- ── 4. Clean up. Not optional. ─────────────────────────────────────────────

drop function if exists t_claim_locked(uuid);
drop function if exists t_claim_racy(uuid);
delete from support_sends where topic in ('racy', 'locked', 'concurrency');
