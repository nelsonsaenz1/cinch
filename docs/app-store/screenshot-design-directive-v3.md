# App Store screenshots v3 — design directive for Claude Design

**Written 2026-08-18, for the redesigned app (v1.1.0, "The Plate").
Supersedes `screenshot-directive-v2.md`. This document is self-contained:
everything Claude Design needs — palette, type, geometry, copy, photo
assignments, output spec — is stated here. The founder will supply the raw
inputs (UI captures and photographs) alongside this document.**

The deliverable: **seven portrait frames, 1320 × 2868 px each**, exported as
flattened PNG (no alpha), one file per frame, named `01-*.png` … `07-*.png`.

---

## 1 · The research this set is built on

A fresh sweep (Aug 2026) of the category and of ASO A/B data. The findings
that bind every decision below:

1. **Frame 1 is, for most visitors, the only frame.** Search results render
   three portrait screenshots; a product page gets ~7 seconds; roughly half
   of installs are decided on the first frame alone and only ~11% of
   visitors ever reach the fifth. Design frame 1 as if it is the only card
   anyone will ever see, and frames 1–3 as three self-contained claims —
   never a narrative that pays off later.
2. **Captions go on top.** Top-stacked captions outperform bottom-stacked by
   15–25% in category testing, and 7 of the 8 fashion apps inspected put
   them there. Benefit-led sentence case ("See your wardrobe clearly")
   outperforms Title-Case feature labels ("Closet Organizer").
3. **Readability at thumbnail size is a pass/fail gate.** At our 1320 × 2868
   canvas: headline ≥ 140px, subline ≥ 56px, nothing under 44px anywhere.
   The test: zoom the finished frame to 25%; if the headline is not
   instantly readable, the frame fails. Screenshots render ~200px wide in
   search results.
4. **Serif typography is how this category signals fashion.** The premium
   sets (Indyx, Whering, Vinted) all lead with an editorial serif or
   serif-accented headline; the utility sets (Smart Closet, Acloset) read
   like tools. Cinch is a premium set.
5. **What the best fashion sets share:** one consistent, ownable background
   across all frames (Vinted's petrol teal, Depop's red) *or* warm
   lifestyle photography behind a floating UI card (Indyx); real garments
   as background-removed cutouts as the category's core proof; borderless
   floating UI cards rather than literal black iPhone frames; real
   photography of clothes and people, not illustration.
6. **No panoramas.** The claimed conversion lift for multi-frame panoramic
   designs does not survive scrutiny, and ~9 in 10 visitors would never see
   the panorama resolve. Every frame stands alone.

Two rules carried forward from v2, still binding:

- **No invented social proof.** No press logos we haven't earned, no user
  counts we don't have, no star badges. Whering can print VOGUE; we cannot,
  and a reviewer can reject fabricated claims. The set persuades with the
  product and the photography.
- **Real UI only.** Every interface shown must be the shipping app,
  captured from the current build — not a mockup, not "cleaned up." (Slight
  recomposition to fit the crop is fine; inventing UI that doesn't exist is
  not.)

---

## 2 · The visual system

Cinch already has a strong identity — warm gallery neutrals, oxblood, one
serif. The screenshots are that identity at poster scale. **Every colour
below is the app's own; do not introduce any other.**

| Token | Hex | Use in frames |
|---|---|---|
| Paper | `#E7E3D9` | The set's unifying background (see below) |
| Canvas | `#FBFAF6` | UI cards' own ground; alternate frame bg |
| Ink | `#1C1A16` | Headlines, primary text |
| Muted | `#6B665C` | Sublines |
| Oxblood accent | `#6E2B2B` | One accent moment per frame, italics, rules |
| Blush | `#F7EDE8` | Soft fills, chips |
| Tray/Sand | `#F0ECE3` / `#EAE5DB` | Card wells, garment tiles |

**Background strategy (the Vinted lesson, in our palette):** all seven
frames sit on **Paper `#E7E3D9`**, except frames 1 and 5, which are
photographic (details below). A buyer swiping the gallery should feel one
continuous warm surface — that consistency *is* the brand block.

