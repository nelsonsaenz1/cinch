# Verification 3 — targeted falsification of the V2 repairs (2026-09-02 audit)

Third adversarial pass over the uncommitted working tree, aimed at the eight
repairs the author made against `verification-2.md` (V2-1 … V2-10). Nothing
under `src/`, `supabase/`, `tests/` or `scripts/` was modified.

Harnesses live in the session scratchpad (`sim3/*.ts`, bundled with esbuild
and run under `node`, exactly as `scripts/run-tests.mjs` does) and carry
verbatim copies of the effect body and the real pure modules:

| file | what it is |
|---|---|
| `sim3/capture3.ts` | the resume effect, `capture.tsx:829-889`, transcribed verbatim; real `admitBatch`; verbatim `holdQueuedJobs` / `releaseHeldJobs` / `selectHeldJobs` / `selectPendingRowCount`. **Two levels**: an inner loop that is React's passive-effect dep rule (`Object.is`, dep memory owned by the MOUNT), and an outer loop for the macrotask world, because `drainQueue` is async and the rows and `['closet-count']` invalidations it produces land only after the render loop has settled. `drainMode: 'sync'` runs the adversarial ordering instead. |
| `sim3/capture3.run.ts`, `sim3/focus3.run.ts` | the twelve scenarios below, and the per-focus cost curve |
| `sim3/reaction3.run.ts` | real `applyReactionMemory` / `favorExactCores` / `reactionSignals` / `coreIdsOf`, `tests/helpers.garment` |
| `sim3/plan3.run.ts` | both webhooks reduced to their decision, over the real `isStale` / `verdictFor` / `ascVerdict` / `reconcile`, with a `pgrst()` model of PostgREST's `timestamptz` rendering **verified byte-for-byte against the live database** |
| `sim3/spec3.run.ts` | real `admitBatch` + `capture-spec` helpers, printing the actual sheet / plate / masthead strings |

## 0. The three commands, as they actually ran

| command | result |
|---|---|
| `npm run typecheck` | **exit 0**, no diagnostics |
| `npm test` | **exit 0** — `# tests 3796 / # pass 3795 / # fail 0 / # skipped 1`, 2.24s |
| `npm run lint` | **exit 0**, **0 errors, 0 warnings** — the two pre-existing duplicate-`upload-queue`-import warnings in `src/app/(tabs)/index.tsx` are gone (one import remains, at `:32`) |

Coverage of the repairs improved but is still partial. `tests/superwall-plan.test.ts`
gained 5 tests that pin the instant comparison, the paid-plan-change tie and the
free-row reversal; `tests/capture-layout.test.ts` gained the parked-subline
assertion; `tests/reaction-ranking.test.ts:120-130` now exercises the
favourite/reaction seam that V2-3 was about. **Still untested by anything:**
`grep -rln releaseHeldJobs tests/` is empty — no test executes the resume
effect, `holdQueuedJobs` or `releaseHeldJobs`, so V3-1 below is invisible to
`npm test`.

---

## What the repairs actually fixed (attacked, held)

### V2-1 / V2-2 — the render loop is gone. Confirmed by execution, not by reading.

`capture.tsx:861-874`: `heldCapture` is rewritten only inside
`if (verdict.accept > 0)`. Two independent reasons this settles, and I could
not defeat either:

1. **It is a decreasing measure.** Every rewrite does
   `assets.slice(verdict.accept)` with `accept ≥ 1`, so `heldCapture.assets.length`
   strictly decreases. The number of self-triggered re-runs is bounded by the
   batch size (≤ `SELECTION_LIMIT`) no matter what the capacity model does.
2. **In practice it is one extra run at most**, because `commit()`
   (`use-capture.ts:107-117`) calls `enqueue` **synchronously** — zustand `set` —
   so `selectPendingRowCount` sees the committed jobs on the very next run and
   the second verdict is `accept: 0`.

Numbers, `sim3/capture3.run.ts` (effect runs / Vision passes / refusals /
`clothes_import_failed` / commits, until the deps stop changing):

