-- ===========================================================================
-- ai_calls: the ledger survives the account.
--
-- `ai_calls.user_id` was `not null … on delete cascade`, and on 2026-08-06
-- production demonstrated what that means: a probe account exercised
-- generate-outfits, stylist-chat and garment-search, ran delete-account forty
-- seconds later, and every one of its ledger rows vanished. The table's own
-- charter (20260803180000: "is it really 3 generations a day?", "did the
-- cheap model actually cost less?", "which user is burning the budget?") is
-- unanswerable from a ledger that silently rewrites itself downward on every
-- churn — worse than missing data, the totals still LOOK like valid answers.
--
-- So: `on delete set null`, and the column goes nullable. What survives a
-- deletion is an anonymized spend record — workload, model, tokens, latency,
-- timestamps — with the link to a person severed, which is what deletion is
-- actually for. The row was personal data while user_id pointed at someone;
-- afterwards it is a line in the accounts. This table already treats
-- `item_id` exactly this way (set null, same file), for exactly this reason:
-- the spend outlives the garment. Now it outlives the account too.
--
-- RLS holds without change, verified against the live policy: "ai_calls:
-- owner can select" is `(select auth.uid()) = user_id`, and NULL = uid is
-- NULL, never true — an anonymized row is readable by nobody but the service
-- role. No client reads this table at all (the only src/ mention is a doc
-- comment); only edge functions write it, always with a real user_id.
--
-- `ai_usage_counters` KEEPS its cascade, deliberately. It is not a ledger —
-- it is per-user quota enforcement state ("how much of THIS period's
-- allowance has THIS user spent"), meaningless the moment the user is gone,
-- and keeping anonymized quota rows would answer no question anyone asks.
--
-- delete-account relies on cascade for every other table and still does;
-- this is a documented exception for the one table whose purpose is
-- historical truth, not user state.
-- ===========================================================================

alter table ai_calls
  alter column user_id drop not null;

alter table ai_calls
  drop constraint ai_calls_user_id_fkey,
  add constraint ai_calls_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete set null;