**Typography:**
- Headlines: **Instrument Serif 400** (regular, never bold — the app never
  uses a bold cut and neither does its marketing), sentence case, ink,
  ~150–170px, tight leading (1.05). One or two words per headline may be
  *italic* and/or oxblood — the same device the welcome screen uses
  ("Your *closet*. Your *friends*. Your *stylist*.").
- Sublines: Helvetica Neue 400, muted `#6B665C`, 56–64px, max one line.
- Caption block: top of frame, left-aligned at an 88px left margin, headline
  then subline, starting ~180px from the top edge. Keep all text ≥ 60px
  from every canvas edge.
- Editorial garnish (optional, from Indyx): a small vertical serif italic
  word along the right edge in oxblood at ~54px opacity 60% — "*dress*",
  "*plan*", "*share*" — one word, only where it doesn't crowd. Skip it on
  any frame where it competes with UI.

**The UI card:** each interface capture floats as a borderless rounded card
(radius 72px at this scale), soft shadow (`0 40px 120px rgba(28,26,22,0.18)`),
occupying roughly the lower 68–72% of the frame, cropped at the bottom edge
(the card runs off-canvas — a zoomed, confident crop beats a tiny whole
phone). No black iPhone bezels, no notch, no status bar in the capture.

**Photography:** the founder supplies the app's own licensed photographs
(Pexels/Unsplash/Pixabay, commercial use, no attribution — already cleared).
The palette of every photo is the app's palette: cognac, camel, cream,
charcoal, brown leather. Named per-frame below. Photographs are used
full-bleed with a subtle darkening scrim where type sits over them —
exactly the welcome screen's treatment.

---

## 3 · The seven frames

Order is the argument: hook → proof of ease → the closet → the stylist →
friends → planning → value. Frames 1–3 each make a complete, independent
claim.

### Frame 01 — the hook (photographic)
- **Headline:** `Your closet. Styled.`  ("Styled." in italic oxblood — on
  the scrim use blush `#F7EDE8` for the italic word instead of oxblood, and
  white-cream `#FBFAF6` for the rest; oxblood fails contrast on a dark photo.)
- **Subline:** `An outfit for every morning, from clothes you already own.`
- **Composition:** full-bleed **cognac shearling coat on the rack**
  (`cognac-shearling-coat.jpg` — the welcome screen's own cover photo, so
  the store page and the first screen of the app are the same world), scrim
  bottom-to-top `rgba(28,26,22,0.55 → 0.15)`. Caption block on the upper
  third. Lower half: the **Today page** UI card, tilted 0° (no rotation
  anywhere in this set), showing a composed outfit plate with its cutout
  garments. This one frame must read as: *photograph = your wardrobe,
  card = what the app does with it.*

### Frame 02 — the objection (getting started is fast)
- **Headline:** `Start with just ten pieces.`
- **Subline:** `Snap them once — Cinch cuts them out and does the rest.`
- **Composition:** Paper ground. UI card: the Ten intake screen with its
  progress ("7 of 10") and a grid of cutout garments. Above the card, three
  small photo chips (240px rounded squares, radius 48px) showing real
  garment photos — `cream-mohair-sweater.jpg`, `brown-leather-loafers.jpg`,
  `cognac-leather-tote.jpg` — each with a subtle arrow motif flowing into
  the card: photograph in, cutout out. The category's open wound is "I
  don't want to photograph 200 items"; this frame closes it.

### Frame 03 — the closet
- **Headline:** `Every piece, remembered.`
- **Subline:** `Your whole wardrobe in your pocket — searchable, wearable.`
- **Composition:** Paper ground. UI card: the redesigned Closet grid —
  clean cutout/stock images on canvas tiles (the grid is the proof; it must
  fill the card edge to edge with at least 9 visible garments in the warm
  neutral palette). Editorial garnish word allowed here: "*dress*".

