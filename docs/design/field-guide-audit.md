# Field guide audit — spec vs. shipping app

Audited 2026-08-06 against `Cinch.dc.html` ("the field guide", sections 01–10) and
`src/` at `3be123e`. Read-only audit; no application code was changed.

---

## 1. Verdict

**Yes — the app already looks like the renderings, considerably more than a
normal spec-vs-build comparison would predict.** The field guide is not an
aspiration the app is chasing; it is the document the app was built from, and in
most places it was built from it literally. The palette in `src/theme/tokens.ts`
is the guide's palette to the hex (`#FBFAF6`, `#1C1A16`, `#6E2B2B`, `#6B665C`,
`#8A8578`). The type system is the guide's two families, Instrument Serif and
Helvetica Neue, on a real computed line-height scale in `tailwind.config.js`.
Whole strings are verbatim: *"I can't style what I can't see"*, *"An empty
rail"*, *"Nothing today feels right — and I won't pretend it does."*, *"Styled by
Cinch — from clothes I already own."* The welcome screen is a near-pixel
transcription of frame 01c-i, down to the italic oxblood "own closet". Today
implements all four documented states — normal, empty closet, nothing works,
offline — which is more than most shipped apps manage.

Where it diverges, it usually diverges **deliberately and forward**. Three
decisions post-date the guide and are recorded in code comments and commit
messages: outfits render as an overlapping body-ordered *stack* rather than the
guide's row of four flat tiles (`e31278f`); the Closet became a
profile-as-closet from a later founder mock rather than the guide's
chips-and-grid (`bf6287f`); and buttons are 12px rounded rectangles, not the
guide's capsules, because `tailwind.config.js` rules that "the pill is a
consumer-app signature". Those are the app being *ahead* of the spec. I would
not reverse any of them.

The real gap is not fidelity — it is **the states the guide never drew**. The
guide documents empty and loading well and the app honoured that; but the app has
**45 bare `ActivityIndicator` spinners against exactly one designed skeleton**,
and only **three** files in the entire `src/app` tree check `isError`. The
consequence is systemic and worse than ugly: **a failed fetch is displayed as a
successful empty result** in at least eleven places. A failed closet query on
Item detail says "This piece is no longer in your closet." A failed review queue
says "Nothing to review." A failed friends query says "No friends yet." A failed
blocked-users query says "No one is blocked" — which on a moderation surface
tells a user her blocks have vanished. There is also no network detection
anywhere; Today infers offline from the weather fetch failing, and no other
screen has an offline story at all. That is precisely the founder's "versatile
and moving properly" concern, and it is where the work is.

The social screens are visually consistent with the rest of the app — they use
the shared `Text` variants and design tokens throughout — but they are the
thinnest on states and carry the most internal drift (six hand-copied back
buttons, five copies of `initialsFor`, four avatar sizes, three hairline
spellings). The field guide covers only one of the nine social screens, so most
of what is listed there is internal consistency, not spec divergence.

**One functional bug found in passing, worth escalating outside this audit:**
`src/features/event-outfits/mutations.ts` L32-33 maps SQLSTATE `42501`
unconditionally to *"Join the event first."*, but per
`src/features/auth/use-social-terms.ts` L95-97 the social-terms gate refuses
with the same code — so a first-time poster who has not accepted the terms is
told to join an event she is already in.

---

## 2. Per-screen summary

