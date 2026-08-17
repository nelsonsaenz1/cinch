# Cinch canonical reconciliation ledger

Owner: Claude Code (sole implementation agent). Claude-owned file.
Protected and NOT modified by this lane: `docs/ops/cinch-implementation-release-ledger.md` (Codex),
`docs/commerce/health-runbook.md` (user).

Opened: 2026-08-16
Canonical repository: `/Users/nelsonsaenz/cinch`
Canonical `main` = `origin/main` = `889853e` at time of writing.

## Purpose

Prove, per checkout / worktree / branch / change, whether each unique commit or file is
**already represented**, **superseded**, or **must be integrated** into canonical `main`.
Commit-message similarity is never accepted as evidence of identical content — several commits in
this repository were replayed onto `main` under different hashes, so proof is by tree/patch content.

## Integration completed this session

| Step | Result | Evidence |
|---|---|---|
| Recovery ledger integrated into canonical `main` | `74567a2 → 889853e`, fast-forward, pushed | `git merge --ff-only`; `git push origin main` → `74567a2..889853e` |
| Scope of that integration | 1 file, documentation only | `docs/ops/claude-recovery-handoff.md`, +136/−1 |
| Verification before integration | typecheck clean; **1816 pass / 0 fail / 0 skipped** | `npm run typecheck`; `npm test` |

Duplicate-history note: `claude/recovery-reconciliation-20260816` was rebased onto `main`; git
itself reported `skipped previously applied commit cf21a26` and `0ba9210`, confirming those two were
already present under different hashes (`51286d5`, `74567a2`). The rebased branch and the pushed
remote branch have **byte-identical trees** (`24a1604`). No force-push was performed — rewriting a
published branch for cosmetic history is explicitly out of policy.

## Worktree and checkout census

22 git worktrees are registered; 14 Cinch directories exist under `/Users/nelsonsaenz`. No stashes
(`git stash list` empty).

| Path | Branch / HEAD | Note |
|---|---|---|
| `/Users/nelsonsaenz/cinch` | `main` | **canonical** |
| `cinch-ui-excellence-a` | `codex/ui-excellence-a` @ `9b076f5` | pre-integration worker |
| `cinch-ui-excellence-b` | `codex/ui-excellence-b` @ `fd1328a` | pre-integration worker |
| `cinch-ui-excellence-c` | `codex/ui-excellence-c` @ `d5d3af3` | pre-integration worker |
| `cinch-ui-excellence-integration` | `codex/ui-excellence-integration` @ `b00d38d` | in main |
| `cinch-wt-ai-timeout` | `codex/ai-timeout-recovery` @ `74567a2` | created recently; ownership under audit |
| `cinch-wt-closet-recut` | `redesign/closet-recut` @ `a5329a6` | merged lineage |
| `cinch-wt-lp-a/b/c/int` | `launch-polish/*` | merged into main |
| `cinch-wt-recovery` | `claude/recovery-reconciliation-20260816` | this lane's worktree |
| `cinch-wt-today-polish` | `codex/today-polish` @ `de15dfa` | in main |
| `cinch-wt-today-production` | `codex/today-production` @ `74567a2` | in main |
| `.codex/worktrees/2d90/cinch` | detached `03d6ba5` | Codex-owned |
| `.claude/worktrees/agent-ad55…` | `worktree-agent-ad55…` @ `b47fedc` | dirty: `deno.lock` (superseded) |
| `.claude/worktrees/agent-ad62…` | `worktree-agent-ad62…` @ `9cf7334` | dirty: skeleton/error-state (superseded) |
| `.claude/worktrees/cinch-new-project-b48011` | detached `752522f` | |
| `.claude/worktrees/goofy-elbakyan-d74065` | detached `9d67a0c` | 568-file staged snapshot — never bulk-merge *(moot 2026-08-17: the staged tree is byte-identical to `752522f`, already an ancestor of `main`; nothing left to merge)* |
| `.claude/worktrees/pdf-ui-mockups-eca23e` | detached `9d67a0c` | |
| `/sessions/rcw-…/commerce-cowork`, `commerce-cowork2` | `agent/commerce-cowork*` | **locked**, remote-session paths |

Branches not merged into `origin/main` at census time — local: `backup/pre-rebase-recovery-20260816`,
`claude/clothing-app-tech-stack-7c58b2`, `claude/goofy-elbakyan-d74065`,
`claude/recovery-reconciliation-20260816`, `codex/ui-excellence-a`, `-b`, `-c`. Remote:
`origin/claude/goofy-elbakyan-d74065`, `origin/claude/recovery-reconciliation-20260816`,
`origin/posthog/instrumentation-5a85ce`, `origin/posthog/instrumentation-gaps`.

Per-branch content proof and per-worktree dirty-state proof are being established by dedicated
read-only lanes; no checkout, worktree, safety branch, stash, backup, or artifact is deleted before
its unique content is proven represented in pushed canonical history.

## Design gate: atlas verified FINALIZED and accessible

`docs/design/wave-3-final/` (v6, Claude Design project `03328f6a-428a-4586-8e80-a13b01009238`).

