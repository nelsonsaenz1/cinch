-- ===========================================================================
-- The trial is 21 days, not 14.
--
-- WHAT THIS CHANGES. `handle_new_subscription()` — the trigger on
-- `auth.users` insert — now writes `now() + interval '21 days'` instead of
-- `now() + interval '14 days'`. That is the only line that matters going
-- forward: it is the one that sets the trial for every account created from
-- here on.
--
-- WHY 21. Trial-to-paid conversion, banded by trial length:
--
--   <= 4 days     ~25.5%
--   5 - 9 days    ~37.4%
--   17 - 32 days  ~42.5%
--
-- 14 sits in the gap between the middle band and the top one — long enough to
-- have already bought the ~12 points that separate a four-day trial from a
-- nine-day one, short enough to miss the further ~5 that come with crossing
-- into the third week. 21 sits squarely inside the top band, and it does so for
-- a reason this product can name: the thing being trialled is a HABIT. Cinch is
-- worth paying for once it has dressed you on a Monday you were late, a Friday
-- you cared about, and a weekend you did not. Two weeks gives two of each and
-- one shot at a bad week ruining the sample; three weeks gives three, and a bad
-- week stops being the whole trial.
--
-- THE OLD FILE'S COMMENT IS NOW STALE, AND IS DELIBERATELY LEFT ALONE.
-- `20260805160000_membership_tiers.sql` line 31 reads:
--
--   "A 14-day full-access trial, not a crippled free tier at signup. Someone
--    who has photographed 80 garments has done the work and converts; someone
--    capped at 30 items during onboarding never gets far enough to care."
--
-- The ARGUMENT there still holds — full access beats a crippled free tier — but
-- the number in it does not, and it describes a trial length this migration has
-- replaced. Migrations are append-only: editing that file would rewrite a
-- statement about what production actually did between 5 August and today, and
-- would desync the checksum a hosted project has already recorded for it. So it
-- stays exactly as written, and THIS header is the current answer. Anyone who
-- lands on that comment should land here next.
--
-- WHAT IS NOT TOUCHED. The one-time backfill at line ~57 of that file gave
-- pre-billing accounts a trial measured from the moment of the backfill. It has
-- already run, it can only ever run once, and re-stating its intent here would
-- hand a fresh 21-day trial to accounts whose trial has since expired —
-- including any that have converted. Existing rows keep exactly the
-- `trial_ends_at` they have.
--
-- `effective_plan()` is unchanged: it folds the trial in by comparing
-- `trial_ends_at > now()` and does not care how that date was arrived at.
-- ===========================================================================

create or replace function handle_new_subscription()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.subscriptions (user_id, plan, trial_ends_at)
  values (new.id, 'free', now() + interval '21 days')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Re-issued, matching what every other redefinition in this directory does
-- (`20260808190000_free_closet_is_ten.sql`,
-- `20260809160000_block_retracts_votes.sql`). `create or replace` preserves the
-- existing ACL, so against a database that already ran
-- `20260805220000_revoke_function_execute_from_public.sql` this is a no-op —
-- but it is a no-op that keeps the grant state next to the definition instead
-- of five files back, and it is what makes this file correct if it is ever
-- replayed against a database built some other way. A SECURITY DEFINER function
-- that writes subscription rows must never be client-callable.
revoke execute on function handle_new_subscription() from public, anon, authenticated;

comment on column subscriptions.trial_ends_at is
  'End of the full-access trial: 21 days from signup. See '
  '20260810150000_trial_is_twenty_one_days.sql for the conversion bands behind '
  'that number. The 14-day comment in 20260805160000_membership_tiers.sql is '
  'stale, and is left in place only because migrations are append-only.';
