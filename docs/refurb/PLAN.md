# Refurbishment execution plan — the fix wave

Synthesized 2026-08-06 from `docs/refurb/CHARTER.md` and the eight audits in
`docs/refurb/audit/`. Every finding used here was spot-checked against the code
at its cited line before acceptance; the corrections found during verification
are recorded inline. The charter outranks any individual audit, and this plan
outranks any individual audit where they disagree.

**Ground rules for every fix agent:**

- Fix agents run in **parallel git worktrees**. Two agents must NEVER edit the
  same file. Each territory below carries a complete file list; **you may not
  edit any file outside your list**, even for a one-line fix. If you find a
  needed change in a file you don't own, note it in your final report instead.
- No new components consumed across territory boundaries. If your task needs a
  primitive another territory is building, it isn't your task — check the
  Deferred section. Press feedback outside Territory 2's files uses plain
  NativeWind `active:opacity-*` classes, never an import of the new hook.
- `npm run typecheck` and `npm run lint` must pass **inside your own worktree**
  before you finish. Do not rely on another territory's changes to compile.
- Do not delete `rounded-card` / `rounded-chip` from `tailwind.config.js` —
  alias deletion happens in the final integration pass after all worktrees
  merge (Verification §V4). Replace usages in your own files only.
- Everything in the Protected list and the charter's do-not-touch list
  (repeated verbatim in §D) is off-limits to every territory.

---

## A · Decisions

Recorded per the charter's requirement that conflicts get a decision with a
reason, not a silent fix.

**D1 — `spring.bouncy` is used exactly once, and the plate landing keeps it.**
`src/theme/tokens.ts:110-120` is founder-approved canon: "`bouncy` is used
EXACTLY ONCE in the app: the final garment landing in a plate assembly …
Nothing else." The two call sites in `plate.tsx:121,164` are one logical
moment rendered across two regimes (RN wrapper + Skia layer) — that is the
sanctioned single use. `OutfitPostCard.tsx:239` (the crown reveal) locally
reinterpreted the rule as "once per screen"; the local comment does not amend
canon. **The crown moves to `spring.snappy`.** Its existing 250ms delay,
0.8→1.0 scale, and `accentWarm` colour still celebrate; the app keeps one
bounce, which is what makes it an event. (Territory 6.)

**D2 — The fourth tab is labelled "Lately".**
Charter's locked page inventory names the tab Lately; the screen's own display
title is already "Lately" (`explore.tsx:144`); only the trigger label says
"Explore" (`(tabs)/_layout.tsx:77`). A tab whose word matches its page is the
difference between a destination and a mystery. Route id, file name, and the
`person.2` symbol do not change — the label is the only user-facing string.
(Territory 6.)

**D3 — `VenueCard` moves below the group note.**
The approved frame (`02-event.png` / `02-event.html`) goes straight from the
RSVP row to YOUR LOOK; the app inserts a ~90pt venue card between them
(`event/[id]/index.tsx:477-484`), pushing the blush card — the whole point of
the social layer — below the fold on a 6.1". The card is logistics, not the
decision, and the venue facts already appear in the metadata line. It is not
deleted (it carries the reservation-URL affordance): it renders after the
group note, before the "Every option" row. (Territory 6.)

**D4 — Zeego is rejected for this wave.**
The no-new-dependency default stands. The concrete need — a native-feeling ⋯
overflow instead of `Alert.alert` — is met at zero dependencies by RN's own
`ActionSheetIOS`, which is the idiomatic iOS surface for content overflow. If
long-press context menus later become a product priority, the written
justification (license/maintenance/size) can be filed then; research audit 07
already drafted the case. Until then: reject (pending).

**D5 — Filled chips, scoped to descriptive tags only.**
The approved `03-closet.png` draws the *descriptive* style tags as sand-filled
capsules; the screens audit's own rejection analysis (01 §18) correctly rules
out making fill the global chip style, because the interactive category filter
needs the outlined/filled distinction to carry its selected state. So: `Chip`
gains a `tone="fill"` variant (sand ground, no border) used for read-only
descriptive tags on Closet and Item detail; the category filter and every
pressable chip stay outlined. Radius stays 12 per the house rule — the frame's
999-radius capsule is a recorded, deliberate deviation (at 30pt tall the read
is nearly identical, and one radius grammar beats a 2px match to a mock that
broke its own scale). (Territory 4.)

**D6 — Two capsule exceptions are recorded, not generalised.**
The Apple sign-in button keeps its capsule (native `AppleAuthenticationButton`,
HIG-constrained — do not "fix" a platform control). The stylist composer keeps
its capsule (a conversational composer is the one place iOS itself uses one —
Messages, Mail — and the approved `04-stylist.png` draws it). Every other
labelled wider-than-tall control on `rounded-full` is a violation and moves to
`rounded-md`: sign-in's email button and field, `event/new.tsx:78`'s date
selector. The `tailwind.config.js` comment recording the two exceptions is
written in the final pass (§V4), not by a territory.

**D7 — No shared Notice/Toast component this wave.**
Audit 06's root cause R1 is real, but a shared `<Notice>` consumed by Today,
Plan, and Closet cannot be built and adopted across parallel worktrees without
cross-territory imports. Each surface instead renders its failure/confirmation
lines inline — a `caption`/`label` line with `accessibilityLiveRegion="polite"`,
the same grammar as Today's offline banner and the reaction bar's failed
state, both already shipped. Extracting the shared component is Deferred work
for a follow-up sequential pass.

**D8 — The big consolidations are deferred, not attempted.**
`Card` (~35 sites), `SectionHeader` (59 sites), `Row`, `Swatch`,
`ProgressTrack`, `SearchField`, `HalfSheet`, and the `contrastTextOn()` helper
all require one component adopted across files owned by different territories.
They cannot be parallelized safely and are explicitly out of this wave. What
*is* in scope is adoption of primitives that **already exist** (`ScreenHeader`,
`BackButton`, `Rule`, `Avatar`, `ErrorState`, `EmptyState`, `statSmall`,
`statFigure`) — each territory performs those swaps inside its own files.

**D9 — `eyebrow`/`colophon` default to `muted`; `faint` becomes opt-in.**
`faint` fails WCAG AA on every surface it sits on (3.1–3.7:1) and the two
variants carry real content app-wide (audit 04). The palette is locked, so the
fix is usage: `text.tsx` defaults the two variants to `text-muted`
(5.46–5.71:1, passes everywhere), and `faint` is reserved for text genuinely
redundant with an adjacent element. Callers that explicitly force `text-faint`
on real content drop the override in their owning territories. This is a
deliberate, app-wide tone shift of one step — it is the *usage change* the
charter prescribes for contrast problems.

**D10 — Sign-in's `px()` system stays; only its violations are fixed.**
The device-proportional mock-transcription system in `sign-in.tsx` is
documented, bounded, and produces the best-looking screen in the app (audit
01). Converting it to tokens piecemeal would fight its design intent. The wave
fixes only what is broken inside it: unbounded Dynamic Type on raw `RNText`,
fixed `height` where `minHeight` is needed, the capsule-radius violations
(D6), and the fragmenting Terms line. The hand-mixed `HeroScrim` values are
**preserve exactly** per audit 01 — the design-system audit's proposal to
re-derive them from `theme.ink` is overruled.

