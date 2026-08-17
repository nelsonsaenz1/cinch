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
| Repo HEAD | `3ade240` — fingerprint inputs byte-identical to `0a59fc1`, so all measurements remain comparable |
| Supabase CLI | 2.90.0 (latest at time of audit: 2.114.0) |
| Ledger rows (`supabase_migrations.schema_migrations`) | 91 |
| Local migration files | **92** (was 93; see "The trial is 14 days") |
| Ledger md5 (before, and unchanged after) | `ab12eaad03bc5dcb85240bc231d238fd` |
| Production schema fingerprint | `c6d5df0ba88239801e1f19d7556395c6` over 3025 objects |
| Operative replay | run [32038376626](https://github.com/nelsonsaenz1/cinch/actions/runs/32038376626) on `3ade240`, **success** — 2902 objects, `2828b51adf9e33c538c7644e29175c34` |
| Equivalence | `public` **identical on all nine non-grant sections**; 167 production-only grants remain — exact whole-schema equivalence **not** achieved |

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

### Production, measured this session

Measured twice: once when this file was first written, and **re-derived from
scratch after the operative replay landed** by running
`scripts/schema-objects.sql` verbatim through the same double wrapping
`scripts/schema-fingerprint.sh` applies, over MCP. Both passes returned every
figure below, TOTAL included, so nothing here is a value copied forward. The SQL
is byte-identical at `0a59fc1` and `3ade240`.

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

Two runs exist, and only the second is operative.

| Run | Commit | Files | Result | Replayed TOTAL |
|---|---|---|---|---|
| [32037294875](https://github.com/nelsonsaenz1/cinch/actions/runs/32037294875) | `0a59fc1` | 93 — *with* `20260810150000` | success | 2902 / `b009c0623ce8377ed0b9e577ef95bd9f` |
| [32038376626](https://github.com/nelsonsaenz1/cinch/actions/runs/32038376626) | `3ade240` | 92 — file removed | **success** | 2902 / `2828b51adf9e33c538c7644e29175c34` |

**Run 32038376626 is the fresh replay every comparison below is made against.**
All ten steps green: 92 files applied cleanly from zero with no manual
intervention, the local ledger's row count matched the file count at 92,
`supabase test db` passed, and the normalized schema export uploaded. The `CI`
run on the same commit,
[32038374142](https://github.com/nelsonsaenz1/cinch/actions/runs/32038374142),
is also green.

The replayed object count is 2902 on *both* runs while the TOTAL hash changes.
That is precisely the signature of removing a migration which only *redefined* an
existing function rather than creating one: `handle_new_subscription()` is still
built, exactly once, from `20260805160000_membership_tiers.sql`. Nothing was
added and nothing was dropped — one body changed. A count change here would have
meant the removal did more than it was supposed to.

### App-owned comparison, object by object

Platform-managed sections are separated out first and are **not** evidence of
anything. `auth/*` and `storage/*` track the running GoTrue and Storage versions,
which are properties of the hosted platform against a local CLI stack, and they
move in both directions:

| Schema | Production | Replay | Δ | Owned by |
|---|---|---|---|---|
| `public` | 2351 | 2184 | **+167** | this repo |
| `auth` | 441 | 437 | +4 | GoTrue — `auth/index` 91 vs 87 |
| `storage` | 233 | 281 | −48 | Storage — `storage/column` 67 vs 85, `constraint` 14 vs 19, `grant_table` 98 vs 118, `index` 17 vs 22 |

The CLI stack carries *more* storage objects than the hosted project and *fewer*
auth indexes. Neither is a migration in this repo and neither is actionable here;
they are listed so that "the totals differ" is never mistaken for "the schema
differs".

Every `auth/*` and `storage/*` section hash is **byte-identical between the two
replay runs**, which is the check that this platform delta is a property of the
CLI image rather than anything the migration removal touched. **Nine of the
fourteen** platform sections — `auth/column`, `auth/constraint`, `auth/function`,
`auth/trigger`, `auth/type`, `storage/function`, `storage/policy`,
`storage/trigger`, `storage/type` — match production exactly, hash included. The
delta is confined to five: `auth/index`, `storage/column`, `storage/constraint`,
`storage/grant_table` and `storage/index`.

`public` is the only schema these migrations own outright, and it is the only
section whose agreement means anything. Its whole +167 object difference is the
grants — 70 table plus 97 routine, itemised below. **Every non-grant `public`
object matches on both count and hash**, which is a stronger result than the
totals alone suggest.

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
| `function` | 102 / `ed4a39f1…` | 102 / `ed4a39f1…` | **identical** |
| `grant_table` | 884 / `1d0aa915…` | 814 / `00e9b754…` | 70 production-only grants |
| `grant_routine` | 142 / `f7b0b34b…` | 45 / `8497eda6…` | 97 production-only grants |

**`public/function` is now identical, and it became identical by the predicted
mechanism.** The previous revision of this file made a falsifiable prediction:
that removing `20260810150000` would leave the replay building
`handle_new_subscription()` from `20260805160000_membership_tiers.sql`, and that
`public/function` would therefore move from `1335cdf65f45094b6bf81de538f39f9f` to
production's `ed4a39f12202f2aac6c7f289e1fd6eee`. The fresh replay landed on
`ed4a39f12202f2aac6c7f289e1fd6eee` exactly.

The prediction was checked twice, before and after:

- *Before* — production's normalized `handle_new_subscription()` body was
  substituted into the old artifact's own 102-function set and re-hashed offline.
  That yielded `ed4a39f1…`, which is how the target was known in advance rather
  than recognised after the fact.
- *After* — diffing the two artifacts' `public/function` rows returns **exactly
  one changed key**, `handle_new_subscription()`, and no added or removed keys.
  The fresh artifact's body reads
  `values (new.id, 'free', now() + interval '14 days')`; the string `21 days` does
  not occur anywhere in the replayed `public/function` section.

Both directions agree, so `public/function` matching is a consequence of the
removal and not a coincidence. Every other function — including all fifteen whose
production copies differ from the committed files only in stripped comments —
already agreed byte for byte and still does. Zero functions exist on only one side.

### The grant divergence — the one thing not resolved

`public/grant_table` and `public/grant_routine` differ, and they differ in one
direction only: **production is strictly wider than a clean replay. There are
zero grants that CI has and production does not.**

*Table grants* — 24 table/role pairs differ, 70 grants in total, and the 70
closes the 884 − 814 gap exactly:

- `anon` holds `SELECT`, `INSERT`, `UPDATE` and `DELETE` in production on 13
  tables where a clean replay grants **none of those four verbs** — `ai_calls`,
  `ai_usage_counters`, `chat_messages`, `chat_sessions`, `command_log`,
  `item_inquiries`, `outfit_calendar`, `outfit_reactions`, `style_feedback`,
  `style_profiles`, `tag_corrections`, `wardrobe_gaps`, `wishlist_items`
  (4 × 13 = 52 grants).
- `authenticated` holds 18 further grants across 11 tables: `UPDATE` on nine
  (`ai_calls`, `ai_usage_counters`, `chat_messages`, `closet_likes`, `follows`,
  `outfit_reactions`, `style_feedback`, `subscriptions`, `tag_corrections`),
  `DELETE` on six (`ai_calls`, `ai_usage_counters`, `command_log`,
  `item_inquiries`, `subscriptions`, `tag_corrections`) and `INSERT` on three
  (`ai_calls`, `ai_usage_counters`, `subscriptions`) — 9 + 6 + 3 = 18, i.e. all
  three write verbs on `subscriptions` and mostly `UPDATE`/`DELETE` elsewhere.

52 + 18 = 70, and 13 + 11 = 24 table/role pairs. `service_role` table grants are
**544 on both sides and hash-identical**, because
`20260806101000_service_role_grants.sql` wrote that half down.

*A correction to how this was previously stated.* The fingerprint counts every
privilege type `aclexplode` returns, not just the four DML verbs, so "a clean
replay grants none" needed narrowing: on those same 13 tables the replay does
hold four `anon` privileges each — `TRUNCATE`, `REFERENCES`, `TRIGGER` and
`MAINTAIN`, 52 of them — and production holds all eight. The production-only set
is exactly the four DML verbs, which is what the 52 counts. This *strengthens*
the attribution rather than weakening it: a residue of precisely the non-DML
privileges is what an ambient default ACL leaves behind, and it is nothing any
migration in this repo would ever write. No hand-authored `grant` statement
grants `MAINTAIN`.

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

### Disposition of all 167, by origin and by security consequence

"Platform default ACL" is an origin claim and "harmless" is a security claim, and
they are not the same claim. Each of the 167 is given both below, with the query
result that establishes it. Nothing here is dismissed on the grounds of where it
came from.

| # | Grants | Origin | Security consequence |
|---|---|---|---|
| 1 | 91 routine `EXECUTE` to `service_role` | platform default ACL | none — confers nothing `service_role` lacks |
| 2 | 52 table DML to `anon`, 18 to `authenticated` | platform default ACL | reachable but contained by RLS |
| 3 | 5 routine `EXECUTE` to `anon`, 1 to `authenticated` | app-owned, never written down | contained — all six are `SECURITY INVOKER` |

**The evidence, measured against production this session.**

- **RLS is universal, not merely present on the 13.** All 55 `public` base tables
  have `relrowsecurity = true`; the count of tables without it is **zero**. On each
  of the 13 `anon`-reachable tables the number of policies whose `roles` include
  `anon` or `PUBLIC` is **zero** — checked per table, not in aggregate.
- **Neither client role can bypass RLS.** `pg_roles` gives
  `rolbypassrls = false` for both `anon` and `authenticated` (and both are
  `rolcanlogin = false`, reached only through `authenticator`). A wider `GRANT`
  therefore cannot return a row that a policy does not already permit.
- **No drift grant lands on a `SECURITY DEFINER` function.** This is the one shape
  that *would* defeat the point above, so it was checked directly rather than
  assumed. Production holds 75 `SECURITY DEFINER` functions out of 102, and
  exactly **two** of them are `anon`-executable: `invite_card` and
  `join_waitlist`. Both are granted by committed migrations
  (`20260810120100_invite_links.sql`, `20260810130000_waitlist.sql`), each after a
  `revoke all … from public`, and both appear in the replay's `public/grant_routine`
  section — which contains exactly two `anon` rows and no others. **They are
  present on both sides and are therefore not part of the 167 at all.** All six
  drift `EXECUTE` grants in row 3 are on functions with `prosecdef = false`
  (`apply_outfit_reaction`, `claim_command`, `current_ai_consent_version`,
  `log_outfit_wear`, `plan_outfit_tx`), so they run with the caller's own
  privileges and collapse back into the RLS-gated case in row 2.
- **Row 1 confers no capability.** `service_role` already has
  `rolbypassrls = true` and already holds all 544 `public` table grants — a figure
  **identical and hash-identical on both sides**. `EXECUTE` on 91 further functions
  adds nothing it cannot already do by touching the tables directly, and the role
  is reachable only with the secret service key, never with the anon key.

**What this does and does not license.** It is not a clean bill of health: the
access matrix live in production is wider than the one this repo describes, in 167
places, and that gap is unwritten-down by definition. What the evidence rules out
is the specific failure mode that would make it urgent — there is no path by which
the drift exposes a row or escalates a privilege, because every drift grant is
either gated by an RLS policy that admits nobody or held by a role that already
had the capability. The correct severity is **"real, contained, and owed a
migration"**, not "harmless" and not "exposure".

One difference runs the other way in effect: `log_outfit_wear` is executable by
`authenticated` in production and has **no grant to any role** in a database built
from this repo, so a fresh environment would refuse that RPC. It is superseded by
`wear_outfit_tx` and retained only for old clients, which is why nothing
observably breaks — but a rebuilt-from-repo environment is not behaviourally
identical to production, and that is worth knowing before anyone treats the two as
interchangeable.

**Why it is not resolved here.** Closing it means either revoking in production
or adding migrations that grant in CI. The first is a production write, which
this gate forbids outright; the second is a schema change, which is not
reconciliation. It is therefore carried forward with exact counts and exact
object lists — in this section and in `schema_comparison` in the JSON companion —
rather than being left as an unexplained hash mismatch. **It is the one open item
in Gate 3, and it is not caused by the trial migration and is not affected by
removing it.**

## Exact equivalence verdict

Stated plainly, because "equivalent" has been used loosely elsewhere and the
answer is not a single word:

- **Structure and behaviour — equivalent, exactly.** All nine non-grant `public`
  sections match production on both object count and md5: `table`, `column`,
  `constraint`, `index`, `policy`, `view`, `function`, `trigger`, `type`. That is
  1325 of 1325 objects agreeing hash-for-hash, `handle_new_subscription()`
  included. Every table, column, constraint, index, RLS policy, view, function
  body, trigger and enum that this repo owns is now byte-identical between a
  from-zero replay and production.
- **Privileges — not equivalent.** `public/grant_table` (884 vs 814) and
  `public/grant_routine` (142 vs 45) differ by 167 production-only grants,
  dispositioned above. Production is strictly wider; **there are zero grants CI
  has that production does not**.
- **Therefore the TOTAL fingerprints do not and cannot match** — 3025 /
  `c6d5df0ba88239801e1f19d7556395c6` against 2902 /
  `2828b51adf9e33c538c7644e29175c34`. The 123-object gap decomposes exactly, with
  no remainder:

  | Schema | Production | Replay | Δ | Cause |
  |---|---|---|---|---|
  | `public` | 2351 | 2184 | **+167** | the grant divergence, this repo's |
  | `auth` | 441 | 437 | +4 | GoTrue version, platform's |
  | `storage` | 233 | 281 | **−48** | Storage version, platform's |
  | **TOTAL** | **3025** | **2902** | **+123** | 167 + 4 − 48 = 123 |

  Two of the three rows are the platform's and only the first is actionable here.
  A TOTAL match is not a meaningful target for this comparison at all: it would
  require the CI stack to run the same GoTrue and Storage builds as the hosted
  project, which is not something a migration can arrange.

**So: exact equivalence is achieved for everything except grants, and is *not*
achieved overall.** The 167 grants do prevent exact whole-schema equivalence, and
that is stated here rather than dissolved into a per-section table where the
reader has to notice it. No ledger repair is proposed on the strength of this
result — see the preconditions below, one of which this fails.

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
  matching production. As of run **32038376626** on `3ade240` — green, and the
  fresh replay recorded above — this holds for every section **except
  `grant_table` and `grant_routine`**, whose 167 production-only grants are
  enumerated in "The grant divergence" and are understood but unresolved.
  **This precondition is therefore not met, and no repair is proposed for
  execution on the strength of this audit.** A repair should not be run while a
  `public/*` section is still unexplained; these two are explained but not
  closed, and proceeding is a judgement call that belongs to whoever runs the
  repair, not to
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

**Nothing was mutated.** Every production statement issued during this audit was a
`SELECT`; no `apply_migration`, no `migration repair`, no DDL, no `pg_default_acl`
or ACL change.

Re-measured against production after the fresh replay landed:

| Control | Value | Against |
|---|---|---|
| Ledger row count | **91** | unchanged, start and end of session |
| Ledger md5 | **`ab12eaad03bc5dcb85240bc231d238fd`** | unchanged, start and end of session |
| Schema fingerprint TOTAL | **3025 / `c6d5df0ba88239801e1f19d7556395c6`** | unchanged |
| `20260810150000` ledger rows | **0** | the removed file never had one |

The ledger hash was recomputed with the exact query in "Ledger control hash"
above, and the schema fingerprint by running `scripts/schema-objects.sql`
verbatim through the same double wrapping `scripts/schema-fingerprint.sh` applies
— so the 3025 / `c6d5df0b…` figure is an independent re-derivation over MCP, not a
value copied forward from the previous revision. Both fingerprint inputs remain
byte-identical to `0a59fc1`, which is the precondition that makes the production
figures and the CI artifact comparable at all.

The fingerprint differs from the revision *before* `0a59fc1` only because the
measuring SQL was fixed there, not because anything in production moved.

---

## ADDENDUM — the grant divergence is closed (17 August, later the same day)

The open item above is resolved. `20260819000000_normalise_client_grants.sql` was
written, replayed, tested and deployed.

**Evidence chain.** Migration replay from zero on `052e11d`:
[32043745171](https://github.com/nelsonsaenz1/cinch/actions/runs/32043745171) — green.
CI on the same commit: [32043695556](https://github.com/nelsonsaenz1/cinch/actions/runs/32043695556)
— green after re-running a `functions` job that had failed downloading
`denoland/setup-deno` with HTTP 429. That failure was infrastructure, not the
migration; the `database` job that replays migrations and runs pgTAP was never
the failing one.

**Production, measured after deployment:**

| | before | after |
|---|---|---|
| `anon` DML grants on public tables | 52 | **0** |
| `anon` table privileges, all types | 104 | **0** |
| `anon` EXECUTE | 7 | **2 — `invite_card`, `join_waitlist`** |
| `service_role` EXECUTE | 102 ambient | **102 explicit** |
| `authenticated` EXECUTE on `log_outfit_wear` | ambient | **1, written down** |
| public tables without RLS | 0 | **0** |
| ledger rows | 91 | 92 |

`anon` now holds **zero** privileges of any type on those 13 tables, which is
where a clean replay also lands — the two converge at zero rather than meeting in
the middle, which is why the migration revokes `all` and not the four DML verbs.

**What was kept, and why.** `invite_card` and `join_waitlist` were never part of
the 167 and are untouched. `log_outfit_wear` keeps its `authenticated` EXECUTE
because binaries in the field still call it while a database built from this repo
granted it to no role at all — that asymmetry was the actual defect. The 18
ambient `authenticated` verbs are written down rather than revoked, because the
RLS policies already admit those rows and revoking would leave the policies dead
letter.

**Still open: the ledger history repair (item I).** Not executed. Its
precondition is a recoverable backup, and the ledger export remains the binding
constraint: the repair deletes 42 rows and takes 374 006 bytes of applied SQL in
`statements` with them, and that column exists nowhere else. `pg_dump` needs a
direct Postgres connection, which is unavailable on this Mac and which the
directive forbids retrying. The Supabase MCP *can* read the ledger — that is how
the row count and byte figure above were measured — but streaming 374 KB through
an agent context is not a backup either.

**So the repair needs one human action first:** a PITR restore point or backup
from the Supabase dashboard (Database → Backups), taken immediately before the
repair window. The repair commands themselves are unchanged and are listed in
"Proposed repairs" above. Nothing about the grant normalisation deployed here
depends on that repair, and the repair is bookkeeping only — `migration repair`
writes the tracking table and never runs or reverts SQL.
