-- ===========================================================================
-- Deterministic AI Packet 1 — what the database has to enforce for the control
-- plane and the demand aggregate to mean anything.
--
-- The aggregate's whole safety argument is "no raw user phrase can get in".
-- That argument is worth exactly as much as the constraints behind it, so most
-- of this file is about what the table REFUSES rather than what it stores:
-- a phrase-length brand, an invented audience, a row with nothing recognised
-- in it, and — the one that matters most — any reachability at all from `anon`
-- or `authenticated`.
--
-- The rest checks the two properties the founder queries depend on: that word
-- order cannot make a second intent, and that recording the same intent twice
-- adds to a counter rather than creating a second row.
-- ===========================================================================

begin;

create extension if not exists pgtap with schema extensions;

select plan(28);

-- ---------------------------------------------------------------------------
-- 1 · The three workloads exist and are usable as data
-- ---------------------------------------------------------------------------
--
-- `enum_has_labels` would pass on a label added but unusable; these insert.

select ok(
  'voice_transcription' = any (enum_range(null::public.ai_workload)::text[]),
  'ai_workload carries voice_transcription'
);
select ok(
  'closet_parsing' = any (enum_range(null::public.ai_workload)::text[]),
  'ai_workload carries closet_parsing'
);
select ok(
  'packing_brief' = any (enum_range(null::public.ai_workload)::text[]),
  'ai_workload carries packing_brief'
);

insert into public.ai_config (workload, model_id, max_tokens, timeout_ms)
values ('voice_transcription', 'openai/whisper-large-v3', 1024, 45000)
on conflict (workload) do nothing;

select is(
  (select model_id from public.ai_config where workload = 'voice_transcription'),
  'openai/whisper-large-v3',
  'and a config row can actually be written against one'
);

-- ---------------------------------------------------------------------------
-- 2 · Configuration says what happens when the validator rejects
-- ---------------------------------------------------------------------------

select has_column('public', 'ai_config', 'rescue_model_id',
  'ai_config carries an optional rescue model');
select has_column('public', 'ai_config', 'validator_policy',
  'and the policy that decides whether it is ever used');

select is(
  (select validator_policy from public.ai_config where workload = 'voice_transcription'),
  'strict',
  'a workload with no opinion fails closed rather than escalating');

select throws_ok(
  $$update public.ai_config set validator_policy = 'whatever'
     where workload = 'voice_transcription'$$,
  '23514',
  null,
  'an unknown validator policy is refused');

-- A rescue policy with no rescue model reads as configured protection and buys
-- none. The constraint is what stops that being a silent no-op.
select throws_ok(
  $$update public.ai_config set validator_policy = 'rescue', rescue_model_id = null
     where workload = 'voice_transcription'$$,
  '23514',
  null,
  'and a rescue policy without a rescue model is refused');

-- ---------------------------------------------------------------------------
-- 3 · The aggregate keeps counters, not sentences
-- ---------------------------------------------------------------------------

select hasnt_column('public', 'catalogue_demand_daily', 'user_id',
  'the demand aggregate has no user column to leak one');
select hasnt_column('public', 'catalogue_demand_daily', 'query',
  'and no column for the query');
select hasnt_column('public', 'catalogue_demand_daily', 'raw_query',
  'and none under the other obvious name');

select throws_ok(
  $$insert into public.catalogue_demand_daily (intent_key, brand_slug, garment_class)
    values ('k', 'i own a james perse tee', 'top')$$,
  '23514',
  null,
  'a sentence cannot be smuggled in through the brand column');

select throws_ok(
  $$insert into public.catalogue_demand_daily (intent_key, garment_class, audience)
    values ('k2', 'top', 'people who like linen')$$,
  '23514',
  null,
  'nor through the audience column');

select throws_ok(
  $$insert into public.catalogue_demand_daily (intent_key, colour_family)
    values ('k3', 'blue')$$,
  '23514',
  null,
  'and a row with nothing recognised in it is not an intent');

