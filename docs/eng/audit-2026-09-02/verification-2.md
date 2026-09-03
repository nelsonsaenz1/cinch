# Verification 2 — hostile review of fix batch 2 (2026-09-02 audit)

Second adversarial pass over the uncommitted working tree, against the six
defects `verification.md` confirmed plus the new ledger-A9 reaction memory.
Nothing under `src/`, `supabase/`, `tests/` or `scripts/` was modified.
Scratch harnesses live in the session scratchpad
(`scratchpad/sim/*.ts`, bundled with esbuild + `node` exactly as
`scripts/run-tests.mjs` does) and are quoted inline.

## 0. The three commands, as they actually ran

| command | result |
|---|---|
| `npm run typecheck` | **exit 0**, no diagnostics |
| `npm test` | **exit 0** — `# tests 3790 / # pass 3789 / # fail 0 / # skipped 1`, 3.50s |
| `npm run lint` | **exit 0** — 0 errors, **2 warnings** (both the pre-existing `src/app/(tabs)/index.tsx:32,92` duplicate `upload-queue` import) |

**The suite still proves nothing about the two worst findings below.** Nothing
executes `holdQueuedJobs`, `releaseHeldJobs`, or the resume effect
(`grep -rln releaseHeldJobs tests/` → nothing). And no test anywhere composes
`favorExactCores` with `applyReactionMemory`, which is the only way they are
ever called — `tests/favorite-ranking.test.ts` and `tests/reaction-ranking.test.ts`
each exercise their own function in isolation, and the defect is in the seam.

---

## Ranked findings

### V2-1 — CONFIRMED, ship-blocker. The S1-1 repair traded a livelock for an unconditional infinite render loop, on the plainest path W-02 has

`src/app/capture.tsx:824-880`, dependency array at `:869-879`.

Removing `heldCount` from the deps was the wrong half. **`heldCapture` is still
a dependency (`capture.tsx:877`), and the effect unconditionally assigns it a
brand-new object on every run that is not `kind: 'all'`:**

```ts
      setHeldCapture({
        assets: heldCapture.assets.slice(verdict.accept),   // new array
        local: heldCapture.local,
        wall: verdict.kind === 'none' ? verdict.wall : 'active',
        used: verdict.used,
        limit: verdict.limit,
      });                                                    // new object
```

`Object.is(prev, next)` is false for a fresh object literal, so React
re-renders, the dep comparison fails, the effect re-runs, and it writes another
fresh object. There is no fixed point and nothing gates it — not `gatePresenting`
(false), not `capacity.loading` (false), not `resumeTick` (≥1 the moment
`useFocusEffect` fires), not the `!heldCapture && heldCount === 0` guard.
The previous version's `else` branch only called `setClosetFullVisible(true)`,
which is idempotent, so this loop is **new in this diff**.

Reproduction — verbatim effect body, the real `admitBatch`, verbatim copies of
`holdQueuedJobs` / `releaseHeldJobs` / `selectHeldJobs` / `selectPendingRowCount`,
and React's actual dep rule (`scratchpad/sim/capture-loop.ts`):

```
--- A. One photograph, active ceiling reached, no queue at all ---
{ runs: 200, settled: false, visionPasses: 0, refusals: 0, heldJobs: 0, heldAssets: 1 }

--- B. Three photographs, TOTAL ceiling (30 rows, 25 archived) ---
{ runs: 200, settled: false, visionPasses: 0, refusals: 0, heldJobs: 0, heldAssets: 3 }
```

Case A is *the* W-02 path: a free user at ten pieces photographs an eleventh.
No stale count, no `foldPlan` disagreement, no trial expiry, no queue at all —
none of S1-1's three preconditions is needed any more. `settleCapture`
(`capture.tsx:514-538`) sets `heldCapture`; on the next commit the effect takes
over and never lets go.

React 19.2.3 / RN 0.86.2: `NESTED_PASSIVE_UPDATE_LIMIT` is 50, but
`ReactFabric-dev.js:5111-5116` only `console.error`s on it and resets the
counter — it does not throw — and `ReactFabric-prod.js` carries no
`nestedPassiveUpdateCount` at all. So in a release build this is a **silent,
unbounded render loop**: the JS thread spins for as long as the closet-full
sheet is up, the modal re-renders every tick, and the screen is unresponsive.
In dev it also floods the log with "Maximum update depth exceeded … one of the
dependencies changes on every render", which is a literal description of this
line.

