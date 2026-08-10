# App Store screenshots v2 — directive for the design agent

Supersedes the v1 set now live in App Store Connect. Same visual system, same
render pipeline, same 1290 × 2796 output. What changes is **which five stories
we tell, in what order, and how big the type is.**

Read `docs/app-store/screenshots/src/base.css` first — every token below already
exists there. This is not a redesign. It is a re-ordering, three new frames, and
one measurable typographic fix.

---

## 1. What the research actually says

Three findings drove every decision here. Two of them cut against intuition.

### 1.1 Frame 1 is not the first of five. It is, for most people, the only one.

- **91% of App Store visitors never scroll portrait screenshots at all**; 96%
  never tap to enlarge. Average time on a product page: **6.8 seconds.**
  (AppAgent, ~3M store visits across 3 A/B platforms.)
- Of those who do engage, only **11% reach the fifth image** (SplitMetrics,
  1,800 A/B tests).
- Search results render **three portrait frames** before anyone taps anything.

**Consequence: frames 1–3 must each stand alone and be readable at thumbnail
size. Do not build a narrative that only pays off at frame 4.** The v1 set was
sequenced as an argument; that argument is invisible to ~9 in 10 visitors.

### 1.2 Do not put the word "AI" in a headline.

This is the finding that contradicts the brief, so here is the evidence rather
than an assertion:

- **Cicek, Gursoy & Lu (2024)**, *Journal of Hospitality Marketing &
  Management*, 1,000+ US adults across **eight product categories**: identical
  descriptions differing only by whether "artificial intelligence" was
  mentioned. Mentioning AI **lowered purchase intention in all eight**, via
  reduced emotional trust.
- **Frontiers in Psychology (2026)**: the penalty is severe for
  **symbolic/identity products** (η²ₚ = 0.105) and **statistically absent for
  purely functional ones**. A wardrobe app is squarely identity-adjacent.
- **Gartner (Oct 2025, n=1,539)**: 50% of consumers prefer brands that avoid
  GenAI in consumer-facing content; 68% frequently wonder whether what they're
  seeing is real.
- **Adapty** (Lifestyle benchmarks): AI-branded Lifestyle apps convert
  install-to-trial at **5.31% vs 10.92%** category average — but show **14%
  higher direct-purchase rate** and higher LTV. AI branding repels browsers and
  attracts high-intent buyers.

Two further reasons specific to us:

1. **The app name already carries the signal.** The listing reads *Cinch: AI
   Closet & Stylist*. Every search result already says AI before a single
   screenshot loads. Spending headline pixels on it is redundant.
2. **It is not differentiating.** Acloset, Alta, Pureple and Style DNA all have
   AI in the app name. Saying "AI" louder puts us in a queue.

**So we stay aggressively AI-forward in what we SHOW and disciplined about what
we SAY.** Frames 2 and 3 are pure machine-intelligence demonstrations — instant
recognition, instant tagging, reasoned outfit selection. The word appears once,
in frame 3's subline, as mechanism and credibility. Never as a promise.

### 1.3 Social is unclaimed positioning, not just an unclaimed feature.

Across the ten competitors surveyed (Whering, Acloset, Indyx, Alta, Stylebook,
Cladwell, Save Your Wardrobe, Pureple, Smart Closet, Style DNA):

