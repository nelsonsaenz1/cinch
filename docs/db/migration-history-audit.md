# Migration history audit — 2026-08-12

> **SUPERSEDED IN PART, 17 August 2026.** This file is a dated record and its
> *measurements* stand. Two of its forward-looking instructions do not:
>
> * **Step 0 ("decide the trial") is closed.** The decision is **14 days**, which
>   is what production has always issued. `20260810150000_trial_is_twenty_one_days`
>   was an erroneous local migration that never reached production; it was removed
>   from `supabase/migrations` on 17 August 2026. Do not apply it, do not repair a
>   ledger row for it, and ignore its entry in Step 2 below.
> * The counts here (86 local / 84 remote / 45 matched) are from 12 August and have
>   since moved. The current reconciliation, with per-version dispositions and a
>   schema comparison, is
>   `docs/ops/supabase-migration-reconciliation-20260817.md`.

Read-only. Nothing was pushed, repaired, pulled, reset or executed against
production beyond `SELECT` against the catalogue. This file records what the
divergence actually is, what it is not, and the exact commands that would
resolve it — with their preconditions stated, because at least one of them is
not met today.

## Question

`supabase migration list --linked` shows 86 local files against 84 remote rows,
with only **45 versions matching on both sides**. Read at face value that is
41 unapplied migrations and 39 migrations applied out of the repo. It is not.

## Answer: it is a history-record problem, with two real drifts inside it

Remote rows carry the migration's **name** as well as its version, and the names
reconcile almost perfectly. Of the 41 local files with no matching remote
*version*, **38 have an exact remote *name* match** under a different timestamp:

| local | remote | name |
| --- | --- | --- |
| `20260807122000` | `20260806215954` | `ai_calls_survive_churn` |
| `20260808120000` | `20260807195454` | `ai_consent_v2` |
| `20260808110000` | `20260808000152` | `friend_closet_privacy_layer` |
| `20260808100000` | `20260808005513` | `ugc_text_filter` |
| … | … | (34 more, same shape) |
| `20260811175712` | `20260811175259` | `commerce_alert_release` |

That last row is the "one-timestamp divergence" noted in the previous packet.
It is the same migration, applied under a server-generated version.

**Cause.** These were applied through the Supabase MCP `apply_migration` tool
(or the dashboard), which stamps a *fresh* version at apply time from the
server clock and stores the caller's label as the name. The repo file keeps the
hand-chosen version it was authored with. Two ledgers, same SQL. Note the
remote versions run *behind* their local counterparts in several cases
(`20260806215954` for a file dated `20260807122000`) — a wall-clock stamp,
not a replay of the file's own ordering.

Two rows are cosmetic variants of the same thing:

- `20260806215954` and `20260808150750` stored the **whole filename** as the
  name (`20260807122000_ai_calls_survive_churn`), so they need the leading
  timestamp stripped before matching.
- local `20260810100300_push.sql` was applied as `push_tokens_and_prefs`
  (`20260810004436`) — a rename, not a gap. Verified: `push_tokens`,
  `notification_prefs` and `push_sends` all exist in production.

### The one duplicate

`ai_timeout_and_attempts` is recorded **twice** remotely — `20260808160000` and
`20260808184759` — from a single local file. It is `create or replace`
throughout, so the second apply was a no-op. No action; recorded so the row
count reconciles.

## Two migrations are genuinely unapplied, and both are verified drift

These are the only local files with no remote name match (besides the new one).
Both were checked against the live catalogue rather than inferred:

### 1. `20260810150000_trial_is_twenty_one_days` — NOT APPLIED → **FILE REMOVED, 17 Aug 2026**

Production `handle_new_subscription()` reads, and correctly reads:

```
values (new.id, 'free', now() + interval '14 days')
```

**14 days is the intended behaviour.** As measured on 12 August this file was the
one local migration whose SQL had never run; on 17 August it was resolved not by
applying it but by deleting it, because the repo — not production — was the thing
that was wrong. Every account created since 2026-08-10 has a 14-day trial, which
is what it should have.