Narrow fix: don't write `heldCapture` when nothing changed — bail when
`verdict.accept === 0 && verdict.wall/used/limit` already match, or keep the
hold in a ref and drive the sheet off a separate scalar.

### V2-2 — CONFIRMED. The A28 defect the batch exists to fix is back in the `partial` case: unbounded Vision passes and unbounded `clothes_import_failed`

Same effect, same dependency. When some of the batch fits, each loop iteration
commits, drains, is refused, parks, releases, drains again:

```
--- C. Partial: 12 photographs, 3 slots free, count query does not move ---
{ runs: 200, settled: false, visionPasses: 202, refusals: 199, heldJobs: 3, heldAssets: 6 }
```

199 refused inserts and 202 on-device Vision passes in 200 effect runs — the
same shape as the 46-event storm the diff is meant to end, only faster, because
it is now driven by React's render loop rather than by `MAX_ATTEMPTS`.

**The `['closet-count']` invalidation does not close it.** I gave the harness a
count query that converges to the truth on the first refusal:

```
--- C2. Same, but the invalidation converges to the truth ---
{ runs: 200, settled: false, visionPasses: 3, refusals: 0, heldJobs: 0, heldAssets: 9 }
```

The Vision passes stop; the loop does not. Invalidation was the right fix for
the *queue* half and it works — see the answers below — but it has no bearing
on the `heldCapture` half.

**Answers to the questions the repair was supposed to settle:**

- *Is the loop bounded, and is "one extra cycle per focus / per capacity
  refetch" the real bound?* No, and no. The bound is the render loop, i.e.
  none. For the **queue-only** path (`heldCapture === null`), it genuinely is
  bounded — harness D (stale count reporting an empty closet, 3 parked jobs)
  settles in **1 effect run, 1 Vision pass, 1 refusal**, and the jobs stay
  parked. That half of the repair is correct.
- *Can the invalidation itself re-trigger the effect by flipping between error
  and success?* Yes in principle, and it is bounded in practice. Harness E
  alternates the count query between error (`used = 0`, `use-capacity.ts:87`)
  and success on every invalidation: it settles in **2 runs**, because the
  successful read admits nothing and the error read has already released
  everything there was to release. The flip only costs one extra cycle per
  flip. Not a finding.
- *Stale count / client plan outranking server / trialing snapshot.* All three
  still put the client above the server (`use-capacity.ts:87-100` unchanged;
  `foldPlan` still takes the higher of row and SDK at `use-plan.ts:171`;
  `trialing` is still computed inside the queryFn and cached at
  `use-plan.ts:151`, now with `refetchOnWindowFocus: true` behind the new
  `focusManager` wiring, which narrows but does not close it). They no longer
  *cause* the loop — V2-1 does that on its own — they just make the partial
  case (V2-2) reachable without any server-side disagreement at all.

### V2-3 — CONFIRMED. `applyReactionMemory` silently undoes `favorExactCores`. Composing them after each other cancels the favourites feature

`src/features/styling/use-outfits.ts:150-157`, with
`src/features/styling/favorite-ranking.ts:15-24` and
`src/features/styling/reaction-ranking.ts:83-89`.

`favorExactCores` computes `adjusted = candidate.score + FAVORITE_BONUS` and
**never writes it back** — it only reorders and returns the untouched
candidates. `applyReactionMemory` then re-sorts the list it was handed on
`c.score + signal * REACTION_DELTA` — the **raw** score. Any favourite the
bonus had promoted is demoted straight back, and the `|| a.index - b.index`
tie-break only preserves it when the raw scores are exactly equal.

Probe (`scratchpad/sim/reaction.run.ts`, real modules, `tests/helpers.garment`):

