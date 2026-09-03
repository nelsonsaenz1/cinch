# Verification — hostile review of fix batch 1 (2026-09-02 audit)

Adversarial pass over the uncommitted working tree. Nothing under `src/`,
`supabase/`, `tests/` or `scripts/` was modified. Scratch harnesses live in
the session scratchpad and are quoted inline.

## 0. The four commands, as they actually ran

| command | result |
|---|---|
| `npm run typecheck` | **exit 0**, no diagnostics |
| `npm test` | **exit 0** — `# tests 3780 / # pass 3779 / # fail 0 / # skipped 1`, 2.07s |
| `npm run lint` | **exit 0** — 0 errors, **2 warnings** (down from 6: both are the pre-existing `index.tsx` duplicate `upload-queue` import; the diff genuinely cleared the `use-gap-feed` useMemo and `questionnaire.ts` `OccasionOption` warnings) |
| `npm run smoke:styling` | **exit 0**, all scenarios produced outfits, "Closet size: 22 items" |

**The green suite proves very little about this diff.** `tests/batch-capacity.test.ts`
and `tests/styling-audit-2026-09-02.test.ts` exercise pure functions; 13 of
`tests/import-failure-classify.test.ts`'s assertions are `assert.match` /
`doesNotMatch` **against file source text** (`selectActiveCount must exclude held
jobs`, `hydrate must restore held jobs as held`, …). Not one line of the new
hold/release/resume machinery is executed by any test. Every finding below is
about behaviour no test reaches.

---

## Ranked findings

### S1-1 — CONFIRMED. The hold/release pair is a livelock: unbounded Vision passes and unbounded `clothes_import_failed`, i.e. ledger A28 restored without its 3-attempt ceiling

`src/app/capture.tsx:796-838` (the resume effect) ↔ `src/features/ingest/upload-queue.ts:840-885` (`holdQueuedJobs` / `releaseHeldJobs`).

The two halves have no shared fixed point. `releaseHeldJobs(room)` sends jobs
back to `queued` **and resets `attempts: 0`**; `drainQueue`'s new capacity branch
(`upload-queue.ts:914-925`) parks them again; parking changes `heldCount`, which
is a dependency of the resume effect, so the effect runs again, recomputes the
same `room` from the same unchanged `capacity`, and releases again. Nothing in
the refusal path invalidates `['closet-count']` (the branch `return`s at
`upload-queue.ts:924`, before the ordinary catch), so the client's room estimate
**never moves**. Each cycle is a full `prepareForUpload` + on-device cutout
(a Vision pass) + upload + refused INSERT + one `clothes_import_failed`.

Reproduction (real `admitBatch`, verbatim copies of `holdQueuedJobs`,
`releaseHeldJobs`, `selectHeldJobs`, `selectPendingRowCount`, and the effect
body; `scratchpad/sim/loop.ts`, bundled with esbuild + node exactly as
`scripts/run-tests.mjs` does):

```
run 1: parked=3 pending=0 accept=1 released=1 -> held=3 vision=1  refusals=1
run 2: parked=3 pending=0 accept=1 released=1 -> held=3 vision=2  refusals=2
...
run 200: ...                                                vision=200 refusals=200
DID NOT SETTLE — 200 effect runs
{ visionPasses: 200, refusals: 200, held: 3, capacityUsed: 19 }
```

(The model collapses release→drain→hold into one synchronous pass. In the app
they are three separate `heldCount` transitions across renders, so React re-runs
the effect on each; the cycle is identical, just interleaved.)

**The precondition is "the client believes there is room and the server
disagrees", and there are three independent, ordinary ways to be in it:**

1. **The count query errored.** `use-capacity.ts:87-100`: on error `data` is
   `undefined`, so `used = 0`, `stored = 0`, `full = false`, and `loading` is
   `isPending || planLoading` — false in the error state. So an errored count
   reports *an empty closet*, `admitBatch` grants the full ceiling, and the
   loop starts on the first refusal. `useCapacity`'s own docblock defends this
   ("the cost of being wrong in this direction is one honest error message") —
   that was true before this diff; it is now an unbounded loop.
