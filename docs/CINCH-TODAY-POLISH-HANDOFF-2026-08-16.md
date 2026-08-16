# Cinch Today / Explore / Stylist polish handoff

Version: 1.0  
Date: 2026-08-16  
From: Codex task `/root`  
To: next Cinch implementation/design coordinator  
Stage: current-main audit complete; implementation and design follow-up not yet executed  
Release status: **not a release candidate; no production, App Store, account, budget, or release mutation is authorized**

## 1. Outcome requested by Nelson

Nelson requested six product changes and asked that Claude Code, Claude Design, the shared Builder Brain, and a team of agents be used:

1. Explore → Find a friend: keep the `Find people` heading and remove the explanatory mutual-friendship prose that clutters the search sheet.
2. New Event: fix bottom-clipped typed characters in the `Name` and `Where` fields.
3. Stylist sheet: keep `Stylist`; remove `Only your clothes — nothing invented`.
4. Today: stop showing prose descriptions beneath outfits. Show creative outfit names and build a grounded 50–100-name library plus deterministic matching system.
5. `I wore this`: fix the generic `Not logged` failure. After a tap, support an optional explicit 0–5 rating and favorite selection; favorite outfits should be available again and shown in the owner's Closet/profile experience.
6. Audit nearby small defects and report them.

The founder also asked for the agent to monitor Claude Code/Claude Design, independently inspect all returned work, and use a design-taste GitHub skill if available.

## 2. Current status at handoff

### Completed

- Read and reconciled the active Builder Brain build/prompt/design operating rules and Cinch Product Truth, Release Gate, Chat Registry, Handoff Ledger, Integration Map, accepted launch-polish handoff, launch-polish backlog, and implementation plan.
- Read the exact Expo SDK 57 reference required by `AGENTS.md`: `https://docs.expo.dev/versions/v57.0.0/`.
- Audited current shipping `main` and the older launch-polish integration branch.
- Ran three independent read-only subagent audits:
  - UI flow and source audit;
  - wear mutation/data diagnosis;
  - adjacent polish and design-skill audit.
- Inspected the signed-in Claude Design `Cinch UI Excellence Atlas` in Chrome read-only.
- Verified the active launch-polish worktrees were clean and their commits had already been integrated.
- Created a clean, isolated current-main implementation worktree:
  - path: `/Users/nelsonsaenz/cinch-wt-today-polish`
  - branch: `codex/today-polish`
  - base: `f9463b4`
- Stopped an obsolete Claude Code run before it changed files because it was operating on a branch six commits behind current `main`.

### Not completed

- No Claude Design follow-up directive was submitted.
- No current-main Claude Code implementation completed.
- No product source, test, migration, production service, public account, build, release record, or App Store state was changed.
- No simulator/device visual acceptance was run.
- No rating/favorite schema decision was accepted or implemented.

### Why execution stopped

The existing Claude Code launch-polish recovery session targeted `/Users/nelsonsaenz/cinch-wt-lp-int` at `9345eb2`. A fresh comparison showed current `main` at `f9463b4` was six commits ahead, including newer Explore/Profile/UI Excellence architecture. The run was stopped immediately; its worktree remained clean.

A fresh CLI Claude Code session was attempted in `/Users/nelsonsaenz/cinch-wt-today-polish`, but it never began changing files and was terminated. A subsequent attempt to use Claude Desktop was blocked because the Mac locked. The new worktree remained clean.

## 3. Repository and worktree truth

### Authoritative repository

- Original repository: `/Users/nelsonsaenz/cinch`
- Current `main` and `origin/main`: `f9463b4 Reconcile UI excellence integration policies`
- Treat the original repository as coordination/read-only while implementing. It contains user/coordinator-owned untracked documents; do not stage, delete, or overwrite them.

Original repository untracked files observed:

- `docs/CINCH-LAUNCH-POLISH-HANDOFF.md`
- `docs/launch-polish-backlog.md`
- `docs/launch-polish-design-plan.md`
- `docs/launch-polish-implementation-plan.md`
- `docs/ui-excellence-design-plan.md`
- `docs/ui-excellence-implementation-plan.md`
- `docs/ui-excellence-research.md`

