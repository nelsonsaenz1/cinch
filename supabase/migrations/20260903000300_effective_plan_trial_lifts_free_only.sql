-- ---------------------------------------------------------------------------
-- effective_plan(): the trial fold lifts a FREE row only — audit follow-up
--
-- 20260903000000 let a paid row that had lapsed fall through to the trial
-- branch, so a lapsed Standard with a live legacy trial read as Pro — the
-- opposite of what its own comment and the client mirror (use-plan.ts) say.
-- No live row is in that state (every remaining trial ends 2026-09-03 14:00Z),
-- so this is a correctness fix ahead of the fact.
--
-- DOWN: re-apply the body in 20260903000000.
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
              when s.plan = 'free'::public.subscription_plan
                   and s.trial_ends_at is not null and s.trial_ends_at > now()
                then 'pro'::public.subscription_plan
              else 'free'::public.subscription_plan
            end
       from public.subscriptions s
      where s.user_id = p_user_id),
    'free'::public.subscription_plan
  );
$$;

revoke execute on function effective_plan(uuid) from anon;
