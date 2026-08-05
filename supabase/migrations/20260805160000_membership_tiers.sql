-- ===========================================================================
-- Membership tiers.
--
-- Until now there was ONE ceiling for everybody (_shared/quota.ts: 400 tagging,
-- 80 generations, 60 chats per day, per account). Priced against the models
-- configured today that ceiling lets a single scripted account run up ~$35.83
-- a month against $12.74 of net revenue — a $23 loss per abusive account. The
-- limits were chosen as abuse controls before there were tiers to enforce; this
-- migration makes them a product boundary as well.
--
-- Three things live here:
--   1. `subscriptions` — the plan a user is on, and their trial.
--   2. `effective_plan()` — plan with the trial folded in, so callers ask one
--      question instead of two and cannot forget the trial.
--   3. A period-aware `claim_ai_quota` — free tier is "a few outfits a WEEK"
--      and standard is "30 stylist messages a MONTH", neither of which the
--      original day-keyed counter could express.
--
-- Deliberately NOT here: prices, product identifiers, receipt validation.
-- Billing is not wired yet. `subscriptions.plan` is written by the service role
-- only, so when StoreKit/RevenueCat lands it has one column to own and nothing
-- in this file has to change.
-- ===========================================================================

create type subscription_plan as enum ('free', 'standard', 'pro');

create table subscriptions (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  plan               subscription_plan not null default 'free',

  -- A 14-day full-access trial, not a crippled free tier at signup. Someone who
  -- has photographed 80 garments has done the work and converts; someone capped
  -- at 30 items during onboarding never gets far enough to care.
  trial_ends_at      timestamptz,

  -- Filled by the billing webhook later. Null while unbilled.
  current_period_end timestamptz,
  updated_at         timestamptz not null default now()
);

alter table subscriptions enable row level security;

-- Readable by the owner so the app can show "Standard · 12 of 30 messages left".
-- No insert/update/delete policy at all: any write from a client would be a
-- client granting itself a plan.
create policy "subscriptions: owner can select" on subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Backfill + provisioning.
--
-- Every existing account gets a row. Existing accounts predate billing, so they
-- get the trial from now rather than from their signup date — otherwise the
-- backfill would hand every early tester an already-expired trial.
-- ---------------------------------------------------------------------------
insert into subscriptions (user_id, plan, trial_ends_at)
select id, 'free', now() + interval '14 days'
  from auth.users
on conflict (user_id) do nothing;

/**
 * Give every new user a subscription row and start their trial.
 *
 * Separate trigger rather than an edit to handle_new_user(): that function
 * already owns profile creation, and a failure in either half should not roll
 * back the other. A user with no subscription row is treated as free by
 * effective_plan(), so the worst case of this trigger failing is a user on the
 * free tier rather than a user who cannot sign up.
 */
create or replace function handle_new_subscription()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.subscriptions (user_id, plan, trial_ends_at)
  values (new.id, 'free', now() + interval '14 days')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_subscription
  after insert on auth.users
  for each row execute function handle_new_subscription();

/**
 * The plan a user is actually entitled to right now.
 *
 * Folds the trial in so no caller has to remember it. Returns 'free' for a user
 * with no row rather than raising — a missing row must degrade to the least
 * privilege, never to an error that takes down tagging.
 */
create or replace function effective_plan(p_user_id uuid)
returns subscription_plan
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select case
              when s.trial_ends_at is not null and s.trial_ends_at > now()
                then 'pro'::public.subscription_plan
              else s.plan
            end
       from public.subscriptions s
      where s.user_id = p_user_id),
    'free'::public.subscription_plan
  );
$$;

revoke execute on function effective_plan(uuid) from anon;

-- ---------------------------------------------------------------------------
-- Period-aware usage counters.
--
-- The old table keyed on (user_id, day, kind), which can only express a daily
-- limit. Free tier is weekly and standard's stylist allowance is monthly, so
-- the key becomes (user_id, kind, period, period_start).
--
-- `period` is part of the key, not just the row: a user upgrading mid-week
-- moves from a weekly bucket to a daily one, and those two must not collide or
-- the upgrade would inherit the free tier's spent counter.
-- ---------------------------------------------------------------------------
alter table ai_usage_counters rename column day to period_start;
alter table ai_usage_counters add column period text not null default 'day';

alter table ai_usage_counters drop constraint ai_usage_counters_pkey;
alter table ai_usage_counters
  add constraint ai_usage_counters_pkey
  primary key (user_id, kind, period, period_start);

