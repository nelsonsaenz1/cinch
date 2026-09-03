# A28 / A15 — `clothes_import_failed reason=row_write_failed`

Root-cause audit, 2026-09-02. Read-only: nothing under `src/`, `supabase/`, `tests/` or
`scripts/` was modified.

Sources: `docs/marketing/cmo-briefings/2026-09-02.md` §8.3, `LEDGER.md` rows A15/A16/A28,
the code paths cited inline, and a direct read of the PostHog event stream for the two
affected persons (project 544348).

---

## 0. Headline — §8.3's central finding does not survive contact with the data

§8.3 concludes: *"one generic error string, at least two distinct causes"*, on the
strength of

```
149268b9 (Chicago) → state_before_failure = 'active_full'   (all 46)
ea34762e (Ludlow)  → state_before_failure =  NULL           (all 20)
```

**That discriminator is invalid, and the two clusters have the same cause.**

`closet_capacity_state` has exactly one emitter in the codebase —
`src/app/(tabs)/closet.tsx:1152`, inside `CapacityBandRow`, gated on `useTabVisited()`
(`closet.tsx:1148-1153`). It fires only when the user is **looking at the Closet tab**,
and only once per distinct state per mount (`reported.current === state`, `closet.tsx:1150`).
A person who imports from the capture screen and never opens the Closet tab emits nothing.
"No capacity event before the failure" is therefore not evidence about the failure; it is
evidence about which tab the user was on.

The Ludlow user's own stream settles it. His full capacity history:

| time (Z) | event | value |
|---|---|---|
| 16:34:25.151 | `clothes_import_failed` | `row_write_failed`, attempts 3 |
| 16:34:28.255 | `clothes_import_failed` | `row_write_failed`, attempts 3 (his last) |
| 16:34:45.987 | `closet_viewed` + `closet_capacity_state` | **`active_full`** ← his first ever |
| 16:35:44.332 | `item_deleted` | — |
| 16:35:44.486 | `closet_capacity_state` | **`room`** |
| 16:36:20.900 | `clothes_import_completed` | `path: queue` — the import now succeeds |
| 16:36:21.008 | `closet_capacity_state` | **`active_full`** again |
| 16:36:48.491 | `closet_plans_door_opened` | user tap |
| 16:36:49.075 | `paywall_presented` | `add_garment_over_limit` |

He was at the cap the whole time; he had simply never opened the Closet tab, so nothing
had ever emitted the state. He then ran the experiment himself: **delete one → `room` →
the very next import succeeds → `active_full` again.** That is the
`items_enforce_limit` trigger, demonstrated end to end, on the cluster §8.3 calls
"unexplained".

**Both clusters are the free closet cap.** A28 is not "the larger half of A15" — it is
the whole of it. Population check: exactly two people have ever emitted
`reason=row_write_failed`, 66 events, no third cause anywhere in 60 days.

| person | build | version | events |
|---|---|---|---|
| `149268b9` | 47 | 1.2.3 | 46 |
| `ea34762e` | 46 | 1.2.2 | 20 |

A15's instrumentation is still worth having — see §3.4 for a defect in it — but the
defect it was built to diagnose is already diagnosed, and the fix should not wait on a
code the next failure would carry.

---

## 1. The batch-import path, end to end

### 1.1 Entry and selection

