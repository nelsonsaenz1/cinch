# Creative copy fixes — handover 01
**Four files. Line-level replacements. Nothing else in the 48 changes.**

---

## 1 · `2d-x-01-the-stat-1600x900.png`

**Remove:**
> The average closet holds 214 items. Most people wear 31 of them.

**Replace with:**
> I photographed 214 items.
> I wear 31 of them.

**Why.** 214 is unsourced — published wardrobe surveys land near 100–120. And 31 is a
real figure being used backwards: the widely reported stat is 31 items that are *never
worn*, not 31 that are. As written the card states an unsourced number and inverts a
sourced one.

First-person fixes both, and it's better content — the Specific Number hook archetype
works precisely because the number is *someone's*, not everyone's. **Only ship it if 214
and 31 come from a real closet.** If they don't, use whatever the real numbers are; a
true 118/24 outperforms an invented 214/31.

---

## 2 · `2c-ig-carousel-01` and `-02`

**Slide 1 currently:** "You own *214 things.*"
**Slide 2 currently:** "You wore *31 of them.*"

Keep both — they're already first-person in framing. **Add the attribution line** in
`muted` 13px at the bottom of slide 1 so it reads as one person's closet rather than a
population claim:

> *one real closet, photographed in March*

Substitute the true month. That single line is the difference between an anecdote and an
unsourced statistic.

---

## 3 · `2a-hook-05-the-comparison-1080x1920.png`

**Remove:**
> Every closet app wants you to shop. *This one doesn't.*

**Replace with:**
> Cinch has no store.
> *It cannot sell you anything.*

**Why.** "Every" is a universal claim and it's false — Stylebook is a $4.99 one-time
purchase with no shopping surface, and Whering leads on sustainability rather than
acquisition. The standing rule is no competitor claim without a dated screenshot, and
"every" can't be screenshotted.

The replacement is unfalsifiable, true, and a harder sentence. It implies the comparison
against Alta — whose revenue is affiliate commission on clothes it recommends — without
making a claim anyone can dispute.

---

## 4 · `2d-x-04-the-comparison-1600x900.png`

**Currently:**
> Every other closet app: Here's what to buy next.
> Cinch: Here's what you already have.

**Replace with:**
> Other apps: here's what to buy next.
> Cinch: here's what you already have.

Dropping "every other" is the entire edit. The structure is good and the rhythm
survives.

---

## 5 · `2a-hook-06-the-demo-1080x1920.png` — status change

> "Four minutes of talking. *A whole wardrobe.*"

**Previously flagged for quarantine. That is now reversed.** Voice ships in 1.0, so this
asset is live from launch — and it becomes the **lead hook**, not one of eight.

No copy change. Move it to the front of the rotation.

---

## Not changing

Everything else in the 48 is accurate against the shipping build. The outfit-count
arithmetic checks out (`3 tops × 2 bottoms × 2 shoes + 1 dress × 2 shoes = 14` from ten
pieces; pin 02's nine-pieces-fifteen-outfits is reproducible at `3T/1B/2D/3S`).

The cost-per-wear figures — `$4.20`, `$11.20`, and the five weekday values on the work
pin — still need one check: they must be real computed outputs from the engine, not
numbers written to look plausible. A cost-per-wear figure that can't be reproduced in
the app is exactly the detail that gets screenshotted back at you.
