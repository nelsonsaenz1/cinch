# The Silhouette Library — design directives

**Commissioned by** `docs/design/reframe-directive.md` §5.C — the largest single piece
of design work in the reframe, and the blocking dependency for atlases A (`WK`) and B
(`PR`). `PR-01` is specified as *"silhouette at ~46% viewport height"*, so the
procession card has no geometry until these exist.

**Deliverable:** 22 garment shapes + 4 pattern overlays + 1 fallback, as individual
SVGs, plus one contact-sheet PNG. Detail in §10.

**What these are.** A garment created by voice has no photograph, and is drawn
instead — *"a silhouette in Cinch's own hand, filled with the garment's real colour"*
(`voice-intake-directive.md` §1). These are not icons and not illustrations. They are
the garment's **body** — the thing that carries its colour. The colour is the
information; the shape says which garment is wearing it.

**Read §1 before any shape.** It is the contract all 22 obey. §§2–8 are the shapes
themselves, and each is self-contained enough to hand over on its own.

---

## 1 · The contract — every shape obeys this

### 1.1 · Canvas

**`viewBox="0 0 96 96"`. Square. No exceptions.**

Square because these drop into the same wells as photographed cutouts, which are
square by `PLATE_CANVAS_SIZE` (`src/lib/bg-removal.ts`). A drawn garment and a
photographed one must be interchangeable in the closet grid without either being
letterboxed — that is the whole of state `C-08`, the mixed grid.

96 units because it divides cleanly by 2, 3, 4, 6, 8, 12 and 16, which is what you
want when a hem has to land on a third and a sleeve on a quarter.

### 1.2 · One fill path — and the line budget

**One `<path>` carrying the fill.** The garment's colour is applied to that path at
runtime; the SVG ships with a placeholder fill. Every silhouette feature that can live
in the outline **must** live in the outline: necklines are cut into the top edge,
open fronts are shaped into the perimeter, a hem's flare is the path widening.

**This is settled — draw to it.** §5.C says *"no internal shading or highlights."* Read
literally as "no internal marks at all", four of these shapes stop being
distinguishable — a button-down's placket, a jean's yoke, a sneaker's sole and a
clutch's flap are structural, not decorative. Ruled on 2026-08-10: **structure stays.**

**Shading and highlights are banned; structure is not.** Each shape gets an
**internal line budget of at most two** strokes, same 1px `rule` as the outline, and
only where §§2–8 explicitly spends it. Nine of the 22 spend nothing. A line that
suggests light, depth, volume or fabric drape is shading and is banned. A line that
says *this garment opens here* is structure and is allowed.

If a shape reads without its budgeted line, drop the line.

### 1.3 · The outline

**1px `rule` — `rgba(28,26,22,0.12)` — with `vector-effect="non-scaling-stroke"`.**

That attribute is not optional and it is the single most common way this goes wrong.
The same SVG renders at ~110pt in a closet tile and at ~400pt on a procession card. A
1-unit stroke in a 96-unit viewBox scaled to 400pt is a **4px slab**. `non-scaling-stroke`
holds it at a true hairline at every size, which is what makes one asset serve both
screens.

The outline is deliberately quiet — it is the same 12% ink as every structural rule in
the app. On a dark fill it will be nearly invisible and **that is correct**; the shape
is carried by the fill. Its whole job is to keep a cream garment from dissolving into
`surface`. That is the test the contact sheet in §10 exists to run.

### 1.4 · No shading

No gradients. No highlights. No drop shadows. No fabric texture. No folds, no drape
lines, no seam stitching. These are **drawings, not renders** — the moment one carries
a highlight, the whole grid reads as clip art, and the reason `C-07` works is that a
wall of flat drawn shapes looks like nothing else in the category.

### 1.5 · Proportion — do not size these by eye

The app already holds a considered opinion about relative garment presence, in
`PLATE_TARGET_FILL` (`src/lib/bg-removal.ts:126`). The silhouettes must honour it or a
drawn closet and a photographed closet will disagree about scale, and `C-08` — the
mixed grid — will look broken.

Each shape occupies this fraction of the canvas along its **longest** dimension:

