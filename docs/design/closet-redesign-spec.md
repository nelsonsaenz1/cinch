# Closet redesign — build spec

Source of truth: the founder's **Closet State Atlas** (`ClosetStateAtlas.zip` →
`Closet State Atlas.dc.html`, states C-01…C-06). This spec transcribes it into
build instructions against the real codebase. Where the atlas and this doc
disagree, the atlas wins. Where the atlas is silent, current shipping behavior
wins.

**Scope**: `src/app/(tabs)/closet.tsx` and closet-only components. The data
layer (`features/closet/queries.ts`, `mutations.ts`, `use-image-urls.ts`,
`session.ts`) is **untouched**. `components/ui/*` may gain additive variants
only — no signature changes. `closet-grid.tsx` and `plate-thumb.tsx` are shared
with Plan's packing screen; if a change would alter their look there, fork a
closet-local copy instead.

## Palette / type mapping

Every hex in the atlas is already a token. Use tokens/classes, never literals:

| Atlas hex | Token |
|---|---|
| `#FBFAF6` (screen bg) | `canvas` |
| `#F0ECE3` (image wells, search field, insight card) | `tray` |
| `#F2EEE5` (secondary skeleton/ghost) | between tray and canvas — use `tray` at reduced opacity or existing skeleton tone; match `ClosetGridSkeleton` convention |
| `#1C1A16` | `ink` |
| `#6B665C` | `muted` |
| `#8A8578` | `faint` |
| `#6E2B2B` | `accent` (oxblood) |
| `rgba(28,26,22,.09)` | `hairline` |
| `rgba(28,26,22,.12)` | `rule` |
| `rgba(28,26,22,.18–.22)` | border on buttons/chips — use `rule` or existing button border convention |

Type: `Instrument Serif` = `font-display` / `font-title` (already loaded).
Numerals in the stat row are serif. Eyebrows are the existing uppercase
tracked style (11px / 1.6px tracking / muted). Body/labels are the grotesque.

## Anatomy — C-01 populated (top to bottom)

1. **Header row** — eyebrow `YOUR CLOSET` left; right: two 34px circular
   hairline-bordered icon buttons: search (magnifier), ellipsis. (Replaces any
   current header arrangement.)
2. **Identity row** — 66px circular avatar (image, `rule` border, `tray`
   fallback); name in serif 30px; sub-line 13px muted:
   `{city} · building since {Mon YYYY}` (from `useClosetIdentity`; keep current
   `handleLine` fallbacks when city/date missing).
3. **Edit profile button** — full-width, 34px tall, 10px radius, `rule`
   border, centered `Edit profile` 13px/600. Opens existing `EditProfileSheet`.
4. **Stat row** — hairline rules above and below (12px vertical padding), four
   equal columns: serif 24px figure over 9px tracked uppercase label.
   `Pieces` (items.length) · `Outfits` (`useOutfitCount`) · `Unworn` (count of
   `wearCount === 0`) · `Followers` (`useFollowerCount`). **Unworn figure is
   `accent` oxblood — the only colored number.** Followers column shown even at
   0 (only the empty state suppresses the row).
5. **Latest pieces rail** — eyebrow `LATEST PIECES` + `See all` right-aligned
   (11px muted). Cards 92×110 image (10px radius, hairline border), name 11px
   below, then either `{n} wears` (10px muted) or `NEVER WORN` in 10px oxblood
   tracked uppercase. Content: newest by `createdAt` (existing
   `latestPieces`). `See all` scrolls to / focuses the full grid (acceptable:
   clears category filter and scrolls the list to the grid section).
6. **Favourites rail** — eyebrow `FAVOURITES` + `{n} pieces` count right. Cards
   74×74, cost-per-wear line below (`$X.XX / wear`, 10px muted). Content:
   existing `favourites` logic (best cost-per-wear, wear-data fallback rules
   unchanged, limits unchanged).
7. **Insight card** ("worn this year") — `tray` bg, 14px radius, 13/14px
   padding. Title 13px/600 `{worn} of {total} pieces worn this year`, right
   `{pct}%` 11px muted. 6px progress bar (3px radius, ink fill over
   ink-at-10% track). Footer 12px muted:
   `{unworn} pieces have never left the rail. Worth a look before you buy anything else.`
   Singular variant: `1 piece has never left the rail.` If `unworn === 0`,
   footer reads a positive line instead (write one sentence in the same voice,
   e.g. `Every piece has earned its place this year.`).
   NOTE: data layer has no per-year wear date history — compute "worn this
   year" as `wearCount > 0 && lastWornAt within current year`; pieces with
   `wearCount>0` but stale `lastWornAt` fall out naturally. Card hidden when
   closet is empty.
