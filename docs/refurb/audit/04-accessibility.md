# 04 — Accessibility audit

Scope: `src/` — VoiceOver labelling/roles/states, grouped-vs-fragmented a11y
nodes, Dynamic Type, WCAG contrast on the locked palette's actual token pairs,
Reduce Motion, non-color state signalling, 44pt tap targets, form/input a11y,
alert/toast announcement. Read-only audit per `docs/refurb/CHARTER.md`.
Palette is locked — every contrast fix below is proposed as a **usage** change
(which token, what weight/size/background/placement), never a hex change.

Overall shape: this is an unusually well-instrumented codebase already —
`accessibilityLabel`/`Role`/`State`/`Hint` are present on the large majority of
interactive elements (144 labels / 128 roles across 48 `Pressable` sites),
cards are deliberately composed into single VoiceOver nodes with hand-written
sentence labels (`item-card.tsx`, `EventCard.tsx`, `day-row.tsx`,
`review-card.tsx`), `MIN_TAP_TARGET` is honoured almost everywhere, and
`Text` (`components/ui/text.tsx`) applies a global Dynamic Type cap by
construction. The findings below are the real gaps in that system — a
systemic contrast problem baked into two shared tokens, one screen that
opts out of the shared `Text` component's scaling, and a couple of motion/
consolidation gaps — not a laundry list of missing basics.

---

## Contrast ratios — the token pairs actually in use

Computed via the WCAG relative-luminance formula against the exact hex values
in `src/theme/tokens.ts`. AA thresholds: **4.5:1** normal text, **3:1** large
text (≥18pt / ≥14pt bold) and non-text UI/graphical objects.

| Foreground (token) | Background (token) | Ratio | AA normal (4.5:1) | AA large/UI (3:1) |
|---|---|---|---|---|
| `faint` `#8A8578` | `canvas` `#FBFAF6` | 3.52:1 | **FAIL** | fail (11px text, not "large") |
| `faint` | `surface` `#FFFFFF` | 3.68:1 | **FAIL** | fail |
| `faint` | `tray` `#F0ECE3` | 3.12:1 | **FAIL** | fail |
| `faint` | `blush` `#F7EDE8` | 3.20:1 | **FAIL** | fail |
| `muted` `#6B665C` | `canvas` | 5.46:1 | pass | pass |
| `muted` | `surface` | 5.71:1 | pass | pass |
| `muted` | `tray` | 4.84:1 | pass | pass |
| `ink` `#1C1A16` | `canvas` / `tray` / `surface` | 16.6 / 14.7 / 17.4 :1 | pass | pass |
| `canvas`/`surface` (text) | `accent` `#6E2B2B` (bg) | 9.84 / 10.28 :1 | pass | pass |
| `accentWarm` `#B08A76` | `canvas` (text) | 2.98:1 | **FAIL** | fail |
| `accentWarm` | `surface` (text) | 3.11:1 | **FAIL** | fail (just clears 3:1, not 4.5:1) |
| `accentWarm` | `tray` (text) | 2.64:1 | **FAIL** | fail |
| `critical` `#8A2E28` | `canvas` / `tray` | 8.04 / 7.12 :1 | pass | pass |
| `warning` `#C58A2E` | `canvas` (text) | 2.85:1 | **FAIL** | fail |
| `canvas` (text) | `warning` (bg, badge fill) | 2.85:1 | **FAIL** | fail |
| `positive` `#1A8754` | `canvas` (text) | 4.34:1 | **FAIL** (just under) | pass |
| `canvas` (text) | `positive` (bg, overlay fill) | 4.34:1 | **FAIL** (just under) | pass |
| `muted` | `warning/15` wash over canvas (`#F3E9D8`) | 4.74:1 | pass | pass |
| `faint` | `warning/15` wash over canvas | 3.06:1 | **FAIL** | fail |
| `rule`/`hairline` over canvas | canvas | 1.20–1.28:1 | n/a (structural, not text) | n/a |