```
A.  10 of 10, an 11th photograph            runs 1  vision 0  refusals 0  events 0   SETTLED
A'. same, drain completes inside the effect  runs 1  vision 0  refusals 0  events 0   SETTLED
B.  3 photographs at the TOTAL ceiling       runs 1  vision 0  refusals 0  events 0   SETTLED
C.  27 photographs, empty free closet
    (10 committed by settleCapture, 17 held) runs 1  vision 0  refusals 0  events 0   SETTLED
C'. same, adversarial drain ordering         runs 1  vision 0  refusals 0  events 0   SETTLED
D.  stale count says EMPTY, server full,
    12 photographs held, no queue            runs 3  vision 1  refusals 1  events 1   SETTLED
D2. stale count EMPTY, 3 already-parked jobs
    and no heldCapture                       runs 2  vision 1  refusals 1  events 1   SETTLED
G.  count query flips error <-> success,
    12 photographs held                      runs 1  vision 0  refusals 0  events 0   SETTLED
G2. same, 3 parked jobs, no heldCapture      runs 1  vision 0  refusals 0  events 0   SETTLED
```

Case A is the W-02 path that V2-1 was a ship-blocker on: **one effect run, no
Vision pass, no event.** Case C is the A28 shape: **one effect run**, because
`settleCapture` has already queued the ten that fit and `pendingRows` sees
them. The error↔success flip costs nothing at all here, because a hold that
admits nothing writes no state and therefore triggers no refetch.

**No scenario is under-resumed.** All three release paths work:

```
H. Make room frees ONE slot, user returns (focus)   runs 4  1 committed, 2 still held, sheet back up
I. Grant lifts the plan to Pro                      runs 4  all 3 committed, heldCapture null, sheet gone
J. Decline (nothing changed, focus bumps anyway)     runs 2  hold intact, sheet back up
K. one slot freed with 3 held photos AND 3 parked jobs
                                                     runs 3  the QUEUE's parked job is released first
```

K is the designed priority order (queue's parked jobs before the component's
hold) and it holds.

### V2-3 — repaired, and the composition is now provable

`reaction-ranking.ts:91-115` applies both adjustments in one sum
(`c.score + signal * REACTION_DELTA + favored`), `use-outfits.ts:150-157` calls
only it, and `grep -rn favorExactCores src/` finds **no runtime call site left**
— only the definition, two comments, and `tests/favorite-ranking.test.ts`.
`FAVORITE_BONUS` is exported from `favorite-ranking.ts:3` and imported here,
so the "twice `FAVORITE_BONUS`" docblock is now enforced by an import rather
than by a coincidence.

The key is byte-identical to `favorExactCores`' `core()` — `[...ids].sort().join('.')`
on both sides — and it matches what `useFavoriteOutfits` actually returns
(`itemIds` in `outfit_items.position` order, i.e. **unsorted**; the `.sort()`
is what saves it). `sim3/reaction3.run.ts`:

```
favorExactCores alone         : [ g2+g4+g5, g1+g4+g5 ]
applyReactionMemory(one sort) : [ g2+g4+g5, g1+g4+g5 ]   OK  promoted through the reaction sort
favourites, zero reactions    : [ g2+g4+g5, g1+g4+g5 ]   OK  (the early return does not swallow them)
unsorted itemIds from the query: [ g2+g4+g5, g1+g4+g5 ]  OK  matched
candidate carries an extra BAG : not matched              OK  same full-set key favorExactCores had

thumbs-UP on a favourite      : FAV first  (0.79 + 0.06 + 0.03 = 0.88)
thumbs-DOWN on a favourite    : X first    (0.79 - 0.06 + 0.03 = 0.76)
no on A(0.80) vs fav B(0.78)  : B first    (0.74 vs 0.81)  <- an explicit no outranks an implicit yes
```

### V2-4(a) and (b) — repaired

`superwall-plan.ts:131-138`. Verified against the **live** database that the
format assumption is right, rather than assuming it:

```sql
select to_jsonb('2026-10-01T00:00:00.000Z'::timestamptz);  -- "2026-10-01T00:00:00+00:00"
select to_jsonb('2026-10-01T12:34:56.789Z'::timestamptz);  -- "2026-10-01T12:34:56.789+00:00"
```

`Date.parse` reads both spellings to the same instant (`1790812800000`), so the
tie branch is reachable in production for the first time. Twenty of twenty-three
orderings now land correctly (`sim3/plan3.run.ts`), including the whole
dropped-upgrade family V2-4(b) reported:

