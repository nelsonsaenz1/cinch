# Cinch Redesign Program — the Atlas of Record

**Written 2026-08-17, after founder review of update `01a0113d` on device.**
**Verdict being answered:** the shipped design is too quiet. The founder wants a
visibly transformed app — more color, more design, bigger moments, less prose —
with Alta Daily as the reference bar. This document is the complete program:
the new direction, the pipeline that guarantees what's designed is what ships,
and an in-depth brief for every page a customer sees.

---

## 0 · The contract that makes this different from the last wave

Two failures to never repeat:

1. **Taste discovered after shipping.** Every prior wave went code-first; the
   founder saw the result only after it was live. From now on **nothing is
   built until its Claude Design frame is approved by the founder.** The
   artifact is the contract.
2. **"Built" without "seen."** Every wave ends with an OTA *and* founder
   confirmation on device (build 40+, second launch applies the update) before
   the next wave starts.

**Frame fidelity rule:** implementation matches the approved artifact exactly —
spacing, color, type, radii, order, copy. Engineers adapt only where iOS
reality forces it (safe areas, keyboard, Dynamic Type growth), and every such
deviation is listed in the build report. Acceptance = side-by-side screenshot
against the frame.

**Pipeline, per wave:**

1. Founder (or Cowork agent) feeds this document's page briefs into Claude
   Design, one flow at a time.
2. Finished artifacts land in `design-refs/redesign-2026-08/<page>/` — the
   artifact HTML plus PNG exports of every state. Paste or commit them; either
   works.
3. Claude Code fleet builds each page exactly to frame, on disjoint files.
4. Typecheck, tests, adversarial diff review, OTA.
5. Founder verifies on device. Sign-off or punch list. Next wave.

---

## 1 · The new design direction — "warm paper, turned up"

What stays (it is the brand, and it is good): Instrument Serif for display,
Helvetica for small text, the warm paper canvas, garment photography as hero,
generous whitespace, no dark mode.

What changes — this is the reset:

- **Color becomes structural, not ceremonial.** The one-oxblood-per-screen law
  is repealed. Each area gets a working accent painted confidently: oxblood
  stays the brand/action color, `accent-warm` clay and `blush` move from
  rare garnish to real fills — section headers, selected states, progress,
  celebratory moments. Semantic greens/ambers may appear as chips and marks,
  warmed to the paper. The bar: a screenshot of any page should read as
  *designed*, not typeset.
- **Image-forward, edge-to-edge.** Alta's lesson: the clothes carry the app.
  Plates grow; grids get tighter gutters and bigger imagery; heroes bleed to
  the screen edge with type set over scrims where the photography can hold it.
  Empty states draw garments, not paragraphs.
- **Buttons with presence.** Primary CTAs go full-width, 56pt, filled, with
  pressed-state depression (scale 0.98 + shade) and a haptic on every
  meaningful commit. Secondary actions become tinted fills (`blush`/`sand`)
  rather than hairline ghosts. Radii may warm to 14–16 on controls if the
  artifacts land there — the artifact decides.
- **A haptic vocabulary, everywhere it means something.** selection() on every
  chip/segment/toggle; light impact on card taps; success notification on wear
  logged, trip planned, event created, friend added, purchase complete.
  Never on scroll, never decorative.
- **Motion as reward.** Plates settle in with staggered fades; the calendar
  strip glides; the reveal remains the app's biggest moment and gets bigger.
  All `useReducedMotion`-guarded.
- **Less text, always.** One headline, at most one supporting line, then the
  interface. Anything explanatory beyond that becomes structure or dies.
- **Inspiration ≠ imitation.** Take Alta's *patterns* — calendar strip
  planning, collage-style outfit plates, polished profile with content rails,
  celebratory logging — never its literal layouts, icons, or trade dress.