```
=== 1. Does applyReactionMemory preserve favorExactCores order? ===
after favorExactCores        : [ 'g2+g4+g5', 'g1+g4+g5' ]     <- favourite promoted
after applyReactionMemory    : [ 'g1+g4+g5', 'g2+g4+g5' ]
FAIL favourite promotion was UNDONE by the raw-score re-sort
no reactions at all          : [ 'g2+g4+g5', 'g1+g4+g5' ]
```

The reaction fed in was on a **completely unrelated core**. All it takes is one
row anywhere in the user's last two hundred reactions whose core still resolves;
after that the `reactions.length === 0` early return
(`reaction-ranking.ts:79`) stops firing and every favourite promotion in the
app is dead. Given the ledger's own "forty-three reactions from eight people",
that is most of the reacting cohort.

The module's own docblock — *"Twice `FAVORITE_BONUS`: an explicit 'no' outranks
an implicit 'yes'"* — states an intent to **compose** with the favourite bonus.
It cannot: the second ranker overwrites the first. Probe 2 shows the arithmetic:
a thumbs-up on a favourite scoring 0.79 against a rival at 0.80 wins by 0.06,
not by 0.09.

The two modules also disagree about what a core is — `favorite-ranking.ts:5`
joins **every** item id with `.`, `repeat.ts:47` joins only the counted kinds
with `·` — which is a second reason the "same reduction" claim in the A9
docblock does not hold across the pair.

Narrow fix: fold both adjustments in one sort, or have `favorExactCores`
return `{candidate, adjusted}` so the second stage can add to it.

### V2-4 — CONFIRMED. `isStale`'s tie rule is unreachable in production, and in the tie world the tests live in it drops paid plan changes

`supabase/functions/_shared/superwall-plan.ts:96-113`.

**(a) The tie branch never runs.** Both webhooks write
`new Date(x).toISOString()` (`superwall-webhook/index.ts:204`,
`asc-notifications/index.ts:271`) and both read the value back out of a
`timestamptz` column through PostgREST. Verified against the live database:

```sql
select to_jsonb('2026-02-01T00:00:00.000Z'::timestamptz);
-- "2026-02-01T00:00:00+00:00"
select to_jsonb('2026-02-01T12:34:56.789Z'::timestamptz);
-- "2026-02-01T12:34:56.789+00:00"
```

`isStale` compares those **as strings**. At index 19 the event has `.` (0x2E)
or `Z` (0x5A) where the stored value has `+` (0x2B), so an identical instant
compares as *strictly later*:

```
isStale('2026-02-01T00:00:00.000Z', '2026-02-01T00:00:00+00:00', false, 'pro') = false
isStale('2026-02-01T12:34:56.789Z', '2026-02-01T12:34:56.789+00:00', false, 'pro') = false
```

Every branch below `// A tie.` — the `revoking` rule, the `storedPlan !== 'free'`
rule, the whole subject of the S2-5 repair — is dead code against a real row.
`tests/superwall-plan.test.ts` passes only because it feeds both sides the same
string format. (Strictly-earlier and strictly-later still work, so the
guard is not useless; it has simply lost its equality case.)

**(b) Where the tie *is* reachable, it drops paid plan changes.** Modelling
both webhooks verbatim (read `{plan, current_period_end}`, `isStale`, write —
`scratchpad/sim/plan2.run.ts`) with byte-identical strings:

```
standard -> product_change(pro) at the same period end     => standard  <-- DROPPED as a replay
standard -> DID_CHANGE_RENEWAL_PREF UPGRADE(pro), same end => standard  <-- DROPPED
pro      -> product_change(standard) at the same end       => pro       <-- DROPPED
standard -> OFFER_REDEEMED(pro) at the same end            => standard  <-- DROPPED
```

"A grant at a tie against a paid row is a replay" cannot tell a replay from an
upgrade. A Standard subscriber who upgrades to Pro at an unchanged period end
pays for Pro and keeps Standard ceilings. Today (a) hides (b); fix the string
comparison without fixing the rule and (b) ships.

**(c) The 'free' escape hatch cannot tell a reversal from a late duplicate.**
Full enumeration across both sources (`scratchpad/sim/plan.run.ts`, 12
orderings × both string worlds). These land wrong in **both**:

