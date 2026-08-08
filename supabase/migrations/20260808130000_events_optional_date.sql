-- ===========================================================================
-- An occasion may have no date yet.
--
-- The New Occasion atlas (docs/design/new-occasion-spec.md §2) makes a
-- name-only occasion the central premise — N-10 draws it in so many words:
-- "No date yet. Add one and Cinch can read the weather and plan a look for
-- it." `starts_at timestamptz not null` makes that row unstorable, so the
-- form has been quietly forcing a date on people who do not have one.
--
-- Dropping NOT NULL is one line. The reason this migration is longer than one
-- line is `enforce_event_limit()`, which reads `starts_at` to decide whether
-- an event is still upcoming and would treat a dateless occasion as expired —
-- and therefore free — the moment it was created. A host could then keep an
-- unbounded number of undated occasions on a free plan. The tier cap is a
-- paid boundary, so it is recreated here rather than patched around.
--
-- Two things do NOT need changing, checked rather than assumed:
--
--   * The `ends_at is null or ends_at > starts_at` CHECK. A comparison
--     against NULL yields NULL, which a CHECK treats as satisfied, and the
--     redesigned form no longer writes `ends_at` at all.
--   * `events_host_time_idx (host_id, starts_at)`. A btree indexes NULLs, so
--     the limit trigger's per-host count still uses it.
--
-- The client half of this change — the Plan list's date window and its
-- "soonest first" ordering, which would otherwise drop or mis-sort a dateless
-- row — lives in src/features/events/queries.ts.
-- ===========================================================================

alter table events alter column starts_at drop not null;

-- ---------------------------------------------------------------------------
-- The hosting cap, recreated in full.
--
-- One line differs from 20260807103000_social_views_grants_realtime_limits.sql
-- (:251): the coalesce chain gains `'infinity'::timestamptz` as its last
-- fallback. An event with neither an end nor a start has no expiry to compare
-- against, so it counts until it is dated — which is the honest reading of
-- "upcoming events" for an occasion that has not been scheduled yet, and the
-- only reading that keeps the cap a cap.
--
-- The tier numbers, the errcode, the sentinel prose the client matches on
-- (`event_limit_reached` in src/features/events/mutations.ts), the hint and
-- the security settings are carried over verbatim. CREATE OR REPLACE keeps
-- the function's oid, so the `events_enforce_limit` trigger stays attached,
-- and keeps its ACL, so the original
-- `revoke execute ... from public, anon, authenticated` still stands — the
-- same reasoning spelled out in 20260808120000_ai_consent_v2.sql.
-- ---------------------------------------------------------------------------
create or replace function enforce_event_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_limit integer; v_count integer;
begin
  v_limit := public.event_limit_for_plan(public.effective_plan(new.host_id));
  select count(*) into v_count from public.events
   where host_id = new.host_id and canceled_at is null
     and coalesce(ends_at, starts_at + interval '6 hours', 'infinity'::timestamptz) > now();
  if v_count >= v_limit then
    raise exception 'event_limit_reached: % of % upcoming events', v_count, v_limit
      using errcode = 'check_violation', hint = 'Upgrade to host more events.';
  end if;
  return new;
end; $$;
