# Cinch implementation and release ledger

Last updated: 2026-08-12 10:36 EDT  
Coordinator: Codex  
Terminal condition: the verified final release candidate is published through App Store Connect and the published build/metadata match the verified candidate.

## Governing source hierarchy

1. Shipping implementation, production runtime, database policies, and live service configuration.
2. Final Claude Design Wave 3 project sources: the six project-root `.dc.html` atlases, `WAVE-3-BRIEF-NOTES.md`, and `WAVE-3-DEPENDENCY-LEDGER.md`.
3. Repository contracts, decisions, tests, and the Wave 3 review brief.
4. Exact Expo SDK 57 first-party documentation and current first-party vendor documentation.

When sources conflict, implementation/runtime truth wins unless an explicit product decision authorizes a change. Unresolved D-1, D-2, and D-5 are never guessed.

## Verified starting checkpoint

| Area | State | Evidence |
|---|---|---|
| Git | `main` at `050a7f7`, pushed to `origin/main` | `git log`; Claude Code completion report |
| Working tree | User-owned `docs/commerce/health-runbook.md` modified; preserve it | `git status --short` |
| Automated checks | 689/689 tests; typecheck clean; Expo lint 15 warnings / 0 errors baseline | Claude Code report for `050a7f7` |
| Environment | `.env.local` restored byte-exact after capture work | Claude Code report, sha256 prefix `ea71f3ed` |
| Wave 2 | Non-design work complete; audit #50 closed on Codex visual acceptance | Claude Code session |
| Deferred design-dependent work | #31, #32, #37 and audit #56-100 idle at takeover | Claude Code session |
| Wave 3 visual atlas | Finalized at 138 frames (`38+15+31+20+21+13`); v1's 139 was a confirmed bookkeeping error, not a missing state | Claude Design v2 audit; direct `class="frame"` count |
| Release state | No OTA from `050a7f7`; no final release build or App Store replacement yet | Claude Code report and delegated checkpoint |

## Authoritative atlas inventory

| Group | Source | Frames | Visual verdict | Implementation state |
|---|---|---:|---|---|
| 1 | First-Run Hallway | 38 | Finalized/pass | Ready except D-5 surfaces |
| 2 | Today and Plate | 15 | Finalized/pass | Ready |
| 3 | Closet and Intake | 31 | Finalized/pass | Ready |
| 4 | Consent, Privacy, Diary, Plan, Packing | 20 | Finalized/pass | Ready except D-5 paywall/packing surfaces |
| 5 | Gap Feed and Social | 21 | Finalized/pass | Partial: D-1/D-2 affected frames blocked; D-4 safe |
| 6 | Safety, Profile, Help, Membership | 13 | Finalized/pass | Ready except D-5 membership surfaces; D-3 safe |

The project-root sources remain authoritative. A byte-preserving implementation snapshot is verified at `docs/design/wave-3-final/` from Claude Design project `03328f6a-428a-4586-8e80-a13b01009238`; v2 was exported 2026-08-12T14:30:58.331Z. All eight source files match the supplied SHA-256 manifest and byte counts and are byte-identical to v1. `shasum -c` reports eight `OK` results; its warning is caused only by the manifest's intentionally appended byte-count section. Claude Design traced the discrepancy to completion-report bookkeeping: the approved directive enumerates exactly the 21 Group 5 frames present, so no state is missing and no visual content changed. The corrected v2 README records 21 Group 5 / 138 total.

## Dependency ledger

| ID | Decision | Affected atlas states | Current authority | Status / next action |
|---|---|---|---|---|
| D-1 | Server-side comment closure | CM-01/02, EV-01/02/03, LB-01/02 | Founder/implementation decision required | Block only the affected packet; request compact recommendation at boundary |
| D-2 | Board lock enforcement | LB-01/02, SL-01/02, EV-01/02/03 | Founder/implementation decision required | Block only the affected packet; request compact recommendation at boundary |
| D-3 | Downgrade policy | MB-04, MB-08/09, HP-02, PK-01..04 | Repository truth: nothing auto-deleted/moved; over-limit add/restore refused; App Store cancellation | Implementation-safe; implement rendered repository-truth policy |
| D-4 | Per-row merchant state | GF-01..04, FR-02, PR-01 | Confirmed joined programme per row; direct otherwise; no match means no row | Implementation-safe |
| D-5 | StoreKit terms across surfaces | MB-01/04/08/09, MB-01/AX, HP-02, PK-01..04 | Founder/implementation decision required; live localized terms only | Block only selling-term surfaces; request exact products/periods/terms at boundary |

