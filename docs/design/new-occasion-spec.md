# New occasion redesign — build spec

Source of truth: the founder's **New Occasion State Atlas** (`NewOccasionAtlas.zip` →
`New Occasion State Atlas.dc.html`, states N-01…N-11), archived beside this file
at `new-occasion-atlas/` with the three PNG renderings under `renderings/`.
This spec transcribes it into build instructions against the real codebase.
Where the atlas and this doc disagree, the atlas wins. Where the atlas is
silent, current shipping behavior wins; where the atlas is silent and nothing
ships, this doc says so explicitly and marks the addition.

**Scope**: `src/app/event/new.tsx` (rebuilt from scratch), new occasion-only
components under `src/components/events/`, the events data layer, one migration,
and a *scoped* pass on `src/app/event/[id]/index.tsx` (§8). The outfit board,
comments, roster and `VenueCard` keep their current design and behavior.
`components/ui/*` may gain **additive props only** — no signature changes, no
call-site churn.

---

## 0. Founder decisions taken on this pass (2026-08-08)

1. **Detail page**: scoped adoption (§8), not a full N-09/N-10 rebuild.
2. **Where**: gazetteer place search via the Open-Meteo geocoder already in the
   repo. Venue-level POI search (MKLocalSearch) is native and cannot ride OTA —
   deferred, and the atlas's own "Use as typed" row is the designed fallback.
3. **N-09's look-card promise** ("Cinch can pull three from your closet that
   read cocktail…") is a capability the app does not have — picking a look is
   manual selection from saved outfits. The card keeps the atlas's geometry and
   gets honest copy (§8.5).
4. **Dropped from the form**, confirmed: occasion type, party size, visibility
   picker, reservation link, multi-day/travel. Columns stay; existing occasions
   keep their values and still render.
5. **`starts_at` becomes nullable** (§2) so a name-only occasion — the atlas's
   central premise — is actually storable.

---

## 1. Palette / type mapping

Every hex in the atlas is already a token. Use tokens and variants, never
literals.

| Atlas value | Token / variant |
|---|---|
| `#FBFAF6` screen ground | `canvas` |
| `#FFFFFF` sheet + plate ground | `surface` |
| `#1C1A16` | `ink` |
| `#6B665C` | `muted` |
| `#8A8578` placeholder only | `faint` (see below) |
| `#C7C1B4` unpickable calendar days | `ghost` (see below) |
| `#6E2B2B` | `accent` |
| `#E7E2D6` disabled button fill | `sand` (`#EAE5DB`, Δ≤5/255 — mock drift) |
| `#A9A296` disabled button label | `byline` (`#A29C90`, Δ≤7/255 — mock drift) |
| `rgba(28,26,22,.09)` | `hairline` |
| `rgba(28,26,22,.12)` | `rule` |
| `rgba(28,26,22,.28)` answered field border | **new token `rule-strong`** (§3.1) |
| 12px radius on every control | `md` / `chip` |
| 16px radius, note plate | `lg` |
| 20px radius, cards | `plate` |

Type: `Instrument Serif` = `font-display`/`font-title`, already loaded.
Eyebrows are `variant="eyebrow"` (11px / 1.6px tracking / uppercase / muted) —
an exact match for the atlas. Running secondary prose is `note` (13px regular)
or `noteSmall` (11px regular): **never `label`/`caption`, which are
`font-medium` and render this copy as bold grey.**

### Settled conflicts — do not relitigate

These follow the precedents fixed on the Stylist page (2026-08-07):

- **Body text stays 17px.** The atlas draws control text at 15px, which is
  browser-mock default. Field text, button labels and the detail metadata line
  are `body` (17). Chip labels stay `label` (13) — the app has two control-text
  sizes where the atlas has one, and collapsing them would be drift, not a
  system change.
