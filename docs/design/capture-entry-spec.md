# Add Clothes — entry chooser: design brief

**Written 2026-08-11.** This is a brief for a page that does not exist yet —
there is no atlas, founder drop, or spec to transcribe from. Everything below
is scope and constraints for Claude Design to draw against, not a build spec
transcribed from a rendering the way `capture-redesign-spec.md` is.

## The problem

`src/app/capture.tsx` currently opens directly into a live camera view
(state C-01 in the Capture State Atlas) the instant a user taps "add
clothes." Library and Describe exist only as small side controls in the
control row once the camera is already on screen — there is no page where a
user chooses *how* they want to add a piece before one method is assumed for
them.

Eight places in the app currently route straight to `/capture` with no
chooser in between: the empty closet, the empty stylist closet, a gap-feed
suggestion, Today's "add a piece Cinch is missing" row, Plan, the
Walkthrough's photo-prompt fallback, and an event's empty-closet prompt
(`grep -rn "router.push('/capture')" src`, eight call sites, 2026-08-11).
Whatever this page becomes, all eight need to land on it instead — that's an
engineering follow-up once the design exists, not something Design needs to
solve, but it's worth knowing the door is wide, not one button on one
screen.

## What this page needs to do

Present the ways to add a piece as equal doors, then route to the right next
screen for whichever one is tapped:

1. **Camera** → today's live-viewfinder capture (`capture.tsx`, C-01 onward).
   Unchanged downstream — this page is only what comes *before* it.
2. **Photo Library** → the existing library picker
   (`useCapture().pickFromLibrary`), which already feeds the same upload
   queue as a camera shot.
3. **Describe it instead** → the existing text/search fallback
   (`garment-search-sheet`, Describe State Atlas D-01…D-12), already built
   and already reachable today as a control-row option. On this page it
   becomes a first-class door, not a small side link.
4. **A fourth option, working title "Lookup"** — **not yet defined.** The
   founder used this word without saying what it looks up. Before Design
   draws a fourth door, get an answer to at least one of:
   - Scan a barcode/tag to pull a garment's brand and material off a retail
     database?
   - Search a retailer/catalog to add an item you own but haven't
     photographed?
   - Something else entirely?

   No code in the repo implements any of these today — this would be new
   product surface, not a new door onto existing plumbing like the other
   three. **Do not draw this door's destination screen until that's
   settled**; the chooser page itself can still reserve a fourth slot in
   layout so the grid doesn't have to be redrawn later.

## Visual language to inherit

This page sits in the same territory as the Capture and Queue atlases
(`docs/design/capture-atlas/`) — paper canvas, warm ink, one oxblood action,
`rounded-plate` (20px) cards, Instrument Serif for the page title. It is not
a new dialect the way Welcome & Sign-in or Stylist earned their own (those
diverge because they're genuinely separate territory — a marketing-toned
entry funnel and a conversational chat surface). This is a landing page for
an existing flow; it should look like it belongs directly upstream of the
Capture State Atlas, not like a fifth design system.

Fixed geometry to match, per `capture-redesign-spec.md`'s own header
convention: serif `plate` title left, plain "Done"/"Cancel" right — never a
glass-chrome affordance this app doesn't otherwise use.

## States to draw

- **Default** — all doors available (or three plus a reserved fourth slot,
  if Lookup isn't defined yet by the time this is drawn).
- **Camera access previously denied** — the Camera door should reflect this
  before it's tapped, not fail silently after (compare Capture's C-03,
  which shows an `EmptyState` inline rather than pretending the door works).
- **AI processing declined** (`!consent.granted` in `capture.tsx` today) —
  decide whether this page is where consent gets asked, or whether it stays
  deferred to the first door tapped (today's behavior, C-05). Recommend
  keeping consent deferred to the door tap rather than gating the chooser
  itself — a user should be able to see their options before being asked to
  agree to anything.
- **At the closet's item ceiling** (`capacity.full`) — today Capture renders
  nothing and hands the tap straight to the paywall (C-07). This page
  inherits the same rule: decide whether the ceiling blocks the whole
  chooser or is caught per-door, same as today.

## Out of scope

- Redrawing Camera, Library, or Describe's own destination screens — all
  three exist and are shipped. This page is only the door.
- Defining Lookup's destination. See above.
- Rewiring the eight existing entry points. Engineering work, not design.
