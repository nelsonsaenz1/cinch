# Custom product pages — three

**Drafted 2026-08-10. None created in App Store Connect.**

A custom product page is a variant of the App Store product page reachable by
its own URL (`?ppid=…`). It is used for paid traffic, for a TikTok bio link, for
an influencer, for an email — anywhere you already know what the visitor came
for and can stop making them read a general pitch.

---

## What a CPP can and cannot change — read this first

This is the part that is usually got wrong, and getting it wrong wastes a page.

| Element | Custom per page? |
|---|---|
| Screenshots (up to 10) | **Yes** |
| App previews (video) | **Yes** |
| Promotional text (170) | **Yes** |
| App name / title | No — global |
| Subtitle | No — global |
| **Description** | **No — global** |
| Keywords | No — global, and CPPs are **not indexed by App Store search at all** |
| In-app purchase display | No |

So a custom product page is **three screenshots-worth of argument plus 170
characters**, and nothing else. It cannot re-tell the story in prose. Everything
below is written to that constraint: the whole message has to survive in the
headlines and the promo text.

**They are not an ASO surface in the search sense** — Apple does not index them
and they do not affect ranking. They are a *conversion* surface for traffic you
have already earned, which is a different job from the in-app events, and worth
saying out loud so nobody expects rankings from them.

**Up to 35 CPPs are allowed.** Three is the right number to start: one per lane
the subtitle claims, plus the one the title claims.

**Prerequisite:** all three need frames from the v3 screenshot set, which is
specified but unrendered (`docs/app-store-listing.md`, Screenshots §, and
`docs/app-store/screenshot-directive-v2.md`). Two of the three also need one
frame that does not exist in any set yet. Those are named below.

All three obey the same two bans as everything else: **no outfit count in any
static surface** (`docs/design/positioning-contract.md` §3), and **no competitor
named** (§4).

---

## CPP 1 — Packing

**Internal name:** `Packing` (7 / 30)
**Points at:** travel searches, trip-planning content, the autumn and summer
travel weeks, and any paid keyword containing "packing" or "travel".

**Promotional text** — 160 / 170:

```
Tell Cinch where you are going and for how long. It reads the forecast there and works out the smallest set of clothes that still dresses every day differently.
```

**Screenshots, in order:**

| # | Frame | Headline | Status |
|---|---|---|---|
| 1 | Packing — the trip questionnaire, destination and dates set | "Where, and *how long?*" | **New render needed.** Source screen exists: `src/features/plan/trip-questionnaire.tsx` |
| 2 | Packing — the capsule, pieces ordered by how many looks they cover | "The smallest bag *that works.*" | **New render needed.** Source: `src/features/plan/packing-trip.tsx` |
| 3 | Packing — the day-by-day looks against the destination forecast | "A different outfit *every day.*" | **New render needed.** Source: `src/features/plan/packing-tab.tsx` |
| 4 | Today — the daily plate | "Dressed in a *minute.*" | v3 frame 2, reused |
| 5 | The Ten — the grid | "Ten pieces is a *wardrobe.*" | v3 frame 1, reused |

**Why this order.** The packing visitor has a specific job and no patience for
the general pitch, so frames 1–3 are the feature end to end and the wedge comes
*after*, as the reason the app is worth keeping when they get home. That is the
inverse of the main gallery and it is deliberate: the main gallery sells the app,
this page sells the trip.

**The honesty frame stays.** Frame 3's subline should carry the unfilled-day
sentence — `src/features/plan/packing.ts:44-52` counts looks the closet could not
fill and the screen says so. A packing page that promises a full week from any
closet is the exact claim this app exists to not make.

---

## CPP 2 — Capsule wardrobe

**Internal name:** `Capsule wardrobe` (16 / 30)
**Points at:** capsule-wardrobe and minimalist-wardrobe content, the
"I own too much and wear none of it" audience, and the founder's own TikTok.

**Promotional text** — 162 / 170:

```
Ten pieces is a wardrobe. Photograph three tops, two bottoms, a dress, two pairs of shoes, a coat and a bag — Cinch does the arithmetic and dresses you from them.
```

**Screenshots, in order:**

