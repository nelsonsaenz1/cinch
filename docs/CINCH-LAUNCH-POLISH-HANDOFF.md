# Cinch launch-polish design handoff

Accepted source: Claude Design project `Cinch launch-polish correction atlas`, project ID `6ff3d818-a490-4abf-830e-52f8d4818024`, canvas `Cinch Launch Polish — First 10 & Events.dc.html`. Accepted 2026-08-15 after correcting LP-02 to preserve the shipping item-detail path.

This file is the local implementation contract for the accepted atlas. Current shipping behavior and data contracts remain authoritative where the atlas is silent. No venue imagery, paid vendor, new data recipient, billing change, backend-schema change, or App Store mutation is authorized.

## Experience rules

- One editorial headline and at most one supporting line before an action.
- Labels and hierarchy explain the interface; do not repeat them in captions.
- Every pushed screen has Back/native swipe-back. Forms and modals have Cancel; dirty forms confirm before discard.
- Manual venue entry is always first-class and creation never depends on search, location permission, or connectivity.
- Dynamic Type reflows through AX5; actions never clip or disappear. Minimum control target is 44 pt.
- Use the shipping color, typography, radius, spacing, shadow, and motion tokens. Do not invent token values.

## LP-01 — Closet

Remove `What one more piece would do.` and its supporting sentence from the Closet menu. Close the space naturally. Remove only that menu row and its wiring; preserve `/gap-feed`, the Today entrance, and commerce work.

## LP-02 — First 10 replacement

A filled tile opens an action sheet in this order: `Retake photo`, `Choose from library`, `Edit details`, `Cancel`. `Edit details` opens the existing `/item/{id}` route and never mutates the slot. Retake/library preserve the existing photo and progress until replacement succeeds. Cancel, denied permission, failure, and backgrounding keep the old slot. Success changes only that slot and never creates an eleventh active item, reorders slots, or restarts onboarding.

Required states: 1/10, 9/10, 10/10, action sheet, replacing, failure, denied permission, AX5. VoiceOver announces `Look N of 10, double-tap for actions.`

## LP-03 — New Event fields

Use label-to-field rhythm of 8 pt and related-group rhythm of 16 pt. Single-line fields have flexible 48 pt minimum height with sufficient vertical inset; Note is multiline and grows naturally. Keyboard-up layouts keep the focused field, caret, text, and Create action visible. Remove the explanatory preamble; retain labels `Name`, `Where`, and `Note`.

## LP-04 — Event detail

Hierarchy: title/state, When, Where, `Your Look` primary action, RSVP summary/actions, group note, then host controls. Preserve existing actions and privacy/membership gates. Render honest `No date yet` / `No place yet` states with an inline add action where authorized. Support host, member, invitee, missing date/venue, long title/note, canceled detail, offline, and AX5 without invented values.

## LP-05 — Venue autocomplete

`Where` remains editable. After meaningful input, show compact MapKit POI suggestions with name first and short address second. The list always ends with `Use “{typed text}”`. Required states: results, loading, no results, location denied, offline, service error, and resolved selection edited. Typing after a resolved selection clears stale address, coordinates, category, URL, and place identifier. No image. Location is just-in-time and optional.

## LP-06 — Accepted copy table

| Surface | Accepted visible headline/support |
|---|---|
| Today | `Today` / `What’s next for you.` |
| Closet | Remove the LP-01 prompt and support copy; do not replace it. |
| First 10 | `First 10` / `Build the ten pieces you reach for most.` |
| New Event | `New event`; no preamble; field labels carry the meaning. |
| Event detail | Event title plus When/Where/Your Look hierarchy; remove the status paragraph. |
| Plan | `Plan` / `Your upcoming events.` |
| Explore | `Explore` / `Looks and ideas to try.` |

Preserve permission, error, recovery, destructive, privacy, billing, and time-sensitive reminder copy. Confirm every `before` string against live code before deleting it.

## LP-07 — Alignment and rhythm

Use one shipping screen gutter, shared title baseline, existing 8/16/24–32 spacing rhythm, shipping card padding/radius, subtle rules, and centered stats. Apply without introducing new tokens.

## LP-08 — Navigation, keyboard, and drafts

Back and native swipe-back work on pushed screens. Cancel is explicit on forms/modals. Clean Cancel dismisses; dirty Cancel/back asks `Discard this event?` with `Discard` and `Keep editing`. Persist one user-scoped, versioned New Event draft across background/termination; restore quietly. Clear only after server-confirmed Create or explicit discard. Submit failure keeps all input. Keyboard dismissal and safe-area insets keep bottom actions reachable.

## LP-09 — Adversarial and accessibility states

Cover long title/note/venue, partial/missing data, denied camera/library/location, offline venue search, failed replacement, First 10 progress 1–10, narrow iPhone width, AX1/AX3/AX5, VoiceOver order and labels, and Reduce Motion. Reflow instead of shrinking essential text; never hide an action. Reduce Motion converts slides/springs to restrained fades/static progress.

## LP-10 — Event cards

Cards are compact list cells, not miniature detail pages. Order: title plus actionable state, date/time, venue or honest missing state, then at most one useful people/look signal. Remove redundant weather/status/headcount lines, decorative sub-boxes, and imagery. Preserve RSVP actions only where actionable. Cover host, member, invited, canceled when present in available data, no-date, long venue/title, default, and AX3/AX5.

## State flows

1. Filled First 10 tile → action sheet → retake/library → replacing with old photo authoritative → success for that slot only; Edit details navigates without mutation; cancel/denied/failure/background preserve the old slot.
2. Type Where → MapKit suggestions plus Use as typed → resolved venue; loading/no-results/denied/offline/error all retain manual entry; editing a selection clears resolved metadata.
3. Start event → dirty → debounced draft persistence; background/kill/relaunch restores; Create success clears; failure keeps; dirty Cancel confirms; explicit discard clears.

## Acceptance

LP-01 through LP-10 must each have targeted behavioral evidence plus simulator evidence for their primary and adversarial states. Automated checks do not substitute for Codex visual acceptance. MapKit makes this a new native runtime/build, not an OTA-only release.
