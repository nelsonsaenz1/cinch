-- ===========================================================================
-- AI consent v2 — the 2026-08 disclosure rewrite.
--
-- The consent sheet's text changed materially: it now names the AI partner,
-- states the no-retention / no-training claim and the face-recognition claim
-- in so many words, and introduces local mode as a real alternative. Consent
-- given to the v1 text does not cover the v2 text, so bumping
-- current_ai_consent_version() to 2 forces every existing user back through
-- the sheet — the Edge Functions compare profiles.ai_consent_version against
-- this function on every call and refuse with `ai_consent_required` below it.
--
-- `ai_consent_revoked_at` powers the honest Settings copy (design frame
-- A-06): "Off since 12 March. No photo has left this phone." It is
-- state-change history, not a consent record — nothing server-side reads it
-- as permission for anything. Granting clears it; revoking sets it while
-- nulling ai_consent_version / ai_consent_at, which remain the only columns
-- the Edge Function gate consults.
--
-- Public exposure: none. public_profiles (recreated last in
-- 20260804200000_public_boundary_tenant_integrity_and_commands.sql) is a
-- column-explicit projection — it names user_id, username, display_name,
-- avatar_url, bio, style_tags, follower_count, following_count, created_at
-- and nothing else — so a column added to profiles is invisible through it by
-- construction. Verified against that migration; no view change is needed.
-- ===========================================================================

alter table profiles
  add column ai_consent_revoked_at timestamptz;

-- Recreated in the hardened form: search_path pinned inline (matching the
-- fix applied in 20260805213000_close_public_view_write_path.sql). CREATE OR
-- REPLACE preserves the function's ACL, so the explicit
-- `grant execute ... to authenticated` from
-- 20260805231500_backend_review_hardening.sql survives untouched — the
-- default-privileges revoke in 20260805213000 only affects newly created
-- functions, and this is a replacement, not a new object.
create or replace function current_ai_consent_version()
returns integer
language sql
immutable
set search_path = ''
as $$ select 2 $$;
