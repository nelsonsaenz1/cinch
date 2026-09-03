# Lifecycle, race and state-machine audit — 2026-09-02

Scope: root/tab layouts, auth + deep links, upload queue, billing gate, expo-updates,
Superwall reconciliation, zustand/React Query lifecycle. Read-only pass at HEAD `2042de2`.
Nothing under `src/`, `supabase/`, `tests/` or `scripts/` was modified.

Severity: **S1** user-visible data or revenue loss · **S2** wrong state a user acts on ·
**S3** degraded/confusing · **S4** latent.

---

## Summary table

| # | Sev | Title | Site |
|---|-----|-------|------|
| 1 | S1 | Capacity refusal is not a stop condition — 46 photos become 138 refused inserts and 138 Vision passes | `upload-queue.ts:880-937` |
| 2 | S1 | The cap-caused failure opens the grace window that hides the cap paywall (A16 ⊗ A28) | `upload-queue.ts:210-225`, `use-gate.ts:485-488` |
| 3 | S1 | `getUserId()` has no deadline inside three one-shot latches — a hung auth call bricks the queue, the sweep and the backfill for the process | `upload-queue.ts:769, 1067, 1208` |
| 4 | S2 | "See plans" on the closet-full sheet presents Superwall *under* a live RN `Modal` — 8 seconds of nothing, then `paywall_unavailable/no_response` | `capture.tsx:693-706`, `closet-full-sheet.tsx:122` |
| 5 | S2 | `onGranted` commits the held photo into a closet the server still calls full | `capture.tsx:696-704` |
| 6 | S2 | `refetchOnWindowFocus` is globally off and no `focusManager` exists — three files document a plan refresh that never happens | `query-client.ts:27`, `use-plan.ts:100`, `use-restore-purchases.ts:62` |
| 7 | S2 | Client trial fold outranks a paid plan; the server's does not (expires 2026-09-03 14:00Z) | `use-plan.ts:141` vs `20260901000000:100-116` |
| 8 | S2 | A failed `identify()` is latched — the purchase that follows is filed to an alias already marked reconciled | `superwall.tsx:87-88`, `use-alias-reconcile.ts:56` |
| 9 | S3 | `Updates.reloadAsync()` has no idle gate — offered and taken mid-upload, mid-purchase, over any modal | `update-coordinator.tsx:39-68, 96-99` |
| 10 | S3 | `trial_expired` spends its once-per-lapse marker when it loses the `inFlight` race to `returning_free` | `trial-expired-core.ts:67-70`, `use-gate.ts:474` |
| 11 | S3 | 16 independent `useSession` subscriptions each call `qc.clear()`; Apple's first sign-in fires a second storm via `USER_UPDATED` | `use-session.ts:45-54`, `actions.ts:149` |
| 12 | S3 | Invite deep link navigates twice on the signed-out → signed-in transition | `use-invite-deep-link.ts:100`, `handoff.tsx:148` |
| 13 | S3 | Every queue `update()` does a synchronous SQLite write of the whole job array, on every upload progress tick | `queue-store.ts:224-228` |
| 14 | S3 | Profile-flag writes have no PostgREST receipt — the lesson `item-write.ts` documents is not applied | `tour-queries.ts:84-92`, `reveal-seen.ts`, `use-lifestyle.ts` |
| 15 | S3 | An interrupted `useRetagItem` permanently unverifies a verified item | `closet/mutations.ts:485-495` |
| 16 | S4 | `capacity.full` is false while the count is pending; nothing trims a batch to `remaining` | `use-capacity.ts:100`, `use-capture.ts:109-118` |
| 17 | S4 | Provider-order surface today: `UpdateCoordinator` is the one component above `<Superwall>` | `_layout.tsx:337` |

---

## 1 · S1 — The queue does not stop on a capacity refusal

**The path, exactly.** `items_enforce_limit` (migration `20260808190100:78`) raises
`closet_limit_reached: N of M garments` with `errcode = 'check_violation'` (SQLSTATE 23514).
That surfaces in `processJob` at `upload-queue.ts:800-802`:

```ts
if (error || !data)
  throw new Error(`Could not create item [${error?.code ?? 'no_code'}]: ${error?.message}`);
```

The throw is caught by the drain loop's `.catch` (`upload-queue.ts:903-935`):

```ts
const exhausted = attempts >= MAX_ATTEMPTS;          // MAX_ATTEMPTS = 3
useQueueStore.getState().update(next.id, {
  stage: exhausted ? 'failed' : 'queued', ...
});
if (exhausted) trackImportFailed({ stage: diedAt, error: message, retryable: true, attempts });
```

A non-exhausted job goes straight back to `'queued'` — and the `for(;;)` loop above it
(`upload-queue.ts:888`) re-finds it on the very next iteration. **There is no backoff on the
whole-job retry path** (only tagging has one, `TAG_RETRY_DELAY_MS` at line 473).