This handoff document is an additional deliberate coordination artifact.

### Safe implementation worktree

- `/Users/nelsonsaenz/cinch-wt-today-polish`
- branch `codex/today-polish`
- base `f9463b4`
- clean when last checked

Use this worktree for any implementation. Confirm it is still clean before dispatch.

### Older launch-polish worktrees

- Integration: `/Users/nelsonsaenz/cinch-wt-lp-int`, branch `launch-polish/integration`, clean at `9345eb2`
- A: `/Users/nelsonsaenz/cinch-wt-lp-a`, clean at `402f9de`
- B: `/Users/nelsonsaenz/cinch-wt-lp-b`, clean at `0b65740`
- C: `/Users/nelsonsaenz/cinch-wt-lp-c`, clean at `19e5cfe`

Do not resume new work on these older branches. Their work is already contained by current `main` and the file architecture has since changed.

## 4. Governing source hierarchy

Use this order when sources conflict:

1. Verified shipping/runtime behavior and current `main` implementation.
2. Database/RLS/RPC truth and current first-party service state.
3. Accepted local contracts:
   - `/Users/nelsonsaenz/cinch/docs/CINCH-LAUNCH-POLISH-HANDOFF.md`
   - `/Users/nelsonsaenz/cinch/docs/launch-polish-implementation-plan.md`
   - `/Users/nelsonsaenz/cinch/docs/ui-excellence-implementation-plan.md`
4. Cinch Product Truth and Release Gate in the Mastermind Vault.
5. Exact Expo SDK 57 and current first-party vendor documentation.
6. Older atlases, fixture copy, App Store asset directives, and aspirational notes.

Current Product Truth:

- Lead with `Three outfits for today—from clothes you already own.`
- Activation is `Start with ten pieces.`
- Do not lead with generic `AI stylist` positioning.
- Ten is a product wedge/limit; never promise a fixed number of possible outfits.
- Private social behavior and shipping implementation outrank aspirational copy.

## 5. Evidence-backed findings by requested item

### 5.1 Find people copy

Current-main source:

- `src/app/people-search.tsx`
- desired title around lines 95–101
- idle explanatory paragraph around lines 133–140
- repeated mutuality footer after results around lines 240–245

Recommended bounded change:

- Keep title, search input, close/cancel, autofocus, error, loading, no-results, and result states.
- Delete both explanatory mutuality blocks so the clutter does not return after the user types.
- Do not change mutual-friendship enforcement, RLS, or other privacy copy.
- Add a focused rendered/source test proving `Find people` remains and both prose blocks are absent.

Important correction: the older launch-polish branch placed this search UI inside `src/app/(tabs)/explore.tsx`. Current `main` moved it to dedicated `src/app/people-search.tsx`. Work only from current `main`.

### 5.2 New Event Name/Where clipping

Current-main source:

- route: `src/app/event/new.tsx`
- shared field layout/input: `src/components/events/occasion-field.tsx`
- place input: `src/components/events/place-field.tsx`

Current code already contains the LP-03 fix:

- flexible minimum 48 pt field height;
- symmetric vertical padding;
- reset native input padding/margin;
- `OccasionField` single-line input uses `textAlignVertical="center"`;
- `PlaceField` uses the shared reset but did not show the same explicit `textAlignVertical` in the audit.

Conclusion:

- The runtime Nelson tested may be behind current source, or one remaining baseline difference exists in `PlaceField`.
- Do not apply another blind `move text up` or globally alter `FieldBox`; it is also used by date/time buttons and the multiline Note has different growth behavior.
- Rebuild current `main`/the new worktree and reproduce using descenders such as `gypqj` at default, AX3, and AX5, focused and unfocused, with the keyboard open and Create reachable.
- If `PlaceField` alone still differs, align its single-line TextInput behavior with `OccasionField` narrowly.
- Do not claim the bug fixed without simulator/device evidence.

### 5.3 Stylist subtitle

Current-main source:

