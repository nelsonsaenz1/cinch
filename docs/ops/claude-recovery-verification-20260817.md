# Recovery verification — 2026-08-17

Owner: Claude Code (verification lane). Opened 2026-08-17, primary checkout `/Users/nelsonsaenz/cinch`, base `ef7bb4c`.

This is the running log the day's directive asked for. It is written here rather than as a root
`RECOVERY-LOG.md` because `docs/ops/` is where this repo already keeps them and no file by that
name has ever existed on any branch.

Source document: `docs/directives/2026-08-17-recovery-directive.md` (untracked).

## Headline: the directive's premises did not survive contact with the tree

The same finding `claude-recovery-handoff.md:11` recorded on 16 August, for the same reason —
a brief written against a state the tree had already moved past. Of twelve checkable claims,
**two were already true, seven were false, and three would have caused damage if executed.**

The mechanism is visible in the timestamps. The directive's two headline numbers — "nine-file
timestamp fix" and "14 local TS errors" — trace verbatim to the commit message of `60f73fb`
(09:04). That commit already reported the fix as committed and the 14 errors as stale route
types. The directive was written from it, and `2fc11f9` / `3a48f59` resolved the route types
before the directive was pasted.

### Claims checked

| # | Claim | Finding |
|---|---|---|
| 1 | Uncommitted nine-file timestamp fix awaiting per-file decisions | **Already committed**, `60f73fb`, exactly 9 files, +268/−13, ancestor of `main`. Touches no schema and no react-query cache config. Correct as written. |
| 2 | 14 local TS errors; local diverges from CI | **`tsc --noEmit` exit 0, zero output.** Fixed by `2fc11f9` + `3a48f59`. One `tsconfig.json`, one script (`package.json:80`), and CI runs that same script. |
| 3 | Reconcile the ledger with `migration repair` | **Would reverse a deliberate decision.** `79662b9` records why the blanket repair was refused; the 42 remote-only / 44 local-only rows are round authored timestamps vs. clock-time-of-apply, not drift. |
| 4 | Three dirty legacy worktrees; 568-file snapshot needs bucketing | **32 worktrees**, 4 dirty. Snapshot is not at risk — see below. |
| 5 | Lane A: implement Activity Center | **Already implemented** — `src/app/activity.tsx`, six modules under `src/features/activity/`, three components, `20260810100100_activity_feed.sql` with RLS and three owner policies, two test files. |
| 6 | Lane B: implement Outfit Saving | **Already implemented** — `20260803154431_initial_schema.sql` plus `20260810100000_wear_diary_and_boards.sql`. RLS with four owner policies on both `outfits` and `boards`. No new tables. |
| 7 | Restore missing HTML/PNG/manifest release artifacts | **No such pipeline exists.** `shots/` and `dist/` are gitignored by design; the mass removal was `713cdc1`, deliberate. |
| 8 | `scripts/capture.sh` produces before/after screenshots | It records `.mov` marketing video. Screenshots are `scripts/screenshot-matrix.mjs`. |
| 9 | Verify iOS/Android OTA parity, publish the equalizing update | **Android has never shipped.** No Android build or submit profile; `release-ota.mjs` is hardcoded `--platform ios`. This would be a first Android release, not a parity fix. |
| 10 | Bump the iOS build number in-repo | `eas.json` sets `appVersionSource: remote` and `autoIncrement: true`. EAS owns it; `CFBundleVersion 1` in `ios/` is stale scaffolding. |
| 11 | Reface to new AC/GF atlases, insight-card bar removed | **AC** is the *Add Clothes* atlas, not Activity Center. **GF** matches nothing. `insight-card.tsx` is still present and still consumed by `src/app/(tabs)/closet.tsx` — removal is documented intent, not state. |
| 12 | Maintain `RECOVERY-LOG.md` at repo root | Never existed on any branch. This file is the equivalent. |

Paths in the directive (`app/(tabs)/activity`, `components/`) do not exist; the router tree is
`src/app/`.

## Resolved: `main` is OTA-eligible, and the 16 August classification is withdrawn

`claude-recovery-handoff.md:328` classifies the tree `REQUIRES-NEW-STORE-BUILD` on the strength of
a local run reporting `b07ed5b2…` / 73 sources. **That measurement is withdrawn**, by the
authority of `scripts/check-fingerprint.mjs:58-92`, which documents the exact defect it carried:
`@expo/fingerprint` hashes the resolved path of every autolinked package, and this repo's
Deno-installed `node_modules/.deno/<pkg>@<ver>/…` layout hashes different sources from the flat
`npm ci` tree EAS installs. The script's own comment records the same two figures — 73 sources /
`b07ed5b2…` locally against 168 / `d9cb8c3b…` on `npm ci` at the identical commit.

Measured at `ef7bb4c` with the corrected method (`git archive` of the tracked tree, clean `npm ci`
from the committed lockfile):

```
fingerprint: unchanged (d9cb8c3b77a5e69d793dcdbd2aec1484f54cb3c6) — an OTA reaches this binary.
```

This is not the script agreeing with itself. `--verify-control` reproduces a known-good answer
from outside the script — the runtime EAS actually stamped on the shipped binary:

```
  build 38 commit 9345eb2  d9cb8c3b77a5e69d793dcdbd2aec1484f54cb3c6  168 sources
  HEAD            37aaccb  d9cb8c3b77a5e69d793dcdbd2aec1484f54cb3c6  168 sources
  EAS runtime on builds 37/38     d9cb8c3b77a5e69d793dcdbd2aec1484f54cb3c6

  ✓ the method reproduces the runtime EAS stamped on build 38.
  ✓ HEAD carries that same runtime: an OTA reaches builds 37 and 38.
```

