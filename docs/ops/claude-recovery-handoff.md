# Cinch recovery and reconciliation handoff

Owner: Claude Code (recovery lane). This file is Claude-owned.
The Codex-owned `docs/ops/cinch-implementation-release-ledger.md` is read-only to this lane and was not modified.

Opened: 2026-08-16 15:30 EDT
Recovery branch: `claude/recovery-reconciliation-20260816`
Recovery worktree: `/Users/nelsonsaenz/cinch-wt-recovery`
Base revision: `b00d38d` ("Clean Today contract formatting")

## Headline finding: the recovery brief's premises were stale

The mission brief described `main` as `f9463b4` with substantial unrecovered work sitting on
`codex/today-polish`, `codex/today-production`, and the `ui-excellence` worker branches.

That is no longer current truth. Between the first and second git command of this session, `main`
fast-forwarded from `f9463b4` to `b00d38d` by merging `origin/main`:

```
$ git reflog show main | head -3
b00d38d main@{0}: merge origin/main: Fast-forward
f9463b4 main@{1}: merge codex/ui-excellence-integration: Fast-forward
44e17aa main@{2}: commit: Record build 38 native fingerprint
```

`main`, `origin/main`, and `HEAD` are all `b00d38d` and in sync. A concurrent Codex session is
active in the primary checkout `/Users/nelsonsaenz/cinch` — see "Concurrency hazard" below.

The practical consequence: **almost every surface the brief named as unrecovered is already merged
into `main`, or is a demonstrably older state that `main` has since superseded.** The recovery
inventory below records that with evidence rather than manufacturing reconciliation work that the
tree does not need.

## Recovery inventory

Status vocabulary: `IN-MAIN` (already merged, nothing to do) · `SUPERSEDED` (older state, main is
strictly ahead, deliberately not recovered) · `VERIFICATION-ONLY` (scratch produced while checking
something, never intended to ship) · `RECOVER` (genuinely missing intended work) · `UNKNOWN`.

