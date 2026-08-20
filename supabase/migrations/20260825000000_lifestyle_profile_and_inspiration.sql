-- ===========================================================================
-- Lifestyle profile + the inspiration workload.
--
-- Three columns on `profiles`, one enum value on `ai_workload`. Additive
-- only: nothing existing is renamed, retyped, or re-defaulted, so a client
-- that predates this migration reads and writes exactly as before.
--
--   life_stage                  One key from the app's closed LIFE_STAGES
--                               vocabulary (features/profile/lifestyle.ts).
--                               Plain text, not an enum — the `style_tags`
--                               idiom: the UI is closed, the column is
--                               permissive, and a value that drifts out of
--                               the vocabulary still loads rather than
--                               refusing the row. Null = never answered.
--
--   dress_occasions             The occasions this person actually dresses
--                               for, as vocabulary keys. Same idiom, same
--                               reason. The app caps the selection at six
--                               (MAX_DRESS_OCCASIONS) where the promise is
--                               printed; the column does not, because a
--                               constraint here would refuse to LOAD a
--                               profile the app once happily saved.
--
--   style_profile_prompted_at   Whether the one-time onboarding offer has
--                               been made — the `toured_at` pattern exactly:
--                               a server fact, because "once, ever, on any
--                               device" is a claim about an account, and
--                               AsyncStorage would replay the questionnaire
--                               on the iPad and after every reinstall.
--                               Distinct from the answers themselves so a
--                               skip is remembered without inventing a
--                               sentinel life stage.
--
-- No new grants and no new policies: `profiles` already carries owner-only
-- RLS and table-level column access for `authenticated`, and these columns
-- inherit both. The public_profiles view names its columns explicitly, so
-- nothing here leaks into the social read path.
--
-- `ai_workload` gains 'inspiration' for the analyze-inspiration Edge
-- Function's ledger rows and its optional ai_config override. ADD VALUE is
-- safe inside this transaction because nothing else in the transaction uses
-- the new value.
-- ===========================================================================

alter table public.profiles
  add column if not exists life_stage text,
  add column if not exists dress_occasions text[] not null default '{}',
  add column if not exists style_profile_prompted_at timestamptz;

alter type public.ai_workload add value if not exists 'inspiration';
