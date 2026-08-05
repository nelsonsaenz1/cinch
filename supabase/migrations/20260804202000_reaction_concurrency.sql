-- ---------------------------------------------------------------------------
-- Concurrency-safe learning updates  (CIN-12)
--
-- `apply_outfit_reaction` took the new weights as an argument and wrote them
-- with `set weights = excluded.weights`. Those weights are computed on the
-- client from a profile SNAPSHOT the screen is holding. Two reactions a moment
-- apart therefore both derive from the same snapshot, both write absolute
-- values, and the second silently erases the first — while feedback_count
-- incremented twice, so the profile claimed to have learned from two reactions
-- while carrying the effect of one.
--
-- The fix is optimistic concurrency, not locking-and-hoping: the caller says
-- which version of the profile it reasoned about, and a write derived from a
-- superseded version is refused rather than applied blindly.
--
-- Refused, crucially, is NOT lost. The reaction row is always inserted. Every
-- reaction stores its own features and baseline precisely so the model can be
-- replayed from the event log, so a skipped weight update costs nothing that
-- cannot be recomputed — whereas a clobbered weight vector is gone.
--
-- `p_expected_feedback_count` defaults to null, which preserves the old
-- last-write-wins behaviour for any build already in the field that does not
-- send it. New clients pass it and retry on `applied: false`.
-- ---------------------------------------------------------------------------

drop function if exists apply_outfit_reaction(
  uuid[], smallint, jsonb, jsonb, jsonb, jsonb, text[], uuid, text, text
);

create function apply_outfit_reaction(
  p_item_ids   uuid[],
  p_reaction   smallint,
  p_features   jsonb,
  p_baseline   jsonb,
  p_weights    jsonb,
  p_affinities jsonb,
  p_summary    text[],
  p_outfit_id  uuid    default null,
  p_reason     text    default null,
  p_source     text    default 'today',
  p_expected_feedback_count integer default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user    uuid := (select auth.uid());
  v_current integer;
  v_applied boolean := true;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  -- The event is the source of truth and is recorded unconditionally.
  insert into public.outfit_reactions
    (user_id, outfit_id, item_ids, reaction, reason, features, baseline, source)
  values
    (v_user, p_outfit_id, p_item_ids, p_reaction, p_reason, p_features, p_baseline, p_source);

  -- Take the row lock BEFORE comparing versions. Without `for update` two
  -- callers can both read the same count, both conclude they are current, and
  -- both write — which is the very race this function exists to close.
  select feedback_count into v_current
    from public.style_profiles
   where user_id = v_user
     for update;

  if v_current is null then
    -- No profile row yet: this is the first reaction, so there is nothing to
    -- conflict with.
    insert into public.style_profiles (user_id, weights, affinities, summary, feedback_count)
    values (v_user, p_weights, p_affinities, p_summary, 1)
    on conflict (user_id) do update
      set weights        = excluded.weights,
          affinities     = excluded.affinities,
          summary        = excluded.summary,
          feedback_count = public.style_profiles.feedback_count + 1;

    return jsonb_build_object('applied', true, 'feedback_count', 1);
  end if;

  if p_expected_feedback_count is not null
     and p_expected_feedback_count <> v_current then
    -- Stale. Count the reaction so the tally stays honest, leave the weights
    -- alone, and tell the caller to recompute from the current profile.
    v_applied := false;
    update public.style_profiles
       set feedback_count = feedback_count + 1
     where user_id = v_user;
  else
    update public.style_profiles
       set weights        = p_weights,
           affinities     = p_affinities,
           summary        = p_summary,
           feedback_count = feedback_count + 1
     where user_id = v_user;
  end if;

  return jsonb_build_object('applied', v_applied, 'feedback_count', v_current + 1);
end;
$$;