```
FAIL 4.  renewal(E), expiration(E), svix REPLAY of renewal(E)  -> plan=pro   (expected free)
FAIL 6.  Apple DID_RENEW(E), Apple EXPIRED(E), Superwall renewal(E) -> plan=pro (expected free)
FAIL 12. renewal(E), expiration(E), uncancellation(E)          -> plan=pro   (expected free)
```

Case 6 is the realistic one: `asc-notifications` both settles the plan itself
*and* forwards the same Apple notification to Superwall
(`asc-plan.ts:SUPERWALL_FORWARD_URL`), so one Apple event produces two
independent writes to the same row with no ordering guarantee between them.
Case 4 is plain Svix at-least-once redelivery, which the function invites by
returning 500 on a read or write failure. `reconcile` reproduces it exactly:

```
reconcile([initial_purchase(E), expiration(E), renewal(E)]) -> { plan: 'pro', … }
```

Damage is bounded to three days by the new `effective_plan` slack, so this is
a downgrade of S2-5 rather than a re-opening of it.

**What the repair did fix, and I could not break:** `REFUND` → `REFUND_REVERSED`
at a tie now settles to `pro` in both string worlds (case 2), as does
`REVOKE` → re-grant (case 3). Out-of-order expiration of a superseded period
(case 7), `subscription_paused` with no date in both directions (cases 8, 9),
and Apple-then-Superwall double revocation (case 5) all behave. Both webhooks
do now `select plan, current_period_end`, and `reconcile` does pass `best.plan`.

### V2-5 — CONFIRMED (half-repaired). `admitBatch`'s `partial` branch carries no `wall`, so a hold at the TOTAL ceiling is still labelled and remedied as an active one

`src/features/ingest/batch-capacity.ts:100-107` (the `partial` return has no
`wall` field) and `src/app/capture.tsx:864` —
`wall: verdict.kind === 'none' ? verdict.wall : 'active'`.

Probe (`scratchpad/sim/wall.run.ts`), free plan, 29 rows of which 24 archived:

```
pick 3 with ONE total slot left: { kind: 'partial', accept: 1, hold: 2, used: 5, limit: 10 }
  -> capture.tsx forces wall = 'active'
  -> sheet title  : "Your closet is full at 10."      (the ACTIVE ceiling; used is 5)
  -> sheet second : "Make room for it" -> /wall-swap
  -> the binding ceiling is TOTAL: archiving does not lower `stored`.
```

That is the exact dead end `batch-capacity.ts`'s own docblock says the
two-ceiling design exists to remove, still reachable — just now only in the
partial case rather than in every case. `pendingRows` widens it: with two
photographs already queued and three total slots left, a pick of five is
`partial` at the total wall too.

Two smaller things in the same repair:

- **`heldCapture.used` is dead.** `grep -n 'heldCapture\.' src/app/capture.tsx`
  shows `wall`, `limit`, `assets` and `local` read; `used` is written at
  `:865` and `:534` and never rendered. The sheet body at `capture.tsx:1650`
  still prints `capacity.used`, so at the total ceiling the title says
  "Your account holds 30 pieces" over a body that says "Your 5 pieces make N
  outfits today".
- **The amber plate re-derives the wall from `capacity.storageFull`**
  (`capture.tsx:1222-1226`) rather than from the jobs' recorded wall — correct
  when the count is fresh, wrong for exactly the stale-count case the queue
  hold exists for.

### V2-6 — CONFIRMED (partially repaired). "Zero filed" is gone; "Filing three pieces" replaced it, and the close disc is still trapped

`allDone` now requires `heldCount === 0` (`capture.tsx:957`) and that does fix
the worst of S1-2. Verified with the real `capture-spec` helpers
(`scratchpad/sim/s12.run.ts`), a batch of three refused whole:

```
{ total: 3, active: 0, heldCount: 3, allDone: false }
masthead title  : Filing three pieces
masthead sub    : three to go
rows            : 3 × { status: 'Waiting for room', tone: 'waiting' }
plate body      : Three photographs are waiting for room — your closet is full at 10. …
celebration     : null
SettledGrid?    : no — the row list is drawn
```

