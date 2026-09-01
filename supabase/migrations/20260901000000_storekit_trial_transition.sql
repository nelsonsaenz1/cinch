-- ===========================================================================
-- The trial moves to StoreKit; the server stops inventing one.
--
-- 20260805160000_membership_tiers.sql gave every new account a silent
-- server-side 14-day trial: `handle_new_subscription()` wrote
-- `trial_ends_at = now() + interval '14 days'` on signup, and
-- `effective_plan()` folded ANY live `trial_ends_at` into `pro`
-- unconditionally. That was the right shape when billing did not exist —
-- there was nothing to buy, so a trial could only ever end in `free`.
--
-- Billing exists now. The trial becomes a real StoreKit 7-day introductory
-- offer on cinch.standard.annual, mediated by Apple and reported by the
-- Superwall webhook like any other purchase. Two things about the old design
-- become wrong the moment that ships:
--
--   1. A silent server trial on top of a StoreKit trial is a double grant —
--      a new user would get 14 free Pro days before the paywall could even
--      make its offer.
--   2. `effective_plan()`'s unconditional fold is a downgrade mask: a user
--      who BUYS Standard mid-trial keeps reading as `pro` until the trial
--      lapses, and — worse — a webhook-written PAID plan loses to a stale
--      trial timestamp.
--
-- What this migration does NOT do: touch any existing `trial_ends_at`. The
-- 33 accounts holding a live server trial keep it until its recorded expiry —
-- they were promised 14 days and they get 14 days. From today that state has
-- a name, defined below: LEGACY PROMOTIONAL ACCESS.
--
-- ── legacy_promotional_access, the classification ─────────────────────────
--
-- A `subscriptions` row with plan = 'free' AND trial_ends_at IS NOT NULL is
-- by definition legacy promotional access. This is airtight, not heuristic:
--
--   * New accounts never get one — `handle_new_subscription()` below writes
--     trial_ends_at NULL, and nothing else ever sets the column.
--   * StoreKit trials never write it either — the webhook reports a trial as
--     initial_purchase/renewal with periodType TRIAL and writes `plan` +
--     `current_period_end`, never `trial_ends_at`.
--
-- So the column can only carry a pre-transition grant. Exclude these rows
-- from any StoreKit trial reporting: they are a closed, shrinking cohort of
-- at most 33, and counting them as intro-offer trials would poison the
-- conversion numbers the StoreKit offer is being measured by. The 2 manual
-- grant rows (plan 'standard'/'pro', written by hand) are untouched by every
-- change here — a paid plan now wins outright, which is exactly what a
-- manual grant wants.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. New accounts start free, with no trial.
--
-- Same trigger, same security posture, one behavioural change: the trial is
-- Apple's to grant now. A row is still created eagerly so that a missing row
-- keeps meaning "trigger failed" rather than "new normal".
-- ---------------------------------------------------------------------------
create or replace function handle_new_subscription()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- No trial_ends_at. The 7-day introductory offer lives in App Store
  -- Connect on cinch.standard.annual and arrives — if the user takes it —
  -- through the Superwall webhook as a plan write. The server no longer
  -- grants promotional time; see the legacy_promotional_access note in this
  -- migration's header for the rows that predate this.
  insert into public.subscriptions (user_id, plan, trial_ends_at)
  values (new.id, 'free', null)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- The trigger `on_auth_user_created_subscription` already points at this
-- function; CREATE OR REPLACE keeps the same oid, so it is not recreated.

-- ---------------------------------------------------------------------------
-- 2. Precedence: paid beats trial, trial lifts only free.
--
-- The old fold let a live trial_ends_at outrank everything, including a plan
-- the user PAID for. New order, top wins:
--
--   * plan in ('standard', 'pro')       → that plan. A webhook write and a
--                                         manual grant both take effect the
--                                         moment they land, trial or no trial.
--   * plan = 'free' + live trial_ends_at → 'pro'. Legacy promotional access,
--                                         honoured until its recorded expiry.
--   * otherwise                          → the row's plan.
--   * no row at all                      → 'free'. Missing must degrade to
--                                         least privilege, never to an error
--                                         that takes down tagging.
--
-- Same signature, so CREATE OR REPLACE preserves the existing grants; the
-- anon revoke is restated below anyway, because this function is exactly the
-- kind of SECURITY DEFINER surface 20_grant_matrix.sql exists to police.
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
                then s.plan
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

comment on function effective_plan(uuid) is
  'The plan a user is entitled to right now. A paid plan row wins outright; a live trial_ends_at lifts only a free row to pro (legacy promotional access — see 20260901000000); a missing row is free.';

-- ---------------------------------------------------------------------------
-- 3. The ledger learns what kind of period it recorded.
--
-- Superwall reports a StoreKit trial as `initial_purchase` (and its
-- conversion as `renewal` with `isTrialConversion: true`), distinguished
-- only by `data.periodType`. Without storing it, the ledger cannot answer
-- "how many of these purchases were intro-offer trials" — the one question
-- the StoreKit transition will be judged by.
--
-- `period_type` is free text on purpose. Superwall's webhook contract names
-- three values — TRIAL, INTRO and NORMAL — but this column records what was
-- RECEIVED, and a contract-widening on their side must land in the ledger
-- rather than bounce off a check constraint. Interpretation happens at read
-- time, where a fourth value is a curiosity and not a dropped delivery.
--
-- `is_trial_conversion` is what makes "Standard trial converted" a query
-- rather than an inference: the converting `renewal` carries the flag, and a
-- ledger without it could not tell a conversion from an ordinary renewal.
-- Both columns are null for every row written before this migration, and
-- null when Superwall omits the field — absence of evidence, recorded as
-- absence.
-- ---------------------------------------------------------------------------
alter table superwall_events add column period_type text;
alter table superwall_events add column is_trial_conversion boolean;

