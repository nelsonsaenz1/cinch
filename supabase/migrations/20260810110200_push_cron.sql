-- ===========================================================================
-- The clock. Six schedules, and the one call they all make.
--
-- Nothing in this file decides anything about a notification — the five claim
-- functions in 20260810110100 do that, and `send-push` composes and delivers.
-- This is only the thing that wakes them up.
--
-- ── NO CREDENTIAL LIVES IN THIS FILE ───────────────────────────────────────
--
-- A migration is a text file in a git repository, so the two values pg_cron
-- needs to reach an edge function — where it is, and what proves the caller is
-- us — are read from Supabase Vault BY NAME at the moment of the call. They are
-- created out of band by the founder, once, and are never handled, echoed or
-- stored by the session that wrote this file:
--
--   push_send_url     https://<project>.supabase.co/functions/v1/send-push
--   push_cron_secret  the shared secret, matching the function's
--                     PUSH_CRON_SECRET (see supabase/functions/send-push)
--
-- The URL is in the Vault rather than typed here for a reason beyond tidiness:
-- a preview or branch database restored from production would otherwise carry
-- production's function URL and ring real people's phones from a test.
--
-- UNTIL BOTH SECRETS EXIST, EVERY SCHEDULE IS INERT. `push_invoke` finds
-- nothing, writes a notice, and returns — it does not raise, because a cron job
-- that errors every minute buries the log that would tell you why.
-- ===========================================================================

-- pg_cron creates and owns the `cron` schema; pg_net creates and owns `net`.
-- Both are available on this project but neither is installed
-- (checked 2026-08-09), so these two lines are the ones that turn them on. If
-- the dashboard toggle got there first, they are no-ops.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- The one call.
--
-- `net.http_post` is asynchronous: it queues the request and hands back an id
-- immediately, so a slow send cannot hold a cron worker open. The consequence
-- is that this function CANNOT report whether anything was delivered — the
-- response lands in `net._http_response` minutes later and nobody reads it.
-- That is acceptable here and would not be anywhere else, because the ledger
-- (`push_sends`) is the record of what happened, written by the function that
-- actually did it.
-- ---------------------------------------------------------------------------

create function push_invoke(p_channel text)
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
    from vault.decrypted_secrets s where s.name = 'push_send_url';
  select s.decrypted_secret into v_secret
    from vault.decrypted_secrets s where s.name = 'push_cron_secret';

  if v_url is null or v_secret is null then
    raise notice
      'push_invoke(%): vault secrets push_send_url / push_cron_secret are not set. Nothing was sent.',
      p_channel;
    return null;
  end if;

  select net.http_post(
           url                  := v_url,
           headers              := jsonb_build_object(
                                     'Content-Type', 'application/json',
                                     'x-cinch-cron', v_secret
                                   ),
           body                 := jsonb_build_object('channel', p_channel),
           timeout_milliseconds := 20000
         )
    into v_request_id;

  return v_request_id;
end;
$$;

revoke execute on function push_invoke(text) from public, anon, authenticated;
grant  execute on function push_invoke(text) to postgres;

-- ---------------------------------------------------------------------------
-- The schedules.
--
-- Unscheduled first so the migration can be re-run against a database that
-- already has them; `cron.unschedule` raises on a name it does not know, hence
-- the existence test rather than a bare call.
--
-- The minutes are staggered on purpose. Five jobs firing on the hour would have
-- five sweeps, five HTTP posts and five Expo batches contending at :00, and the
-- only thing that would come of it is a spikier graph.
--
--   morning edit     :00 :15 :30 :45   the four slots are on :00 and :30, and
--                                      every zone in real use is a whole,
--                                      half or quarter hour from UTC, so this
--                                      lands ON each slot rather than after it
--   borrows          every 5 minutes   the only channel where lateness reads as
--                                      rudeness — somebody is waiting on an
--                                      answer about their own coat
--   friend activity  :05 hourly        one batch an hour, by the row's promise
--   votes, comments  :10 hourly        likewise
--   event reminders  :20 hourly        hourly, NOT daily as §6.3's shorthand
--                                      has it: "the evening before" is 18:00
--                                      where the READER is, and a single daily
--                                      UTC run is somebody's evening and
--                                      somebody else's breakfast. The claim
--                                      function accepts a three-hour local
--                                      window and the event id keys it, so of
--                                      the three runs that qualify only the
--                                      first sends
--   prune            03:40 daily       bookkeeping, not traffic
-- ---------------------------------------------------------------------------

do $$
declare
  v_job text;
begin
  foreach v_job in array array[
    'cinch-push-morning-edit',
    'cinch-push-borrow-requests',
    'cinch-push-friend-activity',
    'cinch-push-votes-comments',
    'cinch-push-event-reminders',
    'cinch-push-sends-prune'
  ]
  loop
    if exists (select 1 from cron.job j where j.jobname = v_job) then
      perform cron.unschedule(v_job);
    end if;
  end loop;
end;
$$;

select cron.schedule('cinch-push-morning-edit',    '0,15,30,45 * * * *',
                     $$select public.push_invoke('morning_edit');$$);

select cron.schedule('cinch-push-borrow-requests', '*/5 * * * *',
                     $$select public.push_invoke('borrow_requests');$$);

select cron.schedule('cinch-push-friend-activity', '5 * * * *',
                     $$select public.push_invoke('friend_activity');$$);

select cron.schedule('cinch-push-votes-comments',  '10 * * * *',
                     $$select public.push_invoke('votes_comments');$$);

select cron.schedule('cinch-push-event-reminders', '20 * * * *',
                     $$select public.push_invoke('event_reminders');$$);

select cron.schedule('cinch-push-sends-prune',     '40 3 * * *',
                     $$select public.push_sends_prune();$$);
