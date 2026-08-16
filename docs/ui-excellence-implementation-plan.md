# Cinch UI excellence implementation plan

Status: **Accepted design recorded; isolated implementation authorized**  
Integration owner: Claude Code integration session; independently reviewed by Codex  
Date: 2026-08-15

## Definition of done

UX-01–UX-10 are implemented against the accepted design, merged from isolated non-overlapping worktrees, covered by targeted/full checks, visually accepted by Codex across the state matrix, committed and pushed as a reconciled candidate, and delivered only through the appropriate release path after runtime fingerprint proof.

## Accepted design source and resolved branches

- Claude Design project `49b82198-7610-4896-a8ba-94d44ce76f68`
- Canvas `Cinch UI Excellence Atlas.dc.html`
- Handoff `CINCH-UI-EXCELLENCE-HANDOFF.md`
- Explore ships Variant A: filter `isSelf` rows at the existing client seam. No query field, view, RLS, or backend contract changes.
- Explore last-seen is user-scoped local state using existing AsyncStorage plus authoritative friend-item timestamps. Own pieces never trigger unreadness. If the invariant cannot be proven in tests, suppress the dot.
- Settings is a pushed route from Profile, not a new tab or route group.
- SDK 57 `Link.AppleZoom` is navigation transition only; no pinch-to-zoom viewer.
- DE-08 requires inventory and classification of touched `Alert.alert` calls; uninventoried safety-critical blocking behavior remains unchanged.
- Do not implement atlas-only product inventions that were not in the approved brief: preserve current category/Most-worn visibility rules rather than adding 5/15-piece thresholds, and preserve the existing Today-context lifecycle rather than adding a new local-midnight persistence rule. The accepted contribution is visual hierarchy and progressive disclosure, not new product state.

## Worktree topology

### Worktree A — Today, Closet, media

Owns UX-02, UX-03, and the Closet/Today/Item/Plan portions of UX-06.

- Content-first Closet and `Most worn` truth correction.
- Today progressive disclosure without losing permission-free context.
- Shared resilient media primitive and adoption on owned surfaces.
- No Explore/Profile/navigation-attention changes.

### Worktree B — Explore, social, navigation

Owns UX-04, UX-09, UX-10 and Explore/friend portions of UX-06.

- Feed-first Explore and dedicated people-search sheet.
- Truthful feed copy, unseen boundary, finite closure, quiet tab dots.
- Selective SDK 57 previews/menus/zoom with gesture-conflict audit.
- No Profile/Settings or global token changes.

### Worktree C — Profile, feedback inventory

Owns UX-05 and route-local UX-08 migrations.

- Profile/Settings split with capability reconciliation.
- Remove/replace nonfunctional settings controls.
- Convert only accepted alert cases to inline/NoticeBand/toast/sheet.
- No global press primitive or theme-token edits.

### Integration owner — shared system

Owns UX-01, UX-07, global portions of UX-08, shared primitives, conflict reconciliation, full checks, and fixture updates.

- Semantic contrast tokens and allowlist reduction.
- Shared press/motion/haptic primitive and bounded adoption.
- Shared media API review and feedback hierarchy consistency.
- One integration commit series; workers do not edit protected files.

## Technical constraints

- Read exact Expo SDK 57 docs before any implementation. For Router changes, use SDK 57 Link/NativeTabs/Stack APIs only.
- No new package, native module, permission, vendor, backend contract, migration, billing/paywall change, or analytics payload.
- Do not replace Expo Image, NativeTabs, existing Reanimated/Haptics, or router architecture.
- Preserve current privacy/RLS/data ownership and all explicit manual fallbacks.
- Long press on Closet items remains multi-select; context actions cannot steal it.
- Unseen dots require existing authoritative local/query state; do not infer or fabricate unreadness.
- Image fallbacks must not retry in loops or expose signed URLs in logs/analytics.

## Integration order

1. Record base revision and dirty-file ownership.
2. Accept and freeze Claude Design source.
3. Run A, B, and C in isolated worktrees with shared files prohibited.
4. Integration owner lands semantic tokens/shared primitives first if workers need stable APIs; otherwise workers use adapters and integration reconciles after handoff.
5. Cherry-pick one worktree at a time; return conflicts to owner.
6. Run targeted tests, typecheck, lint, full tests, styling/type smokes, route/fixture checks, and fingerprint comparison.
7. Codex performs independent iOS Simulator visual and behavioral acceptance; Claude fixes only cited discrepancies.
8. Commit/push scoped candidate. OTA is allowed only if fingerprint/runtime/channel checks prove compatibility; otherwise produce a new EAS build.

## Acceptance matrix

| Area | Evidence |
|---|---|
| Contrast | Automated 4.5:1 role test and screenshots under normal/Increase Contrast |
| Closet | Zero/partial/10/mature, smallest iPhone, AX3/AX5, honest Most worn |
| Today context | Collapsed/expanded/applied/error/return; outfit plates remain visually primary |
| Explore | Feed/empty/search/results/no-results/error/keyboard/new-divider/caught-up/offline |
| Profile/Settings | Every previous capability mapped and reachable; back/cancel safe |
| Media | Loading/loaded/missing/expired/decode failure/avatar fallback; no blank wells |
| Interaction | Pressed/selected/busy/disabled/reduced motion; haptic policy tests where practical |
| Feedback | Destructive remains blocking; recoverable error and success are nonblocking and announced |
| Native navigation | iOS preview/menu/zoom plus fallback; normal tap and visible actions preserved |
| Attention | Dots only on authoritative actionable/unseen state; clear after correct read action |

## Required checks

- Targeted reducer/component/route/fixture tests for changed state machines.
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run smoke:styling`
- `npm run smoke:type`
- Existing route manifest and dev-fixture tests.
- Expanded screenshot matrix for core tabs, Profile/Settings, Item, search, empty/loading/error, AX3, AX5.
- Expo fingerprint/runtime proof before release classification.

## Protected state

Never edit or stage:

- `docs/commerce/health-runbook.md`
- `docs/ops/cinch-implementation-release-ledger.md`
- `docs/ops/wave3-visual-acceptance-matrix.md`
- the four existing untracked launch-polish coordinator documents
- unrelated user work.

Stop before a new dependency, permission, vendor, schema/backend change, billing/paywall mutation, production promotion, App Store submission mutation, or material design contradiction.

## Monitoring protocol

- Claude Code runs Opus 5 at Medium effort in one integration session plus three isolated worktree workers.
- Every prompt is sent and visibly acknowledged before the coordinator goes idle.
- Check active sessions every ten minutes; never interrupt active edits/tests/builds/subagents.
- At more than 250,000 evidenced post-compaction tokens, compact only at a clean committed idle checkpoint, verify retained mission/protected files/current packet/next action, then continue.
- Claude does not self-accept visual quality. Codex owns final simulator review and release decision.
