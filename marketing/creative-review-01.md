# Creative review — Marketing Material 01
**48 assets received 10 Aug 2026 · reviewed same day**

---

## Verdict

This is genuinely good work, and better than most of what's in this category. The
craft is consistent, the type system holds across 48 assets, and the colours are the
real tokens — Canvas `#FBFAF6`, Ink `#1C1A16`, Oxblood `#6E2B2B`, Tan, Sand, Tray,
Muted — not approximations. The content bank maps cleanly onto the six formats and
the pins map onto the ASO board targets. Nothing here needs to be rebuilt.

**Ship variant 1c for the App Store.** Reasoning below.

**But four things must be fixed before anything is published**, one of which is a
factual claim that is currently wrong in a way that matters. They're small edits, not
redesigns.

---

## 1 · App Store: ship 1c

I tested all three at simulated search-result thumbnail size, which is how most people
will ever see them.

| Variant | Caption | Device | Verdict |
|---|---|---|---|
| **1a** — ink and paper | Top, small | Small | Caption legible, but the device UI is unreadable at thumbnail and the alternating black/cream reads as a checkerboard in the gallery |
| **1b** — paper throughout | **Bottom** | Largest | Best device legibility, but the caption sits at the bottom — the eye reads top-down, so the value proposition arrives *last*, and bottom text is the first thing lost to any crop |
| **1c** — numbered plates | **Top, largest** | Large, bleeding off the bottom edge | ✅ **Ship this.** Caption is the most legible of the three, the device is nearly as large as 1b, and the bleed makes the phone feel big without shrinking the type. The `01/02/03` numbering gives the carousel a sequence. |

### One fix to 1c, frame 1

At thumbnail size, frame 1 has a large field of dead black between the caption and the
number. At full size it reads as confident negative space; at search-result size it
reads as empty. **Make the `14` roughly twice its current size.** It is the single most
important element in the entire listing — it's your differentiator, it's the thing no
competitor can show, and right now it's the smallest thing on the frame.

Keep frame 1 black. In a search result full of pastel closet grids, a black plate with
a serif numeral is the only thing that stops a scroll.

### Two gaps in the set

- **There is no packing frame**, and the recommended subtitle is `Capsule Wardrobe,
  Packing List`. Claiming a term in the subtitle with nothing in the gallery that shows
  it is a conversion leak. Either add a packing frame at position 5, or build it as the
  packing Custom Product Page.
- **Frames 2 and 4 are both the occasion feature**, split by weather at position 3. The
  narrative breaks and rejoins. Since frames 1–3 are what most people ever see, move
  the vote to position 3 and weather to 4 — so the occasion story lands complete inside
  the visible window.

---

## 2 · ⚠️ The stat is wrong. Fix before publishing.

This appears on at least four assets — the X stat card, the IG carousel, pin 04, and
hook 02:

> "The average closet holds 214 items. Most people wear 31 of them."

Two problems:

- **214 is unsourced.** I couldn't find it anywhere. Published wardrobe surveys
  generally land near 100–120 items.
