-- ===========================================================================
-- Close the write path through the public_* projection views.
--
-- THE BUG
--
-- `public_profiles` selects from exactly one table with no join, aggregate or
-- DISTINCT, which makes it AUTO-UPDATABLE in Postgres. It is owned by
-- `postgres` and defined without `security_invoker`, so it runs with the
-- owner's rights — and `postgres` bypasses RLS. INSERT, UPDATE, DELETE and
-- TRUNCATE were all granted to `anon` and `authenticated`.
--
-- The consequence: anyone holding the publishable anon key — which ships inside
-- the app, so it is public by construction — could write to `profiles` through
-- the view, with RLS bypassed entirely. Verified by probe, not inferred:
--
--   set local role anon;
--   update public_profiles set bio = bio where false;   -- succeeded
--
-- `where false` touches no rows but is still permission-checked at plan time,
-- so this proved the privilege without mutating anything. Every other public_*
-- view carries a join or a GROUP BY, so Postgres refuses to make them
-- updatable, and only `public_profiles` was actually writable — but all five
-- carried the same grants, and a later change to any definition (dropping a
-- join, say) would have silently armed the same hole.
--
-- The 2026-08-04 review caught the READ side of this — RLS filters rows, not
-- columns, so the fix was to project public columns through these views. The
-- write side came along with the default grants and was not examined.
--
-- SECOND BUG, smaller: `public_like_counts` had no visibility filter at all.
-- It aggregated every row of `closet_likes` regardless of whether the liked
-- item or outfit was public, so anonymous callers could enumerate like counts
-- for PRIVATE garments. Fixed below to carry the same guard as its siblings.
--
-- WHAT IS DELIBERATELY NOT DONE
--
-- The linter's remedy for `security_definer_view` is `security_invoker = true`.
-- Applying it here would BREAK the feature these views exist for: the base
-- tables are owner-only, so under the invoker's rights a visitor would see
-- nothing at all. Definer rights are the point — the view's own WHERE clause is
-- the access control. That is safe for SELECT and catastrophic for anything
-- else, which is precisely the distinction this migration draws.
--
-- The five ERRORs will therefore still appear in the advisor. They are an
-- accepted pattern, not an outstanding defect. Do not "fix" them by flipping
-- security_invoker.
--
-- SELECT is revoked too, because the social surface is deferred and nothing
-- queries these views today. Least privilege until the feature ships; re-enable
-- with a single GRANT (see the bottom of this file). The views themselves are
-- kept — they are the deferred social/shopping surface and must not be dropped.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. public_like_counts — add the visibility guard it never had.
--
-- Column names, types and order are unchanged so `create or replace` is legal.
-- A like row references either an item or an outfit, never both, so each arm of
-- the predicate guards its own side.
-- ---------------------------------------------------------------------------
create or replace view public_like_counts as
  select l.item_id,
         l.outfit_id,
         count(*) as likes
    from closet_likes l
    left join items    i  on i.id = l.item_id
    left join outfits  o  on o.id = l.outfit_id
    left join profiles pi on pi.user_id = i.user_id
    left join profiles po on po.user_id = o.user_id
   where (l.item_id is not null
          and i.is_public
          and not i.is_archived
          and pi.visibility = 'public'::profile_visibility)
      or (l.outfit_id is not null
          and o.is_public
          and po.visibility = 'public'::profile_visibility)
   group by l.item_id, l.outfit_id;

-- ---------------------------------------------------------------------------
-- 2. Strip every privilege from the client roles on all five views.
--
-- `revoke all` rather than naming the write verbs: REFERENCES and TRIGGER were
-- granted too, and an enumerated list is a list somebody forgets to extend.
-- ---------------------------------------------------------------------------
revoke all on public_profiles     from anon, authenticated;
revoke all on public_items        from anon, authenticated;
revoke all on public_outfits      from anon, authenticated;
revoke all on public_outfit_items from anon, authenticated;
revoke all on public_like_counts  from anon, authenticated;

-- Supabase's default privileges hand `anon` and `authenticated` full rights on
-- every new object in `public`. Without this, the next view created here is
-- born writable in exactly the same way.
alter default privileges in schema public
  revoke all on tables from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Trigger functions must not be callable over RPC.
--
-- All six return `trigger`. A trigger fires from the table it is attached to
-- and never consults the caller's EXECUTE privilege, so revoking costs nothing
-- and closes `/rest/v1/rpc/handle_new_user` and friends. Calling one directly
-- is meaningless at best; `sync_follow_counts` and `touch_chat_session` mutate
-- counters, and they were reachable unauthenticated.
-- ---------------------------------------------------------------------------
revoke execute on function handle_new_user()             from anon, authenticated;
revoke execute on function handle_new_style_profile()    from anon, authenticated;
revoke execute on function sync_follow_counts()          from anon, authenticated;
revoke execute on function touch_chat_session()          from anon, authenticated;
revoke execute on function assert_inquiry_target()       from anon, authenticated;
revoke execute on function assert_like_target_is_public() from anon, authenticated;

alter default privileges in schema public
  revoke execute on functions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Pin the one function still running with a mutable search_path.
--
-- Not SECURITY DEFINER, so the exposure is small — but a mutable search_path
-- on any function means a caller who can create objects can shadow the tables
-- it references. Pinning costs nothing.
-- ---------------------------------------------------------------------------
alter function current_ai_consent_version() set search_path = '';

-- ---------------------------------------------------------------------------
-- WHEN THE SOCIAL SURFACE SHIPS
--
-- Grant SELECT and nothing else. Never INSERT/UPDATE/DELETE — the views run
-- with definer rights, so a write grant is a write grant against the base
-- tables with RLS switched off:
--
--   grant select on public_profiles, public_items, public_outfits,
--                   public_outfit_items, public_like_counts
--      to anon, authenticated;
--
-- And re-run `select * from public_profiles` as `anon` to confirm the WHERE
-- clause is still the only thing standing between a visitor and every row.
-- ---------------------------------------------------------------------------
