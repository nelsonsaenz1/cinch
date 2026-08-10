-- Per-workload provider timeouts, and a count of the calls a request really made.
--
-- RECOVERED 2026-08-10. This shipped to production on 2026-08-08 as
-- `20260808184759_ai_timeout_and_attempts` and was never written to the repo —
-- it was applied straight to the database and the file was not created. Three
-- migrations were in that state; see docs/ci/migration-replay.md for how they
-- were found and what stops it happening again.
--
-- The SQL below is the statement list read back out of production's own
-- `supabase_migrations.schema_migrations`, so a rebuild from this repo now
-- produces the columns the Edge Functions already depend on. Without it,
-- `_shared/openrouter.ts` reads `ai_config.timeout_ms` from a column that does
-- not exist, and `recordAiCall` writes `attempts` into nothing.
--
-- `if not exists` on the columns because production already has them; the
-- constraints are guarded for the same reason.

alter table public.ai_config
  add column if not exists timeout_ms integer not null default 30000;

comment on column public.ai_config.timeout_ms is
  'Milliseconds one provider call may take before it is abandoned. Covers reading the response body, not just the handshake.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ai_config_timeout_ms_sane'
  ) then
    alter table public.ai_config
      add constraint ai_config_timeout_ms_sane
      check (timeout_ms between 5000 and 120000);
  end if;
end;
$$;

-- Vision tagging is the slowest workload the app has — a fetched image plus a
-- decode — so it gets more room than the shared default before the request is
-- abandoned.
update public.ai_config set timeout_ms = 45000 where workload = 'tagging';

alter table public.ai_calls
  add column if not exists attempts smallint not null default 1;

comment on column public.ai_calls.attempts is
  'Provider calls made for this logical request, including the failed ones. 1 unless a retry fired.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ai_calls_attempts_positive'
  ) then
    alter table public.ai_calls
      add constraint ai_calls_attempts_positive check (attempts >= 1);
  end if;
end;
$$;
