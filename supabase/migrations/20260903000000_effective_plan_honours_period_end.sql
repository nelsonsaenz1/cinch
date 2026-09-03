-- ---------------------------------------------------------------------------
-- effective_plan() honours current_period_end — full-app audit 2026-09-02
--
-- THE GAP. `effective_plan` (20260901000000) returned a paid row's plan
-- outright, whatever `current_period_end` said. The only thing that ever
-- moved a churned account back to 'free' was a revoking webhook — and the
-- shared `isStale` guard dropped any revocation whose `expirationAt` equalled
-- the period end the last renewal had stored, which is exactly the value an
-- expiration carries. So a subscription that lapsed would have kept its plan
-- forever. Nothing in production has hit this (there has never been a
-- production purchase), which is the right moment to close it.
--
-- THE RULE. A paid row is honoured until three days after its period end.
-- Renewal notifications trail the renewal itself, and Apple's billing-retry
-- window keeps entitlement alive while a card is retried; three days covers
-- both and cannot become a free year. A null period end (a manual grant with
-- no end, or a row written before the column was filled) is honoured as
-- before. The trial fold is unchanged: it lifts only a FREE row.
--
-- The client mirror is `use-plan.ts` (PAID_LAPSE_SLACK_MS), changed in the
-- same commit so the two never disagree about who is paying.
--
-- DOWN (reversible — restores the 20260901000000 body verbatim):
--
--   create or replace function effective_plan(p_user_id uuid)
--   returns subscription_plan language sql stable security definer
--   set search_path = '' as $$
--     select coalesce(
--       (select case
--                 when s.plan in ('standard'::public.subscription_plan,
--                                 'pro'::public.subscription_plan)
--                   then s.plan
--                 when s.trial_ends_at is not null and s.trial_ends_at > now()
--                   then 'pro'::public.subscription_plan
--                 else s.plan
--               end
--          from public.subscriptions s where s.user_id = p_user_id),
--       'free'::public.subscription_plan);
--   $$;
-- ---------------------------------------------------------------------------
create or replace function effective_plan(p_user_id uuid)
returns subscription_plan
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select case
              when s.plan in ('standard'::public.subscription_plan,
                              'pro'::public.subscription_plan)
                   and (s.current_period_end is null
                        or s.current_period_end + interval '3 days' > now())
                then s.plan
              when s.trial_ends_at is not null and s.trial_ends_at > now()
                then 'pro'::public.subscription_plan
              else 'free'::public.subscription_plan
            end
       from public.subscriptions s
      where s.user_id = p_user_id),
    'free'::public.subscription_plan
  );
$$;

revoke execute on function effective_plan(uuid) from anon;

comment on function effective_plan(uuid) is
  'The plan a user is entitled to right now. A paid plan row wins while its current_period_end (plus three days of renewal slack) is in the future, or is null; a live trial_ends_at lifts only a free row to pro (legacy promotional access — see 20260901000000); a lapsed paid row and a missing row are free.';
