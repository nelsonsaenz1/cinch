-- M-08's "keep ten for now" picker needs to reverse a specific voice commit
-- without touching photo-intake items or another session's voice items.
-- Nullable: every row that predates this migration, and every item from The
-- Ten, is legitimately NULL.
alter table public.items
  add column intake_draft_id uuid references public.intake_drafts(id) on delete set null;

create index items_intake_draft_id_idx on public.items (intake_draft_id)
  where intake_draft_id is not null;

comment on column public.items.intake_draft_id is
  'The draft this item was committed from, when intake_method=''voice''. Lets commit_intake_session''s resolve mode (M-08) find and remove a specific voice commit when the user swaps their ten. Null for every photo-intake item and for voice items committed before this column existed.';

-- Replace commit_intake_session with a version that also accepts an explicit
-- draft-id list ("resolve mode"), used by M-08's "keep ten for now" picker
-- after M-07 has told someone they hit the ceiling. Existing callers pass
-- nothing and get byte-for-byte the original behaviour, plus the new column
-- stamped on every insert so a later resolve can find these rows again.
--
-- The one-arg signature is dropped first so PostgREST has exactly one
-- candidate to resolve a p_session_id-only call against — leaving both
-- would make that call ambiguous between "the old function" and "the new
-- function with its default", which Postgres refuses to pick between.
drop function if exists public.commit_intake_session(uuid);

create or replace function public.commit_intake_session(
  p_session_id uuid,
  p_draft_ids uuid[] default null
)
returns table (committed integer, held integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_draft     record;
  v_copy      integer;
  v_committed integer := 0;
  v_held      integer := 0;
  v_ceiling   boolean := false;
  v_total_qty integer := 0;
begin
  if p_draft_ids is null then
    -- ── Original path: commit every confirmed draft in spoken order,
    -- stopping cleanly at the plan ceiling.
    for v_draft in
      select *
        from public.intake_drafts
       where session_id = p_session_id
         and state = 'confirmed'
       order by ordinal
    loop
      for v_copy in 1 .. greatest(v_draft.quantity, 1) loop

        if v_ceiling then
          v_held := v_held + 1;
          continue;
        end if;

        begin
          insert into public.items (
            user_id, status, category, subcategory,
            colors, pattern, material,
            formality_score, warmth_score,
            description, image_path,
            colour_source, intake_method, user_verified,
            intake_draft_id
          ) values (
            v_draft.user_id,
            'verified',
            public.intake_category_for(v_draft.slot),
            v_draft.name,
            case
              when v_draft.colour_oklch ? 'hex' then
                jsonb_build_array(jsonb_build_object(
                  'hex',  v_draft.colour_oklch ->> 'hex',
                  'name', v_draft.colour_term))
              else '[]'::jsonb
            end,
            v_draft.pattern,
            v_draft.fabric,
            v_draft.formality,
            v_draft.warmth,
            v_draft.utterance,
            v_draft.image_path,
            'spoken',
            'voice',
            true,
            v_draft.id
          );
          v_committed := v_committed + 1;

        exception when check_violation then
          if sqlerrm like 'closet_limit_reached%' then
            v_ceiling := true;
            v_held := v_held + 1;
          else
            raise;
          end if;
        end;

      end loop;
    end loop;

    update public.intake_sessions
       set status = 'committed'
     where id = p_session_id;

    return query select v_committed, v_held;
    return;
  end if;

  -- ── Resolve mode. The caller already committed once (the branch above) and
  -- is now naming the FINAL set of drafts that should be active, chosen by a
  -- person walking M-08's picker. Delete first, insert second: freeing room
  -- under the ceiling before anything new is inserted is what makes this work
  -- without ever asking the trigger to allow more than it will.
  delete from public.items
   where user_id = (select user_id from public.intake_sessions where id = p_session_id)
     and intake_draft_id in (
       select id from public.intake_drafts
        where session_id = p_session_id and state = 'confirmed'
     )
     and not (intake_draft_id = any(p_draft_ids));

  for v_draft in
    select *
      from public.intake_drafts
     where session_id = p_session_id
       and state = 'confirmed'
       and id = any(p_draft_ids)
       and not exists (
         select 1 from public.items i where i.intake_draft_id = intake_drafts.id
       )
     order by ordinal
  loop
    for v_copy in 1 .. greatest(v_draft.quantity, 1) loop
      insert into public.items (
        user_id, status, category, subcategory,
        colors, pattern, material,
        formality_score, warmth_score,
        description, image_path,
        colour_source, intake_method, user_verified,
        intake_draft_id
      ) values (
        v_draft.user_id,
        'verified',
        public.intake_category_for(v_draft.slot),
        v_draft.name,
        case
          when v_draft.colour_oklch ? 'hex' then
            jsonb_build_array(jsonb_build_object(
              'hex',  v_draft.colour_oklch ->> 'hex',
              'name', v_draft.colour_term))
          else '[]'::jsonb
        end,
        v_draft.pattern,
        v_draft.fabric,
        v_draft.formality,
        v_draft.warmth,
        v_draft.utterance,
        v_draft.image_path,
        'spoken',
        'voice',
        true,
        v_draft.id
      );
    end loop;
  end loop;

  select coalesce(sum(quantity), 0) into v_total_qty
    from public.intake_drafts
   where session_id = p_session_id and state = 'confirmed';

  select count(*) into v_committed
    from public.items
   where intake_draft_id in (
     select id from public.intake_drafts
      where session_id = p_session_id and state = 'confirmed'
   );

  v_held := greatest(v_total_qty - v_committed, 0);

  return query select v_committed, v_held;
end;
$$;

comment on function public.commit_intake_session(uuid, uuid[]) is
  'Commits a walkthrough''s confirmed drafts into items. With p_draft_ids null (the default), commits every confirmed draft in spoken order, stopping cleanly at the plan ceiling. With p_draft_ids set, resolves to exactly that set (M-08''s "keep ten for now" picker): removes any currently-active item for this session not named, inserts any named draft not yet an item. Returns (committed, held) either way.';

revoke execute on function public.commit_intake_session(uuid, uuid[]) from public, anon;
grant execute on function public.commit_intake_session(uuid, uuid[]) to authenticated;