### Frame 04 — the stylist
- **Headline:** `A stylist who knows your closet.`
- **Subline:** `Ask for a look — get outfits from your own clothes.`
- **Composition:** Paper ground. UI card: the Stylist chat showing one user
  ask ("What do I wear to a gallery opening?") and the stylist's reply with
  a composed outfit suggestion from the user's pieces. The word "AI"
  appears nowhere in a headline (the research is unambiguous; the benefit
  is the stylist, not the technology).

### Frame 05 — friends (photographic)
- **Headline:** `Get dressed together.`
- **Subline:** `Share looks, vote on outfits, borrow from friends.`
- **Composition:** the set's second photographic frame. Full-bleed
  `charcoal-tailored-trousers.jpg` (the overhead first-person shot — a
  human moment without a face, which keeps us out of casting/likeness
  questions), same scrim treatment as frame 1, light-on-dark caption. UI
  card: the Event page's **Table Talk & Outfit Voting** — two look options
  with vote pills. Social is the moat; this is its frame.

### Frame 06 — planning
- **Headline:** `Packed before you are.`
- **Subline:** `Plan the week, pack the trip — every day already dressed.`
- **Composition:** Paper ground. UI card: the Week page with its dated day
  rows and composed outfits. A second, smaller card (overlapping the first
  at ~40% width, upper right) shows the packing memo. Two cards maximum —
  more becomes clutter.

### Frame 07 — value
- **Headline:** `Wear what you own.`
- **Subline:** `Cost-per-wear shows every piece earning its place.`
- **Composition:** Paper ground. UI card: an item detail with its
  cost-per-wear line (the `$8.20 / wear` device from the welcome screen).
  Above the card, one wide blush chip with the shearling coat cutout and
  `SHEARLING COAT · WORN 34 TIMES · $8.20 / WEAR` in small caps —
  the app's most quietly persuasive sentence.

---

## 4 · Inputs the founder will hand you

1. **UI captures** — simulator screenshots of the current build (Today,
   Ten intake, Closet, Stylist, Event/Table Talk, Week + packing, item
   detail), captured at iPhone 17 Pro resolution, light mode, full quality.
   Crop status bars away.
2. **Photographs** — the licensed set named above (`cognac-shearling-coat`,
   `cream-mohair-sweater`, `brown-leather-loafers`, `cognac-leather-tote`,
   `charcoal-tailored-trousers`, plus the rest of the ten-photo capsule as
   spares: white-linen-blouse, beige-overshirt-jacket, beige-corduroy-skirt,
   brown-leather-boots, brown-leather-crossbody-bag, cream-crochet-poncho).
3. The Instrument Serif font (Google Fonts, free) — 400 regular + italic
   only. Body sans is Helvetica Neue.

If a listed UI capture is missing or looks wrong, say so and pause that
frame rather than substituting invented UI.

---

## 5 · Output spec (pass/fail checklist per frame)

- [ ] 1320 × 2868 px portrait, PNG, RGB, flattened, **no alpha channel**,
      < 10 MB. (Apple's 6.9" class; App Store Connect auto-scales every
      smaller device from this one master set.)
- [ ] Headline ≥ 140px, subline ≥ 56px, no text under 44px, all text ≥ 60px
      from canvas edges.
- [ ] Passes the 25% zoom test: headline instantly readable at thumbnail.
- [ ] Only the palette in §2. No pure black, no colour outside the table.
- [ ] No bold type anywhere. Serif headlines, sans sublines, nothing else.
- [ ] Real UI, real photographs, no invented social proof, no "AI" in any
      headline, no device bezels, no rotation, no panorama seams.
- [ ] Frames 1–3 each make sense with the other six deleted.

Deliver as `01-hook.png`, `02-ten.png`, `03-closet.png`, `04-stylist.png`,
`05-friends.png`, `06-plan.png`, `07-value.png`.

Once the founder approves the PNGs, they go to App Store Connect by way of
`docs/app-store/asc-screenshot-swap-directive.md` — that document is the
operator's; this one is yours.