- **`faint` and `ghost` lose to `muted` on small text.** `faint` is 3.52:1 on
  canvas and `ghost` is ~1.9:1 — both AA failures for content. So the atlas's
  `#C7C1B4` "Optional" markers are set in **`muted` at `noteSmall`**, kept
  quieter than the neighbouring eyebrow by weight and casing rather than by
  contrast. Two exemptions, both legitimate: **placeholder text** keeps `faint`
  (the app-wide convention, and iOS's), and **unpickable past calendar days**
  keep `ghost` (a disabled control, which WCAG exempts).
- **No capsules on labelled controls.** No conflict here — the atlas draws 12px
  radius throughout, which is `md` exactly. `rounded-full` appears only on the
  selected-day circle, a 1:1 box, which is allowed.
- **Never stack two utilities of the same kind.** Two `text-*` colours, two
  sizes, or `font-medium` over `font-body` resolve by key order in
  `tailwind.config.js`, not by intent. Name a variant, or set the colour with an
  inline `style` — the sanctioned escape hatch used by `button.tsx`/`chip.tsx`.
- **`trim` + `mt-*` on one `<Text>` cancels to ~0 margin.** Put the spacing on
  the *preceding sibling* as `mb-*` and leave the trimmed Text margin-free.

### Deviations this page takes, and why

- **Field border ramp** (`rule` → `rule-strong` → 1.5px `ink`). Not drift: the
  atlas argues it in prose — "Answered fields darken their border rather than
  growing a checkmark." A designed state, so it earns a token.
- **Discard is `accent`, not `critical`.** The atlas draws N-08's destructive
  button in oxblood. Atlas wins on exact values.
- **Dress-code chips are 44pt of real height**, not the Chip's default 32 +
  hitSlop. The atlas argues this one too: "44pt of real geometry, wrapped, never
  a scrolling row that hides the fourth option."
- **Screen title is `colophon` (10px), not the atlas's 11px.** Every other
  screen title in the app is `colophon`; a 1px difference is mock jitter and app
  consistency wins.
- **Detail-page occasion title is `display` (40px).** The atlas draws 36 (N-09)
  and 32 (N-10) — the scale has no such step and the atlas disagrees with
  itself, so the intent (make the name the page's hero) maps to the nearest
  step up from today's `title` (28).

### Three drawn values the reface (2026-08-17) had to give up, and why

Each was measured against real Helvetica Neue on the 393pt design width before
it was changed; the arithmetic lives in the code beside the fix, and the
thresholds are pure functions in `src/features/events/new-layout.ts` so they can
be called from a test rather than sat in markup as constants.

- **The time control's `118` is a `minWidth`, not a `width`** (§3.2). A fixed
  width is a promise about how wide a formatted time is, and `12:30pm` breaks it
  at fontScale **1.35** — the top of the *standard* Dynamic Type range, reached
  without touching an accessibility size. 118 survives as a floor, so the row is
  drawn exactly as accepted at the default size; above `AX_STACK_SCALE` (1.5)
  the two controls stack, which is the same threshold the closet already uses
  for labelled controls that stop fitting one measure.
- **The place row stacks its name over its locality** (§5). Drawn inline, the
  two shared 319pt and `The Stanley Hotel & Concert Hall` + `Estes Park` needed
  319.1 at the DEFAULT size and 568.1 at the top of the scale. Because React
  Native defaults `flexShrink` to 0 the name never ellipsised — the row grew and
  the panel's `overflow-hidden` cut it off with nothing to show for it. Stacking
  follows `EventCard`'s settled refusal to clamp a venue name at all.
- **The counter is `N left`, and the note placeholder loses its second clause**
  (§3.2). `Names cap at 60 characters — 4 left.` measured 389.7pt against a
  353pt page and wrapped to two lines; the cap it announced was already being
  enforced at the keyboard. The name placeholder drops to two examples for the
  same measured reason: a single-line `TextInput` scrolls its placeholder rather
  than wrapping it, so three ran off the end of the first field on the page.

---

## 2. Migration — `starts_at` becomes nullable

New file, `supabase/migrations/<timestamp>_events_optional_date.sql`. A
name-only occasion is the atlas's central premise (N-10: *"No date yet. Add one
and Cinch can read the weather and plan a look for it."*), and `starts_at
timestamptz not null` makes it unstorable.

```sql
alter table events alter column starts_at drop not null;
```

Three things depend on the column being present and must move with it:

1. **`enforce_event_limit()`** (`20260807103000_social_views_grants_realtime_limits.sql:251`)
   counts active events with `coalesce(ends_at, starts_at + interval '6 hours') > now()`.
   A dateless occasion has no expiry, so it must count until it is dated:
   `coalesce(ends_at, starts_at + interval '6 hours', 'infinity'::timestamptz) > now()`.
   Recreate the function in full — do not leave the old body in place.
2. **The Plan list window** (`src/features/events/queries.ts:91`) —
   `.or('starts_at.gte.<today>,ends_at.gte.<today>')` drops dateless rows.
   Add `starts_at.is.null` to the disjunction.
3. **Ordering** — "soonest first" must place dateless occasions **last**
   (`nullsFirst: false` on the `starts_at` order), not silently first.

The `ends_at > starts_at` CHECK stays valid: SQL comparison against NULL yields
NULL, which a CHECK treats as satisfied, and the form no longer writes `ends_at`
at all.

`supabase/tests/06_event_boundary.sql` and `09_event_block_filter.sql` seed
`starts_at` explicitly and are unaffected. **Add** a pgTAP case asserting a
dateless event inserts, counts against the host limit, and is visible to its
host.

**The migration is not applied to production without the founder's explicit
go-ahead.** Write it, run it locally, and stop.

---

## 3. Form anatomy — N-01, N-02

`SafeAreaView edges={['top']}` on `canvas` → header → `KeyboardAvoidingScreen`
wrapping a `ScrollView` of fields plus a **docked footer**. The atlas pins the
button to the bottom of the frame (`margin-top:auto`, a hairline top border and
a translucent canvas ground), not to the end of the scroll — this is why the
footer is docked rather than the last child of a `KeyboardAwareScrollView`.

Page margin is `px-gutter` (20px) throughout, matching the atlas's 20px padding.

### 3.0 Header — local to this screen

`ScreenHeader` has no leading *text* button, so this screen draws its own row in
`ScreenHeader`'s geometry (`px-gutter pt-2`, items centered):

- **Left**: `Cancel`, `variant="body"` in `muted` (inline `style`, not a second
  `text-*` class), `hitSlop={8}`. Behavior in §6.
- **Centre**: `NEW OCCASION` as `variant="colophon"`.
- **Right**: a 48pt spacer so the title balances.

Below it, with `mb-*` on the header row and no `mt-*` on the Text:
`What's the occasion?` — `variant="display" trim` (40px, an exact match).

### 3.1 The field — four states (N-03)

One component, `src/components/events/occasion-field.tsx`. Every field on the
page is an instance.

- **Label row**: `variant="eyebrow"` left; when the field is optional, `Optional`
  right as `variant="noteSmall"`, baseline-aligned. The name field is the only
  one with no `Optional` — that absence is the atlas's way of showing which
  field is required, so do not add a "Required" marker.
- **Box**: height 52, `rounded-md`, `px-3.5`. Text is `variant="body"` in `ink`;
  placeholder is `theme.faint`.
- **Border states** — the whole point of the component:

  | State | Border |
  |---|---|
  | Empty | 1px `rule` |
  | Filled | 1px **`rule-strong`** (`rgba(28,26,22,0.28)`) |
  | Focused | 1.5px `ink`, horizontal padding drops to 13 so the text does not shift |
  | At cap / error | 1px `accent`, and the eyebrow turns `accent` |

  Add `rule-strong` to `tailwind.config.js` **and** `src/theme/tokens.ts`
  (`ruleStrong`) — the theme object is missing several Tailwind colours already,
  and this one is needed in JS for the focused/filled border.

- **Counter**: only when `cap - length <= 10`, as
  `Names cap at 60 characters — N left.` in `variant="note"`. Never earlier —
  *"a counter that watches from the first keystroke reads as a warning."*
  Typing past the cap is prevented at the keyboard (`maxLength`), so the field
  never rejects text already typed.

### 3.2 The five fields, in order

| # | Label | Optional | Control | Cap | Column |
|---|---|---|---|---|---|
| 1 | `NAME` | no | single-line | **60** (DB allows 80) | `title` |
| 2 | `WHEN` | yes | date button + time button, 8px gap, time fixed at 118 wide | — | `starts_at` |
| 3 | `WHERE` | yes | place field (§5) | — | `venue_name`, `venue_address`, `venue_meta` |
| 4 | `DRESS CODE` | yes | four chips, wrapped | — | `dress_code` |
| 5 | `NOTE FOR THE GROUP` | yes | multiline, min-height 58 | **280** (DB allows 1000) | `note` |

Vertical rhythm: 20px above the first field, 18px between the rest — `mt-5` then
`mt-[18px]`, or the nearest existing spacing step used consistently.

**When**: two buttons that open sheets (§4), reading `Pick a date` / `Time` in
`faint` when unset, and `Sat 9 Aug` / `4:00pm` in `ink` when set. Use
`whenLabel()` and `timeLabel()` from `EventCard.tsx` — do not re-derive the
formats. When a date is set and a resolved place carries coordinates, a forecast
line appears beneath as `variant="note"` (§7).

**Dress code**: `Casual · Smart casual · Cocktail · Black tie`, single-select and
**deselectable** — tapping the chosen chip clears it, because an occasion with no
dress code is a real answer, not an unfinished one. `flex-row flex-wrap gap-2`,
never a horizontal ScrollView. Selected fills `accent` with a canvas label. The
value stored is the display string.

**Note**: multiline, `textAlignVertical="top"`, grows with content.

### 3.3 The footer — N-07, and section 03 of the atlas

Docked, `p-gutter`, hairline top border, `canvas` ground.

The button is `<Button variant="ink" />` with a **new additive prop**
`disabledTone?: 'dim' | 'filled'` (default `'dim'` — today's `opacity-40`,
so no existing call site changes). `'filled'` renders a `sand` ground with a
`byline` label and **skips** `opacity-40`, cross-fading ground and label at
`motion.duration.base` (220ms) — which is exactly the 220ms the atlas's own
script animates at. The disabled label's contrast is below AA by design; WCAG
exempts disabled controls, and the sentence below carries the actual information
in `muted`.

Four states, in order: disabled-with-a-reason · ready · in flight · failed.

- **Disabled** (`!name.trim()`): filled tone, and beneath it, centred,
  `Give it a name and Cinch can plan it.` as `variant="note"` with
  `accessibilityLiveRegion="polite"`. Whitespace is not a name — the check is on
  the trimmed string, so a spacebar leaves the button where it was.
- **Ready**: ink ground, no helper line. The line and the fill cross-fade
  together so becoming available reads as one event.
- **In flight**: `loading` — the form beneath stays visible and locked.
- **Failed**: an 8px `accent` dot and, in `variant="note"` overridden to `ink`
  via inline `style`,
  `That didn't save. Everything you typed is still here — check your connection and try again.`
  **Nothing is cleared, and the screen is never dismissed until the server has
  confirmed the event exists.**

The helper sentence never turns red, never appears before the user has tried
anything, and never moves the button. It is present from the moment the form
opens, then leaves.

---

## 4. The sheets — N-05, N-08

The app has two sheet dialects: route-level `formSheet` (38px radius) for
screen-level sheets, and hand-built `<Modal>` for component-level ones. These
are in-form pickers, so they are hand-built `<Modal>`s following
`src/components/item/item-edit-sheet.tsx` as the template — `transparent`, a
`Pressable` backdrop, an `Animated.View` on `spring.smooth`.

Shell, shared by all three (`date-sheet`, `time-sheet`, `discard-sheet`):
full-width, `surface` ground, **24px top corners**, 1px `rule` top border,
padding `pt-3.5 px-gutter pb-6`, and a 40×4 `rule` grabber centred above the
title on the pickers. Bottom inset `Math.max(insets.bottom, 10)`.

### 4.1 Date sheet (N-05)

- Title `When is it?` — `variant="plate"` (24px, exact). `Done` on the right,
  `variant="body"` semibold in `accent`, baseline-aligned.
- **Shortcuts**, 8px gap: `Tonight` · `This weekend` · `Next week`. Default
  `Chip` size — *"the three shortcuts above the grid answer most events without
  a calendar at all."*
- **Month row — an addition; the atlas is silent.** The atlas draws one month
  with no label and no navigation, which cannot reach a date in another month.
  Add a `colophon` month/year label with two 36pt circular chevron buttons in
  `BackButton`'s grammar. Previous is disabled at the current month.
- **Weekday header**: `M T W T F S S`, `variant="noteSmall"` centred, 7 columns,
  4px gap.
- **Grid**: 7 columns, day numbers at `variant="body"`. **Past days are `ghost`
  and unpickable** — an occasion in the past is not a thing Cinch can plan a look
  for. Today, unselected, is `font-semibold`. The selected day is a 34px `ink`
  circle with a `canvas` numeral (`rounded-full` on a 1:1 box — allowed).

### 4.2 Time sheet

Same shell and title grammar (`What time?` / `Done`). A scrolling list of 30-
minute steps from 6:00am to 11:30pm — reuse the existing `TIME_STEP`/`TIME_MIN`/
`TIME_MAX` constants and `formatMinutes` from the old `new.tsx` rather than
re-deriving them. **Defaults to 7:00pm, not the current minute**; the list opens
scrolled to the selection. The selected row is `ink`-filled with a `canvas`
label.

Setting a time before a date is meaningless, so the time button is disabled
until a date exists.

### 4.3 Discard sheet (N-08)

- Title `Discard this occasion?` — `variant="plate"`.
- Body `Nothing has been shared yet — no one has seen it.` — `variant="body"` in
  `muted` via inline `style`.
- Two buttons, `flex-1`, 8px gap: `Keep editing` (`variant="secondary"`) and
  `Discard` (`variant="primary"`, i.e. `accent`).

**Only shown when a field has been touched.** An untouched form closes on Cancel
without asking — *"confirming a decision the user has not made yet is friction
dressed as care."* Track a single `touched` boolean, set by any field's first
change, not by focus.

---

## 5. Where — N-06

`src/components/events/place-field.tsx`.

The repo's venue search is parked (`VENUE_SEARCH_AVAILABLE = false`, MKLocalSearch
deferred as native). What ships is the **Open-Meteo geocoder already in the
repo** — `searchPlaces()` in `src/features/context/weather.ts`, the same vendor
as the forecast, no key and no second name in the privacy policy.

- Debounced ~250ms, minimum 2 characters, `AbortSignal` on every keystroke.
- **Results panel** below the field: 1px `rule`, `rounded-md`, rows divided by
  `rule`, row padding `py-3.5 px-4`. Each row is the place name in `variant="body"`
  followed by its region in `variant="note"`, e.g. `Denver` · `Colorado, United States`.
  `searchPlaces` must be extended to carry `admin1` — **additively**, since the
  packing flow shares it.
- **The last row is always** `Use "<typed>" as typed`, in `muted`. This is the
  escape hatch: *"a friend's flat has no listing, and an event should not be
  blocked on a geocoder agreeing it exists."*
- **A resolved pick** writes `venue_name` = place name, `venue_address` = region,
  and `venue_meta = { latitude, longitude, source: 'open-meteo' }` — the column
  is provisioned and has never been written. It carries coordinates, so it earns
  a forecast.
- **A typed value** is kept verbatim in `venue_name`, with no `venue_meta`. It
  simply doesn't carry a forecast.
- **Failure** degrades to plain text rather than blocking the form: an 8px
  `accent` dot and, in `variant="note"` overridden to `ink`,
  `Couldn't look up places just now. What you typed is kept — the occasion just won't carry a forecast.`
  **There is no retry button: the next keystroke is the retry.**

Known and accepted: the gazetteer resolves cities and landmarks, not venues, so
`The Stanley` falls into the "as typed" row. That is the atlas's own designed
fallback.

---

## 6. Behavior

- **Create** is enabled on `name.trim().length > 0` alone.
- On success, `router.replace('/event/<id>')` — **and nothing else**. The current
  `router.push('.../invite')` chase is removed: *"the form dismisses and the
  detail page is pushed under it, so Back goes to Plan and not to a form the user
  already finished."* Inviting is an action on the detail page now.
- On failure, stay put, keep every value, show the failed state (§3.3).
- **Cancel**: if `touched`, open the discard sheet; otherwise `router.back()`.
- `useCreateEvent` writes only what the form collects. `occasion`, `party_size`,
  `reservation_url`, `ends_at` are no longer sent; `visibility` is omitted and
  takes the DB default `invite_only`, the strictest option and the safe failure
  mode.
- Keep the existing `?date=YYYY-MM-DD` param seam — it already works and nothing
  uses it yet.

---

## 7. Weather

Reuse, do not reinvent. `weatherLineFor()` and `conditionWord()` live in
`src/components/events/EventCard.tsx` and already produce `Feels 75° · Clear`
exactly as drawn. `fetchForecast(lat, lng, days)` lives in
`src/features/context/weather.ts`.

A new hook, `src/features/events/occasion-weather.ts`, returns a forecast for a
date at a coordinate, and returns **nothing** unless all of:

1. a date is set, **and**
2. it is inside the 7-day window (`FORECAST_WINDOW_DAYS`, already exported), **and**
3. the place resolved and carries coordinates.

*"Outside it, nothing is printed rather than guessed."* No fallback to the user's
own location for an occasion somewhere else — that is the honesty rule the
weather module already states for the share card, applied here.

---

## 8. Detail page — scoped adoption (N-09, N-10)

`src/app/event/[id]/index.tsx`. Change the blocks below and **nothing else**.
The board, roster, `VenueCard`, comments, RSVP branches, canceled banner and
destructive footers keep their current design and behavior.

1. **Eyebrow** — the dress code, uppercased, as `variant="eyebrow"` in `accent`.
   One oxblood per screen: for an **invitee** the accent belongs to the `Join`
   button, so the eyebrow renders `muted` instead. Member view gets the accent.
2. **Title** — `variant="display" trim` (see §1 for the 36→40 reasoning),
   replacing today's `title`. Spacing goes on the preceding sibling.
3. **Metadata** — `Sat 9 Aug · 4:00pm · The Stanley, Denver` as `variant="body"`
   with `muted` set inline. The atlas's 500 weight has no 17px medium variant in
   the scale; do not stack `font-medium`.
4. **Weather** — `variant="note"` beneath, from §7's hook using **the venue's**
   coordinates when present. Retire the `TODO(SOCIAL-VENUE)` at
   `index.tsx:212-215`. When there is no venue, keep today's user-coordinate
   behavior for occasions that already shipped that way.
5. **Note plate** — new, and the first time `events.note` is ever rendered: a
   `rounded-lg border border-rule bg-surface p-4` View holding the note as
   `variant="body"` in `muted`. Renders only when a note exists.
6. **Invite friends** — a full-width `variant="ink"` Button for the host,
   replacing the `StatePill "Hosting"` + secondary `Invite` pair. Guest and
   invitee branches are untouched.
7. **`YourLookCard` empty branch only** — keep the blush treatment and the
   populated branch exactly as they are. Change the empty state to the atlas's
   shape: `Nothing picked yet` as `variant="plate"`, a `Pick a look` button, and
   **honest copy** in place of N-09's sentence. The app cannot rank looks by
   dress code and weather, so the line describes what actually happens: picking
   from looks already saved. Do not ship the atlas's sentence.
8. **N-10, the thin occasion** — when `starts_at` is null: `No date yet. Add one
   and Cinch can read the weather and plan a look for it.` as `variant="body"`
   in `muted`, then two 44pt chips, `Add a date` and `Add a place`, opening the
   same sheets the form uses (§4, §5) and writing through `useUpdateEvent` —
   which already exists and has never had a call site. Below the rule, the
   `Invite friends` button and, as `variant="note"`,
   `Friends can be invited to an occasion with no date — the details fill in later, and everyone sees the change.`
   *"The missing pieces become two quiet chips, not an error and not a checklist
   with a progress bar."*

Everywhere a date is rendered — `EventCard`, the detail metadata, the Plan list —
must survive `startsAt === null` without printing a placeholder date.

---

## 9. Additive changes to `components/ui`

Both default to today's behavior, so no existing call site changes meaning.

- **`button.tsx`** — `disabledTone?: 'dim' | 'filled'` (§3.3).
- **`chip.tsx`** — `size?: 'compact' | 'tap'`. `compact` (default) is today's
  32pt minimum; `tap` is 44pt of real height with `px-4`, for the dress-code row
  and the N-10 chips. Border and label size are untouched.

---

## 10. What is NOT in this pass

- MKLocalSearch venue POI search (native; needs a store build).
- Ranking looks by dress code and weather (a real feature, not a redesign).
- An edit screen for an occasion. N-10's two chips write through
  `useUpdateEvent` directly; a general edit form is still unbuilt.
- Any change to the outfit board, comments, roster, `VenueCard`, or the RSVP
  branches.