- `src/components/stylist/sheet-parts.tsx`, `StylistHeader`
- title around lines 353–355
- unwanted subtitle node around lines 356–374
- all live states consume this header through `src/app/stylist.tsx`

Recommended bounded change:

- Delete the subtitle node and only its directly stale implementation comments.
- Preserve icon, `Stylist`, `New question`, header border, tap target, and title/action alignment.
- Do not silently edit older App Store screenshot HTML/directives in this patch; flag them for a separately approved asset refresh.

### 5.4 Today descriptions and outfit-name system

Current-main source:

- visible name: `src/components/today/plate.tsx` around lines 625–630
- visible reasoning/description: same file around lines 647–651
- local and AI names: `src/features/styling/use-outfits.ts`
- local swap fallback: `src/app/(tabs)/index.tsx`, `localStyledOutfit`
- AI name schema: `supabase/functions/_shared/outfit-schema.ts`

Current behavior:

- Ordinary mornings intentionally stay local and make zero AI calls.
- Local fallback name is currently weather-note text or `From your closet`; this is not a real creative naming system.
- AI enhancement can supply 2–4-word names such as `Quiet confidence`, but only on already-authorized enhancement branches.
- The visible reasoning is also used internally for explainability and persistence. Remove it from Today presentation only; do not remove the data/model pipeline.
- `useWearOutfit` currently passes `p_name: null`, so a creative Today name is lost when the outfit is worn.
- The AI query cache key omits some context it sends (weather/events/style profile), creating a risk of stale names/reasoning for an unchanged candidate set.

Required design before implementation:

- A local deterministic name selector with 50–100 unique, human-written, 2–4-word names.
- Names tagged against facts already in the candidate/context model, for example:
  - occasion/formality;
  - warmth/weather suitability;
  - palette harmony/contrast;
  - silhouette/layering;
  - garment category composition;
  - pattern/texture intensity.
- Stable tie-break/hash from candidate item IDs plus calendar day/context fingerprint so cards do not rename on rerender.
- Avoid duplicate names across the three visible cards.
- AI may refine words only on existing enhancement branches; it may not reorder outfits or become required.
- Validate AI output and fall back locally on empty, generic, long, duplicate, or ungrounded names.
- Pass the accepted name into the persisted wear/favorite record.
- Hide Today reasoning by default and update the skeleton so it does not reserve phantom rationale lines.

Required tests:

- library size 50–100 and every entry unique;
- every name 2–4 words and free of brand/merchant/fabricated facts;
- deterministic same input/day output;
- each tag family reachable;
- three-card set avoids duplicate names;
- ordinary-morning policy still performs zero AI calls;
- late AI words never reorder cards;
- Today renders the name and garment credits but not reasoning;
- wear persistence retains the displayed name.

### 5.5 `I wore this` failure

Current-main flow:

- `src/app/(tabs)/index.tsx`: `handleWear` marks pending, invokes `useWearOutfit`, then collapses every rejection to `failed` and discards the error.
- `src/features/styling/mutations.ts`: `useWearOutfit` uses `getUserId()` and calls `wear_outfit_tx`.
- `src/components/today/plate.tsx`: every failure becomes `Not logged` / `Today is still marked here. Cinch will not lose it.` plus Retry.
- `src/lib/commands.ts`: the underlying PostgREST error exists but is not surfaced/mapped.

Verified backend truth:

- Production `wear_outfit_tx` exists with the expected eight-argument signature.
- Authenticated execute grant exists.
- `command_log` owner policies required by the idempotent command exist.
- A missing live RPC/grant/schema deployment is therefore ruled out.

Strongest code-level cause:

- The Today path still uses a `getClaims()`-dependent identity lookup that can add a network round trip/stall under Hermes.
- Closet already replaced this with a bounded local-session-aware lookup in `src/features/closet/session.ts`.

Required bounded repair before the new rating/favorite feature:

