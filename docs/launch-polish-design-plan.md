# Cinch launch-polish design plan

Status: **Approved brief; design source pending Claude Design acceptance**  
Owner: Claude Design produces; Codex accepts  
Date: 2026-08-15

## Outcome

Make the core closet-and-event journey feel quieter, more native, and more resilient without expanding the product surface. The result must remove explanatory clutter, make corrections recoverable, and keep the primary action visible under real-world text, keyboards, safe areas, connectivity, and accessibility settings.

## Governing source order

1. This approved ten-item brief and `docs/launch-polish-backlog.md`.
2. Current shipping repository behavior and data contracts.
3. Accepted Cinch visual language: warm canvas, restrained oxblood accent, Instrument Serif display, system sans body, rounded plates, existing theme/type/spacing tokens.
4. Exact Expo SDK 57 documentation and Apple Human Interface Guidelines.
5. Existing design specifications where they do not conflict with this brief.

If a prior fixture or design contradicts the approved brief, record the contradiction and follow this brief. Do not invent new social, billing, or backend behavior.

## Experience principles

- One clear headline and no more than one supporting sentence before the primary action.
- Labels and layout should do explanatory work; delete copy that repeats visible state.
- The user always knows how to go back, cancel, preserve, or discard.
- Manual venue entry is a first-class path, not an error or second-class fallback.
- Dynamic Type may increase height; it may not clip, overlap, or hide actions.
- Event cards are informational, not miniature detail pages.
- Location suggestions improve speed but never gate event creation.
- No restaurant imagery in this program.

## Required design atlas

### LP-01 — Closet menu reduction

- Remove “What one more piece would do.” and close the vertical gap naturally.
- Do not add replacement copy, a new row, or another gap explainer.

### LP-02 — First 10 replace flow

- A filled First 10 tile is an obvious button with the existing image retained.
- Tap opens a focused preview/action sheet: `Retake photo`, `Choose from library`, `Cancel`.
- Confirmed replacement swaps only that slot, re-runs the existing image pipeline, preserves slot order and 1/10–10/10 progress, and keeps the old image until the replacement succeeds.
- Cancellation, denied camera/library permission, upload failure, and app backgrounding never erase the current photo.
- Include 1/10, 9/10, 10/10, replacing, failure, and Dynamic Type frames.

### LP-03 — New Event fields

- Occasion/Name, Where, and Note text remain fully visible with correct baseline and vertical insets.
- Single-line fields must grow only when Dynamic Type requires it; multiline Note grows naturally.
- Show keyboard-up states for the top field, Where results, and Note with the submit action reachable.

### LP-04 — Planned-event detail

Above the fold, in order:

1. Back affordance and quiet status/host action.
2. Event title.
3. Date/time and venue as two scannable rows.
4. `Your look` as the primary content/action.

Below the fold:

5. People/RSVP summary.
6. Group note only when present.
7. Secondary logistics and host controls.

Remove duplicate prose and sentence-shaped status explanations. Preserve every existing capability and privacy rule. Include host/member/invitee, posted/no-look, no-date/no-venue, long title, canceled, offline, and large-text frames.

### LP-05 — Nearby venue autocomplete

- `Where` remains a normal editable field.
- After a short query, show compact nearby suggestions biased to the current/event region.
- Each row: venue name first, short locality/address second; no image.
- Always show `Use “{typed text}”` as the final row.
- Permission prompt occurs only after an explicit nearby-search action or contextual explanation; denied permission searches without precise location or keeps manual entry available.
- Loading, no-results, offline, denied, and service-error states use one quiet line and never block typing or Create.
- Selecting a suggestion stores the existing venue snapshot shape; editing afterward clears stale resolved metadata.

### LP-06 — Core copy reduction

Audit Today, Closet, First 10, New Event, Event Detail, Plan, and Explore. For every string mark `keep`, `shorten`, or `delete`, with before/after copy. Preserve trust-critical, permission, billing, destructive, and error explanations. Delete repeated disclaimers and captions whose meaning is already visible.

### LP-07 — Alignment and spacing system

Use existing tokens and define a single cross-screen rhythm:

- common screen gutter and title baseline;
- 8pt minimum label-to-control spacing;
- 16pt related-content spacing;
- 24–32pt section spacing;
- consistent card padding/radius/border;
- centered stat values and labels;
- no negative spacing fixes except intentional avatar overlap.

Show Today, Closet, Plan, Explore, New Event, event list, and event detail as a comparison strip at standard and large Dynamic Type.

### LP-08 — Navigation, keyboard, safe area, cancel, and drafts

- Every pushed screen has a visible back action and preserves the native swipe-back gesture where valid.
- Every modal/form has explicit Cancel; dirty forms ask before discard.
- New Event draft survives background/foreground and accidental navigation; successful creation clears it; explicit discard clears it.
- Focused inputs scroll above keyboard; bottom actions remain reachable; content clears home indicator and top safe area.
- Define behavior for back gesture, Cancel, app kill/restore, submit success, and submit failure.

### LP-09 — Adversarial state board

Render: 60-character event title, 280-character note, long venue/address, partial event, no date, no venue, denied location/camera/library, offline venue search, failed replacement upload, 1/10–10/10 closet progress, AX1/AX3/AX5 Dynamic Type, VoiceOver labels/order, Reduce Motion, and smallest supported iPhone.

### LP-10 — Event card simplification

Hierarchy only:

1. title + actionable state;
2. date/time;
3. venue or honest missing-state text;
4. one compact people/look signal when useful.

Remove redundant weather/status/headcount lines and decorative sub-boxes. Do not add venue photos, map screenshots, new badges, or new services. Include host/member/invited/canceled/no-date/long-content variants.

## Design acceptance checklist

- Every LP-01–LP-10 item has at least one labeled frame and every state listed above has a frame or explicit behavior note.
- Copy table covers every core screen and does not remove legal, privacy, permission, destructive, billing, or recovery text.
- Layout is feasible with existing tokens/components; new primitives are identified rather than silently invented.
- Venue search uses MapKit semantics with manual fallback and no imagery.
- Handoff names exact components/screens, interactions, empty/loading/error states, accessibility labels, and motion.
- No design is accepted from a screenshot alone; the editable source and written behavior contract are both required.

## Out of scope

- Venue photography, Google Places, Yelp media, reservations inventory, or a paid places vendor.
- New social mechanics, billing/paywall changes, analytics identity changes, or backend schema changes beyond an unavoidable existing draft store contract.
- App Store submission or promotion.