Constraints that survive every redesign (non-negotiable, they are law or data
truth, not taste): friends-only privacy boundaries; numbers shown to users
derive from `plans.ts`; the consent lines (AI, voice, social terms) keep their
meaning; 44pt tap targets; VoiceOver labels preserve any removed prose; OTA
compatibility (JS-only — flag anything needing a native module immediately).

---

## 2 · Priorities

- **P0 — the founder's named pages** (Wave 1): New Event, Event Detail, Plan
  week + calendar, Trips (list — NEW, new trip, trip detail), Profile
  (restructure), People Search (has a live overlap bug — treat as defect AND
  redesign), Invite/Share page.
- **P1 — the daily core** (Wave 2): Today, Reveal, Wear confirm, Closet, Item
  detail, Stylist, Explore.
- **P2 — the rest** (Wave 3): onboarding flow, capture, storage, gap feed,
  groups, activity, settings, membership.

---

## 3 · Page briefs — every screen a customer sees

Format per page: **Role · Route · Today · Redesign · Keep**. "Redesign" is the
creative direction to hand Claude Design; it should design freely inside it.

### Plan, events, and trips (P0)

**1 · Plan — the week**
Role: the planning home; the founder wants it to feel like a calendar you play
with. Route: `(tabs)/plan.tsx` (Week mode).
Today: a vertical list of day cards under a segmented control; functional,
static, text-led.
Redesign: an interactive **calendar strip** at the top — seven day chips,
today marked, horizontally swipeable **between weeks** (shuffle weeks
freely, past and future), with a subtle month label that updates as you swipe.
Below it, the selected day's outfit plan as a large image-led plate. Days with
events carry a colored dot; days already planned show a thumbnail in the chip.
A month-grid calendar sheet opens from the month label for long-range jumps.
Weather integrated as small marks on the chips, not sentences. Haptic tick on
week change.
Keep: the week's outfit engine contract (no promises of specific counts),
existing data only — no new backend needed, `trips` and `events` tables exist.

