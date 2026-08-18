-- FORWARD CORRECTION to 20260824000000_stylist_success_allowance.sql.
--
-- ── THE FLAW IN THE PREVIOUS MIGRATION ──────────────────────────────────────
--
-- `release_stylist_success(p_user_id)` decremented an aggregate counter with no
-- reservation identity. That is not a release; it is "subtract one from this
-- user's successes", and it is wrong in three ways that all reopen capacity:
--
--   * A DUPLICATED OR RETRIED release decrements twice for one failed call, so
--     an account that had five successes now shows four and can have a sixth.
--   * A LATE release — a timeout that fires after the reply actually landed —
--     removes a success that genuinely happened.
--   * A release belonging to request A can only ever decrement THE SAME NUMBER
--     that request B's completed success is stored in, so one request silently
--     erases another's.
--
-- Flooring at zero bounds the corruption; it does not make the operation
-- idempotent. The pgTAP test that released six times to reach zero was
-- demonstrating the defect rather than preventing it.
--
-- The two functions are dropped here rather than left callable. They were never
-- reached by deployed code — `stylist-chat` was not redeployed — so nothing in
-- production depends on them and no data was written through them.
--
-- ── THE CORRECTION ──────────────────────────────────────────────────────────
--
-- Every reservation gets an OPAQUE ID and a state. Completion and release are
-- transitions on that exact row, scoped to its owner, so they are idempotent by
-- construction: a second call finds the row already settled and changes
-- nothing. One request can never settle another's, because it does not have
-- the other's id.
--
-- CAPACITY is derived rather than maintained as a counter, which removes the
-- entire class of drift the previous version had:
--
--     used = completed  +  reserved-and-not-yet-expired
--
-- A reservation therefore holds a slot only while it is live. An abandoned one
-- — the edge function died between reserving and settling — stops consuming
-- capacity when its window passes, so a crash cannot permanently cost somebody
-- a chat. Nothing has to sweep it; the definition of `used` does the work.
--
-- CONCURRENCY is a per-user transaction-scoped advisory lock. Two devices
-- claiming the fifth slot serialise on it, so the second reads the first's
-- reservation and is refused. It is per user rather than global, so one
-- account's contention never blocks another's.

drop function if exists public.claim_stylist_success(uuid, integer);
drop function if exists public.release_stylist_success(uuid);

create table if not exists public.stylist_chat_reservations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  -- The UTC month this reservation belongs to, fixed at claim time so a
  -- reservation opened at 23:59 on the last of the month settles against the
  -- month it was opened in rather than jumping to the next one.
  period_start  date not null,
  state         text not null check (state in ('reserved', 'completed', 'released')),
  created_at    timestamptz not null default now(),
  settled_at    timestamptz
);

-- The one read every function makes: this user, this month, states that consume.
create index if not exists stylist_chat_reservations_user_period_idx
  on public.stylist_chat_reservations (user_id, period_start, state);

-- Deny-all by default. Only the security-definer functions below touch this,
-- and they are service_role only — but a table reachable by a client role is
-- one grant away from an account granting itself chats, so RLS is on with no
-- policy at all.
alter table public.stylist_chat_reservations enable row level security;
revoke all on table public.stylist_chat_reservations from anon, authenticated;

/**
 * How long a reservation holds a slot before it stops counting.
 *
 * Fifteen minutes against a provider call that times out in well under one.
 * Long enough that a slow reply is never treated as abandoned, short enough
 * that a crashed request costs somebody at most a quarter of an hour.
 */
create or replace function public.stylist_reservation_window()
returns interval language sql immutable set search_path = '' as $$
  select interval '15 minutes';
$$;

/**
 * Reserve one of Standard's five successful chats for this UTC month.
 *
 * Returns an opaque reservation id, which is the ONLY thing that can settle it.
 */