**For a 46-photo batch against a full closet:**

- 46 jobs × 3 attempts = **138 `items` INSERTs**, all refused, back to back at concurrency 3.
- Each attempt re-runs the full local pipeline first: `prepareForUpload` + `prepareThumbnail` +
  `runCutout` (a native Vision pass, `upload-queue.ts:780-788`). So **138 full-resolution Vision
  passes**. The file's own header (lines 52-54) says the cutout step "will get the app killed by iOS
  jetsam mid-import" — this is that load, tripled, for zero rows written.
- **Exactly 46 `clothes_import_failed` events**, one per job, on the third attempt only.
- Every one carries `reason: 'row_write_failed'` (`analyticsFailureReason`, `upload-queue.ts:170`
  matches `/Could not create item/`) and `code: '23514'` (`analyticsFailureCode`, line 195).
- `stage` is **`'cutout'`**, not anything to do with a write: `diedAt` is read from the store
  (line 917) and the last stage set before the insert is `update(job.id, { stage: 'cutout' })`
  at line 788. This is why A15's `row_write_failed` events looked like a device problem.
- The toast: `userFacingFailure` (line 115) matches neither the consent branch nor
  `/decode|unsupported|corrupt|read the image|prepare/`, so it falls through to
  **"That upload didn't finish."** — a transfer-failure sentence for a quota refusal.
- `retryable: true`, so the banner offers Retry. `retryJob` (line 1306) sees no `itemId`, resets
  `attempts: 0` and puts the job back through the queue: **another 3 refusals and 3 Vision
  passes per garment**. "Try all again" (`retryFailedJobs`, line 1351) does that for all 46.

This is ledger A28 in full: 46 `row_write_failed` after `active_full`, with the cause visible
in `code: '23514'` all along.

**What a stop condition would look like** (not applied — audit only): the refusal is already
classifiable — `use-gate.ts:57` recognises `closet_limit_reached` and returns
`{ kind: 'closet_full' }`. Nothing on the queue path calls `classifyDenial`. An account-wide
refusal already has a precedent in this file (`TagOutcome.accountWide`, `upload-queue.ts:253`,
which aborts the rest of a sweep batch); the insert path has no equivalent.

**Discriminating test.** PostHog: `clothes_import_failed` where `reason = 'row_write_failed'`,
split by `code`. If `23514` dominates, every one of those is the cap and not a defect. If
`no_code` or `PGRST301` dominates, it is A15's separate unknown and this finding does not
explain it.

---

## 2 · S1 — The cap-caused failure suppresses the cap paywall

`trackImportFailed` is the single door for every terminal failure, and it is unconditional
(`upload-queue.ts:210-225`):

```ts
function trackImportFailed(props: {...}): void {
  recordImportFailure();                 // opens the 10-minute window
  track('clothes_import_failed', {...});
}
```

`use-gate.ts:485-488` then refuses the one placement that would have explained the situation:

```ts
if (placement === Placement.AddGarmentOverLimit && withinImportFailureGrace()) {
  track('paywall_eligible', { placement, eligible: false, reason: 'import_failure_grace' });
  return 'unavailable';
}
```

So: closet full → 46 refusals → 46 calls to `recordImportFailure()` → for the next ten minutes
the closet-full paywall cannot present, while the user holds 46 photos and a banner that says
"That upload didn't finish."

### The A16 questions, answered

**Keyed per user or per device?** Neither. `lastFailureAtMs` is a bare module variable
(`import-failure-grace.ts:34`) — **per JS process**. Sign out and sign in as a second account
inside ten minutes and account B's paywall is suppressed by account A's failures. There is no
user id anywhere in the module.

