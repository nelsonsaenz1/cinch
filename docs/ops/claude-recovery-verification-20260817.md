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

## Worktree estate: 32 → 16, and every commit now in `main`

**Pruned 16**, all fully merged: the 14 clean ones (`lp-a/b/c/int`, `ds-integration`,
`pc-a-schema`, `pc-integration`, `today-polish`, `today-production`, `ui-excellence-integration`,
`ai-timeout`, `closet-recut`, `recovery`, `cinch-new-project-b48011`), plus the two
`agent/commerce-cowork*` entries, which needed `git worktree unlock` first — their `/sessions/rcw-…`
paths do not exist on this machine and `prune` refuses locked entries. No branch was deleted;
removal does not touch refs.

**Merged for content — 3 branches, 10 commits, documentation only:**

| Branch | Commits | Net effect on `main` |
|---|---|---|
| `claude/ds-a-schema` | 1 | **nothing** — its tree is already `main`'s |
| `claude/dailysocial-phase0` | 6 | `+docs/design/daily-social-contract.md` |
| `claude/privatecircles-phase0` | 3 | `+docs/design/private-circles-preparation.md` |

The implementation from both lanes had already reached `main` through `ds-integration` and
`pc-integration`; what was still outside was the contract doc and the history behind it.

**Merged with `-s ours` — 8 branches: history recorded, content deliberately not taken.**
`codex/ui-excellence-a/b/c`, `claude/ds-b-client`, `ds-c-states`, `pc-b-client`, `pc-c-states`,
`claude/goofy-elbakyan-d74065`. Each is now an ancestor of `main` and no file changed.

The justification is per-file, not a judgement. **All eight carry
`20260810150000_trial_is_twenty_one_days.sql`** — the migration `3ade240` deleted today because it
was never applied, production has written `interval '14 days'` since 5 August, and the ledger holds
no row for that version. A content merge would have resurrected it eight times and re-opened a
product discrepancy closed this morning. Beyond that:

- `ui-excellence-a/c` and `goofy-elbakyan` carry `dev-*` fixture routes that `9a92767` moved out of
  the router root; `tests/dev-route-exclusion.test.ts` fails if one compiles into the bundle.
- `ds-c-states` and `pc-c-states` each carry a `contract-types.ts` whose own header calls it
  "THE ONE FILE INTEGRATION DELETES" and instructs the integrator to replace it with
  `export * from './types'`. `main` has both `types.ts` files.
- `goofy-elbakyan` also carries `ghost-slot-grid.tsx`, `example-ghosts.tsx` and `progress-track.tsx`
  (recorded as deliberately removed), the duplicate-apply migration `20260808160000`, and stale
  copies of the two generated type files regenerated at `37aaccb`.

`git branch --no-merged main` now lists only `backup/pre-rebase-recovery-20260816` (a backup, by
definition not for merging), `claude/clothing-app-tech-stack-7c58b2` (recorded "do not resurrect" —
its migration drops a still-needed RLS policy), and `c-work` / `claude/devroutes-c-docs`, which are
the same single commit `3c40569` already superseded on `main`.

### The ui-excellence work is live, checked file by file

Asked directly whether the Codex ui-excellence work is in the shipping app. It is, and the check is
positive rather than inferred. `codex/ui-excellence-integration` is an ancestor of `main` at
`b00d38d`, and every file the three worker commits touched exists in `main` at equal or greater
size:

```
garment-image.tsx 171/171 · media-state.ts 105/105 · context-composer.tsx 132/132
context-composer-state.ts 100/100 · use-explore-unseen.ts 189/189 · contextual-actions.ts 96/96
settings.tsx 488/488 · settings-copy.ts 146/146 · unseen.ts 160/159
closet-content-first.test.ts 188/160 · context-composer.test.ts 148/148
explore-unseen.test.ts 182/182 · profile-settings-split.test.ts 136/136
```

`git diff main <branch>` runs **12,876 deletions against 1,157 insertions** — the branches are
behind `main`, not ahead. Moving to them would delete `src/lib/haptics.ts`, `theme/contrast.ts`,
`theme/palette.ts`, `styling/outfit-names.ts` and more.

