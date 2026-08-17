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
| Repo HEAD for all measurements | `0a59fc1` |
| Supabase CLI | 2.90.0 (latest at time of audit: 2.114.0) |
| Ledger rows (`supabase_migrations.schema_migrations`) | 91 |
| Local migration files | **92** (was 93; see "The trial is 14 days") |
| Ledger md5 (before, and unchanged after) | `ab12eaad03bc5dcb85240bc231d238fd` |
| Production schema fingerprint | `c6d5df0ba88239801e1f19d7556395c6` over 3025 objects |

`supabase migration list --linked`: **49 matched · 42 remote-only · 43 local-only**
— 85 divergent versions, every one of which has a disposition below. There are
no unresolved ambiguities in the *history*. There is one unresolved difference in
the *schema*, quantified exactly in "The grant divergence" below, and it is not
history at all.

## The trial is 14 days

> **Decided 17 August 2026, explicitly: the intended product behaviour is a
> 14-day trial.**
>
> Production has issued 14-day trials since the beginning and still does.
> `handle_new_subscription()` writes `now() + interval '14 days'`. **No production
> mutation was required, and none was performed.** There was nothing to fix in
> production; the repo was the thing that was wrong.
>
> `20260810150000_trial_is_twenty_one_days.sql` was an **erroneous,
> never-deployed local migration**. It has been **removed from the canonical
> migration chain**. It is not pending, it is not intended, and it must never be
> applied or marked applied.
>
> The removal is safe to state without qualification because the ledger never
> knew about it: `select count(*) … where version = '20260810150000'` returns
> **0**. Deleting the file therefore required no counterpart action in production
> — no repair to undo, no row to retire. Local file count 93 → 92; `matched`,
> `remote-only` and `ledger_rows` are all unchanged.
>
> The file's text is preserved in git and recoverable at
> `git show 0a59fc1:supabase/migrations/20260810150000_trial_is_twenty_one_days.sql`.

The previous revision of this file argued the opposite disposition — that the
migration was "genuinely pending" and represented "a live product/billing
discrepancy" costing money. **That framing was wrong in its premise.** It assumed
the repo held the intended behaviour and production had fallen behind. The
decision recorded above establishes the reverse: production held the intended
behaviour and the repo had acquired a change nobody wanted. The *measurement*
behind that section was correct and is unchanged — production writes 14 days, the
file wrote 21, the file had never run. Only the disposition has changed.

What this reverses, and where:

| File | Was | Now |
|---|---|---|
| `supabase/migrations/20260810150000_trial_is_twenty_one_days.sql` | 21-day migration | **deleted** |
| `store.config.json` (App Store review notes) | "grants 21 days of full access" | "grants 14 days" |
| `docs/launch-engineering-directive.md` P1-2 | directive to ship 14 → 21 | **withdrawn**, with the reasoning kept for the record |
| `docs/launch-engineering-directive.md` ship checklist | "New signups get 21 days" | "New signups get 14 days" |
| `docs/db/migration-history-audit.md` | "Step 0 — decide the trial" open | **closed**, 14 days |
| `YOUR-LIST.md` | "Trial 14 → 21 days" | reversal recorded |

`supabase/migrations/20260805160000_membership_tiers.sql` line 31 — the comment
explaining the 14-day choice, which the deleted migration went out of its way to
declare stale — **is correct as written and was not touched.** Nor was any
production-applied migration file: they remain append-only.

Application code needed no change. `src/features/plan/use-packing-access.ts`
already documents the trial as 14 days, `tests/context-lines.test.ts` already
asserts a fourteen-day trial against `20260805160000`, and no shipping surface
draws a trial duration at all (correction 06, asserted by
`tests/membership-row.test.ts`).

## The cause of the version divergence

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

## The local migrations with no ledger row

Probed directly against production, read-only. There were three; the third has
been removed from the repo and is recorded here for completeness:

| Local migration | Production state | Disposition |
|---|---|---|
| `20260810150100_event_roster_block_filter` | **Live** — the `event_members` roster policy reads `((auth.uid() = user_id) OR can_see_event(event_id)) AND NOT blocked_between(auth.uid(), user_id)`, an exact match for the file | applied outside the ledger |
| `20260812120000_close_comments_and_lock_board` | **Live** — `pg_get_functiondef` for `event_is_open`, `assert_comment_thread_open` and `assert_vote_retractable` is byte-identical to the file; `assert_vote_target` carries the `CL002` branch; both triggers exist | applied outside the ledger |
| ~~`20260810150000_trial_is_twenty_one_days`~~ | **Never live, and correctly so** — `handle_new_subscription()` writes `now() + interval '14 days'`, which is the intended behaviour | **removed from the repo**; see above |

