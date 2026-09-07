-- ---------------------------------------------------------------------------
-- Reap the accounts nobody ever entered (ledger A49, 2026-09-06).
--
-- `signInWithOtp` with `shouldCreateUser: true` mints the `auth.users` row the
-- moment a code is SENT, and the three insert triggers on that table give it
-- a profile, a style profile and a subscription row in the same instant. A
-- code that is never typed — a typo'd address whose mail bounced, a person
-- who closed the app, a second request for the same mailbox — therefore
-- leaves a complete-looking account behind with no session, no confirmation
-- and no data. On 2026-09-07 nine such rows existed, two of them from one
-- person's typo-and-retry, and every one of them sat inside the signup
-- denominators the nightly reads.
--
-- The client cannot stop the mint: Supabase issues an OTP only to a user
-- that exists. What CAN be done is to keep the row no longer than the code
-- is good for. A row is reaped when ALL of these hold:
--
--   - it was created by the email or phone OTP path (never Apple);
--   - no factor was ever confirmed and there was never a sign-in;
--   - it is older than a day — every code it could have carried has long
--     expired, and a person who comes back requests a fresh one, which
--     mints a fresh row, so nothing they could want is lost;
--   - it holds no garments, as a belt to the braces above.
--
-- The delete cascades through every `user_id` foreign key (all of them are
-- `on delete cascade`; the two `set null` ones are references BY others),
-- which is the same path `delete-account` takes. Hourly, so a row lives at
-- most ~25 hours; the count is returned for the ledger.
-- ---------------------------------------------------------------------------

create or replace function public.reap_unverified_signups()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  reaped integer;
begin
  with gone as (
    delete from auth.users u
     where u.raw_app_meta_data->>'provider' in ('email', 'phone')
       and u.email_confirmed_at is null
       and u.phone_confirmed_at is null
       and u.last_sign_in_at is null
       and u.created_at < now() - interval '24 hours'
       and not exists (select 1 from public.items i where i.user_id = u.id)
    returning u.id
  )
  select count(*) into reaped from gone;
  return reaped;
end;
$$;

revoke all on function public.reap_unverified_signups() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'cinch-reap-unverified-signups';
select cron.schedule('cinch-reap-unverified-signups', '43 * * * *',
  $$select public.reap_unverified_signups()$$);
