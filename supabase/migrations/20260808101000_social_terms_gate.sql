-- ===========================================================================
-- Guideline 1.2 — the EULA gate.
--
-- Apple requires an agreement, accepted before a user can post, in which the
-- developer states zero tolerance for objectionable content and abusive users.
-- What ships today is a passive line on the sign-in screen ("By continuing you
-- agree to our Terms"): no affirmative act, nothing stored, nothing to point a
-- reviewer at. This makes it a record.
--
-- Shape is lifted wholesale from the AI-processing consent in 20260803180000 —
-- a version integer plus a timestamp on profiles, and a function naming the
-- current version — because it is the same problem (a versioned permission
-- that must be re-obtained when the terms change) and a second pattern for it
-- would be a second thing to keep in sync.
--
-- The difference is where it is enforced. AI consent is checked in the Edge
-- Functions, which is where the data would otherwise leave the device. Social
-- writes never touch an Edge Function, so the gate has to live in the database
-- or it does not exist. Same reasoning as the text filter in 20260808100000.
-- ===========================================================================

alter table profiles
  add column social_terms_version integer,
  add column social_terms_at      timestamptz;

-- Bump when the terms change materially. Every existing user is then asked
-- again, exactly as with current_ai_consent_version().
create or replace function current_social_terms_version()
returns integer
language sql
immutable
as $$ select 1 $$;

-- Read by the trigger below and by the client, which uses it to decide whether
-- to raise the sheet before the user reaches a social surface.
create function has_accepted_social_terms() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles
     where user_id = (select auth.uid())
       and social_terms_version is not null
       and social_terms_version >= public.current_social_terms_version());
$$;
revoke execute on function has_accepted_social_terms() from public, anon, authenticated;
grant  execute on function has_accepted_social_terms() to authenticated;

-- ---------------------------------------------------------------------------
-- Enforcement. INVOKER for the same reason as assert_clean_ugc: the
-- service-role escape depends on current_user being the caller's role.
-- ---------------------------------------------------------------------------
create function assert_social_terms() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;

  if not public.has_accepted_social_terms() then
    -- 42501 with this exact message: the client matches on it to raise the
    -- sheet rather than showing a failure.
    raise exception 'social_terms_required' using errcode = '42501';
  end if;

  return new;
end; $$;
revoke execute on function assert_social_terms() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- What is gated, and what deliberately is not.
--
-- Gated: everything that creates content or joins someone to a shared space.
-- INSERT only — a user who accepted version 1 and is mid-conversation should
-- not be locked out of deleting their own comment because version 2 shipped
-- this morning. Acceptance is a precondition for adding to the commons, not
-- for tidying up after yourself.
-- ---------------------------------------------------------------------------
create trigger events_require_terms
  before insert on events
  for each row execute function assert_social_terms();

create trigger event_members_require_terms
  before insert on event_members
  for each row execute function assert_social_terms();

create trigger event_outfit_posts_require_terms
  before insert on event_outfit_posts
  for each row execute function assert_social_terms();

create trigger event_outfit_votes_require_terms
  before insert on event_outfit_votes
  for each row execute function assert_social_terms();

create trigger event_comments_require_terms
  before insert on event_comments
  for each row execute function assert_social_terms();

create trigger borrow_requests_require_terms
  before insert on borrow_requests
  for each row execute function assert_social_terms();

create trigger follows_require_terms
  before insert on follows
  for each row execute function assert_social_terms();

-- NOT gated, and this is the load-bearing half of the design:
--
--   user_blocks     — blocking is a safety action. Gating it would mean a user
--                     being harassed has to accept a legal agreement before
--                     they can make it stop.
--   content_reports — same. The one moment someone most needs to reach the
--                     operator is the one moment a modal must not appear.
--
-- Both are reachable by a user who has never accepted anything, which is
-- correct: the terms exist to protect people from abuse, so they cannot become
-- a precondition for escaping it.