```
ok  standard -> product_change(pro), SAME period end                  -> pro
ok  pro      -> product_change(standard), SAME end                    -> standard
ok  standard -> Apple DID_CHANGE_RENEWAL_PREF/UPGRADE(pro), SAME end  -> pro
ok  standard -> Apple OFFER_REDEEMED(pro), SAME end                   -> pro
ok  DID_CHANGE_RENEWAL_PREF with no UPGRADE subtype changes nothing   -> pro
ok  Svix replay of the same renewal(pro, E) at a tie                  -> pro (not re-granted)
ok  expiration(E) / Apple EXPIRED(E) / REVOKE(E) at a tie             -> free
ok  subscription_paused with no date, in both orders
ok  REFUND -> REFUND_REVERSED(E)                                      -> pro
ok  REVOKE -> Apple DID_RENEW(E)                                      -> pro
ok  renewal(E2) then a LATE expiration(E) of the superseded period    -> pro
```

Both webhooks pass all five arguments (`superwall-webhook/index.ts:316`,
`asc-notifications/index.ts:309-315`), both `select plan, current_period_end`,
and `reconcile` passes `best.plan` and `verdict.plan`
(`superwall-plan.ts:196-198`).

### V2-5 — the main dead end is closed

`batch-capacity.ts:113-122`: the `partial` return now carries `wall`, `used`
and `limit`, chosen the same way the `none` branch chooses them. `capture.tsx:868`
and `:534` both write `wall: verdict.wall` with no `'active'` fallback.
`sim3/spec3.run.ts`, free plan, 29 rows of which 24 stored, pick 3:

```
verdict      : {"kind":"partial","accept":1,"hold":2,"used":29,"limit":30,"wall":"total"}
sheet title  : Your account holds 30 pieces — the most it can.
sheet second : Open Storage -> /storage
```

