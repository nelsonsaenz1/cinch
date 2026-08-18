-- FORWARD CORRECTION to 20260824010000_stylist_reservations.sql.
--
-- ── THE DEFECT ──────────────────────────────────────────────────────────────
--
-- All three functions returned ONE number, `used`, computed from ADMISSION
-- CAPACITY — completed successes plus live reservations. The Edge Function
-- surfaced that as `successfulUsed`, and the client drew the chats-left mark
-- from it.
--
-- Those are two different facts. A live reservation on a second device is not
-- a successful chat: it may still fail, and when it does its slot returns. So
-- somebody chatting on a phone could watch their laptop's mark drop to "3
-- chats left" for a conversation that never landed — a number that then went
-- back up. A count that can go backwards is not a count of successes.
--
-- ── THE CORRECTION ──────────────────────────────────────────────────────────
--
-- The two facts are separated and both are kept:
--
--   ADMISSION  stays completed + live reserved. It must, or two devices could
--              each pass the check and both succeed, and five would mean six.
--   REPORTING  becomes completed ONLY, with `remaining` = limit - completed.
--
-- So four completed plus one live reservation refuses admission — capacity is
-- momentarily full — while truthfully reporting four used and one remaining.
-- The refusal and the figure are answering different questions and no longer
-- have to agree.
--
-- Forward-only: 20260824010000 is already applied in production and is not
-- edited. This replaces the three function bodies.

create or replace function public.claim_stylist_chat(p_user_id uuid, p_limit integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start     date;
  v_capacity  integer;
  v_completed integer;
  v_id        uuid;
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

  -- ADMISSION: completed plus anything still live. A reservation holds a slot
  -- while it might still become a success.
  select count(*)::int into v_capacity
    from public.stylist_chat_reservations r
   where r.user_id = p_user_id
     and r.period_start = v_start
     and (
       r.state = 'completed'
       or (r.state = 'reserved'
           and r.created_at > now() - public.stylist_reservation_window())
     );

  -- REPORTING: completed only. What the reader is told they have spent.
  select count(*)::int into v_completed
    from public.stylist_chat_reservations r
   where r.user_id = p_user_id
     and r.period_start = v_start
     and r.state = 'completed';

  if v_capacity >= p_limit then
    return jsonb_build_object(
      'allowed', false, 'reservation_id', null,
      -- Four completed and one live reports four used and one remaining, and
      -- still refuses. The refusal is about capacity; the figure is about
      -- successes; they are allowed to disagree because they are different
      -- questions.
      'used', least(v_completed, p_limit),
      'limit', p_limit,
      'remaining', greatest(0, p_limit - v_completed),
      'reason', 'exhausted'
    );
  end if;

  insert into public.stylist_chat_reservations (user_id, period_start, state)
  values (p_user_id, v_start, 'reserved')
  returning id into v_id;

  -- The reservation just made is NOT a success and does not move the figure.
  return jsonb_build_object(
    'allowed', true, 'reservation_id', v_id,
    'used', least(v_completed, p_limit),
    'limit', p_limit,
    'remaining', greatest(0, p_limit - v_completed)
  );
end;
$$;

create or replace function public.complete_stylist_chat(
  p_reservation_id uuid,
  p_user_id uuid,
  p_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start     date;
  v_state     text;
  v_created   timestamptz;
  v_capacity  integer;
  v_completed integer;
  v_changed   boolean := false;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  v_start := date_trunc('month', now() at time zone 'utc')::date;

  select r.state, r.created_at into v_state, v_created
    from public.stylist_chat_reservations r
   where r.id = p_reservation_id and r.user_id = p_user_id
   for update;

  if v_state is null then
    return jsonb_build_object('state', 'unknown', 'changed', false);
  end if;

  if v_state = 'reserved' then
    if v_created > now() - public.stylist_reservation_window() then
      update public.stylist_chat_reservations
         set state = 'completed', settled_at = now()
       where id = p_reservation_id;
      v_changed := true;
    else
      -- A late but real success. Admitted only if COMPLETED successes still
      -- leave room — other live reservations do not block it, because they may
      -- yet fail and this one demonstrably did not.
      select count(*)::int into v_completed
        from public.stylist_chat_reservations r
       where r.user_id = p_user_id and r.period_start = v_start
         and r.id <> p_reservation_id
         and r.state = 'completed';

      if p_limit is not null and v_completed < p_limit then
        update public.stylist_chat_reservations
           set state = 'completed', settled_at = now()
         where id = p_reservation_id;
        v_changed := true;
      else
        update public.stylist_chat_reservations
           set state = 'released', settled_at = now()
         where id = p_reservation_id;
      end if;
    end if;
  end if;

  select count(*)::int into v_completed
    from public.stylist_chat_reservations r
   where r.user_id = p_user_id and r.period_start = v_start
     and r.state = 'completed';

  return jsonb_build_object(
    'state', (select state from public.stylist_chat_reservations where id = p_reservation_id),
    'changed', v_changed,
    'used', case when p_limit is null then v_completed else least(v_completed, p_limit) end,
    'limit', p_limit,
    'remaining', case when p_limit is null then null
                      else greatest(0, p_limit - v_completed) end
  );
end;
$$;

create or replace function public.release_stylist_chat(
  p_reservation_id uuid,
  p_user_id uuid,
  p_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start     date;
  v_state     text;
  v_completed integer;
  v_changed   boolean := false;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  v_start := date_trunc('month', now() at time zone 'utc')::date;

  select r.state into v_state
    from public.stylist_chat_reservations r
   where r.id = p_reservation_id and r.user_id = p_user_id
   for update;

  if v_state is null then
    return jsonb_build_object('state', 'unknown', 'changed', false);
  end if;

  if v_state = 'reserved' then
    update public.stylist_chat_reservations
       set state = 'released', settled_at = now()
     where id = p_reservation_id;
    v_changed := true;
  end if;

  select count(*)::int into v_completed
    from public.stylist_chat_reservations r
   where r.user_id = p_user_id and r.period_start = v_start
     and r.state = 'completed';

  return jsonb_build_object(
    'state', (select state from public.stylist_chat_reservations where id = p_reservation_id),
    'changed', v_changed,
    'used', case when p_limit is null then v_completed else least(v_completed, p_limit) end,
    'limit', p_limit,
    'remaining', case when p_limit is null then null
                      else greatest(0, p_limit - v_completed) end
  );
end;
$$;

comment on function public.claim_stylist_chat(uuid, integer) is
  'Reserves one of Standard''s five monthly successful stylist chats. ADMISSION counts completed plus live reservations so two devices cannot both take the last slot; the RETURNED allowance counts COMPLETED successes only, so another device''s in-flight chat is never displayed as one somebody spent.';
