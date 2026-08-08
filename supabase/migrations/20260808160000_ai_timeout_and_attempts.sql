-- Per-workload provider deadline, and an honest count of attempts.
--
-- Background. `outfit_generation` failed 7 of 13 live calls, every one of them
-- at ~30007ms with "Signal timed out." The abort was a constant compiled into
-- the Edge Function, so the only way to give a slow model more room — or to
-- take room away from one that had started stalling — was a redeploy. Model
-- choice already lives in this table precisely so it can be changed without
-- one; the deadline that decides whether that model's answer is ever used
-- belongs next to it.
--
-- The defaults below are the constants they replace, so this migration changes
-- no behaviour on its own: 30s for the text workloads, 45s for tagging, which
-- fetches and reasons over an image and is legitimately slower.

alter table public.ai_config
  add column if not exists timeout_ms integer not null default 30000;

comment on column public.ai_config.timeout_ms is
  'Milliseconds one provider call may take before it is abandoned. Covers reading the response body, not just the handshake.';

-- Keep the deadline in a range where a change is a tuning decision rather than
-- an outage: below ~5s even a fast model's tail gets cut, and Supabase kills
-- the invocation itself well before two attempts at 120s could finish.
alter table public.ai_config
  add constraint ai_config_timeout_ms_sane
  check (timeout_ms between 5000 and 120000);

update public.ai_config set timeout_ms = 45000 where workload = 'tagging';

-- How many provider calls this row actually paid for.
--
-- Every AI function retries once on a retryable failure, and each writes a
-- single ai_calls row carrying the cost of the attempt that succeeded. A first
-- attempt that burned tokens and then 5xx'd was therefore invisible: the table
-- read as one call at one price. That understatement is what this column exists
-- to stop, and it matters more now than it did — the deadline was being
-- misclassified as non-retryable, so a timed-out call never made a second
-- attempt at all. Fixing that classification turns the retry on for real, and a
-- retry nobody can see in the cost table is not one worth having.
--
-- Nullable, and deliberately without a default. Only `generate-outfits` and
-- `tag-item` report it today; `stylist-chat`, `packing-brief` and
-- `garment-search` retry too and do not. A default of 1 would have those three
-- writing a confident "one call" over requests that made two — swapping a hole
-- in the accounting for a wrong number in it, which is the worse of the two
-- because it still reads like an answer. NULL says "this call site does not
-- report attempts", and `avg(attempts)` skips it instead of being dragged down.
alter table public.ai_calls
  add column if not exists attempts smallint;

comment on column public.ai_calls.attempts is
  'Provider calls made for this logical request, failures included. NULL when the calling function does not report it.';

alter table public.ai_calls
  add constraint ai_calls_attempts_positive check (attempts is null or attempts >= 1);
