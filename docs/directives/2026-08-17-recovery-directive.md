# Cinch Recovery Directive — 2026-08-17

Paste this into Claude Code from the repo root. Goal: by end of day, `main == origin/main`, all intended work reconciled, a new native iOS build submitted, and every new-feature UI re-finished through Claude Design review.

---

## DIRECTIVE

You are running a full-day recovery operation on the Cinch repo. Work in **plan mode first**: before touching anything, produce a written plan for each phase below, get my approval on Phase 0 findings, then execute. Use subagents aggressively — every independent audit runs in parallel; every destructive or irreversible step runs in the main thread only after a subagent has reported findings.

### Ground rules
- **Nothing is deleted, reverted, or force-pushed without my explicit approval.** Subagents investigate and report; you propose; I decide.
- Dispatch read-only audit subagents in parallel batches. Implementation subagents run in **isolated worktrees** and hand back diffs.
- Maintain a running `RECOVERY-LOG.md` at repo root: each step, what was found, what was done, verification evidence.
- Known environment traps (do not rediscover these the hard way):
  - Git on the FUSE mount cannot `unlink`. If `.git/index.lock` appears, use a same-filesystem rename: `mv .git/index.lock .git/locktrash/<n>`. For merges that must replace tracked files, work in a throwaway clone at `/tmp/cinch-work` and transfer back via `cat >` + `git update-ref`.
  - Vercel Root Directory = `web`. Deploy from repo root only; production ships from GitHub `main`.
- **Gate discipline:** phases are sequential; do not start a phase until the prior phase's exit criterion is verified and logged.

---

### Phase 0 — Parallel reconnaissance (subagents, all at once, read-only)
Dispatch five audit subagents simultaneously. Each returns a findings report only.

1. **Timestamp-fix auditor** — Locate the nine-file timestamp fix (uncommitted or on a branch). For each file: what changed, why, whether it's correct, whether it interacts with the Supabase schema or client caching. Recommend commit / amend / reject per file.
2. **TypeScript auditor** — Reproduce the 14 local TS errors. For each: file, error, root cause, proposed fix. Diagnose why local differs from CI (tsconfig drift, dependency versions, generated types staleness — check whether `supabase gen types` output is stale). Recommend the minimal change-set that makes `tsc --noEmit` locally match CI exactly.
3. **Migration-ledger auditor** — Diff `supabase/migrations/` on disk against the remote migration ledger (use the Supabase MCP `list_migrations`). Classify every discrepancy: applied-remote-but-missing-local, local-but-never-applied, renamed/reordered. Propose a reconciliation plan. **Never run `db reset` or repair commands in this phase.**
4. **Worktree auditor** — Enumerate the three dirty legacy worktrees. For each dirty file: classify as (a) already on main, (b) intended-but-uncommitted work, (c) abandoned. Do the same for the 568-file snapshot — bucket it into keep/fold-in/discard with counts and rationale. Output a disposition table.
5. **Release-artifact + parity auditor** — Identify the missing HTML/PNG/manifest release artifacts (what pipeline produces them, where they should live, what commit last had them). Check iOS vs Android OTA channel state (Expo/EAS update channels, runtime versions) and report any parity gaps. Also pull current Superwall/ASC product state for step 9 context.

**Gate:** Present a consolidated findings report + revised execution plan. Wait for my approval.

### Phase 1 — Stabilize the tree (sequential, main thread)
1. Act on my decisions from the timestamp-fix audit: commit (with a proper message citing the audit) or reject each of the nine files.
2. Apply the TS fix change-set. Exit criterion: `tsc --noEmit`, lint, and tests pass locally **and** the same commands are byte-for-byte what CI runs (fix CI config or local scripts if they diverge — pick one source of truth).
3. Reconcile the Supabase ledger per the approved plan (use `migration repair` semantics — mark-applied/mark-reverted — rather than replaying SQL against prod; any migration that must actually run gets shown to me first).
4. Execute the approved worktree/snapshot dispositions. Fold intended work onto feature branches; leave nothing dirty. Removal of worktrees or discard of files requires my per-item approval from the Phase 0 table.

**Gate:** clean `git status` in the primary worktree, green local checks matching CI.

### Phase 2 — Feature completion with Claude Design review (two parallel lanes)
Run two feature lanes in parallel, each as its own subagent in an isolated worktree. **UI acceptance is mandatory before implementation is considered done.**

