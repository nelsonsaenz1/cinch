# Cinch launch-polish implementation plan

Status: **Approved implementation contract; accepted Claude Design handoff recorded; implementation active**  
Integration owner: Claude Code main session, independently reviewed by Codex  
Date: 2026-08-15

## Definition of done

All ten launch-polish items are implemented, merged without overwriting unrelated work, covered by targeted and full automated checks, visually accepted by Codex in iOS Simulator across the required state matrix, committed and pushed as one reconciled candidate, and packaged in a new iOS runtime because venue autocomplete adds native MapKit code. The current App Store submission is not mutated by this program.

## Team topology and worktree boundaries

The integration owner creates three new worktrees from the same verified base revision. Each worker commits only its assigned surfaces. Shared primitives may be changed only by the integration owner after worker handoff.

### Worktree A — First 10 and Closet recovery

Owns LP-01 and LP-02.

- Remove the Closet menu row and any now-dead navigation/callback/test surface.
- Make filled First 10 photos selectable and replaceable through the existing capture/library and garment-processing pipeline.
- Preserve the old asset and progress until replacement succeeds; cancel/failure is lossless.
- Add focused unit/component/fixture coverage for 1/10, 9/10, 10/10, cancel, denied permission, processing failure, and success.
- Must not edit event, native module, shared theme, or release files.

### Worktree B — New Event, venue search, form resilience

Owns LP-03, LP-05, and the New Event portion of LP-08/LP-09.

- Read the exact Expo SDK 57 docs before any Expo/native work.
- Implement device-local MapKit `MKLocalSearchCompleter`/`MKLocalSearch` through the existing local Expo module structure; do not add a paid vendor or send location/query data to Cinch servers.
- Keep `searchVenues()` as the typed seam and preserve `VenueSnapshot`/event mutation contracts.
- Fix field metrics and Dynamic Type behavior without hard-coded font assumptions.
- Add debounced, cancelable suggestion state with deterministic ordering/deduping and `Use as typed` fallback.
- Location is optional; denied/offline/error paths preserve manual creation.
- Persist New Event draft locally with explicit schema/version, debounce, clear-on-success/discard, and no raw analytics.
- Must not redesign event detail/cards or modify Closet/First 10.

### Worktree C — Event surfaces and cross-screen polish

Owns LP-04, LP-06, LP-07, LP-10, plus non-New-Event portions of LP-08/LP-09.

- Implement only the accepted copy table and event hierarchy.
- Simplify event cards without imagery or new services.
- Redesign event detail while preserving existing actions, membership/privacy gates, and data contracts.
- Apply existing token-based alignment and spacing to Today, Closet, First 10, Plan, Explore, event list, and event detail.
- Audit visible back/cancel/safe-area behavior and accessibility labels/order on touched screens.
- Must not touch native modules, venue-search logic, event mutations/schema, or First 10 replacement behavior.

## Accepted design source

- Claude Design project: `Cinch launch-polish correction atlas`
- Project ID: `6ff3d818-a490-4abf-830e-52f8d4818024`
- Canvas: `Cinch Launch Polish — First 10 & Events.dc.html`
- Handoff: `CINCH-LAUNCH-POLISH-HANDOFF.md`
- Accepted on 2026-08-15 after correcting LP-02 to preserve the shipping item-detail path through an `Edit details` action alongside Retake, Library, and Cancel.
- The accepted atlas covers LP-01–LP-10, the copy table, three state-flow diagrams, Dynamic Type/AX5 and narrow-width states, manual venue fallback, and the no-venue-imagery rule.

## Integration order

1. Record base revision and dirty-file ownership; never stage the protected ops/commerce docs or unrelated work.
2. Accept Claude Design source and freeze its revision/hash.
3. Run A and B in parallel. Run C after the copy table and event frames are accepted.
4. Merge A, then B, then C into the integration branch. Resolve conflicts by returning them to the owning worker; do not silently combine divergent intent.
5. Integration owner normalizes shared UI primitives/tokens only after all three handoffs.
6. Run targeted tests, full test suite, typecheck, lint, styling/type smokes, and fingerprint/runtime checks.
7. Build and install the new native iOS runtime; MapKit work makes this ineligible for OTA-only release.
8. Codex performs independent visual/behavioral acceptance. Claude Code fixes precise discrepancies in bounded follow-up commits.
9. Commit/push the reconciled candidate only when protected files remain untouched and scoped worktree status is clean.

## Technical contracts

### First 10 replacement

- Reuse the existing camera/library, upload, cutout, classification, and item-update paths.
- Replacement is transactional from the user’s perspective: old item/image remains authoritative until new processing and write complete.
- A replacement must not increment item count, reorder slots, restart onboarding, or consume another First 10 position.
- Temporary files and failed uploads are cleaned without deleting the prior asset.

### Venue search

- Native API returns bounded serializable values only: stable local identifier when available, name, formatted address/locality, latitude, longitude, and optional category metadata already allowed by `VenueSnapshot`.
- Minimum query length, short debounce, latest-request-wins cancellation, result cap, stable dedupe, and no query persistence.
- Region bias may use coarse/default region without permission; precise device location is optional and used only after authorization.
- No venue query, location coordinate, or result text is added to analytics or server logs.
- Manual text is always submittable; selection is never required.