## Packet register

| Packet | Scope | Atlas/audits | Owner | Status | Changed files | Verification | Screenshots awaiting Codex | Commit/build |
|---|---|---|---|---|---|---|---|---|
| P0 | Capture handoff bundle + freeze source hierarchy | Design project; audits 31/32/37 | Codex / Claude Design | Complete; v2 bookkeeping correction verified | `docs/design/wave-3-final/*`; this ledger | Eight source SHA-256 and byte counts match; direct counts prove 138 actual; v2 README matches counts; no visual source changed | None | `506f789` plus uncommitted v2 README correction; local, not pushed |
| P1 | Reconcile shared visual system, then implement unaffected Group 1-3 states | #31/#32/#37, #56-72 | Claude Code with bounded subagents | Active; shared-system regression guard green | `tests/constitution.test.ts`; `tests/node-test-runtime.d.ts` in active working tree | 700/700 tests; typecheck clean; Expo lint at 15-warning/0-error baseline; new faint-text guard proven to fail then restored | Pending generation | `506f789` local, not pushed |
| P2 | Unaffected Group 4 states + D-3 copy/behavior | #73-83 excluding D-5 selling terms | Claude Code | Pending | — | — | — | — |
| P3 | Unaffected Group 5 states + D-4 commerce | #84-98 excluding D-1/D-2 | Claude Code | Pending | — | — | — | — |
| P4 | Unaffected Group 6 states + D-3 membership management | #99-100 excluding D-5 terms | Claude Code | Pending | — | — | — | — |
| PD1 | Comment closure | D-1 affected states | Unassigned | Founder decision needed at boundary | — | — | — | — |
| PD2 | Board locking/crown | D-2 affected states | Unassigned | Founder decision needed at boundary | — | — | — | — |
| PD5 | StoreKit products/terms | D-5 affected states | Unassigned | Founder decision needed at boundary | — | — | — | — |

## Claude Code state and token ledger

- Session: Claude desktop → Code → `Outfit App / Cinch App`.
- State at 2026-08-12 10:32 EDT: actively finalizing the shared-system checkpoint after local checkpoint `506f789`; prompt requires disjoint ownership, no screenshot grading, protected-file isolation, no D-1/D-2/D-5, and no push/OTA/native build/release before Codex visual acceptance.
- Model/effort: Opus 5, High.
- Latest successful compaction: exact timestamp not yet evidenced in the visible transcript.
- Evidenced current context: 41% at 2026-08-12 10:31 EDT; below the first 500k compaction boundary.
- Cumulative post-compaction ledger start: 334.0k evidenced; next `/compact` boundary is 500.0k only if the session's usage display advances from the same post-compaction context.
- Compaction rule: at each evidenced 500k boundary, wait for a safe checkpoint; send exactly `/compact`; wait for completion/composer return; verify mission, gates, packet, findings, and evidence survived; then resume.

## Visual and simulator ownership

Codex owns all visual and iOS Simulator judgments. Claude Code may implement, run machine checks, and produce deterministic screenshots/artifacts, but must not grade them visually. Every visual packet must return:

- route/state and governing atlas ID;
- device/runtime/build identity;
- artifact path and capture command;
- changed files and deterministic checks;
- explicit items awaiting Codex visual acceptance.

The authoritative per-group screen/state inventory and verdict register is `docs/ops/wave3-visual-acceptance-matrix.md`.

## Service readiness register

| Service | Required evidence | State |
|---|---|---|
| Expo / EAS | SDK 57 compatibility, credentials, build/update channels, runtime/fingerprint, production build | Pending |
| Supabase | migrations/RLS/functions/cron/queues/storage/auth/production health | Pending |
| Superwall | products, entitlements, campaigns, paywalls, webhook/reconcile, live StoreKit terms | Pending D-5 |
| PostHog | project, event dictionary, privacy exclusions, production ingestion and dashboards | Pending |
| Resend | sending key/account, domains, support/export delivery, alert delivery | Pending re-verification |
| Vercel / web | production domains, deployment, privacy/support URLs, status and logs | Pending |
| Apple / ASC | app record, products, agreements, entitlements, metadata, review notes, build/submission state | Pending |
| Notifications | APNs/Expo credentials, permission states, production device delivery | Pending |
| Commerce feeds | Datafeedr health/licensing, joined-programme truth, scheduled jobs/alerts | Pending |
| Monitoring | Sentry decision/setup or explicit launch exception, commerce health and paging | Pending founder input for Sentry account if required |

