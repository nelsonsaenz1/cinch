-- ===========================================================================
-- Write down the last of the ambient access matrix, and revoke the part of it
-- nobody asked for.
--
-- THE GAP THIS CLOSES. 167 grants exist in production and not in a clean
-- replay, in one direction only — production is strictly wider, and there is
-- no grant CI has that production lacks. They are the unwritten remainder of
-- Supabase's PROJECT-CREATION default privileges, which
-- `20260806100000_explicit_client_grants.sql` and
-- `20260806101000_service_role_grants.sql` began writing down and did not
-- finish: those two captured the `authenticated`-table and `service_role`-table
-- halves. The `anon`-table half and the whole routine half were never written
-- down, and they are what remains.
--
-- `20260805213000_close_public_view_write_path.sql` did
-- `alter default privileges … revoke all on tables from anon, authenticated`,
-- but that governs only objects created AFTER it, so every table created before
-- it keeps the ambient grant to this day.
--
-- WHY REVOKE AND NOT GRANT. Copying production's ambient grants into a
-- migration would make the hashes agree and write down an access matrix nobody
-- designed. `20260806100000`'s header states the intended one outright: "anon
-- gets NOTHING on base tables, by design — every anonymous read the product
-- will ever offer goes through the public_* projection views." So the anon half
-- is revoked to reach that, not granted to preserve it.
--
-- Measured against production before writing this, not assumed:
--   · 55 of 55 public tables have RLS enabled; 0 without.
--   · 0 policies on any of the 13 tables below admit `anon` or `PUBLIC`.
--   · `anon` and `authenticated` are both rolbypassrls = false.
-- So `anon` cannot today read or write a single row of these tables, and this
-- revoke removes reachability rather than access. The one observable change is
-- the error an anon caller gets: "permission denied" instead of an empty
-- result. No shipped path makes that call — the app reads as `authenticated`
-- or through the service role's signed URLs.
--
-- CONVERGENCE, both directions. A clean replay holds four NON-DML `anon`
-- privileges on these same 13 tables (TRUNCATE, REFERENCES, TRIGGER, MAINTAIN)
-- where production holds all eight; the production-only set is exactly the four
-- DML verbs. `revoke all` therefore lands both sides on zero rather than
-- meeting in the middle, which is why it is `all` and not the four verbs.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. anon holds nothing on base tables.
--    The 13 tables created before 20260805213000 turned the default off.
-- ---------------------------------------------------------------------------
revoke all privileges on table
  ai_calls, ai_usage_counters, chat_messages, chat_sessions, command_log,
  item_inquiries, outfit_calendar, outfit_reactions, style_feedback,
  style_profiles, tag_corrections, wardrobe_gaps, wishlist_items
from anon;

-- ---------------------------------------------------------------------------
-- 2. anon executes only what it was deliberately given.
--
--    `invite_card` and `join_waitlist` are NOT touched: both are granted by
--    committed migrations (20260810120100, 20260810130000), each after a
--    `revoke all … from public`, both appear in the replay, and both are the
--    only SECURITY DEFINER functions anon may call. They are intentional and
--    are not part of the drift.
--
--    The five below are SECURITY INVOKER (prosecdef = false), so they already
--    run with the caller's privileges and are gated by the same RLS as the
--    tables above. Anonymous callers have no business in any of them: four are
--    authenticated user operations and `claim_command` is a worker path.
-- ---------------------------------------------------------------------------
revoke execute on function apply_outfit_reaction        from anon;
revoke execute on function claim_command                from anon;
revoke execute on function current_ai_consent_version   from anon;
revoke execute on function log_outfit_wear              from anon;
revoke execute on function plan_outfit_tx               from anon;

-- ---------------------------------------------------------------------------
-- 3. The `authenticated` verbs that only ever existed as platform defaults.
--
--    These are real product operations that the RLS policies already admit —
--    the policies define which rows, these grants define which verbs, and the
--    two have to agree or the policy is dead letter. Written down here rather
--    than revoked because removing them would break shipped paths.
-- ---------------------------------------------------------------------------
grant insert, update, delete on ai_calls           to authenticated;
grant insert, update, delete on ai_usage_counters  to authenticated;
grant insert, update, delete on subscriptions      to authenticated;
grant update, delete          on tag_corrections   to authenticated;
grant delete                  on command_log       to authenticated;
grant delete                  on item_inquiries    to authenticated;
grant update                  on chat_messages     to authenticated;
grant update                  on closet_likes      to authenticated;
grant update                  on follows           to authenticated;
grant update                  on outfit_reactions  to authenticated;
grant update                  on style_feedback    to authenticated;

-- ---------------------------------------------------------------------------
-- 4. `log_outfit_wear` stays reachable by authenticated callers.
--
--    Superseded by `wear_outfit_tx` and called from nowhere in the current
--    client — the only references left are the generated type entry and a
--    comment in `src/features/styling/mutations.ts:155` recording the
--    replacement. It is retained because binaries in the field predate that
--    change, and a database built from this repo currently grants it to NO
--    role, so a rebuilt environment would refuse an RPC production answers.
--    That asymmetry is the thing being fixed; the grant is the cheap side of
--    it. Retire this line when no supported build calls it.
-- ---------------------------------------------------------------------------
grant execute on function log_outfit_wear to authenticated;

-- ---------------------------------------------------------------------------
-- 5. service_role executes every function, explicitly.
--
--    The other half of 20260806101000, which did exactly this for tables and
--    stopped there. service_role already carries BYPASSRLS and all 544 public
--    table grants — identical and hash-identical on both sides — so EXECUTE on
--    the remaining 91 functions confers nothing it cannot already do by
--    touching the tables directly. It is written down because the Edge
--    Functions run as this role and a replay that omits it produces a backend
--    that cannot call its own RPCs.
-- ---------------------------------------------------------------------------
grant execute on all functions in schema public to service_role;

-- ---------------------------------------------------------------------------
-- 6. Forward-looking, so this class of drift cannot recur.
--
--    20260805213000 did this for tables. Functions were left out, and the
--    routine half of the divergence is the result: Postgres grants EXECUTE on
--    every new function to PUBLIC unless told otherwise, and the platform's
--    own default ACL adds service_role on top.
-- ---------------------------------------------------------------------------
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;
alter default privileges in schema public grant  execute on functions to service_role;