| # | Item | Source | Intent / evidence | Current-main equivalent | Status | Acceptance check |
|---|---|---|---|---|---|---|
| 1 | `2bfbf5c` "Polish Today session and failure states" | `codex/today-polish` | Today session + wear-failure states; 11 files | Present verbatim | `IN-MAIN` | `git merge-base --is-ancestor 2bfbf5c refs/heads/main` → 0 |
| 2 | `de15dfa` "Define Today names ratings and favorites contract" | `codex/today-polish` | 222-line design contract doc | Present, plus `b00d38d` trailing-whitespace cleanup | `IN-MAIN` | `git merge-base --is-ancestor de15dfa refs/heads/main` → 0 |
| 3 | `5b07965`, `fdbcd42`, `2a3153a`, `35028cd`, `29a8095` | `codex/today-production` | Outfit names, private ratings/favorites, migration probe fix, wear/favorite detail, wear-confirm reachability | Present verbatim | `IN-MAIN` | `git merge-base --is-ancestor 29a8095 refs/heads/main` → 0 |
| 4 | `codex/ui-excellence-integration` @ `29a8095` | worktree | Integration of UX-01/07/08 + Today series | Identical commit to row 3 | `IN-MAIN` | Same SHA as `codex/today-production` |
| 5 | `codex/ui-excellence-a` @ `9b076f5` | worktree | UX-02 content-first Closet, UX-03 progressive Today | Integrated; branch is the pre-integration worker state | `SUPERSEDED` | `git diff --name-status main codex/ui-excellence-a \| grep ^A` → empty (no file exists in A that main lacks) |
| 6 | `codex/ui-excellence-b` @ `fd1328a` | worktree | UX-04 Explore feed-first, UX-09/UX-10 | Integrated | `SUPERSEDED` | `grep ^A` → empty; plus per-intent semantic audit, below |
| 7 | `codex/ui-excellence-c` @ `d5d3af3` | worktree | UX-05 Profile/Settings split, route-local UX-08 | Integrated | `SUPERSEDED` | `git diff --name-status main codex/ui-excellence-c \| grep ^A` → empty |
| 8 | `deno.lock` dirty line in `.claude/worktrees/agent-ad55de324e8efeaaa` | uncommitted | Adds `npm:expo-updates@~57.0.12` | `main` `deno.lock:120` pins `~57.0.13`; `package.json:46` declares `~57.0.14` | `SUPERSEDED` / `VERIFICATION-ONLY` | Worktree pin is strictly older than main's. Recovering it would *downgrade*. |
| 9 | `skeleton.tsx` + `error-state.tsx` in `.claude/worktrees/agent-ad62cb0addaba2495` | uncommitted | Skeleton/error-state primitives | `main` versions are strictly more evolved | `SUPERSEDED` | See "Primitive supersession proof" below |
| 10 | `9d67a0c` "Make a slow model a fact the app can see, say, and tune" | `claude/goofy-elbakyan-d74065` | Surface/tune slow-model latency | Not an ancestor of main | `UNKNOWN` → audited | See audit result below |
| 11 | 568-file staged snapshot in `.claude/worktrees/goofy-elbakyan-d74065` | staged, uncommitted | Legacy bulk snapshot incl. `_to_delete/`, stale lockfiles, PDFs, PNGs | n/a | `VERIFICATION-ONLY` — **never bulk-merge** | Left untouched and unstaged-from. Contains `_to_delete/*.lock.stale` and `_to_delete/unit-tests-stale/` — self-labelled dead weight. |
| 12 | `claude/clothing-app-tech-stack-7c58b2` @ `ab49416` | branch | Superwall sourcing scratch | Reapplied in `src/features/billing/` | `SUPERSEDED` | The commit message itself records the supersession and an explicit "deliberately NOT carried over" list (`use-tier.ts`, `20260805120000_server_side_trial_clock.sql`, `04_trial_clock.sql`) including a warning that the migration dropped a still-needed RLS policy. Do not resurrect. |
| 13 | `origin/posthog/instrumentation-gaps`, `origin/posthog/instrumentation-5a85ce` | remote | PostHog instrumentation | `fe4458f` is already an ancestor of `main` | `IN-MAIN` | `git branch --no-merged main` does not list it. Three files it added (`substitution-sheet.tsx`, `example-ghosts.tsx`, `progress-track.tsx`) were later deliberately removed in main. |
| 14 | 8 untracked docs under `docs/` | working tree | Launch-polish / UI-excellence / Today handoff records | Their implementation branches are merged | see below | see below |

Total unmerged local branches: **5** of 62 (`git branch --no-merged main`), and rows 5, 6, 7, 10 and
12 account for all of them.

## Primitive supersession proof (row 9)

The brief flagged these as possibly-lost primitives. They are older, not newer. `main` is ahead on
every axis:

| Aspect | Worktree `agent-ad62cb0addaba2495` | `main` |
|---|---|---|
| Reduce Motion | absent | `useReducedMotion()`, parked band at half strength, `ReduceMotion.Never` on the Spinner pulse |
| Animation cleanup | infinite `withRepeat` never cancelled | `cancelAnimation(sweep)` / `cancelAnimation(rotation)` on unmount |
| Stagger | absent | `delay` prop, `withDelay`, per-instance for the Lately atlas 120ms cadence |
| `ErrorState` kicker | absent | `kicker?: string` implementing the Plan atlas oxblood lead-in |
| Retry grammar | `loading` spinner swap, `variant={compact ? 'secondary' : 'primary'}` | `title={retrying ? 'Trying…' : retryTitle}`, bordered at every size per the atlases' error grammar |
| `PlateSkeleton` | present, `aspect-[5/4]` well | **deliberately removed**, with a documented rationale in-file |

The `PlateSkeleton` removal is the decisive one. `main`'s `skeleton.tsx` carries an explicit
comment stating the 5:4 well was the plate's *old* anatomy, that a placeholder reserving a shape
the real card no longer draws causes a reflow at exactly the moment the outfit lands, and that
Today's wait state is now `components/today/plate-skeleton.tsx`, owned by the plate lane and built
to the plate's actual geometry. Restoring the worktree copy would reintroduce a fixed regression.

