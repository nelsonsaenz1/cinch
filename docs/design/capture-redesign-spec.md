# Capture redesign — build spec

Source of truth: the founder's **Capture State Atlas**
(`docs/design/capture-atlas/Capture State Atlas.dc.html`, states C-01…C-12,
renderings in `capture-atlas/renderings/`). This spec transcribes it into build
instructions against the real codebase. Where the atlas and this doc disagree,
the atlas wins. Where the atlas is silent, current shipping behavior wins.

**Status at time of writing**: `src/app/capture.tsx`, `consent-sheet.tsx`,
`upload-queue-list.tsx` and `queue-store.ts` already implement the atlas — the
atlas was traced from them. The build work is (a) verifying every state
pixel-for-pixel against the renderings, (b) rebuilding the stale
`dev-capture.tsx` harness, which still shows the pre-live-preview 07a/07b
design ("Close", a spacer where Describe belongs, `heading` not `plate`, no
error/blocked/declined states).

**Scope**: `src/app/capture.tsx`, `src/app/dev-capture.tsx`,
`src/components/ingest/*`. The ingest data layer (`queue-store.ts`,
`upload-queue.ts`, `use-capture.ts`, `use-camera-access.ts`) is **untouched**
except where the atlas names its selectors.

## Fixed geometry

Three bands hold their geometry through every state; only the sheet changes
height. The stage is the one dark screen in a light-only app: ink stage,
canvas type, light status bar.

1. **Header** — serif `plate` "Add clothes" in canvas, left; "Done" (never
   "Close") semibold body, right.
2. **Stage** — `mx-4 my-2 flex-1 rounded-plate`, live `CameraView` when
   `access === 'granted' && !previewFailed`, `active={focused}`. Corner guides
   22×22, 2pt, canvas at 0.55, inset 20. Hint "One garment, plain background"
   bottom 22, canvas 0.75, warm-ink text shadow `rgba(28,26,22,0.55)`.
3. **Control row** — `px-8 py-2`. Library (left) and Describe (right) labels:
   `minWidth: 64`, shrink-to-fit, never clip. Shutter: 64pt ring (3pt canvas
   border), 50pt canvas disc. Third slot is **Describe, not Flip**.
4. **Progress sheet** — `rounded-t-plate bg-surface px-gutter pt-4`, flush to
   the bottom edge.

## States

| ID | Condition | What renders |
|---|---|---|
| C-01 | `access==='granted' && !previewFailed && jobs.length===0` | Live viewfinder, corner guides, hint; idle sheet "Photograph your closet" + up-to-20 body |
| C-02 | `access==='checking'` | Instructional frame (tshirt glyph 44 @ 0.5, surface wash 0.04) stands in; shutter dimmed to 0.35 and inert (`disabled: access!=='granted'`); one permission request per visit, ref-guarded |
| C-03 | `access==='blocked'` | Canvas plate in the stage (`EmptyState`, camera.fill, "Camera access is off", "Open Settings"). Library/Describe stay live. Permission re-read on foreground |
| C-04 | `previewFailed` | Same instructional frame as C-02 but shutter stays **live** → system camera fallback; holds for the rest of the visit |
| C-05 | `!consent.granted` && a door tapped | `ConsentSheet` bottom sheet over dimmed stage: grabber, "Before Cinch looks", 3 ✦ promise rows, ink "Allow processing", ghost "Not now", Profile footnote. Scrim tap = Not now. Interrupted action resumes `onDismiss` (450ms fallback) |
| C-06 | `declinedConsent && jobs.length===0` | Idle sheet headline + "AI processing is off, so Cinch can't cut out or tag photos yet." + secondary "Turn it on" reopening the sheet. `accessibilityLiveRegion="polite"` |
| C-07 | `capacity.full` | Capture renders nothing; Superwall `AddGarmentOverLimit` takes the tap. On grant, dispatch directly (never back through the guard), deferred past the paywall's dismissal |
| C-08 | first shot | "Processing 1 of 1 · Cleaning…" / "1 to go"; shutter disc 0.5 while `shooting`; thumb enters with 180ms fade + sheen |
| C-09 | mid-batch | "Processing {settled+1} of {total} · {phase}" — headline counts **settled** jobs; rail front-to-back, finished pieces named ("Coat ✓"), in-flight show stage |
| C-10 | `total>0 && active===0 && failed===0` | "All added"; progress track **unmounts**; "Review tags" primary + haptic. Button appears from first `done` (secondary while running) |
| C-11 | `failedCount>0 && canRetry` | "Added X of Y" / critical "N couldn't be added"; warning-wash banner: "N pieces stopped", `userFacingFailure(job)` sentence, "Try these again" + "Leave them untagged" |
| C-12 | failed && `retryable===false` | Same banner, dismissal only — no retry that's guaranteed to disappoint |

## The rail (seven stages, one thumbnail)

52pt wide, 64pt image, caption below. Stage words come from `STAGE_LABEL` in
`queue-store.ts` — the single table both the headline and rail read; an
ellipsis marks a working stage, a settled stage never carries one.

- `Queued` — image at 0.4, dashed `rule` border
- `Preparing…` / `Cleaning…` / `Uploading…` / `Categorising…` — 0.7, sheen
  breathing 0.18→0.45 @ 700ms (held still under Reduce Motion)
- named `{label} ✓` — full opacity
- `Failed` — caption in `critical`

## Control-row rules

- **Describe, not Flip** — a front-camera shot of a garment at arm's length is
  not a garment photograph; Describe passes the same gates (same INSERT, same
  model call).
- Labels take the width they need (`minWidth`, `adjustsFontSizeToFit`).
- Haptics best-effort (`Haptics.selectionAsync().catch`) — no-op during camera
  session / Low Power Mode; pressed state is the real feedback.
- "Done" ends the session at the stage; the queue keeps running. A settled
  batch clears on exit; anything moving persists and resumes next launch.

## Gate order

Capacity **before** consent, both before the picker. On a paywall grant the
action dispatches directly — the guard's closure still holds the stale `full`.
The database trigger (`items_enforce_limit`) remains the authority.

## Harness (`dev-capture.tsx`)

Rebuild as an atlas harness: vertically stacked, `__DEV__`-gated, no auth, no
real camera/queue — every band hardcoded per state. Must show at minimum:
C-01 (stage stood in by a photo well — no live camera in a fixture),
C-03, C-04, C-05 (inline replica), C-06, C-09, C-10, C-11, C-12, and the
seven-stage rail strip. Derivations (headline, "N to go", banner copy) computed
exactly as `capture.tsx` computes them so the fixture cannot drift.