## Release-candidate gate

Not started. Required before submission:

- clean, committed, pushed source state that preserves unrelated work;
- green CI, tests, typecheck, lint baseline and migration replay;
- production/store build installed and fully walked through on relevant devices;
- exact version/build/runtime/fingerprint recorded;
- final screenshots, copy, privacy/support URLs, IAP/paywall, demo account, review notes, export compliance and entitlements verified;
- production service audit green or an explicit founder-approved exception;
- submitted build and metadata cryptographically/visibly matched to the verified candidate.

## Apple state

- Submission: no verified final-candidate replacement yet.
- Expedited review: not requested; founder-authored justification will be requested only when Apple requires it.
- Review/approval/publication: not started for the final candidate.

## Founder-only blockers

- D-1, D-2, and D-5 decisions at the exact affected-packet boundary.
- Sentry organization/slug/DSN if crash reporting remains a release requirement.
- Apple 2FA, new legal agreements, banking/tax/financial action, paid upgrades, and expedited-review rationale when encountered.

## Incident and deviation log

- 2026-08-12 10:11 EDT — takeover established. No implementation prompt sent yet. Existing runbook modification isolated as user-owned. Five-minute heartbeat created.
- 2026-08-12 10:15 EDT — Claude Design could not write to the attached repository and stopped without changes. Safe fallback selected: project-side byte-copy ZIP.
- 2026-08-12 10:20 EDT — authoritative ZIP downloaded and extracted with Unicode-preserving `bsdtar`; eight source hashes and all source byte counts verified locally. No app source changed. Original user-owned runbook modification remains isolated.
- 2026-08-12 10:24 EDT — P1 execution contract sent to the idle Claude Code Cinch App session. Session entered active state. Current evidenced context remains 334.0k/1.0M; next compaction boundary remains 500.0k.
- 2026-08-12 10:25 EDT — Claude Code committed the exact verified Design snapshot alone as local checkpoint `506f789`; not pushed. Protected runbook and coordinator docs remain untouched/unstaged.
- 2026-08-12 10:27 EDT — preflight proved existing `MEDIUM_LABEL` behavior already matches the final constitution and is test-pinned. Repository truth showed all Group 1 MB states are Superwall-owned D-5 surfaces; Codex confirmed they are parked (including retired MB-01/MB-06), preserved the final no-default-trial rule, and directed P1 to continue without asking the founder yet. Visible Claude context: 37%.
- 2026-08-12 10:31 EDT — direct counts of the byte-exact atlas sources proved 138 frames, not the reported 139: Group 5 contains 21 `class="frame"` elements, not 22. Claude Design is running a bounded audit to determine whether one approved state was omitted or the reports are wrong. Group 5 alone is gated; no source assumption will be invented.
- 2026-08-12 10:32 EDT — Claude Code shared-system checkpoint reached 700/700 tests with typecheck clean and the established 15-warning/0-error Expo lint baseline. It corrected a faulty initial grep, established 45 faint-text uses across 20 files (30 on shipping surfaces), and added a regression guard that was deliberately broken and restored to prove it fails. Visible context: 41%; session remains active and un-interrupted.
- 2026-08-12 10:36 EDT — Claude Design proved the approved Group 5 directive contains exactly the 21 frames present; 22/139 was bookkeeping, not an omitted state. Corrected v2 bundle downloaded and independently verified: all eight sources are byte-identical to v1, eight manifest hashes pass, per-file `class="frame"` counts are `38/15/31/20/21/13 = 138`, and only README bookkeeping changed. Group 5 gate is cleared except its existing D-1/D-2 boundaries. Design's chat report additionally claimed `data-screen-label` count equality in every file, but Groups 1 and 2 do not use that attribute; this does not affect the bundle's actual frame-count acceptance or any source byte.

## Next action

Monitor active P1 without interrupting. At Claude Code's next safe report, tell it the v2 correction is bookkeeping-only and Group 5 is cleared except D-1/D-2; verify ownership boundaries and protected files, inspect repository changes and automated evidence, then perform Codex-owned iOS Simulator comparison of every returned Group 1-3 artifact against its governing atlas state.