```
$ shasum -a 256 -c MANIFEST.sha256
Wave 3 - Design · First-Run Hallway.dc.html: OK
Wave 3 - Design · Today and Plate.dc.html: OK
Wave 3 - Design · Closet and Intake.dc.html: OK
Wave 3 - Design · Consent, Privacy, Diary, Plan, Packing.dc.html: OK
Wave 3 - Design · Gap Feed and Social.dc.html: OK
Wave 3 - Design · Safety, Profile, Help, Membership.dc.html: OK
WAVE-3-BRIEF-NOTES.md: OK
WAVE-3-DEPENDENCY-LEDGER.md: OK
```

All eight authoritative sources verify. Frame count recomputed independently from the files
(`grep -c 'class="frame"'`): 38 + 15 + 31 + 20 + 21 + 13 = **138**, matching the README. Atlas
verdict is **FINALIZED**; every group is present and readable.

## Correction: the Wave 3 dependency ledger is stale — D-1 and D-2 are implemented

`WAVE-3-DEPENDENCY-LEDGER.md` is dated 2026-08-12 and records D-1 and D-2 as
"FOUNDER/IMPLEMENTATION DECISION REQUIRED", with repository truth stating no server-side closure or
lock exists. **That is no longer current.** Verified against the shipping tree:

| Dep | Ledger status (2026-08-12) | Current repository truth | Now |
|---|---|---|---|
| **D-1** server-side comment closure | "no `comments_closed`/`closes_at` column or policy exists; closure is client-derived only" | `supabase/migrations/20260812120000_close_comments_and_lock_board.sql` defines `event_is_open()` (:66) and `assert_comment_thread_open()` (:104) raising *"the occasion has started, so the thread is closed"* (:111), wired by trigger `event_comments_thread_open` (:124). SELECT untouched, so closed threads stay readable — exactly the frozen rendering. | **RESOLVED** |
| **D-2** board lock enforcement | "lock computed client-side; no server-side refusal" | Same migration: `assert_vote_target()` (:145) and `assert_vote_retractable()` (:194) both raise *"the occasion has started, so the board is locked"* (:163, :201), wired by `event_outfit_votes_retractable` (:210). pgTAP coverage at `supabase/tests/11_event_lock.sql`. | **RESOLVED** |
| **D-2b** crown conflict | "must be resolved in favour of one artefact before build" | Founder resolved in favour of the atlas: `src/features/event-outfits/board-logic.ts:6-10` records "THE CROWN IS GONE (D-2b)" and that §3's crown sentences are superseded. | **RESOLVED** |
| **D-3** downgrade policy | RECOMMENDED DEFAULT, implementation-safe | Unchanged; ceiling triggers in `20260805160000_membership_tiers.sql` and `20260808190100_active_and_stored_limits.sql`. | **SAFE** |
| **D-4** per-row merchant state | RECOMMENDED DEFAULT, implementation-safe | Unchanged; `features/commerce/use-shop-match.ts`. | **SAFE** |
| **D-5** StoreKit terms | slot mechanism safe; **terms founder-required** | Slot mechanism now implemented: `expo-superwall@^1.2.0` installed (`package.json:43`), `src/features/billing/superwall.tsx` + `placements.ts` + `use-gate.ts` wired, and `plans.ts:76,83` keeps prices as *hints* explicitly resolved from StoreKit in device locale. | **Mechanism done; product/terms state is external** |

Consequence: the design-dependent implementation work that the atlas gated on is **no longer
blocked in the repository**. What remains for D-5 is App Store Connect product approval state, which
is external operational truth and must be read live at decision time — it is not inferable here and
is not asserted.

## Release classification — CORRECTED 2026-08-16

**Superseded.** This section previously read "`main` cannot ship as an OTA … a new store build is
required before any production promotion." That was wrong, and acting on it would have built an
identical runtime.

`main` **is** OTA-eligible. Store build 38 carries runtime `d9cb8c3b77a5e69d793dcdbd2aec1484f54cb3c6`
from `9345eb2`, and current `main` fingerprints to that **same** hash under the profile and install
layout EAS actually uses.

The old reading came from `check:fingerprint` hashing the working directory. `@expo/fingerprint`
hashes resolved paths, and this checkout's `node_modules` is a Deno store of symlinks rather than
the flat `npm ci` tree EAS installs from the lockfile — 73 sources and `b07ed5b2…` locally against
168 and `d9cb8c3b…` for the identical commit. The advice to run it "in the canonical checkout only"
made it worse: the canonical checkout was the poisoned one.

Corrected by `d572070`, which takes the fingerprint over `git archive <rev>` with a clean `npm ci`.
Its control — recomputing `9345eb2` and reproducing the runtime EAS stamped on build 38 — is
`npm run check:fingerprint -- --verify-control`. A gitignored `ios/` was measured and is **inert**:
it moves the source count 168 → 169 and not the hash.

EAS has since derived `d9cb8c3b…` independently on builds 37 and 38 and on both production OTAs.
Full evidence, including the incident log, is in `docs/ops/claude-release-gate-evidence.md`.