So: no "Zero filed", no empty `SettledGrid`, no celebration, and the new
`ROW_STATUS_WAITING_FOR_ROOM` string and `held` tone are now genuinely reached.
What is left:

- **The masthead lies in the other direction.** "Filing three pieces ·
  three to go" over three photographs that are not filing and will not move
  until a person acts. Mixed batch: "Filing five pieces · Two filed · three
  to go" (`filingSubline` counts `held` under "to go").
- **The close disc is still trapped.** `leaveStage` (`capture.tsx:1098-1104`)
  routes the X to the batch surface whenever `total > 0`; held jobs survive
  `clearSettled` (`queue-store.ts:252`), `hydrate` (`:193`) and the unmount
  sweep (`capture.tsx:1086`, which is gated on `selectActiveCount === 0` and
  so *fires* while held jobs remain, removing only done/failed). A user with a
  parked photograph can never dismiss `/capture` with the X — it now lands on
  "Filing three pieces" instead of "Zero filed".
- **Frame 18 undercounts.** `resumeVisible` and `resumeBody` both read
  `selectActiveCount`, which excludes held; `SettledGrid` draws
  `jobs.slice(0, 6)`, which does not. With 2 active + 3 held the body says
  "Two pieces are still here" above five thumbnails. With *only* held jobs,
  `resumeVisible` is false and frame 18 never offers them at all.
- **`the-ten.tsx`** now maps `held` → `processing-failed`, but only in the
  *replacement* reducer (`:308`). The primary Ten path is untouched:
  `settling` reads `selectActiveCount` (`:479`) so it goes false with a
  photograph parked, `selectPhaseLabel` still has no `held` branch
  (`queue-store.ts:328-339`, returns `null`), and `ten-camera.tsx:87-94` fills
  a slot only on `job.itemId`. A held job in the guided ten leaves the slot
  permanently empty with nothing on screen saying why — S3-7 unchanged.

### V2-7 — CONFIRMED. Reaction memory false-matches when a counted item has been deleted

`reaction-ranking.ts:59` → `repeat.ts:43-45`. `coreIdsOf` filters the row's
`item_ids` down to ids still present in the wardrobe, so a deleted item
silently **shrinks the key** rather than invalidating the row:

```
=== 3. coreKey identity: reaction row vs candidate ===
candidate core: g1·g3·g4·g5
row core      : g1·g3·g4·g5
OK   layered candidate and its reaction row agree (mid_layer counts as a top)

row (top, bottom, DELETED shoe) core : g1·g4
shoeless candidate core              : g1·g4
FALSE MATCH: a reaction to (top,bottom,DELETED shoe) now penalises (top,bottom)
```

A thumbs-down on an outfit whose shoes were later deleted becomes a
thumbs-down on the shoeless pairing — a different outfit the user never
refused. `possibleCores` learned to build shoeless cores in this same diff
(`repeat.ts:71`), which is what makes the collision reachable: twelve of the
twenty-five live closets hold no shoes. Reaction rows where *every* counted
item is gone are correctly skipped (`if (!key) continue`, verified).

The rest of the A9 mechanics hold up:

- **Layered candidates match their rows.** `kindOfSlot` maps `mid_layer` to
  `tops` (`outfit-count.ts:92`), so a top+mid+bottom+shoes candidate and its
  six-id reaction row reduce to the same four-id key; the bag and the coat drop
  out of both. Confirmed above.
- **`item_ids` exists as claimed.** `src/types/database.ts:1852` —
  `item_ids: string[]`, non-null, and `reaction: number`.
- **The read is not blocked.** `grant select … on outfit_reactions to
  authenticated` (`20260806100000:39`), owner-scoped RLS select policy
  (`20260803210000:123`), and `outfit_reactions_user_created_idx (user_id,
  created_at desc)` (`:119`) serves the query's exact order. The
  `20260819000000` normalisation only revokes from `anon`.
- **Decay and clamp.** The fold `prev*0.5 + vote` converges to ±2, so the
  clamp is load-bearing, not decorative: eight same-day thumbs-down give
  `-1.992188` pre-clamp, `-1` after. A year-old thumbs-down decays to
  `-0.0036`. Bounded contribution is therefore exactly ±`REACTION_DELTA`
  (0.06). A future-dated row and an **unparseable `created_at`** both land on
  full weight (`Number.isFinite` → `ageDays = 0`); defensible, worth knowing.