That is the exact string and route V2-5 said was wrong, now right. The active
partial is right too (`used 7, limit 10, wall active` → "Your closet is full at
10." → `/wall-swap`), and so is the `pendingRows`-widened case.

### V2-6 — the subline no longer counts parked photographs as "to go"

`capture-spec.ts:513-533`. Real output:

```
all parked (3)       title "Filing three pieces"  sub "three waiting for room"
2 done + 3 parked    title "Filing five pieces"   sub "Two filed · three waiting for room"
2 done + 1 filing + 3 parked                      sub "Two filed · one to go · three waiting for room"
1 done + 1 queued    sub "One filed · one to go"   <- a genuinely queued job still reads "to go"
```

`celebrationFor` returns `null` over a parked batch (`allDone` requires
`heldCount === 0`, `capture.tsx:957`), so the celebration is still correctly
withheld.

### V2-7 — the false match is closed

`reaction-ranking.ts:64`. A thumbs-down on (top, bottom, DELETED shoe) no
longer lands on the shoeless pairing:

```
deleted SHOE, shoeless core g1·g4 -> signal NONE      OK false match closed
every counted item gone            -> signals []       OK
```

### V2-9 — the lapsed-paid-row fall-through is closed, and the migration IS live

`20260903000300`. I read the function body **out of the production database**,
not out of the file:

```
when s.plan = 'free'::public.subscription_plan
     and s.trial_ends_at is not null and s.trial_ends_at > now()
  then 'pro'
```

A lapsed `standard` with a live `trial_ends_at` now returns `free`, not `pro`.
`create or replace` preserved the `comment on function` from `20260903000000`,
and that comment ("a live trial_ends_at lifts only a free row to pro") is now
true of the function.

All 50 live `subscriptions` rows were checked: 30 `free`+live trial+null period
end → `pro`; 11 `free`+expired trial → `free`; 6 bare `free`; one `pro` and one
`standard` with live period ends; one `pro` with a live trial and a period end
in 2027. **No live row is in the state the migration changes** — the docblock's
claim is accurate.

### V2-10 — narrowed by the identity fix

The purchase-flash is still possible in principle, but with V2-1 gone the cost
is one re-settle and one sheet, not a spin. Not re-raised.

---

## Ranked findings

### V3-1 — CONFIRMED. The `foldPlan` / trial-snapshot livelock survives the repair: one Vision pass, one refused insert and one `clothes_import_failed` **per return to /capture**, indefinitely

`src/app/capture.tsx:829-889` (the effect), with `use-capacity.ts:87-100` and
`use-plan.ts:171`.

The repair removed the *render* loop. It did not remove the underlying
disagreement, and the effect still re-runs on every `useFocusEffect` tick
(`capture.tsx:824-827`), so the cycle simply changed clock: from per-render to
per-visit.

The mechanism: `['closet-count']` invalidation corrects `capacity.used` and
`capacity.stored`. It cannot correct `capacity.limit`, because the limit comes
from the plan, and the client's plan is `foldPlan(rowPlan, sdkPlan)` — the
**higher** of the server row and the on-device Superwall entitlement — or a
`trialing` flag resolved inside the query function and cached
(`use-plan.ts:151-155`). So when the client believes it is on a bigger plan than
the server enforces, `admitBatch` says there is room forever, `releaseHeldJobs`
sends the parked jobs back, the trigger refuses them, `holdQueuedJobs` parks
them again, and one `clothes_import_failed` fires. Cost curve
(`sim3/focus3.run.ts`, client limit 100 / server limit 10, 12 photographs):

```
extra focuses:   0        1        5        20
effect runs:     3        4        8        23
Vision passes:  12       13       17        32
refusals:        2        3        7        22
clothes_import_failed: 2  3        7        22      <- +1 per visit, no fixed point
```

Contrast the *count*-stale case, which the repair genuinely does settle: an
errored count query reporting an empty closet costs exactly **one** Vision
pass, one refusal and one event no matter how many times the user returns
(`vision 1, refusals 1, events 1` at 0, 1, 5 and 20 focuses), because the
refetch corrects `used` and `admitBatch` then says zero.

Reachability is not hypothetical. `foldPlan` outranking the server is the
documented behaviour of an entitlement the webhook has not written yet
(memory `cinch-superwall-webhook-gap`: the plan write has never been proven
with a real transaction). The trial snapshot is a cached `trialing: true` for
up to one stale window after `trial_ends_at` — and 29 gifted trials convert on
2026-09-03 at 14:00Z. V3-2 below is a third, permanent way into the same state.

The user-visible shape: the rows flip from "Waiting for room" to
"Queued"/"Preparing…" and back on every visit, `releaseHeldJobs` resets
`attempts`/`tagAttempts` to 0 each time (`upload-queue.ts:872-873`, S3-8
unrepaired), and the photographs never file.

Narrow fix: gate the release on a room the *server* has confirmed rather than
on the client's plan belief — e.g. do not release again after a
`closet_limit_reached` refusal until `capacity.used` has actually fallen, or
subtract a "last refused at this count" watermark.

### V3-2 — CONFIRMED. `20260903000300` moved the client/server disagreement instead of removing it: a lapsed paid row with a live trial now reads `free` on the server and `pro` on the client

`supabase/migrations/20260903000300_effective_plan_trial_lifts_free_only.sql`
against `src/features/billing/use-plan.ts:143-171`.

V2-9 was that the server lifted a lapsed paid row to `pro` while the client
said `standard`. The fix makes the server say `free`. But the client's mirror
folds in the other order: `paidLapsed` rewrites the row's plan to `'free'`
**inside the query function** (`use-plan.ts:149-153`), and the render-time line
then reads that already-folded value:

```ts
const rowPlan: Plan = data?.plan ?? 'free';            // 'free' after the lapse fold
const plan = foldPlan(rowPlan !== 'free' ? rowPlan : trialing ? 'pro' : 'free', sdkPlan);
```

`trialing` is computed from the raw `trial_ends_at` and is untouched by the
lapse fold, so a lapsed paid row with a live trial takes the trial branch and
lands on `pro`. Executed against the live database, evaluating both expressions
side by side over nine row shapes:

```
label                          server_effective_plan   client_use_plan
lapsed standard + LIVE trial   free                    pro      <-- DISAGREE
lapsed pro + LIVE trial        free                    pro      <-- DISAGREE
lapsed standard, no trial      free                    free
lapsed standard inside slack   standard                standard
paid, null period end          pro                     pro
paid null pe + expired trial   standard                standard
free + live trial              pro                     pro
free + live trial + live pe    pro                     pro
free, expired trial            free                    free
```

Two of nine shapes disagree, in a migration whose stated purpose is that "the
two never disagree about who is paying". The reachable route is exactly the one
the three-day slack exists for: a paid period that lapses **without** a
revocation webhook (the webhook would write `plan='free'`, after which both
sides use the trial fold and agree). No live row is in that state today; the
one `pro` row with a live trial has a period end in 2027.

It also feeds V3-1 directly: client `pro` (limit 100) over server `free`
(limit 10) is the precise input that makes the release/refuse cycle run on
every visit to `/capture`.

Narrow fix: move the lapse fold below the trial fold, or keep the raw row plan
alongside the folded one so the render line can ask "was this row paid?".

### V3-3 — CONFIRMED (unrepaired, and reachable through a path the tests' own argument does not cover). The `storedPlan === 'free'` escape hatch still cannot tell a reversal from a late duplicate

`supabase/functions/_shared/superwall-plan.ts:136`. Three of twenty-three
orderings still land wrong:

```
FAIL renewal(E), expiration(E), replay of renewal(E)                        -> pro   (expected free)
FAIL Apple DID_RENEW(E), Apple EXPIRED(E), forwarded Superwall renewal(E)   -> pro   (expected free)
FAIL renewal(E), expiration(E), uncancellation(E)                           -> pro   (expected free)
```

The author's new test argues this away: *"Superwall's queue is
svix-deduplicated, so a genuine replay of the same renewal cannot reach
reconcile twice"* (`tests/superwall-plan.test.ts`, `reconcile` block). For the
**Superwall** path that argument holds — `claim_superwall_event` is claimed at
`superwall-webhook/index.ts:225`, *before* the `isStale` decision at `:316`, and
a redelivery returns `duplicate` without deciding.

It does not hold for the **Apple** path. `asc-notifications/index.ts:339-364`
runs `outcomeOf()` — which reads, decides and **writes the plan** — and only
then upserts `asc_notifications`. There is no `firstDelivery` gate; the ledger
is a record, not a claim. So a single transient ledger error is enough:

1. `DID_RENEW(E)` → plan written `pro` → the `asc_notifications` upsert fails →
   **500** → Apple will redeliver.
2. `EXPIRED(E)` arrives and applies → plan `free`, `current_period_end = E`.
3. Apple redelivers `DID_RENEW(E)` → `outcomeOf()` runs again → tie, `storedPlan
   === 'free'` → **not stale** → plan `pro` again.

The forwarding path is a second route to the same place: `asc-notifications`
both settles the plan itself and forwards the raw notification to Superwall
(`asc-plan.ts:SUPERWALL_FORWARD_URL`), producing two independent writes with
two different idempotency keys and no ordering guarantee.

Damage is bounded to three days by `effective_plan`'s new lapse slack (the
re-granted row carries a `current_period_end` already in the past), so this
stays a downgrade of S2-5 rather than a re-opening. The third ordering
(`uncancellation` after `expiration` at the same date) I could not construct a
realistic Apple source for; treat it as theoretical.