2. **`foldPlan` (`plan-fold.ts:27-30`) makes the client outrank the server by
   design.** The trigger's limit is `item_limit_for_plan(effective_plan(user))`,
   which reads only `subscriptions` (`20260808190100:66`). The client's limit is
   `PLANS[foldPlan(rowPlan, sdkPlan)].items`. A real StoreKit purchase whose
   webhook has not landed — the exact window `plan-fold.ts` was written for, and
   the one memory `cinch-superwall-webhook-gap` says has never been proven with
   a real transaction — gives client `pro` (1000) against server `free` (10).
3. **Trial expiry mid-session.** `trialing` is computed *inside the queryFn*
   (`use-plan.ts:150`) and cached, so it is a snapshot. A session that stays
   foregrounded past 2026-09-03 14:00Z keeps `trialing: true` (client `pro`,
   1000) while `effective_plan` has already flipped to `free` (10). The new
   `focusManager` wiring only fires on a background→foreground transition, so it
   does not close this.

Before the diff the same three states cost **3 attempts per job, then `failed`**.
After it they cost an unbounded loop while the capture screen is mounted.

**This is the single reason not to ship the batch as-is.** The narrow fix is to
make release monotone: don't reset `attempts` in `releaseHeldJobs`, refuse to
release a job that has already been held once without an intervening successful
insert or a confirmed `closet-count` refetch, and invalidate `['closet-count']`
in the capacity branch of `drainQueue` so the client's estimate converges on the
server's.

### S1-2 — CONFIRMED. A batch that was entirely refused renders as a finished, celebrated batch

`src/app/capture.tsx:910-911` and `queue-store.ts:266-270`.

`selectActiveCount` now excludes `held`; `allDone = total > 0 && active === 0`.
When every job of a batch is parked, `total = N > 0`, `active = 0`, so
`allDone` is **true** with `doneCount === 0`. Consequences, all in the same render:

- masthead title `settledTitle(0)` → **"Zero filed"**, subtitle `SETTLED_SUB`
  ("Have a look before they join your closet.") — `capture.tsx:1128-1135`.
- `capture.tsx:1185` renders `<SettledGrid uris={[]}/>` **instead of the row
  list**.
- Because the rows are not rendered, the new `ROW_STATUS_WAITING_FOR_ROOM`
  ("Waiting for room", `capture-spec.ts:444`) and the new `held` case in
  `toneFor` are **unreachable in the state they were written for**. I confirmed
  the strings themselves work — `filingRows([{stage:'held'}])` returns
  `status: "Waiting for room", tone: waiting` — they simply never get drawn once
  the batch settles.

The celebration itself does not fire (`celebrationFor` needs a provable closet
crossing and `closetBefore === closetCount` here), which is the only thing that
saves this from being worse.

Related trap, same mechanism: `capture.tsx:1050` `leaveStage` routes the close
disc to the batch surface whenever `total > 0`, and held jobs are persisted and
survive `clearSettled` and `hydrate` by design. A user with parked photographs
therefore can never dismiss the capture route with the X again — it always lands
on a page headlined "Zero filed".

### S2-3 — CONFIRMED. `admitBatch` computes which ceiling was hit, and `capture.tsx` throws that away — the total-ceiling dead end is back

`batch-capacity.ts:83-99` returns `wall: 'active' | 'total'` and, for a total
wall, `used: capacity.stored, limit: capacity.storedLimit`. Its own docblock
says offering "make room" at the total ceiling "is the dead end the two-ceiling
design exists to remove". `capture.tsx` never reads `verdict.wall`, `verdict.used`
or `verdict.limit`:

- `capture.tsx:1587` `title={`Your closet is full at ${capacity.limit}.`}`
- `capture.tsx:1589` body: `Your ${capacity.used} pieces make ${today} outfits`
- `capture.tsx:1176` plate: `waitingForRoomBody(heldCount, capacity.limit)`
- `capture.tsx:1600` secondary is unconditionally "Make room for it" →
  `/wall-swap`.