- **Render identity.** `reactions.data` is stable across renders under React
  Query's default structural sharing, so the memo does not recompute on every
  render; Today's cards change only when the reaction set actually changes.
  Reacting *does* re-order the visible cards immediately (the invalidation at
  `mutations.ts:215` → refetch → new `shortlist`), which is the same behaviour
  the existing `style-profile` `setQueryData` already produced. Not new.
- **`['outfit-reactions']` is correctly absent from `PERSISTED_KEYS`** and
  correctly unscoped by user, matching `['wardrobe']`, `['style-profile']` and
  `['favorite-outfits']`; `useSession` calls `qc.clear()` on auth transitions
  (`use-session.ts:52`). One consequence worth naming: the persisted set is
  documented as "exactly what `generateOutfits` needs", and the shortlist now
  depends on a query that is not persisted, so a cold offline start ranks
  without reaction memory. `favorite-outfits` already had this gap.
- **Double-counting with `apply_outfit_reaction`.** The two do act on the same
  opinion — the RPC moves `style_profiles.weights`, which changes `c.score`,
  and this then adds up to ±0.06 on top. They operate at different granularity
  (attribute vs exact core) and the total is bounded, so I could not construct
  an ordering flip from it alone. The flip I *could* construct is V2-3.
- **Retraction ordering.** `void qc.invalidateQueries(['outfit-reactions'])` at
  `mutations.ts:215` runs before the `next.cleared` early return, so a
  retraction does invalidate. It is fire-and-forget, so the next generation
  within the same tick still sees the stale list; the one after the refetch
  lands does not. Acceptable.

### V2-8 — CONFIRMED (residual). Four first-pass findings are untouched

- **S3-8.** `releaseHeldJobs` still resets `attempts: 0` and `tagAttempts: 0`
  (`upload-queue.ts:872-873`). A job that has been held once starts its
  `MAX_ATTEMPTS` budget over.
- **S3-9.** `releaseHeldJobs` still has exactly one call site
  (`capture.tsx:838`). Improved: that effect now runs for queue-held jobs with
  no `heldCapture` and settles in one pass (harness D), so a focus of
  `/capture` does sweep them. But `resumeVisible` is false on a cold launch
  with only held jobs, and nothing outside `/capture` releases anything.
- **S3-11.** `holdQueuedJobs` still skips any job whose stage is not `'queued'`
  (`upload-queue.ts:846`), so the up-to-two other in-flight jobs run on, meet
  the same trigger, and each fire `trackImportFailed`. The `posthog.tsx:569`
  docblock's "ONCE per batch" is still 1–3.
- **S4 word collision.** `filingRows(held, { held: true })` still returns
  `'Held'` rather than `'Waiting for room'` — `opts.held` wins at
  `capture-spec.ts:483-489`. Offline + parked reads as the offline word.

### V2-9 — CONFIRMED, new. `effective_plan` now lifts a LAPSED PAID row on a live trial, contradicting its own comment

`supabase/migrations/20260903000000_effective_plan_honours_period_end.sql`.

The `case` reordering means a paid row that fails the new period-end guard no
longer returns `s.plan`; it **falls through to the next `when`**, which is the
trial fold. A lapsed `standard` row with a live `trial_ends_at` therefore
returns `pro` — a plan the user has never held. The old body caught paid rows
first, so the trial fold really did only lift free rows. Both the migration
docblock ("The trial fold is unchanged: it lifts only a FREE row") and the
`comment on function` ("a live trial_ends_at lifts only a free row to pro")
now describe behaviour the function does not have. The client mirror
(`use-plan.ts:174`) gets this right — `rowPlan !== 'free' ? rowPlan : trialing
? 'pro' : 'free'` — so the two disagree in exactly the case the migration was
written to make them agree about.

### V2-10 — PLAUSIBLE, low. The sheet can flash back after a successful purchase