The first two changed production without leaving a ledger row at all, which is a
different failure from the renumbering above and must not be repaired with the
same reflex. Both are now the *only* remaining local-only-without-ledger-row
cases, and neither requires an apply — their SQL is already live.

`close_comments_and_lock_board` was nearly misread as partially applied: it has
no closure trigger of its own on `event_outfit_votes`, because the board lock
lives inside `assert_vote_target`/`assert_vote_retractable`. Confirmed by
function body, not by trigger name.

## Two matched versions whose ledger rows are empty

Not part of the 85, and not visible to `migration list` at all — both versions
match a local file, so the CLI reports them as reconciled:

| Version | Name | Ledger row | Effects in production |
|---|---|---|---|
| `20260816190545` | `today_ratings_favorites` | **0 statements**, `created_by` NULL | live — `outfits.rating`, `outfits.favorited_at`, index `outfits_user_favorited_idx` |
| `20260818000000` | `private_circles` | **0 statements**, `created_by` NULL | live — tables `circles`/`circle_members` (RLS on), enums `circle_member_role`/`circle_member_state`, 9 functions, 4 indexes, 9 triggers |

A row with no statements records that a version was *marked* applied, not that
its SQL was *run*. For these two the SQL demonstrably did run — every object was
verified present — so the disposition is benign. It is written down because it is
the exact shape a careless `migration repair --status applied` leaves behind, and
a ledger that asserts a migration ran when it did not is the failure mode this
whole audit exists to avoid.

## Dispositions — all 85 divergent versions

| Disposition | Count | Meaning |
|---|---|---|
| `renamed_equivalent` | 40 | Remote row is the same migration under a clock-time version; effect verified live |
| `name_differs_content_confirmed` | 1 | `push` ↔ `push_tokens_and_prefs`, resolved by ledger statement content |
| `duplicate_reapplication` | 1 | `20260808184759`, a second row for `20260808180000` |
| `already_live_unrecorded` | 2 | Local file with no ledger row whose effect is live |
| `genuinely_pending` | **0** | Nothing in this repo is waiting to be applied to production |
| `remote_only_unique` | 0 | No production migration is unaccounted for by a local file |
| `ambiguous` | 0 | — |

42 remote-only rows + 43 distinct local-only versions = 85. Per-version evidence
is in the JSON and CSV companions.

Tracked separately, outside the 85 because the file no longer exists:

| Disposition | Count | Meaning |
|---|---|---|
| `removed_erroneous_never_deployed` | 1 | `20260810150000`, deleted rather than applied |

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
-- ab12eaad03bc5dcb85240bc231d238fd, at the start of the session and at the end
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

The trial, stated as a query — and note which way it now reads:

```sql
select pg_get_functiondef(p.oid) like '%14 days%' as trial_is_14_days,
       pg_get_functiondef(p.oid) like '%21 days%' as trial_is_21_days
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'handle_new_subscription';
-- production returns true, false — which is correct and intended

select count(*) from supabase_migrations.schema_migrations
 where version = '20260810150000';
-- 0: the removed migration never had a ledger row, so its deletion needs no
--    counterpart in production
```

Object-level existence sweep (tables, functions, views, triggers, indexes,
types), and the column/constraint/policy/bucket detail queries: see
`scripts/schema-objects.sql`, which is the same object set the fingerprint below
is computed from.

## Schema fingerprint

`supabase db dump` is unavailable on the audit machine — it needs a direct
Postgres connection, and three attempts hung and were terminated. Docker is
likewise unavailable. The comparison is therefore built out of catalog rows,
which both sides can produce: `scripts/schema-objects.sql` is a bare SELECT
expression wrapped twice, once as a listing and once as an md5 rollup, by
`scripts/schema-fingerprint.sh`. The same text runs against the CI stack over
psql and against production over MCP, so the two hashes are comparable by
construction. Determinism details — `collate "C"` on every ordering, whitespace
squeezed, extension-owned objects excluded — are documented in the SQL file
itself.

**Neither fingerprint input file was modified by this pass.**
`scripts/schema-objects.sql` and `scripts/schema-fingerprint.sh` are byte-identical
to `0a59fc1`, which is what makes the production figures below and the CI artifact
comparable at all. One consequence is deliberate and recorded here rather than
fixed: the header prose of `scripts/schema-objects.sql` says "the 93 files in
supabase/migrations", and the count is now 92. Correcting that comment would
change a fingerprint input for no analytical gain, so it was left alone.

### Production, measured this session against HEAD `0a59fc1`'s SQL