The app draws no trial duration anywhere (correction 06), and the only "14-day"
mentions are code comments in `src/features/plan/use-packing-access.ts`, which
match production and needed no change. With the file gone, `db push` can no
longer change trial length as a side effect of shipping anything else — the
hazard this section was written to flag is closed at the source.

The migration's own docblock is explicit that it does **not** backfill: existing
`trial_ends_at` values are untouched, so applying it changes new signups only.

### 2. `20260810150100_event_roster_block_filter` — NOT APPLIED

Production policy `event_members: roster visible to participants`:

```
((SELECT auth.uid()) = user_id) OR can_see_event(event_id)
```

The repo's version adds `and not public.blocked_between((select auth.uid()), user_id)`.
`blocked_between()` exists in production; only the policy is behind.

**Consequence: a blocked person is still listed in a shared occasion's roster.**
This is the one drift with a user-visible safety meaning, and it sits directly
under the blocking promises the app already makes. It is also independent of
the event lock and could be applied on its own.

### 3. `20260812120000_close_comments_and_lock_board` — correctly unapplied

`event_is_open`, `assert_comment_thread_open` and `assert_vote_retractable` do
not exist in production, and `assert_vote_target()` is still the pre-D-2a
definition. The copy asserting these rules is already committed in the app
bundle, so this migration and any JS ship must land together.

## Static review of `20260812120000`

Read against the live catalogue, not just on its own terms.

**Verified sound**

- `assert_vote_target()` is recreated *whole*, which is a real risk — a later
  migration could have modified it and the rewrite would silently revert that.
  Checked: production's current definition is byte-identical to the migration's
  copy apart from the new `event_is_open` block. No revert.
- No conflicting `before delete` trigger exists on `event_outfit_votes`
  (production has only `event_outfit_votes_target` and
  `event_outfit_votes_require_terms`), so the new retraction trigger does not
  race one.
- `CL001`/`CL002` do not collide: no PostgreSQL-assigned error class begins with
  `C`, and both are legal five-character SQLSTATEs.
- Trigger ordering is harmless. Same-timing triggers fire alphabetically, so
  `event_comments_thread_open` runs *last* on `event_comments`. That matters
  only if an earlier trigger consumed state — `enforce_social_rate_limits()`
  counts existing rows and writes nothing, so a refused comment costs no budget.
  The only effect is which error a user sees first, and terms-then-closure is
  the right order anyway.

**Findings**

1. **Not idempotent (blocking a replay, not this apply).** Both `create trigger`
   statements are bare. A second run fails with `42710 duplicate_object`, and
   because it fails *after* the `create or replace function` statements the
   file is left half-applied. This repo has already been bitten by exactly this
   class of thing (the duplicate `ADD CONSTRAINT` that broke rebuilds), and the
   history above shows migrations here do get replayed. Fix before apply:

   ```sql
   drop trigger if exists event_comments_thread_open on public.event_comments;
   create trigger event_comments_thread_open ...

   drop trigger if exists event_outfit_votes_retractable on public.event_outfit_votes;
   create trigger event_outfit_votes_retractable ...
   ```

2. **The docblock's justification for `CL001` is wrong.** It claims the first
   character is "outside 0-4 and A-H"; `C` is inside A-H. The *conclusion* holds
   for the reason above, but the stated reason does not. Correct the comment
   rather than the code.

3. **`event_is_open(uuid)` is `SECURITY DEFINER` and granted to `authenticated`,
   so it answers for any event id, bypassing `events` RLS.** Deliberate per the
   docblock, and the leak is narrow — a caller must already hold the uuid, and
   an unknown id and an undated occasion both answer `true`, so existence is not
   cleanly distinguishable. Recorded as accepted, not as a defect.

4. `assert_vote_retractable()` reads `old.event_id`. Were it ever null,
   `event_is_open` returns `true` and the delete is allowed — fail-open. The
   column is set authoritatively on insert, so this cannot arise; the direction
   of failure is the safe one regardless.

