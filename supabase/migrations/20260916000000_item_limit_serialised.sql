-- ---------------------------------------------------------------------------
-- The closet ceiling is HARD (founder ruling 12.15, 2026-09-16).
--
-- `enforce_item_limit` counted a person's rows and then let the row through,
-- and two transactions doing that at the same instant both read the same
-- count: three parallel inserts at 8 active rows each passed (`d838cd70`,
-- 2026-09-11 01:31Z, eleven active rows on a free plan). The client's
-- concurrency is three, so the overshoot is bounded at two — but the founder's
-- word is "immediately refuse any more pieces after ten until they pay", and
-- a ceiling that can be two over is not that.
--
-- One transaction-scoped advisory lock per person, taken before the count.
-- Concurrent inserts for the same person now queue; each one's count runs
-- after the previous one has committed (READ COMMITTED takes a fresh snapshot
-- per statement, and the lock is released only at commit). Different people
-- never contend — the key is the person's id. The lock is cheap, held for
-- microseconds, and needs no table.
--
-- The count itself is unchanged: every row of `items`, `pending_upload`
-- included, so a photograph that has a row but no image still holds its slot
-- (which is what lets the retry road reuse the row rather than mint another).
-- The restore trigger takes the same lock for the same reason.
--
-- For the record, since the 09-15 nightly's 12.15 rests on it: 9014d342's
-- "32-row batch" did NOT land in one second. `items.created_at` by the second
-- reads 20:29:11 (1) · :12 (2) · :20 (1) · :28 (2) · :31 (1) · :35 (2) — nine
-- rows over twenty-four seconds — then `closet_limit_reached {held: 24}` at
-- 20:29:39 and the rest after her trial started at 20:32:43. The wall refused
-- her at ten, exactly as A28 designed, and she paid anyway. The race this
-- migration closes is the small one; the batch premise was a misread.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_item_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan          public.subscription_plan;
  v_active_limit  integer;
  v_total_limit   integer;
  v_active        integer;
  v_total         integer;
begin
  -- One writer per person at a time, for the life of this transaction.
  perform pg_advisory_xact_lock(hashtext('items_limit:' || new.user_id::text));

  v_plan         := public.effective_plan(new.user_id);
  v_active_limit := public.item_limit_for_plan(v_plan);
  v_total_limit  := public.item_total_limit_for_plan(v_plan);

  select count(*) filter (where not is_archived), count(*)
    into v_active, v_total
    from public.items
   where user_id = new.user_id;

  -- A row arriving already archived is a restore-style write, not a new
  -- garment; it must still respect the total, but it does not take an active
  -- slot and must not be refused for one.
  if not new.is_archived and v_active >= v_active_limit then
    raise exception 'closet_limit_reached: % of % garments', v_active, v_active_limit
      using errcode = 'check_violation',
            hint    = 'Store a piece to make room, or upgrade for a larger closet.';
  end if;

  if v_total >= v_total_limit then
    raise exception 'storage_limit_reached: % of % stored', v_total, v_total_limit
      using errcode = 'check_violation',
            hint    = 'Delete a stored piece, or upgrade.';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_item_limit_on_restore()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_active_limit integer;
  v_active       integer;
begin
  if old.is_archived and not new.is_archived then
    perform pg_advisory_xact_lock(hashtext('items_limit:' || new.user_id::text));

    v_active_limit := public.item_limit_for_plan(public.effective_plan(new.user_id));

    select count(*) into v_active
      from public.items
     where user_id = new.user_id and not is_archived and id <> new.id;

    if v_active >= v_active_limit then
      raise exception 'closet_limit_reached: % of % garments', v_active, v_active_limit
        using errcode = 'check_violation',
              hint    = 'Store another piece first, or upgrade for a larger closet.';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.enforce_item_limit() is
  'BEFORE INSERT on items: refuses the row when the person is at their plan''s active or total ceiling. Serialised per person with a transaction advisory lock (12.15, 2026-09-16) so concurrent inserts cannot each read the same count.';