- Reuse the bounded session-aware identity pattern without weakening JWT, RPC ownership checks, or RLS.
- Preserve the existing `wear_outfit_tx` atomicity and same-mounted-retry operation ID.
- Capture/map the real rejection category: signed-out/session-unavailable, offline/network, ownership/validation, and server/unexpected.
- Preserve the underlying exception for diagnostics/telemetry without leaking sensitive text to the UI.
- Replace the false `Cinch will not lose it` promise. Current operation IDs and failed state live only in memory; termination can lose retry identity and an uncertain response followed by a later tap can duplicate a wear.
- Do not add an offline queue in this patch.

Important adjacent type-safety issue:

- `src/lib/commands.ts` still casts `supabase.rpc` to a generic `(name, Record<string, unknown>)`, based on a stale claim that generated types do not know the command.
- Current generated types do know the full `wear_outfit_tx` arguments.
- Narrow or overload the helper for the known wear/plan command arguments if this can remain a small change. Do not weaken types or widen scope.

### 5.6 Rating and favorite are a new data/product contract

Existing schema semantics:

- `outfits.rating` is constrained to `(-1, 1)` and represents legacy binary taste semantics.
- `saved_at` and Boards represent a kept/saved plate, not an explicit favorite.
- Closet intentionally calls its wear-derived rail `Most worn`; it has no favorite state.

Do **not** repurpose either field.

Recommended additive design:

- Add nullable `wear_rating smallint check (wear_rating between 0 and 5)`.
  - `null` = skipped/unrated.
  - `0` = explicit zero only if Nelson truly wants zero to be a selectable rating.
- Add nullable `favorited_at timestamptz`.
- Keep favorites owner-private by default. Current social closet exposes garments, not outfit preferences. Friend/public favorite visibility requires a separate consent, view/RLS, privacy, and product decision.
- Present a pre-commit sheet after `I wore this`:
  - optional 0–5 rating;
  - explicit favorite control;
  - `Log this outfit` commit;
  - Cancel records nothing.
- Extend the wear transaction so outfit row, item links, worn timestamp, item wear counts, rating, favorite, and displayed name commit atomically and idempotently.
- Use explicit SET semantics for favorite rather than a server toggle.
- Render an owner-only `Favorite outfits` rail in Closet/profile.
- A favorite may receive a bounded ranking bonus for the exact outfit core but must still respect weather, occasion, freshness, and diversity. Do not hard-pin an unsuitable favorite.

Potential rating-to-learning policy requiring product acceptance:

- favorite = strongest positive exact-core signal;
- 4–5 = positive;
- 3 = neutral;
- 0–2 = negative;
- explicit rating should override the current implicit assumption that wearing is always a positive signal.

Production deployment remains separately gated. Safe order:

1. accepted Claude Design behavior and data contract;
2. additive migration plus RPC defaulted/backward-compatible arguments and pgTAP/RLS tests;
3. regenerate types;
4. client behind a feature flag;
5. verify clean account/current account, retry, rollback, and privacy;
6. explicit production mutation owner and approval;
7. database first, client second;
8. rollback client/flag first; do not drop populated columns during an incident.

## 6. Adjacent defects found

These are evidence-backed and should be triaged, not silently bundled:

1. **Wear-learning claim is false:** documentation/comments say a wear trains the style model as a like, but the success path only tracks/invalidate caches and does not apply the reaction/profile update.
2. **Saved worn-row deletion risk:** deleting a Saved plate deletes the outfit row without decrementing item wear counts if the saved row is also a worn diary row, which can corrupt cost-per-wear/history.
3. **Saved plate wear count undercounts:** a worn row saved as a plate can display `not worn yet` because the count considers descendants only and omits the plate's own wear.
4. **Creative name lost on wear:** `p_name: null` means Diary/favorite cannot preserve the title shown on Today.
5. **AI enhancement cache fingerprint incomplete:** weather/events/style summary sent to the function are not all represented in the query key.
6. **Stale RPC type escape hatch:** generated types now know the commands but `commands.ts` still erases argument checking.
7. **Runtime/source mismatch likely for New Event:** current source already contains the LP-03 fix Nelson did not observe; rebuild current main before another layout patch.
8. **Old App Store/design assets contain removed Stylist copy:** do not modify them incidentally, but refresh before final metadata/screenshots if those assets remain candidates.