## Recorded, not acted on: the Superwall publish mismatch

Unrelated to the migrations, but verified in the same read-only pass and logged
here because it is the same kind of "two ledgers disagree" problem.

The founder reports paywall 254200 as published. `get_paywall(254200)` on
2026-08-12 returns:

| field | value |
| --- | --- |
| `status` | `active` |
| `published_at` | **`null`** |
| `version` | **`0`** |
| `updated_at` | `2026-08-12T21:32:39.897Z` |
| `archived` | `false` |
| products | all four, correct identifiers |

`updated_at` is today, so the document **was** saved — but `published_at` is
still null and `version` is still 0, which is a document that has never had a
published revision cut. `status: active` is not the publish flag and is what
misreads as "published" in the dashboard.

**Nothing in Superwall was changed.** The consequence for the app is unchanged
from the D-5 packet: every placement resolves to a non-committing sheet, and
MB-09's `unavailable` branch is the reason its CTA is not a dead control. If the
dashboard shows this as published, the dashboard and the API disagree and it is
a question for Superwall support, not something to fix by writing to the API.

## Safe repair and apply plan

### Preconditions

| | status |
| --- | --- |
| Supabase CLI | ✅ present (2.114.0) |
| Project linkage `dugizuswuebrmcmvinmi`, authenticated | ✅ `migration list --linked` returns |
| Docker | ❌ **not installed** (not merely stopped — no `docker` on PATH) |

`supabase db test` and `supabase start` both require Docker, so
`supabase/tests/11_event_lock.sql` has never run and the migration has never
been parsed by a Postgres. **That is the gating precondition.**

### Step 0 — decide the trial — **CLOSED, 14 days, 17 August 2026**

`20260810150000` would have changed new-signup trial length from 14 to 21 days.
The decision was taken explicitly: **the trial is 14 days.** Production already
did exactly that, so nothing was applied and nothing was reversed. The migration
file was removed from the local chain. There is no step here any more.

### Step 1 — do NOT repair the history

`supabase migration repair` would rewrite the ledger for 38 migrations that are
already correctly applied under other versions. It buys cosmetic alignment of
`migration list` and risks marking something applied that is not. The two real
drifts are known and enumerated above; the ledger noise is harmless.

If alignment is wanted later, the honest form is one-way and explicit — mark the
38 name-matched local versions as applied *without* running them:

```bash
supabase migration repair --status applied 20260807122000 20260808100000 …
```

That is a 38-argument command against production history. It should be its own
packet with the full list reviewed, not a step inside a feature ship.

### Step 2 — apply, once Docker exists

```bash
supabase db test
```

Then apply the outstanding migrations **individually and in order**, so a
failure names itself. `db push` would apply them at once and would also
re-attempt the 38 name-matched files unless they are repaired first — which is
precisely why it is the wrong instrument here.

Preferred, one file at a time, each verified by read-back before the next:

1. `20260810150100_event_roster_block_filter` — the safety drift, independent
   of everything else.
2. ~~`20260810150000_trial_is_twenty_one_days`~~ — **removed 17 Aug 2026, never
   apply.** Step 0 answered *no*; the trial is 14 days and production already
   issues 14. There is no file left to apply.
3. `20260812120000_close_comments_and_lock_board` — after the idempotency fix
   in finding 1, and it ships with the JS that already asserts its rules.

As of the 17 August reconciliation both surviving items above were found
**already live in production** without ledger rows, so neither needs an apply
either — see `docs/ops/supabase-migration-reconciliation-20260817.md`.

### Step 3 — read back

```sql
select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and proname in ('event_is_open','assert_comment_thread_open','assert_vote_retractable');

select pg_get_expr(polqual, polrelid) from pg_policy
 where polname = 'event_members: roster visible to participants';
```

Expect three functions, and a policy predicate containing `blocked_between`.

### Never, for this work

`supabase db reset`, `db pull`, and `migration fetch` all rewrite local files or
the local database from the remote — against a repo whose local files are the
authority for 38 differently-versioned migrations, each would lose work.
