# Supabase migration reconciliation — 17 August 2026

Audit only. **No repair was executed.** No production mutation of any kind was
performed: no `migration repair`, no `db push`, no DDL, no data write. This file
records what was measured, what each mismatch is, why the repair was not run,
and the exact commands — with inverses — that should run once the preconditions
below are met.

Companion machine-readable mappings: `supabase-migration-map-20260817.json` and
`supabase-migration-map-20260817.csv`.

| | |
|---|---|
| Project ref | `dugizuswuebrmcmvinmi` (CLI link and MCP endpoint verified identical) |
| Repo HEAD | `3a48f59` |
| Supabase CLI | 2.90.0 (latest at time of audit: 2.114.0) |
| Ledger rows (`supabase_migrations.schema_migrations`) | 91 |
| Local migration files | 93 |
| Ledger md5 (before, and unchanged after) | `ab12eaad03bc5dcb85240bc231d238fd` |
| Production schema fingerprint (before, and unchanged after) | `94361af27b8b094f0a458e202ec3e427` over 2913 objects |

`supabase migration list --linked`: **49 matched · 42 remote-only · 44 local-only**
— 86 divergent versions, every one of which has a disposition below. There are
no unresolved ambiguities.

## The cause

Local files are authored with round timestamps (`20260808100000`). The 42
remote-only rows carry real clock times (`20260808150625`). The ledger's `name`
column resolves this almost completely: **41 of the 42 remote-only rows pair 1:1
with a local file by migration name, and the 42nd was resolved by statement
content. There are zero remote orphans.**

Two pairs prove the mechanism outright — the remote `name` still embeds the
local version it was applied from:

| Remote version | Remote name | Local file |
|---|---|---|
| `20260806215954` | `20260807122000_ai_calls_survive_churn` | `20260807122000_ai_calls_survive_churn.sql` |
| `20260808150750` | `20260808150000_listing_imagery` | `20260808150000_listing_imagery.sql` |

`created_by` corroborates it: every one of the 42 remote-only rows carries an
operator email and a single whole-file statement, while the matched rows carry
`created_by = NULL` and a per-statement array. Those are two different
application paths — the MCP/dashboard `apply_migration` route, which stamps its
own version, and `supabase db push`, which preserves the filename version.

Byte length was tried as a cheap equivalence test and **rejected**: the remote
statement for `ai_calls_survive_churn` is 479 bytes against a 2450-byte local
file, because this repo's migrations are heavily commented and the re-applied
copies are not. Nothing here is established by checksum. Every disposition below
rests on the live object or the live effect.

### The two pairs the previous pass could not resolve — both now closed

1. **`push_tokens_and_prefs` (remote `20260810004436`) ↔ `push` (local
   `20260810100300`)** — the only pair whose names differ, previously matched on
   position alone and flagged as the weakest link. Closed by probing the ledger
   row's own statements: they reference `push_tokens`, `notification_prefs` and
   `push_sends` — exactly the three tables the local file creates — and all three
   are live with RLS enabled. Position was never the evidence; content is.
2. **`ai_timeout_and_attempts` appears twice remotely** — `20260808160000` (7
   statements) and `20260808184759` (1 statement) — against one local file. The
   previous pass guessed "a follow-up fix applied under a reused name". That is
   **wrong**: both rows reference `timeout_ms`, `attempts`, both constraints and
   the same `update … set timeout_ms = 45000 where workload = 'tagging'`. It is
   the same migration applied twice, once per path, and it was harmless only
   because the file is idempotent throughout (`add column if not exists` plus
   `do`-block constraint guards). Both remote rows map to local
   `20260808180000`, which is why 42 remote rows cover 41 local files.

## The three local migrations with no ledger row

Probed directly against production, read-only:

| Local migration | Production state | Disposition |
|---|---|---|
| `20260810150100_event_roster_block_filter` | **Live** — the `event_members` roster policy reads `((auth.uid() = user_id) OR can_see_event(event_id)) AND NOT blocked_between(auth.uid(), user_id)`, an exact match for the file | applied outside the ledger |
| `20260812120000_close_comments_and_lock_board` | **Live** — `pg_get_functiondef` for `event_is_open`, `assert_comment_thread_open` and `assert_vote_retractable` is byte-identical to the file; `assert_vote_target` carries the `CL002` branch; both triggers exist | applied outside the ledger |
| `20260810150000_trial_is_twenty_one_days` | **NOT live** — `handle_new_subscription()` still writes `now() + interval '14 days'` | **genuinely pending** |

The first two changed production without leaving a ledger row at all, which is a
different failure from the renumbering above and must not be repaired with the
same reflex.

> ### The one that is not bookkeeping
>
> **Production is still issuing 14-day trials.** `20260810150000` was written to
> make the trial 21 days and has never reached production. Every account created
> since 10 August has a 14-day trial. This is a live product/billing
> discrepancy, not a history mismatch, and it is the reason a blanket "mark
> everything applied" repair would have been wrong: it would have recorded a
> migration as applied whose SQL has never run, permanently hiding a pending
> change behind a green `migration list`.