8. **Category chips row** — horizontal scroll, 30px tall capsules. Labels are
   the existing `CategoryFilter` set with live counts: `All 148`, `Tops 41`, …
   Active chip: ink bg, canvas text, 600. Inactive: `rule` border, 500.
   Categories with 0 items are hidden (except `All`). Selection filters the
   grid only (rails unaffected) — same as today.
9. **Full grid** — 2 columns, 12px column gap / 14px row gap, cards:
   image well ~196px tall (12px radius, hairline border, `tray` fill), name
   13px/600 at 7px top margin, meta row space-between at 3px:
   left `{n} wears` 11px muted; right cost-per-wear `$X.XX / wear` 11px ink.
   - Never-worn: oxblood badge top-left of image (`NEVER WORN`, 9px/600
     tracked uppercase, canvas text, 5px radius, 3/7px padding); meta right
     side becomes `${price} unearned` in muted (only when `purchasePrice`
     present; otherwise omit right meta).
   - No cost-per-wear (null): omit the right meta, keep wears.
   - Keep FlashList virtualization (existing `closet-grid.tsx` header
     pattern). Tap → item detail as today. Long-press → selection mode.
10. **Bottom inset** — native tab bar untouched (`NativeTabs`); atlas's drawn
    tab bar is illustrative only.

Pull-to-refresh keeps refetching all five queries. Masthead sections
(1–8) ride in the FlashList header as today; the search `TextInput` stays
**outside** the virtualized tree (known focus-loss bug).

## C-02 — Search

- Search icon swaps the **whole header block** for: `tray` search field
  (38px, 12px radius, magnifier + 16px text) with `Cancel` (15px/500 accent)
  to its right. Profile block, rails, insight card collapse — results start at
  top. Animate with existing spring vocabulary (`spring.smooth`); no new
  motion inventions.
- Result count eyebrow: `{n} PIECES` (singular `1 PIECE`).
- Results reuse the same grid card, data included. Category chips remain
  usable inside search (current behavior: query + chip compose).
- Footer note pinned near bottom when results are short, 12px muted:
  `Searching matches name, colour and fabric — nothing you don't own.`
- Match fields: keep existing matcher (subcategory/category/brand/colors) and
  **add `material`** so the footer's "fabric" claim is true.
- Empty result: keep an empty-search state (current `EmptySearch` copy unless
  the atlas Cinch App.html has copy — it does not), plus footer note.

## C-03 — Ellipsis menu

Anchored popover from the ellipsis button (NOT ActionSheetIOS anymore):
232px wide white card, 16px radius, `rule` border, deep shadow, rest of
screen content dimmed to 40% opacity (no dark scrim). Rows 13/16px padding,
15px/500, hairline separators:
1. `Review tags` + right badge: 20px oxblood pill, count = pending review
   count. Row hidden entirely at 0.
2. `Select pieces` → enters selection mode.
3. `Profile & settings` → existing route.
Tap outside dismisses. Android: same popover (it's just a positioned View —
no platform fork needed). This replaces the ActionSheet/Alert code.

## C-04 — Multi-select

- Entered by long-press on any grid card (that card pre-checked, haptic as
  today) or via menu `Select pieces` (empty selection).
- Header swaps to: `Cancel` (accent) left, `{n} selected` (15px/600) center,
  `Select all` (accent) right. `Select all` toggles to a full selection;
  when everything is selected it reads `Deselect all`.
- Masthead/rails/insight collapse in this mode (atlas shows grid-only), chips
  hidden; the grid becomes the whole page under the header.
- Cards: selected → 2px ink border + 22px ink check disc top-right
  (canvas checkmark); unselected → 55% opacity + empty 22px disc (1.5px
  ink-at-35% border, canvas-at-70% fill). Cost-per-wear/wears meta hidden in
  this mode — name only.
- Sticky bottom bar (canvas at 96% + blur, hairline top border, 12/20/26px
  padding): two 44px buttons — `Recategorise` (rule border) and `Delete {n}`
  (oxblood bg, canvas text), both 12px radius, 15px/600. Disabled at 0
  selected (50% opacity).