**Design-review protocol (applies to both lanes, and to any other UI touched in the last two days):**
- Inventory every screen/component added or modified in the last two days (`git log --since="2 days ago" --name-only` filtered to UI paths).
- For each, run it through **Claude Design**: re-finish the face to match the current refacing direction — new AC/GF atlases, insight-card bar removed, wave/occasion visual language. No screen ships with pre-refacing styling.
- Produce before/after screenshots (use `scripts/capture.sh` on simulator) into `docs/design/review-2026-08-17/`, and a checklist per screen: spacing/typography tokens, empty states, loading states, error states, dark mode, dynamic type.
- I accept or reject per screen. Rejected screens loop back before the lane can close.

**Lane A — Activity Center:** complete the spec, implement, wire analytics (respect existing PostHog conventions), pass the design-review protocol, then deploy (merge to main + OTA if JS-only).

**Lane B — Outfit Saving:** same protocol. Pay attention to Supabase RLS on any new tables — run `get_advisors` after any migration.

**Gate:** both lanes accepted by me, merged, checks green.

### Phase 3 — Release integrity (sequential)
1. **Restore release artifacts:** regenerate the missing HTML/PNG/manifest artifacts from the pipeline identified in Phase 0; commit or re-publish to wherever they're consumed. Verify by fetching/opening each artifact.
2. **OTA parity:** verify iOS and Android are on the same update/runtime version per channel. If a platform is behind, publish the equalizing update and re-verify by querying the update endpoints.
3. **Superwall — RESOLVED 2026-08-17, do not re-litigate.** Audited live: all 4 products **Active**, entitlements mapped correctly, paywall v3 (#13) live in 5 campaigns rendering **all four prices** ($7.99/$59 Standard, $14.99/$119 Pro), and ASC Server Notifications V2 webhooks already wired on both Production and Sandbox. The previously-reported blank `/mo` was a **stale list-page thumbnail**, not a bug. Dashboard "Revenue Tracking: Missing" is a no-data state — zero purchases have ever occurred; it self-clears on the first one.

   The one real gap: **the purchase chain has never been executed end to end.** Add a task to run a TestFlight + Sandbox tester purchase proving paywall → StoreKit → entitlement grant → webhook → Superwall revenue event, on both a Standard and a Pro product. Also enable **Billing Grace Period** in ASC (unconfigured) and fill the blank **Team ID** in Superwall Settings → General.

### Phase 4 — Converge and ship
**Context as of 2026-08-17: v1.0 (build 36) is APPROVED and LIVE on the App Store**, released automatically. This is no longer a first submission — it is an update, and 1.0 stays live and unaffected while 1.1 is in review.

1. Reconcile everything to `main`, push, confirm `main == origin/main` and CI green. No dirty worktrees anywhere (`git worktree list` + status on each).
2. **Split the release into two lanes and tell me which lane each change belongs to before building:**
   - **OTA lane (no Apple review):** JS/TS, components, styling, copy, refacing work, bug fixes. Ship these via EAS Update to the matching runtime version — same day, no review.
   - **Native lane (Apple review required):** native modules, Expo SDK bumps, permissions/`Info.plist`, icon/launch screen, entitlements, runtime-version changes.
   If Activity Center and Outfit Saving turn out to be pure JS, say so — they ship OTA today and the native build becomes optional rather than blocking.
3. If a native build is warranted: bump to **1.1** with a new build number (37+), produce an EAS production build, record build number + commit SHA in the log, and submit for review. Do not touch the live 1.0 listing while doing so.
4. Metadata changes (description, keywords, screenshots, subtitle) are review-gated but decoupled from the binary — batch them onto the 1.1 submission. **Promotional text is editable with no review at all**; use it for anything urgent.
5. Verify: build visible in TestFlight with correct build/version strings, 1.1 submission state recorded, and 1.0 still live and downloadable throughout.

### Final verification (subagent)
Dispatch a fresh verification subagent with no prior context to independently confirm: clean tree, local==CI checks, migration ledger consistent, both features present and refaced on main, artifacts restored, OTA parity, paywall prices rendering, and the new build's number/state in ASC. Its report closes out `RECOVERY-LOG.md`.

---

## Approval checkpoints (I must sign off)
1. Phase 0 consolidated findings + plan
2. Per-file timestamp fix decisions
3. Any migration that executes SQL against prod
4. Per-item worktree/snapshot discards
5. Per-screen design acceptance (Phase 2)
6. OTA-vs-native lane assignment for each change, before any build is produced