Probe output (`scratchpad/sim/pure.ts`):

```
ok   total wall reported before active
     total-wall verdict reports limit = 30 (sheet/plate copy uses capacity.limit = 10)
```

Concrete case: free account, 30 rows of which 25 archived → `used = 5`,
`stored = 30 = storedLimit`. `capacity.full` is false, `capacity.storageFull` is
true. The batch is correctly held with `wall: 'total'`, and the user is then told
**"Your closet is full at 10. Your 5 pieces make N outfits today."** and offered
"Make room for it", which archives another piece and changes nothing —
`enforce_item_limit` counts every row (`20260808190100:70-88`). `the-ten.tsx:396`
and `gap-feed.tsx:115` both branch on `capacity.storageFull`; `capture.tsx` is
the one surface that does not, and this diff is where it started computing the
answer and discarding it.

### S2-4 — CONFIRMED. `gate.present` returning `'unavailable'` now hides the sheet and leaves nothing behind

`capture.tsx:733-750`. The new order is `setClosetFullVisible(false)` →
`setTimeout(400)` → `present(...)`, and the sheet is restored only on
`outcome === 'declined'`. `GateOutcome` has three members
(`use-gate.ts:92-102`), and `'unavailable'` is documented as "the paywall failed
to load, rendered broken, timed out, or paywalls are not configured in this
build", with the explicit contract that **"the caller's own refusal copy is the
right thing to leave on screen"**. This caller now removes its refusal copy
*before* learning the outcome. Result for a build with `PAYWALLS_ENABLED` false,
an unpublished paywall, or the 8s watchdog: the sheet vanishes, no paywall
appears, and if the photographs were held in component state (never queued —
the `verdict.kind === 'none'` path) the amber plate does not show them either,
because that plate is keyed on `heldCount`, the *queue's* held jobs. The hold is
recoverable only by navigating away and back (which bumps `resumeTick`).

Same call site, second defect: the 400ms `setTimeout` is **never cleared**.
If the screen unmounts inside the window (`router.back()`, a deep link, the
system dismissing the modal route), the timer still fires and presents Superwall
over whatever screen is now in front.

Third, and this is the one that undoes the stated fix: the resume effect can call
`setClosetFullVisible(true)` **inside the 400ms window** — it runs on any change
to `capacity.used/limit/stored/storedLimit`, and a concurrently-draining job's
`invalidateAfterItemSettled()` refetches `['closet-count']` on exactly that
cadence. The `Modal` comes back up, the timer fires, and Superwall is asked to
present over a modal: the F-LC-2 `no_response` this change exists to remove.
There is no interlock (no `presentPending` ref consulted by the effect).

### S2-5 — CONFIRMED. `isStale(revoking)` opens a one-way door: `REFUND` → `REFUND_REVERSED` leaves the user free forever

`supabase/functions/_shared/superwall-plan.ts:96-113`, with
`asc-notifications/index.ts:308` and `:311-322`.

The rule is now asymmetric — a tie **applies** for a revocation and is **stale**
for a grant — but the revoking write stores `current_period_end: expiresAt`
(`asc-notifications/index.ts:317`). So both members of a revoke/re-grant pair
carry the same `expiresDate`, and only the first one lands:

```
ok   REFUND at a tie now APPLIES (the fix)
ok   REFUND_REVERSED at the same tie is DROPPED as stale
```

`REFUND_REVERSED` is in `ASC_GRANTING` precisely because "Apple decided the
refund should not have happened, so the entitlement comes back"
(`asc-plan.ts:32-33`) — and it now cannot. Before the diff the pair cancelled out
by accident (both dropped, plan stayed paid); after it, the outcome is
permanently free. `REVOKE` → later re-grant at the same date has the same shape.

Everything else I attacked here holds up: out-of-order grant/revoke across the
two sources, `subscription_paused` with a null `expirationAt` (still applied
unconditionally), a first-ever event against a null `current_period_end`, and
`reconcile`'s receipt-order loop all behave correctly with the new flag.

