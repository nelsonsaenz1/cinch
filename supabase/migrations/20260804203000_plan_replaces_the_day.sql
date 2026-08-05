-- ---------------------------------------------------------------------------
-- plan_outfit_tx: actually replace the day's plan, and keep the context
--
-- Fixes a defect in 20260804200000. That version ended with:
--
--     on conflict (user_id, planned_date, outfit_id) do update set note = ...
--
-- and a comment claiming "re-planning the same day replaces the plan rather
-- than stacking onto it". It cannot. The conflict target includes outfit_id,
-- and the outfit is freshly inserted microseconds earlier in the same call, so
-- the tuple is unique every single time and the clause never fires. Planning
-- Tuesday twice left two calendar rows for Tuesday.
--
-- The comment was the worse half of the bug: it asserted an invariant the code
-- did not hold, which is precisely how a later reader ends up trusting it.
--
-- Replacement is expressed directly instead — delete the day, then insert it.
-- The previously planned outfit row is deliberately NOT deleted: it may already
-- be referenced by reactions or feedback, and an outfit that was planned and
-- then changed is legitimate history rather than garbage.
--
-- Also adds p_context, so a planned outfit keeps the weather and events it was
-- generated against. wear_outfit_tx already snapshots this; plan silently did
-- not, which made a saved plan unexplainable a week later.
-- ---------------------------------------------------------------------------

drop function if exists plan_outfit_tx(uuid, uuid[], date, text, text);

create function plan_outfit_tx(
  p_op_id        uuid,
  p_item_ids     uuid[],
  p_planned_date date,
  p_name         text  default null,
  p_note         text  default null,
  p_context      jsonb default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user   uuid := (select auth.uid());
  v_outfit uuid;
  v_done   boolean;
  v_prior  uuid;
  v_owned  integer;
  v_asked  integer;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_op_id is null then
    raise exception 'an operation id is required' using errcode = '22004';
  end if;
  if p_planned_date is null then
    raise exception 'a date is required' using errcode = '22004';
  end if;
  if coalesce(array_length(p_item_ids, 1), 0) = 0 then
    raise exception 'an outfit needs at least one item' using errcode = '22004';
  end if;

  select already_done, existing_result into v_done, v_prior
    from public.claim_command(p_op_id, v_user, 'plan_outfit');
  if v_done then
    return v_prior;
  end if;

  select count(distinct x) into v_asked from unnest(p_item_ids) x;
  select count(*) into v_owned
    from public.items where id = any(p_item_ids) and user_id = v_user;
  if v_owned <> v_asked then
    raise exception 'one or more of those items is not yours' using errcode = '42501';
  end if;

  insert into public.outfits (user_id, name, generated_by, context_snapshot)
  values (v_user, p_name, 'ai', p_context)
  returning id into v_outfit;

  insert into public.outfit_items (outfit_id, item_id, user_id, position)
  select v_outfit, x.id, v_user, x.ord
    from unnest(p_item_ids) with ordinality as x(id, ord);

  -- One plan per day: clear whatever was there, then write the new one. Same
  -- transaction, so the day is never briefly empty to a concurrent reader.
  delete from public.outfit_calendar
   where user_id = v_user
     and planned_date = p_planned_date;

  insert into public.outfit_calendar (user_id, outfit_id, planned_date, note)
  values (v_user, v_outfit, p_planned_date, p_note);

  update public.command_log set result_id = v_outfit where op_id = p_op_id;

  return v_outfit;
end;
$$;