| Slot | Fill | Shapes |
|---|---|---|
| outerwear | **0.92** | coat, jacket |
| dress | **0.92** | midi, mini, maxi |
| top / mid layer | **0.85** | tee, crewneck, button-down, blouse, cardigan, jumper |
| bottom | **0.85** | trouser, jean, skirt, short |
| footwear | **0.60** | flat, heel, boot, sneaker |
| bag | **0.55** | tote, clutch, crossbody |

So a coat spans ~88 of 96 units; a clutch spans ~53. **Outerwear and dresses dominate,
tops and bottoms are the middle register, shoes and bags are punctuation.** Nudge these
together and the relationships break — a bag as large as a coat is the failure mode.

Centre every shape optically, not mathematically. A trouser's mass is high, a coat's is
even, a heel's is low; the eye wants them balanced in the square, not their bounding
boxes.

### 1.6 · The hand

The reference is the app's own coat-hanger mark — `HangerGlyph` in
`src/features/explore/glyphs.tsx`, drawn on a 22-unit grid with a 1.4 stroke and round
caps — and the hanger app-icon studies in `docs/design/today-atlas/icons/`. These
silhouettes are filled where the hanger is stroked, but they are the same hand:

- **Flat lay, straight on.** The garment is lying on a surface, seen from directly
  above. No body, no mannequin, no hanger, no perspective, no three-quarter view.
- **Sleeves fall away from the body at 35–45°.** Not 90°. A tee with horizontal
  sleeves is a cross, not a garment.
- **Curves win.** No straight edge runs longer than about a third of the shape.
  Shoulders, side seams and hems all carry a slight bow.
- **Corners are round**, ~1.5–2 units, echoing the glyph set's round caps. Nothing in
  this library terminates in a sharp point except a lapel notch and a pointed toe.
- **Structurally symmetric, not mechanically symmetric.** Build the shape symmetric,
  then relax one side by 1–2%. A mirror-perfect half reads as clip art; the register
  the voice directive asks for is *"drawn, worn-in"*.

### 1.7 · The governing constraint: the two-size test

**Every shape must be identifiable at 110pt and reward attention at 400pt.** This is
the constraint that kills more of these than any other, and it should drive every
decision you make.

At 110pt — a closet tile in `C-07` — a shape is roughly 40 screen pixels of garment.
Sleeve length, hem length, and the presence or absence of a leg split survive at that
size. A collar notch, a cuff, and a placket **do not**. So each shape must be separable
from its siblings by at least one feature that survives 110pt, and §§2–8 name that
feature explicitly for every one of the 22 as **Separated by**.

Test method: render the full sheet at 110pt, look away, look back, and name each shape.
Anything you hesitate on has failed and needs its distinguishing feature exaggerated —
not its detail increased.

### 1.8 · Naming

Files are `<slot>-<shape>.svg`, using the **code's** slot vocabulary from
`src/lib/styling/types.ts`, because `silhouettes.tsx` will key off the `Slot` type:

```
base_top-tee.svg      bottom-trouser.svg    footwear-flat.svg
base_top-crewneck.svg bottom-jean.svg       footwear-heel.svg
base_top-button.svg   bottom-skirt.svg      footwear-boot.svg
base_top-blouse.svg   bottom-short.svg      footwear-sneaker.svg
mid_layer-cardigan.svg  dress-mini.svg      outerwear-coat.svg
mid_layer-jumper.svg    dress-midi.svg      outerwear-jacket.svg
bag-tote.svg            dress-maxi.svg      fallback-hanger.svg
bag-clutch.svg
bag-crossbody.svg
```

Note `base_top` and `footwear` — **not** `top` and `shoes`. §11.1 explains.

---

## 2 · Base tops — four shapes

The hardest group. Four garments that are all "a rectangle with two sleeves", separated
almost entirely by sleeve length and neckline. Exaggerate both.

### `base_top-tee`
- **Reads as** the plainest shirt in the drawer. This is the library's baseline — draw
  it first and calibrate the other three against it.
- **Outline** — straight-ish body with a slight taper in at the waist and back out at
  the hem. Short sleeves ending at about a third of the way down the body, cut square
  at the cuff. Shallow round neck, cut ~5 units deep into the top edge.