### V3-4 — CONFIRMED. The V2-7 repair over-corrects: **storing** a bag or a coat discards every reaction on outfits that contained it, and storing is the app's own "Make room" remedy

`src/features/styling/reaction-ranking.ts:64` —
`if (r.item_ids.some((id) => !known.has(id))) continue;` — tests **every** id in
the row, including ids of kinds `coreIdsOf` deliberately drops.
`known` is built from `useWardrobe`, and `useWardrobe`
(`src/features/styling/queries.ts:107-127`) filters
`.eq('is_archived', false)` and `.in('status', ['tagged','needs_review','verified'])`,
so a **stored** piece is not in it.

```
bag still in the closet : signals = [ [ 'g1·g4·g5', -0.985 ] ]
bag STORED (archived)   : signals = []
the core the user judged: g1·g4·g5 -> NONE
```

The user gave a thumbs-down on top+bottom+shoes+bag. The core they judged is
`top·bottom·shoes` — the bag is not a counted kind and drops out of the key on
both sides. Archive the bag and the entire opinion disappears, while the outfit
itself is still generated and still offered.

This matters because storing is what the app *tells people to do*:
`/wall-swap` is "Make room for it", and it stores rather than deletes. A user
who follows the closet-full flow twice can silently erase most of their
reaction memory.

The guard cannot distinguish "the missing id was a bag" from "the missing id
was a shoe" from the wardrobe alone, so the conservative rule is defensible —
but it should be stated, and the cheaper correct rule is available: check
membership against the *unfiltered* item set (an `is_archived`-inclusive id
list) rather than against the styling wardrobe, which separates "left the
closet" from "was put away".

### V3-5 — CONFIRMED (residual of V2-5). Two remaining wall bugs on the same screen

