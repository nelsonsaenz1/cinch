# Founder mocks — 2026-08-05

Two screens the founder supplied as target designs during the social build.
These override any conflicting layout in product-spec.md. Visual language is
The Plate throughout: cream/ink palette, serif display for titles, letter-spaced
small caps for labels, oxblood as the single accent.

## 1. Plan tab — group events live INSIDE Plan

The events list is not a new tab. The existing Plan tab gets a segmented
pill toggle at the top: **Week | Events** (Week = the existing outfit
calendar, Events = the new social events list). Tab bar stays TODAY /
CLOSET / PLAN.

Anatomy, top to bottom:
- Header: serif "Plan", right-aligned muted date range of the current week
  ("5–11 Aug").
- Segmented control: pill track in sand; active segment is an ink pill with
  cream text.
- Primary CTA: full-width ink pill button — left: "+ New event" (bold cream),
  right: "Invite friends" in muted cream. One control, two affordances.
- Event cards (cream surface, rounded-plate, hairline border, generous
  padding):
  - Row 1: serif event title ("Rooftop dinner") · right-aligned muted date
    ("Fri 8 Aug"; ranges for multi-day: "12–16 Sep").
  - Row 2: muted metadata line "Location · weather" ("Shoreditch · 19° clear").
    Weather is display-only enrichment — reuse the app's existing weather
    source if one exists; otherwise leave a seam and render location only.
  - Row 3: overlapping attendee avatar chips (initials on muted color
    circles, ~3 shown), "4 of 6 going" (accepted of invited) or "9 going",
    then a right-aligned status chip:
    - `LOOK SET` — sand chip, muted text: the viewer has a crowned/chosen look.
    - `NEEDS A LOOK` — oxblood chip, cream text: the viewer hasn't posted
      outfit options yet. The one loud element on the page.
    - `PACKING` — sand chip: multi-day/travel events ("Lisbon, 4 nights",
      category "Travel") use packing language instead of a single look.
- Statuses are per-viewer, not global.

Notable scope implications the mock confirms:
- Events include multi-day travel ("Lisbon, 4 nights") — event needs an
  optional end date and a category (dinner/wedding/travel/other). Packing
  flow itself can be a stub state at MVP; the card just shows the chip.
- "N of M going" implies invited-count vs accepted-count on the card query.

## 1b. Event detail — the group dinner page

Anatomy, top to bottom:
- Back row: chevron + small-caps muted "EVENT".
- Serif display title ("Rooftop dinner").
- Muted metadata paragraph: "Fri 8 Aug, 7:30pm · Shoreditch · 19° clear,
  cool after dark" — date+time, location, weather with a human clause.
- RSVP row: two pills side by side — "Going" (ink pill, cream text: the
  viewer's active RSVP state) and "Invite" (outline pill, cream surface).
- YOUR LOOK card — the viewer's own board, visually distinct: blush-tinted
  surface (rose-tinted sand) with hairline rose border, rounded-plate.
  Contents: small-caps oxblood label "YOUR LOOK"; a row of 3 garment plate
  swatches beside the look name in serif-adjacent body ("Oxblood & Cream")
  with a muted styling note under it ("Coat for the walk home" — note the
  weather-aware tone; this line is the outfit's occasion note, stylist- or
  self-authored); two outline pills: "Swap a piece" · "Share with group"
  (share = post/update the look to the event board).
- WHO'S WEARING WHAT section: small-caps label, right-aligned muted
  "4 of 6 shared" (attendees who have posted looks / total going).
  Two-column grid of attendee look cards: each is a triptych of garment
  plates (the look's 3 key pieces as flat color plates), then a row with
  the attendee's initial-avatar chip + first name, then a one-line muted
  descriptor ("Navy overshirt", "Cream slip, tan boots").
- Voting/compliments and comments continue below the fold per
  product-spec.md mechanics — the mock does not override them.

Notes: mixed-gender groups appear (a "Jonah" attends) — nothing in copy
or design assumes women-only, even though styling copy leans feminine.
"Shared" is the public verb for posting a look to the group.

## 2. Closet tab — profile-as-closet

The closet page becomes the user's own profile. Top to bottom:
- Header: serif "Closet", right: search and overflow icons.
- Profile row: large circled monogram avatar ("ME", sand fill, oxblood serif
  initials) beside three stats, each a serif numeral over a small-caps
  label: PIECES (54) · OUTFITS (128) · UNWORN (1, numeral in oxblood).
- Serif display name ("Mara Ellis"), muted "@handle · City" line beneath.
- Bio line in body text, including "Averages £2.40 a wear." — the computed
  average cost-per-wear surfaced as prose.
- Style-tag chips (sand pills): e.g. "Quiet tailoring", "Warm neutrals",
  "Wool first" — from the style profile.
- FAVOURITE PIECES section (small-caps label, right: "Edit" in oxblood):
  horizontal rail of garment plates with caption ("Charcoal wool coat") and
  muted wear count ("27 wears").
- MOST WORN section: vertical list — small plate thumb, name, horizontal
  wear bar (dusty rose), right-aligned "61 wears".

Build note: this redesign is deliberately sequenced AFTER the social wave
integrates (handle/city/style tags ride the social_profiles surface, and the
graph agent owns closet-adjacent files during the wave).
