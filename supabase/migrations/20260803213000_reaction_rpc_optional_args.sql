-- Reorder apply_outfit_reaction so its genuinely optional arguments are
-- trailing and defaulted.
--
-- Postgres requires every parameter after the first defaulted one to have a
-- default too, so `p_outfit_id` could not be optional while sitting first. That
-- forced callers to pass an explicit null, and the generated TypeScript types
-- (which model parameter presence but not nullability) typed it as a required
-- `string`. Named-notation RPC calls do not care about order, so moving it is
-- free.
--
-- Dropped rather than replaced: `create or replace` with a different parameter
-- list creates an overload, and two overloads reachable by named arguments is
-- an ambiguous-function error at call time.

drop function if exists apply_outfit_reaction(
  uuid, uuid[], smallint, jsonb, jsonb, jsonb, jsonb, text[], text, text
);

create function apply_outfit_reaction(
  p_item_ids   uuid[],
  p_reaction   smallint,
  p_features   jsonb,
  p_baseline   jsonb,
  p_weights    jsonb,
  p_affinities jsonb,
  p_summary    text[],
  p_outfit_id  uuid default null,
  p_reason     text default null,
  p_source     text default 'today'
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  insert into public.outfit_reactions
    (user_id, outfit_id, item_ids, reaction, reason, features, baseline, source)
  values
    (v_user, p_outfit_id, p_item_ids, p_reaction, p_reason, p_features, p_baseline, p_source);

  insert into public.style_profiles (user_id, weights, affinities, summary, feedback_count)
  values (v_user, p_weights, p_affinities, p_summary, 1)
  on conflict (user_id) do update
    set weights        = excluded.weights,
        affinities     = excluded.affinities,
        summary        = excluded.summary,
        feedback_count = public.style_profiles.feedback_count + 1;
end;
$$;