| # | Screen / state | Exists? | Gap | One line |
|---|---|---|---|---|
| 01 | Welcome · lookbook | Yes | **COSMETIC** | Near-pixel transcription; hero tiles are still gradient placeholders, no scrim |
| 02a | Today · normal | Yes | **COSMETIC** | Deliberate stack-not-flat-row; everything else matches |
| 02b | Today · empty closet | Yes | **NONE** | Verbatim copy, dashed tray, ink CTA |
| 02c | Today · nothing works | Yes | **COSMETIC** | Present and honest; reasoning is generic where the spec is specific |
| 02d | Today · offline | Yes | **COSMETIC** | Full composition present; trigger is a weather-failure proxy, not real network state |
| — | Today · loading | Yes | **STRUCTURAL** | Bare spinner where every sibling state got a designed composition |
| 03a | Closet · populated | Yes | **STRUCTURAL** | Rebuilt to a later mock; the guide's category chip row is gone entirely |
| 03b | Closet · loading | Yes | **COSMETIC** | Best loading state in the app; geometry doesn't match the grid it replaces |
| 03c | Closet · empty | Yes | **NONE** | Verbatim |
| 04 | Item detail | Yes | **COSMETIC** | Inverted CPW cell correct; missing overflow control and the "works with N pieces" line; a size class collides |
| 05a | Plan · week & events | Yes | **COSMETIC** | Adds a third Packing mode; week rows match |
| 05b | Plan · event detail | Yes | **STRUCTURAL** | Split into a hub + subroutes; "Your look", the looks grid and the stylist note are not on the page |
| 06 | Stylist | Yes | **NONE** | Beyond spec — questionnaire, quick-starts, four honest failure branches |
| 07a | Capture · in progress | Yes | **COSMETIC** | Instructional viewfinder by design, not a live camera; tray and queue states match |
| 07b | Capture · consent | Yes | **COSMETIC** | Page sheet, not a bottom sheet over dimmed camera; no grabber |
| 08 | Review | Yes | **COSMETIC** | Pips, rows and footer match; adds a Price row; no error branch |
| 09 | Profile | Yes | **NONE** | Matches, plus a social section; masthead renders blank on first paint |
| 10 | Poster / share | Yes | **COSMETIC** | 9:16 ink frame correct; garment area is a stack, not the 2×2 grid |
| — | Friends / borrowing / voting / comments | Yes | **NOT SPECIFIED** | Built from `docs/social/product-spec.md`; the field guide does not draw these |

---

## 3. Per-screen detail

### 01 · Welcome — COSMETIC
`src/app/(auth)/sign-in.tsx`

Faithful to the point of transcription: the file scales every measurement off the
mock's own pixel values via `px()` at L134.

- **L43-71, L139-144** — the 2×2 hero is four Skia gradient rectangles
  (`#37342F`, `#A9B2C0`, `#BB9179`, `#F0EADE`), not garment photography. The
  guide's own note says garment blocks are placeholders to be replaced with real
  shots; on every other screen the app did replace them, and this is the one
  place the placeholder shipped. Fix: four bundled garment cutouts on ink.
- **L191-260** — no scrim. The guide puts a 180° gradient over the hero
  (`rgba(20,19,17,.5)` → transparent → `rgba(20,19,17,.9)`) so the wordmark and
  caption stay legible over any image. Survivable with flat gradients, required
  with real photos.
- **L146, L247** — the outfit micro-label is warm tan `#C7A08D`; the guide sets
  `#d8b7a6`. One-token change.
- **L268-270, L280, L295** — sheet radius 24 vs 22, overlap -22 vs -16, headline
  29 vs 27, subline 14 vs 13. Within tolerance; leave alone.
- This file bypasses the `Text` variant scale entirely (raw `RNText` + `px()`).
  Intentional and documented, but it will not follow a future type-scale change.

### 02 · Today — COSMETIC, plus a loading gap
`src/app/(tabs)/index.tsx`, `src/components/today/plate.tsx`

All four documented states exist and are separately composed — the strongest
single piece of evidence that this app was built from the guide.

- **`plate.tsx` L455-473** — the outfit renders as an overlapping Skia stack with
  one credit line, not the guide's row of four captioned tiles. Documented at
  L467-470 as a deliberate replacement. **Do not revert.**
- **`index.tsx` L433-441** — Today's loading is a bare centred `ActivityIndicator`.
  Should be a plate-shaped skeleton.
- **`index.tsx` L331-336** — `offline` is derived from `weatherFailed`. Honest and
  documented, but an offline device with a warm weather cache never shows the
  offline composition. The real fix is cross-cutting, not a Today change.