### S2-6 — CONFIRMED. `use-plan.ts` is not a mirror of `effective_plan`, and the diff has now made that load-bearing

The migration comment (`20260903000000`) and the code comment
(`use-plan.ts:87-93`) both claim the two "never disagree about who is paying".
They cannot agree, by construction:

- server: `plan in (standard,pro) and (current_period_end is null or +3d > now())`,
  else live `trial_ends_at` → pro, else free. Reads `subscriptions` only.
- client: the same shape, **then** `foldPlan(…, sdkPlan)` at `use-plan.ts:171`,
  which by design returns the **higher** of the row and the on-device StoreKit
  entitlement.

Plus the boundary is inverted at exact equality (server drops at
`pe + 3d == now`, client keeps), and `trialing` is a cached snapshot rather than
a live comparison, so it lags by up to a foreground transition.

None of that mattered while a wrong client plan only cost "screens, not service"
(`plan-fold.ts:16-19`). It matters now because S1-1 turns any client-over-server
plan into an unbounded import loop. The two changes are individually defensible
and jointly not.

Non-findings I checked here: Savannah's pro row (`current_period_end`
2027-09-01) and the second pro row (2027-08-07) are both honoured; a manual grant
with a null period end is honoured by both sides; `subscription_plan` has exactly
`free | standard | pro`, so the server's `plan in (…)` and the client's
`rowPlan !== 'free'` are equivalent; `revoke execute … from anon` is additive.

### S3-7 — CONFIRMED. The-ten and the guided camera have no idea `held` exists

`the-ten.tsx:477` reads `selectActiveCount`, which now excludes held jobs, so
`settling` goes false while photographs are parked. `ten-camera.tsx:88-97` fills
a slot only when `job.itemId` appears — a held job never gets one — and
`selectPhaseLabel` (`queue-store.ts:327-340`) has **no `held` branch**, so it
returns `null` and the camera reports no phase at all. A held job in the guided
ten leaves the slot permanently empty with nothing on screen saying why. Neither
`the-ten.tsx` nor `ten-camera.tsx` renders the new plate.

### S3-8 — CONFIRMED. `releaseHeldJobs` resets `attempts: 0`

`upload-queue.ts:875-881`. Even setting aside S1-1, this removes the
`MAX_ATTEMPTS` backstop for any job that has ever been held: a job can be
released, fail for an ordinary reason twice, be held, be released, and start its
attempt budget over. `tagAttempts` is reset the same way.

### S3-9 — CONFIRMED. Held jobs are releasable from exactly one screen

`releaseHeldJobs` has one call site in the whole tree (`capture.tsx:807`), inside
an effect gated on `resumeTick !== 0`, i.e. a focus of `/capture`. Held jobs are
persisted (`hydrate` at `queue-store.ts:193`), survive `clearSettled`
(`:251-254`), and are excluded from `selectActiveCount`, so on the next cold
launch `resumeVisible` (`capture.tsx:473`) is **false** and frame 18 does not
offer them either. A user who makes room from the Closet tab, from `/wall-swap`
reached anywhere else, or by upgrading outside capture has photographs that will
sit parked indefinitely with nothing sweeping them. There is no app-boot or
foreground release path.

### S3-10 — CONFIRMED (code). `isSolidPattern(null)` discards every explicitly-tagged `pattern_scale` on a row with a null `pattern`

`garment.ts:87-89, 124-131`. The finding was four rows with
`pattern='solid', pattern_scale='small'`. The fix keys on
`isSolidPattern(item.pattern)`, and `isSolidPattern` returns **true for `null`
and for the empty string** (`!pattern`, and `SOLID = /^(solid|plain|none|null)?$/i`
matches `''`). A null `pattern` means *unknown*, not *solid*. Every row with a
null/empty pattern column and an explicit `extended.pattern_scale` now scores as
`'none'`, where before the explicit value won. The blast radius is "rows whose
pattern column was never filled", which is strictly larger than the four rows
this was aimed at. The narrow version is `item.pattern != null && SOLID.test(...)`.

