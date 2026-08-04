-- AI provider configuration + usage accounting.
--
-- The point of the config table: model choice, effort, and token caps must be
-- changeable without an App Store release. A solo dev iterating on cost or
-- quality should be able to A/B a model with an UPDATE statement, not a
-- two-week review cycle.

create type ai_workload as enum ('tagging', 'outfit_generation', 'stylist_chat');

create table ai_config (
  workload      ai_workload primary key,
  provider      text        not null default 'openrouter',
  model_id      text        not null,
  -- Provider-specific knobs (effort, reasoning config, temperature where the
  -- provider still accepts it). Kept loose deliberately — this table should not
  -- need a migration every time a provider adds a parameter.
  params        jsonb       not null default '{}'::jsonb,
  max_tokens    integer     not null default 2048,
  enabled       boolean     not null default true,
  updated_at    timestamptz not null default now()
);

-- Read-only to the app; only the service role writes. No user_id column, so
-- this is the one table where RLS grants blanket read to authenticated users.
alter table ai_config enable row level security;

create policy "ai_config: readable by authenticated" on ai_config
  for select to authenticated using (true);

insert into ai_config (workload, model_id, params, max_tokens) values
  (
    'tagging',
    'qwen/qwen3-vl-235b-a22b-instruct',
    '{"temperature": 0.2}'::jsonb,
    1024
  ),
  (
    'outfit_generation',
    'z-ai/glm-4.6',
    '{"temperature": 0.7}'::jsonb,
    3072
  ),
  (
    'stylist_chat',
    'z-ai/glm-4.6',
    '{"temperature": 0.8}'::jsonb,
    2048
  );

-- ---------------------------------------------------------------------------
-- ai_calls — one row per model call.
--
-- This exists so that "is it really 3 generations a day?", "did the cheap model
-- actually cost less?", and "which user is burning the budget?" are queries
-- rather than arguments. Trivial to add now, painful to backfill.
-- ---------------------------------------------------------------------------

create table ai_calls (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  workload          ai_workload not null,
  provider          text not null,
  model_id          text not null,
  item_id           uuid references items (id) on delete set null,
  prompt_tokens     integer,
  completion_tokens integer,
  -- OpenRouter returns actual cost per generation, which beats reconstructing
  -- it from token counts and a price table that goes stale.
  cost_usd          numeric(10, 6),
  latency_ms        integer,
  succeeded         boolean not null default true,
  error             text,
  created_at        timestamptz not null default now()
);

create index ai_calls_user_id_idx on ai_calls using btree (user_id);
create index ai_calls_user_created_idx on ai_calls (user_id, created_at desc);
create index ai_calls_workload_idx on ai_calls (workload, created_at desc);

alter table ai_calls enable row level security;

-- Users may read their own usage (needed for "you have N generations left"),
-- but never write it — the Edge Function inserts with the service role.
create policy "ai_calls: owner can select" on ai_calls
  for select to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- tag_corrections — the fine-tuning corpus.
--
-- Every swipe-deck correction is a labelled (image, schema) pair. This is the
-- only credible route to a small model that beats a frontier one on our own
-- schema later, and it compounds from day one of TestFlight.
-- ---------------------------------------------------------------------------

create table tag_corrections (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  item_id        uuid references items (id) on delete set null,
  image_path     text,
  model_id       text not null,
  model_output   jsonb not null,
  corrected      jsonb not null,
  created_at     timestamptz not null default now()
);

create index tag_corrections_user_id_idx on tag_corrections using btree (user_id);

alter table tag_corrections enable row level security;

create policy "tag_corrections: owner can select" on tag_corrections
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "tag_corrections: owner can insert" on tag_corrections
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- AI processing consent (App Store Guideline 5.1.2(i), in force since Nov 2025).
--
-- Explicit in-app consent is required before sending personal data to a
-- third-party AI. A privacy-policy link is explicitly NOT sufficient. The Edge
-- Function refuses to call any model without a current consent record — the
-- check has to be server-side, because a client-side gate is trivially bypassed.
-- ---------------------------------------------------------------------------

alter table profiles
  add column ai_consent_version integer,
  add column ai_consent_at      timestamptz;

-- Bump this when the processor or the data categories change, which forces a
-- re-prompt for every existing user.
create or replace function current_ai_consent_version()
returns integer
language sql
immutable
as $$ select 1 $$;