- **Separated by** short sleeves. It is the only base top with them.
- **Lines** — none.
- **Do not draw** a pocket, a graphic, or a ribbed collar band.

### `base_top-crewneck`
- **Reads as** a sweatshirt or a knit — heavier than the tee, worn alone.
- **Outline** — noticeably **boxier and wider** than the tee, with more air in the body.
  Long sleeves that narrow toward the wrist and then flare very slightly at the cuff,
  which is how a rib reads in silhouette. Same slight flare at the hem. High, small
  round neck, cut only ~3 units deep — shallower than the tee's.
- **Separated by** long sleeves + a wider body. Against the button-down, by having no
  collar and no straight front edge.
- **Lines** — none.
- **Do not draw** a rib as hatching. The flare is the rib.

### `base_top-button`
- **Reads as** a shirt you would tuck in.
- **Outline** — the crispest shape in the group: straighter sides, less taper, a flatter
  hem. Long sleeves, narrower than the crewneck's, ending in a squared cuff. The
  neckline is the tell — **two small angled collar points** notched into the top edge,
  falling away from the centre. These are the one permitted sharp point in the library.
- **Separated by** the collar points at large size; at 110pt, by being the narrowest and
  straightest long-sleeved top.
- **Lines** — spends **one**: a single vertical placket line on the centre front, running
  from the collar notch to the hem. This is what rescues it at mid sizes.
- **Do not draw** buttons. Not even small ones. The placket implies them, and a row of
  dots reads as a pattern at tile size.

### `base_top-blouse`
- **Reads as** the softest thing in the drawer — fluid, not structured.
- **Outline** — no straight lines anywhere. Sleeves are **full**: they widen through the
  upper arm and gather to a narrow wrist, the only sleeve in the library with a curve on
  both edges. Body flares gently from bust to hem in a soft A. Neckline is a **V**, cut
  ~8 units deep — the deepest in the library.
- **Separated by** the V-neck and the full sleeve. At 110pt the V and the A-line silhouette
  both survive; that is deliberate redundancy.
- **Lines** — none.
- **Do not draw** a tie neck, a ruffle, or a gathered shoulder.

---

## 3 · Mid layers — two shapes

Separated by exactly one thing: **open front versus closed**. Make that unmissable.

### `mid_layer-cardigan`
- **Reads as** a knit worn open over something else.
- **Outline** — this is where the single-fill-path rule earns its keep. The front is open,
  so the perimeter travels **down the left front edge, across the hem, and back up the
  right front edge**, leaving a gap of ~6 units between the two front edges through the
  full body height. The gap is part of the outline, not a cut-out. Long sleeves, gentle
  flare at cuff and hem. Neckline is a wide shallow scoop between the two front edges.
- **Separated by** the open front. Nothing else in the library has a vertical gap.
- **Lines** — none. The gap does all the work.
- **Do not draw** buttons down the front edges, and do not close the hem across the gap.

### `mid_layer-jumper`
- **Reads as** a pullover — the cardigan's closed twin.
- **Outline** — deliberately close to `base_top-crewneck` but **more relaxed**: wider
  through the body, sleeves a touch longer and softer, hem flare a touch stronger. Round
  neck, small and high.
- **Separated by** its closed front (against the cardigan) and by being visibly slouchier
  (against the crewneck). These two are the closest pair in the library — if they cannot
  be told apart at 400pt, widen the jumper further rather than adding detail.
- **Lines** — none.
- **Do not draw** a cable knit, a fair-isle band, or any texture.

---

## 4 · Bottoms — four shapes

### `bottom-trouser`
- **Reads as** tailored, pressed.
- **Outline** — full length. A flat waistband edge across the top, hips easing out then in,
  and two legs separated by a **narrow inverted-V rise** cut up from the hem to about a
  third of the height. Legs taper gently and break slightly at the ankle. Crisp.
- **Separated by** full length + leg split + a clean taper.
- **Lines** — none.
- **Do not draw** a crease down each leg. That is drape, and drape is shading.

### `bottom-jean`
- **Reads as** heavier, more casual than the trouser.
- **Outline** — full length, but **straighter and narrower** through the leg than the
  trouser, with no ankle break and a visibly thicker turned hem at each cuff. The rise
  cut is slightly shorter. Overall a touch stiffer and blockier.