### S3-11 — CONFIRMED. The "one event per batch" claim is false by up to `MAX_CONCURRENCY`

`posthog.tsx` now documents "A refused closet slot fires ONCE per batch, not once
per photograph". `holdQueuedJobs` (`upload-queue.ts:842-855`) parks only jobs
whose stage is `'queued'`; the up-to-two other in-flight jobs
(`preparing`/`cutout`/`uploading`/`writing`) are untouched, run to completion,
meet the same trigger, and each calls `holdQueuedJobs` + `trackImportFailed`
again. Expect 1–3 events and 1–3 wasted Vision passes per batch, with `held`
counts that do not sum to the batch. (Still an enormous improvement on 46; the
docblock and the event's semantics are what is wrong.)

### S3-12 — CONFIRMED. Explore's first visit now pops the shelves in

`explore.tsx:238, 240-247`. `ShopFeedSection` returns `null` for zero cards
(`shop-feed-section.tsx:25`), and `explore.tsx:829/835` pass `data ?? []` with no
loading branch, so the gating does not produce a false empty state — good. What
it does produce is a layout shift: the two shelves are absent for the duration of
an Edge Function round trip on the first visit of every launch, where before the
query was warm by the time anyone arrived. The `useTabVisited` move itself is
correct and nothing else on the screen read those queries.

### S4 — smaller

- **`withDeadline` converts a hang into a rejection at three call sites that do
  not catch it.** `getUserId()` (`supabase.ts:291-295`) never rejects; the
  wrapper does, after 15s. `drainQueue`'s `void sweepPendingTags()`
  (`upload-queue.ts:981`) and `cutout-failed-notice.tsx:67`'s
  `void retryCutout(jobId).finally(...)` have no `.catch` → "Possible Unhandled
  Promise Rejection". (`startBackfill`'s only caller, `privacy/ai.tsx:88-100`,
  does catch it.) The new message "Signing in did not respond…" classifies as
  **`unknown`** in `analyticsFailureReason` — the diff's own new failure mode is
  the one thing its vocabulary refuses to name.
- **`admitBatch(NaN, …)`** returns `{kind:'partial', accept: room, hold: NaN}` —
  `Math.max(0, Math.trunc(NaN))` is `NaN`, and `NaN === 0` and `NaN <= room` are
  both false, so it falls through to the partial branch. Not reachable today
  (every caller passes an array length), but the guard reads as if it handles it.
- **Classification order**: `analyticsFailureReason`'s `photo_unreadable` regex
  (`/decode|unsupported|corrupt|read the image|prepare/i`) is tested **before**
  the two ceilings, while `drainQueue` parks on `isCapacityRefusal` alone. A
  message matching both is parked as `held` and reported as `photo_unreadable`.
  Confirmed: `analyticsFailureReason('Could not create item [23514]:
  closet_limit_reached: …, prepare to upgrade') === 'photo_unreadable'`. Not
  reachable with the current trigger text (PostgREST puts the hint in
  `error.hint`, not `error.message`), but the hold decision and the analytics
  label are two different predicates over the same string.
- **`filingRows` word collision**: offline + held renders `"Held"`, not
  `"Waiting for room"` — `opts.held` wins at `capture-spec.ts:483-489`. Two
  different meanings of "held" on the same row.
- **`generate.ts:148`** gates on `tops.length === 0` where `tops` is computed
  from `usable` (post-`excludeItemIds`). A closet that *does* own shirts but has
  them all excluded (the "another look" path) now anchors knits at 32 °C. Almost
  certainly harmless, but it is wider than "a closet whose every top is a knit".
- **Doc rot**: `posthog.tsx:484` still cites `import-failure-grace.ts`, which the
  diff deletes; the new `outfit_plan_failed` docblock says `reason` "is bounded by
  `classifyWearFailure`'s vocabulary" when it is bounded by `planFailureReason`
  (`plan/mutations.ts:120-127`).

---

