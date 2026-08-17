# Cinch recovery and reconciliation handoff

Owner: Claude Code (recovery lane). This file is Claude-owned.
The Codex-owned `docs/ops/cinch-implementation-release-ledger.md` is read-only to this lane and was not modified.

> **Three statements in this file were superseded on 2026-08-17.** The release classification
> (line 328), the 568-file snapshot hazard (row 11), and the worktree count (line 394) are each
> annotated inline below. Everything else stands. See
> `docs/ops/claude-recovery-verification-20260817.md`.

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
| 10 | `9d67a0c` "Make a slow model a fact the app can see, say, and tune" | `claude/goofy-elbakyan-d74065` | Per-workload AI timeout/attempt config | `ai_config.timeout_ms` and nullable `ai_calls.attempts` both in main | `SUPERSEDED` | `supabase/migrations/20260808180000_ai_timeout_and_attempts.sql` carries the same column and `between 5000 and 120000` constraint; main wires it further through `supabase/functions/_shared/ai-config.ts:98,113` and keeps constants as `??` fallbacks — safer than the commit, which deleted them. Its model repoint is not in the diff at all (applied live, narrated only). Residual edge-function differences are service-owned; see "Scope not carried by this lane". |
| 11 | 568-file staged snapshot in `.claude/worktrees/goofy-elbakyan-d74065` | staged, uncommitted | Legacy bulk snapshot incl. `_to_delete/`, stale lockfiles, PDFs, PNGs | n/a | `VERIFICATION-ONLY` — **never bulk-merge** — *superseded 2026-08-17, see note* | Left untouched and unstaged-from. Contains `_to_delete/*.lock.stale` and `_to_delete/unit-tests-stale/` — self-labelled dead weight. |

> **Row 11 superseded, 2026-08-17.** "Never bulk-merge" was the right instruction and is now moot:
> there is nothing left to merge. The staged tree hashes to `455e6ddda9acd2f990acfaa4511054f1fb43eaa2`,
> byte-identical to the tree of `752522f`, which is already an ancestor of `main`, and
> `git diff --cached claude/cinch-new-project-b48011` returns zero files. All 568 files are
> committed and reachable. The 442 `A` / 123 `M` / 3 `D` breakdown is measured against the
> worktree's own detached HEAD, not against `main` — which is why it reads as pending work and is
> not. The snapshot is discardable, not hazardous.
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
| `docs/ui-excellence-research.md` | `LANDED-HISTORICAL` + 1 live item | UX-01…UX-10 verified in source. See "Still open" below. |
| `docs/ui-excellence-design-plan.md` | `LANDED-HISTORICAL` | DE-01…DE-10 acceptance corrections visible in shipped code. |
| `docs/ui-excellence-implementation-plan.md` | `LANDED-HISTORICAL` | Its "Protected state" clause naming "four existing untracked coordinator documents" is stale — there are 8. |
| `docs/CINCH-TODAY-POLISH-HANDOFF-2026-08-16.md` | `LANDED-HISTORICAL` through Phase D, **its own §2/§3/§12 are stale** | Its "Not completed" section was written against base `f9463b4` and was overtaken by the 7 commits now in `main`. |

Verified-landed highlights from the Today handoff (§5.x), against source:

- §5.4 `src/features/styling/outfit-names.ts` — 64-entry library; `tests/outfit-names.test.ts:8`
  asserts 50–100 entries, unique, 2–4 words, tagged.
- §5.5 `WearMutationError` + `classifyWearFailure` / `classifyWearSessionFailure` in
  `src/features/styling/wear-failure.ts:14,39,48` (consumed at `mutations.ts:203-240`); bounded
  `getSession()` with `withDeadline`.
- §5.6 `supabase/migrations/20260816190545_today_ratings_favorites.sql` (`wear_rating smallint`
  1–5, `favorited_at`, owner-private partial index); pgTAP `supabase/tests/16_today_ratings_favorites.sql`.
