# In-app events — three seasonal cards

**Drafted 2026-08-10. Nothing here has been created in App Store Connect.**

In-app events are ASO surface, not merchandising. They are indexed by App Store
search, they can be surfaced on the Today tab and in editorial, they appear as a
card on the product page, and each one carries its own deep link. An app with
zero events is invisible to a whole retrieval path that most of the category
also ignores.

All three below lead with the ten-piece wedge or a shipped feature, per
`docs/design/positioning-contract.md` §2. **No event prints an outfit count**
(§3). No competitor is named (§4).

---

## Read this before creating any of them

**An in-app event has to be a real thing that happens inside the app during its
date range.** Apple reviews events against the same 2.3 accuracy bar as the
description, and the two failure modes are (a) an "event" that is only a banner,
and (b) an event whose in-app surface does not exist. Cinch today has **no
event-scheduling mechanism** — nothing in `src/` reads an App Store event
identifier or changes behaviour by date. So each card below names the in-app
surface it needs, and **none of them should be submitted until that surface is
live.** Two of the three need almost nothing; one needs a screen.

Field limits, all counted below:

| Field | Limit |
|---|---|
| Event name | 30 |
| Short description | 50 |
| Long description | 120 |
| Event card image | 1920 × 1080, no text baked in beyond the safe area |

Event badge for all three: **Special Event**. (Not Challenge — there is no
completion condition, no leaderboard, and per `docs/stylist-voice.md` §9 the app
does not do leaderboards. Not New Season — nothing is seasonal in the content
sense.)

---

## 1 — Back to school

Run late August into the first two weeks of September.

| Field | String | Count |
|---|---|---|
| Name | `The Ten, for a new term` | 23 / 30 |
| Short description | `Ten pieces that carry a school week.` | 36 / 50 |
| Long description | `Photograph ten things you already wear to school or work. Cinch does the arithmetic and dresses the week from them.` | 115 / 120 |

**In-app surface it needs:** The Ten, entered directly. The deep link points at
`/the-ten`, which already exists (`src/app/the-ten.tsx`) and already resumes at
the count rather than the start (`hydrateFromWardrobe`, `:47-53`), so a returning
user is not sent back to slot one. This is the cheapest of the three — the
screen is built; it needs a route in, which is Unit A's D1 change.

**Why this event and not "new season style tips":** back-to-school is the one
week of the year when the whole audience is genuinely re-deciding what they wear
every day, and the wedge answers it literally — a school or work week is five
days, and five days is exactly what ten pieces are for. The claim is arithmetic,
not fashion advice, which is the only kind of claim this app should make.

---

## 2 — The autumn changeover

Run the last week of September through mid-October.

| Field | String | Count |
|---|---|---|
| Name | `The autumn changeover` | 21 / 30 |
| Short description | `Bring the coats back into the count.` | 36 / 50 |
| Long description | `Store what summer is done with, photograph what replaces it, and see what the new ten make against the forecast.` | 112 / 120 |

**In-app surface it needs:** Storage (`src/app/storage.tsx`) plus The Ten. Both
exist. The event is the pairing — store, then re-photograph — and it is the only
moment in the year when Storage is the interesting screen rather than the
housekeeping one.

**Why it is honest:** storing a piece genuinely frees an active slot since
migration `20260808190100` (`src/features/closet/storage.ts:26-31`), so "bring
the coats back into the count" describes a real state change and not a metaphor.
"See what the new ten make" points at a per-user computed number on screen,
which is the only place §3 permits an outfit count to appear.

---

## 3 — Party season

Run mid-November through 31 December.

| Field | String | Count |
|---|---|---|
| Name | `Dressing for the parties` | 24 / 30 |
| Short description | `One outfit, two rooms, settled early.` | 37 / 50 |
| Long description | `Post the party, invite the people going, and let them help you pick between two looks from clothes you already own.` | 115 / 120 |

**In-app surface it needs:** the events flow — create an event, invite, post two
looks, vote (`src/app/event/[id]/outfits.tsx`, `src/features/event-outfits/**`).
All shipped. The deep link should land on **new event**, not the events list,
because the event is the act of creating one.

**One dependency, and it is a real one.** Guideline 1.2 exposure is still open
on three points (see `docs/app-store-listing.md`, the 1.2 audit): outfit posts
have no report affordance, blocked users' looks stay visible inside a shared
event, and there is no age gate. An in-app event that *advertises* group posting
raises the reviewer's attention on exactly those three. **Do not submit this
event until the report affordance on outfit posts and the block leak are
closed.** The other two events carry no UGC surface and are unaffected.

**"Settled early" rather than "settled":** the honest promise is that the
decision gets made before the day, which is what the flow does. It does not
promise agreement.

---

## What was considered and rejected

| Idea | Why not |
|---|---|
| A "count your outfits" event | Prints or implies the outfit count in a static surface. Forbidden, `docs/design/positioning-contract.md` §3, without exception. |
| New Year capsule challenge | "Challenge" implies a completion condition and a streak. The app has neither, and `docs/stylist-voice.md` §3 DON'T 3 bans streak mechanics outright. |
| Holiday packing event | Real feature, but it collides with party season on the calendar and the packing story is better served by a custom product page, which runs all year. |
| Anything naming a competitor's seasonal moment | §4. |