-- ---------------------------------------------------------------------------
-- 4 · One intent, however it was said
-- ---------------------------------------------------------------------------
--
-- The function takes canonical fields, so the sentence never reaches it. What
-- these check is the layer below that: the same fields, differently cased and
-- padded — which is what two different parses of the same request produce —
-- must land on one key and one row.

select is(
  public.record_catalogue_demand('james-perse', 'top', 'mens', null, 1, 0, 0, 0, 0, 'fast'),
  public.record_catalogue_demand('  James-Perse ', 'TOP', 'Mens', null, 1, 0, 0, 0, 0, 'slow'),
  'case and padding cannot create a second intent');

select is(
  (select count(*)::int from public.catalogue_demand_daily
    where brand_slug = 'james-perse' and garment_class = 'top'),
  1,
  'and the second recording adds to the first row rather than making one');

select is(
  (select searches from public.catalogue_demand_daily
    where brand_slug = 'james-perse' and garment_class = 'top'),
  2,
  'counters accumulate');

select is(
  (select latency_fast + latency_slow from public.catalogue_demand_daily
    where brand_slug = 'james-perse' and garment_class = 'top'),
  2,
  'and each call lands in exactly one latency bucket');

-- A different colour IS a different intent — it is one of the four canonical
-- fields, not decoration.
select isnt(
  public.record_catalogue_demand('james-perse', 'top', 'mens', 'grey'),
  public.record_catalogue_demand('james-perse', 'top', 'mens', null),
  'a named colour family is part of the intent, not noise');

select is(
  public.record_catalogue_demand(null, null, 'mens', 'grey'),
  null,
  'and an unrecognised request records nothing at all');

-- ---------------------------------------------------------------------------
-- 5 · Nobody signed in can reach any of it
-- ---------------------------------------------------------------------------
--
-- This is the assertion the privacy claim rests on. RLS with no policy plus an
-- explicit revoke: either alone would be undone by one careless later change.

select ok(
  (select relrowsecurity from pg_class
    where oid = 'public.catalogue_demand_daily'::regclass),
  'row level security is on');

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'catalogue_demand_daily'),
  0,
  'and there is no policy that opens it to a signed-in user');

select ok(
  not has_table_privilege('authenticated', 'public.catalogue_demand_daily', 'select')
  and not has_table_privilege('anon', 'public.catalogue_demand_daily', 'select'),
  'neither anon nor authenticated may read the aggregate');

select ok(
  not has_function_privilege('authenticated',
    'public.record_catalogue_demand(text,text,text,text,integer,integer,integer,integer,integer,text)',
    'execute'),
  'and a signed-in client cannot bump a counter directly');

-- ---------------------------------------------------------------------------
-- 6 · And the control plane itself is not a client-readable table
-- ---------------------------------------------------------------------------
--
-- `ai_config` shipped in the original schema with blanket grants to `anon` and
-- `authenticated` and one permissive `qual = true` SELECT policy, so every
-- signed-in user could read the whole model roster. Nothing in the app has
-- ever read it — every reader holds the service-role key, which ignores grants
-- entirely — so the exposure bought nothing and told an adversary which
-- workload is cheapest to make expensive.

select ok(
  not has_table_privilege('authenticated', 'public.ai_config', 'select')
  and not has_table_privilege('anon', 'public.ai_config', 'select'),
  'no client key can read the model roster');

select is(
  (select count(*)::int from pg_policies
    where schemaname = 'public' and tablename = 'ai_config'),
  0,
  'and no policy remains that would open it again if a grant came back');

-- `ai_calls` deliberately keeps its grants: the privacy screen reads it to
-- answer "what has been sent about me", which is a promise the app makes and
-- has to keep from a client key. Asserted so a later sweep tidying up grants
-- does not take this one with it and break that screen silently.
select ok(
  has_table_privilege('authenticated', 'public.ai_calls', 'select'),
  'but the privacy screen can still read the ledger it reports from');

select * from finish();
rollback;