- **31 appears to be real, and is being used backwards.** The widely-reported figure is
  that the average wardrobe contains **31 items that are never worn** — not 31 items
  that *are* worn ([ITV News, Oct 2022](https://www.itv.com/news/2022-10-07/average-wardrobe-has-31-items-of-unworn-clothing-study-says)).

So the card states an unsourced number and inverts a sourced one. As a claim about the
world on a public asset, that's a substantiation problem, and it's the kind of thing a
journalist or a competitor notices.

**The fix is easy and produces better content.** Drop the average entirely and make it
first-person and true:

> "I photographed 214 items. I wear 31."

Which is exactly what hook 02 already says. That version is fine **provided 214 and 31
come from a real closet** — yours or a pilot user's. Specific personal numbers
outperform population averages in this format anyway; the hook research is unambiguous
that the Specific Number archetype works because it's *someone's*, not *everyone's*.

**Action:** rewrite the X stat card and the carousel to first-person. Delete "the
average closet holds" from every asset. If you want a population stat later, the ITV
figure is usable if quoted accurately and attributed.

---

## 3 · ⚠️ Hook 06 shows a feature that doesn't exist

> **THE DEMO** — "Four minutes of talking. *A whole wardrobe.*"

That's voice intake. It ships in **October**, not September. Publishing it now
advertises functionality the binary doesn't have — the exact Guideline 2.3.1 exposure
flagged in the reframe directive, and plainly false advertising outside the App Store
too.

**Do not delete it — quarantine it.** Move to `04-social/_m2-hold/`. It's a strong
asset and it's the lead hook for the October wave. It just can't run for another seven
weeks.

Everything else in the 48 is correctly M1. That's good discipline and I want to note it.

---

## 4 · ⚠️ Two competitor claims are too broad to defend

> "Every closet app wants you to shop. **This one doesn't.**" *(hook 05)*
> "Every other closet app: Here's what to buy next. Cinch: Here's what you already have." *(X 04)*

The sentiment is right and it's your sharpest differentiator against Alta, whose
revenue is affiliate commission on clothes it recommends. But **"every"** is a
universal claim and it's false: Stylebook is a $4.99 one-time purchase with no shopping
surface, and Whering leads on sustainability rather than acquisition. The standing rule
is no competitor claim without a dated screenshot on file, and "every" can't be
screenshotted.

**The fix makes it stronger, not weaker — make it a claim about Cinch only:**

> "Cinch has no store. It cannot sell you anything."

That's unfalsifiable, it's true, it's a sharper sentence, and it implies the comparison
without making it. Same for the X card:

> "Other apps: here's what to buy next.
> Cinch: here's what you already have."

Dropping "every other" is the whole edit.

---

## 5 · Numbers to verify before publishing

Not errors — just things that must come from the real engine rather than being written
to look plausible.

- **`countOutfits()` check.** "14 outfits from ten pieces" is correct: 3 tops × 2
  bottoms × 2 shoes + 1 dress × 2 shoes = 14, from 3T/2B/1D/2S plus an uncounted coat
  and bag. ✅ Verified against the free-tier contract.
- **Pin 02: "Nine pieces. Fifteen outfits."** Reproducible — 3T/1B/2D/3S gives
  3×1×3 + 2×3 = 15 from nine pieces. ✅ But confirm it's what the app actually returns
  for that wardrobe, not a number chosen to sound good.
- **Cost-per-wear figures** — `$4.20`, `$11.20`, and the five weekday values on the
  work pin. These must be real computed outputs. A cost-per-wear number that can't be
  reproduced in the app is the kind of detail that gets screenshotted back at you.

---

## 6 · What's still outstanding

The handover correctly scopes itself to Tiers 1, 2 and 4. Still needed:

- **Tier 0 — the nine master screen recordings.** This is the blocking item. Without
  them there is no TikTok, no Reels, no Shorts, and no App Preview video — which is
  most of the plan. One two-hour session on a real device with a real closet.
- Tier 3 — App Preview videos (3), Custom Product Pages (packing / capsule / wedding
  guest), In-App Event cards (4)
- Tier 5 — web hero, OG images ×4, referrer-named invite page
- Tier 6 — email header and four templates
- Tier 7 — press kit for the Apple featuring nomination
- The three share cards (Reveal / cost-per-wear / vote request)

---

## Fix list, in order

1. **Rewrite the 214/31 stat to first-person** on the X card and IG carousel; delete
   "the average closet holds" everywhere. *Blocking.*
2. **Quarantine hook 06** to `_m2-hold/`. *Blocking.*
3. **Drop "every" from both competitor claims.** *Blocking.*
4. Enlarge the `14` on 1c frame 1 to ~2× current size.
5. Reorder App Store frames: number → occasion → vote → weather → closet. Add packing.
6. Confirm all cost-per-wear and outfit-count figures are real engine outputs.
7. Book the master-capture session.

One through three are edits to four files. Four and five are a re-export. None of this
is a redesign — the work is sound, and I'd rather flag four real problems precisely
than give general notes on 48 assets that are mostly right.