## 7. Design and tooling status

### Claude Design

- Signed-in Chrome contained project `49b82198-7610-4896-a8ba-94d44ce76f68`, canvas `Cinch UI Excellence Atlas`.
- It was inspected read-only.
- No prompt was submitted and no canvas was changed.
- Recommended next design artifact: a new bounded supplement, not an overwrite of the frozen accepted atlas, covering:
  - Today card with names only;
  - local name taxonomy/matching rules;
  - normal/AX5/offline/AI-enhanced states;
  - wear confirmation sheet with rating 0, 1–5, skipped, favorite on/off, busy, success, failure, retry;
  - owner-only favorite rail/profile state;
  - accessibility/focus/VoiceOver and Reduce Motion;
  - data/analytics/privacy notes and design-to-code table.

Browser-control policy required an action-time confirmation before submitting a prompt to Claude Design. That confirmation had not yet been requested/completed when Nelson asked for this handoff.

### Claude Code

- Old integration recovery session was stopped because its branch was obsolete.
- No changes landed from it.
- Fresh current-main worktree exists and is the correct target.
- The Mac locked before a reliable new Claude Desktop dispatch could be made.

### Taste/GitHub skill

- No installed local skill named `taste` or `design-taste` exists.
- Installed GitHub skills are general GitHub/PR/CI/publish helpers, not a design-taste rubric.
- Use the repo-local evidence/adoption rubric instead:
  - `/Users/nelsonsaenz/cinch/docs/refurb/audit/07-research-design.md`
  - `/Users/nelsonsaenz/cinch/docs/refurb/audit/08-research-features.md`
- Do not claim the nonexistent skill was used. Do not copy another product's visual identity or trade dress.

## 8. Recommended execution phases

### Phase A — current-main bounded repair

Writable worktree: `/Users/nelsonsaenz/cinch-wt-today-polish`

Implement only:

- both People-search prose removals;
- Stylist subtitle removal;
- evidence-based narrow PlaceField alignment only if reproduced;
- wear error preservation/mapping and bounded session lookup;
- narrow RPC typing repair if contained;
- focused tests.

Do not implement rating/favorite or the name library in this phase.

### Phase B — Claude Design supplement and acceptance

Produce and independently accept the names-only Today and rating/favorite/favorite-rail contract. Reconcile it against shipping schema and privacy truth. Do not let Claude Design invent a data field, public visibility, or offline guarantee.

### Phase C — product/data decision

Record Nelson's decisions listed in section 11. Freeze migration/RPC semantics, visibility, rating meaning, and ranking policy.

### Phase D — implementation

Create a separate scoped branch/worktree from the accepted Phase A revision. Implement deterministic naming first, then additive schema/RPC/client favorite/rating behavior with tests and feature flag. Do not apply production mutations from the implementation session.

### Phase E — independent QA

Codex/QA, not Claude Code, grades simulator/device visuals and behavior. Cover normal, error, offline, response-lost, Dynamic Type, VoiceOver, Reduce Motion, clean-account, and returning-account paths. Verify current production/database state separately before any release transition.

## 9. Agent-ready Phase A implementation contract

### Outcome

On current shipping `main`, remove the two approved copy blocks, verify/fix only the remaining New Event single-line baseline issue, and make wear failures diagnosable and honest without changing schema or backend authority.

### Inputs and truth

- worktree `/Users/nelsonsaenz/cinch-wt-today-polish`
- branch `codex/today-polish`
- base `f9463b4`
- current shipping source/runtime > database truth > accepted local handoffs > exact Expo 57 docs > older atlases

### Scope

Included:

- `src/app/people-search.tsx`
- `src/components/stylist/sheet-parts.tsx`
- narrow New Event single-line input source/tests if reproduced
- Today wear mutation/error mapping/session helper use
- narrow command typing
- focused tests

Excluded:

- rating/favorite UI or migration;
- name library or reasoning removal;
- production mutation;
- App Store/design asset changes;
- release/build/OTA;
- offline outbox;
- unrelated polish.