**(a) The tie goes to the wrong ceiling.** `batch-capacity.ts:106` —
`const wall = totalRoom < activeRoom ? 'total' : 'active'`. When the two rooms
are **equal** the wall is called `'active'`, but committing `room` pieces
exhausts both. `sim3/spec3.run.ts`, free plan, 8 active of 10 and 28 stored of 30,
pick 5:

```
verdict      : {"kind":"partial","accept":2,"hold":3,"used":8,"limit":10,"wall":"active"}
sheet title  : Your closet is full at 10.
sheet second : Make room for it -> /wall-swap
```

After the two accepted pieces land, the account is at 30/30 total. `/wall-swap`
archives, and archiving does not lower `stored` — the same dead end the
two-ceiling design exists to remove, now reachable only at an exact tie.

**(b) The amber plate and the sheet contradict each other about the same
photographs.** `capture.tsx:1229-1236` re-derives the wall from
`capacity.storageFull` instead of from the verdict the hold recorded. At the
29-rows partial:

```
sheet  : "Your account holds 30 pieces — the most it can."   / Open Storage
plate  : "…your closet is full at 10 … make room or see plans"  / Make room
```

Two surfaces, one screen, opposite remedies. Same for the `pendingRows`-widened
case (`27 stored, 2 queued, pick 5` → sheet says total, plate says active).

**(c) `heldCapture.used` is still dead.** Written at `capture.tsx:870` and
`:535`; `grep -n 'heldCapture\.' src/app/capture.tsx` shows only `wall`,
`limit`, `assets` and `local` read back. The sheet body at `capture.tsx:1655`
prints `capacity.used`, so at the total ceiling the title says "Your account
holds 30 pieces" over a body that says "Your 5 pieces make N outfits today".

### V3-6 — CONFIRMED (partially repaired; the author may accept). The masthead still says "Filing" over a batch that is not filing

`capture.tsx:1181-1188`. `filingTitle(total)` is chosen whenever the app is
online and `allDone` is false, with no branch for parked rows:

```
3 parked, online : "Filing three pieces" · "three waiting for room"
```