- `Delete {n}` → existing confirm copy + `useRemoveItems`.
- `Recategorise` → present the category list (native ActionSheet is fine
  here) and apply via existing `useRetagItem` mutation for each selected
  item; exit selection mode on success.

## C-05 — Empty closet

- Header: eyebrow only (no icon buttons).
- Identity: dashed-border empty avatar circle (`tray` fill), name, sub-line
  `0 pieces · nothing computed yet`.
- **Stat row suppressed entirely.**
- Ghosted grid: four 170px cells (12px radius, dashed `rule`-ish border,
  near-canvas fill), overlaid with a vertical canvas gradient and centered
  block: serif 28px `Add your closet`, 16px muted body (max-width ~270px)
  `Photograph what you own and Cinch starts counting wears, colours and cost-per-wear from day one.`,
  ink 44px button `Add pieces` (12px radius, 17px/600 canvas text) → capture
  route (existing add-pieces destination).
- Replaces current `EmptyCloset` + `ghost-slot-grid` composition (rework
  those files rather than adding new ones).

## C-06 — Loading

- Skeleton mirrors the real layout **exactly** (avatar circle, two name
  lines, stat row with hairlines, chip capsules, 2×2 grid with caption bars)
  so nothing shifts on arrival. No spinner anywhere.
- Rebuild `ClosetGridSkeleton` (or a closet-local skeleton) to this layout.
  Use the two-tone scheme (`tray` primary, lighter secondary) and the
  existing skeleton shimmer convention if one exists — otherwise static.

## Error state (not in atlas — required by field-guide audit)

Errors must not render as empty results. When `useCloset` errors: keep
masthead, show existing `ErrorState` component in the grid area with retry
wired to `refresh()`. When search errors likewise. This closes the audit's
flagged gap.

## Behavior preserve-list (must survive verbatim)

- `chipFor()` category mapping (labels already match the atlas).
- Filter memo: chip + free-text compose; sorted `createdAt` desc; `material`
  added to match fields.
- Highlights fallback: `favourites`/`mostWorn` from wear data, recency
  fallback when none; `MOST_WORN_LIMIT=5`, `FAVOURITE_LIMIT=8`,
  `TASTE_THRESHOLD=8`. (The atlas has no "Most worn" section — Latest +
  Favourites are the only rails now; keep the mostWorn computation available
  in the hook but unrendered.)
- Selection set semantics: `ReadonlySet<string> | null`, long-press entry
  with haptics, singular/plural delete confirm copy.
- Search input outside FlashList.
- `refresh()` refetches all five queries.
- `EditProfileSheet` wiring; derived strings `handleLine`/`bioLine`/`chips`
  logic (style-tag chips may render in the identity block only if they do
  today — the atlas omits them; drop rendered style-tag chips, keep the code
  path in the hook for profile screen parity).
- Signed URLs through `useSignedUrls` / `stableImageSource`, batch signing of
  plate|cutout|thumb.

## Component plan

| File | Fate |
|---|---|
| `src/features/closet/use-closet-screen.ts` | NEW — all screen logic/derivations extracted from old closet.tsx |
| `src/app/(tabs)/closet.tsx` | REWRITTEN — thin render tree over the hook |
| `src/components/closet/item-card.tsx` | REWRITTEN to C-01 grid card (check Plan's packing usage; fork if it regresses there) |
| `src/components/closet/rail-card.tsx` | NEW — 92×110 latest / 74×74 favourite variants |
| `src/components/closet/stat-row.tsx` | NEW |
| `src/components/closet/insight-card.tsx` | NEW (worn-this-year) |
| `src/components/closet/closet-menu.tsx` | NEW (anchored popover) |
| `src/components/closet/selection-bar.tsx` | REWRITTEN (bottom action bar) |
| `src/components/closet/ghost-slot-grid.tsx` | REWRITTEN (C-05) |
| `src/components/closet/closet-skeleton.tsx` | NEW (C-06) |
| `src/components/closet/closet-grid.tsx` | KEEP (verify Plan unaffected) |

All dimensions in the atlas are pt-for-px at 393pt width; use them literally
(they are already Tailwind-friendly). Respect `MIN_TAP_TARGET` for the 34px
header buttons by padding the hit slop.