**2 · New Event**
Role: create an occasion. Route: `event/new.tsx`.
Today: a serviceable form the founder has flagged repeatedly; fields read as a
document, date/time pickers are quiet, nothing celebrates completion.
Redesign: rebuild as a **sheet-based composer** — big serif title ("What's
the occasion?"), fields as generous 56pt tappable rows with clear filled
states (answered rows tint `blush`), native-feeling date/time selection,
venue field with the existing manual entry. One full-width filled CTA. On
create: success haptic + a settle animation into the event's new card. Field
text must be verified against descenders at AX sizes — this page has a
clipping history; the artifact must show default AND AX3 states.
Keep: optional date (events can float), the group/note semantics, draft
preservation on cancel.

**3 · Event Detail**
Role: one occasion — the look, the people, the plan. Route: `event/[id]/`.
Today: correct hierarchy after the last pass, still text-heavy, utilities
compete with the point.
Redesign: **event as a poster.** Hero block: serif event name over a warm
tinted band (venue + date set small beneath), the user's planned look as the
dominant image plate ("Your look" — tappable to change), then the roster as
avatar chips (not rows), then logistics collapsed into a single quiet line.
RSVP as two tinted buttons with haptics. Comments and outfit voting one tap
down, not on the poster.
Keep: privacy (roster shows only what `event_members` policy allows), the
report affordance, blocked-user handling.

**4 · Trips — the list (NEW PAGE)**
Role: every trip in one place; the founder's explicit ask — after planning a
trip you can come back and see all of them. Route: new `trips/index.tsx`.
Today: does not exist — trips are planned (packing brief) and then
unreachable except through Plan.
Redesign: a shelf of **trip cards** — destination in serif, dates as colophon,
a collage of 3–4 packed pieces as the card's image, upcoming trips first,
past trips in a quieter section below ("Where you've been"). Empty state
draws a suitcase silhouette + one line + CTA. Entry points: Plan's Packing
mode header and the post-planning success screen both link here ("See all
trips").
Keep: reads the existing `trips` table; no schema change.

**5 · New Trip / Packing questionnaire**
Role: plan a trip (membership feature — the paywall moment). Route: packing
flow under Plan.
Today: a questionnaire that works but reads as a form; the paywall fires for
free users (correct — keep exactly).
Redesign: the questionnaire becomes a **stepped card flow** — one question
per card (where, when, what's happening), big touch targets, progress dots,
imagery where possible (weather icon for destination once known). The brief
result lands as a designed packing plate: pieces gridded by day/purpose, not
listed. Completion: success haptic + "Trip planned" moment + two clear paths:
"See this trip" and "All trips".
Keep: `PackingAccess` gate fails closed for free; `packing-brief` server
contract unchanged.

**6 · Trip Detail**
Role: one trip's packing plan, revisitable. Route: trip detail under the new
trips stack.
Today: the brief renders once; revisiting is awkward.
Redesign: destination hero (serif + dates + weather marks), the packing plate
as the body (pieces as cutout grid, grouped by day or purpose, checkable —
local state — as you pack), a note field, and quiet actions: re-plan,
delete trip. Checking a piece gives selection haptic; completing all gives
success.
Keep: pieces reference the user's real closet items; deleting a trip never
deletes garments.

### Profile & people (P0)

**7 · Profile**
Role: the user's own room. Route: `profile.tsx`.
Today: identity block, capacity card, settings-ish rows; closet-forward but
flat, and the founder has specified a new order.
Redesign, to the founder's spec: identity compact at top (avatar, name,
handle, and a **tappable friends count** — "12 friends" opens the friends
list). Then the content rails, in this order: **Most worn** (image rail),
**Favorite outfits** (image rail, from the favorites feature), then stats set
as designed marks (pieces, outfits made, cost-per-wear if present) — and
**closet photos at the bottom** as a tight grid. Capacity/plan door stays but
set as one quiet row. Every rail's header in the area accent, not gray.
Keep: favorites are owner-private; the plan door logic (free/standard) as
shipped today.

**8 · Friends list**
Role: your circle, reachable from Profile's friends count and Explore.
Route: `friends/index.tsx`.
Today: functional list + requests; visually a settings page.
Redesign: friend rows become **cards with presence** — avatar large, name,
and a live fact (latest shared piece thumbnail or "worn today" mark where
Daily Social visibility allows). Requests as a distinct tinted band at top.
Invite a friend as a designed footer card (see page 10), not a bare link.
Keep: mutual-only model, blocked-user invisibility, share-visibility rules.

**9 · People Search ("Find people")**
Role: find a specific person. Route: `people-search.tsx`.
Today: **has a live visual defect the founder sees — overlapping text — fix
as P0 bug in the same rebuild.** Recent invite block shipped below results.
Redesign, to the founder's spec: search field at top; **directly beneath it,
at rest: two designed rows — "Share your link" and "Invite a friend" — which
disappear the moment typing starts** and return when the field clears.
Results as avatar cards. The no-results state offers the invite path again,
once. Both invite rows route to the redesigned Share page (10).
Keep: username-only search under the current privacy contract; cancel
dismisses; keyboard never covers results.

**10 · Invite / Share page**
Role: the growth loop's landing — the founder wants it *much* better
designed. Route: `invite.tsx` + `components/invite/`.
Today: ink link card + arrival rows; recently decluttered, still utilitarian.
Redesign: make it feel like **handing someone a card, not configuring a
URL.** A designed share card visual (the user's handle set in serif on a
warm plate — the thing being shared, made visible), one big filled "Share
your link" CTA (native share sheet), copy as secondary. Beneath: "Came in
from your link" as celebratory rows (avatar + name + warm mark for new
arrivals — the accent dot shipped today grows into this). QR code if the
artifact wants one (pure JS generation exists via react-native-svg — no new
native module).
Keep: one permanent link per person; no contact-book access; arrival privacy
as shipped.

### The daily core (P1)

**11 · Today**
Role: the home — three outfits for today. Route: `(tabs)/index.tsx`.
Today: strong bones (named plates, ratings), quiet chrome, prose at the foot
(now a taste mark).
Redesign: masthead stays serif greeting; plates become **full-bleed collage
cards** — garment cutouts composed larger, name set on the plate, weather
mark integrated; swipe between the three as a carousel with page dots
(alternative: stacked with parallax — artifact decides). "Wear this" as the
one filled CTA per plate with success haptic + a small celebration on log.
Context editor (weather/occasion) as a chip row, not a form. Taste mark and
invite line stay as the designed footer.
Keep: zero-AI ordinary mornings, deterministic names, wear→rating sheet flow
as shipped.

**12 · Reveal**
Role: the magic moment after The Ten — outfits made from your ten pieces.
Route: `reveal.tsx`.
Today: good; the count lands, then a paywall placement (dismissible, correct).
Redesign: make it cinematic — count-up of the outfit number in serif at
display scale, plates cascading in staggered, then the (existing, non-gated)
membership moment. This is the app's trailer; the artifact should treat it
like one.
Keep: dismissal lands on Today with free tier intact (D2 — load-bearing).

**13 · Wear confirm (rating + favorite sheet)**
Role: log today's outfit. Today: functional sheet, shipped this week.
Redesign: bigger — outfit image at top, name in serif, stars as generous
44pt targets with selection haptics, favorite as a heart that fills warm,
one filled "Log this outfit". Success: notification haptic + the sheet
settles into the diary.
Keep: unrated is legal (skip), cancel writes nothing, atomic wear semantics.

**14 · Closet**
Role: everything you own. Route: `(tabs)/closet.tsx`.
Today: masthead + category grid; the capacity colophon now carries a plans
door.
Redesign: tighter image grid (2.5–3 columns, minimal gutters, cutouts on
tray wells), category chips horizontally scrollable with counts, **Most
worn / Favorites rails surfaced at top** (mirroring Profile), capacity as a
designed progress band rather than a text line. Add-piece as a persistent
filled FAB-style button if the artifact wants one (circle is legal).
Keep: 10-piece free wall semantics, storage boundary, multi-select gestures.

**15 · Item detail**
Role: one garment's life. Route: `item/[id].tsx`.
Today: photograph, stats, maintenance rows — recently decluttered.
Redesign: hero cutout large on paper, stats as a designed band (worn ×,
cost-per-wear, last worn) in the area accent, "wears well with" as an
image rail, maintenance/lending as compact rows below. Lending switch keeps
its invite line.
Keep: price semantics (user-entered only), borrow privacy.

**16 · Stylist**
Role: the AI stylist chat (5 chats Standard / unlimited Pro).
Route: `stylist.tsx`.
Today: opening doors + chat; membership line for free users shipped today.
Redesign: opening becomes four **image-led door cards** (not text rows);
answers render garment suggestions as tappable plates inline in chat;
composer stays minimal. Standard users see a quiet chats-left mark (from
plans.ts) once they're inside their allowance's back half.
Keep: quota flow (402 → upgrade, 429 → resets), no invented garments claim
in behavior even though the subtitle is gone.

**17 · Explore (Daily Social)**
Role: what your circle wore. Route: `(tabs)/explore.tsx`.
Today: feed + finite end; correct and quiet.
Redesign: entries as larger look cards (photo-first, reaction as one warm
tap target with haptic), the caught-up ending as a designed mark, friend
management reachable but not competing. New-since-visit divider stays.
Keep: off-by-default sharing, seven-day window, reaction privacy (owner
only), no counts anywhere public.

### Onboarding & system (P2)

**18 · Welcome / Sign-in** — first impression. Redesign: garment collage or
full-bleed imagery behind the serif promise ("Three outfits for today — from
clothes you already own."), Apple sign-in prominent, email secondary. Keep:
both auth paths, the positioning line verbatim.

**19 · Email + code + name** — the auth run. Redesign: consistent large serif
prompts, generous code boxes (keyboard handling shipped today), one filled
CTA per screen, progress feeling. Keep: resend/cooldown logic, error states.

**20 · Tour** — the first-run walkthrough. Redesign: image-led frames over
text; three beats max; skippable always. Keep: skippability, no permission
asks inside the tour.

**21 · The Ten** — the ten-slot grid. Redesign: the grid is the hero; slots
as warm tray wells with settling photographs (shipped); count as a designed
progress band; the no-room plate (shipped) restyled to match. Keep: slot
replacement flow, storage-full doors.

**22 · Capture** — camera + batch review. Redesign: viewfinder chrome minimal;
batch review as large cutout cards with keep/fix/drop as big tinted buttons
with haptics; settled state celebrates ("10 pieces in"). Keep: listing-offer
oxblood moment, invite line condition, permission fallbacks.

**23 · Add clothes (choice)** — photograph vs describe vs voice. Redesign:
three equal designed door cards with imagery. Keep: equal-doors rule, voice
consent line verbatim (names the transcription service — legal).

**24 · Voice walkthrough** — Redesign: the spoken examples as the visual body
(shipped direction), larger, with a live waveform during recording. Keep: the
consent sentence, permission timing.

**25 · Storage** — off-season pieces. Redesign: same grid language as Closet
at lower emphasis; restore flow celebrated lightly. Keep: free-tier
active/stored arithmetic.

**26 · Gap feed / shop** — what one more piece unlocks. Redesign: gap cards
led by the outfit-you-can't-make imagery; product suggestion (when served) as
a designed product card with merchant mark; "See plans" placement as shipped.
Keep: merchant allowlist, no-qualifier silence, affiliate link rules
(no user identity on clicks).

**27 · Groups + group room** — private circles. Redesign: room as a table —
member avatars prominent, invitations as warm bands, the roster grammar
(who may see what) preserved exactly. Keep: all Private Circles privacy
refusals (removal anonymity, no roster leaks).

**28 · Activity** — the inbox. Redesign: rows with avatar + one designed
sentence + warm unseen dot; the colophon footer (shipped) stays. Keep:
recipient-only model, no counts, 30-day retention line.

**29 · Settings** — administration. Redesign: cards with clear grouping,
invite row (shipped) styled as a designed row; membership row prominent for
paying members. Keep: every existing capability reachable.

**30 · Manage membership** — Redesign: the typographic masthead (shipped
today) plus plan cards with tinted fills per tier and honest deltas; upgrade
CTA filled. Keep: no prices typed into layouts (StoreKit/Superwall renders
prices), no fake trial copy. Note: the **paywall itself** is a Superwall
document (254200) — redesigning it happens in the Superwall editor, not in
app code; flag desired changes separately and they can ship instantly
without an OTA.

---

## 4 · Wave plan

| Wave | Pages | Gate |
|---|---|---|
| 1 | 1–10 (Plan/calendar, events, trips ×3, Profile, Friends, People Search + bug, Share) | Founder approves artifacts → fleet builds → OTA → founder on-device sign-off |
| 2 | 11–17 (Today, Reveal, Wear, Closet, Item, Stylist, Explore) | same |
| 3 | 18–30 (onboarding + system) | same |

Wave 1 contains one **new route** (Trips list) and one **live bug**
(People Search overlap — reproduce on simulator at current update before
redesigning, so the fix is verified, not assumed).

## 5 · What the founder supplies per wave

1. Run the wave's briefs through Claude Design (directly or via a Cowork
   agent — each brief above is written to be pasted as-is). Ask it for every
   state: default, empty, loading, error, AX3 type, and keyboard-open where
   relevant.
2. Drop the finished artifacts (HTML + PNGs) into
   `design-refs/redesign-2026-08/<page>/`, or paste them into the chat.
3. After each OTA: open the app twice, walk the wave's pages, and give a
   punch list or sign-off. The next wave starts on sign-off, not on silence.