### Authority

- May make reversible local source/test changes in the isolated worktree and commit one scoped revision.
- May inspect repository/runtime and exact official docs.
- May not touch original repo worktree, production services, public accounts, budgets, submissions, or releases.

### Acceptance

- `Find people` remains; both unwanted mutuality explainers are absent.
- `Stylist` and `New question` remain; unwanted subtitle is absent.
- No unrelated privacy or mutual-friend behavior changes.
- Name/Where descenders and caret are fully visible at normal/AX3/AX5 if runtime evidence is available; no fixed-height or multiline regression.
- Wear error type is retained/mapped and unexpected error remains diagnosable.
- Auth/RPC/RLS/idempotency are not weakened.
- Same mounted retry reuses operation identity.
- UI no longer promises crash-safe persistence that does not exist.
- Focused tests, typecheck, and lint pass or exact pre-existing failures are reported.
- Diff contains no migration/dependency/permission/native/release change.
- One scoped commit plus changed-file/test/evidence report.

### Stops

Stop on:

- dirty/overlapping worktree;
- schema/RPC/native/dependency/permission need;
- inability to distinguish current code from stale runtime;
- privacy/auth weakening;
- material contradiction with accepted handoff;
- test failure requiring out-of-scope edits.

## 10. Acceptance matrix for the full requested outcome

| Area | Required evidence |
|---|---|
| People search | Title/search/results preserved; both clutter blocks gone; error/no-result states still work; VoiceOver order checked |
| New Event | Name/Where/Note with descenders, focused/unfocused, keyboard up, default/AX3/AX5, Create reachable |
| Stylist | Header/title/icon/New question aligned; subtitle absent; all initial/chat/questionnaire states checked |
| Today names | 50–100 curated names; deterministic/tag coverage/duplicate avoidance tests; ordinary morning zero-AI contract; no visible reasoning |
| Wear base action | one atomic wear, one increment per piece, retry idempotency, error categories, signed-out/offline/ownership/server cases |
| Rating | null/0/1/5 semantics, cancel, busy, validation, VoiceOver, pgTAP constraint and RLS |
| Favorite | explicit set/unset, owner-only query, rail empty/loading/error/populated, no public leakage, ranking bonus remains context-safe |
| Persistence | displayed name/rating/favorite survive Diary/Closet reload; no Saved/Boards semantic collision |
| Concurrency | double tap, same-op retry, response lost, concurrent set/unset, app termination posture documented |
| Rollback | feature flag/client rollback works; old clients remain compatible; additive columns retained safely |
| Release | independent QA packet only; no self-accepted release claim |

## 11. Decisions/approvals still required from Nelson

1. **Rating zero:** Is 0 a real selectable score, or should the UX be unrated plus 1–5 stars? Recommendation: unrated plus 1–5 unless Nelson explicitly wants an intentional zero.
2. **Favorite visibility:** Recommendation is owner-private only. Any friend/public visibility needs separate explicit approval and privacy/RLS design.
3. **Favorite destination wording:** Should the surface be `Favorite outfits` in the Closet tab, a private owner profile section, or both? Recommendation: one Closet rail linking to the existing lookbook/detail path; avoid duplicate systems.
4. **Learning semantics:** Approve how rating/favorite changes style learning and whether explicit scores override the implicit `wore = positive` assumption.
5. **Database contract:** Approve an additive local migration/RPC implementation after the design is accepted. Production application remains a later, separately owned approval.
6. **Crash/offline guarantee:** Recommendation for this release is online-only with honest retry copy. A durable outbox is a separate project and would require event-time semantics.
7. **Claude Design submission:** Browser action-time confirmation is required before the next agent submits the prepared design directive in Nelson's signed-in Chrome session.

## 12. Exact next action

**Verify `/Users/nelsonsaenz/cinch-wt-today-polish` is still clean at `f9463b4`, then dispatch the Phase A contract in section 9 to Claude Code against that worktree—before opening any schema, rating, favorite, or production work.**