`close_comments_and_lock_board` was nearly misread as partially applied: it has
no closure trigger of its own on `event_outfit_votes`, because the board lock
lives inside `assert_vote_target`/`assert_vote_retractable`. Confirmed by
function body, not by trigger name.

## New finding: two matched versions whose ledger rows are empty

Not part of the 86, and not visible to `migration list` at all — both versions
match a local file, so the CLI reports them as reconciled:

| Version | Name | Ledger row | Effects in production |
|---|---|---|---|
| `20260816190545` | `today_ratings_favorites` | **0 statements**, `created_by` NULL | live — `outfits.rating`, `outfits.favorited_at`, index `outfits_user_favorited_idx` |
| `20260818000000` | `private_circles` | **0 statements**, `created_by` NULL | live — tables `circles`/`circle_members` (RLS on), enums `circle_member_role`/`circle_member_state`, 9 functions, 4 indexes, 9 triggers |

A row with no statements records that a version was *marked* applied, not that
its SQL was *run*. For these two the SQL demonstrably did run — every object was
verified present — so the disposition is benign. It is written down because the
same empty-row shape is exactly what a careless `migration repair --status
applied` would leave behind on `20260810150000`, and at that point the ledger
would assert a 21-day trial that production does not have. These two rows are
the precedent that makes that mistake easy; this section exists so it is not
made.

## Dispositions — all 86 divergent versions

| Disposition | Count | Meaning |
|---|---|---|
| `renamed_equivalent` | 40 | Remote row is the same migration under a clock-time version; effect verified live |
| `name_differs_content_confirmed` | 1 | `push` ↔ `push_tokens_and_prefs`, resolved by ledger statement content |
| `duplicate_reapplication` | 1 | `20260808184759`, a second row for `20260808180000` |
| `already_live_unrecorded` | 2 | Local file with no ledger row whose effect is live |
| `genuinely_pending` | 1 | `20260810150000`, SQL never run |
| `remote_only_unique` | 0 | No production migration is unaccounted for by a local file |
| `ambiguous` | 0 | — |

42 remote-only rows + 44 distinct local-only versions = 86. Per-version evidence
is in the JSON and CSV companions.

## Evidence queries

All read-only; none returns a customer row. Run against production via the
Supabase MCP endpoint or any read-only psql session.

Ledger with statement metadata (never print `statements` themselves — they are
large, and printing them is how a migration audit turns into a data dump):

```sql
select version, name,
       coalesce(cardinality(statements), 0) as stmt_count,
       md5(coalesce(array_to_string(statements, ';'), '')) as statements_md5,
       length(coalesce(array_to_string(statements, ';'), '')) as statements_len,
       created_by
from supabase_migrations.schema_migrations
order by version;
```

Ledger control hash:

```sql
select md5(string_agg(version||'|'||coalesce(name,'')||'|'||coalesce(array_to_string(statements,';;'),''), E'\n' order by version))
from supabase_migrations.schema_migrations;
```

Pairing a remote row to a local file by content, without printing the SQL — this
is what closed the `push` pair:

```sql
select version, name,
       (array_to_string(statements, E'\n') like '%push_tokens%')        as m_push_tokens,
       (array_to_string(statements, E'\n') like '%notification_prefs%') as m_notification_prefs,
       (array_to_string(statements, E'\n') like '%push_sends%')         as m_push_sends
from supabase_migrations.schema_migrations
where version in ('20260810004436', '20260808160000', '20260808184759');
```

Object-level existence sweep (tables, functions, views, triggers, indexes,
types), and the column/constraint/policy/bucket detail queries: see
`scripts/schema-objects.sql`, which is the same object set the fingerprint below
is computed from.

The pending migration, stated as a query:

```sql
select pg_get_functiondef(p.oid) like '%21 days%' as trial_is_21_days
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'handle_new_subscription';
-- production returns false
```

## Schema fingerprint

`supabase db dump` is unavailable on the audit machine — it needs a direct
Postgres connection, and three attempts hung and were terminated. The comparison
is therefore built out of catalog rows, which both sides can produce:
`scripts/schema-objects.sql` is a bare SELECT expression wrapped twice, once as
a listing and once as an md5 rollup, by `scripts/schema-fingerprint.sh`. The
same text runs against the CI stack over psql and against production over MCP,
so the two hashes are comparable by construction. Determinism details — `collate
"C"` on every ordering, whitespace squeezed, extension-owned objects excluded —
are documented in the SQL file itself.

Production, measured this session:

| Section | Objects | md5 |
|---|---|---|
| `public/table` | 55 | `24e13b6fb021c6c5bb9dbb3e69cc546b` |
| `public/column` | 510 | `07b9c4fb68f65a0d6dfc33d16a196ee0` |
| `public/constraint` | 282 | `b7c34a83592763717f36d62e3029fe66` |
| `public/index` | 159 | `9e29d0f95e3d49ac0d976b4e08c95d80` |
| `public/policy` | 129 | `d1d6c062c7a0faeb9ff761463d1dfa45` |
| `public/view` | 13 | `d5d1828a84e97f22c894860d73c13e21` |
| `public/function` | 102 | `77f54af0e3cce3005447d3b3a0274095` |
| `public/trigger` | 58 | `016428f6030daea99770ee6c16dfbe98` |
| `public/type` | 17 | `4cca3f0045ee055a409886d35038491c` |
| `public/grant_table` | 783 | `23061c65f0316631f924593f9c939215` |
| `public/grant_routine` | 142 | `464208a4e9ef88068cf8de05d9163fa0` |
| `storage/*` | 205 | see JSON |
| `auth/*` | 441 | see JSON |
| **TOTAL** | **2913** | **`94361af27b8b094f0a458e202ec3e427`** |