Verdict: **do not recover.** The historical transcript's "verification-only" note matches current
truth.

## Concurrency hazard (must be resolved before any release action)

A Codex session is live in the primary checkout. Observed directly: `main` advanced under this
session mid-inventory, and `codex app-server` processes are running. The Chat Registry's write
ownership rule is explicit:

> Only one actor may mutate a production service, schema, external account, build, submission, or
> release state at a time; ownership must first be recorded here and in the integration map.

Release ownership is therefore **not** held by this lane, and no build/OTA/submission action is
taken here. All work in this lane is confined to the `claude/recovery-reconciliation-20260816`
branch and its own worktree.

## Release gate status (why nothing is published by this lane)

Read live from `09-Release Gate.md`, last verified 2026-08-12:

> Status: **Build in progress — not a release candidate**

| Gate | State |
|---|---|
| Independent visual acceptance | Pending (Codex-owned) |
| Automated code checks | Baseline only |
| D-1 comment closure | Founder decision pending |
| D-2 board lock | Founder decision pending |
| D-5 StoreKit terms | Founder decision pending |
| Functional clean-device journey | Pending |
| Failure/accessibility matrix | Pending |
| Privacy/security/data | Pending |
| Production services | Pending |
| Billing | Pending D-5 |
| Release build | Pending |
| App Store metadata/submission | Pending |
| App Review | Not started |
| Publication | Not started |

The mission's publication authority is conditional: "only after every applicable release gate
passes and Codex independently accepts visual/runtime artifacts." Fourteen gates are Pending,
Not started, or Baseline-only, and three of them are founder decisions that this lane is
explicitly forbidden to guess. **Publication is correctly blocked and is not attempted.**

## Row 14 — the 8 untracked documents

Each was read in full and its concrete claims checked against **current main source**, not against
commit messages. Verdicts:

| Document | Verdict | Note |
|---|---|---|
| `docs/CINCH-LAUNCH-POLISH-HANDOFF.md` | `LANDED-HISTORICAL` | Accepted contract of record. LP-01/02/03/05/06/08 all verified in shipping source. |
| `docs/launch-polish-backlog.md` | `LANDED-HISTORICAL` | The ranked ten map 1:1 to LP-01…LP-10. |
| `docs/launch-polish-design-plan.md` | `LANDED-HISTORICAL` | Pre-acceptance brief; the handoff overrode its LP-02 sheet (which listed three items; `src/features/onboarding/ten-copy.ts:341` ships four, incl. `Edit details`). |
| `docs/launch-polish-implementation-plan.md` | `LANDED-HISTORICAL` | A/B/C worktree topology matches the merged commits. |
| `docs/ui-excellence-research.md` | `LANDED-HISTORICAL` + 1 live item | UX-01…UX-10 verified in source. See live items below. |
| `docs/ui-excellence-design-plan.md` | `LANDED-HISTORICAL` | DE-01…DE-10 acceptance corrections visible in shipped code. |
| `docs/ui-excellence-implementation-plan.md` | `LANDED-HISTORICAL` | Its "Protected state" clause naming "four existing untracked coordinator documents" is stale — there are 8. |
| `docs/CINCH-TODAY-POLISH-HANDOFF-2026-08-16.md` | `LANDED-HISTORICAL` through Phase D, **its own §2/§3/§12 are stale** | Its "Not completed" section was written against base `f9463b4` and was overtaken by the 7 commits now in `main`. |

Verified-landed highlights from the Today handoff (§5.x), against source:

- §5.4 `src/features/styling/outfit-names.ts` — 64-entry library; `tests/outfit-names.test.ts:8`
  asserts 50–100 entries, unique, 2–4 words, tagged.
- §5.5 `WearMutationError` + `classifyWearFailure` / `classifyWearSessionFailure` in
  `src/features/styling/mutations.ts:203-240`; bounded `getSession()` with `withDeadline`.