### Drafts/navigation

- Draft keys are user-scoped and form-scoped; clear on account change/sign-out.
- Back/Cancel/gesture share one dirty-state guard.
- Successful submit clears draft only after server acknowledgement.
- Failed submit preserves inputs and focus recovery.

### Layout/accessibility

- Prefer flexible min-height and vertical padding over fixed-height text containers where Dynamic Type can grow.
- Respect safe-area insets and existing keyboard-aware primitives; do not add a keyboard package unless the current APIs demonstrably cannot meet acceptance.
- All icon-only actions have labels; replacement actions announce the affected slot/item.
- No text essential to completing a flow uses forced one-line truncation at accessibility sizes.

## Acceptance matrix

| Area | Required evidence |
|---|---|
| Closet row removal | Menu screenshot and navigation/test proof that no dead route remains |
| First 10 replace | Simulator video/screens for cancel, permission denial, failure, and successful same-slot replacement at 1/10 and 10/10 |
| New Event fields | Keyboard-up screenshots for Name, Where, Note at default and AX5; no clipped glyphs or hidden submit |
| Venue search | Nearby results, manual `Use as typed`, no-results, denied location, offline/error, stale-request cancellation, selected snapshot mutation |
| Event detail | Host/member/invitee, look/no-look, long title/note, missing venue/date, canceled, offline |
| Event cards | Host/member/invited/no-date/long venue at default and AX3; no redundant lines. **Canceled struck 2026-08-15** — `EventSummary` carries no cancellation field and `fetchUpcomingEvents` filters `canceled_at` rows out, so no canceled occasion can reach a card. Widening the type and the query was considered and refused; canceled coverage stays on event detail, where existing route data already produces it. |
| Core copy | Before/after inventory and screenshots of Today, Closet, First 10, New Event, Detail, Plan, Explore |
| Navigation/drafts | Back, swipe-back, Cancel, discard, background/restore, kill/restore, submit failure/success |
| Layout | Smallest supported iPhone plus current large iPhone; default, AX3, AX5; portrait; keyboard; home indicator |
| Accessibility | VoiceOver labels/order/actions, Dynamic Type, Reduce Motion, contrast/touch targets |

## Automated checks

- Targeted unit/component/contract tests for every changed state machine.
- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run smoke:styling`
- `npm run smoke:type`
- Native module compile and iOS production-profile build.
- Existing fingerprint/runtime scripts before any OTA decision; expected outcome is a new native runtime, not OTA-only.

## Release debt accepted for this launch

Recorded 2026-08-15 by the integration owner. Accepted knowingly, not discovered late.

### RD-01 — First 10 replacement accumulates stored slots

The shipping pipeline cannot overwrite a photograph in place: `upload-queue.ts` keys
Storage paths by item id and `createSignedUploadUrl` refuses an existing object, and
`enforce_item_limit` (migration `20260808190100`) counts non-archived rows and refuses an
incoming insert at the active ceiling. Replacement is therefore one-in/one-out — a new row
through the unmodified pipeline, with the outgoing piece **archived**, never deleted.

Consequences accepted for launch:

- Nothing is lost. Wear history, cost-per-wear and the stored bytes all survive, and the
  archived piece is restorable through the same reversible path `wall-swap.tsx` uses.
- The no-eleventh-active-item ceiling holds. At 10/10 the outgoing piece is archived before
  the capture, so an eleventh active item cannot exist.
- **Every replacement consumes one stored slot.** Free is 10 active against 30 total
  (`PLANS.free.items` / `item_total_limit_for_plan`), so a free account reaches the stored
  ceiling after roughly twenty replacements, after which replacement fails permanently.
- On the room-to-spare path only, a post-success archive failure leaves the new photograph
  in the slot and the old piece still active — item count one higher until tidied. Judged
  better than retracting a photograph the reader has already been shown. It cannot produce
  an eleventh active item, because the at-ceiling path archives first.

Not fixed in this packet, and deliberately so: a true in-place replace needs a Storage
overwrite path or an item-update write that the frozen contracts do not offer. Revisit only
with a real schema/RPC decision, never by silently deleting wear history.

## Protected state and stop conditions

- Never edit or stage `docs/commerce/health-runbook.md`, `docs/ops/cinch-implementation-release-ledger.md`, `docs/ops/wave3-visual-acceptance-matrix.md`, or unrelated user work.
- Stop and report before changing backend schemas/contracts, adding a paid vendor, transmitting venue/location data to a new recipient, or altering App Store submission state.
- Do not claim visual acceptance from automated tests alone.
- Do not publish/promote/submit until Codex completes independent review and Nelson authorizes the release transition.

## Claude session operations

- Use Opus 5 at Medium effort unless a bounded hard judgment warrants more.
- Every directive is prompt-gated: send it, verify it appears in the transcript, and verify Claude begins responding before the coordinator goes idle.
- At more than 250,000 evidenced post-compaction tokens, wait for a safe committed idle checkpoint, send exactly `/compact`, verify completion and retained mission/protected files/current packet/next action, then send the next directive.
- The ten-minute monitor performs one inspection only. It never duplicates active work, interrupts tests/compaction, or starts Codex-owned release work.