- **Zero mention social in the subtitle. Zero show social in frames 1–5.**
- Four show it at all — Whering (#6 of 10), Indyx (#6–7 of 10), Acloset
  (#9 of 9), Pureple (#7 of 7). Always in the back half, past where people scroll.
- Three of those four are **public feeds of strangers** — Pinterest with
  clothes. Only Indyx does directed, named-person styling, and it buries it.
- **Alta — the momentum leader, 4.9★ / 12K ratings — has no social in its
  gallery at all.**
- Peer borrowing is essentially unshipped: the only live examples have 8 ratings
  and zero ratings respectively.

Meanwhile **eight of ten lead frame 1 with the same shot**: a closet grid or an
outfit canvas. A social frame 1 will not look like anything else on the results
page. That is the whole game at thumbnail scale.

### 1.4 The upload objection is the category's open wound.

Every qualitative review names upload tedium as the top reason people abandon
these apps — "3 days adding my whole closet," 2–3 hour onboarding estimates,
"time-consuming one-by-one." Yet **only 5 of 10 show the upload flow at all,
never in slot 1, and not one of them puts a number on it.**

Claiming a specific, credible time is unoccupied ground and it directly answers
the objection that kills installs.

### 1.5 The other universal complaint: the suggestions are nonsense.

Verbatim from competitor review pages: outfits are "really random"; a turtleneck
recommended with a sweater dress; all-black for 97°F; "all ten will be the exact
same thing." This hits **every** AI-forward app in the category.

Cinch's honesty frame is not a charming quirk. It is a direct strike at the
single most consistent failure in the category, and we can make the claim
because the engine is deterministic and grounded in real garments.

---

## 2. The set

Five frames. (78% of top-100 apps ship exactly five — Incipia.) A sixth is
specified as optional at the end.

| # | Working name | Job | Ground |
|---|---|---|---|
| 1 | **The table** | Differentiate instantly. Nothing else on the page looks like this. | paper |
| 2 | **The upload** | Kill the "this will take hours" objection with a number. | paper |
| 3 | **The morning** | Prove the intelligence by showing its output and its reasons. | paper |
| 4 | **The no** | Trust. Position against the category's worst failure. | ink |
| 5 | **The ledger** | Value and retention — the reason to keep it. | paper |

Order rationale: frames 1–3 are the three visible in search results and they
cover, in order, the three things the brief asked to emphasize — collaborative,
effortless capture, AI-forward. Frames 4–5 reward the 11% who scroll.

**Dropped from v1:** the Plan/week frame. Packing and weekly planning appear in
6 of 10 competitor galleries — it is pure feature parity and it was spending our
scarcest slot on our least distinctive claim.

---

## 3. Global specification

Unchanged from v1 unless noted. All values already in `base.css`.

**Canvas** — 1290 × 2796, PNG, RGB, **no alpha**. Never crop, resize or
re-encode after render.

**Palette** — `--canvas #FBFAF6` · `--surface #FFFFFF` · `--tray #F0ECE3` ·
`--sand #EAE5DB` · `--ink #1C1A16` · `--muted #6B665C` · `--faint #8A8578` ·
`--accent #6E2B2B` (oxblood) · `--accent-light #F1E7E4` ·
`--accent-warm #B08A76` · `--blush #F7EDE8` · `--paper #E7E3D9` (marketing
ground).

**Type** — display is **Instrument Serif** 400, regular and italic. UI is the
system grotesque. This matches what the app actually ships
(`@expo-google-fonts/instrument-serif`). Note: `.impeccable.md` still names
Bodoni Moda + Archivo; that document is stale on this point — follow the
shipped fonts and `base.css`.

### 3.1 The one real change: headline size

v1 set headlines at **104px = 3.72% of frame height**. Apple's own Vision
framework needs text at **≥5% of image height** to read reliably — **140px on a
2796-tall frame** — and that is also a fair proxy for human legibility at
search-thumbnail scale.

**New rule: headline 140px minimum. 150px preferred. Never below 140px.**

Consequences the design agent must handle:

- **Maximum 5 words per headline. Maximum 2 lines.** At 140px in the 1080px
  measure you get roughly 15 characters per line. Write to that.
- Vertical budget at 140px, 2-line headline, 2-line subline, full 2040px
  device: **2731 of 2796px — 65px spare.** It fits, barely.
- If a frame needs more room, **let the device bleed off the bottom edge**
  rather than shrinking the type. A cropped phone is normal and costs nothing;
  unreadable type costs the frame.
- Subline stays **33px**, max 2 lines, max ~18 words.
- Wordmark stays 30px / 14px tracking / uppercase / `--faint`.

**Squint test, mandatory before delivery:** scale each frame to 25% (≈322px
wide) and confirm the headline is still readable and the phone's hero element is
still identifiable. If either fails, the frame fails.

### 3.2 Geometry (unchanged)

```
stage        1290 × 2796, flex column, align center, padding-top 118
wordmark     30px, tracking 14px, uppercase, --faint
headline     margin-top 44, 140–150px Instrument Serif, line-height 1.1,
             letter-spacing -1px, centered, max-width 1080
             em → italic, --accent (paper) / --accent-warm (ink)
subline      margin-top 34, 33px, line-height 1.45, --muted, max-width 940
device       margin-top 62, 990 × 2040, radius 150, bg #0d0c0a, padding 22,
             shadow 0 60px 140px rgba(28,26,22,0.35)
screen       946 × 1996, radius 128, bg --canvas
app          430 × 908 logical, transform scale(2.2), origin 0 0
```

### 3.3 Rules that apply to every frame

- **Real UI only.** Every pixel inside the phone must correspond to something
  that exists in `src/app/`. No invented screens, no features we don't ship.
- **No human faces or bodies.** The category is entirely flat-lay cutouts, and
  "put a person in it" is genuine white space — but a stock model would break
  the Plate grammar, and AI-looking imagery carries its own measured penalty in
  identity categories (Frontiers 2026). Use the app's real **initial-monogram
  avatars** instead. They read as real people without photography.
- **No ratings, no press logos, no review quotes, no invented social proof.**
  (Alta and Style DNA both put press logos in frame 1; we have no press yet and
  fabricating credibility is not an option.)
- **Numbers must be internally consistent within a frame** and consistent with
  each other across the set. One fictional user, one closet, one week.
- **Populated states only.** Empty-state mockups measurably underperform.
- **Garment photography** comes only from `assets/garments/MANIFEST.md`. The
  `brown-leather-loafers.jpg` crop must stay toe-only — the full photo shows a
  maker's mark on the insole.

### 3.4 The canonical fiction

Keep these constant across all five frames so the set reads as one closet:

- User: **Mara Ellis**, `@mara`, Denver. Monogram **ME**.
- Closet: **54 pieces**, **128 outfits**, **9 never worn**, averages **$4.10 a wear**.
- Friends who appear: **Dana** (D), **Jess** (J), **Nic** (N).
- The event: **Dana's birthday dinner**, Sat 8 Aug, 7:30 PM, Bar Ideale, 70° clear.
- Hero garments: cream mohair sweater, charcoal tailored trousers, brown leather
  loafers, cognac leather tote, brown leather boots, white linen blouse.

---

## 4. Frame-by-frame

### Frame 1 — "The table"

**File** `01-table.png` · **Ground** `paper` · **Job** be unlike every other
result on the page.

**Headline** (140–150px, 2 lines, `em` italic oxblood on the second phrase):

> Your friends
> *pick.*

**Subline** (33px, 2 lines):

> Post the dinner. Everyone shares options from their own closet — and votes on
> yours.

**Inside the phone** — Event detail, `src/app/event/[id]/index.tsx`:

- Back row: chevron + small-caps `EVENT`.
- Serif display title: **Dana's birthday dinner**.
- Muted meta line: `Sat, Aug 8, 7:30 PM · Bar Ideale · 70°, clear evening`.
- **YOUR LOOK card** — blush surface `--blush`, hairline `--blush-rule`,
  rounded-plate. Small-caps oxblood label `YOUR LOOK`. Three garment plate
  swatches in a row, then look name **Cream & Cognac** in serif, muted note
  under it. **`3 PICKS FROM THE TABLE`** in colophon caps — this string is the
  whole point of the frame; it must be legible at 25%.
- **WHO'S WEARING WHAT** — small-caps label, right-aligned `4 of 6 shared`.
  Two-column grid of attendee cards: garment triptych, then monogram chip +
  first name (D · Dana, J · Jess), then a one-line muted descriptor.
- Voting affordance visible on at least one card — pick count plus two voter
  monograms. Signed votes, never anonymous.

**Must survive the squint test:** the two-column grid of *different people's
looks*. A viewer at thumbnail scale should register "multiple people, one
event" without reading a word.

**Do not:** show a public feed, follower counts, or strangers. The whole
differentiator is that this is a small invited circle, not an audience.

---

### Frame 2 — "The upload"

**File** `02-upload.png` · **Ground** `paper` · **Job** destroy the "this will
take me hours" objection.

**Headline** (140–150px, 2 lines):

> Your closet in
> *six minutes.*

**Subline**:

> Photograph a piece. It comes back cut out, colour-matched and tagged — before
> you've picked up the next one.

> **Copy note:** six minutes must be defensible. If real timing says otherwise,
> change the number, not the claim structure. A specific honest number is the
> asset; a vague "in seconds" is what everyone else already says.

**Inside the phone** — Capture / review flow, `src/app/capture.tsx` +
`src/components/review/review-card.tsx`:

- Top: small-caps `ADDING TO YOUR CLOSET`, right-aligned counter
  **`12 of 47`** with a thin oxblood progress rule beneath it. The counter is
  the proof of throughput.
- **The before/after pair, centred and large** — this is the hero:
  - Left: the raw phone photo of the cream mohair sweater, slightly askew, on a
    real messy background, corner-cropped like a real snapshot.
  - A thin arrow or `→` in `--faint` between them.
  - Right: the same garment as a clean cut-out plate on `--tray`, centred,
    shadowed like a `.tile`.
- Beneath, the auto-derived tags as small pills, appearing settled not pending:
  `Sweater` · `Mohair` · `Cream` · `Warmth 4` · `Smart casual`, plus a colour
  chip row showing the extracted palette.
- One quiet line in `--muted`: `Tap any tag to correct it.` — signals control,
  which matters because auto-tagging accuracy is a top-three complaint about
  every competitor.

**Must survive the squint test:** the before → after transformation. Messy photo
on the left, clean plate on the right, unmistakable at any size.

**This is the AI frame that doesn't say AI.** The recognition, the cutout, the
colour extraction and the tagging are all machine work, and showing them
outperforms naming them.

**Do not:** show a spinner, a progress bar mid-flight, or an "AI is thinking"
state. Show the finished result — speed is communicated by the counter, not by
a loading animation.

---

### Frame 3 — "The morning"

**File** `03-morning.png` · **Ground** `paper` · **Job** prove the styling
intelligence is real by showing its reasoning.

**Headline** (140–150px, 2 lines):

> Dressed in a
> *minute.*

**Subline** — the one place the mechanism is named:

> Built on your phone from what you own, for today's weather and plans. The
> reasons are shown, so you can argue with them.

**Inside the phone** — Today tab, `src/app/(tabs)/index.tsx`:

- Serif greeting **Good morning, Mara**, meta line
  `Feels 72° · Clear, light breeze · Denver`, then
  `12:30pm Lunch with Dana · 7pm Dinner`.
- The outfit plate card: serif title **The Long Lunch**, right-aligned
  `FEELS 72°`.
- **The reason sentence, in full and legible** — "Cream over charcoal keeps the
  afternoon easy, and the loafers carry it into dinner without trying." This
  sentence is the differentiator; do not truncate it to fit.
- The 2×2 garment collage: mohair sweater, charcoal trousers, penny loafers,
  leather tote. Caption strip naming all four.
- Footer: `PALETTE` with four colour dots, right-aligned **`$3.40 / WEAR`**
  in tabular figures.
- Action row: `Love it` · `Not for me` · `I wore this`.
- The honest learning line at the bottom in `--muted`:
  `Learning from 12 reactions — it thinks you lean warm neutrals.`

**Must survive the squint test:** the four-garment collage reading as a
coordinated outfit, and the `$/WEAR` figure.

---

### Frame 4 — "The no"

**File** `04-no.png` · **Ground** `ink` (the only dark frame; it earns the
contrast because this is the trust moment, and the tonal break re-engages
anyone who has scrolled this far).

**Job** strike at the category's most consistent failure.

**Headline** (140–150px, 2 lines, `em` in `--accent-warm` on ink):

> It tells you
> *no.*

**Subline**:

> Nothing you own works for black tie? It says exactly that, instead of
> inventing a gown you don't have.

**Inside the phone** — Stylist sheet, `src/app/stylist.tsx`:

- Header: **Stylist**, real subtitle string `Only your clothes — nothing invented`.
- Turn 1 (user, ink bubble): "Dinner at 7, then drinks after — what works?"
- Turn 1 (stylist, `--tray` bubble): the cream-mohair-over-charcoal answer,
  naming the real garments, with the garment strip beneath it and its caption.
- Turn 2 (user): "Could I do black tie with this closet?"
- **Turn 2 (stylist) — the frame's whole reason to exist, fully legible:**
  "No — nothing you own is formal enough for black tie, and I won't invent a
  gown you don't have. The closest true thing: the white linen blouse tucked
  into the charcoal trousers. Smart, not black tie."
- Follow-up chip in italic `--muted`: `Want me to keep an eye on what the closet
  is missing?`
- Composer at the bottom: `Ask about tonight…`

**Must survive the squint test:** two-tone conversation shape — the alternating
bubbles read as a real exchange even when the words don't resolve.

**Do not:** soften the refusal. The bluntness is the product.

---

### Frame 5 — "The ledger"

**File** `05-ledger.png` · **Ground** `paper` · **Job** the reason to keep the
app after the novelty passes.

**Headline** (140–150px, 2 lines):

> 54 pieces.
> *Nine, never worn.*

**Subline**:

> Cinch counts every wear — cost-per-wear, the favourites, the ones you keep
> skipping.

**Inside the phone** — Closet tab profile view, `src/app/(tabs)/closet.tsx`:

- Header **Closet**, search + overflow glyphs right.
- Profile row: large circled monogram **ME** (sand fill, oxblood serif
  initials) beside three stats — serif numeral over small-caps label:
  **54** PIECES · **128** OUTFITS · **9** UNWORN, the 9 in oxblood.
- Serif display name **Mara Ellis**, muted `@mara · Denver`.
- Bio line including **"Averages $4.10 a wear."**
- Style-tag chips in sand: `Warm neutrals` · `Tailored` · `Quiet weekends`.
- **FAVOURITE PIECES** — small-caps label, `Edit` in oxblood right. Horizontal
  rail of garment plates with name + muted wear count.
- **MOST WORN** — vertical list: small plate thumb, name, horizontal wear bar in
  dusty rose, right-aligned wear count (`31×`, `24×`, `21×`).

**Must survive the squint test:** the three big serif stat numerals, and the
descending wear-bar chart.

---

### Frame 6 (optional) — "The week"

Only if a sixth is wanted. This is v1's Plan frame, unchanged: seven day rows
against the forecast, colour swatches, `No piece worn more than twice`,
planned-day checkmarks. Headline "The week, *already decided.*"

It is optional because weekly planning is feature parity — 6 of 10 competitors
show it. It adds completeness, not differentiation. **Never promote it above
frame 5.**

---

## 5. What to test after launch

The set above encodes one genuine bet: **frame 1 social rather than frame 1
daily-outfit.** It is the differentiating choice, but it carries a real risk —
a visitor with no friends on Cinch may read frame 1 as "this needs a group I
don't have."

That is exactly what App Store Connect's Product Page Optimization is for: up to
3 treatments plus control, 90 days, ~90% confidence flagging. Only 35% of
top-1,000 apps ran two or more screenshot tests last year, so the competitive
bar is low.

**Test 1, run it first:**
- Control — frame 1 = The table (social)
- Treatment A — frame 1 = The morning (daily outfit), social demoted to 2
- Treatment B — frame 1 = The upload (six minutes), social demoted to 2

Calibrate expectations: a well-run screenshot test on live store traffic
realistically yields **single-digit to low-teens percent**. The 20–35% figures
in vendor blogs come from simulated pages with paid-social traffic, not the App
Store.

**Do not test:** the word "AI" in a headline. The evidence is strong enough that
spending a 90-day cycle on it is a waste of the slot.

---

## 6. Build and delivery

Render exactly as v1 — one HTML file per frame in
`docs/app-store/screenshots/src/`, sharing `base.css`:

```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless \
  --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=1290,2796 --screenshot=OUT.png "file:///ABS/PATH/frame.html"
```

Before handing back, confirm every one of these:

- [ ] Exactly 1290 × 2796, PNG, RGB, **no alpha channel**
- [ ] Headline ≥ 140px on every frame; ≤ 5 words; ≤ 2 lines
- [ ] 25% squint test passed on all five
- [ ] Every screen traceable to a real file in `src/app/`
- [ ] Numbers consistent within and across frames (the canonical fiction, §3.4)
- [ ] No faces, no press logos, no ratings, no invented social proof
- [ ] Loafer crops toe-only; all photography traced to `MANIFEST.md`
- [ ] The word "AI" appears at most once in the whole set, and never in a headline

**Upload note for whoever puts these in App Store Connect:** the version page
only exposes a 6.5" slot that rejects 1290 × 2796. Use *View All Sizes in Media
Manager* → **iPhone 6.9" Display**. And upload **one at a time, in order** — a
single multi-file upload scrambles the sequence. Both traps are documented in
`docs/app-store-listing.md`.
