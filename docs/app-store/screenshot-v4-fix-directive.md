# App Store screenshots v4 — fix directive

**Written 2026-09-16, against the `exports/appstore-v4` delivery (seven frames,
1320 × 2868, received 08:08Z).** Supersedes nothing: v3 stays live until this set
ships. Read with `screenshot-design-directive-v3.md`, whose research, palette,
type scale and export spec all still bind.

**Founder decisions taken 2026-09-16, before any upload:**

1. **Nothing goes to Apple until §1 is fixed.** The set is held.
2. **Frame order changes — `01-hook` leads.** §3.
3. **Lane: custom product page first, not a new app version.** §6.

The art direction is not in question. The set is the strongest work this project
has produced — consistent lockup, real UI, real garments, no invented social
proof, and a first frame that finally shows an outfit. What follows is three
rendering defects and two nits, nothing more.

---

## 1 · Three blocking defects — all the same bug

**Root cause in every case: a text line wrapped to a second line and its
container did not grow, so the glyphs are sliced by the container's edge or spill
outside it.** Whatever renders these frames is laying out at a narrower text
width than the design assumes, or the containers are fixed-height. Fix the cause
once and all three go away.

Crops of each are in `docs/app-store/screenshots/v4-defects/`.

### 1.1 `04-stylist.png` — "opening?" is cut in half *(worst of the three)*

The maroon user bubble reads "What do I wear to a gallery opening?". It wraps to
two lines; the bubble is sized for one. The word **"opening?" is sliced
horizontally through its middle** — the top half of the letterforms renders
against the maroon, the bottom half is clipped off entirely.

- Region: approx. **x 290–1100, y 1255–1290** (bubble bottom edge ≈ y 1278).
- Why it blocks: this is the frame that carries the stylist claim, and a
  half-cut word reads as a broken build, not a design choice. It is visible at
  thumbnail size.
- Fix: let the bubble grow to fit two lines, or shorten the question to one line
  (*"What do I wear tonight?"* fits and is a better question — it is the one the
  app actually answers).

### 1.2 `06-plan.png` — the "12" of "Saturday 12" is cut in half

The date heading wraps after "Saturday"; the "12" lands on a second line and is
**sliced through the middle by the top edge of the outfit image block** directly
below it.

- Region: approx. **x 215–715, y 1455–1490** (image block top edge ≈ y 1483).
- Fix: fit "Saturday 12" on one line (it fits at this width if the weather chip
  on the right gives back ~40px), or give the heading room for its second line.

### 1.3 `01-hook.png` — "Grey, 63°" spills outside its pill

The first filter chip wraps to "Grey," / "63°" and the second line renders
**outside the pill's rounded background**, sitting loose on the card. The
`63°F · Grey` chip inside the outfit card below wraps the same way.

- Region: approx. **x 215–390, y 1245–1350**.
- Fix: pill grows with its content, or the chip reads "Grey · 63°" on one line.
  Note the app's own Today screen renders these as single-line chips, so the
  one-line form is also the more accurate UI.

---

## 2 · Two nits — fix if cheap, not blocking

### 2.1 The dates disagree across the set

`01-hook` is **Wednesday, 18 August**; `05-friends` and `06-plan` are **Sat 12
Sep**. Nobody reads a screenshot set as one continuous day, but a reviewer
comparing frames will notice. Pick one week in September and use it everywhere.

### 2.2 The exports carry an alpha channel

The v3 directive asks for "flattened PNG (no alpha)"; all seven v4 files are
RGBA, as were the v3 files. Apple accepted the v3 set anyway, so this has never
bitten us — **it is not a blocker and it is not worth a re-export on its own.**
The upload path flattens to RGB before it touches App Store Connect
(`scripts/prep-appstore-upload.py`), so the delivered format can stay as it is.

---

## 3 · The order, and why it changed

Apple renders **three** screenshots in search results and uses **only the first
three** on the install sheet. Roughly half of installs are decided on frame 1
alone (v3 directive §1.1). Cinch's entire acquisition channel is the Apple Ads
exact keyword `[outfit planner]` — $3.93 CPA, 13.9% tap-through, and as of the
09-15 nightly, effectively 100% of arrivals.

The delivered order opens on `00-cover`: a typography frame with no app UI, on
which the words *outfit* and *planner* do not appear. It is a beautiful card and
it is the wrong first impression for someone who just typed "outfit planner" into
the App Store.

**Ship in this order:**

| slot | file | the claim it makes |
|---|---|---|
| **1** | `01-hook` | "Your closet. Styled." — an actual outfit, on the Today screen, with *Wear this*. Answers the search query in one frame. |
| **2** | `02-ten` | "Start with just ten pieces." The wedge, and the only low-effort promise in the category. |
| **3** | `03-closet` | "Every piece, remembered." The utility claim that matches `[closet app]` and `[wardrobe app]`. |
| 4 | `04-stylist` | The stylist — deliberately *not* in the first three. Category research: "AI suggestions are hit or miss" is the #2 complaint, and every competitor claims a stylist. |
| 5 | `05-friends` | "Get dressed together." The one thing no competitor has. |
| 6 | `06-plan` | "Packed before you are." Planning and packing. |
| 7 | `00-cover` | The brand card, as a closing statement. |

**If you want the cover higher, slot 2 is the place** — it costs the ten-pieces
frame its install-sheet position but keeps the brand statement above the fold.
Say the word and it is a one-line change to the upload order; nothing re-exports.

---

## 4 · Export spec — unchanged

Seven portrait frames, **1320 × 2868**, PNG, one file per frame, **same
filenames** (`00-cover` … `06-plan`) so the upload manifest does not move.
Headline ≥ 140px, subline ≥ 56px, nothing under 44px. Real UI only. No invented
social proof.

## 5 · The gate before you re-deliver

```
python3 scripts/check-appstore-screenshots.py <folder>
```

Checks dimensions, mode, count and naming; writes a 25%-scale contact sheet for
the thumbnail-readability gate the v3 directive asks for; and crops every frame's
phone-screen region to `_inspect/` at full size, which is where all three of §1's
defects live. **Look at `_inspect/` before delivering.** Every one of these three
was invisible in the full-frame view and obvious at 100%.

## 6 · What happens the moment the fixed set lands

No new binary, no app version, no release cycle:

1. Flatten and order the seven frames — `scripts/prep-appstore-upload.py`.
2. Create a **custom product page** (0 of 70 used), en-US only, and upload the
   set to its 6.9" slot. A CPP carries its own screenshots and needs Apple
   review, but **not** a new build.
3. Submit the CPP. On approval, point Apple Ads `CIN-EXP-004` at its `ppid` URL.
   Because paid is ~100% of arrivals, the new art reaches nearly every visitor
   within one review cycle while the default page keeps v3.
4. The default page catches up with **1.2.6**, whenever build 50 ships for its
   own reasons — screenshots on a live version are locked, which is the whole
   reason for step 2.

Measurement, stated before the fact so it can be scored: the honest read is
Apple Ads **tap-through on `[outfit planner]`, CPP vs the 13.9% the default page
has been running.** ASC impressions and page views contain ad impressions and
taps (METHODOLOGY 09-09), so do not score this on the ASC funnel.