- `src/app/add-clothes.tsx` is a chooser only. It reads `useCapacity()` (`:17`, `:137`)
  for display — it hides The Ten at the cap (`:425`) and draws a "shelf full" notice
  (`:616`) — and explicitly **gates nothing** (`:135-137`: *"Read only. The chooser never
  gates on this"*).
- `src/app/find-photo.tsx` is the catalogue/voice route, not the photo batch. It goes
  through `garment-search` and has its own preflight (§4.3).
- `src/app/capture.tsx` is the batch path. `useCapture()` (`capture.tsx:306`) supplies
  `pickFromLibrary` / `takePhoto` / `commit`.
- `src/features/ingest/use-capture.ts:41` — `SELECTION_LIMIT = 60`. The picker allows up
  to 60 assets in one pass (`:125`). `clothes_import_selected {source, count}` is emitted
  at `:136` (library) and `:176` (camera).

### 1.2 The only pre-check — and its exact defect

`capture.tsx:488-499`:

```ts
const settleCapture = useCallback(
  (assets: CapturedAsset[], local: boolean) => {
    if (assets.length === 0) return;
    if (capacity.full) {                    // ← :491
      setHeldCapture({ assets, local });
      setClosetFullVisible(true);
      return;
    }
    commit(assets, { local });              // ← :496, all N of them
  },
  [capacity.full, commit],
);
```

**The gate is a boolean, not a count.** `capacity.full` is
`data !== undefined && used >= limit` (`src/features/billing/use-capacity.ts:100`). It
answers *"is there room for one more?"*, and the answer is then used to authorise **N**.
`capacity.remaining` exists (`use-capacity.ts:95`) and is never consulted here.

So the guard is correct when the closet is *already* full and wrong when the closet fills
*during* the batch. The Chicago user's stream shows both behaviours in the same session:

| time (Z) | event | detail |
|---|---|---|
| 22:56:25.248 | `clothes_import_selected` | **count 27**, library — closet empty, `full=false` → all 27 committed |
| 22:56:29–34.7 | `clothes_import_completed` ×10 | all `path: 'local'` |
| 22:56:33.151 | `clothes_import_selected` | **count 29**, library — still `full=false` → all 29 committed |
| 22:56:34.279 | `closet_capacity_state` | `room` |
| 22:56:34.818 | `closet_capacity_state` | **`active_full`** — the 10th item landed |
| 22:56:36.584 → 22:57:20.027 | `clothes_import_failed` ×46 | `stage: cutout`, `reason: row_write_failed`, `attempts: 3`, `retryable: true` |
| 22:57:29.434 | `closet_plans_door_opened` | **her tap** |
| 22:57:30.054 | `paywall_presented` | `add_garment_over_limit` |
| 22:58:35.181 | `clothes_import_selected` | **count 30** — and **zero failures follow** |

27 + 29 = 56 picked, 10 landed, 46 refused. The third pick of 30 produced no failures at
all, because by then `capacity.full` was true and `settleCapture` held the batch behind
`ClosetFullSheet` (`capture.tsx:1470-1500`). The existing guard works; it just cannot see
past the first photo of a batch.

Her ten completions all carry `path: 'local'`, so she had declined AI consent and ran
through `processLocalJob` (`upload-queue.ts:723-764`) — throw site `:749`, not `:802`.
Local mode is not a mitigation: it inserts into the same table and hits the same trigger.

### 1.3 The insert, the trigger, the throw

`upload-queue.ts:766` `processJob` walks: `preparing` (`:780`) → `cutout` (`:788`) →
**insert** (`:796-805`) → `uploading` (`:812`) → record-upload update (`:835-850`) →
`driveTagging` (`:866`).

The four throw sites (ledger A15 quotes their pre-`7b64b93` line numbers `:706 :758 :806
:1221`; current lines below):

| line | statement | message |
|---|---|---|
| `upload-queue.ts:749` | local-mode `items` insert | ``Could not create item [${error?.code ?? 'no_code'}]: ${error?.message}`` |
| `upload-queue.ts:802` | queue-mode `items` insert | same |
| `upload-queue.ts:850` | post-upload `items` update | ``Could not record upload [${updateError.code ?? 'no_code'}]: …`` |
| `upload-queue.ts:1246` | backfill `items` update | same |

The enforcing trigger, `supabase/migrations/20260805160000_membership_tiers.sql:283-285`:

```sql
create trigger items_enforce_limit
  before insert on items
  for each row execute function enforce_item_limit();
```

Its current body is `supabase/migrations/20260808190100_active_and_stored_limits.sql:52-91`:

```sql
select count(*) filter (where not is_archived), count(*)
  into v_active, v_total
  from public.items
 where user_id = new.user_id;                                   -- :69-72

if not new.is_archived and v_active >= v_active_limit then
  raise exception 'closet_limit_reached: % of % garments', v_active, v_active_limit
    using errcode = 'check_violation', hint = '…';              -- :77-81
end if;

if v_total >= v_total_limit then
  raise exception 'storage_limit_reached: % of % stored', v_total, v_total_limit
    using errcode = 'check_violation', hint = '…';              -- :83-87
end if;
```

Limits: free 10 active / 30 total (`20260808190000_free_closet_is_ten.sql:22-33`,
`20260808190100:30-41`). `errcode = 'check_violation'` → **SQLSTATE 23514**, surfaced by
PostgREST as `error.code = '23514'`.

The catch is `drainQueue`'s (`upload-queue.ts:905-935`) and it is the reason one refusal
is not one event:

```ts
const attempts = next.attempts + 1;
const exhausted = attempts >= MAX_ATTEMPTS;        // :909, MAX_ATTEMPTS = 3 (:63)
const diedAt = …jobs.find(j => j.id === next.id)?.stage ?? 'preparing';   // :917-918
update(next.id, { stage: exhausted ? 'failed' : 'queued', error: message, … }); // :919-926
if (exhausted) trackImportFailed({ stage: diedAt, error: message, retryable: true, attempts });
```

`trackImportFailed` (`:210-224`) calls `recordImportFailure()` (`:216`) and then
`track('clothes_import_failed', …)` with `reason` from `analyticsFailureReason` (`:155-174`;
the row-write branch is `:170`) and `code` from `analyticsFailureCode` (`:193-198`).

### 1.4 What one refused batch of N photos costs

Per refused photo the drain loop runs the job **three times**. The `itemId` is never set
(the insert failed), so each retry re-does `prepareForUpload` + `prepareThumbnail`
(`:781-782`) + a full native Vision `runCutout` pass (`:789`) before hitting the same
trigger. Only the third emits an event.

> **N photos into a full closet ⇒ N terminal `clothes_import_failed` events, 3N item
> inserts, 3N Vision passes, 3N `cutout_result` events, one banner, and no stopping
> condition.**

The event stream confirms the arithmetic exactly:

- Chicago: `cutout_result` = **148** = 46 refused × 3 + 10 completed × 1. Exact.
- Ludlow: `cutout_result` = **73** ≈ 20 × 3 + 12 completed + 1 (one job that succeeded on
  a retry, contributing two passes).

**Why the queue does not stop after the first refusal.** There is no mechanism by which it
could:

1. The catch (`:906`) is per-job and has no view of the batch. It classifies nothing —
   `classifyDenial` (`use-gate.ts:53-57`), which already recognises `closet_limit_reached`
   by message, is never called from `upload-queue.ts`.
2. `drainQueue`'s loop (`:886-939`) is `for(;;) { find first 'queued' … }` and exits only
   when nothing is queued and `running === 0` (`:890-891`). A re-queued failure is a
   queued job, so it is picked up again.
3. There is an `accountWide` concept — `TagOutcome.accountWide` (`:253`) — used by the
   sweep to abandon a batch on an account-level refusal (`:1130-1133`). It exists **only on
   the tagging path**. The row-write path has no equivalent.
4. `retryable: true` is written unconditionally on exhaustion (`:925`), so the UI offers a
   Retry button for a refusal that is guaranteed to fail, and `retryFailedJobs()`
   (`:1351-1358`) will walk all 46 of them.

---

## 2. What the client knows before the batch

### 2.1 The counts agree; the timing does not

`useCapacity` (`use-capacity.ts:58-105`) issues two `head` counts — all rows, and archived
rows — and derives `active = stored - archived` (`:71-85`). That is definitionally
**identical** to the trigger's `count(*) filter (where not is_archived)` /
`count(*)` (`20260808190100:69-72`): both include `pending_upload`, `pending_tag`,
`needs_review` and `verified` rows, and there is no hidden-item concept anywhere in the
schema (`20260803154431_initial_schema.sql:71-113`). RLS scopes the client to its own rows
(`:127-138`), matching `where user_id = new.user_id`.

So the active-vs-stored trap the brief asks about **is not present**. The mismatches that
are real:

1. **Staleness.** `staleTime: 60 * 1000` (`use-capacity.ts:69`), refreshed only by
   `invalidateAfterItemSettled()` (`upload-queue.ts:27-38`), which runs on *success*
   (`:452-453`, `:762`). During a batch the cached count trails the server by however many
   items have landed since the last render.
2. **The batch itself is invisible.** Nothing anywhere subtracts the N-1 other jobs the
   same `commit()` just enqueued. This is the actual A28 defect, and it is a design gap,
   not a drift.
3. **Plan divergence.** The trigger calls `effective_plan()`
   (`20260805160000:95-112`), which reads `subscriptions` alone. The client's `usePlan()`
   folds in `useSdkPlan()` — StoreKit via Superwall — which *"can only ever RAISE the
   plan"* (`use-plan.ts:90-92`). A purchaser whose Superwall→`subscriptions` webhook has
   not landed sees `limit = 150` client-side while the trigger enforces 10. Given the known
   webhook gap this is a live class of mismatch, though not what happened to these two.
4. `PLANS` (`plans.ts:114-152`) is otherwise a faithful mirror: 10/30, 150/450, 1000/3000
   against `item_limit_for_plan` and `item_total_limit_for_plan`. No drift.

### 2.2 Pre-checks that exist

| site | check | verdict |
|---|---|---|
| `capture.tsx:491` | `capacity.full` before `commit()` | Boolean where a count is needed — **the A28 bug** |
| `capture.tsx:740-749` | re-check on return from `/wall-swap` | Correct, and correctly documented (`:730-737`) |
| `add-clothes.tsx:425`, `:616` | display only | Explicitly not a gate (`:135-137`) |
| `import_capacity()` RPC | counts + limits for `auth.uid()` | Exists, granted to `authenticated`, **unused by the photo path** |

### 2.3 The RPC that already does this

`supabase/migrations/20260813194202_catalogue_imports.sql:126-177` defines
`public.import_capacity()` returning `(active, active_limit, total, total_limit)`,
`security definer`, no parameter, `grant execute … to authenticated` (`:174`). Its own
comment: *"A PREFLIGHT for the batch catalogue import, never an authority"*. The photo
batch path never calls it.

---

## 3. The Ludlow cluster — candidate causes, ranked

The evidence in §0 already settles this cluster as the closet cap. The enumeration below
is kept because it is the discrimination table the next failure will need, and because two
of the entries turn out to be indistinguishable from the answer by SQLSTATE alone.

| # | candidate | SQLSTATE / code | would emit a capacity event? | discriminator in the stream | verdict |
|---|---|---|---|---|---|
| 1 | **`closet_limit_reached`** (active cap) | `23514` | Only if the Closet tab is visited | `item_deleted` → `room` → next import succeeds | **Confirmed.** Ludlow ran exactly this sequence at 16:35:44–16:36:21 |
| 2 | `storage_limit_reached` (total cap) | **`23514` — identical** | `total_full` if visited | Only `sqlerrm` text separates it | Not this user (30-row ceiling; he had ~12–13 rows), but **indistinguishable by `code`** |
| 3 | Session expiry / refresh race | `PGRST301` | No | Would appear in bursts across many events, not garment-shaped | Ruled out: 20 failures across 13.5 h, each 1.5–2.2 s after its own `clothes_import_selected`, interleaved with 12 successes |
| 4 | RLS `with check` denial | `42501` | No | `getUserId()` (`supabase.ts:291-295`) succeeded, and the payload's `user_id` is that same `sub` (`:798`) | Ruled out; a mismatch is not constructible on this path |
| 5 | Network failure mapped to the same string | `''` → renders `[no_code]` | No | Would not correlate with capacity state | Ruled out by the delete→succeed→refill sequence |
| 6 | NOT NULL violation | `23502` | No | Only `user_id` is NOT NULL without a default (`initial_schema:73`) and it is always supplied | Impossible on this payload |
| 7 | CHECK violation on a column | `23514` | No | `formality_score`/`warmth_score`/`colour_source`/`intake_method` are never in the insert payload (`:740-745`, `:798`) | Impossible on this payload — **but shares 23514 with #1 and #2** |
| 8 | Unique violation | `23505` | No | `id` is `gen_random_uuid()`; `catalog_external_id` is null so the partial index (`20260813194202:78-80`) excludes it | Impossible on this payload |
| 9 | FK to a missing profile row | `23503` | No | `items.user_id` references `auth.users`, not `profiles` (`initial_schema:73`) | Impossible while signed in |
| 10 | Storage succeeded, row write failed | whatever `:850` caught | No | `stage` would be `uploading`, not `cutout` | Ruled out — all 66 events say `stage: cutout` |
| 11 | A `pending_tag` state cap | — | — | No such trigger exists; only `items_enforce_limit`, `items_enforce_limit_on_restore` and `items_set_updated_at` are defined on `items` | **Does not exist** |
| 12 | Not signed in | — | No | Would classify as `not_signed_in` (`:171`), a different `reason` | N/A |

Rows 1, 2 and 7 all produce `23514`. **The A15 `code` property cannot, on its own,
distinguish the closet cap from the storage cap from a column check.** The message text is
the only separator — which is exactly what `enforce_item_limit`'s own consumers already do:
`commit_intake_session` matches `sqlerrm like 'closet_limit_reached%'` inside
`exception when check_violation`
(`20260811022953_intake_ceiling_resolve.sql:93-96`), and `classifyDenial` matches
`message.includes('closet_limit_reached')` (`use-gate.ts:57`).

### 3.4 Two instrumentation defects found in passing

**(a) `stage` is wrong for every row-write failure.** All 66 production events carry
`stage: 'cutout'`. `diedAt` reads the job's stage from the store (`:917-918`), and the
insert step at `:796-805` never writes a stage of its own — the last one set was `'cutout'`
at `:788`. So the one property that exists to say *where* the import died points at the
Vision pass for a failure that is entirely a database refusal. Anyone reading the funnel
would go looking at the cutout code. (This is plausibly part of why 09-01 went to
"theorising about runtimes".)

**(b) `no_code` is overloaded.** postgrest-js returns `code: ''` for a transport failure,
so `` `[${'' ?? 'no_code'}]` `` renders `[]`, the extractor's
`/\[([0-9A-Za-z_]{1,12})\]/` (`:196`) finds no match, and it returns `'no_code'` — the same
value a genuinely absent code produces. A network failure and a missing code are
indistinguishable in the event.

---

## 4. Assessing A16

`src/features/billing/import-failure-grace.ts` suppresses `add_garment_over_limit` for ten
minutes after any terminal import failure (`:32`, `:41-43`, `:52-54`), consulted at
`use-gate.ts:485-488`, which emits `paywall_eligible {eligible: false, reason:
'import_failure_grace'}` and returns `'unavailable'`.

### 4.1 The premise is factually wrong

A16's docblock (`import-failure-grace.ts:5-8`) says *"two minutes after the last failure
**the app showed him** `add_garment_over_limit` — a paywall, in reply to a defect."*

The stream says otherwise. Both paywalls in the whole incident were preceded by
`closet_plans_door_opened`, ~0.6 s earlier, in both cases:

- Ludlow: door 16:36:48.491 → paywall 16:36:49.075
- Chicago: door 22:57:29.434 → paywall 22:57:30.054

That event has one emitter: `closet.tsx:1176`, inside `CapacityBandRow`'s `onDoor`
callback, immediately before `gate.present(Placement.AddGarmentOverLimit)` (`:1177`). It
fires **only when a human taps "See plans" on the capacity band**. The app did not ask
either of them for money. They went to the Closet tab, saw a full-closet band, and tapped
the door on it.

So A16 as shipped suppresses a paywall the user explicitly requested. `present()` returns
`'unavailable'` and the tap does nothing visible — a dead control on the one screen where
the user has just asked the question the placement exists to answer.

### 4.2 When the grace is right and when it is wrong

**Right:** an *unsolicited* `add_garment_over_limit` presentation within minutes of a
failure whose cause is not capacity — a network drop, an expired session, a storage
outage. There the ask is genuinely a request for money in reply to a defect, and A16's
"cost of being wrong is a delayed ask" reasoning holds.

**Wrong, in two distinct ways:**

1. **When the user opened the door.** A tap on `closet_plans_door_opened` or on the
   `ClosetFullSheet`'s "See plans" (`capture.tsx:1489`) is a request, not an ask. Grace
   must not swallow it — an unsuppressible user-initiated route is the correct rule.
2. **When the failure *is* the cap.** The closet cap is not a defect; it is the free-tier
   boundary, and the wall with its count is the honest thing to show — once. A16's flat
   rule ("it does not ask WHY", `:13-15`) makes the capacity case *worse*: 46 identical
   "couldn't add your clothes" errors, and then a suppressed explanation. The user is left
   with a broken app instead of a boundary. Per the founder's standing warning, a fix
   grounded in one user's data is a guess — and A16 was grounded in the Ludlow user, whose
   failure mode is now known to be the same capacity refusal, not the network fault A16
   assumed.

### 4.3 The minimal rule correct for both

```
grace applies  ⟺  the failure was NOT a capacity refusal
                  AND the presentation was not user-initiated

capacity refusal ⟹  stop the batch at the first refusal,
                    show the wall once, with the count,
                    keep the remaining photos queued
```

Concretely, `recordImportFailure()` takes the classified cause and refuses to open the
window for the capacity code; and `present()`'s suppression is bypassed for presentations
originating in an explicit tap. Note that "the capacity code" must mean *the
`closet_limit_reached` / `storage_limit_reached` sentinel in the message*, not SQLSTATE
`23514`, for the reason in §3.

**What to keep queued, and where it already persists.** Nothing needs new storage. Jobs
live in `queue-store.ts` under `cinch.upload-queue.v1` (`:111`), written synchronously to
`expo-sqlite/kv-store` on every mutation (`persist`, `:140-150`), keeping everything that
is not `done` (`:144`). `hydrate` (`:156-183`) restores non-terminal jobs to `queued`
(`:180`). So a job parked as "waiting for room" survives a kill and a cold start for free —
provided it is **not** marked `stage: 'failed'`, because `clearSettled()` (`:236-240`),
which `useCapture.commit` calls on the next sitting (`use-capture.ts:112`, `:98-102`),
drops `failed` jobs. Today's 46 refusals are marked `failed` and are therefore swept away
on her next visit; the photographs themselves are untouched in the camera roll, but the
batch is gone. A new terminal-ish stage (`held`) or a `heldForCapacity` flag excluded from
`clearSettled` is what preserves them.

---

## 5. Proposed fix for A28

### 5.1 Shape

The catalogue import path already solved this problem, and the fix should be the same
shape rather than a new one. `supabase/functions/garment-search/import-batch.ts:73-128`:
`planCatalogueBatch(rows, held, room)` is a pure function; `refuse(requested, room)`
(`:108-128`) compares **`room.active + requested > room.active_limit`** and returns a typed
`BatchRefusal` carrying `requested`, `active` and `activeLimit`. A null capacity read does
**not** refuse (`:109`) — the trigger stays the authority. `tests/catalog-import-batch.test.ts`
pins it on Node (see `:99`, `:118`, `:130`, `:137`, `:148`).

Five changes:

**(1) Pre-flight the batch, not the photo.** — `src/app/capture.tsx:488-499`

Replace the boolean gate with a count. A new pure module, e.g.
`src/features/ingest/batch-capacity.ts`:

```ts
export type BatchAdmission =
  | { kind: 'all' }
  | { kind: 'partial'; accept: number; hold: number; used: number; limit: number }
  | { kind: 'none';    hold: number; used: number; limit: number; wall: 'active' | 'total' };

export function admitBatch(count: number, capacity: {
  used: number; limit: number; stored: number; storedLimit: number; loading: boolean;
}): BatchAdmission;
```

Rules, copied from `refuse()`: `loading` admits everything (never refuse on an unread
count); total ceiling checked before active, matching `capacityState`
(`closet-spec.ts:41-46`) and `refuse` (`import-batch.ts:111-126`); otherwise
`accept = max(0, limit - used)`.

`settleCapture` then commits `accept` photos and holds the rest, showing `ClosetFullSheet`
once with real numbers instead of the current single-photo copy (`capture.tsx:1474-1481`).

**(2) Consult `import_capacity()` before a large batch.** — `use-capacity.ts`

The two `head` counts are cached for 60 s (`:69`). For a batch of N > 1, take the fresh
server answer: `supabase.rpc('import_capacity')` — already granted to `authenticated`
(`20260813194202:174`). One round trip against 3N wasted Vision passes is a trade worth
making. Keep the cached counts for display.

**(3) Stop the queue on the first capacity refusal.** — `upload-queue.ts:905-935`

Classify the caught error before deciding what to do with it. Reuse the sentinel
`classifyDenial` already matches (`use-gate.ts:57`):

```ts
const capacityRefusal = /closet_limit_reached|storage_limit_reached/.test(message);
```

When true:
- do **not** re-queue for `MAX_ATTEMPTS` — a refusal is deterministic, so retrying is 2N
  guaranteed-identical failures;
- move this job and **every remaining `queued` job** to a new `held` stage with
  `retryable: false`;
- emit **one** `clothes_import_failed` with `reason: 'closet_limit_reached'` (a new bounded
  value in `analyticsFailureReason`, `:155-174`) and `stopped_after: <number landed in this
  batch>`, in place of N events;
- raise the wall once via the existing `ClosetFullSheet`.

This generalises `TagOutcome.accountWide` (`:253`, used at `:1130-1133`) to the row-write
path — the same idea the sweep already has, applied where it was missing.

**(4) Do not open the grace window for a capacity refusal.** —
`import-failure-grace.ts`, `use-gate.ts:485-488`

`recordImportFailure(atMs, cause)`; the window opens only for `cause !== 'capacity'`.
Separately, `present()` gains an explicit-request escape so a `closet_plans_door_opened`
tap (`closet.tsx:1176-1177`) and the sheet's "See plans" (`capture.tsx:1489`) are never
suppressed. Keep the `paywall_eligible` suppression event (`use-gate.ts:486`) so the guard
stays measurable.

**(5) Fix the two instrumentation defects (§3.4).** Set `stage: 'writing'` around the
inserts at `:796-805` / `:738-749` and the update at `:835-850` so `diedAt` stops naming
the cutout; and normalise an empty `code` to a distinct token (`net_error`) rather than
folding it into `no_code`.

### 5.2 File-level touch points

| file | change |
|---|---|
| `src/features/ingest/batch-capacity.ts` | **new**, pure — `admitBatch` |
| `src/app/capture.tsx:488-499` | count-based admission; commit `accept`, hold the rest |
| `src/app/capture.tsx:1470-1500` | sheet copy takes `(accept, hold, used, limit)` |
| `src/features/billing/use-capacity.ts` | expose an `import_capacity()`-backed fresh read for batches |
| `src/features/ingest/upload-queue.ts:905-935` | classify; stop-on-capacity; one event with `stopped_after` |
| `src/features/ingest/upload-queue.ts:155-174`, `:193-198` | new bounded reason; `net_error` code |
| `src/features/ingest/upload-queue.ts:788`, `:796`, `:835` | write a `writing` stage so `diedAt` is true |
| `src/features/ingest/queue-store.ts:13-20`, `:236-240` | `held` stage; excluded from `clearSettled` |
| `src/features/billing/import-failure-grace.ts` | cause-aware `recordImportFailure` |
| `src/features/billing/use-gate.ts:485-488` | skip grace for user-initiated presentations |
| `src/lib/posthog.tsx:545-569` | document `stopped_after` and the new reason |

No migration is required. `import_capacity()` and the trigger are already correct.

### 5.3 Tests (`node --test`, pure)

New `tests/batch-capacity.test.ts`, mirroring `tests/catalog-import-batch.test.ts`:

1. an empty closet admits all 56;
2. **9 of 10 used, 56 picked → `accept: 1, hold: 55`** — the regression that produced 46
   events;
3. 10 of 10 used → `kind: 'none'`, `wall: 'active'`;
4. total ceiling refuses before the active one, matching `capacityState`
   (`closet-spec.ts:41-46`);
5. `loading: true` admits everything — never refuse on an unread count
   (`import-batch.ts:109`, `use-capacity.ts:96-100`);
6. a batch that exactly fills the closet is admitted whole;
7. `accept` is never negative for a grandfathered over-cap closet
   (`20260808190000:10-13`).

Extend `tests/import-failure-grace.test.ts` (it already reads modules as source, `:1-11`):

8. a capacity-caused failure does **not** open the window;
9. a non-capacity failure still does;
10. source-contract: `upload-queue.ts`'s catch matches
    `closet_limit_reached|storage_limit_reached` and does not re-queue on that branch;
11. source-contract: `use-gate.ts`'s grace check is bypassed for user-initiated
    presentations.

New `tests/import-failure-classify.test.ts`, exercising `analyticsFailureReason` /
`analyticsFailureCode` directly (both are pure and free of `@/lib/posthog`):

12. `Could not create item [23514]: closet_limit_reached: 10 of 10 garments` →
    `closet_limit_reached`, code `23514`;
13. `[]` (empty postgrest code) → `net_error`, not `no_code`;
14. `[PGRST301]` → `row_write_failed`, code `PGRST301`;
15. no bracketed token → `no_code`.

### 5.4 Where two explanations still fit

- **`23514` is ambiguous.** Closet cap, storage cap and any column CHECK all produce it.
  Any fix keyed on the code alone will misfire; key on the message sentinel, as
  `commit_intake_session` (`20260811022953:93-96`) and `classifyDenial`
  (`use-gate.ts:57`) already do.
- **The Ludlow user's 13.5-hour spread.** The delete→succeed→refill sequence proves the
  cap for the tail of his session. His 03:01–03:06 failures are consistent with the same
  cause (he had ~12 completions by then, above the free 10) but are not independently
  proven — no capacity event exists that early, for the reason in §0.
- **The plan-fold divergence** (§2.1 item 3) would produce capacity refusals in a user who
  *appears* to have room. It did not cause these two, but it will produce the same event
  shape, and only the count in the wall copy would look wrong.
- **`stage: 'cutout'`** on all 66 events is explained by `diedAt` reading a stale stage
  (§3.4a). An alternative reading — that these genuinely died in the Vision pass — is
  excluded by `reason: row_write_failed`, which only `:170` can produce and only the four
  row-write throw sites can feed.
