# Design review — 2026-08-17

Scope: every UI surface added or modified in the two days to `ef2e37b`, per the
recovery directive's Phase 2 protocol.

**Read the limitation first.** This is a static review — routes, state coverage, and token
usage read from source. **It is not visual acceptance and does not substitute for it.** The
screenshot half is blocked; the block is real, specific, and described at the bottom with the exact
steps to clear it. No screenshot is offered here, and no self-authored visual verdict is either.

## Inventory

`git log --since="2 days ago" --name-only` over UI paths returns 282 files. **205 of them are the
`dev-*` fixtures `9a92767` moved** to `src/dev-fixtures/` — they appear as touched because they were
relocated, not restyled, and they no longer render in the app at all. Filtering those and files that
no longer exist leaves **77 genuinely changed UI files**, of which 22 are routes.

### Routes changed

| Route | Surface | New in this window? |
|---|---|---|
| `src/app/groups/index.tsx` | Private Circles list | **yes** |
| `src/app/groups/create.tsx` | Create a circle | **yes** |
| `src/app/groups/[circleId]/index.tsx` | Circle detail / roster | **yes** |
| `src/app/groups/[circleId]/invite.tsx` | Invite to circle | **yes** |
| `src/app/groups/[circleId]/manage.tsx` | Manage members | **yes** |
| `src/app/groups/_layout.tsx` | Circles stack | **yes** |
| `src/app/(tabs)/index.tsx` · `closet` · `explore` · `plan` · `_layout` | the four tabs | modified |
| `src/app/privacy.tsx` · `privacy/visibility.tsx` | privacy controls | modified |
| `src/app/profile.tsx` · `settings.tsx` | account | modified |
| `src/app/event/new.tsx` · `event/[id]/index.tsx` | occasions | modified |
| `src/app/friends/index.tsx` · `people-search.tsx` | social | modified |
| `src/app/repeat-outfit.tsx` · `the-ten.tsx` | styling | modified |

Two component families are new: `src/components/circles/` (7 files) and
`src/components/daily-social/` (8 files).

## Per-screen state coverage

Both new feature families ship a dedicated `state-screens.tsx`, which is the pattern this repo
already uses, and coverage checked out better than the directive's premise assumed:

| Screen | Loading | Empty | Error | Notes |
|---|---|---|---|---|
| `groups/index` | ✅ | ✅ | ✅ | |
| `groups/[circleId]/index` | ✅ | ✅ | ✅ | |
| `groups/create` | ✅ | n/a | ✅ | via `onError` → `classifyCircleError`, plus a terms-gate intercept |
| `activity` | ✅ | ✅ | ✅ | empty state is deliberate and documented at `ActivityPage.tsx:205`; `:110` records that a failed read is never dressed as an empty page |

`daily-social` carries `look-skeleton.tsx` for its wait state and a `state-screens.tsx` covering
the six states its contract names. Nothing here needs adding.

## Findings

### 1. The insight-card is still shipping — the one real refacing gap

`docs/design/refacing-directive.md` and the refacing README's Reference B are explicit: **"No bars,
no percentages, anywhere."** The component is still imported and rendered:

- `src/components/closet/insight-card.tsx` — exists
- `src/app/(tabs)/closet.tsx:24` — imported
- `src/app/(tabs)/closet.tsx:731` — rendered
- `src/components/ui/index.ts:49` — still referenced

This is the directive's "insight-card bar removed" item, and it is **documented intent that was
never executed**, not a completed state that regressed. It is the single genuine piece of refacing
work outstanding on the surfaces in scope.

**Not done here, deliberately.** Removing it changes the Closet tab's composition and wants the
design decision made on its own terms — what replaces the space, and whether the Closet reads
correctly without it — rather than being folded into a recovery pass. It is also the one change in
this review that a screenshot would actually adjudicate, and screenshots are blocked.

### 2. "AC/GF atlases" does not name what the directive thinks

Recorded because it will mislead the next reader. **AC** is the *Add Clothes* atlas
(`docs/design/refacing/README.md`, states AC-01…AC-05), **not** Activity Center — so a lane aiming
Activity Center work at "the AC atlas" is aiming at the wrong document. **GF** matches nothing in
`docs/`; the nearest real thing is the Gap Feed, never abbreviated that way. "Wave 3" is a delivery
wave, not a visual motif, and "occasion" is the New Occasion feature.

### 3. The capture harness was broken, and is now fixed

`scripts/screenshot-matrix.mjs` deep-linked to four `dev-*` routes that `9a92767` removed from the
router. Dead links do not error — the run captured the same screen four times and `collisions()`
failed it. **This is why no PNGs or manifest have been produced since the fixture move.** Fixed in
`950cb77`: the matrix now shoots the shipping screens and covers `groups`, `activity`, `settings`
and `privacy/visibility`, none of which it had ever captured.

## What blocks the screenshots, and how to clear it

Three things, all real:

1. **Metro is not running.** `localhost:8081` → no response.
2. **The Superwall key must be blanked first.** `superwall.tsx` sets
   `testModeBehavior: __DEV__ ? 'always' : 'automatic'`, so a DEV build paints a full-screen
   "Test Mode Active" sheet over every cold launch. The script's header is emphatic that passing the
   var on the command line is **not** enough — Expo's dotenv re-exports the file's value over the
   inherited one, and `EXPO_PUBLIC_` vars are inlined at bundle time, so the cache must be cleared:

   ```
   EXPO_PUBLIC_SUPERWALL_API_KEY_IOS=
   npx expo start --dev-client -c
   ```

   The env files are gitignored, so nothing warns you if you leave the app keyless afterwards.
3. **The baseline is unusable.** `shots/baseline/matrix.json` is dated **12 August**, predating the
   fixture move, and holds `today`/`closet`/`truncation`/`controls` — two ids no longer captured and
   six new ones with no baseline. A `--baseline` run has to come first; there is nothing to diff
   against until it does.

Then: `node scripts/screenshot-matrix.mjs --baseline`, restore the key, and re-run with `--diff` on
subsequent passes.

**Also unavailable in this session:** the `design` plugin MCP connectors (Figma, Linear, Notion,
Slack, Asana, Atlassian, Intercom) are unauthorized and cannot be authorized here — the session is
non-interactive. Any step needing Claude Design proper has to run interactively.

## Verdict

Per-screen visual acceptance is **not given and is not mine to give.** What this pass establishes:
state coverage on the new surfaces is complete, the harness that produces the evidence is repaired,
and exactly one refacing item — the insight-card — is genuinely outstanding on the screens in scope.