The single file where a branch had more lines is `lately-button.tsx` (94 vs 92), and inspection
shows `main` ahead there too: the branch calls `Haptics.selectionAsync()` inline, `main` calls the
centralized `@/lib/haptics` wrapper — a 142-line module the branch does not contain at all.

### Uncommitted work

`preserve/agent-ad62-skeleton-error-state` (`0eda95d`) commits the modified `skeleton.tsx` and the
untracked `error-state.tsx` from `.claude/worktrees/agent-ad62cb0addaba2495` — across 32 worktrees,
the only bytes that existed nowhere in git. Kept as a branch and **not** merged, because
`claude-recovery-handoff.md:60-81` measures `main` ahead on six axes and because restoring
`PlateSkeleton` reintroduces the reflow `skeleton.tsx` documents as fixed.

`agent-ad55…`'s dirty `deno.lock` was reverted: it pins `expo-updates ~57.0.12` where `main`'s
`package.json` declares `~57.0.14`. Recovering it would have been a downgrade.

The `goofy-elbakyan` 568-file staged index needed nothing — it is already `main`'s content.

## ⚠️ Concurrency: a Codex session is writing to this checkout

Observed directly, not inferred. `web/api/invite.js`, `web/api/waitlist.js` and `web/index.html`
changed on disk at **11:02, mid-session**, and `Codex (Service)` / `Codex (Renderer)` processes are
running. The edit is coherent, deliberate work: an `APP_LIVE` env flag so that invite and waitlist
links fall back to `cinchstyle.com/#waitlist` instead of sending recipients to
`apps.apple.com/app/id6798479578`, which 404s until the listing is public.

**Left entirely untouched and not committed by this lane.** It is another actor's in-flight work,
and `claude-recovery-handoff.md:83-94` records that release ownership sits with Codex. This is the
second session in a row to observe the primary checkout moving underneath it.

## ⚠️ Release integrity: production is running JS from a commit this repo does not have

The most serious finding of the day, and Phase 3.2 was pointed away from it. The directive asks to
compare iOS against Android; the real defect is on iOS alone.

The live `production` channel's newest update — "Private groups: invite-only rooms of up to twelve
mutual friends", published **2026-08-17T07:37:08Z**, `environment: production`, runtime
`d9cb8c3b…` — records:

```
gitCommitHash            eadc262eed4115e5a538d84bb62faba0dc45da45
isGitWorkingTreeDirty    false
```

**That commit does not exist in this repository.** Checked four ways after `git fetch --all`:

```
git cat-file -t eadc262…        fatal: could not get object info
git branch -a --contains eadc262…  error: no such commit
git reflog --all | grep eadc262    0
```

So the bundle currently reaching every device on build 38 cannot be reproduced, diffed, or audited
from `main`. `isGitWorkingTreeDirty: false` makes it worse rather than better: the publish believed
it was shipping a clean, identifiable tree, so this is not an "it was a dirty local build" story.
The commit was published from somewhere — another clone, a worktree whose branch was later
discarded, or a rebase that orphaned it — and never reached `origin`.

**What this does not mean.** It is not evidence that the running JS is wrong or harmful; the update
is plausibly the Private Circles work that is now in `main` by other commits. It means the claim
"we know what is in production" is currently unsupported, which is the thing a release gate exists
to protect.

**Not fixed here, deliberately.** The remedy is to publish a fresh `production` update from a known
`main` commit, and that is an outward-facing action on a live channel that the directive's own
ground rules and approval checkpoints reserve. It also wants a decision this lane cannot make: the
current `main` is 15+ commits beyond whatever `eadc262` contained, including this morning's
timestamp fix, so republishing is a content change to production and not a like-for-like
re-stamping.

**Android is not a parity gap.** It has never shipped: no Android build profile, no submit config,
`scripts/release-ota.mjs` hardcodes `--platform ios`, and `fingerprint.json` records `"platform":
"ios"`. Publishing an "equalizing" Android update would be a first release, not a fix.

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