| # | Frame | Headline | Status |
|---|---|---|---|
| 1 | The Ten — the grid, six filled | "Ten pieces is a *wardrobe.*" | v3 frame 1 |
| 2 | The Reveal — the count and the first outfit | "Then it does the *arithmetic.*" | **New render needed.** Source: `src/app/reveal.tsx`. The number on screen is computed from the fictional closet in the frame and must stay internally consistent with the ten pieces shown in frame 1 |
| 3 | Today — the daily plate | "Dressed in a *minute.*" | v3 frame 2 |
| 4 | Today — the reason line enlarged | "Every outfit, *explained.*" | v3 frame 3 |
| 5 | Closet — most-worn and never-worn | "54 pieces. *Nine, never worn.*" | v3 optional sixth, promoted here |

**The one thing to be careful about on frame 2.** A number appears on this
screenshot, and §3's rule is that the outfit count may never be a marketing
constant. It is permitted here for exactly one reason: it is rendered *inside the
device*, as the app's own on-screen output computed from the ten garments visible
in frame 1 — not as a headline, not as a promise, and not repeated in any
copy. **The headline says "the arithmetic", never the result.** If the render
pulls that number up into the headline, the frame is wrong and must go back.

**Why frame 5 is the closer, not frame 1.** The capsule audience's real pain is
not owning too little, it is owning a lot and wearing a fraction of it. The
never-worn count is the sentence that names their problem — but it only lands
after they have been shown that ten pieces are enough, which is why it goes last.

---

## CPP 3 — Outfit calendar

**Internal name:** `Outfit calendar` (15 / 30)
**Points at:** planner and organiser searches, back-to-school and back-to-work
traffic, and anyone who arrived from "what to wear this week" content.

**Promotional text** — 160 / 170:

```
Your week, laid against the forecast and whatever is in your calendar. One outfit per day, decided in advance, with the reason it was picked written underneath.
```

**Screenshots, in order:**

| # | Frame | Headline | Status |
|---|---|---|---|
| 1 | Plan — the week, one row per day against the forecast | "The week, *already decided.*" | Re-render of the retired v1 frame 5 (`docs/app-store/screenshots/src/05-plan.html`) at the v3 headline size |
| 2 | Today — the reason line enlarged | "Every outfit, *explained.*" | v3 frame 3 |
| 3 | Today — the weather aside in the header | "It reads the *actual weather.*" | **New render needed.** Source: `src/features/context/weather.ts` drives the line; `src/app/(tabs)/index.tsx` renders it |
| 4 | Stylist — the multi-event answer | "Dinner, then *drinks after.*" | **New render needed.** Source: `src/lib/styling/features.ts:381-393`, rendered through the stylist sheet |
| 5 | The Ten — the grid | "Ten pieces is a *wardrobe.*" | v3 frame 1 |

**This page is the reason the Plan frame gets re-rendered.**
`docs/app-store/screenshot-directive-v2.md` §2 dropped the Plan/week frame from
the main gallery as "pure feature parity", and that judgement is still right for
the gallery — six of ten competitors show a weekly planner, so it is the worst
use of a scarce main slot. On a page whose visitor *searched for a planner*, it
is the best use of the first slot. Both statements are true at once; that is what
custom product pages are for.

**Frame 4 is the differentiator on this page.** Every competitor can show a week
grid. Almost none can take "dinner at seven, drinks at ten" and return one outfit
that survives both, and `multiEventRule` gates the score rather than averaging it
(`src/lib/styling/score.ts:195-199`) — an outfit that fails the dinner is
unusable, not 80% correct. That is a real mechanism and it deserves the slot.

---

## Measurement

Each CPP reports its own impressions, conversion rate and retention in App
Analytics, and the `?ppid=` parameter can be appended to any link. The one thing
worth setting up before launch: **use a different CPP per channel even when the
copy is identical**, because the page id is the only channel attribution the App
Store gives you for organic-looking traffic.

Note also that the PostHog funnel cannot see any of this — `src/lib/posthog.tsx`
has no acquisition-source event, and `docs/design/positioning-contract.md` §9
records that the funnel is bottom-heavy generally. App Analytics is the only
source of truth for CPP performance, and it does not join to in-app behaviour.