- **`index.tsx` L229-233** — the nothing-works body is generic ("One more layer,
  or a pair of shoes, usually unlocks it") where the guide is specific ("A formal
  lunch in heavy rain needs your tailored pieces, and both are in the wash"). The
  engine knows which slot failed; wiring that through closes the biggest voice
  gap on the screen.
- **`index.tsx` L522-529** — offline banner matches the guide exactly, including
  the `accentWarm` dot. No change.

### 03 · Closet — STRUCTURAL
`src/app/(tabs)/closet.tsx`, `src/components/closet/*`, `src/components/ui/skeleton.tsx`

Rebuilt from a later founder mock into profile-as-closet. Identity block, stat
trio, favourites rail and most-worn chart are all present and good.

- **The guide's category chip row is absent from the shipping screen.** The
  sticky `Tops / Bottoms / Outerwear / Shoes / Accessories` filter at guide
  L328-334 exists **only in the dev harness**, `src/app/dev-closet.tsx` L43,
  L82-104. Browsing the whole wardrobe now hides behind the search icon
  (`closet.tsx` L167-174, L198-240). `docs/design-directive.md` L52 explicitly
  asks for category browsing, so this is a gap against the brief as well as the
  guide. Minimum change: lift the chip row from `dev-closet.tsx` L82-104 into
  `closet.tsx` above the search grid and filter `visible` (L108-116) by category.
- **`skeleton.tsx` L114 vs `item-card.tsx` L51** — the skeleton cell is
  `aspect-[3/4] rounded-card` (20px); the real cell is `aspect-[4/5] rounded-lg`
  (16px). Content visibly jumps when data lands. Two-token fix.
- **`closet.tsx` L459, `item-card.tsx` L105** — `variant="stat"` is overridden
  with a second `text-*` class. NativeWind gives no precedence between two size
  utilities on one element; this is the exact hazard documented in `button.tsx`
  L18-25. Add a `statSmall` variant to `text.tsx` instead.
- **`closet.tsx` L186-197** — no `closet.isError` branch. A failed fetch renders
  `EmptyCloset` ("An empty rail"), telling a user with 200 garments her closet is
  empty.
- **`closet.tsx` L314-323** — the Edit affordance on Favourites is permanently
  disabled pending an `is_favourite` column. Documented seam; leave.

### 04 · Item detail — COSMETIC
`src/app/item/[id].tsx`

The signature element — a 2×2 stat grid with the cost-per-wear cell inverted to
ink — is correct at L158-182, including the cream label at 70% opacity.

- **L373** — `variant="stat" className="text-figure"` stacks two size classes; the
  rendered size is not guaranteed and may fall back to 20px against the guide's
  26px. Same fix as Closet.
- **L376** — stat labels are 10px `colophon`; the guide sets 8px.
- **L337-339** — the colours caption prints only colour names. The guide's half
  that carries the moat — *"works with 8 of your pieces"* — is not implemented.
  The data exists in `src/lib/color/harmony.ts`.
- **L303-307** — the guide's 13px honest commentary line ("Down from £6.50 a wear
  last winter…") is replaced by `item.description` at 17px, rendered only when
  present. The CPW trend is computable; this is the screen's best missing line.
- **L129** — the overflow "⋯" control is a bare spacer. Deliberate; leave.
- **L76-83** — a failed `useCloset` yields `undefined` and renders "This piece is
  no longer in your closet." A fetch error is not a deletion.

### 05a · Plan · week & events — COSMETIC
`src/app/(tabs)/plan.tsx`, `src/components/plan/day-row.tsx`, `src/components/events/*`

Segmented pill toggle, week range label, day rows with weather and colour
swatches all match. The app adds a third **Packing** mode, beyond spec and good.
`EventCard.tsx` follows `founder-mocks.md` L22-36 closely.

- **L251-302** — Events has a loading spinner and an empty state but **no error
  branch**; a failed `useMyEvents` renders "Nothing planned together yet".
- **L315-318** — Week's loading is a bare spinner. A failed forecast produces
  `weekDays = []` (L140-151) and the screen renders its heading and the "No piece
  worn more than twice" promise above **zero rows**, silently.
- **L211-249** — the segmented control and the New-event bar use `rounded-full`,
  contradicting `borderRadius.full` = "GLASS CHROME ONLY" (`tailwind.config.js`
  L142). It matches the guide visually, so this is a documentation inconsistency.
  Decide once and record it.
- **`EventCard.tsx` L137** — uses `border-hairline` where every other social card
  uses `border-rule`. **L24, L100** — `units` defaults to `'F'` and `plan.tsx`
  passes none, so cards render Fahrenheit. Correct for a US launch.

### 05b · Plan · event detail — STRUCTURAL
`src/app/event/[id]/index.tsx`, `src/app/event/[id]/outfits.tsx`

The header (back circle + `EVENT` colophon), title, metadata line and
Going/Invite pills match the guide. Below that the page diverges structurally:
the guide composes **one** page, the app builds a hub with subroutes.

- **`index.tsx` L302-306** — the file marks a "COMPOSITION POINT" and says the
  look boards "are reached by route, not import; swap these rows for that slice's
  inline components at integration if one page is wanted." That is exactly the
  change the guide asks for, pre-authorised by whoever wrote it.
- **Not on the page: the "Your look" card** (guide L527-537). It exists and is
  well built — `outfits.tsx` L234-280, blush surface, oxblood colophon, triptych,
  two secondary buttons — just one route away.
- **Not on the page: the "Who's wearing what" grid** with the *"4 of 6 shared"*
  counter (guide L539-558). Also exists at `outfits.tsx` L283-313. The detail
  screen has the eyebrow at L307-309 but two nav rows beneath it.
- **Missing entirely: the stylist's group note** (guide L560) — the tray-filled
  line *"Three of you are in cream. Yours reads differently with the oxblood
  scarf…"* This is the most distinctive thing on the guide's event screen and has
  no equivalent anywhere in the app.
- **`index.tsx` L253-256** — title uses `variant="display"` (40px) where the guide
  sets 27px. On a long title this crowds the metadata line. Use `title` (28px).
- **`index.tsx` L129-132** — `respond` / `leave` / `cancel` / `removeMember` have
  **no `onError` handlers at all**. A refused RSVP fails silently.
- **`index.tsx` L71** — the local `Pill` uses `rounded-full` on a content-layer
  control, so the RSVP buttons and the `rounded-md` buttons on `outfits.tsx` have
  different radii at the same visual weight.
- The guest roster (L338-361) and the coarse-before-joined privacy split
  (L180-196) are additions the guide does not cover and should keep.

### 06 · Stylist — NONE
`src/app/stylist.tsx`, `src/components/stylist/message-bubble.tsx`

Header disc, serif title, honesty subtitle, bubbles, composer and send button all
match. Beyond spec: a tappable questionnaire, quick-start rows, and four distinct
honest failure messages in `src/features/stylist/use-chat.ts` L280-286. Only gap:
a failed turn goes muted grey with no retry affordance
(`message-bubble.tsx` L131).

### 07 · Capture — COSMETIC
`src/app/capture.tsx`, `src/components/ingest/*`

Corner brackets, the "One garment, plain background" caption, the shutter row, the
light tray, the progress bar and the per-item `Cleaning…` / `Queued` / done states
are all present and correct, including the dashed queued thumb.

- **`capture.tsx` L180-182** — this is an *instructional* viewfinder, not a live
  camera; real capture runs in the system picker. Documented and sensible. Do not
  "fix" toward the guide.
- **L227-237** — the third control is "Describe", not "Flip". Correct given the above.
- **L253-259** — progress headline renders at 20px against the guide's 17px.
- **`consent-sheet.tsx` L39** — a `pageSheet` Modal over canvas, not a bottom
  sheet over a dimmed camera, and **no grabber**. The guide's version reads as a
  moment inside capture; the app's reads as a separate screen. A grabber and a
  dimmed backdrop are the cheap 80%.
- **`consent-sheet.tsx` L53, L65-78** — token circle 28px `#F1E7E4` vs guide 26px
  `#F0ECE3`; primary is a 20px-radius rect, not a capsule (house rule, keep).

### 08 · Review — COSMETIC
`src/app/review.tsx`, `src/components/review/review-card.tsx`

The uppercase `Review · n of m` header, the 16×4 pip bar with an oxblood active
pip, the serif "Is this right?", the hairline-separated rows with oxblood Edit,
and the Skip / Looks right footer all match.

- **`review-card.tsx` L359-397** — a fourth **Price** row is added. Beyond spec,
  and it feeds cost-per-wear. Keep.
- **L489-493** — "Edit" on the Colours and Details rows is decorative text, not a
  control. A coloured affordance that does nothing reads as broken. Wire it or
  drop the word.
- **`review.tsx` L153-159** — loading is a bare `Loading…` string.
- **`review.tsx` L27 + L226-239** — a failed queue fetch falls back to `[]` and
  renders "Nothing to review".

### 09 · Profile — NONE
`src/app/profile.tsx`

Avatar, serif name, "N weeks with Cinch", the "What Cinch has learned" card with
its honest three-branch sentence and progress bar, the AI toggles and the Account
group with an oxblood Delete account are all as drawn. The consent switch
correctly withholds itself behind a spinner rather than guessing (L420-422).

- **L178-184** — `name` and `weeksLabel` fall back to `''`, so the masthead renders
  blank on first paint rather than skeletal.
- No `isError` branch on `profileHeader`, `useCloset` or `useStyleProfile`.

### 10 · Poster / share — COSMETIC
`src/components/share/plate-card.tsx`

360×640 ink frame, serif wordmark, tan uppercase date, "Today's outfit" eyebrow,
the 40px title with the trailing word in italic `#D8B7A6`, the hairline footer
with palette dots left and serif cost-per-wear right, and the exact closing line
are all correct.

- **L316-342** — the garment area is the same overlapping stack as the Today
  plate, not the guide's 2×2 grid. This is the one place I would consider
  following the guide: a poster is a static composition seen at thumbnail size in
  a feed, where four separated tiles read faster than an overlapping stack. Worth
  an A/B, not an automatic change.
- **L109-113** — the title split takes the *last* word rather than the second.
  Identical for two-word names, wrong for three.

### Social — NOT SPECIFIED by the field guide

The field guide covers **only** frame 05b (event detail). It has no frame for
voting, comments, the post composer, friend discovery, friend closets, or
borrowing, and `docs/social/founder-mocks.md` itself only covers the Plan tab,
event detail and the closet profile. **I am not inventing spec requirements for
screens the spec does not draw.** What follows is internal consistency and state
coverage only.

On their own terms these screens are visually of a piece with the rest of the
app: they use the shared `Text` variants throughout (`label` 30×, `caption` 28×,
`colophon` 18×, `eyebrow` 15×) and the design tokens rather than raw hex.
`PostComposer.tsx` and `BorrowRequestRow.tsx` are the best-behaved components in
the codebase. The problems are:

**States.** Only two social files read `isError` — `event/new.tsx` L357 and
`event/[id]/invite.tsx` L82. Everywhere else a failed query falls through to the
empty branch:

| Screen | A failed fetch renders as | Line |
|---|---|---|
| `event/[id]/index.tsx` | "This occasion isn't available." (reads as deleted) | L172 |
| `event/[id]/outfits.tsx` | "Be the first to the mirror…" | L292-294 |
| `event/[id]/post.tsx` | "No saved looks yet" | L96-102 |
| `event/[id]/comments.tsx` | "Nothing yet…" | L160-164 |
| `friends/index.tsx` | "No friends yet…" | L277-278 |
| `friends/[userId].tsx` | "Nothing to show" | L216-220 |
| `borrow.tsx` | "Nothing on loan" | L120-126 |
| `BlockedList.tsx` | "No one is blocked." | L52-55 |

Two are worse than a wrong message. **`borrow.tsx` L119** guards its `EmptyState`
with `!threads.isLoading && all.length === 0`, so during the initial load the
`else` branch runs and the user sees *"No one has asked for anything."* before
the data arrives. **`BlockedList.tsx` L47** returns `null` while loading, inside a
card wrapper that `friends/index.tsx` L300-305 has already drawn — an empty
bordered box under a heading.

**No offline coverage at all.** No social file references connectivity or
`EmptyState`'s `tone="blocked"`, which `empty-state.tsx` L14-19 exists precisely
to serve.

**Loading is a spinner or a sentence, never a shape.** Bare `ActivityIndicator` in
`event/[id]/index.tsx` L163, `outfits.tsx` L184, `post.tsx` L92, `comments.tsx`
L154, `invite.tsx` L96. Text-as-loading in `friends/index.tsx` L274 ("Reading
your circle…") and L213, and `friends/[userId].tsx` L207. **`Skeleton` is
module-private** — `skeleton.tsx` L36 does not export it, so no social screen
*could* use it without an export change. That single line blocks the whole fix.

**Duplication.** Six hand-copied circular back buttons (`event/new.tsx` L166,
`event/[id]/index.tsx` L239, `outfits.tsx` L211, `post.tsx` L80, `comments.tsx`
L130, `friends/index.tsx` L162, `friends/[userId].tsx` L182, `borrow.tsx` L101),
all identical to `item/[id].tsx` L120. Five copies of `initialsFor`
(`EventCard.tsx` L49, `RosterRow.tsx` L8, `invite.tsx` L15, `ProfileRow.tsx` L21,
`OutfitPostCard.tsx` L77) across four avatar sizes (24/28/32/44) and three colour
schemes. Three hairline spellings (`h-px bg-hairline`, `h-hair bg-hairline`, the
shared `Rule`), none of them consistently the shared component. `invite.tsx`
L106-155 hand-writes a candidate row that is a near-duplicate of `RosterRow`, and
renders it directly above real `RosterRow`s on the same screen.

**Off-token values**, in full:

| Value | File:line | Note |
|---|---|---|
| `'#F7EDE8'`, `'rgba(176,138,118,0.45)'` | `outfits.tsx` L42-43 | knowingly local; promote to a `blush` token |
| `'rgba(28,26,22,0.4)'` | `friends/[userId].tsx` L254 | `theme.ink` @40%, typed by hand |
| `'#1C1A16'` | `OutfitPostCard.tsx` L178 | `theme.ink` |
| `'rgba(251,250,246,0.7)'` | `VotePill.tsx` L79 | `theme.canvas` @70%; `chip.tsx` L49 solves this as a template literal |
| `fontSize: 15` | `friends/index.tsx` L192, `friends/[userId].tsx` L283 | not on the 17/16/13/11 scale |
| `px-8` | `social-terms-sheet.tsx` L66 | the only one in the app; gutter is 20 |
| `min-w-24` | `event/new.tsx` L235, L253, L318 | the only uses in the app |
| `rounded-full` on a content control | `event/[id]/index.tsx` L71 | config says GLASS CHROME ONLY |
| `rounded-card` (deprecated alias) | `event/new.tsx` L161, `invite.tsx` L78, `VenueCard.tsx` L30 | marked transitional at `tailwind.config.js` L143 |

**Two house rules broken.** `invite.tsx` spends the accent twice on one screen
(`Done` L62 and every `Invite` L150) against the one-oxblood-action rule.
`social-terms-sheet.tsx` L102-115 hand-rolls its primary button 20px taller, 8px
rounder, ink instead of accent and one type step smaller than every other primary
in the app.

**Empty-state type scale is split.** `EmptyState` bodies are 17px
(`empty-state.tsx` L54); the hand-rolled empties in `friends/index.tsx` L213/L274,
`borrow.tsx` L75, `BlockedList.tsx` L52 and `invite.tsx` L160/L165 are 11–13px.
Both appear on the same route in `borrow.tsx`.

---

## 4. Dispatch plan

Six batches. **Every file appears in exactly one batch.** Batch 1 owns all shared
primitives, so no other batch may edit anything under `src/components/ui/`,
`src/theme/`, or `tailwind.config.js` — they consume the new exports by name.
**Batch 1 must land before batches 2–6 start**, because three of them depend on
`Skeleton` being exported and on `ErrorState` existing. Batches 2–6 are mutually
independent and can run fully in parallel.

> ### Coordination hazard — read before dispatching
> `git status` shows `src/components/social/social-terms-sheet.tsx` and
> `src/features/auth/use-social-terms.ts` as **untracked**, alongside two
> unapplied migrations (`20260808101000_social_terms_gate.sql`) and
> `supabase/tests/08_ugc_moderation.sql`. The concurrent session on the other
> branch is evidently mid-way through wiring the social-terms gate. Neither file
> is assigned to any batch below, and **no agent should touch them or
> `src/features/event-outfits/mutations.ts`** until that session lands. The
> 42501 mis-mapping noted in §1 is almost certainly what that work is fixing —
> raise it with that session rather than patching it here.

### Batch 1 — Shared primitives, tokens and the states kit *(must land first)*
**Owns exclusively:**
- `src/components/ui/text.tsx`
- `src/components/ui/skeleton.tsx`
- `src/components/ui/empty-state.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/chip.tsx`
- `src/components/ui/rule.tsx`
- `src/theme/tokens.ts`
- `tailwind.config.js`

Work: **export `Skeleton`** (currently module-private at `skeleton.tsx` L36 — this
one line blocks every other batch's loading work) and add `PlateSkeleton`,
`ListSkeleton` and `RowSkeleton` alongside `ClosetGridSkeleton`; fix the closet
skeleton's geometry to `aspect-[4/5]` / `rounded-lg` to match `item-card.tsx`
L51; add an `ErrorState` sibling to `EmptyState` (title / body / retry, reusing
`tone="blocked"` styling); add a `statSmall` text variant so no consumer stacks a
second `text-*` class; add a `ScreenHeader` primitive carrying the circular back
button that eight screens have hand-copied; add an `initialsFor` helper and a
single `Avatar` with a size prop; promote `#F7EDE8` to a `blush` token and
`rgba(28,26,22,0.4)` to a `scrim` token. Resolve and document the `rounded-full`
vs "glass chrome only" contradiction.

### Batch 2 — Today, Closet and Item detail
**Owns:** `src/app/(tabs)/index.tsx`, `src/app/(tabs)/closet.tsx`,
`src/app/item/[id].tsx`, `src/components/today/plate.tsx`,
`src/components/today/garment-cell.tsx`, `src/components/today/reaction-bar.tsx`,
`src/components/today/weather-strip.tsx`, `src/components/today/cost-per-wear.ts`,
`src/components/closet/closet-grid.tsx`, `src/components/closet/item-card.tsx`,
`src/components/closet/plate-thumb.tsx`

Work: restore the category chip row on Closet (lift from `src/app/dev-closet.tsx`
L82-104 — **read only, that file belongs to no batch**); plate-shaped skeleton for
Today's loading; `isError` branches on `useWardrobe` and `useCloset` so a failed
fetch never says "An empty rail" or "no longer in your closet"; adopt `statSmall`;
drop item stat labels to 8px; add the colour-harmony "works with N of your
pieces" line and the cost-per-wear trend sentence; give the nothing-works card the
engine's actual failure reason.

### Batch 3 — Plan tab and the events list
**Owns:** `src/app/(tabs)/plan.tsx`, `src/components/plan/day-row.tsx`,
`src/components/events/EventCard.tsx`, `src/components/events/RosterRow.tsx`,
`src/components/events/VenueCard.tsx`

Work: error branches for `useMyEvents`, `useEventInvites` and the week forecast;
replace the three bare spinners with the new skeletons; make an empty week say why
it is empty rather than rendering a heading over nothing; `EventCard` to
`border-rule`; `VenueCard` off the deprecated `rounded-card`; `RosterRow` to the
shared avatar and a ghost `Button` for Remove.

### Batch 4 — Event detail, look boards, voting and comments
**Owns:** `src/app/event/_layout.tsx`, `src/app/event/new.tsx`,
`src/app/event/[id]/index.tsx`, `src/app/event/[id]/outfits.tsx`,
`src/app/event/[id]/post.tsx`, `src/app/event/[id]/comments.tsx`,
`src/app/event/[id]/invite.tsx`, `src/components/event-outfits/OutfitPostCard.tsx`,
`src/components/event-outfits/VotePill.tsx`,
`src/components/event-outfits/CommentRow.tsx`,
`src/components/event-outfits/PostComposer.tsx`

The one batch with real composition work. Pull the guide's "Your look" card and
the "Who's wearing what" grid onto the event page at the COMPOSITION POINT
(`event/[id]/index.tsx` L302-306, using the components already built in
`outfits.tsx` L234-313); drop the title from `display` to `title`; add the
stylist's group note; give the four RSVP mutations `onError` handlers; replace the
local `Pill` with the shared `Button`; adopt the `blush` token; delete the
duplicate candidate row in `invite.tsx` in favour of `RosterRow`; fix the
double accent spend on `invite.tsx`; add `isError` branches throughout.
**Do not touch `src/features/event-outfits/mutations.ts`** — see the hazard note.

### Batch 5 — Friends, friend closets and borrowing
**Owns:** `src/app/friends/_layout.tsx`, `src/app/friends/index.tsx`,
`src/app/friends/[userId].tsx`, `src/app/borrow.tsx`,
`src/components/social/ProfileRow.tsx`,
`src/components/social/FriendItemCard.tsx`,
`src/components/social/BorrowRequestRow.tsx`,
`src/components/social/BlockedList.tsx`

Work: fix the two false empties — `borrow.tsx` L119 shows "No one has asked for
anything." during the initial load, and `BlockedList.tsx` L47 returns `null`
inside an already-drawn card; add `isError` everywhere, with `BlockedList` first
(a moderation surface must never report an error as "No one is blocked");
replace text-as-loading with skeletons; move the two `fontSize: 15` inputs onto
the type scale; adopt the shared avatar and `scrim` token; raise hand-rolled
empty copy from 11px to the `EmptyState` scale.
**Do not touch `src/components/social/social-terms-sheet.tsx`** — see the hazard note.

### Batch 6 — Welcome, capture, review, stylist, profile, share
**Owns:** `src/app/(auth)/sign-in.tsx`, `src/app/capture.tsx`,
`src/app/review.tsx`, `src/app/stylist.tsx`, `src/app/profile.tsx`,
`src/components/ingest/consent-sheet.tsx`,
`src/components/ingest/upload-queue-list.tsx`,
`src/components/ingest/garment-search-sheet.tsx`,
`src/components/review/review-card.tsx`,
`src/components/stylist/message-bubble.tsx`,
`src/components/share/plate-card.tsx`

Work: real garment images plus a scrim on the welcome hero; grabber and dimmed
backdrop on the consent sheet; error branches for the review queue and the profile
header; a skeletal rather than blank profile masthead; a retry affordance on a
failed stylist turn; either wire or remove the decorative "Edit" labels on the
review card.

### Not batched — decide separately
`src/app/_layout.tsx` and `src/lib/query-client.ts`: wiring NetInfo into TanStack
Query's `onlineManager` so offline becomes a real signal rather than Today's
weather-failure proxy. It changes every batch's assumptions about what an error
means, so it should land on its own — before or after the six, never alongside.

---

## 5. What in the spec should NOT be implemented

1. **The flat 4-tile outfit row (frames 02a, 02d).** The app's overlapping
   body-ordered stack (`plate.tsx` L455-473) reads as a dressed figure rather than
   a row of parts, and it is the app's signature. The guide predates it. Keep it.

2. **Capsule buttons everywhere.** The guide sets 20–30px radii on every button.
   `tailwind.config.js` L134-141 rules that capsules belong to the glass chrome
   layer only and content controls are 12px rectangles, citing SSENSE, Mytheresa
   and Vestiaire. That is a stronger position than the guide's. Keep rectangles —
   and fix the places that drifted back to `rounded-full` rather than spreading it.

3. **The drawn tab bar** (uppercase tracked labels with an oxblood dot). The app
   uses the native Liquid Glass `NativeTabs` with SF Symbols
   (`src/app/(tabs)/_layout.tsx`). The glass material and minimize-on-scroll are
   unfakeable in JS and worth far more than label tracking. Keep native.

4. **A live camera preview in Capture.** The guide draws one; real capture runs
   through the system picker for permissions and quality (`capture.tsx` L180-182).
   Do not rebuild a custom camera to match a drawing.

5. **The guide's chips-and-grid Closet as a whole.** Profile-as-closet came from a
   later founder mock and carries the social layer's identity requirement. Only
   the *category chip row* should come back — not the layout around it.

6. **£ and °C.** The guide is set in sterling and Celsius; the app ships USD and
   Fahrenheit. Locale, not design.

7. **"Mara Ellis" and the sample data.** The app is deliberately honest about an
   unknown name (`index.tsx` L79-83, L94-117) rather than inventing one. The
   guide's populated numbers are mockup furniture.

Three places where the app has evolved *past* the guide and should be recognised
rather than re-specced: the reaction bar's pending / failed / retry states
(`reaction-bar.tsx` L120-174); the stylist's four distinct honest failure messages
(`use-chat.ts` L280-286); and the event screen's coarse-before-joined privacy
split (`event/[id]/index.tsx` L180-196). None is drawn in the guide, and all three
are better than what is.