The subline now corrects the title, which is the V2-6 repair working. Whether
the title itself should change is a taste call — `waitingTitle` ("Three
photographs waiting") exists and is currently reachable only when offline.

Two smaller things in the same area:

- **The offline word still wins over the parked word.** `capture-spec.ts:483-489`
  — `opts.held` is tested first, so `filingRows(jobs, { held: true })` returns
  `'Held'` for a parked row while `parked: true` is still set. Offline + parked
  therefore reads `rows: ["Held","Held","Held"]` under `sub: "three waiting for
  room"`. S4's word collision, one layer deeper than before.
- **The close disc, frame 18 and the guided Ten are unchanged** from V2-6:
  `leaveStage` still routes the X to the batch surface while held jobs exist,
  `resumeVisible`/`resumeBody` still read `selectActiveCount` (which excludes
  held) while `SettledGrid` does not, and `selectPhaseLabel`
  (`queue-store.ts:327-339`) still has no `held` branch, so a held job in the
  primary Ten leaves a slot empty with nothing on screen saying why.

### V3-7 — PLAUSIBLE, low. The identity-stability rule freezes `wall` / `used` / `limit` as well as `assets`

`capture.tsx:861-873`. The rewrite is inside `if (verdict.accept > 0)`, so when
nothing is admitted the recorded wall is never refreshed, even though the
verdict computed one line earlier may have changed it. Scenario L:

```
hold recorded at the ACTIVE ceiling (wall 'active', limit 10);
the account then reaches its TOTAL ceiling (stored 30 of 30)
-> verdict is {kind:'none', wall:'total', limit:30}, accept 0
-> heldCapture keeps wall 'active', limit 10
-> sheet: "Your closet is full at 10." / "Make room for it" -> /wall-swap
```

The remedy offered cannot work. I could not build a *likely* route into it on
the free plan (reaching `stored = 30` while `used` is pinned at 10 needs twenty
archived rows appearing during the hold), so this is PLAUSIBLE rather than
CONFIRMED — but the class is real, it is cheap to close (recompute the three
scalars whenever they differ, comparing values rather than object identity),
and a plan lapse mid-hold is the shape most likely to reach it.

### V3-8 — CONFIRMED, low, currently unreachable. The `NaN` fallback in `isStale` reinstates the exact bug the function was rewritten to remove

`superwall-plan.ts:132-134`:

```ts
if (Number.isNaN(event) || Number.isNaN(stored)) {
  return eventPeriodEnd <= storedPeriodEnd;
}
```

That `<=` is the original single rule, and it drops a revocation at a tie —
"every expiration was dropped as stale and a lapsed subscription kept its plan
for good", as the function's own docblock puts it. Measured:

```
both unparseable, EQUAL, revoking          : stale = true   <- a revocation dropped
epoch-millis event vs ISO stored, revoking : stale = true   <- likewise
tie, storedPlan undefined                  : stale = true   (deliberate, safe side)
```

It is unreachable today: both webhooks normalise with
`new Date(x).toISOString()` before calling (`superwall-webhook/index.ts:204`,
`asc-notifications/index.ts:271`), and `reconcile` reads `timestamptz` columns.
Worth noting that `new Date('garbage').toISOString()` **throws** `RangeError`
rather than producing an unparseable string — at
`superwall-webhook/index.ts:204` that is before `claim_superwall_event`, so a
malformed `expirationAt` from Superwall would 500 with no ledger row at all and
retry forever. Both are latent; neither is live.

### V3-9 — cosmetic. Doc rot around the now-uncalled `favorExactCores`

`src/app/(tabs)/index.tsx:1161` and `src/components/today/taste-row.tsx:19-21`
both name `favorExactCores` as the live favourites mechanism. It has no runtime
call site in `src/` any more; `applyReactionMemory` is. `reaction-ranking.ts:85`
says so correctly ("`favorExactCores` remains for its own tests and callers" —
there are now no other callers).

---

## What I attacked and could not break

- **The decreasing measure.** I tried to make the `partial` rewrite loop by
  giving the harness a drain that completes synchronously *and* creates rows
  (so `pendingRows` falls back to zero while the count stays stale). Even then
  it terminates in ≤ `assets.length` runs, because `slice(accept)` with
  `accept ≥ 1` is strictly decreasing. `C'` and `E'` (the two `drainMode: 'sync'`
  runs) both settle.
- **`heldCount` deliberately not being a dependency.** I looked for a way for
  the queue to park jobs and have nobody notice. It closes: a capacity refusal
  invalidates `['closet-count']` (`upload-queue.ts:933`), which moves
  `capacity.used`, which *is* a dependency; and `useFocusEffect` covers the rest.
  The one uncovered case is a release that is refused with the count already
  correct — but then `admitBatch` returns zero on the next run anyway.
- **The favourite key.** Unsorted `itemIds` from the query, a candidate with an
  extra bag, a favourite with no reactions at all, an empty candidate list, and
  ties — all four behave, and `favorExactCores` agrees with
  `applyReactionMemory` on every one.
- **The `reconcile` orderings.** `initial+product_change`, late expiration,
  `paused` in both directions, unmapped-only, and `cancellation`-only all settle
  correctly.
- **Migration `20260903000300` against real data.** Read the deployed function
  body and grouped all 50 live `subscriptions` rows by every shape the `case`
  distinguishes; nothing is affected, and the `create or replace` kept the
  function comment and the `authenticated` grant while the explicit
  `revoke … from anon` is repeated.
- **`admitBatch` numbers at both ceilings**, including `pendingRows`. Every
  `used`/`limit` pair printed on the sheet is the pair belonging to the wall the
  verdict named.
- **Four residuals confirmed still open and unchanged** (S3-8 `attempts: 0` on
  release, S3-9 the single `releaseHeldJobs` call site, S3-11 `holdQueuedJobs`
  skipping non-`queued` jobs so 1–3 events fire per batch, S4 `'Held'` beating
  `'Waiting for room'`). None regressed.

---

## Recommended gate before this batch ships

**V3-1 and V3-2**, together — they are one bug seen from two ends. V3-2 puts a
user permanently into the client-above-server state; V3-1 turns that state into
a refused insert and a `clothes_import_failed` on every visit to `/capture`,
with the photographs never filing. Both are small: V3-2 is an ordering swap in
`use-plan.ts`, V3-1 is a watermark on the release.

V3-3 is worth a line of defence before the first real transaction lands:
`asc-notifications` should claim `notification_uuid` **before** `outcomeOf()`,
the way `superwall-webhook` already claims `svix-id`. That alone removes the
only realistic route into the remaining tie failures.

V2-1, V2-2, V2-3, V2-4(a)(b), V2-5's main dead end, V2-6's subline, V2-7's false
match and V2-9 are all genuinely repaired; I could not break any of them.