| Section | Objects | md5 |
|---|---|---|
| `public/table` | 55 | `24e13b6fb021c6c5bb9dbb3e69cc546b` |
| `public/column` | 510 | `07b9c4fb68f65a0d6dfc33d16a196ee0` |
| `public/constraint` | 282 | `b7c34a83592763717f36d62e3029fe66` |
| `public/index` | 159 | `9e29d0f95e3d49ac0d976b4e08c95d80` |
| `public/policy` | 129 | `d1d6c062c7a0faeb9ff761463d1dfa45` |
| `public/view` | 13 | `d5d1828a84e97f22c894860d73c13e21` |
| `public/function` | 102 | `ed4a39f12202f2aac6c7f289e1fd6eee` |
| `public/trigger` | 58 | `016428f6030daea99770ee6c16dfbe98` |
| `public/type` | 17 | `4cca3f0045ee055a409886d35038491c` |
| `public/grant_table` | 884 | `1d0aa915e954a2eed5e436be3beec18e` |
| `public/grant_routine` | 142 | `f7b0b34bfd8a08dec230c5781c5e3880` |
| `storage/*` | 233 | see JSON |
| `auth/*` | 441 | see JSON |
| **TOTAL** | **3025** | **`c6d5df0ba88239801e1f19d7556395c6`** |

**The `94361af27b8b094f0a458e202ec3e427` / 2913-object figure in this file's
previous revision is withdrawn.** It was measured before commit `0a59fc1`
changed the fingerprint SQL, and it is not reproducible: it read
`public/grant_table` out of `information_schema` (783 rows, against the 884 the
ACLs actually hold) and hashed function bodies without stripping comments. That
is precisely the defect `0a59fc1` was made to fix — "a fingerprint that was
reading prose and the connection string" — and the old number carries the defect.
Recording it as current alongside a post-fix CI artifact would have manufactured
differences in `public/function` and `public/grant_table` that have nothing to do
with any migration. `c6d5df0b…` supersedes it. Do not compare across the two.

## Replay result

`Migration replay` run **32037294875**, commit `0a59fc1` — i.e. *with*
`20260810150000` still present — completed **success**:
<https://github.com/nelsonsaenz1/cinch/actions/runs/32037294875>

All 93 files at that commit applied cleanly from zero, the local ledger row count
matched the file count, and `supabase test db` passed. Replayed total: 2902
objects, `b009c0623ce8377ed0b9e577ef95bd9f`.

### App-owned comparison, object by object

Platform-managed sections are separated out first and are **not** evidence of
anything: `auth/*` and `storage/*` track the running GoTrue and Storage versions,
which are properties of the hosted platform versus a local CLI stack. `auth/*`
agrees at 441 objects on both sides; `storage/*` is 233 in production against 205
in CI, which is a Storage version difference and nothing this repo owns. `public`
is the only schema these migrations own outright, and it is the only section
whose agreement means anything.

| `public` section | Production | Replay | Verdict |
|---|---|---|---|
| `table` | 55 / `24e13b6f…` | 55 / `24e13b6f…` | **identical** |
| `column` | 510 / `07b9c4fb…` | 510 / `07b9c4fb…` | **identical** |
| `constraint` | 282 / `b7c34a83…` | 282 / `b7c34a83…` | **identical** |
| `index` | 159 / `9e29d0f9…` | 159 / `9e29d0f9…` | **identical** |
| `policy` | 129 / `d1d6c062…` | 129 / `d1d6c062…` | **identical** |
| `view` | 13 / `d5d1828a…` | 13 / `d5d1828a…` | **identical** |
| `trigger` | 58 / `016428f6…` | 58 / `016428f6…` | **identical** |
| `type` | 17 / `4cca3f00…` | 17 / `4cca3f00…` | **identical** |
| `function` | 102 / `ed4a39f1…` | 102 / `1335cdf6…` | 1 of 102 differs — see below |
| `grant_table` | 884 / `1d0aa915…` | 814 / `00e9b754…` | 70 production-only grants |
| `grant_routine` | 142 / `f7b0b34b…` | 45 / `8497eda6…` | 97 production-only grants |

**`public/function` — exactly one function differs, and it is the predicted
one.** The comparison was made per function rather than per section: the same
normalized definition text the fingerprint hashes was md5'd for each of the 102
functions on both sides and the two key→hash maps were diffed. Zero functions
exist on only one side. The single differing body is
**`handle_new_subscription()`** — production's 14-day definition against the
replay's 21-day one, because run 32037294875 predates the removal. Every other
function, including all fifteen whose production copies differ from the committed
files only in stripped comments, agrees byte for byte. With the migration removed,
the replay builds `handle_new_subscription()` from
`20260805160000_membership_tiers.sql` — the 14-day definition production carries —
so this section is expected to become identical, and the fresh replay recorded
below is the test of that.

### The grant divergence — the one thing not resolved

`public/grant_table` and `public/grant_routine` differ, and they differ in one
direction only: **production is strictly wider than a clean replay. There are
zero grants that CI has and production does not.**

*Table grants* — 24 table/role pairs differ, 70 grants in total, and the 70
closes the 884 − 814 gap exactly:

