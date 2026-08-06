# The field guide — extracted content

The founder's Claude Design export lives at `docs/design/cinch-app-design.html` (a
self-extracting compressed bundle — serve it and open in a browser to see the renderings;
it cannot be read as plain HTML). This file is the faithful text extraction of every screen
in it: exact copy, exact structure, in order. It is the **canonical source for all design
features** — the founder's standing rule is that no visual pattern gets invented that isn't
grounded here. `docs/design/field-guide-audit.md` holds the pattern-level distillation;
this file holds the words and states themselves.

Type system: **Instrument Serif** (display) · **Helvetica Neue** (data & UI).
Direction: a print lookbook that regenerates every morning — considered, quiet, confident.
Not a dashboard, not a feed, not a shop. Data reads like a caption or a spec line under a
photograph, never like fine print.

---

## 01 · Welcome & sign-in
The whole promise in one screen; shows a sample outfit rather than describing one.

> TODAY'S SET — THE QUIET MONDAY
> Charcoal · cream · slate — £1.20 to wear
> **Dressed from your own closet, every morning.**
> Weather, your plans, and what you actually wear — Cinch reads all three.
> [Continue with Apple] [Continue with email]

## 02 · Today (home)
Complete outfits for the day, the facts behind each. Love / not-for-me / I-wore-this are live.

**02a Normal day:** greeting ("Good morning, Mara"), weather line, "Dinner at 7, then
drinks — tell Cinch" plans affordance, then plates: name ("The Quiet Monday"), weather
spec ("12° · LIGHT RAIN A.M."), one-paragraph reasoning, garment list, PALETTE row,
"£1.20 to wear", three reactions (Love it / Not for me / I wore this).

**02b New user · empty closet:**
> NOTHING TO STYLE YET
> **I can't style what I can't see**
> Photograph your wardrobe once and I'll build outfits from your real clothes each
> morning. No shopping, ever.
> [Add your clothes]

**02c When nothing works · honest:**
> **Nothing today feels right — and I won't pretend it does.**
> A formal lunch in heavy rain needs your tailored pieces, and both are in the wash.
> I could force something, but you'd know.
> WHAT MIGHT HELP: ✦ Ask the stylist for a workaround · ＋ Add a rain-proof piece ·
> ↻ See tomorrow, once things are clean

**02d Offline:** banner "Offline — showing this morning's set. Weather & plans may have
moved on. LAST SYNCED 8:12AM" · plate marked "Saved for offline" · "Reactions will sync
once you're back online."

## 03 · Closet — *your wardrobe as a profile*
"Who you dress like, your favourites and most worn, then everything you own. The chips
filter live."

**03a Populated — the closet IS a profile page.** Top to bottom:
1. Header: `Closet` + search (⌕) + overflow (⋯)
2. Stats row: avatar (`ME`) · **54 PIECES · 128 OUTFITS · 1 UNWORN**
3. Identity: **Mara Ellis** · @maraellis · London
4. Style summary line: "Quiet tailoring, warm neutrals, one good coat. Averages £2.40 a wear."
5. Style chips: Quiet tailoring · Warm neutrals · Wool first
6. FAVOURITE PIECES rail (with Edit) — pieces + wear counts
7. MOST WORN rail — pieces + wear counts
8. Category chips: All · Tops · Bottoms · Outerwear · Shoes · Accessories (live filter)
9. Full grid: each tile = name · wears · cost-per-wear (e.g. "Charcoal wool coat · 42 wears · £4.70")
10. NEVER WORN section at the bottom ("Leather belt · Never worn · —")

**03b Loading:** `Reading your wardrobe…` — a *transient* state, designed to resolve.

**03c Empty:**
> **An empty rail**
> Add a few pieces and this fills with your real wardrobe — worn counts, cost-per-wear,
> the lot.
> [Add clothes]

## 04 · Item detail
One garment and its story. Category kicker, photo, name, "Owned since Oct 2023", spec
row: **42× WORN · £197 PAID · £4.70 COST PER WEAR · 4d SINCE LAST WORN**, a trend
sentence ("Down from £6.50 a wear last winter…"), SUITS chips (Work / Rain / Cold
evenings), COLOURS ("Charcoal · works with 8 of your pieces").

## 05 · Plan
Week strip + events. Week/Events toggle. Event cards: name, date, place · weather,
attendee avatars, "4 of 6 going", status label (**LOOK SET / NEEDS A LOOK / PACKING** —
the Lisbon travel card carries `PACKING`). Actions: + New event · Invite friends.

**05b Event detail:** kicker EVENT, name, "Fri 8 Aug, 7:30pm · Shoreditch · 19° clear,
cool after dark", [Going] [Invite], YOUR LOOK ("Oxblood & Cream — Coat for the walk
home", Swap a piece / Share with group), WHO'S WEARING WHAT ("4 of 6 shared", per-friend
rows, "Hasn't shared yet"), a stylist observation line.

## 06 · Stylist
"✦ Stylist — Only your clothes — nothing invented." Chat: assistant opens ("Morning. Ask
me anything — I only answer with clothes you actually own."), user asks, answer names
only owned garments and says plainly what doesn't work. Input works — type & send (↑).

## 07 · Capture
"Photograph the wardrobe. Clear progress as Cinch cleans up and identifies each shot,
plus the first-run consent moment."

**07a Capturing & processing:** viewfinder hint "One garment, plain background" ·
controls **Library / [shutter] / Flip** · Done. Progress: **"Processing 3 of 5" · "2 to
go"** with a per-item status rail: `Coat ✓ · Knit ✓ · Cleaning… · Queued · Queued`.

**07b First-run consent:**
> **Before Cinch looks**
> To turn your photos into a wardrobe, Cinch processes each image. Here's exactly what
> that means.
> ✧ Cleans up the photo — removes the background
> ✧ Identifies the garment, its colours and category
> ✧ Never sold, never shared, never used to advertise
> [Allow processing] [Not now]
> You can turn AI features off anytime in Profile.

## 08 · Review
"Confirm what Cinch identified, one item at a time. A clear way to accept, a clear way
to skip."

> REVIEW · 1 OF 5
> **Is this right?**
> My best guess — correct anything that's off.
> [cleaned-up photo]
> CATEGORY  Tops · Knitwear   (Edit)
> COLOURS   Cream             (Edit)
> DETAILS   Fine-knit · crew neck (Edit)
> [Skip] [Looks right]

## 09 · Profile
Avatar, name, "3 weeks with Cinch". **WHAT CINCH HAS LEARNED** — honest early copy
("Still early. So far: you lean muted, reach for wool, and rarely touch bright colour…")
with a "Getting to know you" progress cue. AI STYLING toggles (Daily outfit styling ·
Process photos on-device only). ACCOUNT list (Privacy / Support / Sign out / Delete
account).

## 10 · The shareable outfit
One tall 9:16 frame: Cinch masthead, date, TODAY'S OUTFIT, the look's name in display
serif, PALETTE, COST PER WEAR, "Styled by Cinch — from clothes I already own." Export
options: Share to Instagram Stories · Save image to camera roll · Toggle the data on or
off. "The numbers are the point, even when you're showing off."
