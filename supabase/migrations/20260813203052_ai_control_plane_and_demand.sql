-- ---------------------------------------------------------------------------
-- Deterministic AI, Packet 1 — the control plane, and the demand aggregate.
--
-- Two things that have to be true before any of the deterministic work can be
-- measured, and one of them is embarrassing:
--
--   1. THREE MODEL CALLS ARE CURRENTLY BILLED TO SOMEBODY ELSE'S NAME. The ASR
--      call has no workload at all and writes no `ai_calls` row; the closet
--      parser records itself as `tagging`; the packing brief records itself as
--      `stylist_chat` and says so in a docblock that ends "when packing earns
--      its own budget, add the enum value". This migration is that value. It
--      does NOT move any quota: `claim_ai_quota` takes `p_kind text` and reads
--      `PLAN_LIMITS`, so the ledger name and the allowance a call spends are
--      already separate, and moving the allowance would silently change who can
--      use packing. The ledger becomes truthful; the membership boundary does
--      not move a millimetre.
--
--   2. NOBODY CAN SEE WHAT PEOPLE ASK THE CATALOGUE FOR. The only way to learn
--      that thirty people wanted a brand the feed does not carry is to record
--      what they asked — and the one thing this codebase will not do is keep
--      the sentence. So the aggregate below stores no sentence, no fragment of
--      one, and no identity: four canonical fields resolved by code that
--      already exists, hashed into a key, with daily counters.
--
-- WHY THIS FILE CONTAINS NO INSERT
--
-- `ALTER TYPE ... ADD VALUE` may run inside a transaction on Postgres 17, but
-- the new label CANNOT BE USED as data in that same transaction — every
-- migration runs in one, so `insert into ai_config (workload) values
-- ('packing_brief')` in this file would fail with "unsafe use of new value of
-- enum type". The seed is therefore applied as a separate data statement and
-- proven by readback, and every caller falls back to a compiled default when
-- `ai_config` has no row for it (`packing-brief` already worked exactly that
-- way). A replay from an empty database is correct without the seed: the
-- functions run on their defaults, which is the state they are in today.
-- ---------------------------------------------------------------------------

-- ── 1 · Three workloads that pay for themselves ─────────────────────────────
--
-- `if not exists` because this migration must be replayable, and because the
-- remote and local ledgers in this project have disagreed before.

alter type public.ai_workload add value if not exists 'voice_transcription';
alter type public.ai_workload add value if not exists 'closet_parsing';
alter type public.ai_workload add value if not exists 'packing_brief';

-- ── 2 · Configuration a founder can change without a release ────────────────
--
-- `ai_config` already carries model, provider, max tokens, timeout and params.
-- Two things it cannot say:
--
--   RESCUE MODEL. The plan allows a stronger model exactly once, and only
--   after DETERMINISTIC VALIDATION rejects the cheap one — never "a second
--   model reviews the first", which is a way to pay twice for one opinion.
--   Null means there is no rescue and a rejected result is simply a failure.
--
--   VALIDATOR POLICY. What happens when the deterministic validator rejects:
--   'strict' fails the call, 'rescue' escalates once to `rescue_model_id`,
--   'accept' takes the primary result anyway. A text column with a CHECK
--   rather than a new enum — a new type for three words costs a migration to
--   change, which is the thing this column exists to avoid.

alter table public.ai_config
  add column if not exists rescue_model_id text,
  add column if not exists validator_policy text not null default 'strict';

alter table public.ai_config drop constraint if exists ai_config_validator_policy_check;
alter table public.ai_config add constraint ai_config_validator_policy_check
  check (validator_policy in ('strict', 'rescue', 'accept'));

-- A rescue model that is never reachable is a footgun: it reads as configured
-- protection and buys none. Policy and model have to agree.
alter table public.ai_config drop constraint if exists ai_config_rescue_requires_model;
alter table public.ai_config add constraint ai_config_rescue_requires_model
  check (validator_policy <> 'rescue' or rescue_model_id is not null);

comment on column public.ai_config.rescue_model_id is
  'Optional stronger model, used ONCE and only after deterministic validation '
  'rejects the primary result. Never a second opinion on a result that passed.';
comment on column public.ai_config.validator_policy is
  'strict = a rejected result fails the call; rescue = escalate once to '
  'rescue_model_id; accept = take the primary result despite rejection.';

-- ── 3 · The demand aggregate ────────────────────────────────────────────────
--
-- WHAT IS AND IS NOT IN A ROW
--
-- In: a recognised catalogue brand, a fixed garment class from the shipping
-- lexicon, an audience bucket, and an optional broad colour family. Every one
-- of those is drawn from a closed vocabulary the server already owns, which is
-- the property that makes this aggregate safe — an unrecognised brand is NOT
-- stored as free text, it is stored as null, because "the fragment we could not
-- place" is exactly the field that would end up holding somebody's sentence.
--
-- Out: the query, any fragment of it, the transcript, the product titles, the
-- merchant URLs, the row ids, and the user. There is no `user_id` column and
-- there is no column of type text that a caller chooses the contents of.
--
-- WHY A HASH AND FOUR COLUMNS BOTH
--
-- The columns are what a founder reads; the hash is what makes the row unique
-- and order-free. It is computed from the four canonical values in a FIXED
-- order with a fixed separator, so "men's James Perse t-shirt" and "James Perse
-- t-shirt for men" — different sentences, same parse — are one intent. Word
-- order cannot create a second row because word order never reaches this table.

