-- `attempts` becomes nullable: not every caller can honestly report one.
--
-- RECOVERED 2026-08-10, same as its predecessor. Shipped to production on
-- 2026-08-08 as `20260808185119_ai_calls_attempts_nullable`, never written to
-- the repo. See docs/ci/migration-replay.md.
--
-- Forty minutes after the column landed with `not null default 1`, the problem
-- with that default became clear: a function that does not track its retries
-- writes 1 whether it made one call or four, and a column that is sometimes a
-- real count and sometimes a placeholder cannot be summed. NULL says "this
-- caller does not report attempts", which is a different and honest fact.
--
-- The `update ... set attempts = null` is deliberate and destructive-looking:
-- every row written before this point carried the default rather than a
-- measurement, so keeping those 1s would mean averaging placeholders into a
-- retry rate. It runs against a table that existed for well under an hour.

alter table public.ai_calls drop constraint if exists ai_calls_attempts_positive;
alter table public.ai_calls alter column attempts drop default;
alter table public.ai_calls alter column attempts drop not null;

update public.ai_calls set attempts = null;

comment on column public.ai_calls.attempts is
  'Provider calls made for this logical request, failures included. NULL when the calling function does not report it.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'ai_calls_attempts_positive'
  ) then
    alter table public.ai_calls
      add constraint ai_calls_attempts_positive check (attempts is null or attempts >= 1);
  end if;
end;
$$;