- **Separated by** — honestly, at 110pt this and the trouser converge, and that is
  acceptable: both read as "long trousers", which is the information the closet grid
  needs. At card size, the cuff and the straight leg separate them.
- **Lines** — spends **one**: the curved yoke line across the back rise, a shallow arc
  about 12 units below the waistband. This is the jean's signature and the only thing
  that makes the pair legible at mid size.
- **Do not draw** five pockets, rivets, or topstitching.

### `bottom-skirt`
- **Reads as** an A-line skirt, knee length.
- **Outline** — a single mass. Flat waistband edge, sides falling away in a widening
  curve, hem the widest edge of the shape and gently bowed. **No leg split** — that is
  the whole point.
- **Separated by** the absence of a rise cut. Survives at any size.
- **Lines** — none.
- **Do not draw** pleats. A pleated hem reads as a comb at tile size.

### `bottom-short`
- **Reads as** cropped, mid-thigh.
- **Outline** — the trouser's top half. Same waistband and hip easing, cut off at about
  45% of the trouser's length, with **wide leg openings** relative to that length. The
  rise cut is proportionally deeper, so the two legs read clearly despite the crop.
- **Separated by** length. The only short bottom with a split.
- **Lines** — none.
- **Do not draw** a cuff roll.

---

## 5 · Dresses — three shapes

**These three must read as a family.** They differ along one axis — hem length — and
should share an identical bodice, neckline and shoulder. Draw the midi first, then
lengthen and shorten it. Any other difference between them is a mistake.

Shared: soft scoop neck, narrow shoulder straps into a fitted bodice, waist easing, skirt
falling from the waist. No leg split, ever.

### `dress-mini`
- **Hem** high — the shape occupies ~62% of the canvas height, the rest is air.
- **Skirt** the fullest of the three, flaring hard from the waist, hem noticeably wider
  than the shoulders.
- **Separated by** being short and flared.

### `dress-midi`
- **Hem** at ~0.92 fill — the family's reference.
- **Skirt** a moderate A, hem about level with the shoulder width.
- **Separated by** sitting between the other two. It is the one that most needs its
  siblings present to read, which is why it is drawn first.

### `dress-maxi`
- **Hem** also ~0.92 fill — it cannot be longer than the canvas, so **length is expressed
  as narrowness**: a long column, hem barely wider than the waist, falling straight.
- **Separated by** its narrow column. Where the mini is short and wide, the maxi is long
  and narrow, and the midi splits the difference. That contrast is what makes three
  same-height shapes legible.
- **Do not draw** a train, a slit, or a hem that touches the canvas edge.

---

## 6 · Outerwear — two shapes

Separated by **length only**. Identical lapel, sleeve and shoulder language — they are
the same coat, cut at two lengths. Both are the largest shapes in the library at 0.92.

Shared: a **notched lapel** cut into each side of the neckline, falling open in a shallow
V to about a quarter of the body height; set-in sleeves, straight and slightly wide;
squared shoulders — the only squared shoulders in the library.

### `outerwear-coat`
- **Reads as** a long wool coat.
- **Outline** — full 0.92, hem at mid-calf, body straight or barely A. Substantial.
- **Separated by** length.
- **Lines** — spends **one**: the centre-front closing edge, a vertical from the base of
  the lapel V to the hem. Structure, not decoration — it says the coat opens.
- **Do not draw** buttons, a belt, or pocket flaps.

### `outerwear-jacket`
- **Reads as** the same coat cropped at the hip.
- **Outline** — ~60% of the coat's body length, hem straight and flat, body slightly boxier
  to compensate for the crop.
- **Separated by** length, and by the sleeve reaching nearly to the hem — in a jacket the
  cuff and hem almost meet, which is a strong silhouette cue the coat does not have.
- **Lines** — spends **one**: the same centre-front closing edge.

---

## 7 · Footwear — four shapes

**All four in profile, side on, toe pointing left.** Consistent direction is not optional
— a grid of shoes facing different ways reads as a mistake. Smallest garments at 0.60,
so they need the boldest silhouettes.

