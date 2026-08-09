-- ---------------------------------------------------------------------------
-- Two limits: what Cinch styles, and what the account holds.
--
-- Until now one number did both jobs, and the trigger counted every row a user
-- owned, archived included. The comment on that decision was right about the
-- risk it was avoiding — if archived rows were free, "archive everything"
-- becomes a way to hold an unlimited closet on the free tier — but it made The
-- Wall's non-payment exit impossible. Storing a piece was supposed to make room
-- for the next one, and it did not: the very next insert hit the same ceiling,
-- because the stored row was still counted. That leaves payment as the only way
-- past ten, which is the failure the design set out to avoid.
--
-- So the one number becomes two.
--
--   item_limit_for_plan()        the ACTIVE closet — what Cinch styles from,
--                                what the grid shows, what the outfit count is
--                                computed over. Archived pieces are excluded.
--
--   item_total_limit_for_plan()  every row, archived included. The anti-abuse
--                                ceiling the old comment was protecting. Three
--                                times the active limit: enough that curating
--                                ten out of a real wardrobe works, far short of
--                                unlimited free storage.
--
-- A stored piece keeps its photograph, its wear history and its cost-per-wear,
-- and returns intact when a slot opens. It simply stops being styled. That is
-- what the swap sheet has always said it does, and now it is true.
-- ---------------------------------------------------------------------------

create or replace function item_total_limit_for_plan(p_plan subscription_plan)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_plan
           when 'free'     then 30
           when 'standard' then 450
           when 'pro'      then 3000
         end;
$$;

/**
 * Refuse an insert that would break either ceiling.
 *
 * Two counts rather than one, and they fail with different messages because
 * they have different remedies: an active closet at its limit is fixed by
 * storing a piece or upgrading, while an account at its total is fixed only by
 * deleting something or upgrading. Telling someone to "make room" when making
 * room will not help is exactly the dead end this migration exists to remove.
 */
create or replace function enforce_item_limit()
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

/**
 * Unarchiving has to respect the active limit too.
 *
 * Otherwise the ceiling is trivially skipped: store a piece, add a new one in
 * the freed slot, then bring the stored piece back and hold eleven. The insert
 * trigger cannot see this — no row is being inserted.
 */
create or replace function enforce_item_limit_on_restore()
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

drop trigger if exists items_enforce_limit_on_restore on items;
create trigger items_enforce_limit_on_restore
  before update of is_archived on items
  for each row execute function enforce_item_limit_on_restore();

-- The active count now filters, so the count-supporting index should too.
create index if not exists items_user_active_count_idx
  on items (user_id) where not is_archived;

revoke execute on function item_total_limit_for_plan(subscription_plan) from public, anon, authenticated;
revoke execute on function enforce_item_limit_on_restore()              from public, anon, authenticated;
