-- FORWARD CORRECTION to 20260824020000_stylist_allowance_completed_only.sql.
--
-- ── THE CONTRADICTION ───────────────────────────────────────────────────────
--
-- Separating admission capacity from reported successes left one refusal with
-- two meanings. Four completed plus one live reservation refuses, and the
-- refusal said `exhausted` — which the Edge Function renders as "you have used
-- this month's stylist chats" — while the SAME response reported four used and
-- ONE REMAINING. The screen contradicted itself in two adjacent sentences.
--
-- They are different situations with different remedies:
--
--   EXHAUSTED      five successes are on record. Nothing comes back until the
--                  month rolls over. Not retryable.
--   CAPACITY_HELD  fewer than five successes, but every slot is momentarily
--                  held by a live reservation — another device mid-chat, or
--                  this one retrying. It clears on its own, within the
--                  reservation window at the latest. RETRYABLE.
--
-- The second must not say five chats are spent, and must not say anything at
-- all about the other request: whose device it is, or that one exists, is not
-- this response's business. It reports how long the hold can last and stops.
--
-- ── MONTH ROLLOVER, STATED ─────────────────────────────────────────────────
--
-- A success is charged to ITS RESERVATION'S period — `period_start` is fixed
-- at claim time — while the returned allowance always describes the CURRENT
-- UTC month. So a reservation opened at 23:59 and completed at 00:01 is
-- counted against the month it was opened in, and the fresh month it settles
-- into is reported as untouched. That is deliberate: the alternative charges a
-- chat to a month the reader never spent it in.

create or replace function public.claim_stylist_chat(p_user_id uuid, p_limit integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start      date;
  v_capacity   integer;
  v_completed  integer;
  v_id         uuid;
  v_oldest     timestamptz;
  v_retry      integer;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  if p_limit is null or p_limit <= 0 then
    return jsonb_build_object(
      'allowed', false, 'reservation_id', null,
      'used', 0, 'limit', 0, 'remaining', 0, 'reason', 'plan_excluded'
    );
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  v_start := date_trunc('month', now() at time zone 'utc')::date;

  select count(*)::int into v_capacity
    from public.stylist_chat_reservations r
   where r.user_id = p_user_id
     and r.period_start = v_start
     and (
       r.state = 'completed'
       or (r.state = 'reserved'
           and r.created_at > now() - public.stylist_reservation_window())
     );

  select count(*)::int into v_completed
    from public.stylist_chat_reservations r
   where r.user_id = p_user_id
     and r.period_start = v_start
     and r.state = 'completed';

  if v_capacity >= p_limit then
    -- FIVE SUCCESSES ARE ON RECORD. Nothing returns until the month does.
    if v_completed >= p_limit then
      return jsonb_build_object(
        'allowed', false, 'reservation_id', null,
        'used', least(v_completed, p_limit), 'limit', p_limit,
        'remaining', 0, 'reason', 'exhausted'
      );
    end if;

    -- FEWER THAN FIVE, but every slot is momentarily held. Report how long the
    -- hold can last — bounded by the reservation window, never longer — and
    -- nothing whatever about what is holding it.
    select min(r.created_at) into v_oldest
      from public.stylist_chat_reservations r
     where r.user_id = p_user_id and r.period_start = v_start
       and r.state = 'reserved'
       and r.created_at > now() - public.stylist_reservation_window();

    v_retry := greatest(
      1,
      least(
        ceil(extract(epoch from public.stylist_reservation_window()))::int,
        ceil(extract(epoch from
          (v_oldest + public.stylist_reservation_window()) - now()))::int
      )
    );

    return jsonb_build_object(
      'allowed', false, 'reservation_id', null,
      'used', least(v_completed, p_limit), 'limit', p_limit,
      'remaining', greatest(0, p_limit - v_completed),
      'reason', 'capacity_held',
      'retry_after_seconds', v_retry
    );
  end if;

  insert into public.stylist_chat_reservations (user_id, period_start, state)
  values (p_user_id, v_start, 'reserved')
  returning id into v_id;

  return jsonb_build_object(
    'allowed', true, 'reservation_id', v_id,
    'used', least(v_completed, p_limit),
    'limit', p_limit,
    'remaining', greatest(0, p_limit - v_completed)
  );
end;
$$;

comment on function public.claim_stylist_chat(uuid, integer) is
  'Reserves one of Standard''s five monthly successful stylist chats. ADMISSION counts completed plus live reservations; the RETURNED allowance counts COMPLETED successes only. Two distinct refusals: exhausted (five successes on record, not retryable) and capacity_held (fewer than five, every slot momentarily held by a live reservation, retryable within the reservation window).';
