# The press-feedback campaign — UX-07 across every touchable

Goal: no `active:opacity-*` snap anywhere; every press compresses through
`usePressFeedback` (directly, or via `PressableSurface`/`Chip`/`Button`).

## State (2026-08-21, after tranche 3)

Tranche 3 added the social spine: EventCard (card + both RSVP buttons),
VotePill (vote, retry, Add-yours), OutfitPostCard (menu, comments, mini look
card), the review deck (retry, back, category rows) and the stylist's
message bubbles (outfit strips, retry). ~190 grep hits remain.

## State (2026-08-20, after tranches 1–2)

Converted (~55 sites): all Buttons and Chips, every-screen BackButton, the
closet cards, the four tab screens (Today's masthead discs, Wear/Show-another,
closet FAB + chrome + selection bar, Plan's event CTAs, stylist's membership
line), all of `components/today/*`, stylist sheet-parts (rows, doors, send
disc), settings rows, trip/quiz answer chips and stage cards.

Remaining: ~200 `active:opacity` grep hits across ~75 files (a handful are
comments). Highest-traffic next: EventCard, VotePill, OutfitPostCard,
review-card, message-bubble, item/[id], friends-page + friend-rows +
friend-sheets, garment-search-sheet, event/[id]/* screens, settings-parts,
activity-parts, walkthrough-parts, date-sheet, boards/*, share-look/*.

Deliberately NOT converted: Plan's `Segment` (the sliding oxblood pill IS its
feedback; compression under a moving pill fights it).

## The recipes (hard-won — read before converting)

1. **`PressableSurface`** for cards/rows/tiles/links: className keeps
   ground/ring/padding/margins on the Pressable; child ARRANGEMENT moves to
   `contentStyle`. Pass `fill` whenever the site manages its own geometry
   (fixed w/h, hitSlop-padded, or under 44pt by design) — otherwise the 44pt
   floor is imposed.
2. **Centring**: if the Pressable has definite height (minHeight/height),
   `contentStyle` needs `flex: 1` + the centring — without flex the content
   hugs at the TOP of the box. If the Pressable hugs its content, use
   `contentStyle={{}}` (or a row object with no flex); the default
   `{flex: 1}` inside a hugging parent can collapse to zero.
3. **Inline sandwich** (Pressable → Animated.View(feedback.style) → real View
   with the classes) when the ring/ground must compress with the content
   (chips, discs) or a spec contract owns the visuals.
4. **NEVER put className on Animated.View** — NativeWind cannot paint
   Reanimated wrappers (tokens.ts documents the Button bug; the stylist rows
   shipped one broken release proving it again).
5. After each file: `tsc --noEmit`, eslint the file (kill unused `Pressable`
   imports), and the full suite before an OTA.
