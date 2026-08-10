-- The Walkthrough, part three of three: provenance on items, and the commit.
--
-- Spec: docs/design/voice-intake-directive.md §5.3 and §5.4.

-- ---------------------------------------------------------------------------
-- §5.3 · Provenance
-- ---------------------------------------------------------------------------

alter table public.items
  add column colour_source text not null default 'measured'
    check (colour_source in ('measured','spoken')),
  add column intake_method text not null default 'photo'
    check (intake_method in ('photo','voice','manual'));

-- The defaults are the truth about every row that already exists: all of them
-- arrived as photographs, and every colour in them was measured off pixels.

comment on column public.items.colour_source is
  'Where the colour came from. ''measured'' is off pixels; ''spoken'' is lexicon-derived from a colour word and is the weaker claim. V-08''s photo upgrade rewrites spoken to measured — see docs/design/voice-intake-directive.md §7.';
comment on column public.items.intake_method is
  'How the garment got here. The analytics cut that answers whether voice intake worked.';

-- ---------------------------------------------------------------------------
-- Slot → category
--
-- items stores `category`; the styling engine's `Slot` is DERIVED from
-- category + subcategory (src/lib/styling/types.ts:11, toSlot at
-- garment.ts:41). Committing a draft therefore has to invert a derivation that
-- lives in TypeScript, and eight of the nine slots invert cleanly because
-- category alone decides them.
--
-- The ninth does not. `base_top` and `mid_layer` are BOTH category 'top', and
-- toSlot separates them by regex over `subcategory` — a t-shirt from a
-- cardigan. So the round trip depends on the subcategory text.
--
-- THE DECISION, and it is not free: this function maps slot → category only,
-- and the caller writes the spoken garment noun into `subcategory` verbatim.
--
-- The alternative was to canonicalise — write 'sweater' for every mid_layer,
-- 'top' for every base_top — which would guarantee the round trip in SQL. It
-- was rejected because `subcategory` IS the display name: pieceName() at
-- src/features/closet/item-name.ts:31 renders "colour + subcategory", so every
-- spoken top in the closet would read "Navy top" and every knit "Navy sweater",
-- and the user's own word for their own garment would be thrown away at the
-- exact moment the product is trying to prove it listened.
--
-- Copying the MID_LAYER regex into SQL was rejected too: it would be a second
-- copy of a list that already drifts (supabase/tests/04_plans.sql exists
-- because the closet limits have three copies). The round trip is instead
-- pinned where toSlot actually lives — tests/intake-slot-roundtrip.test.ts.

create or replace function public.intake_category_for(p_slot text)
returns public.item_category
language sql
immutable
set search_path = ''
as $$
  select case p_slot
    when 'base_top'  then 'top'
    when 'mid_layer' then 'top'
    when 'bottom'    then 'bottom'
    when 'dress'     then 'dress'
    when 'outerwear' then 'outerwear'
    when 'footwear'  then 'footwear'
    when 'bag'       then 'bag'
    when 'headwear'  then 'headwear'
    when 'accessory' then 'accessory'
    else 'other'
  end::public.item_category;
$$;

comment on function public.intake_category_for(text) is
  'Slot → items.category. base_top and mid_layer both map to ''top''; the two are separated by subcategory text, which the caller writes verbatim. See the header of this migration.';

-- ---------------------------------------------------------------------------
-- §5.4 · commit_intake_session
--
-- security INVOKER, deliberately. RLS on intake_sessions and intake_drafts is
-- then the whole of the ownership check — a caller passing someone else's
-- session id sees zero rows and commits nothing, and the update below matches
-- nothing. There is no service_role anywhere in this path, because a definer
-- function here would be a hole straight past the plan ceiling.
-- ---------------------------------------------------------------------------

create or replace function public.commit_intake_session(p_session_id uuid)
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
begin
  for v_draft in
    select *
      from public.intake_drafts
     where session_id = p_session_id
       and state = 'confirmed'
     order by ordinal
  loop
    -- quantity is V-09's count stepper: "three white tees" is three garments,
    -- not one with a number on it. Each copy is a row and each row meets the
    -- ceiling on its own.
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
          colour_source, intake_method, user_verified
        ) values (
          v_draft.user_id,
          -- Not 'pending_upload': there is no upload coming. The user saw this
          -- garment on a card and pressed Confirm, which is exactly what
          -- 'verified' means (initial_schema.sql:25).
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
          -- The user's own sentence. Kept because it is the honest record of
          -- where this garment came from, and because inferFit and
          -- inferPatternScale (garment.ts:112) read subcategory + description
          -- as one string — "my oversized navy jumper" carries a fit the
          -- parsed fields do not.
          v_draft.utterance,
          v_draft.image_path,
          'spoken',
          'voice',
          true
        );
        v_committed := v_committed + 1;

      exception when check_violation then
        -- items_enforce_limit raised (membership_tiers.sql:266). This is the
        -- ceiling arriving exactly once, at commit, which is the entire reason
        -- intake_drafts exists. Everything from here is HELD, not lost: the
        -- drafts stay on the table for M-08's "keep ten for now" picker.
        --
        -- Matched on the message rather than the errcode alone so a genuine
        -- constraint bug still surfaces instead of being counted as a ceiling.
        if sqlerrm like 'closet_limit_reached%' then
          v_ceiling := true;
          v_held := v_held + 1;
        else
          raise;
        end if;
      end;

    end loop;
  end loop;

  -- Committed even when some were held. The ceiling is a product surface, not
  -- a failure, and the session is finished either way. Drafts are deliberately
  -- NOT deleted — reframe directive §4.6, nothing is ever lost.
  update public.intake_sessions
     set status = 'committed'
   where id = p_session_id;

  return query select v_committed, v_held;
end;
$$;

comment on function public.commit_intake_session(uuid) is
  'Commits a walkthrough''s confirmed drafts into items, in spoken order, stopping cleanly at the plan ceiling. Returns (committed, held). Held drafts are kept, never deleted.';

revoke execute on function public.commit_intake_session(uuid) from public, anon;
grant execute on function public.commit_intake_session(uuid) to authenticated;

grant execute on function public.intake_category_for(text) to authenticated;