comment on column superwall_events.period_type is
  'Superwall''s data.periodType, verbatim: TRIAL, INTRO or NORMAL per their webhook contract, null when absent or pre-20260901. Deliberately unconstrained — record first, interpret at read time.';
comment on column superwall_events.is_trial_conversion is
  'Superwall''s data.isTrialConversion — true on the renewal that converts an intro-offer trial to a paid period. Null when absent or pre-20260901.';

-- The argument list changes, so CREATE OR REPLACE cannot do this — it would
-- create a second overload alongside the old six-argument form and every
-- call would become ambiguous prey for the resolver. Drop, then recreate.
-- The body below is the CURRENT definition from
-- 20260811204335_superwall_ledger_retryable_claims.sql, verbatim except for
-- the two new columns; behaviour — first-claim, retryable outcomes, the
-- delivery_count bump — is unchanged.
drop function claim_superwall_event(text, text, text, text, text, timestamptz);

create function claim_superwall_event(
  p_svix_id text,
  p_event_type text,
  p_app_user_id text,
  p_product_id text default null,
  p_original_transaction_id text default null,
  p_expiration_at timestamptz default null,
  p_period_type text default null,
  p_is_trial_conversion boolean default null
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_inserted boolean;
  v_outcome text;
begin
  insert into public.superwall_events (
    svix_id, event_type, app_user_id, product_id,
    original_transaction_id, expiration_at, period_type,
    is_trial_conversion, outcome
  )
  values (
    p_svix_id, p_event_type, p_app_user_id, p_product_id,
    p_original_transaction_id, p_expiration_at, p_period_type,
    p_is_trial_conversion, 'no_state_change'
  )
  on conflict (svix_id) do update
     set delivery_count   = public.superwall_events.delivery_count + 1,
         last_delivery_at = now()
  returning (xmax = 0), outcome::text into v_inserted, v_outcome;

  -- First time: apply it.
  if v_inserted then
    return true;
  end if;

  -- Seen before, but never finished. Let the retry do what the 422 or the 500
  -- promised it would. `applied`, `stale`, `no_state_change` and
  -- `unidentified_alias` are all terminal and stay refused — an applied
  -- purchase must never be re-applied by a redelivery, which is the whole
  -- point of the ledger.
  return v_outcome in ('unmapped_product', 'write_failed');
end;
$$;

revoke execute on function
  claim_superwall_event(text, text, text, text, text, timestamptz, text, boolean)
  from public, anon, authenticated;

comment on function
  claim_superwall_event(text, text, text, text, text, timestamptz, text, boolean) is
  'Returns true when the caller should process this delivery: either the svix-id is new, or a previous attempt ended in a retryable outcome (unmapped_product, write_failed). Terminal outcomes return false so redelivery is a no-op.';

-- ---------------------------------------------------------------------------
-- 4. paywall_impressions — the account-level record behind frequency caps.
--
-- The client caps general promotional paywalls at 1 per 24 hours and 3 per
-- 7 days. A cap kept in device storage resets on reinstall, which turns
-- "delete the app and put it back" into a way to be pitched forever — or,
-- from the other side, lets an uninstall/reinstall loop hammer a user who
-- already said no five times this week. So the record lives on the account.
--
-- ENFORCEMENT IS CLIENT-SIDE, deliberately. A paywall shown one time too
-- many is an annoyance; a database error that blocks a paywall — or worse,
-- blocks the flow that was about to show one — is a broken app. The table is
-- the memory, the client is the judge, and the worst a malicious client can
-- do by writing extra rows is show ITSELF fewer paywalls.
--
-- The primary key (user_id, placement, shown_at) doubles as the dedupe: two
-- impressions of one placement in the same microsecond are one impression.
-- No update or delete policy exists in either direction — an impression
-- happened, and history does not get edited to reset a cap.
-- ---------------------------------------------------------------------------
create table paywall_impressions (
  user_id   uuid not null references auth.users (id) on delete cascade,
  placement text not null,
  shown_at  timestamptz not null default now(),
  primary key (user_id, placement, shown_at)
);

comment on table paywall_impressions is
  'One row per paywall shown, per account. The reinstall-proof memory behind the client-side frequency caps (max 1 general promo per 24h, 3 per 7d). Insert and select only — impressions are history, not state.';

alter table paywall_impressions enable row level security;

create policy "paywall_impressions: owner can insert" on paywall_impressions
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "paywall_impressions: owner can select" on paywall_impressions
  for select to authenticated using ((select auth.uid()) = user_id);

-- Since 20260805213000 new tables are born with nothing granted to the
-- client roles, so the two verbs the policies govern are granted explicitly
-- — and only those two. anon gets the belt-and-braces revoke the rest of the
-- schema carries.
grant select, insert on paywall_impressions to authenticated;
revoke all privileges on table paywall_impressions from anon;

-- The cap query is "impressions for me since <window start>", newest first.
create index paywall_impressions_user_recency_idx
  on paywall_impressions (user_id, shown_at desc);