- `anon` holds `SELECT`, `INSERT`, `UPDATE` and `DELETE` in production on 13
  tables where a clean replay grants none — `ai_calls`, `ai_usage_counters`,
  `chat_messages`, `chat_sessions`, `command_log`, `item_inquiries`,
  `outfit_calendar`, `outfit_reactions`, `style_feedback`, `style_profiles`,
  `tag_corrections`, `wardrobe_gaps`, `wishlist_items` (52 grants).
- `authenticated` holds 18 further grants across 11 tables, mostly `UPDATE` and
  `DELETE` on the same early tables plus all three write verbs on `subscriptions`.

*Routine grants* — 97 grants, closing 142 − 45:

- `service_role` holds `EXECUTE` on **all 102** public functions in production
  against **11** in a clean replay (91).
- `anon` holds `EXECUTE` on `apply_outfit_reaction`, `claim_command`,
  `current_ai_consent_version`, `log_outfit_wear` and `plan_outfit_tx` (5).
- `authenticated` holds `EXECUTE` on `log_outfit_wear` (1).

**Root cause, established rather than guessed.** Supabase's project-creation
default privileges granted `anon`/`authenticated`/`service_role` full rights on
every object created in `public`. `20260805213000_close_public_view_write_path.sql`
turned that off with `alter default privileges in schema public revoke all on
tables from anon, authenticated` — but `alter default privileges` only governs
objects created *after* it, so every table created before it keeps the ambient
grant to this day. The current Supabase CLI image does not set those defaults at
all, so a fresh replay never receives them in the first place. Production's
`pg_default_acl` still carries `public`/`postgres` functions as
`postgres=X/postgres | service_role=X/postgres`, which is exactly why all 102
functions have `service_role EXECUTE` there and only the 11 explicitly granted
ones do in CI.

This is not a new class of problem — it is the same one
`20260806100000_explicit_client_grants.sql` was written to close, and that file's
own header says so: *"CI's fresh replay exposed real drift: production's
`authenticated` grants on every app table came from Supabase's PROJECT-CREATION
default privileges, not from any migration."* That migration wrote down the
`authenticated`-table half and `20260806101000_service_role_grants.sql` wrote
down the `service_role`-table half. **The `anon`-table half and the whole routine
half were never written down, and they are what remains.**

**Risk.** RLS is enabled on all 13 tables `anon` can reach, so a wider `GRANT`
does not by itself expose a row — a policy is still required, and none grants
`anon` anything. The divergence is real and app-owned nonetheless: the access
matrix in production is not the access matrix this repo describes. One difference
runs the other way in effect: `log_outfit_wear` is executable by `authenticated`
in production but not in a database built from this repo, so a fresh environment
would refuse that RPC. It is superseded by `wear_outfit_tx` and retained only for
old clients, which is why nothing observably breaks.

**Why it is not resolved here.** Closing it means either revoking in production
or adding migrations that grant in CI. The first is a production write, which
this gate forbids outright; the second is a schema change, which is not
reconciliation. It is therefore carried forward with exact counts and exact
object lists — in this section and in `schema_comparison` in the JSON companion —
rather than being left as an unexplained hash mismatch. **It is the one open item
in Gate 3, and it is not caused by the trial migration and is not affected by
removing it.**

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
  matching production. As of the fresh replay recorded above this holds for
  every section **except `grant_table` and `grant_routine`**, whose 167
  production-only grants are enumerated in "The grant divergence" and are
  understood but unresolved. A repair should not be run while a `public/*`
  section is still unexplained; these two are explained but not closed, and
  proceeding is a judgement call that belongs to whoever runs the repair, not to
  this audit.
- Platform backup and ledger export taken, per the section above.
- ~~`20260810150000_trial_is_twenty_one_days` decided on its own terms.~~
  **Done: 14 days, file removed.** There is no trial precondition any more, and
  no trial-related repair of any kind.

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

**There is no command here for `20260810150000`, in either direction.** It has no
ledger row and no file. Marking it `applied` would assert a 21-day trial that
production does not have and that nobody wants; marking it `reverted` would write
a row for a version that never existed. Do neither.

After any repair: re-run `supabase migration list --linked`, confirm
`supabase db push --dry-run` is empty, and re-compute the schema fingerprint — a
history-only repair must leave it at `c6d5df0ba88239801e1f19d7556395c6` exactly.

## State at end of audit

Nothing was mutated. Ledger md5 re-measured at the end of the session is
`ab12eaad03bc5dcb85240bc231d238fd`, identical to the value recorded at the start
and to the value in the previous revision of this file. Ledger row count is 91,
also unchanged. The schema fingerprint is
`c6d5df0ba88239801e1f19d7556395c6`; it differs from the previous revision's
recorded value only because the measuring SQL was fixed in `0a59fc1`, not because
anything in production moved.