**The one structural problem:** `faint` and `accentWarm` are not AA-compliant
as *text* colour on any canvas-family surface, at any size the app actually
sets them (10–13px, none of it "large text"). Both tokens are locked hex
values, so every fix below is a usage change — move the string to `muted`
(which does clear AA everywhere it's tested above), or stop using the token
for content that isn't genuinely decorative/redundant.

### Blockers

- [fix inconsistency] `src/components/ui/text.tsx:50,52` — the `eyebrow` and
  `colophon` variants are both hard-set to `text-faint`. Both are used
  app-wide for real, non-redundant content, not just decorative tracking:
  screen colophons (`ScreenHeader` title = the page's H1-equivalent),
  weather-strip temperature and stat labels, event status metadata,
  cost-per-wear captions. At 3.1–3.7:1 depending on surface, this is a
  systemic AA failure that touches nearly every screen. Fix by usage: give
  `colophon`/`eyebrow` a `muted`-based default (5.46–5.71:1, passes
  everywhere) and reserve `faint` for text that's genuinely redundant with an
  adjacent icon or duplicated elsewhere on screen (e.g. `ghost-slot-grid.tsx`
  already documents this exact contrast rule for its own ghosted tiles —
  extend that discipline to the shared variant instead of leaving it
  per-caller).
- [fix inconsistency] `src/components/plan/day-row.tsx:103,153` — the day's
  temperature (`formatTemp`) and the AI-generated reasoning sentence are both
  explicitly overridden to `className="text-faint dark:text-faint-dark"` on
  the `caption` variant (which defaults to `muted`). Real content, not
  decoration, at 11px, on canvas → 3.52:1. Usage fix: drop the override and
  let `caption` stay `muted`.
- [fix inconsistency] `src/components/today/weather-strip.tsx:74,109` — the
  location-permission and calendar-connect CTAs (`Text variant="label" style=
  {{ color: theme.accentWarm }}`) are set directly in `accentWarm`, 13px, on
  the Today tab's canvas background → 2.98:1. These are actionable prompts,
  not swatches. Usage fix: keep `accentWarm` on the leading icon only (icons
  are a non-text graphical object, closer to the 3:1 floor) and set the label
  text in `ink` or `muted`.
- [fix inconsistency] `src/components/event-outfits/OutfitPostCard.tsx:332` —
  the crowned-look colophon ("The look · Chosen by the table") is
  `accentWarm` on `bg-surface` → 3.11:1, still under 4.5:1 for 10px text.
  Same fix: move the tint to the crown icon (`Crown()`, already `accentWarm`
  and non-text) and set the label in `ink`/`muted`.
- [fix inconsistency] `src/components/closet/item-card.tsx:106-121` — the
  "Needs review" badge renders `bg-warning` (solid fill) with
  `style={{ color: theme.canvas }}` text at 11px (`maxFontSizeMultiplier`
  capped, but the colour itself fails) → 2.85:1. This is one of the most
  visible elements in the app (every grid cell with an unresolved tag). Usage
  fix: keep `warning` as the badge fill but set the label in `ink` instead of
  `canvas` — worth computing (`ink` on `warning` is far closer to AA than
  `canvas` on `warning`) — or invert to an ink-on-warning-tint (`warning/15`)
  chip the way the failed-import banner already does successfully for its
  `muted`-on-wash pairing below.
- [fix inconsistency] `src/app/capture.tsx:555` — the failed-import banner's
  headline (`Text variant="colophon"`, no colour override, so it inherits
  `faint` per the `text.tsx` finding above) sits on the `bg-warning/15` wash
  → 3.06:1. This is the headline of an error state the user is meant to act
  on. Usage fix: same as the systemic `colophon` fix, or set this specific
  instance to `muted` explicitly the way the sibling `Text variant="label"`
  two lines below it already correctly is (`app/review.tsx:441`'s equivalent
  banner uses `label`/`muted` and passes at 4.74:1 — `capture.tsx`'s banner
  is the one that regressed to `colophon`).
- [fix inconsistency] `src/components/event-outfits/CommentRow.tsx:89` —
  "Hidden while the host takes a look" / "Hidden from the table" is
  `theme.warning` at caption size (11px) on the comment thread's canvas
  background → 2.85:1. Usage fix: `critical` (8.04:1, already used elsewhere
  for stronger warnings) or `muted` reads this state without failing AA.

### Significant

- [fix friction] `src/app/(auth)/sign-in.tsx:435-531` — the entire hero
  block (wordmark, "Today's set" eyebrow, plate caption, and the sheet's
  headline/subhead — 17 `RNText` nodes total, e.g. lines 435, 447, 471, 481,
  505, 522) is built with `Text as RNText` imported directly from
  `react-native` rather than the shared `components/ui/text.tsx`, and
  positioned with a hand-rolled `px()` pixel-scale function (`const s =
  screenW / 300`) rather than the token/NativeWind layout system used
  everywhere else. None of these nodes carry `maxFontSizeMultiplier`, so at a
  large Dynamic Type / Larger Accessibility Sizes setting this text scales
  unbounded against absolutely-positioned pixel coordinates
  (`top: insets.top + px(6 + 12)`, `bottom: px(34)`, etc.) — the one place in
  the app where large text can visibly overlap or clip, and it's the very
  first screen a new user sees. This is also the one screen in the audit that
  doesn't route through `Text`'s shared 1.4–1.8 cap, so it's worth flagging
  as a pattern gap, not just a one-screen fix: either route this hero through
  `Text` with `trim`, or add an explicit `maxFontSizeMultiplier` to each
  `RNText` here matching the cap the rest of the app uses.
- [fix friction] `src/components/ui/skeleton.tsx:41-70` (`Skeleton`, the
  shimmer sweep) and `:73-100` (`Spinner`, the rotating ring) both start an
  infinite `withRepeat(withTiming(...))` loop on mount with no
  `useReducedMotion()` check. Two other animated components in the app
  (`components/today/plate.tsx:389`, `components/event-outfits/
  OutfitPostCard.tsx:234`) do read `useReducedMotion()` and gate their motion
  on it — `Skeleton`/`Spinner` are the odd ones out, and because they're the
  shared primitive behind every loading state (`ClosetGridSkeleton`,
  `ListSkeleton`, `PlateSkeleton`, the stylist's "Reading your wardrobe…"
  spinner), the gap is systemic rather than local. Fix: when
  `useReducedMotion()` is true, hold the shimmer band static at a mid-opacity
  or swap the spinner's rotation for a simple pulse/fade — both are
  accessibility-safe restatements of "loading" that don't require continuous
  motion.
- [consolidate into component] `src/app/item/[id].tsx:252-259`,
  `src/app/friends/[userId].tsx:179-189` (two copies — page back button and
  the report-sheet close), `src/app/friends/index.tsx:170`,
  `src/app/event/[id]/index.tsx:276`, `src/app/event/new.tsx:173`,
  `src/app/event/[id]/post.tsx:98`, `src/app/event/[id]/comments.tsx:143`,
  `src/app/borrow.tsx:108`, `src/app/event/[id]/outfits.tsx:260` — nine sites
  still hand-copy the 36pt circular back button (`chevron.left`, `hitSlop=8`,
  `accessibilityLabel="Back"`) instead of using the already-extracted
  `BackButton`/`ScreenHeader` in `src/components/ui/screen-header.tsx`, whose
  own doc comment names this exact duplication and its risk ("Nine copies of
  anything drift eventually, and this one carries an accessibility guarantee
  — the hitSlop — that is invisible when it goes missing"). Every copy today
  is individually correct, so this isn't a live bug — but it's the
  identified drift vector for a future one. Worth a follow-up pass to route
  these nine sites through the shared component now that it exists.
- [minor polish] `src/components/review/review-card.tsx:186-207` — the
  swipe-to-confirm/skip fling (`withTiming` to `±SCREEN_WIDTH * 1.4`) has no
  `useReducedMotion()` gate, unlike its sibling drag-intent opacity
  interpolations. Lower priority than the skeleton finding because this is a
  direct continuation of a user-initiated pan gesture (the kind of motion
  Reduce Motion's own HIG guidance treats more leniently than autoplaying
  loops), but worth a quick duration/distance reduction under
  `useReducedMotion()` for parity with `plate.tsx` and `OutfitPostCard.tsx`.
- [minor polish] `src/components/review/review-card.tsx:353-358` — the
  drag-intent "Confirm" overlay is `canvas` text on `bg-positive` → 4.34:1,
  a hair under AA's 4.5:1. Transient (visible only mid-drag) and redundant
  with the swipe direction and haptic, so not urgent, but an easy target if
  the `colophon`/`faint` and `warning`-badge fixes above are being done in
  the same pass: swap to `ink` text on the same fill.

### Preserve exactly

- [preserve exactly] `src/components/closet/item-card.tsx:44-77` — the
  garment card composes photo, badges and the selection ring into one
  `Pressable` with a hand-built sentence label
  (`"${subcategory}, ${color}, ${brand}, worn N times"`), suppresses
  `accessibilityState.selected` outside selection mode specifically to avoid
  "two hundred garments all announcing not selected," and pairs the
  selection state with a ring **and** a checkmark glyph, not colour alone.
  Reference-quality pattern; nothing to change.
- [preserve exactly] `src/components/ui/screen-header.tsx`,
  `src/components/events/EventCard.tsx:116-180`,
  `src/components/plan/day-row.tsx:167-181`,
  `src/components/review/review-card.tsx:271-299` — all deliberately compose
  what would otherwise be several fragments into one accessible node with a
  synthesized sentence label, and `review-card.tsx` specifically documents
  *why* it avoids `accessibilityRole="adjustable"` on the swipeable
  container (a pan gesture has no VoiceOver/Switch Control affordance) in
  favour of real buttons at the card's foot. This is the grouping discipline
  the task brief asks after — it's already the house style.
- [preserve exactly] `src/components/ui/text.tsx:92-122` — every `Text`
  instance gets `maxFontSizeMultiplier` (1.4 display, 1.8 body) by
  construction, so Dynamic Type is capped consistently everywhere *except*
  the one screen (`sign-in.tsx`) that opts out by using raw `RNText`. Don't
  loosen this cap as a "fix" for that screen — route `sign-in.tsx` into the
  same system instead.
- [preserve exactly] `src/components/closet/ghost-slot-grid.tsx:18-31` — the
  empty-closet ghost tiles are explicitly hidden from VoiceOver
  (`accessibilityElementsHidden`, `importantForAccessibility="no-hide-
  descendants"`) and the component's own comment states the contrast rule it
  follows (ink may sit on the composited ghost, muted may not). Exactly the
  right call for decorative, non-interactive content.
- [preserve exactly] `src/components/event-outfits/VotePill.tsx`,
  `src/components/closet/selection-bar.tsx` — both pair a colour change with
  a fill/outline or label-text change for their selected/active states, so
  neither relies on hue alone; both use `accessibilityState` correctly.
- [preserve exactly] Form inputs app-wide
  (`sign-in.tsx`, `event/new.tsx`, `event/[id]/invite.tsx`,
  `edit-profile-sheet.tsx`, `review-card.tsx`, `item/[id].tsx`,
  `garment-search-sheet.tsx`, `trip-questionnaire.tsx`, `PostComposer.tsx`)
  — every `TextInput` found carries an explicit `accessibilityLabel`
  distinct from its placeholder. The one exception is dev-only tooling (see
  Polish).
- [preserve exactly] Failure/error announcement —
  `app/review.tsx:439`, `app/capture.tsx:553`, `app/item/[id].tsx:392,532`,
  `app/event/new.tsx:362`, `app/event/[id]/invite.tsx:92`,
  `features/profile/edit-profile-sheet.tsx:343,384`,
  `components/closet/selection-bar.tsx:55` all use
  `accessibilityLiveRegion="polite"` on the state that needs announcing, and
  every hard failure path (`sign-in.tsx`'s auth errors, the queue banner's
  retry) routes through native `Alert.alert`, which VoiceOver announces for
  free. No missing announcement states found. Nothing uses
  `AccessibilityInfo.announceForAccessibility` directly, but the
  `accessibilityLiveRegion`/`Alert` coverage is complete enough that it isn't
  needed.

### Polish

- [add missing state] `src/app/dev-closet.tsx:66-71` — the search `TextInput`
  has no `accessibilityLabel` (its sibling in the shipped
  `app/(tabs)/closet.tsx:360-368` does). Lowest priority: `dev-*` routes are
  internal tooling, not part of the locked page inventory, but trivial to
  match if this file gets touched for another reason.
- [preserve exactly] `src/components/ui/chip.tsx`, `src/components/ui/
  button.tsx` — neither sets an explicit `accessibilityLabel`, but both rely
  on RN's automatic aggregation of `Text` children into the Pressable's
  accessible name, which is correct and doesn't need a change. Called out
  only because the task brief asked specifically about selection controls —
  confirming these are fine as written, not a gap.
- [reject] Reduce Transparency — no `BlurView`/glass material is rendered
  from JS anywhere in `src/`; the only glass surface is the native
  `NativeTabs` bar (`app/(tabs)/_layout.tsx`), which is UIKit chrome and
  inherits Reduce Transparency handling from the OS automatically. There is
  no app-level gap to fix here.

---

## Summary of token-level fixes (usage, not hex)

| Token as text colour | Where it currently fails AA | Proposed usage fix |
|---|---|---|
| `faint` in `eyebrow`/`colophon` variants | Systemic — screen colophons, weather/stat labels, day-row reasoning | Default `colophon`/`eyebrow` to `muted`; reserve `faint` for content that's redundant with an adjacent icon/label |
| `accentWarm` as `Text` colour | weather-strip CTAs, crowned-look colophon | Keep `accentWarm` on icons only (non-text, closer to 3:1 floor); set the label text `ink`/`muted` |
| `warning` as text/fill colour | "Needs review" badge, failed-import banner headline, hidden-comment caption | `ink`-on-`warning` or `warning`-tint wash + `muted` text (the pattern `review.tsx`'s banner already gets right) |
| `positive` as fill colour | swipe drag-intent "Confirm" overlay | `ink` text on the same fill (near-miss, low urgency) |