- Adjacent defects #4/#5/#6 all fixed (`mutations.ts:228`, `use-outfits.ts:146-152`,
  `src/lib/commands.ts:25-32` now typed rather than cast).

### Correction (2026-08-16, second pass): the learning items were reported wrong

An earlier revision of this section listed rating-to-learning as unbuilt and a wear-learning
behavioural gap as outstanding. Both claims were false against current source and are withdrawn.
`confirmWear` in `src/app/(tabs)/index.tsx:921-985` implements the approved contract in full:

- The wear is written **first**. `wear.mutate(... rating, favorite ...)` runs `wear_outfit_tx`
  (`src/features/styling/mutations.ts:225-234`, passing `p_wear_rating` and `p_favorite`), and the
  learning write happens inside that mutation's `onSuccess` — so a failed wear teaches nothing.
- The lesson is then derived at `index.tsx:963`:
  `favorite ? true : rating && rating >= 4 ? true : rating && rating <= 2 ? false : null`.
  Favorite is the strongest positive signal and **overrides a conflicting low rating**; 4–5 is
  positive; 1–2 is negative; 3 and an unrated wear are neutral.
- Neutral teaches nothing at all: `if (liked !== null)` (`index.tsx:964`) is the only gate, so no
  reaction row and no profile update is written for a 3-star or unrated wear.
- When it does teach, it goes through the same RPC as the ReactionBar —
  `react.mutate` → `supabase.rpc('apply_outfit_reaction', …)` (`mutations.ts:79-99`) — carrying
  `outfitId` and a `reason` of `'favorite'` or `wear_rating_<n>` (`index.tsx:965-973`).

**No founder decision is outstanding on this and no production change is required.** The contract
is now pinned by a regression test —
`tests/today-polish-phase-a.test.ts`, "A rated wear teaches taste only on explicit feedback, and
only once the wear has landed" — which asserts the ordering (wear → `onSuccess` → lesson) and
evaluates the shipping expression itself over favorite/4/5/3/null/1/2 rather than a copy of it.

### Favorite-ranking evidence (bounded, and deliberately so)

`src/features/styling/favorite-ranking.ts` is the whole of the favorite signal on generation.
`favorExactCores` adds a flat `FAVORITE_BONUS = 0.03` to a candidate whose **exact** core matches a
saved favorite — `core()` sorts and joins item ids, so it is set equality, not overlap — and it is
applied *after* feasibility scoring, over the already-generated shortlist
(`src/features/styling/use-outfits.ts:120-123`, fed by `useFavoriteOutfits`). Ties fall back to the
generator's original index, so the bonus can settle a near-tie and nothing more.

`tests/favorite-ranking.test.ts` pins both directions: an exact favorite wins a 0.80/0.78 pair, and
cannot overtake a 0.90/0.78 one. This is the bound — a favorite nudges, it does not override
feasibility.

### Resolved: saved-plate deletion does not decrement historical wears (adjacent defects #2/#3)

The earlier `UNKNOWN` ("no explicit decrement-on-delete path was found") was looking for something
that must not exist. Deleting a saved plate and undoing a wear are two different operations:

- **Deleting a saved plate** (`useDeletePlate`, `src/features/boards/mutations.ts:178-195`) deletes
  only the `outfits` row for the kept plate. `outfit_items` goes on cascade; `items` is untouched,
  so **no `wear_count` moves.** Wears that came from that plate survive it: `origin_outfit_id` is
  declared `references outfits (id) on delete set null`
  (`supabase/migrations/20260810100000_wear_diary_and_boards.sql:100`), so each wear keeps its own
  row and simply loses the pointer. The only visible consequence is the lookbook's "worn 6×" count,
  which is a live `count(*)` over `origin_outfit_id` (`src/features/boards/queries.ts:17-24,121-137`)
  and correctly stops attributing those wears to a plate that no longer exists.
