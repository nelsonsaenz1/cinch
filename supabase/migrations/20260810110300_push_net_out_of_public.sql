-- ===========================================================================
-- pg_net out of `public`.
--
-- `create extension pg_net` in 20260810110200 named no schema, so the extension
-- record landed in `public` and the linter flagged it (0014_extension_in_public
-- — an extension in `public` is reachable through the exposed API surface and
-- can collide with a table name).
--
-- `alter extension pg_net set schema extensions` is REFUSED — pg_net does not
-- support SET SCHEMA, because its API is pinned to the `net` schema by the
-- extension itself. So it is dropped and recreated in `extensions`, the schema
-- Supabase provisions for exactly this.
--
-- Safe to do bluntly, and only right now: pg_net holds no user data — it is a
-- request queue — and there are no in-flight requests, because `push_invoke`
-- has never successfully posted. The Vault secrets do not exist yet, so it
-- returns null before it ever reaches `net.http_post`. Doing this after push is
-- live would drop queued requests on the floor.
--
-- `push_invoke`'s body needs no change: pg_net puts its API in `net` wherever
-- the extension record sits, which is why `net.http_post` still resolves.
-- ===========================================================================

drop extension if exists pg_net;
create extension pg_net with schema extensions;