`capture.tsx:753-773`. `.finally` bumps `resumeTick` as soon as
`gate.present` settles. On `'granted'` the `onGranted` callback does `await`
both invalidations, and `invalidateQueries` awaits active refetches, so the
count and the subscription should be fresh by then — but the plan the *server*
returns depends on a Superwall/Apple webhook that may not have landed
(memory `cinch-superwall-webhook-gap`: never proven with a real transaction).
`foldPlan(rowPlan, sdkPlan)` should cover it from the on-device entitlement; if
the SDK's status has not flipped either, the effect re-settles against the old
ceiling and puts "Your closet is full at 10" back up immediately after a
purchase. Then V2-1 spins on it.

---

## What I attacked and could not break

- **S2-4 is properly repaired.** `presentTimer` is a ref, cleared by a mount
  cleanup (`capture.tsx:748-753`); `if (presentTimer.current) return` makes the
  scheduling single-flight, and `AmberPlate`'s `disabled={busy}` plus the
  sheet's `seePlansBusy` cover the window after the timer fires. The
  `gatePresenting` guard at the top of the resume effect (`:824`) genuinely
  closes the "sheet re-raises inside the 400 ms while Superwall is coming up"
  hole — a concurrent `invalidateAfterItemSettled()` cannot re-open the modal.
  `'unavailable'` now bumps `resumeTick` like every other outcome, so the
  caller's own refusal copy comes back. On unmount inside the window the timer
  is cleared and Superwall is not presented over another screen. All four
  attacks fail.
- **The queue half of S1-1.** Harnesses D and E: a stale count that reports an
  empty closet costs exactly one release, one Vision pass, one refusal and one
  event, then settles; an error↔success flip costs one extra cycle per flip.
  The `['closet-count']` invalidation in the capacity branch
  (`upload-queue.ts:930`) does what it claims.
- **Item 6 (`garment.ts`).** Probed against the real `toGarment`
  (`scratchpad/sim/garment.run.ts`, with `pattern_scale` as the top-level
  column it actually is): `pattern='solid', pattern_scale='small'` → `'none'`
  (the four live rows fixed); `pattern=null, pattern_scale='small'` →
  `'small'` (S3-10 fixed); `pattern='striped', pattern_scale='large'` →
  `'large'` (the column still wins where it should). Only cosmetic asymmetry:
  `pattern=''` keeps the stored scale while `pattern='  '` forces `'none'`.
- **Classification order (S4).** `closet_limit_reached` /
  `storage_limit_reached` are now tested **before** `photo_unreadable`
  (`import-failure-classify.ts:68-73`), so the hold decision and the analytics
  label agree on the same string.
- **`withDeadline` unhandled rejections (S4).** Every one of the five
  `getUserId()` call sites now ends `.catch(() => null)`
  (`upload-queue.ts:722, 1096, 1237, 1449`). The remaining `void
  sweepPendingTags()` / `void retryCutout(...)` calls are unguarded but their
  internal `getUserId` is, which was the reported hang.
- **A16 revert and doc rot.** No reference to `import-failure-grace`,
  `withinImportFailureGrace` or `recordImportFailure` survives anywhere in
  `src/`, `supabase/` or `scripts/` — only the two `doesNotMatch` assertions
  asserting their absence. `posthog.tsx:268` now correctly cites
  `planFailureReason`.
- **`possibleCores` / `repeat.ts` shoeless change.** Unchanged from the first
  pass; still exact against `countOutfits`.
- **`focusManager` wiring.** Global default stays `refetchOnWindowFocus:
  false`; only `['subscription', userId]` opts in. No test imports
  `query-client.ts`, so the module-scope `AppState.addEventListener` does not
  run in the node suite.

---

## Recommended gate before this batch ships

**V2-1 and V2-3.** V2-1 is strictly worse than the defect it replaced: it is an
unbounded render loop on the ordinary "closet is full" path, needs none of the
three preconditions S1-1 needed, and is silent in a release build. V2-3 turns
the favourites feature off for anyone who has ever tapped a thumb, in a diff
whose stated purpose is to make thumbs matter. Both are one-line-shaped fixes
and both are invisible to `npm test` as it stands.

V2-4(b) should be fixed before the string comparison in V2-4(a) is — fixing
the comparison first would ship the dropped-upgrade bug.