- §5.6 `supabase/migrations/20260816190545_today_ratings_favorites.sql` (`wear_rating smallint`
  1–5, `favorited_at`, owner-private partial index); pgTAP `supabase/tests/16_today_ratings_favorites.sql`.
- Adjacent defects #4/#5/#6 all fixed (`mutations.ts:228`, `use-outfits.ts:146-152`,
  `src/lib/commands.ts:25-32` now typed rather than cast).

### Genuinely live work carved out of those documents

These are the only items the audit could not find implemented in `main`. They are recorded here so
they are not left buried inside documents labelled "not yet executed".

1. **Rating → style-learning policy (Today handoff §11.4 / §5.6).** A 1–5 `wear_rating` is captured
   and persisted, but feeds nothing: `src/features/styling/favorite-ranking.ts` contains no
   reference to `rating`/`wear_rating`, and `apply_outfit_reaction` is called only from the
   ReactionBar path (`mutations.ts:79`). The handoff itself marks this as requiring the founder's
   product acceptance. **Founder decision — not guessed here.**
2. **Wear-learning behavioural gap (adjacent defect #1).** `useWearOutfit.onSuccess`
   (`mutations.ts:244-253`) only tracks and invalidates caches; no reaction/profile update. The
   false *documentation* claim is gone from `src/`; the behaviour gap remains.
3. **`PlaceField` single-line baseline (§5.2 / adjacent defect #7).**
   `src/components/events/place-field.tsx:161-172` has no `textAlignVertical`, while
   `src/components/events/occasion-field.tsx:416` does. `FieldBox` uses `flex-row items-center`, so
   it may be harmless. `UNKNOWN` without simulator evidence — and the handoff forbids claiming it
   fixed without that evidence. **Codex/Simulator item.**
4. **Saved-plate wear counting (adjacent defects #2/#3).** Architecturally addressed via
   `origin_outfit_id` (`src/features/boards/queries.ts:18,121-137`; `boards/mutations.ts:174`), but
   no explicit decrement-on-delete path was found. `UNKNOWN`.

### Corrected finding: the `dev-*` routes

The docs audit flagged "205 dev-* routes registered in the production bundle" as unaddressed
release debt. Checked directly, that overstates it. `src/app/_layout.tsx:162` bounces **any**
`dev-`-prefixed segment in release builds:

```
if (segments[0]?.startsWith('dev-')) {
  if (__DEV__) return;
  if (router.canDismiss()) router.dismissAll();
  router.replace(session.userId ? '/(tabs)' : '/(auth)/sign-in');
  return;
}
```

The guard is a prefix match, so it covers all 205 generically, and the surrounding comment states
the reasoning explicitly (a release-build deep link to `cinch://dev-today` would otherwise show a
signed-in user convincing fake data about their own wardrobe). The deception/entry-point risk is
handled by design.

What genuinely remains is smaller and worth recording:

- **Bundle hygiene**: 205 fixture screens are still compiled into the production bundle. Not a
  correctness or review risk; a size and build-time one.
- **Stale count in a release document**: `docs/app-store/submission-runbook.md:122` states "The 39
  `dev-*` routes are bounced in release builds (`_layout.tsx:160`)". The count is 166 low and the
  line reference has drifted (the guard is now at :162). **Not corrected by this lane** — that file
  is App Store release evidence and Codex holds release ownership. Flagged for Codex.

## Preserved, untouched

- `docs/commerce/health-runbook.md` — user-owned, protected. Not read into any diff, not staged.
- `docs/ops/cinch-implementation-release-ledger.md` — Codex-owned. Not modified.
- All 20 worktrees, including both `.claude/worktrees` dirty trees and the 568-file staged
  `goofy-elbakyan` snapshot. Nothing reset, cleaned, checked out over, or unstaged.
- The primary checkout `/Users/nelsonsaenz/cinch` remains on `main` at `b00d38d`, with its 8
  untracked docs in place.