### `footwear-flat`
- **Outline** — low and long. Thin sole barely thicker than the outline itself, gently
  rounded toe, and a **scooped topline** dipping low over the instep. Sits flat: the
  sole's bottom edge is a near-straight line.
- **Separated by** a flat sole and a low vamp.
- **Do not draw** a bow, a buckle, or a sole seam.

### `footwear-heel`
- **Outline** — a **pointed toe** at the left, an arched sole lifting from the ball of the
  foot, and a heel dropping vertically from the back. The arch — the empty space under the
  instep — is the whole shape and must be unmistakable at 110pt, so make it generous.
  Heel height roughly a third of the total.
- **Separated by** the arch and the point. The most distinctive footwear shape; keep it so.
- **Do not draw** an ankle strap.

### `footwear-boot`
- **Outline** — the flat's foot with a **shaft rising above the ankle** to about 55% of the
  shape's height, and a visibly thicker sole slab. Blocky, squared toe, low stacked heel.
- **Separated by** vertical mass. The only footwear taller than it is long.

### `footwear-sneaker`
- **Outline** — bulkiest foot. A **thick slab sole** running the full length, a high rounded
  toe box, and a raised collar at the ankle behind a dipped topline. Everything rounded.
- **Separated by** the sole slab and the high toe box.
- **Lines** — spends **one**: the horizontal line where the sole meets the upper, running
  the length of the shoe. Structural, and it is what makes a sneaker a sneaker.
- **Do not draw** laces, eyelets, a swoosh, or a toe cap.

---

## 8 · Bags — three shapes

Separated by **handle geometry**, which is the one feature that survives at 0.55.

### `bag-tote`
- **Outline** — an upright body, taller than wide, sides tapering slightly inward toward
  the base, flat bottom. **Two arc handles** rising from the top edge, each a slim closed
  loop, meeting the body at four points.
- **Separated by** two handles.
- **Do not draw** a shoulder strap as well.

### `bag-clutch`
- **Outline** — a wide flat body, **wider than it is tall**, softly rounded corners. No
  handle of any kind.
- **Separated by** being the only handleless bag and the only wide one.
- **Lines** — spends **one**: the flap edge, a shallow arc across the upper third.
- **Do not draw** a clasp.

### `bag-crossbody`
- **Outline** — a small compact body, roughly square with a rounded base, and **one long
  thin strap** rising from the top corners in a tall, narrow loop — reaching well above
  the body, taller than the body itself.
- **Separated by** the single tall strap loop.
- **Do not draw** a buckle or strap adjusters.

---

## 9 · Pattern overlays — four tiles

Composited over the fill, **clipped to the fill path**, never overhanging the outline.

### The rules that keep the palette locked

- **Monochrome ink only** — `#1C1A16` at low alpha. Never coloured. A coloured overlay
  would put a second hue on the garment that never came from the lexicon, breaking
  §4.7 (no new colour tokens) and §4.9 (the model never invents colour).
- **Alpha 0.10–0.14.** The pattern darkens the fill; it does not sit on top of it. If you
  can read the pattern before you read the colour, it is too strong.
- **Flat, single-alpha.** No second tone, no outline on the motif. §11 of the voice
  directive bans *"any pattern richer than a flat overlay"*.
- **Seamlessly tileable** on all four edges.

### Scale

The app infers a `PatternScale` per garment — `micro | small | medium | large`
(`src/lib/styling/garment.ts:79`). **Draw each tile once, at medium**, and specify a base
tile edge of **12 units**; the renderer scales it to 6 / 9 / 12 / 20 units for micro /
small / medium / large. Do not draw four versions.

### The four

- **`pattern-stripe`** — even horizontal bars, bar and gap equal, running the full tile
  width. Horizontal, because these read across a garment's body; a vertical stripe on a
  trouser leg disappears into the leg.
- **`pattern-check`** — the stripe tile crossed with itself vertically. Where the bars
  intersect the alpha compounds naturally; do not hand-darken the intersections.
- **`pattern-dot`** — evenly spaced filled circles, ~2 units across, in **offset rows** so
  no straight line of dots appears in any direction.