## Superwall: the asymmetry does not reproduce, and nothing was edited

The directive states the diagnosis rather than asking for one: "Standard monthly renders a bare
`/mo` with no price while Pro renders correctly; this is a binding bug on the Standard monthly
token in the paywall editor, **NOT** a product-state issue." Read-only inspection does not support
it. Every layer that could carry the asymmetry is symmetric.

**Products** (project 28319, app 52618 `com.nelsonsaenz.cinch`) — all four present, entitlement
mapping consistent and unchanged:

| Superwall product | identifier | entitlement |
|---|---|---|
| `standardMonthly` | `cinch.standard.monthly` | 55809 |
| `standardAnnual` | `cinch.standard.annual` | 55809 |
| `proMonthly` | `cinch.pro.monthly` | 55806 |
| `proAnnual` | `cinch.pro.annual` | 55806 |

All four are attached to the one active paywall, **Cinch Membership v3** (`254200`,
`cinch-membership-v3-e738-2026-08-09`).

**Token bindings — symmetric.** Parsed from the live paywall document:

```
       proMonthly.price   x3   all suffixed  /mo
  standardMonthly.price   x3   all suffixed  /mo
        proAnnual.price   x5   3× /yr, plus the "Start Pro —" CTA
   standardAnnual.price   x3   all suffixed  /yr
   proAnnual.monthlyPrice x2  ·  standardAnnual.monthlyPrice x2
```

`{{ products.standardMonthly.price }}/mo` is bound **identically** to
`{{ products.proMonthly.price }}/mo`, in the same count and the same shape. There is no defect on
the Standard monthly token to fix, and editing it would mean changing markup that is provably the
same as the markup said to work.

**The rendered HTML in that same document has every price empty — Pro included.** The bare strings
are `>/mo<`, `>/yr<`, `/mo billed yearly` (×2), and `Start Pro — /yr`. Pro renders bare there too,
so that render is not evidence of a Standard-specific fault; it is evidence of a render performed
with no StoreKit products resolved.

**App Store Connect — also symmetric.** Group 22290564 "Cinch Membership":

```
cinch.pro.annual         WAITING_FOR_REVIEW
cinch.pro.monthly        WAITING_FOR_REVIEW
cinch.standard.annual    WAITING_FOR_REVIEW
cinch.standard.monthly   WAITING_FOR_REVIEW
```

All four in the same state. The directive is right that "Pending" is expected and must not be
"fixed" — but that state is shared by Pro, so it cannot explain a Standard-only symptom either.

**Conclusion.** Two candidate causes, both measured, both symmetric. The reported asymmetry does
not reproduce from configuration, and the reasoning offered for it — that Superwall showing correct
prices rules out product state — does not hold: the dashboard shows the price on file from ASC
metadata, which is not the same thing as StoreKit returning a product to a device at runtime.

**No paywall edit was made and none is proposed yet.** Editing a correct binding on the strength of
a diagnosis this evidence contradicts would risk breaking the Pro rendering that currently works.
What would settle it is a device observation the CLI cannot produce: a Sandbox run against build 38
with the four products, capturing which identifiers StoreKit actually returns. Until then the
likeliest reading is a runtime product-resolution gap, not a template bug.

Incidental: paywall `254200` has `published_at: null` while `status: active`. Worth a look — the
directive speaks of "the published paywall".

## Open

- Worktree dispositions — 32-row table, per-item approval outstanding.
- Superwall Standard-monthly `/mo` token binding — the one Phase 3 claim not contradicted, not yet
  read live.
- `src/lib/database.types.ts` — delete, or wire into `gen:types`.
- `docs/directives/` is untracked; decide whether it belongs in git.
- `docs/app-store/submission-runbook.md:122` says 39 `dev-*` routes; there are 205 and the guard is
  at `_layout.tsx:162`. Left uncorrected — Codex-owned release evidence, as
  `claude-recovery-handoff.md:380` also recorded.