**Survives restart?** No, and deliberately (`import-failure-grace.ts:24-28`: "a process restart
starting the window fresh is acceptable"). Note the interaction with finding 9: an
expo-updates reload silently clears the window mid-wound.

**Does it suppress the wall for failures the cap itself caused?** Yes, and that is now the
dominant case. The module's own header states the assumption in as many words
(`import-failure-grace.ts:14-16`): *"The rule is deliberately flat — it does not ask WHY the
import failed."* **The code currently assumes every terminal failure is a defect.** Per A28,
the modal `row_write_failed` today is `23514` — the cap doing its job.

**Both readings, honestly:**

- *Keep suppressing.* From the user's chair the app dropped 46 photographs and then asked for
  money; that is the Acloset mechanic the file was written to avoid, and the banner already on
  screen ("That upload didn't finish") makes a paywall read as an upsell for a bug. Being wrong
  here costs a delayed ask.
- *Show the wall.* When the failure **is** `closet_limit_reached`, the wall is not an ask — it
  is the missing explanation. Suppressing it leaves the user with a factually false sentence
  and no route out; the "make room" and "see plans" exits are the only true things anyone could
  tell them. Being wrong here costs a paywall shown to a person who was genuinely failed.

The disagreement dissolves once the classification exists: the honest fix is upstream —
`analyticsFailureReason` should return a distinct `closet_full` for `23514` /
`closet_limit_reached`, `trackImportFailed` should not call `recordImportFailure()` for it, and
the queue should stop rather than retry (finding 1). The grace then does exactly what its
docblock claims and nothing more.

**Discriminating test.** Compare, over the same window, `clothes_import_failed` with
`code = '23514'` against `paywall_eligible` with `reason = 'import_failure_grace'`. If the
second closely trails the first, the grace is being fed by the cap, not by defects.

---

## 3 · S1 — Unbounded `getUserId()` inside one-shot latches

`closet/session.ts:9-30` documents, at length, that `supabase.auth.getClaims()` (which is what
`getUserId()` calls, `lib/supabase.ts:292`) **round-trips on Hermes and can pend forever** —
"React Query's `retry` never engages, because retries fire on *rejection* and a hung promise
never rejects." The closet read path was given `withDeadline` for exactly this.

Three call sites in the ingest layer have no deadline, and each sits inside a latch:

| Site | Latch | Consequence of a hang |
|---|---|---|
| `upload-queue.ts:769` (`processJob`) | `running`/`draining` | `running` never decrements; `drainQueue`'s `for(;;)` spins forever at 120 ms (line 892/897) and `draining` stays `true` (line 882) — **no future drain can ever start** |
| `upload-queue.ts:1067` (`sweepPendingTags`) | `sweeping = true` (line 1064) | `finally { sweeping = false }` never runs — **no sweep for the life of the process** |
| `upload-queue.ts:1208` (`startBackfill`) | `backfilling = true` (line 1205) | same shape |

The `try/finally` blocks do not help: a promise that never settles never reaches `finally`.
The user-visible shape is the "it just continuously loads and loads" the tagging ceiling
(`upload-queue.ts:65-76`) was introduced to fix, reappearing one layer up — the rail sits at
`Preparing…`, `selectActiveCount` keeps counting the job, and nothing terminates.

`hasAiConsent` (`upload-queue.ts:530-539`) has the same exposure plus a second problem: it uses
`.single()`, so a *missing* `profiles` row (the sign-up → trigger window) returns `false`,
which parks `nextSweepAt` a full `SWEEP_MAX_INTERVAL_MS` (30 minutes) out at line 1074 — the
one branch that deliberately does not back off is the one that produces the longest silence.

**Discriminating test.** Supabase auth logs during a stalled import: auth traffic present and
zero `POST /rest/v1/items` — the exact signature `closet/session.ts:29-30` records for the
earlier occurrence of this bug.

---

## 4 · S2 — Superwall presented under a live `Modal`

`ClosetFullSheet` is a real React Native `<Modal transparent>` (`closet-full-sheet.tsx:122`),
i.e. a presented `UIViewController`. `seePlansForHeldCapture` (`capture.tsx:693-706`) calls
`gate.present(...)` **without first hiding it** — `setClosetFullVisible(false)` happens only
inside `onGranted`, at line 703.

iOS refuses to present a view controller over one that is already presented. This app knows
that in three other places and defers around it:

- `add-clothes.tsx:186-192` — `openPending` runs on `onDismissed`, with the reason spelled out.
- `find-photo.tsx:102-106` — "iOS refuses to run anything modal while this modal is still leaving".
- `capture.tsx:683` — `deferResume`'s 450 ms.

The closet-full "See plans" is the one that does not. What the SDK reports for a refused
presentation is: **nothing at all reaches `usePlacement`** — no `onPresent`, no `onError`. The
only thing that fires is the watchdog armed at `use-gate.ts:506`:

```ts
arm(target, PRESENT_TIMEOUT_MS, 'unavailable', 'no_response');   // 8_000 ms
```

So the button spins (`seePlansBusy={gatePresenting}`, `capture.tsx:1482`) for **eight seconds**,
then resolves `unavailable`, emits `paywall_unavailable { reason: 'no_response' }`
(`use-gate.ts:368`), and leaves the sheet exactly as it was. This is a plausible contributor to
A19 (`paywall_impressions` incomplete).

**Two explanations fit "the closet-full paywall never shows".** (a) This — iOS refusing under
the modal. (b) Finding 2 — the import-failure grace eating it. They are distinguishable in the
data: (a) emits `paywall_unavailable { placement: 'add_garment_over_limit', reason: 'no_response' }`
after an 8-second delay; (b) emits `paywall_eligible { eligible: false, reason: 'import_failure_grace' }`
instantly and never reaches the SDK at all.

---

## 5 · S2 — `onGranted` commits into a closet the server still refuses

Same callback (`capture.tsx:696-704`):

```ts
.present(Placement.AddGarmentOverLimit, async () => {
  await Promise.all([
    qc.invalidateQueries({ queryKey: ['subscription'] }),
    qc.invalidateQueries({ queryKey: ['closet-count'] }),
  ]);
  if (heldCapture) commit(heldCapture.assets, { local: heldCapture.local });
  ...
})
```

Two independent problems.

**(a) `onGranted` is not "they paid".** `use-gate.ts:115-125` states it plainly: paywall 254200,
which every live campaign points at, is `non_gated`, so **the feature block runs on dismissal
too**. A user who opens the paywall and closes it takes this exact path.

**(b) Even for a real purchase, the row lags.** The entire justification for `plan-fold.ts`
(lines 7-14) is that `subscriptions.plan` is written by `superwall-webhook` "seconds — or, if
the endpoint is ever misconfigured, never — after a purchase". But `items_enforce_limit` calls
`effective_plan()`, which reads *that row*. So `commit()` enqueues, `drainQueue` inserts, and
the trigger refuses on the old plan.

The invalidation does not save it: `invalidateQueries` awaits the refetch, and the refetch
returns the pre-webhook `free` — then caches it as **fresh** for another 5 minutes
(`use-plan.ts:102`). The client fold hides this in the UI (`useSdkPlan` raises the plan) while
the server keeps refusing, which is the worst of both: Pro chrome, free enforcement.

Net effect: a user who just paid at the closet-full wall gets "That upload didn't finish." on
the photograph they paid to keep, and 46 more if it was a batch — straight into finding 1's
retry storm, and finding 2's grace window then suppresses the paywall they *just bought from*.

---

## 6 · S2 — The plan refresh that three files document and none performs

`query-client.ts:27` sets `refetchOnWindowFocus: false` as a global default. `usePlan`
(`use-plan.ts:96-136`) does **not** override it. There is also **no `focusManager` wiring
anywhere in `src/`** (`grep -rn "focusManager\|onlineManager" src/` returns only two comments
saying there is none, at `(tabs)/index.tsx:874` and `people-search-spec.ts:135`), so
`refetchOnWindowFocus` could not work even if it were enabled — React Query has no
`AppState` bridge here.

Three docblocks assert otherwise:

- `use-plan.ts:100-101` — *"Refetching on focus catches the purchase that happened in the App Store sheet"*
- `use-restore-purchases.ts:62` — *"usePlan's refetch-on-focus would catch it eventually regardless"*
- `analytics-properties.tsx:36` — *"`usePlan` refetches on focus"*

**What actually refetches `['subscription', userId]`:** (1) a *new* observer mounting while the
data is stale — an already-mounted observer, such as the permanently-mounted
`AnalyticsProperties`, never triggers one; (2) the nine explicit
`invalidateQueries({ queryKey: ['subscription'] })` call sites. Nothing else. No interval, no
focus, no reconnect.

### The A27 question, answered

**After 2026-09-03 14:00Z, what does the fold return for `plan='free'` + past `trial_ends_at`?**
`'free'`, correctly. `trialing` is computed inside `queryFn` (`use-plan.ts:130`) as
`new Date(trialEnds).getTime() > Date.now()` → `false`; line 141 takes `data.plan ?? 'free'`;
`foldPlan('free', null)` → `'free'` (`plan-fold.ts:28-29`). This matches the server's new
`effective_plan` (`20260901000000:100-116`) exactly.

**Is there a persisted query that keeps `trialing` true for hours?** **No.** `PERSISTED_KEYS`
is `{closet, wardrobe, style-profile, trips}` (`query-client.ts:81`) — `'subscription'` is not
in the allowlist, so nothing about the plan is written to SQLite and a cold start always
re-reads. (Note the stale comment at `use-alias-reconcile.ts:78-79` claiming the plan cache "is
persisted across launches" — it is not.)

**What can still keep it stale, and for how long:** the in-memory entry, `staleTime` 5 min,
`gcTime` 24 h. Because focus does not refetch, a session that stays in one screen — or that
backgrounds and foregrounds without mounting a new `usePlan` consumer — holds `trialing: true`
across 14:00Z **for the life of the process**. In practice navigating to Closet/Today/Profile
mounts a fresh observer and corrects it within one navigation after the 5-minute window. The
exposure is bounded (client-side draw only; every AI call re-derives from the row) but it is
longer than the docblock claims and unbounded in the pathological case.

---

## 7 · S2 — Client trial fold outranks a paid plan; the server's does not

`use-plan.ts:141`:

```ts
const plan: Plan = foldPlan(trialing ? 'pro' : (data?.plan ?? 'free'), sdkPlan);
```

`trialing` wins **unconditionally**, including over `plan = 'standard'`. The server does the
opposite, and migration `20260901000000` (lines 82-93) exists precisely to have fixed it:

> *"`effective_plan()`'s unconditional fold is a downgrade mask: a user who BUYS Standard
> mid-trial keeps reading as `pro` until the trial lapses"*

The server's new order is paid → trial → row plan (`20260901000000:104-115`). **The client was
never updated to match.** For the ≤33 legacy-trial rows, a user who converts to Standard before
their `trial_ends_at`:

- reads `plan = 'pro'` everywhere in the UI;
- gets `PLANS['pro'].items` as their ceiling in `useCapacity` (`use-capacity.ts:61`), so
  `capacity.full` stays `false` well past the Standard cap;
- and is therefore fed straight into finding 1 — the client promises room the trigger refuses,
  which `use-capacity.ts:48-49` names as "the expensive place to be wrong".

This is time-boxed: A27 ends every legacy trial at 2026-09-03 14:00Z, after which `trialing` is
`false` for the whole cohort and the divergence closes on its own. Worth fixing anyway — the two
folds should not disagree, and `trial_eligibility.ts` / a future win-back re-opens it.

---

## 8 · S2 — A failed `identify()` is latched, and the alias is marked spent

`superwall.tsx:86-112`:

```ts
if (identified.current === userId) return;
identified.current = userId;              // ← set BEFORE identify resolves
...
identify(userId, { restorePaywallAssignments: true }).catch((error) => {
  console.warn('Superwall identify failed; paywalls stay anonymous.', error);
});
```

The ref is claimed before the call, and the rejection only warns. **A configure timeout is
therefore permanent for the session** — nothing retries, and the effect will not re-enter
because the ref matches.

The `use-alias-reconcile` marker compounds it (`use-alias-reconcile.ts:54-75`): the reconcile
runs at sign-in with the anonymous alias, and the marker `${userId}:${alias}` is written on
**any settled answer, including `reconciled: false`**.

Interleaving that loses money:

1. Launch, sign in. `identify()` rejects (configure timeout). `identified.current` is latched.
2. `reconcileAlias(userId, aliasA)` runs → server has nothing queued → `reconciled: false` →
   `AsyncStorage['cinch.aliasReconciledFor'] = "user:aliasA"`.
3. Later in the same session the user **buys**. Because `identify` never landed, Superwall
   attributes the transaction to `aliasA`; `superwall-webhook` finds no user mapping and queues
   it in `superwall_events` — no plan is written.
4. Next launch, `refresh()` returns the same `aliasA` → `offered === marker` →
   **early return at line 56.** The queued purchase is never claimed.

The client still *looks* right, which is what makes it quiet: `useSdkPlan` reads StoreKit
directly and raises the plan to Pro. But `plan-fold.ts:16-17` is explicit that "the server stays
the authority for spend" — so the user sees Pro chrome and every metered AI call is refused on
the `free` row, and `classifyDenial` → `gate.present()` shows them a paywall for a subscription
they already own.

**Discriminating test.** The `superwall_unreconciled` operator view named at
`use-alias-reconcile.ts:70`. Rows there whose alias also appears in a device's
`cinch.aliasReconciledFor` are this bug; rows with no marker are an ordinary in-flight case.

---

## 9 · S3 — expo-updates reload has no idle gate

`update-coordinator.tsx:96-99` fetches and immediately offers:

```ts
await Updates.fetchUpdateAsync();
track('update_downloaded', { trigger });
offerRestart();                            // Alert.alert, unconditional
```

There is **no check of any kind** before `Updates.reloadAsync()` (line 33) — not the upload
queue (`selectActiveCount(useQueueStore.getState().jobs)` is right there and free), not
`inFlight` in `use-gate.ts`, not whether a modal is up.

Three consequences:

- **Mid-upload.** `reloadAsync` tears down the JS context. The persisted queue survives
  (`queue-store.ts:140-150`) and `hydrate` re-queues from the top (line 180), and `itemId` is
  preserved so no duplicate row — but the local pipeline re-runs in full: a fresh downscale,
  thumbnail and Vision pass per interrupted job, plus re-uploads.
- **Mid-purchase.** A reload during a Superwall transaction kills `inFlight`; `settle()` never
  runs, so `/membership-thanks` is never pushed, `recordPaywallOrigin` never fires,
  `paywall_converted` is never emitted, and `recordImpression` never lands. The entitlement is
  real (StoreKit) but every client-side record of the sale is lost.
- **Over a modal.** `Alert.alert` is presented from the root view controller; raised while the
  Superwall paywall or a `formSheet` is up it either fails to present or arrives behind. The
  alert is also the *only* thing that clears `promptVisible` (lines 50, 56, 64), so a
  presentation that never happens leaves `promptVisible.current === true` and **no restart is
  ever offered again for the rest of the process** — the update stays downloaded and unrun.

Also worth noting: `AppState` `'inactive'` counts as backgrounded (line 119), so every photo
picker, permission dialog and Superwall sheet return arms a foreground check. The 60 s cooldown
(`policy.ts:6`) mostly absorbs it.

---

## 10 · S3 — `trial_expired` burns its marker on a lost race

`use-gate.ts:474` — `if (inFlight) return 'unavailable';` — is one slot for the whole app.
`trial-expired-core.ts:64-70` writes the once-per-lapse marker **before** presenting, on purpose
("a crash or kill mid-paywall would re-interrupt on next launch"). So a `trial_expired` ask that
loses the race resolves `unavailable` with the marker already spent, and **that lapse never
fires again** — `evaluateTrialExpired` returns `already_fired` on every future launch.

The competing presentation is `useReturningFree` (`use-returning-free.ts:114`), on the same
launch: `useTrialExpiredPlacement` mounts in `(tabs)/_layout.tsx:52` and `useReturningFree`
mounts in Today. Ordering is genuinely nondeterministic — trial-expired goes through an
`AsyncStorage.getItem` round trip first (`use-trial-expired.ts:51`), returning-free goes through
`InteractionManager.runAfterInteractions` plus a network ledger read
(`use-returning-free.ts:87-100`). Either can win.

Note `presentPromo` handles the cap side of this correctly — `unavailable` does **not** call
`recordImpression` (`present-promo.ts:170-175`), so the loser does not spend the frequency
allowance. Only the trial marker is lost, because it is written by a different module with a
different rule. The docblock at `use-trial-expired.ts:55-59` sanctions a *capped* ask consuming
the marker; a *raced* one is a different thing and is not covered.

---

## 11 · S3 — `qc.clear()` storms

`useSession` is called in 16 files (`_layout.tsx` `AuthGate`, `superwall.tsx`
`SuperwallIdentity`, `analytics-properties.tsx`, `use-plan.ts`, `use-capacity.ts` — which
itself calls `usePlan`, so mounting it creates two — `use-style-context.ts`,
`use-explore-unseen.ts`, `use-packing-access.ts`, `recent-people.ts`, `use-trip-checks.ts`, and
five event screens). Each instance:

- opens its own `supabase.auth.getSession()` promise (`use-session.ts:31`),
- registers its own `onAuthStateChange` subscription (line 45),
- and calls `qc.clear()` on `SIGNED_IN | SIGNED_OUT | USER_UPDATED` (lines 48-53).

So one `SIGNED_IN` produces ~8-12 sequential `qc.clear()` calls, plus one
`purgePersistedCache()` from `usePersistedCachePurge` (`_layout.tsx:73`). Any query kicked off
by an earlier subscriber's re-render is destroyed by a later subscriber's clear.

The concrete case: `signInWithApple` fires `supabase.auth.updateUser({ data: { full_name... } })`
fire-and-forget immediately after sign-in (`actions.ts:149`). That emits **`USER_UPDATED`**, so
**every first Apple sign-in gets a second full cache wipe** a beat after `SIGNED_IN`, landing in
the middle of the handoff's and the tabs' first queries. `(auth)/name.tsx`'s greeting-name write
is the same shape. User-visible: extra latency and a possible flash of empty state at the
first-run moment.

A single `useSession` above the tree, or moving the `qc.clear()` out of the per-instance hook
into `usePersistedCachePurge` (which already owns exactly this event set), removes the storm.

---

## 12 · S3 — Invite deep link navigates twice

`useInviteDeepLink` (`_layout.tsx:142`) takes `signedIn` as a dependency
(`use-invite-deep-link.ts:120`), and `Linking.getInitialURL()` "keeps returning the launch URL
forever" (the file's own note at line 52). So on a cold-start invite link:

1. Signed out: `offer()` runs, `rememberInvite(handle)` parks it (line 96).
2. Session lands → effect re-runs → `getInitialURL()` returns the same URL → this time
   `signedIn` is true → **`router.push('/invite-arrival')`** (line 94).
3. Meanwhile `handoff.tsx:146-148` calls `takePendingInvite()` and
   **`router.replace('/invite-arrival')`**.

`countedOpens` (line 61) dedupes the *analytics* only — it is checked above the branch, so it
does not gate the navigation. `apply_invite` is idempotent (`invite-arrival.tsx:20`), so no data
harm; the user-visible symptom is two `/invite-arrival` entries, i.e. dismissing the arrival
screen reveals a second copy of it.

**Discriminating test.** Cold-start an invite link while signed out, complete sign-in, then
back-swipe from the arrival screen. A second arrival screen underneath confirms this; landing on
the tabs means the `replace` won cleanly and the ordering happens to be safe on this device.

---

## 13 · S3 — A synchronous SQLite write per progress tick

`queue-store.ts:224-228`:

```ts
update: (id, patch) => {
  const jobs = get().jobs.map((j) => (j.id === id ? { ...j, ...patch } : j));
  set({ jobs });
  persist(jobs);                       // Storage.setItemSync(JSON.stringify(durable))
},
```

`persist` (line 140) `JSON.stringify`s the whole non-`done` job array and writes it
**synchronously** on the JS thread. `update()` is called from `uploadObject`'s `onProgress`
(`upload-queue.ts:566`, driven from `upload-queue.ts:812-828`), which fires per chunk, for up to four objects per job, at
concurrency 3. On a 46-photo batch that is thousands of full-array serialisations plus blocking
SQLite writes during the frames the progress rail is animating.

Every `update()` also `set()`s a new `jobs` array, so every subscriber
(`capture.tsx:390`, the rail, `selectActiveCount`) re-renders per tick.

Progress is not durable state — `hydrate` resets `progress: 0` for everything it re-queues
(`queue-store.ts:180`). Persisting it costs everything and buys nothing.

---

## 14 · S3 — Profile-flag writes have no receipt

`item-write.ts:70-91` documents the failure precisely: the `items owner can update` policy
scopes `USING`/`WITH CHECK` to `auth.uid() = user_id`, and a row the policy hides matches
nothing, so **PostgREST answers 200 with zero rows and `error: null`**. The 2026-08-31 funnel
run lost a category change exactly this way, and every write in that file now selects rows back
and calls `assertItemWriteLanded`.

Four profile writes do not:

- `tour-queries.ts:84-92` (`toured_at`)
- `reveal-seen.ts:81-88` (`reveal_seen_at`)
- `use-lifestyle.ts:136-148` (`useSaveLifestyle`)
- `use-lifestyle.ts:170-176` (`useMarkStyleProfilePrompted`)

All four are `.update(...).eq('user_id', userId)` with no `.select()`, and all four pair with an
`onMutate` that sets the cache and **never rolls back** — deliberately, and documented as such
(`use-lifestyle.ts:120-124`). That trade is defensible for a rollback; it is not the same thing
as being unable to detect that the write never landed. Symptom: the onboarding gate, the tour or
the questionnaire re-offers itself on the next cold start, with no error and nothing to see.

(The same pattern is in `time-zone.ts:44-50` — but that one is genuinely best-effort by design
and re-runs every launch, so it self-heals.)

---

## 15 · S3 — An interrupted retag permanently unverifies an item

`useRetagItem` (`closet/mutations.ts:481-535`) writes `status: 'pending_tag', user_verified: false`
to the server *before* invoking `tag-item` (line 493), and restores the previous values via a
second server write on every failure path (lines 486-489).

The restore is a network round trip, not a cache rollback, so it does not survive the process:
if the app is killed, updated (finding 9) or backgrounded to death between the mark and the
restore, the row stays at `pending_tag` with `user_verified: false`. The docblock names
`sweepPendingTags` as the safety net (line 468) — but the sweep only re-tags
(`upload-queue.ts:1118-1157`); it never restores `user_verified`. A human's confirmation is
silently discarded and the piece reappears in the review deck.

React Query mutations are not abortable, so navigating away does not cancel the invoke — only
process death produces this. The window is the length of the vision call, which the docblock
itself puts at "the better part of a minute".

---

## 16 · S4 — Pending capacity reads as room; batches are never trimmed

`use-capacity.ts:100`: `full: data !== undefined && used >= limit`. While the count query is in
flight `data` is `undefined`, so `full` is `false`. The choice is deliberate and correct in
isolation (lines 96-99: an unknown count must not paywall someone who has room).

But `capture.tsx:491` is the only capacity gate on the ingest path:

```ts
if (capacity.full) { setHeldCapture({ assets, local }); setClosetFullVisible(true); return; }
commit(assets, { local });
```

Two gaps:

- **Pending reads through.** The picker can return before the count lands (capture mounts, the
  library sheet opens, the user browses, `['closet-count', userId]` is still in flight or was
  invalidated by a previous import). `full === false` → all 46 committed → all 46 refused. This
  is the most likely interleaving behind A28's "46 after `active_full`".
- **`remaining` is never used.** `useCapture.commit` (`use-capture.ts:109-118`) enqueues whatever
  it is handed; `SELECTION_LIMIT` is 60 (line 41) and nothing clamps the selection to
  `capacity.remaining`. A user with 8 free slots who picks 46 gets 8 items and 38
  `row_write_failed` — an entirely correct `capacity.full === false` still produces the storm.

The all-or-nothing shape is the root: the check is per *batch*, the enforcement is per *row*.

---

## 17 · S4 — The provider-order surface, today

Re-walked against `tests/provider-order.test.ts`. Inside `<Superwall>` (`_layout.tsx:338-609`):
`AnalyticsProperties` (pinned by the test), `ReviewPrompt`, `AuthGate` and the whole `Stack`.
Above it: `<Analytics>` (line 336) and **`<UpdateCoordinator />` (line 337)**.

`UpdateCoordinator` is clean today — it imports only `expo-updates`, `react-native` and
`@/lib/posthog` (`update-coordinator.tsx:1-13`), no billing. But it is the single component
sitting in the gap, and the 2026-08-26 outage was an OTA that moved `AnalyticsProperties` two
lines up into exactly that gap. Anything added to `UpdateCoordinator` that reaches `usePlan`,
`useGate`, `useCapacity`, `useSdkPlan` or any `expo-superwall` hook crashes every keyed build on
first render and passes every keyless dev run.

`tests/provider-order.test.ts` pins `AnalyticsProperties` by source position only. It does not
assert that nothing *else* between `<Analytics>` and `<Superwall>` reaches billing. The cheap
strengthening is a second assertion: no identifier from `features/billing/*` or `expo-superwall`
may appear in the substring of `_layout.tsx` before `layout.indexOf('<Superwall>')`.

Also confirmed safe, and worth recording because it is the same class: `RootLayout`'s own hooks
(`usePersistedCachePurge`, `useAnalyticsIdentity`, `useReportTimeZone`, `_layout.tsx:238-245`)
run **outside** `PersistQueryClientProvider`. All three use only `supabase.auth` and
`expo-sqlite`; none calls `useQuery`. `analytics-properties.tsx:16-24` and `superwall.tsx:42-52`
document why they must be components rather than hooks for exactly this reason.

---

## Things checked and found sound

- **Apple cancel** is correctly non-fatal — `ERR_REQUEST_CANCELED` → `reason: 'canceled'`
  (`actions.ts:180-183`), and `signInWithApple` never surfaces it as a failure.
- **Magic-link double delivery** is properly deduplicated by authorization code
  (`actions.ts:438, 460-502`), and the pre-exchange refusals have their own dedupe set
  (line 514) so the funnel is not doubled. `auth-callback.tsx:35-38` latches per mount.
- **PKCE + fragment-token refusal** (`actions.ts:571-578`) is correct and the reasoning is right.
- **`AuthGate`'s exemptions** for `auth-callback`, `handoff`, `name`, `quiz`
  (`_layout.tsx:175, 198`) close the screen-navigation-vs-effect race properly, and
  `dismissAll()` before `replace` (lines 183, 208) is the right fix for the stacked-`(tabs)` bug.
- **Superwall identity churn** is correctly guarded by the `identified` ref
  (`superwall.tsx:80-131`) — the reasoning about `TOKEN_REFRESHED` and alias rotation is sound.
  (Its failure mode is finding 8, not the guard itself.)
- **`use-gate.ts`'s watchdog contract** is genuinely good work: not awaiting `registerPlacement`
  (line 531), the owner check (line 305), the identity check in `settle` (line 331), the
  `GRANT_GRACE_MS` window (line 253) and the `dismiss()` escape hatch all hold up.
- **`present-promo`'s impression seam** — recording only on `granted`/`declined`
  (`present-promo.ts:170-175`) so a broken campaign cannot burn the day's allowance — is correct,
  and the documented smudge (a campaign skip counting) is the safe direction.
- **`evaluatePromoCaps`** (`promo-caps.ts:95-131`) is pure, half-open on both windows, and
  ignores unknown/future/unparseable rows. No issues.
- **The tagging ceiling** (`MAX_TAG_ATTEMPTS`, `driving` set, `resumeStalledTagging`) is a sound
  state machine — every path terminates visibly. The problem is that the *whole-job* retry path
  (finding 1) never got the same treatment.
- **Sweep dedupe and backoff** (`sweeping`, `nextSweepAt`, `accountWide` early exit,
  `upload-queue.ts:1063-1148`) are correct, modulo finding 3's hang.
- **Optimistic mutations** in `circles`, `saved-looks`, `activity-center`, `daily-social`,
  `push/prefs` and `use-closet-visibility` all snapshot in `onMutate`, roll back in `onError`
  and invalidate in `onSettled`. The four that do not roll back (finding 14) all document the
  trade explicitly.

---

## Suggested order of work

1. **Finding 1 + 2 together.** They are one bug with two faces: classify `23514` /
   `closet_limit_reached` as its own reason, stop the queue on it instead of retrying, do not
   open the grace window for it, and let the wall present. This alone closes A28, explains A15's
   `stage: 'cutout'` mislabel, removes 92 of every 138 Vision passes, and gives the user a true
   sentence with a route out.
2. **Finding 3.** Wrap the three `getUserId()` calls in `withDeadline` — the helper already
   exists at `closet/session.ts:61` and is already exported.
3. **Findings 4 + 5.** Defer `gate.present` behind the sheet's dismissal (the pattern is in
   three other files), and re-check capacity in `onGranted` before committing rather than
   assuming the grant.
4. **Finding 6.** Either wire `focusManager` to `AppState` or delete the three docblock claims.
   Half-true documentation about billing state is how findings 5 and 8 stayed invisible.
5. **Finding 7** before 2026-09-03 14:00Z, or record it as expired.
6. **Finding 17**'s test strengthening — it is four lines and it guards the one outage this
   codebase has already had.
