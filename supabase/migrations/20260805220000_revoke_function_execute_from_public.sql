-- ===========================================================================
-- Actually revoke EXECUTE on the SECURITY DEFINER functions.
--
-- The previous migration wrote:
--
--   revoke execute on function handle_new_user() from anon, authenticated;
--
-- and it did nothing. In Postgres, EXECUTE on a new function is granted to
-- PUBLIC by default, and `anon`/`authenticated` hold it through that PUBLIC
-- grant rather than through a grant of their own. Revoking from a role that was
-- never granted directly is a no-op that raises no error, so the migration
-- applied cleanly and every function stayed callable —
-- `has_function_privilege('anon', …, 'EXECUTE')` still returned true.
--
-- The revoke has to target PUBLIC.
--
-- TWO CATEGORIES, TREATED DIFFERENTLY
--
-- Trigger functions need no EXECUTE grant from anyone: a trigger fires from the
-- table it is attached to, in the table owner's context, and never consults the
-- caller's privileges. They lose EXECUTE entirely.
--
-- `claim_ai_quota` and `effective_plan` are called over RPC by the Edge
-- Functions using the service-role key, so they must keep working — for exactly
-- one role. They lose PUBLIC and are granted explicitly to `service_role`.
-- These two are the reason this is not a blanket revoke: `claim_ai_quota` takes
-- a user id as an argument, so any client able to call it could spend another
-- account's allowance. That is the whole quota system defeated by one HTTP
-- request, and it was reachable unauthenticated until now.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Trigger functions. No caller ever needs EXECUTE.
-- ---------------------------------------------------------------------------
revoke execute on function handle_new_user()              from public, anon, authenticated;
revoke execute on function handle_new_style_profile()     from public, anon, authenticated;
revoke execute on function handle_new_subscription()      from public, anon, authenticated;
revoke execute on function sync_follow_counts()           from public, anon, authenticated;
revoke execute on function touch_chat_session()           from public, anon, authenticated;
revoke execute on function assert_inquiry_target()        from public, anon, authenticated;
revoke execute on function assert_like_target_is_public() from public, anon, authenticated;
revoke execute on function enforce_item_limit()           from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Service-role RPCs. Reachable by the Edge Functions and by nothing else.
-- ---------------------------------------------------------------------------
revoke execute on function claim_ai_quota(uuid, text, integer, text) from public, anon, authenticated;
revoke execute on function claim_ai_quota(uuid, text, integer)       from public, anon, authenticated;
revoke execute on function effective_plan(uuid)                      from public, anon, authenticated;
revoke execute on function item_limit_for_plan(subscription_plan)    from public, anon, authenticated;

grant execute on function claim_ai_quota(uuid, text, integer, text) to service_role;
grant execute on function claim_ai_quota(uuid, text, integer)       to service_role;
grant execute on function effective_plan(uuid)                      to service_role;

-- Default privileges must target PUBLIC for the same reason. Without this the
-- next SECURITY DEFINER function added to this schema is born world-callable.
alter default privileges in schema public revoke execute on functions from public;