alter table ai_usage_counters
  add constraint ai_usage_counters_period_check
  check (period in ('day', 'week', 'month'));

/**
 * Atomically consume one unit of a user's allowance for the current period.
 *
 * Same single-statement design as the original: the conditional `do update`
 * increments only while under the limit, so RETURNING comes back empty exactly
 * when the user is over it and two concurrent calls cannot both see the last
 * unit.
 *
 * A limit of 0 is a plan boundary rather than exhaustion — the free tier has no
 * stylist at all — and is reported separately so the client can offer an upgrade
 * instead of "try again tomorrow", which would be a lie.
 */
create or replace function claim_ai_quota(
  p_user_id uuid,
  p_kind    text,
  p_limit   integer,
  p_period  text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_start date;
  v_used  integer;
begin
  if p_period not in ('day', 'week', 'month') then
    raise exception 'unknown period %', p_period;
  end if;

  if p_limit <= 0 then
    return jsonb_build_object(
      'allowed', false, 'used', 0, 'limit', 0,
      'period', p_period, 'reason', 'plan_excluded'
    );
  end if;

  -- date_trunc on a timestamptz resolves in the session time zone; Supabase
  -- databases run in UTC, and the Edge Function computes Retry-After against
  -- the same boundary. Both must agree or the retry hint is wrong.
  v_start := date_trunc(p_period, now() at time zone 'utc')::date;

  insert into public.ai_usage_counters as c (user_id, kind, period, period_start, calls)
  values (p_user_id, p_kind, p_period, v_start, 1)
      on conflict (user_id, kind, period, period_start)
      do update set calls = c.calls + 1
       where c.calls < p_limit
  returning calls into v_used;

  if v_used is null then
    select calls into v_used
      from public.ai_usage_counters
     where user_id = p_user_id and kind = p_kind
       and period = p_period and period_start = v_start;

    return jsonb_build_object(
      'allowed', false, 'used', coalesce(v_used, p_limit), 'limit', p_limit,
      'period', p_period, 'reason', 'exhausted'
    );
  end if;

  return jsonb_build_object(
    'allowed', true, 'used', v_used, 'limit', p_limit, 'period', p_period
  );
end;
$$;

revoke execute on function claim_ai_quota(uuid, text, integer, text) from anon, authenticated;

-- The three-argument form the currently deployed Edge Functions call. Kept so
-- that applying this migration does not break tagging in the window before the
-- functions redeploy. Drop it once they have.
create or replace function claim_ai_quota(
  p_user_id     uuid,
  p_kind        text,
  p_daily_limit integer
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.claim_ai_quota(p_user_id, p_kind, p_daily_limit, 'day');
$$;

revoke execute on function claim_ai_quota(uuid, text, integer) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Closet size.
--
-- Enforced in the database, not in the Edge Function, because an item is
-- inserted by the CLIENT — tag-item only decorates a row that already exists.
-- A cap checked anywhere else is a cap the client can skip by not calling us.
--
-- Archived items still count. They occupy storage, they come back when
-- unarchived, and excluding them would make "archive everything" a way to hold
-- an unlimited closet on the free tier.
-- ---------------------------------------------------------------------------
create or replace function item_limit_for_plan(p_plan subscription_plan)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_plan
           when 'free'     then 30
           when 'standard' then 150
           when 'pro'      then 1000
         end;
$$;

/**
 * Refuse an insert that would take the user past their plan's closet size.
 *
 * The 'pro' number is a soft cap in spirit — at 1000 items the tagging spend is
 * still under thirty cents, so this is not a cost control. It is the difference
 * between a customer and a scraper, and it is raised by hand for anyone who
 * genuinely gets there.
 */
create or replace function enforce_item_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_count integer;
begin
  v_limit := public.item_limit_for_plan(public.effective_plan(new.user_id));

  select count(*) into v_count from public.items where user_id = new.user_id;

  if v_count >= v_limit then
    raise exception 'closet_limit_reached: % of % garments', v_count, v_limit
      using errcode = 'check_violation',
            hint    = 'Upgrade for a larger closet.';
  end if;

  return new;
end;
$$;

create trigger items_enforce_limit
  before insert on items
  for each row execute function enforce_item_limit();

create index if not exists items_user_id_count_idx on items (user_id);

comment on table subscriptions is
  'Plan and trial state. Written by the service role only — see docs/ai-models-and-tiers.md for the tier definitions and the reasoning behind each number.';
