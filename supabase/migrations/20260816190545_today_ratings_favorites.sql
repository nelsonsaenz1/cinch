-- Today wear feedback and owner-private favorite outfits.
--
-- `outfits.rating` is the legacy binary reaction column (-1 / 1). It remains
-- untouched so older clients and reaction history keep their meaning.

alter table public.outfits
  add column if not exists wear_rating smallint
    check (wear_rating between 1 and 5),
  add column if not exists favorited_at timestamptz;

create index if not exists outfits_user_favorited_idx
  on public.outfits (user_id, favorited_at desc)
  where favorited_at is not null;

comment on column public.outfits.wear_rating is
  'Optional 1-5 rating recorded when an outfit is marked worn; null means unrated.';
comment on column public.outfits.favorited_at is
  'Owner-private favorite marker. This column is intentionally absent from public_outfits.';

-- Replace rather than overload. The existing eight-argument function has
-- defaults, so leaving it beside this ten-argument function would make
-- PostgREST calls ambiguous.
drop function if exists public.wear_outfit_tx(
  uuid, uuid[], text, text, jsonb, public.outfit_source, uuid, text
);

create function public.wear_outfit_tx(
  p_op_id       uuid,
  p_item_ids    uuid[],
  p_name        text                 default null,
  p_reasoning   text                 default null,
  p_context     jsonb                default null,
  p_source      public.outfit_source default 'ai',
  p_origin      uuid                 default null,
  p_note        text                 default null,
  p_wear_rating smallint             default null,
  p_favorite    boolean              default false
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
  if coalesce(array_length(p_item_ids, 1), 0) = 0 then
    raise exception 'an outfit needs at least one item' using errcode = '22004';
  end if;
  if p_wear_rating is not null and p_wear_rating not between 1 and 5 then
    raise exception 'wear rating must be between 1 and 5' using errcode = '22003';
  end if;

  select already_done, existing_result into v_done, v_prior
    from public.claim_command(p_op_id, v_user, 'wear_outfit');
  if v_done then
    return v_prior;
  end if;

  select count(distinct x) into v_asked from unnest(p_item_ids) x;
  select count(*) into v_owned
    from public.items where id = any(p_item_ids) and user_id = v_user;
  if v_owned <> v_asked then
    raise exception 'one or more of those items is not yours' using errcode = '42501';
  end if;

  if p_origin is not null and not exists (
    select 1 from public.outfits where id = p_origin and user_id = v_user
  ) then
    raise exception 'that plate is not yours' using errcode = '42501';
  end if;

  insert into public.outfits
    (user_id, name, reasoning, context_snapshot, generated_by, worn_at,
     origin_outfit_id, note, wear_rating, favorited_at)
  values
    (v_user, p_name, p_reasoning, p_context, p_source, now(),
     p_origin, nullif(btrim(coalesce(p_note, '')), ''), p_wear_rating,
     case when p_favorite then now() else null end)
  returning id into v_outfit;

  insert into public.outfit_items (outfit_id, item_id, user_id, position)
  select v_outfit, x.id, v_user, x.ord
    from unnest(p_item_ids) with ordinality as x(id, ord);

  update public.items
     set wear_count = wear_count + 1,
         last_worn_at = now()
   where id = any(p_item_ids)
     and user_id = v_user;

  update public.command_log set result_id = v_outfit where op_id = p_op_id;
  return v_outfit;
end;
$$;

revoke execute on function public.wear_outfit_tx(
  uuid, uuid[], text, text, jsonb, public.outfit_source, uuid, text, smallint, boolean
) from public, anon;
grant execute on function public.wear_outfit_tx(
  uuid, uuid[], text, text, jsonb, public.outfit_source, uuid, text, smallint, boolean
) to authenticated;
