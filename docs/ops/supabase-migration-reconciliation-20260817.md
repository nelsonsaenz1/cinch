# Supabase migration reconciliation — 17 August 2026

Audit only. **No repair was executed.** This file records what was measured, what
each mismatch is, why the repair was not run, and the exact commands (with
inverses) that should run once the preconditions below are met.

Companion machine-readable mapping: `supabase-migration-map-20260817.json`.

| | |
|---|---|
| Project ref | `dugizuswuebrmcmvinmi` (CLI link and MCP endpoint verified identical) |
| Repo HEAD | `3a48f59` |
| Supabase CLI | 2.90.0 (latest at time of audit: 2.114.0) |
| Ledger rows (`supabase_migrations.schema_migrations`) | 91 |
| Local migration files | 93 |
| Ledger md5 (before) | `ab12eaad03bc5dcb85240bc231d238fd` |
| Production schema fingerprint (before) | `b78b28ee1e540e0f87275d28a1900e84` |

Fingerprint covers `public` + `storage`: 63 tables, 671 columns, 144 policies,
119 functions, 176 indexes. Both hashes are reproducible with the queries in
"Reproducing the fingerprints" below, and are the before/after control for any
future repair — a history-only repair must leave the schema fingerprint
**unchanged**.

## What `supabase migration list --linked` shows

49 matched · 42 remote-only · 44 local-only.

## The cause

Local files are authored with round timestamps (`20260808100000`). The 42
remote-only rows carry real clock times (`20260808150625`). The ledger's `name`
column resolves this completely: **all 42 remote-only rows pair 1:1 with a local
file by migration name, with zero remote orphans.**

Two pairs prove the mechanism outright — the remote `name` still embeds the
local version it was applied from:

| Remote version | Remote name | Local file |
|---|---|---|
| `20260806215954` | `20260807122000_ai_calls_survive_churn` | `20260807122000_ai_calls_survive_churn.sql` |
| `20260808150750` | `20260808150000_listing_imagery` | `20260808150000_listing_imagery.sql` |

So these migrations were applied through a path that stamped its own version
rather than preserving the filename version. The SQL is live; only the
bookkeeping disagrees. Daily Social is one of these (local `20260817000000` =
remote `20260817031752`, name `daily_social`), as is Private Groups' neighbour
set. Private Groups itself (`20260818000000`) matched already.

### Two pairs that need object-level confirmation before repair

1. **`push_tokens_and_prefs` (remote `20260810004436`) ↔ `push` (local
   `20260810100300`)** — the only pair matched across *different* names. Paired
   here on position and subject matter; `public.push_tokens` exists in
   production. This is the weakest link in the mapping and must be confirmed
   statement-by-statement before it is repaired.
2. **`ai_timeout_and_attempts` appears twice remotely** — `20260808160000`
   (7 statements) and `20260808184759` (1 statement) — against one local file
   (`20260808180000`). One is presumably a follow-up fix applied under a reused
   name. Which remote row corresponds to the local file is **not** established.

## The three local migrations with no ledger row

Probed directly against production (read-only):

| Local migration | Production state | Classification |
|---|---|---|
| `20260810150100_event_roster_block_filter` | **Live** — `event_members` roster policy contains the `blocked_between` screen | applied outside the ledger |
| `20260812120000_close_comments_and_lock_board` | **Live** — `event_is_open()` exists and is called by `assert_comment_thread_open`, `assert_vote_target`, `assert_vote_retractable` | applied outside the ledger |
| `20260810150000_trial_is_twenty_one_days` | **NOT live** — `handle_new_subscription()` still writes `now() + interval '14 days'` | **genuinely pending** |

The first two changed production without leaving a ledger row at all, which is a
different failure from the renumbering above and should not be repaired with the
same reflex.

> ### The one that is not bookkeeping
>
> **Production is still issuing 14-day trials.** `20260810150000` was written to
> make the trial 21 days and has never reached production. Every account created
> since 10 August has a 14-day trial. This is a live product/billing discrepancy,
> not a history mismatch, and it is the reason a blanket "mark everything
> applied" repair would have been wrong: it would have recorded a migration as
> applied whose SQL has never run, permanently hiding a pending change.

`close_comments_and_lock_board` was nearly misread as partially applied: it has
no closure trigger on `event_outfit_votes`, because the board lock lives inside
`assert_vote_target`/`assert_vote_retractable` rather than in a trigger of its
own. Confirmed by function body, not by trigger name.

## Why no repair was executed

Three independent blockers. Each alone is disqualifying under the gate's rule
that repair is permitted only after exact schema equivalence is *proven*.

1. **Equivalence is provably false, not merely unproven.** `trial_is_twenty_one_days`
   is pending, so replaying the local chain from zero would produce a 21-day
   trial where production has 14. Local and production schemas are known to
   differ.
2. **No replay proof is possible on this machine.** `docker` is not installed,
   so `supabase db start` and `supabase test db` (pgTAP) cannot run. The
   required "fresh replay from zero + diff against production" cannot be
   produced here.
3. **No production schema backup could be taken.** `supabase db dump --linked`
   terminates under this session's sandbox (exit 144, no output) because it
   needs a direct Postgres connection rather than the API path
   `migration list` uses. The catalog fingerprint above is a control, **not**
   a restorable backup. Retrying with the sandbox disabled would open a direct
   production database connection and was not done unilaterally.

## Proposed repairs, for when the preconditions are met

**Not executed.** History-only; `migration repair` writes the tracking table and
never runs or reverts SQL (Supabase docs, *Database Migrations*).

Preconditions, all required:

- Docker available; `supabase db start` then `supabase test db` green on a fresh
  replay of all 93 local files.
- Replayed local schema diffed against production with only normalized noise.
- `supabase db dump --linked` backup of production schema taken and stored.
- The two open questions above (`push` ↔ `push_tokens_and_prefs`, duplicate
  `ai_timeout_and_attempts`) resolved statement-by-statement.
- `20260810150000_trial_is_twenty_one_days` decided on its own terms — it needs
  a **push**, not a repair, and that is a product decision about trial length.

Then, for each of the 42 pairs in the JSON mapping:

```bash
# tell the ledger the local version is applied (its SQL is already live)
supabase migration repair --status applied <local_version>
# and that the duplicate remote stamp is not a migration of its own
supabase migration repair --status reverted <remote_version>
```

Inverse of each (restores the prior ledger state exactly):

```bash
supabase migration repair --status reverted <local_version>
supabase migration repair --status applied  <remote_version>
```

Do **not** mark `20260810150000` applied under any circumstance until its SQL is
actually live; doing so would erase the finding above.

After any repair: re-run `supabase migration list --linked`, confirm
`supabase db push --dry-run` is empty, and re-compute the schema fingerprint —
it must still be `b78b28ee1e540e0f87275d28a1900e84`.

## Reproducing the fingerprints

Ledger md5:

```sql
select md5(string_agg(version||'|'||coalesce(name,'')||'|'||coalesce(array_to_string(statements,';;'),''), E'\n' order by version))
from supabase_migrations.schema_migrations;
```

Schema fingerprint: the CTE query over `information_schema.columns`,
`pg_policies`, `pg_proc` (`prokind='f'`), `pg_indexes` and `pg_class.relrowsecurity`
across `public` and `storage`, hashed together. Aggregates must be excluded
(`prokind='f'`) or `pg_get_functiondef` errors on `array_agg`.

## State at end of audit

Nothing was mutated: no repair, no push, no SQL, no data write. Ledger md5 and
schema fingerprint are unchanged from the values recorded above.