create or replace function public.claim_stylist_chat(p_user_id uuid, p_limit integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start date;
  v_used  integer;
  v_id    uuid;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  -- A non-positive limit is a plan boundary, not exhaustion, and is answered
  -- without touching the table.
  if p_limit is null or p_limit <= 0 then
    return jsonb_build_object(
      'allowed', false, 'reservation_id', null,
      'used', 0, 'limit', 0, 'remaining', 0, 'reason', 'plan_excluded'
    );
  end if;

  -- Per-user, transaction-scoped. Two devices racing for the fifth slot
  -- serialise here; the second reads the first's reservation and is refused.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  v_start := date_trunc('month', now() at time zone 'utc')::date;

  -- USED IS DERIVED. A completed chat always counts; a reservation counts only
  -- while it is live, so an abandoned one releases itself when its window
  -- passes and can never permanently consume capacity.
  select count(*)::int into v_used
    from public.stylist_chat_reservations r
   where r.user_id = p_user_id
     and r.period_start = v_start
     and (
       r.state = 'completed'
       or (r.state = 'reserved'
           and r.created_at > now() - public.stylist_reservation_window())
     );

  if v_used >= p_limit then
    return jsonb_build_object(
      'allowed', false, 'reservation_id', null,
      'used', least(v_used, p_limit), 'limit', p_limit,
      'remaining', 0, 'reason', 'exhausted'
    );
  end if;

  insert into public.stylist_chat_reservations (user_id, period_start, state)
  values (p_user_id, v_start, 'reserved')
  returning id into v_id;

  return jsonb_build_object(
    'allowed', true, 'reservation_id', v_id,
    'used', v_used + 1, 'limit', p_limit,
    'remaining', greatest(0, p_limit - (v_used + 1))
  );
end;
$$;

/**
 * Settle a reservation as a real success. Idempotent for that exact id.
 *
 * A second call finds the row already `completed` and changes nothing. A call
 * for a reservation that was already released does NOT resurrect it — the
 * failure path already gave the slot back, and quietly taking it again would
 * be the same defect in the other direction.
 *
 * An EXPIRED reservation may still complete, because the chat genuinely
 * happened — but only if there is room for it right now. That check is what
 * keeps five meaning five even when a request comes back from the dead.
 */
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
  v_start   date;
  v_state   text;
  v_created timestamptz;
  v_used    integer;
  v_changed boolean := false;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  v_start := date_trunc('month', now() at time zone 'utc')::date;

  -- Scoped by BOTH id and user. One request can never settle another's, and an
  -- id guessed or replayed across accounts finds nothing.
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
      -- Late, but real. Count it only if it still fits.
      select count(*)::int into v_used
        from public.stylist_chat_reservations r
       where r.user_id = p_user_id and r.period_start = v_start
         and r.id <> p_reservation_id
         and (r.state = 'completed'
              or (r.state = 'reserved'
                  and r.created_at > now() - public.stylist_reservation_window()));

      if p_limit is not null and v_used < p_limit then
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

  select count(*)::int into v_used
    from public.stylist_chat_reservations r
   where r.user_id = p_user_id and r.period_start = v_start
     and (r.state = 'completed'
          or (r.state = 'reserved'
              and r.created_at > now() - public.stylist_reservation_window()));

  return jsonb_build_object(
    'state', (select state from public.stylist_chat_reservations where id = p_reservation_id),
    'changed', v_changed,
    'used', case when p_limit is null then v_used else least(v_used, p_limit) end,
    'limit', p_limit,
    'remaining', case when p_limit is null then null
                      else greatest(0, p_limit - v_used) end
  );
end;
$$;

/**
 * Give a reservation back after a failed provider call. Idempotent for that id.
 *
 * A LATE RELEASE AFTER COMPLETION IS A NO-OP. This is the exact case the
 * previous version got wrong: a timeout firing after the reply landed used to
 * erase a real success. A completed reservation stays completed, and the
 * release simply reports what it found.
 */
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
  v_start   date;
  v_state   text;
  v_used    integer;
  v_changed boolean := false;
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

  -- ONLY a live reservation may be released. Completed stays completed.
  if v_state = 'reserved' then
    update public.stylist_chat_reservations
       set state = 'released', settled_at = now()
     where id = p_reservation_id;
    v_changed := true;
  end if;

  select count(*)::int into v_used
    from public.stylist_chat_reservations r
   where r.user_id = p_user_id and r.period_start = v_start
     and (r.state = 'completed'
          or (r.state = 'reserved'
              and r.created_at > now() - public.stylist_reservation_window()));

  return jsonb_build_object(
    'state', (select state from public.stylist_chat_reservations where id = p_reservation_id),
    'changed', v_changed,
    'used', case when p_limit is null then v_used else least(v_used, p_limit) end,
    'limit', p_limit,
    'remaining', case when p_limit is null then null
                      else greatest(0, p_limit - v_used) end
  );
end;
$$;

-- Service role only. A client that could call any of these could grant itself
-- chats, or settle a reservation it does not own.
revoke all on function public.claim_stylist_chat(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_stylist_chat(uuid, integer) to service_role;

revoke all on function public.complete_stylist_chat(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.complete_stylist_chat(uuid, uuid, integer) to service_role;

revoke all on function public.release_stylist_chat(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.release_stylist_chat(uuid, uuid, integer) to service_role;

revoke all on function public.stylist_reservation_window() from public, anon, authenticated;
grant execute on function public.stylist_reservation_window() to service_role;

comment on table public.stylist_chat_reservations is
  'One row per attempted Standard stylist chat. Capacity is DERIVED — completed, plus reserved within the window — so an abandoned reservation frees itself and no counter can drift.';