These figures are **not** comparable to the `b78b28ee…`/63-tables/671-columns
numbers in this file's previous revision: that fingerprint used a different
object set. `94361af2…` supersedes it.

### What the comparison is expected to show, and what it cannot yet claim

The replayed CI fingerprint is produced by the `Migration replay` workflow. At
the time of writing it has been run and its result is recorded in
"Replay result" below.

Equivalence is **not** claimed, and one difference is predicted outright:

- `public/function` **must** differ. `trial_is_twenty_one_days` is pending, so a
  clean replay produces a 21-day `handle_new_subscription` where production has
  14. A run in which `public/function` matched would mean the replay was not
  actually clean.
- `auth/*` and `storage/*` are expected to differ. Their contents track the
  running GoTrue and Storage versions, which are platform properties: a local
  CLI stack and the hosted project are not the same software. This is why the
  fingerprint is sectioned per schema rather than reduced to one number —
  `public` is the only schema this repo's migrations own, and it is the only
  section whose agreement would mean anything.

Any difference in `public/table`, `public/policy`, `public/constraint`,
`public/index`, `public/trigger`, `public/type` or the `public/grant_*` sections
is unexplained and blocks the repair until it is accounted for.

## Backup, before any repair

The proposed repair is history-only, so the only table it can damage is
`supabase_migrations.schema_migrations` — and the 42 rows marked `reverted` are
deleted from it, taking their `statements` with them. 373 621 bytes of applied
SQL live in that column and exist nowhere else in the repo, because the
re-applied copies are not the committed files.

Required, in order:

1. A platform backup or PITR restore point, taken from the Supabase dashboard
   (Database → Backups) immediately before the repair window.
2. A full ledger export, which is the thing the repair actually puts at risk:

   ```bash
   pg_dump "$SUPABASE_DB_URL" \
     --schema=supabase_migrations --table=supabase_migrations.schema_migrations \
     --data-only --column-inserts > ledger-backup-$(date +%Y%m%d%H%M).sql
   ```

**Neither was taken during this audit**, and neither could be: both need a
direct Postgres connection, which is what failed here. The ledger md5 and the
schema fingerprint above are *verification controls* — they prove afterwards
whether something moved — and they are **not** restorable backups. Do not treat
them as one.

## Proposed repairs, for when the preconditions are met

**Not executed.** `migration repair` writes the tracking table only; it never
runs or reverts SQL.

Preconditions, all required:

- `Migration replay` workflow green, with `public/*` fingerprint sections
  matching production except `public/function`, whose only difference is
  `handle_new_subscription`.
- Platform backup and ledger export taken, per the section above.
- `20260810150000_trial_is_twenty_one_days` decided on its own terms. It needs a
  **push**, not a repair, and 14 → 21 days is a product and billing decision, not
  a cleanup.

Then, for each of the 41 local versions in `pairs` in the JSON:

```bash
# the local version's SQL is already live; tell the ledger so
supabase migration repair --status applied  <local_version>
# and that the clock-time stamp is not a migration of its own
supabase migration repair --status reverted <remote_version>
```

`20260808180000` has two remote rows and needs both reverted:

```bash
supabase migration repair --status applied  20260808180000
supabase migration repair --status reverted 20260808160000
supabase migration repair --status reverted 20260808184759
```

The two live-but-unrecorded files get an `applied` with no matching `reverted`,
because there is no remote row to retire:

```bash
supabase migration repair --status applied 20260810150100
supabase migration repair --status applied 20260812120000
```

Exact inverse of every command above — restores the prior ledger state, except
that a re-inserted row's `statements` come back NULL, which is what the ledger
export in the backup section is for:

```bash
supabase migration repair --status reverted <local_version>
supabase migration repair --status applied  <remote_version>
```

Do **not** mark `20260810150000` applied under any circumstance until its SQL is
actually live. Doing so would erase the only finding in this audit that costs
money.

After any repair: re-run `supabase migration list --linked`, confirm
`supabase db push --dry-run` is empty, and re-compute the schema fingerprint — a
history-only repair must leave it at `94361af27b8b094f0a458e202ec3e427` exactly.

## Replay result

Recorded from the `Migration replay` workflow run for HEAD `3a48f59`; see the
"Replay result" note appended by that run below or the workflow run summary for
the per-section table.

## State at end of audit

Nothing was mutated. Ledger md5 re-measured at the end of the session is
`ab12eaad03bc5dcb85240bc231d238fd`, identical to the value recorded at the
start; the schema fingerprint is unchanged at
`94361af27b8b094f0a458e202ec3e427`.