- **Un-wearing** is the operation that decrements, and it is transactional, not a delete:
  `unwear_outfit_tx` (same migration, `:234-291`) takes the row `for update`, refuses past 24 hours
  with `22023`, sets `wear_count = greatest(0, wear_count - 1)` and recomputes `last_worn_at` from
  the remaining wears, and only then deletes the outfit row. The client path is
  `src/features/diary/mutations.ts:135-140` with `unwearRefusal` in `src/features/diary/entry.ts:552`.

The migration states the reasoning in-file: deleting an outfit row alone would leave
`items.wear_count` permanently inflated, which is why the correction is a transaction. Status:
**resolved — behaving correctly, nothing to build.**

### Still open (unchanged, and not enlarged)

**`PlaceField` single-line baseline (§5.2 / adjacent defect #7).** Current-main evidence only:
`src/components/events/place-field.tsx:161-173` renders a single-line `TextInput` with
`className="flex-1 font-body text-body"` and `style={{ color: theme.ink, ...INPUT_RESET }}` inside a
`FieldBox`, whose non-multiline branch is `flex-row items-center`
(`src/components/events/occasion-field.tsx:210-211`). `occasion-field.tsx:416` sets
`textAlignVertical={multiline ? 'top' : 'center'}` — on a single-line input that is the platform
default, so the two fields' declared geometry already agrees, and
`tests/today-polish-phase-a.test.ts:35-42` pins that shared contract. **No gap is claimed here.**
Confirming the rendered baseline still needs simulator evidence, which this lane does not have and
does not fabricate. **Codex/Simulator item.**

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

- ~~**Bundle hygiene**: 205 fixture screens are still compiled into the production bundle.~~
  **RESOLVED.** The fixtures moved to `src/dev-fixtures/`, outside the directory Expo Router
  registers, so none of the 22,592 lines reach the bundle. The runtime guard is kept as defence in
  depth; `tests/dev-route-exclusion.test.ts` is what now enforces it.
- ~~**Stale count in a release document**: `docs/app-store/submission-runbook.md:122` states "The 39
  `dev-*` routes are bounced in release builds (`_layout.tsx:160`)". The count is 166 low and the
  line reference has drifted.~~ **RESOLVED.** Corrected on the founder's authorisation, and then
  superseded by the move: that line now records that zero `dev-*` routes ship, which is a stronger
  claim than any count.

## Row 6 — the per-intent audit of `codex/ui-excellence-b`, and the verdict it got wrong

B was audited by comparing its authored diff *against its own parent*, not merely by diffing the
branch against main. Of the 18 files it authors, **12 landed byte-identical in main** — the whole
UX-10 "let it end" machinery (`src/features/explore/unseen.ts`, `use-explore-unseen.ts`,
`contextual-actions.ts`, `feed.ts` including `CAUGHT_UP_LINE` at `feed.ts:51`), plus
`garment-well.tsx`, `new-addition-row.tsx`, `FriendItemCard.tsx`, `(tabs)/_layout.tsx` and all three
new test files. Two intents were deliberately improved on rather than dropped:

- B used `theme.byline` for the "Earlier" rule and the caught-up line; main uses `theme.muted`,
  because the widened contrast census frozen at UX-01 forbids `byline` as text (2.61:1). Changed by
  `f9463b4`.
- B called `Haptics.selectionAsync()` directly; main routes through `src/lib/haptics.ts` (UX-07,
  intents not strengths), guarded by `tests/haptic-policy.test.ts`.

### The people-search finding was wrong, and the check that caught it

The audit reported one `GENUINELY-MISSING` item: two blocks of mutual-friendship copy in
`src/app/people-search.tsx`, deleted by `2bfbf5c`. The circumstantial case was strong — a pure
16-line deletion, no replacement, an **empty commit body**, inside a commit whose other ten files
are all Today/mutations/wear-failure. It read exactly like out-of-scope collateral.

It was not. The deletion is deliberate and guarded by a test that `2bfbf5c` shipped in the same
commit:

```
tests/today-polish-phase-a.test.ts:24
  assert.doesNotMatch(src, /friendship is mutual|closet opens to you/i);
```

It implements the Today polish handoff §5.1 ("both mutuality prose blocks gone"). The restoration
was written, run, and **reverted** when the suite failed 1/1815 on exactly that assertion.

Recorded because the lesson generalises: a commit's *shape* — pure deletion, empty body, unrelated
subject — is suggestive but is not evidence of accident. The test suite is. Nothing in this lane was
recovered on the strength of a diff's appearance alone.

Status for row 6: **`SUPERSEDED`**, no recovery — confirmed at file level, at intent level, and by
test.

## Scope not carried by this lane

This slice is documentation and test evidence only. It changes no route, component, token, copy
string, dependency, schema, or service.

Residual differences between `9d67a0c` and main that live in Supabase **edge functions** are not
carried here. They reach users by deployment rather than by this branch, and the Chat Registry
restricts production-service mutation to one recorded owner at a time — currently Codex. They are
referred to the service owner rather than specified or implemented by this lane.

## Verification evidence at the branch head

Run in `/Users/nelsonsaenz/cinch-wt-recovery`, with `node_modules` symlinked to the primary
checkout — this repo's documented worktree convention (`.gitignore:5`: "worktrees symlink
node_modules rather than installing it").

| Check | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` (`tsc --noEmit`, TypeScript 6.0.3) | **clean — no diagnostics** |
| Unit tests | `npm test` (`node scripts/run-tests.mjs`) | **1816 pass, 0 fail, 0 skipped** |
| Working tree | `git status --porcelain` | clean |
| Base | `git merge-base --is-ancestor main HEAD` | `main` = `b00d38d` = `origin/main` |

The new regression test in `tests/today-polish-phase-a.test.ts` pins behavior that already ships:
`src/app/(tabs)/index.tsx:963` computes `liked`, `:971` sends the reaction reason as `favorite` or
`wear_rating_<n>`, and `src/features/styling/mutations.ts:233-234` passes `p_wear_rating` and
`p_favorite` into `apply_outfit_reaction`. It evaluates the shipping
ternary itself rather than a copy, so a silent edit fails the test instead of passing a stub. It
adds no behavior; the count moves 1815 → 1816 and stays green.

## Release classification: REQUIRES-NEW-STORE-BUILD

> **WITHDRAWN, 2026-08-17.** The local figure below (`b07ed5b2…`, 73 sources) carries the defect
> `scripts/check-fingerprint.mjs:58-92` now documents: `@expo/fingerprint` hashes the resolved path
> of every autolinked package, and this repo's Deno-installed `node_modules/.deno/…` layout hashes
> different sources from the flat `npm ci` tree EAS installs. The script's own comment records the
> same two numbers — 73 / `b07ed5b2…` locally against 168 / `d9cb8c3b…` on `npm ci` at the identical
> commit. Re-measured over `git archive` + clean `npm ci`, `main` is **`d9cb8c3b…` / 168 sources —
> the runtime EAS stamped on builds 37 and 38.** `--verify-control` reproduces that from outside the
> script. **An OTA reaches the store binary; a new native build is not required.** The MapKit
> venue-search objection was checked: `modules/venue-search` is present at `9345eb2` and shipped
> *in* build 38. See `docs/ops/claude-recovery-verification-20260817.md`.
>
> The two sources below did agree. They agreed because both read the same poisoned measurement.

Not a judgement call — two independent sources agree.

```
$ npm run check:fingerprint          # run in /Users/nelsonsaenz/cinch, which has ios/
  recorded  d9cb8c3b77a5e69d793dcdbd2aec1484f54cb3c6   2026-08-16 @ 9345eb2
  current   b07ed5b24bc13c26f79ddc34e02b0cba143d1632   73 sources
  THE NATIVE LAYER HAS CHANGED.
```

```
$ eas build:list --platform ios --limit 3      # read-only
  Build number     38          Status   finished · production · store
  Runtime Version  d9cb8c3b77a5e69d793dcdbd2aec1484f54cb3c6
  Fingerprint      d9cb8c3b77a5e69d793dcdbd2aec1484f54cb3c6
  Commit           9345eb29fc4403652aa1edde96cd5112cafe637c
  Version          1.0.0
```

The last submitted store build (38, version 1.0.0) carries runtime `d9cb8c3b…` from commit
`9345eb2`. Current `main` fingerprints to `b07ed5b2…`. **`main` at `b00d38d` cannot ship as an
OTA** — it requires a new store build. This matches the launch-polish handoff's own statement that
the native MapKit venue-search module needs a new EAS runtime and cannot ride an OTA.

Method note: run `check:fingerprint` in the **primary** checkout. This recovery worktree has no
`ios/` directory and fingerprints differently (`adafabd2…`, 72 sources); that figure is an artifact
of the worktree, not a native change, and is not authoritative.

Other read-only release state: EAS authenticated as `nelsonsaenz1@yahoo.com` (Owner of
`nelsonsaenz` and `nelsonsaenzs-team`); 91 migrations, latest
`20260816190545_today_ratings_favorites.sql`. Nothing was built, published, submitted, deployed,
promoted, or merged.

**Artifact manifest for Codex visual review: empty, and correctly so.** This branch's diff is
documentation plus one regression test. It changes no rendered surface, so there is no visual state
to capture and no screenshot that would carry meaning. No self-authored visual verdict is offered.

## Remaining blockers, by owner

**Founder only**
- D-1 comment closure, D-2 board lock, D-5 StoreKit terms — the three release-gate rows recorded as
  founder decisions. This lane is forbidden to guess them.
- Any credential, 2FA, OAuth grant, legal agreement, financial action, paid upgrade, expedited-review
  rationale, or irreversible Apple choice.

**Codex (release and visual owner)**
- Independent Simulator visual acceptance — the entire visual half of the gate, still `Pending`.
- `PlaceField` rendered single-line baseline: declared geometry already agrees and is pinned by
  `tests/today-polish-phase-a.test.ts:35-42`; confirming the rendered result needs device evidence
  this lane does not have and will not fabricate.
- ~~A new store build (39) before any production promotion, then `npm run check:fingerprint -- --set`.~~
  **Not required as a native matter (2026-08-17)** — `main` carries build 38's runtime
  `d9cb8c3b…`, confirmed against EAS by `--verify-control`, so an OTA reaches the store binary.
  Cutting build 39 is now a product choice rather than a native necessity. If one *is* cut, `--set`
  still follows submission and only then.
- `docs/app-store/submission-runbook.md:122` says "The 39 `dev-*` routes are bounced in release
  builds (`_layout.tsx:160`)" — there are 205, and the guard is now at `:162`. Left uncorrected here
  because that file is App Store release evidence under Codex ownership.
- Residual `9d67a0c` edge-function differences, per "Scope not carried by this lane".

**Coordination**
- A Codex session is live in the primary checkout and `main` moved once mid-session. Release
  ownership is not held by this lane; sequencing must be agreed before any build or deploy.

**Not a blocker, recorded for completeness**
- ~~Bundle hygiene: 205 `dev-*` fixture screens still compile into the production bundle.~~
  **RESOLVED** — moved out of the router root to `src/dev-fixtures/`. Nothing dev- ships; the
  `_layout.tsx:162` guard stays as defence in depth.

## Preserved, untouched

- `docs/commerce/health-runbook.md` — user-owned, protected. Not read into any diff, not staged.
- `docs/ops/cinch-implementation-release-ledger.md` — Codex-owned. Not modified.
- All worktrees — **20 as counted here; the census was short, there are 32** (2026-08-17), of which
  11 refs carry 18 commits not in `main`. Nothing was preserved less thoroughly for having been
  miscounted; the statement below holds for all 32. Including both `.claude/worktrees` dirty trees and the 568-file staged
  `goofy-elbakyan` snapshot. Nothing reset, cleaned, checked out over, or unstaged.
- The primary checkout `/Users/nelsonsaenz/cinch` remains on `main` at `b00d38d`, with its 8
  untracked docs in place.
