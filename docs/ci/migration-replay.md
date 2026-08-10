# Production could not be rebuilt

**Found and fixed 2026-08-10.** For roughly two days, a fresh rebuild of this
database stopped 35 migrations in and silently skipped the 22 after it. Branching
and point-in-time restore were both broken, and nothing would have surfaced it
except an actual disaster.

---

## The symptom

Creating a Supabase development branch left it in `MIGRATIONS_FAILED`. The branch
project itself was `ACTIVE_HEALTHY`, so it looked usable — it just had a database
missing every table added after 8 August: the whole push stack, wear diary,
boards, activity feed, data exports, invite links, support sends, the waitlist.

`main` had been sitting in `MIGRATIONS_FAILED` since **5 August**.

## The error

```
42710: constraint "ai_config_timeout_ms_sane" for relation "ai_config" already exists
```

## The cause

`ai_timeout_and_attempts` was recorded **twice** in production's migration
ledger, under two different versions:

| Version | Statements | What it is |
|---|---|---|
| `20260808160000` | 7 | the original, with its full comment header |
| `20260808184759` | 1 | the same DDL re-applied as one blob |

On the live database this was harmless: only one of the two ever actually
executed the DDL, and the other was recorded without running. **A replay does not
know that.** It runs both, in order, and the second one hits:

```sql
alter table public.ai_config
  add constraint ai_config_timeout_ms_sane
  check (timeout_ms between 5000 and 120000);
```

`ADD CONSTRAINT` is the one piece of DDL in this project with **no
`IF NOT EXISTS` form**. `add column`, `create index`, `create table` and
`insert … on conflict` all have one and are used with it throughout. A
constraint has to be guarded by hand.

The replay aborted there. Everything after it never ran.

## The fix

The stored statements for `20260808184759` were rewritten in production's ledger
so both `ADD CONSTRAINT`s are wrapped in a `pg_constraint` existence check. This
changes **no schema** — production already had all of it — only what a rebuild
executes.

The row was kept rather than deleted. It is a true record that the migration was
applied twice, and deleting history to fix a replay is how the next person loses
the ability to explain the one after it.

## Three migrations that only existed in production

Found in the same pass. These had been applied straight to the database and the
files were never written, so the repo could not describe production even before
the replay broke:

| Recovered as | Was |
|---|---|
| `20260808180000_ai_timeout_and_attempts.sql` | `20260808184759` |
| `20260808180100_ai_calls_attempts_nullable.sql` | `20260808185119` |
| `20260810120250_exports_bucket.sql` | `20260810124142` |

`exports_bucket` was the dangerous one. `build-export` writes there, so a rebuild
from the repo would have produced a database where the entire data-export path —
the GDPR access path the privacy policy promises — fails at the upload with no
bucket to write into.

Their SQL was read back out of `supabase_migrations.schema_migrations` and
committed verbatim, with guards added.

---

## The rule, and what enforces it

**Every `ALTER TABLE … ADD CONSTRAINT` must be safe to run twice.** Either

```sql
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'my_constraint') then
    alter table public.thing add constraint my_constraint check (...);
  end if;
end;
$$;
```

or precede it with `drop constraint if exists my_constraint`.

`tests/migration-replay.test.ts` enforces this across the whole migrations
directory and also asserts that migration versions are unique and sortable —
the repo-side equivalent of the duplicate that caused this.

### The grandfather list

Six migrations predate the rule and carry seventeen unguarded constraints. They
are listed explicitly in that test, and the list is **closed** — new migrations
cannot join it.

They were left alone deliberately. The replay that broke runs *production's
ledger*, not the repo files, so guarding these would not have prevented the
outage and does not protect against a repeat. They matter only for the other
rebuild path, `supabase db reset` against a local stack, where each is applied
exactly once and cannot collide. Shrinking the list is welcome; extending it is
not.

---

## Two paths, and they are not the same

This is the distinction that made the bug hard to see:

- **`supabase db reset` / a fresh `db push`** runs the **files** in
  `supabase/migrations/`.
- **Creating a branch, or a point-in-time restore** replays **production's
  ledger**, `supabase_migrations.schema_migrations`.

They can disagree, and here they did — in both directions. The repo was missing
three migrations production had, and production had a duplicate the repo did not.

## Still divergent, and known

Repo filenames and production versions **do not correspond**. The names match,
the timestamps do not:

| Repo | Production |
|---|---|
| `20260808190000_free_closet_is_ten.sql` | `20260809022927_free_closet_is_ten` |
| `20260810100300_push.sql` | `20260810004436_push_tokens_and_prefs` |

This is what applying migrations through the MCP `apply_migration` tool does — it
stamps its own timestamp rather than using the file's. It is not currently
breaking anything, because the ordering within each path is internally
consistent, but it means the two ledgers can only be compared by name.

**Prefer `supabase db push` over `apply_migration` for anything that has a file.**
Reach for `apply_migration` only for genuine one-offs, and write the file
immediately afterwards.

## How to verify a rebuild still works

Create a development branch and check it reaches a status past
`MIGRATIONS_FAILED`, then confirm the count:

```sql
select count(*) from supabase_migrations.schema_migrations;
```

It must equal production's. A branch that says `ACTIVE_HEALTHY` while
`MIGRATIONS_FAILED` is set is **not** a working rebuild — that field describes
the project, not the schema. Delete the branch afterwards; it bills hourly.