- **`pattern-floral`** — three or four small simple motifs, scattered at varied rotation,
  irregularly spaced. A motif is a five-petal blob, ~4 units across, no stem, no centre,
  no outline. The one tile that must not look mechanical — irregularity is the point.

---

## 10 · Deliverables

### 10.1 · The SVGs

23 files, named per §1.8 — 22 shapes plus `fallback-hanger.svg` (§11.2). Each:

- `viewBox="0 0 96 96"`, no `width`/`height` attributes
- one fill path, `fill="currentColor"`
- outline `stroke="rgba(28,26,22,0.12)"`, `stroke-width="1"`,
  `vector-effect="non-scaling-stroke"`
- any budgeted internal line as a separate `<path>` with the same stroke and no fill
- no `<g>` wrappers, no transforms, no ids, no inline `<style>`, no comments

Plus 4 pattern tiles as separate SVGs, `viewBox="0 0 12 12"`, tileable.

### 10.2 · The contact sheet

One PNG, all 23 shapes, **each drawn at three fills**, on `surface`.

Use real lexicon colours from `src/lib/color/families.ts` — **`cream`** (light),
**`slate`** (mid), **`midnight`** (dark). Their purpose is to answer the question §5.C
commissions the sheet for: *can the outline still be judged against real colours?*

- On **cream**, the 12% outline is the only thing separating garment from ground. If the
  shape dissolves, the outline needs revisiting and that is a finding worth having early.
- On **midnight**, the outline should all but vanish and the shape should still read. If
  it collapses into a blob, the silhouette is relying on its outline instead of its form.

### 10.3 · The size proof

A second sheet — all 23 at **110pt**, on `surface`, unlabelled. This is §1.7's test made
into an artifact, and it is the one that decides whether the library ships.

---

## 11 · Reconciliations

Two are resolved and need no further input — they are recorded because the drawings
depart from §5.C as written, and the reframe directive asks for deviations to be
written down. **§11.2 is the one open question**, and it is a yes/no.

### 11.1 · Slot names — the code disagrees with the directive

§5.C names slots `top` and `shoes`. The app's `Slot` type
(`src/lib/styling/types.ts:11`) has **`base_top`** and **`footwear`**, and separates
`base_top` from `mid_layer` — which the directive also does, one line later, by listing
both. `silhouettes.tsx` is specified as *"SVG by slot"*, so it will key off `Slot`.

**Resolved to the code**, per the reframe directive's own rule that a claim about what
the app does wins: filenames use `base_top-` and `footwear-`. Nothing about the drawings
changes; this is naming only.

### 11.2 · Two slots have no shape, and one spoken word reaches them

`Slot` has nine members. §5.C commissions shapes for seven and omits **`headwear`** and
**`accessory`** — both of which are live in the styling engine and both of which have
entries in `PLATE_TARGET_FILL`.

*"My black beanie"* parses cleanly to `headwear`. *"My brown leather belt"* parses to
`accessory`. Today both would reach the procession card with **nothing to draw** — a
blank where the garment's body should be, on the one screen whose whole job is showing
the user what was heard.

**Recommendation, and it is cheap:** commission a 23rd shape, `fallback-hanger.svg` — the
app's own coat-hanger mark, already the garment mark in the tab bar and the empty states,
redrawn as a filled silhouette to this contract. It serves `headwear`, `accessory`, and
any future slot, and it is the one fallback that cannot look like an error, because it is
already the app's word for *garment*. Draw at 0.55 fill.

This does not conflict with §4.3 — *a garment with no image is a complete garment*. The
hanger is an image. It is simply the general one.

### 11.3 · The internal line budget — RESOLVED 2026-08-10

§1.2 reads §5.C's *"no internal shading or highlights"* as banning shading while
permitting structure. **Confirmed: keep the internal lines.**

The budget is spent on six of 22 shapes — the button-down's placket, the jean's yoke,
the sneaker's sole, the clutch's flap, and the centre-front closing edge on both
outerwear shapes. Sixteen shapes spend nothing, and no shape spends more than one.

The line stays a hairline `rule` stroke at the same weight as the outline, and the test
in §1.2 still binds: **if a shape reads without its budgeted line, drop the line.** The
budget is a ceiling, not a quota. Anything that suggests light, depth, volume or drape
remains shading and remains banned.