**D11 — Optimistic UI: adopt the UI-only pattern, reject cache writes.**
The codebase's `invalidate-don't-patch` rule is a deliberate, documented house
rule (audit 08 confirms it matches TanStack's own guidance and that Expensify's
scale is an argument *for* it). Cache-write optimistic updates (`onMutate` +
rollback) are rejected for this wave. The one perceived-latency fix shipped is
the UI-only pattern on `VotePill` — component-local pending state, no cache
write, reconciled when invalidation lands. Optimistic follow et al. are
Deferred pending a founder decision on the house rule.

**D12 — Plan's honesty line stays; the ASC subline is flagged.**
"Repeats kept to a minimum" (`plan.tsx:368-370`) stays over the frame's "No
piece worn more than twice" — the engine's `REUSE_BOOST` is a soft scorer, so
the frame's copy was a promise the rows below could visibly break. The App
Store screenshot still carries the old claim: **flag to the listing owner**,
outside this codebase.

**D13 — Report-outcome copy standardises on the keepable promise.**
"Reports are reviewed within 24 hours" is an SLA nobody has committed to
operationally. All four editable sites converge on
`Thank you. Every report is reviewed.` The fifth site,
`social-terms-sheet.tsx:36`, carries the 24-hour promise but is
charter-fenced — **flagged for the concurrent session owner, not edited.**

**D14 — `Button`'s `haptic` default inverts to `true`.**
30 of 49 call sites omit it today, including every destructive and commit
action; a discrete commitment deserves the selection tick, and the handful of
places that must stay silent opt out. One-line change with app-wide reach.
(Territory 2. Screens need no edits — the default does the work.)

**D15 — The review-deck fly-off is not retuned.**
The pan gesture (`review-card.tsx:186-241`) is protected. The
velocity-carrying `withSpring` fly-off proposal is genuinely better physics,
but it edits the protected gesture's completion path for a texture gain —
Deferred. The only touch allowed in that range is a `useReducedMotion` gate on
the fly-off *duration*, which does not alter gesture logic.

**D16 — `event-outfits/mutations.ts` vote-invalidation fan-out stays
flagged-not-fixed.** The file is on the charter's do-not-touch list (concurrent
session territory). The finding — one vote invalidates four queries plus
`myVoteKey`, the highest-latency single interaction in the app — is recorded
here for whoever owns that file next. No territory touches it.

**D17 — Location pre-permission flow is deferred.**
The fix spans `use-style-context.ts` (Territory 8) and `weather-strip.tsx`
(Territory 3) in a coordinated behavioural change to when the OS prompt fires
— un-parallelizable and founder-visible. Deferred with a full spec (§C). The
calendar-persistence bug in the same file is self-contained and ships now.

---

## B · Protected list — fix agents must not touch these

Classified "preserve exactly" by the audits; regressions here are the costliest
possible outcome of this wave. Where a protected item lives inside a file a
territory owns, the territory may edit the file but not these elements.

- **Plate landing motion** — `plate.tsx:121,164` springs, `:223-232` landing
  haptic, `:389/:471` Reduce Motion wiring, the stack geometry, and the card
  grammar `plate.tsx:434-554` (spacing-step tasks in T3 are the only sanctioned
  edits, and they change paddings/margins only).
- **Review deck pan gesture** — `review-card.tsx:186-241` composition,
  thresholds, overlays; the swipe-plus-buttons VoiceOver duality
  (`:484-521`); the Skip/Looks-right accent reasoning (`:504-527`); the haptic
  discrimination (`:163-184`).
- **Skeleton kit internals** — `skeleton.tsx` shapes, ragged width tables,
  percentage sweep, `accessibilityElementsHidden` (T2 adds Reduce Motion
  guards and unmount cancellation only; no shape or API changes).
- **Message bubble geometry** — `message-bubble.tsx:16-17,106,131` radii and
  padding (T8's strip-cell and caption tasks do not touch these lines).
- **Item-card a11y grouping** — `item-card.tsx:44-77` single-node sentence
  label, selection-state suppression, ring+checkmark signalling.
- **Native tab bar** — `(tabs)/_layout.tsx:48-79` NativeTabs, tints,
  `minimizeBehavior`, `dynamic()` colours. T6 changes one label string only.
- **Stylist formSheet** — `_layout.tsx:273-282` detents/radius/grabber, and
  `event/_layout.tsx` mirror.
- **Signed-URL system** — `use-image-urls.ts` in its entirety, incl.
  `stableImageSource`.
- **Query-client config** — `query-client.ts` defaults and the persisted-query
  allowlist.
- **Two-stage outfit generation** — `use-outfits.ts:79-153`.
- **`+not-found.tsx`** — the session-aware redirect and its reasoning.
- **Capture deferred-resume machinery** — `capture.tsx:154-213`; safe-area
  handling `:333,492-493`; blocked-camera plate `:361-377`.
- **Review screen inset handling** — `review.tsx:52-57`.
- **Exemplary states** — `NothingWorks` (`index.tsx:311-358`), empty closet
  (`index.tsx:589-640`, `closet.tsx:849-884`), Today masthead
  (`index.tsx:156-191`), offline banner (`index.tsx:664-671`), Plan's state
  ordering (`plan.tsx:328-336`), `borrow.tsx:122-146`, `BlockedList`'s
  failed-fetch refusal, profile's learned card + two-step deletion + consent
  switch, sign-in `HeroScrim` (`sign-in.tsx:222-245`) and error naming,
  the removal-confirmation copy (`closet.tsx:238-269`, `item/[id].tsx:200-226`),
  British spelling, and the no-exclamation-marks voice.
- **`keyboard-aware-scroll-view.tsx`** and all documented focus management.
- **FlashList / expo-image discipline** already in place (`closet-grid.tsx`,
  `item-card.tsx`, `FriendItemCard.tsx`, `garment-cell.tsx`).

---

## C · Deferred (P2) — not in this wave

Each with its reason. Nothing here is rejected on merit unless stated.

1. **`Card`, `SectionHeader`, `Row`, `HalfSheet` primitives; `Swatch` +
   `ProgressTrack`; `SearchField`; `contrastTextOn()`; `shadow.contact`
   adoption** — cross-territory consolidations; cannot be parallelized in
   worktrees (D8). T2 *exports* `shadow.contact` from tokens.ts so the
   follow-up pass can adopt it; consumers keep their local constants for now.
2. **Shared `<Notice>` extraction** — D7. The inline implementations this wave
   are written to converge on one grammar so extraction is mechanical later.
3. **Velocity-carrying review fly-off** — D15; edits a protected gesture.
4. **Optimistic follow / any `onMutate` cache write** — D11; contradicts the
   documented house rule pending a founder decision.
5. **Long-press pre-commit scale on closet tiles** — new gesture-handler wiring
   on the app's densest grid; worthwhile, but regression risk outweighs a
   polish gain this wave. The discoverability problem it partially addresses
   is solved more directly by T4's ellipsis-menu "Select pieces".
6. **Rail snapping on Closet** (`closet.tsx:535,802`) — a feel change to
   free-scrolling rails the founder has seen and not complained about; the
   boards' snapping (T6) is the higher-value half and ships.
7. **`useEventComments` `.limit()` + `NEW_ADDITIONS_LIMIT` pagination
   ("Earlier" affordance)** — behavioural data-layer changes, invisible at
   demo scale; belongs in a considered pagination pass, not a polish wave.
8. **Event-creation draft persistence** — new persistence surface; moderate
   scope; audit 06 honourable-mention tier.
9. **Reaction undo** — requires a delete path in the learner mutation; product
   scope, not polish. (The "Never mind" escape *before* recording ships in T3.)
10. **Location pre-permission flow** — D17.
11. **Expo-image `transition` standardisation to `motion.duration` tokens +
    `placeholder` props app-wide** — broad, low-visibility; territories apply
    it opportunistically inside files they already touch, no dedicated sweep.
12. **`keyboardAppearance="light"` sweep** — cosmetic; bundle with the next
    text-field pass.
13. **Item-detail price-row re-composition** (`item/[id].tsx:334-356`) —
    "visually refine" judgment call that deserves a founder look, not a
    parallel agent's discretion.
14. **Dev-screen hygiene** (`dev-*.tsx` statSmall/statFigure/GUTTER/capsules)
    — not shipped UI.
15. **Destructive-confirm warning haptics** (`notificationAsync(Warning)` at
    every destructive Alert) — distributed one-liners across many owners;
    bundle with the Notice extraction pass.
16. **Closet signing payload slice** (`closet.tsx:134-136` platePath) — real
    but invisible; touch when closet queries next open.
17. **`sign-in.tsx` decorative-palette naming** (`warmTan` et al.) — recorded
    as an approved one-off illustration palette (audit 02's own alternative);
    promote to tokens only if a second consumer appears.
18. **Blocked-users arrival header** (`friends/index.tsx` colophon → "Blocked"
    when `?blocked=1`) — nice; low frequency.
19. **`useBlockUser` confirmation-copy spot check** across entry points
    (audit 08 §7) — verification task, folded into §V6.
20. **Composer draft-survival check** (PostComposer, borrow message) — audit
    08 flagged as unverified premise; verify first (§V6), fix later if real.

---

## D · Charter do-not-touch list (verbatim, applies to every territory)

> - `src/components/social/social-terms-sheet.tsx`
> - `src/features/auth/use-social-terms.ts`
> - `supabase/migrations/2026080810*.sql`, `supabase/tests/08_ugc_moderation.sql`
> - `docs/analytics.md`
> - `src/features/event-outfits/mutations.ts`
> - Untracked root files: `Cinch App Design .html`, `Design.pdf`,
>   `Marketing Designs.pdf`, `Cinch-selection.png`, `docs/superwall/*`
> - Never run a second Metro bundler. Never touch `ios/Pods` symlinks.
> - No secrets in commits. No edge-function or DB changes in this program.

The `event-outfits/mutations.ts` vote-invalidation finding stays
**flagged-not-fixed** (D16).

---

## E · Territories

File ownership is exclusive and exhaustive: a file listed under one territory
may not be edited by any other. Files not listed anywhere are not edited this
wave.

---

### Territory 1 — Mechanical primitive adoption, standalone screens
**Model: sonnet.** Pure adoption of already-existing primitives in files no
other territory needs. Zero visual change is the acceptance bar.

**Files:** `src/app/borrow.tsx` · `src/components/social/BlockedList.tsx` ·
`src/components/social/ProfileRow.tsx` · `src/app/event/[id]/invite.tsx` ·
`src/app/event/[id]/post.tsx` · `src/components/ui/avatar.tsx` ·
`src/components/closet/plate-thumb.tsx`

**Tasks:**
1. [P1] `borrow.tsx:103-114` — replace the hand-copied back-disc + colophon +
   spacer row with `ScreenHeader align="center"` from
   `src/components/ui/screen-header.tsx`. Accept: identical render; `hitSlop`
   now comes from the component.
2. [P1] `borrow.tsx:84` and `BlockedList.tsx:91` — replace inline
   `<View className="h-px bg-hairline" />` with `<Rule tone="hairline" />`.
3. [P1] `borrow.tsx:151` — add `tintColor={theme.muted}` to the
   `RefreshControl`. Accept: warm spinner, matching Today's.
4. [P1] `ProfileRow.tsx:28,55` — delete the hand-rolled avatar; render
   `<Avatar size={44} tone="ink">` (drop-in per audit 02 §7.5). Keep the row's
   layout and a11y untouched.
5. [P1] `ProfileRow.tsx:56-63` — add `cachePolicy="memory-disk"` to the avatar
   `Image`.
6. [P1] `invite.tsx:19,130-155` — replace the third inline avatar-row's
   hand-built disc with `<Avatar size={32} tone="sand">`.
7. [P1] `invite.tsx:63` — the sheet's Done `Pressable`: add
   `active:opacity-60`.
8. [P1] `post.tsx:99` — replace the hand-copied back disc with
   `ScreenHeader` (leading alignment, matching current composition).
9. [P1] `avatar.tsx:104` and `plate-thumb.tsx:59` — add `recyclingKey` to the
   `Image` (per audit 03 §4; both render inside recycled rows).

**Must not do:** touch any layout, spacing, colour, or copy; add press
feedback beyond task 7; import `use-press-feedback`; edit `screen-header.tsx`
or `rule.tsx` themselves.

---

### Territory 2 — Motion foundation
**Model: opus.** Token-level and shared-primitive changes with app-wide blast
radius. Subtle, high-leverage, easy to get quietly wrong.

**Files:** `src/theme/tokens.ts` · `src/components/ui/button.tsx` ·
`src/components/ui/use-press-feedback.ts` (new) ·
`src/components/ui/skeleton.tsx` ·
`src/components/ingest/upload-queue-list.tsx`

**Tasks:**
1. [P0] `tokens.ts:114-123` — add `reduceMotion: ReduceMotion.System` to all
   four spring presets (Reanimated 4). Accept: every existing and future
   `withSpring(x, spring.*)` call is Reduce Motion-compliant by construction;
   plate landing and review deck unaffected with the setting off.
2. [P0] `skeleton.tsx:41-70` (`Skeleton`) and `:73-100` (`Spinner`) — when
   `useReducedMotion()` is true, hold the shimmer band static at mid-opacity
   and swap the spinner's rotation for a gentle opacity pulse; add
   `cancelAnimation` on unmount for both loops. Accept: no infinite motion
   under Reduce Motion; shapes, widths, and the component API unchanged
   (Protected).
3. [P0] `upload-queue-list.tsx:38-47` — gate the opacity pulse on
   `useReducedMotion()`; cancel on unmount.
4. [P1] New `src/components/ui/use-press-feedback.ts` — the shared hook from
   audit 03 §8.1: `scale 1→0.97`, `opacity 1→0.8` on press-in with
   `withTiming(motion.duration.fast)`, release with `withSpring(spring.snappy)`.
   Wire it into `Button` (wrap the inner view in `Animated.View`, drop
   `active:opacity-70` from `button.tsx:78`). Accept: all 49 Button sites gain
   interpolated press feedback; `spring.snappy` gains its first consumer;
   disabled/loading behaviour unchanged.
5. [P1] `button.tsx:42` — flip the `haptic` default to `true` (D14). Audit the
   Button's own call to stay `selectionAsync` with `.catch(() => {})`.
   Accept: commit/destructive Buttons app-wide tick; no call-site edits.
6. [P1] `tokens.ts` — export `PRESSED_OPACITY = 0.8` beside `MIN_TAP_TARGET`
   (consumed by the hook), and export a `shadow.contact` constant
   (`{dx:0, dy:5, blur:11, color:'rgba(28,26,22,0.16)'}`) for the deferred
   consolidation (C1). Accept: exports exist; no consumer changes.
7. [P1] `upload-queue-list.tsx:96-102` — thumbnails entering the rail get
   `entering={FadeIn.duration(motion.duration.fast)}`; standardise the `120`
   image transition to `motion.duration.fast`.

**Must not do:** touch `chip.tsx` (T4 owns it); change any spring's
duration/damping values; alter skeleton shapes or widths; edit any screen
file; delete `active:` classes anywhere outside `button.tsx`.

---

### Territory 3 — Today: rhythm, plate, reaction stability
**Model: opus.** The home screen; frame fidelity plus the most-performed
interaction in the app.

**Files:** `src/app/(tabs)/index.tsx` · `src/components/today/plate.tsx` ·
`src/components/today/reaction-bar.tsx` ·
`src/components/today/weather-strip.tsx` ·
`src/components/today/garment-cell.tsx`

**Tasks:**
1. [P0] Frame-rhythm batch, measured against `screenshots/src/01-today.html`:
   `index.tsx:766` pill `mt-4`→`mt-3`; `:745` first plate `mt-6`→`mt-4`;
   `plate.tsx:436` `p-4`→`p-3.5`; `plate.tsx:521/:481-483` footer to
   `mt-2.5`/`mt-3`/`pt-2.5`; `plate.tsx:482` credit-line join `'  ·  '`→
   `' · '`; `weather-strip.tsx` gaps `mt-2`→`mt-1.5` (`:48,:81,:92,:102`).
   Accept: side-by-side against `01-today.png`, one more reasoning line clears
   the fold; masthead, card grammar, and stack untouched (Protected).
2. [P0] `weather-strip.tsx:74,109` — the location/calendar CTA labels drop
   `theme.accentWarm` (2.98:1) to `ink` or `muted`; the tint stays on the
   leading icon only. Accept: CTA text ≥4.5:1 on canvas.
3. [P0] `reaction-bar.tsx:117` — add `.catch(() => {})` to the only unguarded
   `Haptics.impactAsync` in the app.
4. [P0] `index.tsx:491-503` — `handleWear` gains `onError`: hold per-outfit
   wear status like `handleReact` does, render the pill as
   `Couldn't log — retry` on failure (mirror `reaction-bar.tsx:127-149`).
   Accept: a failed wear is visible and retryable; wear_count never silently
   diverges.
5. [P0] `index.tsx:782` + `plate.tsx:551` — `wearing` becomes per-key:
   `wear.isPending && wearingKey === key`. Accept: tapping "I wore this" on
   one plate no longer spins/disables the others.
6. [P0] `index.tsx:437` — the offline gate requires `shown.length > 0`, so an
   offline user with no local results is told "Nothing today feels right".
   Test the network failure before `nothingWorks`; when both hold, render the
   offline banner above the `NothingWorks` card. Accept: a network failure is
   never attributed to the wardrobe.
7. [P1] Reaction-bar geometry stability (`reaction-bar.tsx:152-201`,
   `plate.tsx:549`): keep the two-slot row geometry when a reaction records —
   the chosen pill renders in its own slot at its own width, the unchosen pill
   fades to opacity 0 instead of unmounting, and the status caption lives in a
   reserved line so row height is constant. The "what was wrong?" chooser
   renders full-width *below* the action row (WearButton hidden while open)
   instead of replacing it. Wrap the footer in
   `layout={LinearTransition.springify()}` and each branch in
   `FadeIn/FadeOut.duration(motion.duration.fast)`. Accept: the card's height
   changes at most once (chooser open), never at the moment of the
   confirmation tap.
8. [P1] `reaction-bar.tsx:176-201` — add a `Never mind` escape to the reason
   chips, ghost-styled so it doesn't read as a seventh reason, calling
   `setAskingWhy(false)` without recording anything. Accept: an accidental
   "Not for me" costs one tap and writes nothing.
9. [P1] `index.tsx:752-762` — on plans-note commit, render a `caption` line
   under the tray pill: `Styling for "…".` with a hitSlop'd `×` to clear;
   `accessibilityLiveRegion="polite"`. Placeholder becomes
   `What's on today?` (drop "Tell Cinch").
10. [P1] `index.tsx:520-530` — when an explicit pull-to-refresh re-rank fails
    for a non-quota reason, render an inline live-region line:
    `Couldn't refresh just now — these are still today's.` (auto-clears on
    next successful refresh). Same inline grammar for the share-capture
    failure at `plate.tsx:404-414`:
    `Couldn't make the image. Try again in a moment.`
11. [P1] `index.tsx:657` — derive `refreshing` from all three refetches the
    pull actually kicks off (re-rank, wardrobe, weather), not just
    `isEnhancing`.
12. [P1] `index.tsx:713-722` — add `keyboardDismissMode="interactive"`.
13. [P1] `plate.tsx:76` — import `motion.stagger` instead of the hand-typed 60.
14. [P1] Skeleton→content crossfade on Today (`index.tsx:534→711`): skeleton
    branch `exiting={FadeOut.duration(motion.duration.fast)}`, resolved branch
    `entering={FadeIn.duration(motion.duration.base)}`.
15. [P1] `plate.tsx:440-443` — print `Hold to share` as a `colophon` in the
    credit-line row, first plate only (`index === 0`), until the first
    successful share (persisted flag). Keep the long-press exactly as is.
16. [P1] Copy: `index.tsx:251` "usually unlocks it" → "usually fixes it".

**Must not do:** touch the plate landing springs/haptics or stack geometry;
touch `use-style-context.ts` (T8 owns it); build a shared Notice component;
change `NothingWorks`, the empty-closet state, the masthead, or the offline
banner beyond task 6's ordering.

---

### Territory 4 — Closet, capture, review, item detail
**Model: opus.** The biggest territory: frame fidelity on Closet, the
activation-funnel bug, and the review deck's re-entry.

**Files:** `src/app/(tabs)/closet.tsx` ·
`src/components/closet/closet-grid.tsx` ·
`src/components/closet/item-card.tsx` · `src/components/ui/chip.tsx` ·
`src/app/item/[id].tsx` · `src/app/capture.tsx` · `src/app/review.tsx` ·
`src/components/review/review-card.tsx` ·
`src/components/ingest/consent-sheet.tsx` ·
`src/components/ingest/garment-search-sheet.tsx` ·
`src/components/closet/selection-bar.tsx` ·
`src/features/closet/queries.ts` · `src/features/ingest/upload-queue.ts`

**Tasks:**
1. [P0] `chip.tsx` — add `tone="fill"` (sand ground, no border, radius stays
   `rounded-chip` 12) per D5, and add `Haptics.selectionAsync().catch(...)`
   to the pressable path. Adopt `tone="fill"` for the descriptive style tags
   at `closet.tsx:507-509` and `item/[id].tsx:461`; the category filter stays
   outlined. Accept: matches `03-closet.png`'s tag treatment; selected state
   on the filter still reads; chips tick on tap.
2. [P0] `capture.tsx:255-264` + `:620-627` + `:494` — declining AI consent
   currently does nothing. On decline, render a persistent line in the
   progress sheet's `total === 0` branch: `AI processing is off, so Cinch
   can't cut out or tag photos yet.` with a `Turn it on` secondary Button
   re-opening the sheet. Accept: decline → visible state + one-tap path back.
3. [P0] `capture.tsx:447-474` + `use-capture.ts` guard — extend the shutter's
   `disabled` (and dim) condition to `access !== 'granted' || shooting` so a
   tap during the permission alert cannot fire a second OS prompt.
4. [P0] Review re-entry (audit 06 E1): turn the Closet masthead ellipsis
   (`closet.tsx:295-299`) into a menu (native `ActionSheetIOS` or `Alert`
   options, matching D4's zero-dep rule) with `Review tags (N)` ·
   `Select pieces` · `Profile and settings`. Count from a new
   `head: true, count: 'exact'` variant of `useReviewQueue` in
   `features/closet/queries.ts`; omit the review row when zero. `Select
   pieces` enters selection mode with an empty `picked` set (already handled
   by `selection-bar.tsx:35`). Accept: `/review` reachable after leaving
   capture; a settled closet sees no review row; selection mode has a named
   entrance. Add `accessibilityHint="Hold to select several"` to grid tiles.
5. [P0] `item-card.tsx:106-121` — "Needs review" badge: `canvas`-on-`warning`
   fails at 2.85:1. Set the label in `ink` on the same warning fill (compute
   and confirm ≥4.5:1) or invert to ink-on-`warning/15` wash per the pattern
   `review.tsx:441` gets right. Do not touch the card's a11y grouping.
6. [P0] `capture.tsx:555` — the failed-import banner headline inherits `faint`
   on the warning wash (3.06:1); set it explicitly `muted` like its sibling
   label (matching `review.tsx:441`).
7. [P0] `capture.tsx:437,482` — "Library"/"Describe" fixed `w-16` clips at AX
   sizes: `minWidth: 64` + `numberOfLines={1}` + `adjustsFontSizeToFit` (or
   flex balance). Accept: legible at AX-1.
8. [P0] Closet frame rhythm (vs `03-closet.html`): section gaps
   `closet.tsx:518,:565,:798` `mt-8`→`mt-6`; identity four-up row `mt-7`→
   `mt-5` (`:472-489` context). Accept: two more wardrobe rows above the fold
   against `03-closet.png`.
9. [P1] `closet.tsx:288-294` — the search toggle resets `category` on
   open/close; clear `query` only.
10. [P1] `closet.tsx:524-533` — remove the permanently disabled favourites
    "Edit" affordance (the SEAM comment at `:143-149` records its return).
11. [P1] Item detail: replace the bare spinner (`item/[id].tsx:125-131`) with
    an `ItemSkeleton` built from the existing `Skeleton` primitive (square
    well, title bar, label bar, 2×2 stat bars); replace the missing-item bare
    text (`:148-155`) with `EmptyState`; `SafeAreaView` gains
    `edges={['top']}` (`:245`); adopt `ScreenHeader` (`:251-262`), `Rule`
    (`:519`), `statFigure` (`:635-644`, keep only `color` in style); wrap
    `harmonyCount` in `useMemo` (`:36-48,99`). Accept: no bare full-screen
    spinner remains in the main flow; hero figure identical at 28/1.05/-0.15.
12. [P1] `statSmall` adoption: `closet.tsx:767-772` and `item-card.tsx:170-175`
    swap `variant="stat"` + inline size for `variant="statSmall"`; delete the
    now-unused `leading` imports.
13. [P1] `capture.tsx:338` — screen title `variant="heading"` →
    `variant="plate"` in canvas (serif, matching every other screen title).
14. [P1] `rounded-card` sweep in owned files: `capture.tsx:554`,
    `review.tsx:270,440`, `review-card.tsx:300` → `rounded-plate`. (Alias
    deletion is §V4.)
15. [P1] `consent-sheet.tsx:93` `px-8`→`px-gutter`; `:127` primary
    `h-14 rounded-plate` → `rounded-md`, `minHeight: 52`.
16. [P1] `review.tsx:385-393` — cap the pip bar at 12 pips with a `· N more`
    colophon (or a filled 5pt track above 12). Accept: legible at
    `total = 60`.
17. [P1] `review.tsx:420` — promote `Confirm the N Cinch is sure about` from
    ghost to `variant="secondary"`; copy unchanged.
18. [P1] Review undo: after each confirm, show a ~5s `caption` line under the
    progress row — `Confirmed. Undo` — calling the existing `unresolve(id)`
    plus a `useVerifyItem` patch back to `user_verified: false`
    (`review.tsx:131-137,161-197`). Accept: a mis-swipe is recoverable;
    the pan gesture itself untouched.
19. [P1] `review-card.tsx` — gate the fly-off *duration* under
    `useReducedMotion()` (shorten/skip the throw animation; gesture logic
    untouched, D15); `:353-358` drag-intent overlay text `canvas`→`ink` on
    `bg-positive` (clears AA); `:403` leave the 18pt circles (Swatch deferred);
    `:561-570` Edit/Done toggle gains `active:opacity-60`.
20. [P1] `closet.tsx` hygiene: `GUTTER` import replaces literal `20` at
    `:538,:628,:805` (+ `closet-grid.tsx:70`); named `RAIL_GAP`/`CHIP_GAP`
    constants; `tintColor={theme.muted}` on both RefreshControls
    (`:394,:412`); skeleton→content crossfade at `:318→:406`;
    `keyboardDismissMode="on-drag"` on the FlashList (`closet-grid.tsx:47`);
    `SelectionBar` mounts with `entering={FadeInUp}`/`exiting={FadeOutUp}`
    and `layout={LinearTransition}` on the container below
    (`closet.tsx:309-316`); `closet.tsx:869` raw `#FBFAF6` → `theme.canvas`.
21. [P1] `upload-queue.ts` — map job failure strings to a small user-facing
    vocabulary (`Cinch couldn't read that photo.` / `That upload didn't
    finish.` / `AI processing is off, so this one stayed untagged.`); keep
    `job.error` for logging. `capture.tsx:558-560` renders the mapped string.
    `capture.tsx:581-583` Dismiss label → `Leave them untagged` (hint kept).
    `capture.tsx:415` textShadow black → `rgba(28,26,22,0.55)`.
22. [P1] Copy: `closet.tsx:878-881` empty-closet "…the lot." → `Add a few
    pieces and this fills with your real wardrobe — what you wear, and what it
    costs you to wear it.`
23. [P1] `garment-search-sheet.tsx:106,182` — Close/Remove gain
    `active:opacity-60`.

**Must not do:** touch the review pan-gesture composition, thresholds, or
overlays; alter item-card's a11y grouping or the capture deferred-resume
machinery; change most-worn count size (13 stays per audit 01 — record the
frame deviation); add FlashList pagination; edit `skeleton.tsx` (T2 owns it).

---

### Territory 5 — Plan: density, segmented control, packing
**Model: sonnet.** Well-specified, mostly single-file; the segmented control
is the one delicate task.

**Files:** `src/app/(tabs)/plan.tsx` · `src/components/plan/day-row.tsx` ·
`src/features/plan/mutations.ts` · `src/features/plan/packing-trip.tsx` ·
`src/features/plan/trip-questionnaire.tsx`

**Tasks:**
1. [P0] `day-row.tsx:79` — `py-3.5` → `py-5`. The single most visible fidelity
   gap against any approved frame (`05-plan.png` is airy; the app is ~40%
   denser). Accept: side-by-side match to the frame's row rhythm.
2. [P0] `plan.tsx:219` + `:66` — the segmented control's inner radius equals
   its outer (12/12). Segment radius becomes `concentric(12, 4)` = 8 via
   inline `borderRadius` (import `concentric` from tokens). Accept: concentric
   read next to `UISegmentedControl`.
3. [P0] `plan.tsx:382-385` + `mutations.ts:105-110` — `usePlanOutfit` failure
   is invisible. Add `onError` → inline live-region line under the week list:
   `That day didn't save. Check your connection and try again.` Accept: the
   Week tab's primary action never fails silently.
4. [P0] `plan.tsx:374-386` + `day-row.tsx:84-95,169-171` — `planning` becomes
   per-`dateKey`; committing Tuesday no longer spins all seven rows.
5. [P0] `plan.tsx:346-357` — replace the retry-less "Couldn't plan this week"
   block with `<ErrorState … onRetry>` (same component the branch above
   already uses) and add a `RefreshControl` to the week `ScrollView`. Accept:
   the failure has a way out on its own screen.
6. [P1] Segmented control motion: one absolutely-positioned ink pill whose
   `translateX`/width animate with `spring.snappy` (measured via `onLayout`),
   replacing the conditional `bg-ink` class; `Haptics.selectionAsync()` on
   change (`plan.tsx:60-74`). The invitations dot and a11y state carry over.
   Accept: slide, not swap; VoiceOver announces selection as before.
7. [P1] Day-row detail vs frame: weekday column 40→42pt (`day-row.tsx:99-100`,
   size stays 20 — on-scale); garment line `body`→`callout` (`:146`);
   reasoning line gains `mt-0.5` and **stays `muted`** — drop the
   `text-faint` overrides at `:103,153` (D9/a11y). Section heading rhythm
   `plan.tsx:360-370` → `mb-2`/`mb-2`.
8. [P1] `plan.tsx:235-259` — keep "New event" as the full-width ink primary;
   move "Invite friends" out to a quiet `label` link beneath (same grammar as
   Lately's "Your circle" row). Accept: one primary action per surface.
9. [P1] `packing-trip.tsx:195` "Start again" and
   `trip-questionnaire.tsx:210` "Back" gain `active:opacity-60`.
10. [P1] Copy: `plan.tsx:341` → `Add about ten pieces and the week lays
    itself out.`
11. [P1] Skeleton→content crossfade on the week swap (`plan.tsx:336→346`),
    and `FadeIn/FadeOut(motion.duration.fast)` on the Week/Events/Packing
    subtree swaps.

**Must not do:** touch the "Repeats kept to a minimum" line (D12); reorder the
failure-before-loading-before-absence state machine; edit `EventCard.tsx` or
`day-row`'s a11y sentence label; touch `packing-tab.tsx`'s CTA logic.

---

### Territory 6 — Social surfaces: Lately, events, friends, profile
**Model: opus.** The widest territory by file count; carries three of the five
decisions.

**Files:** `src/app/(tabs)/explore.tsx` · `src/app/(tabs)/_layout.tsx` ·
`src/app/friends/index.tsx` · `src/app/friends/[userId].tsx` ·
`src/app/event/new.tsx` · `src/app/event/[id]/index.tsx` ·
`src/app/event/[id]/outfits.tsx` · `src/app/event/[id]/comments.tsx` ·
`src/components/event-outfits/OutfitPostCard.tsx` ·
`src/components/event-outfits/CommentRow.tsx` ·
`src/components/event-outfits/VotePill.tsx` · `src/app/profile.tsx`

**Tasks:**
1. [P0] `(tabs)/_layout.tsx:77` — tab label `Explore` → `Lately` (D2). Change
   the label string only. Accept: NativeTabs config otherwise byte-identical.
2. [P0] `event/[id]/index.tsx:477-484` — move `VenueCard` below the group
   note, above the "Every option" row (D3). Accept: RSVP → YOUR LOOK with
   nothing between, matching `02-event.png`; the card itself unmodified.
3. [P0] `OutfitPostCard.tsx:239` — crown spring `bouncy` → `snappy` (D1);
   update the local comment to cite tokens.ts canon. Delay, scale, colour,
   and the `useReducedMotion` gate unchanged.
4. [P0] Degender the social copy (verbatim sites confirmed):
   `explore.tsx:243,276,310`; `friends/index.tsx:334`;
   `friends/[userId].tsx:110,138,183,226,276`; `event/[id]/outfits.tsx:223,231`.
   `Her closet` header → the person's name (available at `[userId].tsx:39`) or
   `Their closet`; she/her → they/them throughout. Accept: no gendered
   pronoun about another user anywhere in `src/`; register and sentence
   rhythm preserved.
5. [P0] Report copy unify (D13): `event/[id]/outfits.tsx:210` and
   `event/[id]/comments.tsx:118` drop the 24-hour SLA;
   all four editable sites read `Thank you. Every report is reviewed.`
   Also `friends/index.tsx:27` deletes its local `REPORT_REASONS` and imports
   the canonical export from `features/social-graph/moderation.ts`. Do NOT
   touch `social-terms-sheet.tsx` — flag its line 36 in your report.
6. [P0] `CommentRow.tsx:89` — the hidden-comment caption in `theme.warning`
   (2.85:1) → `muted` (or `critical` if the stronger read is wanted; pick one
   and note it). `OutfitPostCard.tsx:332` — crowned-look colophon drops
   `accentWarm` text to `muted`/`ink`; the tint stays on the crown glyph.
7. [P0] `profile.tsx` + presentation: profile currently has no visible way
   out. Because root `_layout.tsx` belongs to T7, the fix here is a "Done"
   ghost `Button` header row in `profile.tsx` (grammar of
   `review.tsx:364-366`). (T7 independently converts the route to `formSheet`
   + grabber; both together match stylist's dialect — redundancy is fine,
   coordination is not required.)
8. [P1] `OutfitPostCard.tsx` — delete `InitialAvatar` (`:89-109`) in favour of
   `<Avatar size={28} tone="accent">`; replace `BLUSH_SURFACE`/`BLUSH_BORDER`
   locals (`:43-44`) with `theme.blush`/`theme.blushRule` (byte-identical
   values — the tokens exist precisely for this); `:308-325` overflow
   `Alert.alert` → `ActionSheetIOS.showActionSheetWithOptions` with
   `destructiveButtonIndex`. Same ActionSheet swap in `CommentRow`. Crown
   (`:232-252`) and `LookStack` (`:147-210`) otherwise untouched (Protected).
9. [P1] `VotePill.tsx:66` — UI-only optimistic state (D11): local
   tapped-but-unsettled flag flips the label to "Picked" immediately; keep the
   `pending` dim as the working signal; drop the label-replacing spinner. No
   cache writes; reconciles when props land.
10. [P1] `event/[id]/index.tsx` — `ScreenHeader` swap (`:270-282`, keep the
    drawn-in-every-branch behaviour); both hand-rolled error blocks
    (`:487-499`, `:581-591`) → `ErrorState compact`; group note
    `callout`→`body` (`:553-554`); `StatePill` becomes inert status and a
    quiet `critical` text link `Leave this occasion` joins the page foot
    beside the host's cancel (`:436-437`, `:627-638`).
11. [P1] `friends/index.tsx` — three hand-rolled error blocks
    (`:222-233,272-283,313-324`) → `ErrorState compact`; `ScreenHeader` swap
    (`:165-176`); `Rule` ×3 (`:241,287,339`); `ListSkeleton count={2}` for the
    loading rows (`:326-329`); bare no-friends text (`:330-334`) →
    `EmptyState compact`; `Not now` added to `requestOptions` (`:132-139`)
    dismissing the row locally via a persisted set — nothing written to the
    server. `tintColor={theme.muted}` on the RefreshControl (`:208`).
12. [P1] `friends/[userId].tsx` — `ScreenHeader` with `trailing` for the
    overflow disc (`:174-192`); `GUTTER` for the literal 20 (`:242`);
    Unfriend gains `style: 'destructive'` (`:161-168`); empty-state copy stops
    pointing at another screen: `Their closet is empty, or it isn't open to
    you right now.` + `Try again` wired to `closet.refetch()` (`:226`);
    RefreshControl tint.
13. [P1] `explore.tsx` — `Rule` swap (`:222`); `refreshing` combines all three
    refetches (`following` included); duplicated "Your circle ›" rows
    (`:281-295`, `:344-358`) get one margin.
14. [P1] `event/new.tsx` — `ScreenHeader` swap (`:174`); `rounded-full` date
    selector → `rounded-md` (`:78`, D6); disabled "Plan it" gains the
    explaining caption `Give it a name and Cinch can plan it.` when title is
    empty (`:125`, `:369-376`).
15. [P1] `event/[id]/outfits.tsx` — `ScreenHeader` swap (`:261`);
    `snapToInterval={300 + 12}` + `decelerationRate="fast"` +
    `snapToAlignment="start"` on the boards rail (`:458`); memoize
    `BoardBand` and lift `commentCountFor`/`voterNamesFor` into `useMemo`
    maps (`:139-148`).
16. [P1] `event/[id]/comments.tsx` — `ScreenHeader` swap (`:144`); memoize
    `CommentRow`.
17. [P1] `profile.tsx` — `Rule` ×6 (`:450,504,510,522,524,526`); name
    `plate`→`title` (`:335`, matching Closet's identity block); delete caption
    left-aligned (`:534-536`); learning bar stays `accent` but note the
    ProgressTrack deferral; Privacy/Support rows swap chevron for
    `arrow.up.right` (`:521-523`); retry pressable gains `active:opacity-60`
    (`:339`).
18. [P1] Closet-entry naming: profile is reached from Closet via T4's
    ellipsis menu (`Profile and settings`) — no action here beyond keeping
    labels consistent if touched.

**Must not do:** touch `social-terms-sheet.tsx`, `use-social-terms.ts`, or
`event-outfits/mutations.ts` (charter-fenced; D16); restructure the event
page's YOUR-LOOK → grid → note order (Protected); touch the NativeTabs config
beyond one label; add `onMutate` anywhere (D11); edit `VenueCard.tsx` itself.

---

### Territory 7 — Sign-in, system shell, type-system contrast
**Model: opus.** First-screen quality plus a change to the shared `Text`
component that shifts tone app-wide — needs judgment.

**Files:** `src/app/(auth)/sign-in.tsx` · `src/app/auth-callback.tsx` ·
`src/app/_layout.tsx` · `src/components/ui/text.tsx`

**Tasks:**
1. [P0] `text.tsx:50,52` — `eyebrow` and `colophon` default `text-faint` →
   `text-muted` (D9). Accept: both variants ≥4.5:1 on canvas/surface/tray;
   the tracking, casing, and sizes unchanged. Visually verify Today's
   masthead and a plate colophon still read as the quiet layer (muted is one
   step darker, not a new voice).
2. [P0] `sign-in.tsx:435-531` — every raw `RNText` in the hero gets an
   explicit `maxFontSizeMultiplier` matching the shared caps (1.4 for
   display-class, 1.8 otherwise). Accept: at AX sizes nothing overlaps or
   clips against the absolute-positioned geometry.
3. [P0] `sign-in.tsx:546,561,627` — `height: px(50)` → `minHeight: px(50)` on
   the Apple button wrapper, email button, and send disc (the field at `:614`
   already has the fix). Accept: labels never clip at AX sizes.
4. [P1] `sign-in.tsx:562,612` — "Continue with email" and the email field drop
   `rounded-full`/`px(26)` for 12px radius (`px`-scaled equivalently); Apple's
   own button keeps its capsule (D6).
5. [P1] `sign-in.tsx:683-701` — rebuild the Terms/Privacy line as one `Text`
   with nested pressable spans so wrap points fall between words, not
   fragments. Keep `hitSlop`; add `active:opacity-60` to the links; same for
   the send arrow (`:621-639`) which also gains
   `Haptics.selectionAsync().catch(...)` on send.
6. [P1] `sign-in.tsx:468,495,535,579,653` — gate the entrance animations on
   `useReducedMotion()` (static end-state when set).
7. [P1] Magic-link wait state (`sign-in.tsx:663-675`): body line becomes
   `Open it on this device to finish signing in.`; add `Nothing yet? Check
   the spam folder, or send it again.` with primary `Send it again` and a
   smaller `Use a different address` beneath.
8. [P1] `auth-callback.tsx:75` — replace the bare spinner with the canvas
   ground, serif wordmark, one `body` line (`Signing you in…`), and the
   tinted `Spinner` from `skeleton.tsx` (import only — do not edit skeleton).
9. [P1] `_layout.tsx:172-178` — the session-hydration gate gets the same
   canvas + wordmark treatment (or minimally `color={theme.muted}`); Accept:
   the first frame after splash is on-brand, not iOS blue-grey on paper.
10. [P1] `_layout.tsx:239-240` — pin `ThemeProvider` and `StatusBar` to
    light; delete the dead `isDark` branches.
11. [P1] `_layout.tsx:283-286` — `profile` route becomes
    `presentation: 'formSheet'` with `sheetGrabberVisible` (and the `sheet`
    corner radius), matching the stylist dialect. `capture` stays a
    full-screen modal (a camera stage is not a sheet).

**Must not do:** touch `HeroScrim` values or positions (`sign-in.tsx:222-245`,
D10); convert the `px()` system to tokens; change the stylist route options
(`:273-282`, Protected); edit `skeleton.tsx`; loosen `text.tsx`'s Dynamic
Type caps.

---

### Territory 8 — Stylist, context services, search hygiene
**Model: sonnet.** Two confirmed bugs with surgical fixes, plus contained
stylist polish.

**Files:** `src/app/stylist.tsx` · `src/features/stylist/use-chat.ts` ·
`src/features/stylist/use-questionnaire.ts` ·
`src/components/stylist/message-bubble.tsx` ·
`src/features/context/use-style-context.ts` ·
`src/features/social-graph/queries.ts` · `src/features/events/queries.ts` ·
`src/lib/use-debounced-value.ts` (new)

**Tasks:**
1. [P0] **Calendar permission persistence** —
   `use-style-context.ts:116`: `calendarEnabled` is `useState(false)`,
   forgotten every mount. Seed from `Calendar.getCalendarPermissionsAsync()`
   in a mount effect and re-read on `AppState` foreground (the exact pattern
   `use-camera-access.ts:64-69` uses). Accept: after a granted session,
   a cold start shows today's events without re-asking; the connect CTA
   never reappears for a user who already granted.
2. [P0] **Stylist `clear()` wiring** — `use-chat.ts:394-405` exposes `clear`;
   `stylist.tsx:146` never destructures it, so the designed opening (greeting,
   four doors, questionnaire) is reachable exactly once per account. Add a
   quiet right-aligned `label` control to `StylistHeader`
   (`stylist.tsx:39-56`): `New question`, calling `clear()`. Accept: opening
   composition reachable on demand; thread persistence otherwise unchanged.
3. [P1] `message-bubble.tsx:50-80` — wrap each outfit-strip cell in
   `overflow-hidden rounded` (the 8px DEFAULT token) with
   `contentFit="cover"`, matching `04-stylist.png`'s four crisp photo cells.
   `:51` `rounded-card` → `rounded-plate`. `:81-83` strip caption
   `numberOfLines={1}` → `{2}`. `:145` "Try again" gains
   `active:opacity-60`. Bubble radii/padding untouched (Protected).
4. [P1] `stylist.tsx:404-421` — the send button gains `active:opacity-60` and
   `Haptics.selectionAsync().catch(...)` on send.
5. [P1] `stylist.tsx:277` + `:147-150` — delete the `scrollSoon` double-scroll;
   keep the `onContentSizeChange` handler as the single scroller.
6. [P1] `stylist.tsx:73` vs `:86` — `AnswerChip` and `StartRow` converge on
   `rounded-md` + `border-rule`; `:346-354` answer grid gains `mt-3`.
7. [P1] Questionnaire Back: add the same underlined `Back` control the trip
   questionnaire has (`stylist.tsx:356-369`), wired to a `back()` step on the
   questionnaire hook.
8. [P1] Search debounce (audit 08/16): new
   `src/lib/use-debounced-value.ts` (~15 lines, ~200ms); apply inside
   `useProfileSearch` (`social-graph/queries.ts:161`) and
   `useInviteCandidates` (`events/queries.ts:244`) so the `queryKey` sees the
   debounced value. Accept: fast typing fires ≤1 request per pause, results
   still correct (React Query key cancellation already orders them).
9. [P1] Copy: `stylist.tsx:297-300` → `Or just say it. The stylist answers
   with clothes you own — and tells you plainly when you don't own the right
   thing.`

**Must not do:** touch the composer's capsule (D6) or the header/loading
compositions (`stylist.tsx:39-56` beyond adding the one control, `:235-250`);
change thread persistence semantics beyond wiring `clear`; touch mutation
files; edit `explore.tsx`/`invite.tsx` call sites (the debounce lives in the
hooks).

---

## F · Verification — the final review pass

Run after all eight worktrees merge, in order:

- **V1 — Static:** `npm run typecheck` and `npm run lint` clean on the merged
  tree. Run the existing test suite; zero regressions.
- **V2 — Cross-territory greps:** no remaining `spring.bouncy` outside
  `plate.tsx`; no `text-faint` override on non-redundant content reintroduced;
  no `she |her |Her ` pronouns about other users in `src/`; no
  `rounded-full` on a labelled wider-than-tall control outside the two
  recorded exceptions; `clear(` wired in stylist; no new `onMutate`; no edits
  inside any do-not-touch file (`git diff --stat` against the fence list —
  especially `social-terms-sheet.tsx` and `event-outfits/mutations.ts`).
- **V3 — Simulator visual pass against the five approved frames**
  (`docs/app-store/screenshots/`): Today (rhythm, plate footer), Closet
  (filled tags, section gaps), Plan (row density, segmented control), Stylist
  (strip cells, bubbles untouched), Event (Going → YOUR LOOK order). Each
  screen side-by-side with its PNG; deviations recorded per D5/D12 are
  expected, anything else is a defect.
- **V4 — Integration-only edits (this pass owns them):** delete the
  `rounded-card` alias from `tailwind.config.js` after grep confirms zero
  usages; amend the config's radius note to record the two capsule exceptions
  (D6); grep `rounded-chip` usages and retire the alias only if clean.
- **V5 — Reduce Motion spot check** (simulator setting on): plate landing
  renders settled, skeletons hold static, no spinning `Spinner`, review deck
  still confirms via buttons, sign-in entrances static, crown appears without
  bounce.
- **V6 — Dynamic Type spot check on sign-in** at AX-1 and AX-3: no clipped
  pill labels, the Terms line wraps as a sentence, hero text never overlaps.
  Same pass over capture's Library/Describe labels. Also run the two deferred
  verifications from §C: block-confirmation copy at every `useBlockUser` call
  site, and composer draft survival on background.
- **V7 — Interaction smoke pass:** reaction tap (card height stable, Never
  mind works), wear failure path (airplane mode), plan-a-day failure path,
  consent decline → recovery line, review re-entry via the Closet ellipsis
  with a non-empty queue and its absence with an empty one, calendar events
  surviving an app restart, "New question" resetting the stylist, VotePill
  showing "Picked" pre-settle, profile dismissal via grabber and Done.

---

## G · Priority tally

- **P0 — 34** (frame fidelity, confirmed bugs, a11y blockers, charter-conflict
  resolutions)
- **P1 — 70** (Instagram-bar polish, consistency adoption, feedback states)
- **P2 — 20** (Deferred, §C, with reasons)

The fix wave executes P0 + P1. P2 items are recorded, not scheduled.