## What I attacked and could not break

- **`possibleCores` ↔ `countOutfits`.** Exhaustive over every tally in
  0..3⁴ (256 closets): `possibleCores(w).length === countOutfits(tallyOf(w))`
  for all of them, and every core key is distinct (which the exhaustion set in
  `exhaustionProgress` depends on). The shoeless case is correct.
- **Stage C double-placing a knit that anchored a core.** `canLayerMid =
  !hasDress && !hasMid` (`generate.ts:216`) already refuses it, and the mid loop
  is gated on `allowsMidLayer`, which is false in the hot case the change is for.
- **The knit change altering a closet that has base tops.** It cannot: the new
  disjunct is `tops.length === 0`.
- **A16 revert.** No dangling references anywhere in `src/`, `tests/`,
  `scripts/` or `supabase/` to `import-failure-grace`,
  `withinImportFailureGrace` or `recordImportFailure` (only the two
  `doesNotMatch` assertions that assert their absence, and one stale docblock).
- **The removed dead events.** `saved_plan_started`, `saved_plan_missing_action`,
  `context_opened`, `context_set`, `local_fact_answered`,
  `stylist_question_answered`, `stylist_questionnaire_completed` and their prop
  builders have zero remaining references outside `docs/`. Dev fixtures still
  compile (`ContextFacet`/`ContextChoice` survive as types, which is what
  `dev-r11-context.tsx` uses).
- **Migration 20260903000100.** No client write to `ai_calls` or
  `ai_usage_counters` anywhere: no `.from('ai_calls')`, no
  `.from('ai_usage_counters')`, and `claim_ai_quota` is the only writer. The
  revoke is safe and reversible as documented.
- **`analyticsFailureReason` / `analyticsFailureCode` consumers.** The only
  consumer is `trackImportFailed`; `userFacingFailure`'s new capacity branch sits
  after the two branches that could shadow it and is correctly unreachable for
  parked jobs. `code` is returned for all three row-write reasons as the
  posthog docblock now claims. `net_error` fires on the `[]` shape and on nothing
  else the throw sites can produce.
- **Double-commit in the resume effect.** `commit` → `enqueue` is a synchronous
  zustand `set`, so `selectPendingRowCount` is up to date on the effect's next
  run and the partial-commit branch converges after exactly one extra pass. (It
  can still over-admit when a job has taken its `itemId` but the count query has
  not refetched — invisible to both `capacity.used` and `pendingRows` — which
  degrades to `held` rather than to the 46-event storm. That is the residual
  TOCTOU F-DB-3 already names, not a new defect.)
- **`clearSettled` / `clearFailed` / `retryFailedJobs` / `hydrate` vs. held.**
  All correct: held survives all three sweeps and `retryFailedJobs` only touches
  `stage === 'failed'`.
- **`AmberPlate` double-tap.** `disabled={busy}` is wired
  (`capture-parts.tsx:784`), so `gatePresenting` really does block a second tap.
- **`focusManager` wiring.** The global default stays `refetchOnWindowFocus:
  false`, so only the opted-in subscription query refetches. No test imports
  `query-client.ts`, so the module-scope `AppState.addEventListener` does not run
  in the node suite. The listener is never removed, but it is a process
  singleton, so that is not a leak. Minor: iOS fires `inactive → active` on a
  Control Centre pull or a notification banner, so the subscription query will
  refetch more often than "foregrounded" suggests.
- **Activity screens, `repeat-outfit`, `walkthrough/ceiling`, `stableImageSource`,
  `plan_opened`, `chat_error`, `use-gap-feed` memoisation.** Read; nothing
  falsifiable found. `chat_error`'s cause mapping folds the 503-held and
  workload-disabled paths into `'transport'`, which is defensible but is not what
  those four causes were declared to mean.

## Recommended gate before this batch ships

S1-1 alone. Everything else can ship or be filed; a livelock that burns Vision
passes and emits `clothes_import_failed` without bound, reachable from a single
failed count query, is a worse defect than the one the batch is fixing.
