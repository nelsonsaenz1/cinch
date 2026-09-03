-- ---------------------------------------------------------------------------
-- Sharing worn outfits is ON by default — founder ruling 2026-09-03
--
-- "Sharing should be default. Turn off if they don't want to share."
--
-- `profiles.worn_outfits_shared_since` was null for every account that had
-- never touched the switch, and one of fifty had. Daily Social opened empty
-- for every reader (25 of 25 opens, all `nobody_sharing`) because the social
-- graph's whole supply side was opt-in. The boundary column keeps every
-- property it had (20260817000000): looks worn BEFORE the instant it was set
-- never cross, friends-only, seven days. Only the default moves.
--
-- Two effects, both reversible:
--   1. New profiles start sharing from creation (column default).
--   2. Every existing profile that never chose is switched on NOW. The
--      trigger stamps `now()` on the way through, so nothing anyone wore
--      before this migration ran is exposed — the same guarantee "Go first"
--      gives a person who flips the switch by hand.
--
-- The one account that had already opted in keeps its own earlier boundary
-- (the trigger's on→on branch leaves it untouched).
--
-- DOWN (reversible — the backfilled rows are exactly those stamped inside
-- this migration's own minute; the one pre-existing opt-in predates it):
--   alter table public.profiles alter column worn_outfits_shared_since drop default;
--   update public.profiles set worn_outfits_shared_since = null
--    where worn_outfits_shared_since >= '2026-09-03T02:40:00Z'
--      and worn_outfits_shared_since <  '2026-09-03T02:50:00Z';
--   (applied to production 2026-09-03T02:44:37Z; 49 rows stamped in that second)
-- ---------------------------------------------------------------------------
alter table public.profiles alter column worn_outfits_shared_since set default now();

update public.profiles
   set worn_outfits_shared_since = now(),
       updated_at = now()
 where worn_outfits_shared_since is null;