168 sources on both sides, against the 73 the withdrawn local measurement saw — the source count is
the tell, and it is the one the script's comment predicted.

The obvious objection was raised and answered rather than assumed. The launch-polish handoff says
the native MapKit venue-search module needs a new EAS runtime, so an unchanged hash looked wrong.
It is not: `modules/venue-search` — `expo-module.config.json`, `ios/VenueSearch.podspec`,
`ios/VenueSearchModule.swift`, and three TS files — **is present at `9345eb2`**, the commit build
38 was built from. `git diff 9345eb2..HEAD -- modules/ app.config.ts package.json
package-lock.json eas.json` is **empty**. The module shipped *in* build 38. The handoff's claim was
true when written and was satisfied by the build that followed it.

Consequence: **Phase 4's "produce a new native build" has no technical justification.** Whether to
cut one anyway is a product decision, not an ops necessity.

## Correction: the 568-file snapshot is not a hazard

`claude-recovery-handoff.md:52` (row 11) and `claude-canonical-reconciliation.md:54` both describe
the staged snapshot in `.claude/worktrees/goofy-elbakyan-d74065` as an unresolved
"never bulk-merge" hazard. **That is stale.** Its staged tree hashes to
`455e6ddda9acd2f990acfaa4511054f1fb43eaa2`, byte-identical to the tree of `752522f`, which is
already an ancestor of `main`. `git diff --cached claude/cinch-new-project-b48011` returns zero
files. Every one of the 568 files is committed and reachable from `main`; nothing is at risk and
nothing needs folding in.

The 442 `A` / 123 `M` / 3 `D` breakdown is against the worktree's own detached HEAD, not against
`main` — which is why it reads as pending work and is not.

## Correction: the worktree census undercounts

`claude-recovery-handoff.md:398` says "All 20 worktrees". There are **32** — 31 admin directories
under `.git/worktrees/` plus the primary checkout. **11 refs carry 18 commits not in `main`.**

Two further facts the earlier census did not record:

- The two `locked` worktrees point at `/sessions/rcw-…` paths that **do not exist on this machine**.
  `git worktree prune --dry-run -v` prints nothing — git refuses to prune locked entries. They need
  `git worktree unlock` first. Lock reason on both is `initializing`: never finished, not protected.
- `goofy-elbakyan-d74065` and `pdf-ui-mockups-eca23e` are both detached at `9d67a0c`, one commit
  ahead of `main`. That SHA survives worktree removal only because branch
  `claude/goofy-elbakyan-d74065` happens to point at it — incidental, not by design.

The only dirt in the estate **not recoverable from git history** is in
`.claude/worktrees/agent-ad62cb0addaba2495`: a modified `src/components/ui/skeleton.tsx` and an
untracked `src/components/ui/error-state.tsx`. `claude-recovery-handoff.md:60-81` judged both
superseded by `main`, with a per-axis proof. That judgment is not re-opened here, but the files are
still the only unique bytes and are left in place.

No worktree was removed, unlocked, pruned, reset, cleaned, or checked out over. Dispositions await
per-item approval.

## Done in this lane

**`37aaccb` — regenerated the Supabase types.** `npm run gen:types`, no hand edits. 286 added lines
in each of `src/types/database.ts` and `supabase/functions/_shared/database.types.ts`, **zero
deletions** — the previous generation was not wrong, only missing what `20260817031752_daily_social`
and `20260818000000_private_circles` added after the last regen at `fdbcd42`.

What arrived is what the interim hand-written shapes said was absent: `circles`, `circle_members`,
the `circle_member_role` / `circle_member_state` enums, the `circle_member_count` RPC,
`can_see_circle` / `is_circle_member` / `is_circle_owner`, `daily_social_reactions`, and the
`friend_worn_outfits` pair.

So the premise in `src/features/circles/db-rows.ts:5-13` and `src/features/daily-social/db-rows.ts`
— "has not been applied there yet" — is now false. Retiring those hand-written rows is a change to
feature code rather than to a generated artifact, and is left for its own diff.

`src/lib/database.types.ts` is untouched and still names none of this. It is **orphaned**: two
source comments call it generated, but `gen:types` writes only the other two files. Recorded, not
resolved.

Checks at `37aaccb`: `tsc --noEmit` exit 0 · `expo lint` exit 0 · 2128 pass / 0 fail / 1 skipped
over 2129 · `check:fingerprint` unchanged.

## Not done, and why

- **No migration repair, no `db reset`, no SQL against production.** Phase 1.3 as written would
  reverse `79662b9`.
- **No release artifacts restored.** Phase 3.1 would reverse `713cdc1`.
- **No Android update published.** Phase 3.2 would be a first-ever Android release.
- **No build, no submission, no OTA.** The store build is OTA-reachable; a replacement binary would
  reset App Store review queue position for no technical gain.
- **Neither feature lane implemented.** Both features already exist.
- **Nothing force-pushed.** `main` was at `origin/main` on entry and is one commit ahead by
  `37aaccb` only.

## Open

- Worktree dispositions — 32-row table, per-item approval outstanding.
- Superwall Standard-monthly `/mo` token binding — the one Phase 3 claim not contradicted, not yet
  read live.
- `src/lib/database.types.ts` — delete, or wire into `gen:types`.
- `docs/directives/` is untracked; decide whether it belongs in git.
- `docs/app-store/submission-runbook.md:122` says 39 `dev-*` routes; there are 205 and the guard is
  at `_layout.tsx:162`. Left uncorrected — Codex-owned release evidence, as
  `claude-recovery-handoff.md:380` also recorded.