create table if not exists public.catalogue_demand_daily (
  -- sha256 over brand|class|audience|colour, lowercased, fixed order.
  intent_key text not null,
  day date not null default (now() at time zone 'utc')::date,

  -- The canonical intent, readable. Null means "not recognised", never a guess.
  brand_slug text,
  garment_class text,
  audience text,
  colour_family text,

  searches integer not null default 0,
  zero_result_searches integer not null default 0,
  family_opens integer not null default 0,
  import_attempts integer not null default 0,
  import_successes integer not null default 0,

  -- Latency as counters rather than an average: an average over a day hides
  -- the slow tail, and the tail is the thing worth fixing.
  latency_fast integer not null default 0,    -- < 1s
  latency_medium integer not null default 0,  -- 1-3s
  latency_slow integer not null default 0,    -- > 3s

  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (intent_key, day),

  -- Belt and braces against a future caller passing a sentence. A length cap
  -- alone is not enough — "i own a james perse tee" is 23 characters — so the
  -- shape is constrained too: a brand is a SLUG and cannot contain a space at
  -- all, and a class or colour is at most three lowercase words. Every member
  -- of the shipping vocabularies satisfies this; no sentence does.
  constraint catalogue_demand_brand_shape
    check (brand_slug is null or brand_slug ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  constraint catalogue_demand_class_shape
    check (garment_class is null or
           (length(garment_class) <= 32 and garment_class ~ '^[a-z]+( [a-z]+){0,2}$')),
  constraint catalogue_demand_colour_shape
    check (colour_family is null or
           (length(colour_family) <= 32 and colour_family ~ '^[a-z]+( [a-z]+){0,2}$')),
  constraint catalogue_demand_audience_values
    check (audience is null or audience in ('mens', 'womens', 'unisex')),
  -- A row with nothing recognised in it is not an intent, it is noise with a
  -- hash. Refusing it here is what stops the table filling with one anonymous
  -- bucket that answers no question.
  constraint catalogue_demand_not_empty
    check (brand_slug is not null or garment_class is not null)
);

comment on table public.catalogue_demand_daily is
  'Canonical catalogue demand by day. Contains NO raw query, transcript, '
  'product title, URL or user identity — only allow-listed vocabulary values '
  'resolved server-side, plus counters. Not reachable by anon or authenticated.';

-- Founder inspection is by day and by volume, in that order.
create index if not exists catalogue_demand_daily_day_idx
  on public.catalogue_demand_daily (day desc, searches desc);
create index if not exists catalogue_demand_daily_brand_idx
  on public.catalogue_demand_daily (brand_slug) where brand_slug is not null;

-- ── 4 · Nobody reaches it but the server ────────────────────────────────────
--
-- RLS on with NO policy is the whole access model: `service_role` bypasses RLS
-- and writes, `postgres` reads it in the SQL editor, and `anon`/`authenticated`
-- get nothing even if this table is ever exposed to the Data API by accident.
-- The explicit REVOKE is not redundant with that — it is the half that still
-- holds if somebody adds a policy later without thinking about who it opens the
-- door to. (Supabase stopped auto-exposing new public tables in 2026-04, with
-- enforcement for all projects on 2026-10-30; this file does not rely on it.)

alter table public.catalogue_demand_daily enable row level security;
revoke all on public.catalogue_demand_daily from anon, authenticated;

-- ── 5 · The one way in ──────────────────────────────────────────────────────
--
-- SECURITY INVOKER, deliberately. The only caller is an Edge Function holding
-- the service-role key, which already bypasses RLS — so DEFINER would buy
-- nothing and would turn a counter bump into a privilege-escalation surface in
-- the schema Postgres grants EXECUTE to PUBLIC on by default.
--
-- The signature takes the CANONICAL FIELDS, not a query. A caller cannot pass
-- this function a sentence, because there is no parameter for one.

create or replace function public.record_catalogue_demand(
  p_brand_slug text,
  p_garment_class text,
  p_audience text,
  p_colour_family text,
  p_searches integer default 0,
  p_zero_result integer default 0,
  p_family_opens integer default 0,
  p_import_attempts integer default 0,
  p_import_successes integer default 0,
  p_latency_bucket text default null
)
returns text
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_brand text := nullif(lower(btrim(coalesce(p_brand_slug, ''))), '');
  v_class text := nullif(lower(btrim(coalesce(p_garment_class, ''))), '');
  v_audience text := nullif(lower(btrim(coalesce(p_audience, ''))), '');
  v_colour text := nullif(lower(btrim(coalesce(p_colour_family, ''))), '');
  v_key text;
begin
  -- Nothing recognised is nothing to record. Silent, not an error: the caller
  -- is a search that already happened and must not fail over bookkeeping.
  if v_brand is null and v_class is null then
    return null;
  end if;

  -- Fixed order, fixed separator, one hash. This is the whole order-freeness
  -- guarantee and it lives in exactly one place.
  -- Core `sha256(bytea)`, not pgcrypto's `digest()`: this function must not
  -- depend on an extension being present in a particular schema, and extension
  -- version pinning was deprecated by Supabase in 2026-08.
  v_key := encode(
    sha256(
      convert_to(
        coalesce(v_brand, '') || '|' || coalesce(v_class, '') || '|' ||
        coalesce(v_audience, '') || '|' || coalesce(v_colour, ''),
        'UTF8'
      )
    ),
    'hex'
  );

  insert into public.catalogue_demand_daily as d (
    intent_key, brand_slug, garment_class, audience, colour_family,
    searches, zero_result_searches, family_opens,
    import_attempts, import_successes,
    latency_fast, latency_medium, latency_slow
  )
  values (
    v_key, v_brand, v_class, v_audience, v_colour,
    greatest(coalesce(p_searches, 0), 0),
    greatest(coalesce(p_zero_result, 0), 0),
    greatest(coalesce(p_family_opens, 0), 0),
    greatest(coalesce(p_import_attempts, 0), 0),
    greatest(coalesce(p_import_successes, 0), 0),
    case when p_latency_bucket = 'fast' then 1 else 0 end,
    case when p_latency_bucket = 'medium' then 1 else 0 end,
    case when p_latency_bucket = 'slow' then 1 else 0 end
  )
  on conflict (intent_key, day) do update set
    searches = d.searches + excluded.searches,
    zero_result_searches = d.zero_result_searches + excluded.zero_result_searches,
    family_opens = d.family_opens + excluded.family_opens,
    import_attempts = d.import_attempts + excluded.import_attempts,
    import_successes = d.import_successes + excluded.import_successes,
    latency_fast = d.latency_fast + excluded.latency_fast,
    latency_medium = d.latency_medium + excluded.latency_medium,
    latency_slow = d.latency_slow + excluded.latency_slow,
    updated_at = now();

  return v_key;
end;
$$;

revoke all on function public.record_catalogue_demand(
  text, text, text, text, integer, integer, integer, integer, integer, text
) from public, anon, authenticated;
grant execute on function public.record_catalogue_demand(
  text, text, text, text, integer, integer, integer, integer, integer, text
) to service_role;

comment on function public.record_catalogue_demand is
  'Bump canonical catalogue-demand counters. Takes allow-listed vocabulary '
  'values only — there is no parameter that can carry a user phrase.';

-- ── 6 · The counters that arrive later ──────────────────────────────────────
--
-- A family open and an import happen minutes after the search, on a screen that
-- no longer holds the sentence — and must not be made to hold it again. So the
-- client carries the INTENT KEY instead: an opaque sha256 with no inverse, and
-- the same value the search already computed server-side.
--
-- UPDATE ONLY, NEVER INSERT. Two reasons, and the second is the important one:
--
--   A key with no row is a key from another day (or, with an ill-behaved
--   client, a key from nowhere). Inserting would mean trusting a caller's hash
--   to be the hash of something real, and a table whose rows can be conjured by
--   hash is a table somebody can fill with keys they generated. Updating an
--   existing row can only ever move counters that a genuine search created.
--
--   And a dropped counter is honest. If the row has rolled over to a new day,
--   the import is simply not counted, which understates conversion slightly
--   rather than inventing a search that never happened.

create or replace function public.record_catalogue_demand_by_key(
  p_intent_key text,
  p_family_opens integer default 0,
  p_import_attempts integer default 0,
  p_import_successes integer default 0
)
returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_touched integer;
begin
  if p_intent_key is null or length(p_intent_key) <> 64 then
    return false;
  end if;

  update public.catalogue_demand_daily
     set family_opens = family_opens + greatest(coalesce(p_family_opens, 0), 0),
         import_attempts = import_attempts + greatest(coalesce(p_import_attempts, 0), 0),
         import_successes = import_successes + greatest(coalesce(p_import_successes, 0), 0),
         updated_at = now()
   where intent_key = p_intent_key
     and day = (now() at time zone 'utc')::date;

  get diagnostics v_touched = row_count;
  return v_touched > 0;
end;
$$;

revoke all on function public.record_catalogue_demand_by_key(text, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.record_catalogue_demand_by_key(text, integer, integer, integer)
  to service_role;

comment on function public.record_catalogue_demand_by_key is
  'Move counters on an intent that already exists today, addressed by its '
  'opaque key. Never inserts: a hash is not evidence that a search happened.';
