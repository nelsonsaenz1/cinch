# 03 — Motion and interaction audit

Read-only audit of every interactive surface under `src/`, judged against the
Instagram-polish bar set by `docs/refurb/CHARTER.md`. Classifications are the
charter's own: *preserve exactly / minor polish / visually refine / improve
interaction / consolidate into component / fix inconsistency / fix friction /
add missing state / reject*.

## 0. The headline

The app's **motion vocabulary is written but almost entirely unspent.**
`src/theme/tokens.ts:114-129` defines four springs and five duration tokens.
Across the whole of `src/`:

| Token | Call sites |
| --- | --- |
| `spring.smooth` | 2 (`plate.tsx:121`, `plate.tsx:164`) |
| `spring.snappy` | **0** |
| `spring.bouncy` | 2 (`plate.tsx:121/164`, `OutfitPostCard.tsx:239`) |
| `spring.interactive` | 1 (`review-card.tsx:206`) |
| `motion.duration.slow` | 2 (`review-card.tsx:197/203`) |
| `motion.duration.fast` / `.base` | **0** |
| `motion.stagger` | **0** (`plate.tsx:76` re-types the 60 by hand) |

Five files in the entire codebase import Reanimated (`sign-in.tsx`,
`OutfitPostCard.tsx`, `review-card.tsx`, `plate.tsx`, `skeleton.tsx`). There is
**not one layout animation in the app** — no `LinearTransition`, no
`entering`/`exiting` outside the sign-in screen. Every list insertion, filter
change, mode switch, skeleton→content handover and state swap is a hard,
single-frame pop.

The two places motion *was* built — the plate landing and the review deck — are
excellent and should be preserved verbatim. The gap is not craft, it is
coverage: `snappy`, the preset explicitly reserved for "buttons, chips,
selection", has never been used.

---

## 1. Press feedback

### The shared pressable

- **[preserve exactly]** `src/components/ui/button.tsx:46-95` — one shared
  Button with variant, disabled, loading, 44pt floor and an inline-style label
  colour. The right primitive exists and is widely used (49 call sites).
- **[improve interaction]** `src/components/ui/button.tsx:78` — feedback is
  `active:opacity-70` only. NativeWind's `active:` is a *class toggle*: it snaps
  from 1.0 to 0.7 on press-in and back on press-out with no interpolation, and
  it carries no scale. Every native iOS control the user compares this to
  compresses slightly. **Proposal:** a shared `usePressFeedback()` returning
  `{ onPressIn, onPressOut, style }` — `scale` to `0.97` and `opacity` to `0.8`
  on press-in with `withTiming(motion.duration.fast)`, back to `1` with
  `withSpring(spring.snappy)` on release. This is the single highest-leverage
  change in this document: it lands on all 49 Button sites plus Chip at once.
- **[fix inconsistency]** Pressed opacity has four values across 86 call sites:
  `opacity-60` × 53, `opacity-70` × 22, `opacity-80` × 8, `opacity-90` × 3.
  Representative: `chip.tsx:33` (60), `button.tsx:78` (70), `item-card.tsx:70`
  (80), `closet.tsx:868` (90), `closet.tsx:545` (80) vs `closet.tsx:750` (70)
  for two rails on the *same screen*. **Proposal:** one `PRESSED_OPACITY`
  constant beside `MIN_TAP_TARGET` in `tokens.ts`, consumed by the shared hook.

### Pressables with no press feedback at all

Each of these is a live control that gives the user nothing on touch.

- **[fix friction]** `src/app/stylist.tsx:404-421` — the stylist **send button**.
  The most-tapped control on the screen: no `active:`, no scale, no haptic. Its
  only state change is the colour swap that already happened when the draft
  became non-empty. → shared press hook + `Haptics.selectionAsync()` on send.
- **[fix friction]** `src/app/(auth)/sign-in.tsx:621-639` — the magic-link send
  arrow. Same shape as above, on the app's first screen.
- **[fix friction]** `src/app/(auth)/sign-in.tsx:687`, `:696` — Terms and Privacy
  links. `hitSlop={8}` only. → `active:opacity-60`.
- **[fix friction]** `src/app/capture.tsx:345` (Done), `:432` (Library), `:476`
  (Describe). The comment at `capture.tsx:273-275` states outright that "haptics
  no-op during a camera session … so the pressed state is the real feedback" —
  and then two of the three controls in that row have no pressed state. Only the
  shutter (`:456`) carries `active:opacity-80`. This is the darkest screen in the
  app; a control that does nothing on touch reads as frozen.
- **[fix friction]** `src/app/event/[id]/invite.tsx:63` — the sheet's Done.
- **[fix friction]** `src/app/profile.tsx:339` — "Your details didn't load — try
  again". A retry affordance with no touch response is indistinguishable from
  static text.
- **[fix friction]** `src/components/review/review-card.tsx:561-570` — the
  Edit/Done toggle. `review.tsx:379-383` calls these "the deck's one invitation
  to correct something, and now its ONLY accent" — and it has no pressed state.
- **[fix friction]** `src/components/ingest/garment-search-sheet.tsx:106`
  (Close), `:182` (Remove).
- **[fix friction]** `src/components/stylist/message-bubble.tsx:145` — "Try
  again" after a failed turn.
- **[fix friction]** `src/features/plan/packing-trip.tsx:195` — "Start again".
- **[fix friction]** `src/features/plan/trip-questionnaire.tsx:210` — "Back".
- **[preserve exactly]** `src/components/today/plate.tsx:440-443` — the
  long-press share wrapper correctly has *no* pressed state; dimming the plate
  under a scrolling thumb would be wrong.
- **[preserve exactly]** `src/app/friends/[userId].tsx:259/268`,
  `src/components/ingest/consent-sheet.tsx:76` — scrim/tap-catcher Pressables
  correctly have no visual state and are hidden from assistive tech.

### Long-press quality

- **[improve interaction]** `src/components/closet/item-card.tsx:67` +
  `src/app/(tabs)/closet.tsx:226-231` — entering selection mode uses the default
  500ms `delayLongPress` with **no pre-commit visual**. The comment at
  `closet.tsx:227` admits it: "Long press has no visual until the mode arrives,
  so the tick alone is late feedback." **Proposal:** a `Gesture.LongPress()`
  from gesture-handler driving `scale` 1 → 0.94 over the hold with
  `withTiming(motion.duration.base)`, released with `spring.snappy` on
  activation. That is what makes a hold feel like it is *loading*.
- **[preserve exactly]** `src/components/today/plate.tsx:441-442` —
  `delayLongPress={350}` for share is deliberately shorter than the default and
  paired with a Rigid impact at `:400`. Correct.

---

## 2. Haptics

Present in 8 files. The vocabulary itself is well chosen (Soft = landing, Rigid
= shutter, Medium = love, Light = everything else, Success = swipe-confirm,
Error = share failure). The problem is distribution.

- **[preserve exactly]** `src/components/today/plate.tsx:223-232` — the landing
  impact, fired on a timer at `landingDelay(last) + 200` so the plate regime
  (Skia nodes, not RN views) still gets it, and gated to `index === 0` so only
  the day's first card taps. This is the best haptic in the app.
- **[preserve exactly]** `src/components/today/plate.tsx:400` (Rigid shutter),
  `:411` (Error notification when the capture fails after the user already felt
  the shutter). Both reasoned in comments; leave alone.
- **[preserve exactly]** `src/components/review/review-card.tsx:163-184` —
  Success for a swipe-confirm, plain selection for the button path, and nothing
  at all for a skip ("a skip is not an accomplishment"). Exemplary discrimination.

### Missing haptics

- **[fix inconsistency]** `src/components/ui/button.tsx:42` — `haptic` defaults
  to `false`. **30 of 49 Button call sites omit it**, including every destructive
  and every commit action: `review.tsx:419` (Confirm the N Cinch is sure about),
  `review.tsx:444` (Retry), `item/[id].tsx:152`, `friends/index.tsx:227/277/318`
  (friend request accept/decline), `event/[id]/index.tsx:313/453/493/586` (RSVP,
  post a look), `edit-profile-sheet.tsx:216` (Save), `consent-sheet.tsx:140`
  (Allow), `BorrowRequestRow.tsx:118/129/139` (approve/decline a borrow),
  `RosterRow.tsx:66`, `social-terms-sheet.tsx:116`, `review-card.tsx:486`.
  **Proposal:** invert the default to `haptic = true` and let the handful of
  cases that must stay silent opt out. Every one of these is a discrete
  commitment; `selectionAsync` is the correct tick for all of them.
- **[add missing state]** **No destructive confirm anywhere fires a warning
  haptic.** `Haptics.notificationAsync(Warning)` appears zero times. Sites that
  want it at the moment the Alert's destructive button is pressed:
  `closet.tsx:238-269` (bulk remove — *"their photos are deleted"*),
  `item/[id].tsx` delete, `friends/[userId].tsx` block/unfriend,
  `OutfitPostCard.tsx:318` (Retire this look), `profile.tsx` delete-account,
  `BlockedList.tsx`.
- **[add missing state]** Selection changes with no haptic:
  - `src/app/(tabs)/plan.tsx:60-74` — the Week / Events / Packing segmented
    control. A segment change is the textbook `selectionAsync` case.
  - `src/components/ui/chip.tsx:20-57` — the Chip has **no haptic path at all**,
    and its own docblock calls it "the workhorse of tag editing … a correction
    to take one tap". The closet's category row (`closet.tsx:630`), the review
    deck's category correction (`review-card.tsx:380`) and the stylist's quick
    chips (`stylist.tsx:376-378`) all fire nothing.
- **[add missing state]** No success feedback on completion, only on intent:
  `plate.tsx:314` taps on *press* of "I wore this" but nothing when the wear
  actually lands; `VotePill.tsx:57` the same for a pick. A light Success
  notification in the mutation's `onSuccess` closes the loop.
- **[fix inconsistency]** `src/components/today/reaction-bar.tsx:117` — the only
  `Haptics.impactAsync` in the app with **no `.catch()`**. Every other call site
  guards. An unhandled promise rejection on a device with Taptic disabled.

### Where haptics would be noise — do not add

- Row taps that merely navigate (`ProfileRow`, `EventCard`, `DayRow`,
  `MostWornRow`, `FriendItemCard`). iOS does not tick on a push.
- Scroll-position or skeleton→content transitions.
- The closet grid's per-tile tap when opening an item.

---

## 3. Screen, tab, modal and sheet transitions

### Navigators

- **[preserve exactly]** `src/app/(tabs)/_layout.tsx:48-79` — native
  `NativeTabs` with Liquid Glass, `minimizeBehavior="onScrollDown"`, dynamic
  colours. This is the one genuinely unfakeable native surface and it is done
  right.
- **[preserve exactly]** `src/app/_layout.tsx:50` `unstable_settings.anchor`,
  and `:273-282` the stylist `formSheet` at `[0.75, 1]` with a grabber and the
  38pt sheet radius — matched by `src/app/event/_layout.tsx:17-25` so the app
  has exactly one idea of a half sheet.
- **[minor polish]** `src/app/_layout.tsx:257` — the root Stack sets no
  `animation`, so every push is the platform default slide. That is correct for
  iOS; noted only to record that it was checked, not defaulted-into by neglect.

### Five dialects of "sheet"

- **[consolidate into component]** The two `formSheet` routes above are dialect
  one. There are four more, all hand-built:
  - `src/features/profile/edit-profile-sheet.tsx:157` — RN `<Modal
    animationType="slide" presentationStyle="pageSheet">`.
  - `src/components/ingest/garment-search-sheet.tsx:98` — same.
  - `src/components/social/social-terms-sheet.tsx:64` — same. *(charter: do not
    touch this file — note only.)*
  - `src/components/ingest/consent-sheet.tsx:60-91` — transparent Modal + scrim
    + hand-drawn grabber at `:90` + `rounded-t-plate` card.
  - `src/app/friends/[userId].tsx:254-269` — transparent Modal, hand-built
    bottom card, hand-built scrim.
  Five presentations, three different corner treatments, two different grabbers,
  and only the router ones get the real iOS detent/drag physics.
  **Proposal:** one `Sheet` component wrapping the `formSheet` route
  presentation (detents `[0.75, 1]`, grabber, radius 38) and migrate the
  Modal-based ones behind it. Where a route is genuinely wrong (consent must
  appear over capture without changing the URL), keep the Modal but standardise
  the scrim (`theme.scrim`, already tokenised), the radius and the grabber.

### Layout animation — the biggest gap

**[add missing state]** Zero layout animations. Concretely, these all pop:

- `src/app/(tabs)/closet.tsx:309-316` — `SelectionBar` mounts/unmounts and
  shoves the entire grid down by its own height in one frame. Should be
  `entering={FadeIn.duration(motion.duration.fast)}` /
  `exiting={FadeOut}` on the bar plus `layout={LinearTransition.springify()}`
  on the container below it.
- `src/components/today/reaction-bar.tsx:120 / :176 / :203` — three completely
  different subtrees (two pills → six reason chips → one filled pill + a status
  line). The card's height jumps twice per reaction. `LinearTransition` on the
  plate's footer plus `FadeIn/FadeOut` on each branch turns the most-used
  interaction on Today from a flicker into a fold.
- `src/app/(tabs)/closet.tsx:167-177` + `closet-grid.tsx:47` — the category chip
  refilters the FlashList with a hard swap.
- `src/app/(tabs)/plan.tsx:230/323/328` — Week/Events/Packing swap whole
  subtrees instantly.
- `src/app/review.tsx:477-533` — the top card flies off correctly, but the card
  promoted from `depth 1 → 0` jumps `scale 0.96 → 1.0` and `translateY 6 → 0` in
  one frame (`review-card.tsx:219-220` computes them as plain values, not
  animated). The deck's own physics stop the instant the throw ends.
- `src/app/friends/index.tsx`, `src/app/(tabs)/explore.tsx` — accepting a
  request or unfriending removes a row with no exit.
- `src/components/ingest/upload-queue-list.tsx:96-102` — thumbnails append to a
  horizontal rail with no entrance, during the app's single most "is it working?"
  moment.

### Segmented control

- **[improve interaction]** `src/app/(tabs)/plan.tsx:60-74` — the active pill is
  a conditional `bg-ink` class. No sliding indicator, no haptic, no press scale.
  **Proposal:** one absolutely-positioned ink pill whose `translateX`/`width`
  animate with `spring.snappy` on selection, plus `Haptics.selectionAsync()`.
  This is where `snappy` was designed to live.

---

## 4. Loading → content

- **[preserve exactly]** `src/components/ui/skeleton.tsx` in its entirety —
  shape-matched skeletons (`ClosetGridSkeleton:136` tracks `item-card.tsx:72`
  cell-for-cell; `PlateSkeleton:249` reserves the stack's real aspect), ragged
  widths (`LABEL_WIDTHS:121`, `ROW_WIDTHS:182`) so a column doesn't stripe, a
  percentage-based sweep needing no `onLayout`, and `accessibilityElementsHidden`
  throughout. Excellent, and used on 20+ screens.
- **[fix friction]** **The skeleton→content handover is a hard cut everywhere.**
  `closet.tsx:318` → `:406`, `index.tsx:534` → `:711`, `plan.tsx:336` → `:346`,
  `event/[id]/index.tsx:288`, `review.tsx:263`. A 1300ms shimmer that vanishes
  in one frame is the most visible non-Instagram moment in the app. **Proposal:**
  wrap the resolved branch in `<Animated.View entering={FadeIn.duration(motion.duration.base)}>`
  and the skeleton in `exiting={FadeOut.duration(motion.duration.fast)}`. Because
  the skeletons already match the content geometry, a crossfade genuinely reads
  as "the page developing", not as two screens swapping.
- **[fix inconsistency]** Bare `ActivityIndicator` still stands in for a designed
  state in two whole-screen cases, which `skeleton.tsx:39` explicitly calls the
  bug it was created to fix:
  - `src/app/_layout.tsx:172-178` — a centred system spinner on the app's very
    first frame while the session hydrates. This is the first thing every
    returning user sees.
  - `src/app/item/[id].tsx:128` — whole-screen spinner for item detail.
  - Secondary: `auth-callback.tsx:75`, `garment-search-sheet.tsx:446`,
    `profile.tsx:136/494`, `item/[id].tsx:444/592`.
  - **[preserve exactly]** In-button spinners are correct and should stay:
    `button.tsx:85`, `VotePill.tsx:67`, `selection-bar.tsx:69`, `plate.tsx:324`,
    `invite.tsx:161`, `day-row.tsx:86`, `message-bubble.tsx:125`.
- **[fix inconsistency]** `skeleton.tsx:45` and `:78` run `withRepeat(..., -1)`
  forever with **no `useReducedMotion` guard and no `cancelAnimation` on
  unmount**. Same at `upload-queue-list.tsx:38-47` (RN `Animated.loop`).
- **[fix inconsistency]** expo-image `transition` is hand-typed at five different
  values across 16 sites — `0` (`sign-in.tsx:206`, `plate-card.tsx:181`,
  `garment-cell.tsx:216` when `paper`), `120` (`upload-queue-list.tsx:74`), `150`
  (`avatar.tsx:107`, `message-bubble.tsx:64`, `ProfileRow.tsx:60`,
  `BorrowRequestRow.tsx:72`), `180` (six sites), `200` (`item/[id].tsx:270`,
  `garment-cell.tsx:216`, `plate-thumb.tsx:62`). None of them is a token, while
  `motion.duration.fast/base/slow` sit unused. And five `<Image>`s have no
  transition at all: `ghosted-rail.tsx:171`, `day-row.tsx:130`,
  `garment-search-sheet.tsx:173`, `review-card.tsx:74`, `ghost-slot-grid.tsx:71`.
  **Proposal:** `transition={motion.duration.base}` as the house value, `fast`
  for ≤52pt thumbs, `0` only where a Skia/view-shot capture demands it (those
  three sites document why).
- **[add missing state]** No `placeholder` on any expo-image, and `recyclingKey`
  is set on only four of sixteen (`item-card.tsx:82`, `garment-cell.tsx:214`,
  `FriendItemCard.tsx:54`, `new-addition-row.tsx:92`). `plate-thumb.tsx:59`,
  `avatar.tsx:104`, `ProfileRow.tsx:57` and `BorrowRequestRow.tsx:69` all render
  inside recycled rows without one — the previous row's image flashes before the
  new one fades in. Adding `recyclingKey` is a one-line fix per site with a
  visible payoff on the closet rails and every friends list.

---

## 5. Keyboard

- **[preserve exactly]** `src/components/ui/keyboard-aware-scroll-view.tsx` —
  the correct two primitives, `automaticallyAdjustKeyboardInsets` for forms and
  `KeyboardAvoidingView behavior="padding"` for docked composers, both defaulting
  `keyboardShouldPersistTaps="handled"` and `keyboardDismissMode="interactive"`.
  Used on 12 screens. The reasoning for not adding
  `react-native-keyboard-controller` is sound and charter-compliant.
- **[preserve exactly]** Focus management is deliberate throughout:
  `stylist.tsx:200` (escape-to-typing focuses the composer), `closet.tsx:363`,
  `invite.tsx:81`, `trip-questionnaire.tsx:87` (autoFocus on open),
  `review-card.tsx:446` and `item/[id].tsx:370` (autoFocus on reveal),
  `explore.tsx:279` (empty-state CTA focuses the search field).
- **[fix friction]** `src/app/(tabs)/closet.tsx:360` + `closet-grid.tsx:47` —
  the closet search field sits outside the FlashList (correctly, per the comment
  at `closet.tsx:79`), but `ClosetGrid` sets **no `keyboardDismissMode`**. Type a
  query, then scroll the results, and the keyboard stays up over half the grid
  you are trying to read. → `keyboardDismissMode="on-drag"` on the FlashList.
- **[fix friction]** `src/app/(tabs)/index.tsx:713-722` — Today's ScrollView sets
  `keyboardShouldPersistTaps` but not `keyboardDismissMode`. The plans note
  (`index.tsx:752`) can only be dismissed with the Done key; a scroll does
  nothing. → `keyboardDismissMode="interactive"`.
- **[fix friction]** `src/app/stylist.tsx:277` — `onContentSizeChange` calls
  `scrollToEnd({animated:true})` on *every* content-size change, including the
  relayout the keyboard causes, while `scrollSoon` (`stylist.tsx:147-150`) fires
  a second animated `scrollToEnd` 80ms later. Two scrollers race on every send.
  → keep the `onContentSizeChange` handler, delete `scrollSoon`.
- **[minor polish]** No `keyboardAppearance` anywhere. The app is pinned light
  (`app.config.ts:71`), so the keyboard should be pinned too —
  `keyboardAppearance="light"` on every `TextInput`, and explicitly `"dark"` on
  the capture screen's dark stage if a field ever lands there.

---

## 6. Pull-to-refresh, scroll and gesture quality

- **[fix inconsistency]** `RefreshControl` `tintColor` is set on three of eight
  call sites — `index.tsx:659`, `index.tsx:720`, `explore.tsx:196` — and omitted
  on `closet.tsx:394`, `closet.tsx:412`, `borrow.tsx:151`,
  `friends/index.tsx:208`, `friends/[userId].tsx:245`. Five screens show iOS's
  cool system gray inside a warm-paper app.
- **[fix friction]** `src/app/(tabs)/index.tsx:657` —
  `refreshing={outfits.isEnhancing}` binds the pull spinner to the AI re-rank,
  but `refresh()` (`index.tsx:505-518`) invalidates the wardrobe and weather too.
  When the re-rank is denied or disabled the spinner snaps away while the real
  work is still in flight — pull-to-refresh appears to do nothing. → derive
  `refreshing` from all three.
- **[add missing state]** No pull-to-refresh at all on:
  `src/app/(tabs)/plan.tsx` (all three modes — the week, the invitations and the
  packing brief are all server-derived), `src/app/event/[id]/index.tsx`,
  `src/app/event/[id]/outfits.tsx` (the board other people post to),
  `src/app/event/[id]/comments.tsx`, `src/app/item/[id].tsx`,
  `src/app/profile.tsx`. Plan and the outfit board are the two that will be
  noticed.
- **[improve interaction]** Horizontal rails have no snapping and default
  deceleration: `closet.tsx:535` (Favourites, 124pt plate + 14pt gap),
  `closet.tsx:802` (Latest pieces), `outfits.tsx:458` (300pt look boards).
  The boards especially should page — one attendee's board per screenful.
  → `snapToInterval={PLATE + GAP}` + `decelerationRate="fast"` on the rails;
  `snapToInterval={300 + 12}` + `snapToAlignment="start"` on the boards.
  **[preserve exactly]** `closet.tsx:625` (category chips) must stay free-scroll.
- **[improve interaction]** No swipe actions anywhere in the app. The rows where
  iOS users reach for one: `friends/index.tsx` request rows (accept / decline
  currently two inline Buttons), `borrow.tsx` threads,
  `event/[id]/comments.tsx` rows, `BlockedList.tsx` rows. Gesture-handler is
  already installed and already used by the review deck.
- **[improve interaction]** `src/components/event-outfits/OutfitPostCard.tsx:308-325`
  and `src/components/event-outfits/CommentRow.tsx:51-…` — the ⋯ overflow opens
  `Alert.alert` with destructive buttons. An Alert is a *blocking interruption*;
  iOS uses an action sheet or a native context menu for content overflow. Two
  zero-new-dependency routes: RN's own `ActionSheetIOS` (correct minimum), or
  `@expo/ui` (already in `package.json`) which ships a SwiftUI `ContextMenu` —
  a long-press context menu on the look card would also give the free lift,
  blur and haptic that make Instagram's post menu feel native. The charter's
  "no new dependencies" rule is satisfied either way.
- **[preserve exactly]** `src/components/review/review-card.tsx:186-241` — the
  pan gesture. `activeOffsetX([-8, 8])` so a vertical drag scrolls the card's
  own form instead of swiping it; velocity-weighted threshold
  (`e.translationX + e.velocityX * 0.15`); `spring.interactive` snap-back;
  live `acceptOverlay`/`skipOverlay` driven by `interpolate` with
  `Extrapolation.CLAMP`; a rotation that reads as a thrown card; and real
  buttons at `:486`/`:503` because VoiceOver cannot pan. This is the app's best
  interaction and the reference for everything else.
- **[improve interaction]** `review-card.tsx:197` and `:203` — the fly-off is
  `withTiming(motion.duration.slow)`, which discards the throw. The user's
  velocity is right there in `e.velocityX`. →
  `withSpring(SCREEN_WIDTH * 1.4, { ...spring.smooth, velocity: e.velocityX })`
  so a hard flick leaves fast and a bare-threshold push drifts.

---

## 7. Reduce Motion

- **[preserve exactly]** `src/components/today/plate.tsx:389` +
  `:471` — `useReducedMotion()` feeding `still`, which both the RN `Landing`
  wrapper (`:113`) and the Skia `PlateLayer` (`:157`) honour by initialising
  `progress` at 1. Correct in both rendering regimes.
- **[preserve exactly]** `src/components/event-outfits/OutfitPostCard.tsx:234-240`
  — the Crown checks it too.
- **[fix friction]** Those are the **only two** places in `src/` that respect it.
  Not honoured in:
  - `src/components/ui/skeleton.tsx:45` — an infinite shimmer on 20+ screens.
  - `src/components/ui/skeleton.tsx:78` — an infinite spinner.
  - `src/components/ingest/upload-queue-list.tsx:38-47` — an infinite pulse.
  - `src/components/review/review-card.tsx:197-231` — the fly-off and rotation.
  - `src/app/(auth)/sign-in.tsx:468, 495, 535, 579, 653` — every entrance
    animation on the first screen a new user sees.
  There is no `AccessibilityInfo` listener anywhere in the app.
  **Proposal:** a `useMotionAllowed()` wrapper over `useReducedMotion()` in
  `tokens.ts`, and — cheaper and broader — Reanimated 4's
  `reduceMotion: ReduceMotion.System` config option passed inside the spring
  presets themselves, so every `withSpring(x, spring.smooth)` in the app becomes
  compliant by construction. That last change is a four-line edit to
  `tokens.ts:114-123` and covers every future call site too.
- **[fix inconsistency — needs a founder decision]**
  `src/components/event-outfits/OutfitPostCard.tsx:239` uses `spring.bouncy`.
  `src/theme/tokens.ts:119` says "the single plate-landing moment. Nothing
  else." and `CHARTER.md:38` says "`bouncy` exactly once in the app (plate
  landing)". The docblock at `OutfitPostCard.tsx:228` reinterprets the rule as
  *once per screen*. Two readings cannot both be canon. Recommendation: the
  Crown becomes `spring.snappy` with its existing `0.8 → 1.0` scale doing the
  celebrating; the one bounce stays with the plate. Flagged rather than decided.
- **[minor polish]** `src/components/today/plate.tsx:76` — `landingDelay` types
  `120 + index * 60`; the 60 is `motion.stagger` (`tokens.ts:127`), which has
  zero call sites. Import it.

---

## 8. Ranked top ten

Ordered by perceived-quality gain per unit of risk. Every one uses only
Reanimated 4, gesture-handler or expo-haptics — all installed.

### 1. A shared press-feedback hook (scale + interpolated opacity)

*Touches 49 Button sites, Chip, and ~35 bespoke Pressables.*

```ts
// src/components/ui/use-press-feedback.ts
export function usePressFeedback(enabled = true) {
  const p = useSharedValue(0);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - p.value * 0.03 }],
    opacity: 1 - p.value * 0.2,
  }));
  return {
    style,
    onPressIn:  () => { p.value = withTiming(1, { duration: motion.duration.fast }); },
    onPressOut: () => { p.value = withSpring(0, spring.snappy); },
  };
}
```
Wrap `Button`'s inner `View` in `Animated.View`, drop `active:opacity-70`, and
delete the four different `active:opacity-*` values from every call site.
`spring.snappy` finally gets its job.

### 2. Crossfade every skeleton→content handover

```tsx
{query.isLoading
  ? <Animated.View exiting={FadeOut.duration(motion.duration.fast)}><ClosetGridSkeleton/></Animated.View>
  : <Animated.View entering={FadeIn.duration(motion.duration.base)}><ClosetGrid …/></Animated.View>}
```
Applied at `closet.tsx:318`, `index.tsx:534`, `plan.tsx:273/336`,
`event/[id]/index.tsx:288`, `review.tsx:263`, `explore.tsx:257`,
`friends/index.tsx:220`. Because the skeletons already match the content
geometry, the page appears to *develop* rather than swap.

### 3. Reduce Motion by construction, in the spring presets

```ts
import { ReduceMotion } from 'react-native-reanimated';
export const spring = {
  smooth: { duration: 500, dampingRatio: 1.0,  reduceMotion: ReduceMotion.System },
  snappy: { duration: 450, dampingRatio: 0.85, reduceMotion: ReduceMotion.System },
  …
};
```
Plus `useReducedMotion()` guards on the three infinite loops
(`skeleton.tsx:45`, `:78`, `upload-queue-list.tsx:38`) — freeze the shimmer to a
static tone rather than stopping mid-sweep. Four lines in `tokens.ts` makes
every existing and future `withSpring` compliant.

### 4. `LinearTransition` on the reaction bar and the selection bar

```tsx
// plate.tsx:549 — the actions row
<Animated.View layout={LinearTransition.springify().damping(20).stiffness(180)}
               className="mt-3.5 flex-row items-start gap-2">
// reaction-bar.tsx — each branch
<Animated.View entering={FadeIn.duration(motion.duration.fast)}
               exiting={FadeOut.duration(motion.duration.fast)}>
```
And at `closet.tsx:309`, `entering={FadeInUp}` / `exiting={FadeOutUp}` on
`SelectionBar` with `layout` on the grid container. Turns the two most-used
state changes in the app from flickers into folds.

### 5. Invert `Button`'s `haptic` default, and add the two missing kinds

`button.tsx:42` → `haptic = true`. Then:
- `Haptics.notificationAsync(Warning)` inside every destructive Alert's
  `onPress` (`closet.tsx:252`, `item/[id].tsx`, `friends/[userId].tsx`,
  `OutfitPostCard.tsx:318`, `profile.tsx`).
- `Haptics.selectionAsync()` in `chip.tsx:28` and `plan.tsx:61`.
- `.catch(() => {})` on `reaction-bar.tsx:117`.

### 6. Native context menus for the ⋯ overflow

Replace `Alert.alert` at `OutfitPostCard.tsx:325` and `CommentRow.tsx` with
`ActionSheetIOS.showActionSheetWithOptions({ options, destructiveButtonIndex,
cancelButtonIndex })` — zero new dependencies — or, better, `@expo/ui`'s
SwiftUI `ContextMenu` on a long press of the card, which brings the lift, blur
and system haptic for free. Both are idiomatic where an Alert is not.

### 7. Press feedback and haptics on the fifteen bare Pressables

`stylist.tsx:404`, `sign-in.tsx:621/687/696`, `capture.tsx:345/432/476`,
`invite.tsx:63`, `profile.tsx:339`, `garment-search-sheet.tsx:106/182`,
`message-bubble.tsx:145`, `packing-trip.tsx:195`,
`trip-questionnaire.tsx:210`, `review-card.tsx:561`. Once #1 exists these are a
one-line change each. Prioritise the stylist send button and the three capture
controls — the capture screen is dark, haptics are suppressed during a camera
session, and right now those controls give the user *nothing*.

### 8. An animated segmented control on Plan

```tsx
const x = useSharedValue(0);          // 0 | 1 | 2
const pill = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * segW }] }));
// onPress: x.value = withSpring(i, spring.snappy); Haptics.selectionAsync();
```
One absolutely-positioned ink pill under the three labels (`plan.tsx:219-228`),
measured with `onLayout`. Replaces the conditional `bg-ink` class swap.

### 9. Long-press pre-commit scale on closet tiles

```tsx
const hold = Gesture.LongPress().minDuration(400)
  .onBegin(() => { s.value = withTiming(0.94, { duration: 400 }); })
  .onFinalize(() => { s.value = withSpring(1, spring.snappy); })
  .onStart(() => { runOnJS(beginSelection)(item); });
```
On `item-card.tsx:59`, replacing the plain `onLongPress` at `:67`. Answers the
admission already written at `closet.tsx:227`.

### 10. Scroll and refresh hygiene

- `keyboardDismissMode="on-drag"` on `ClosetGrid` (`closet-grid.tsx:47`) and
  `keyboardDismissMode="interactive"` on Today (`index.tsx:713`).
- `snapToInterval` + `decelerationRate="fast"` on the closet rails
  (`closet.tsx:535`, `:802`) and the look boards (`outfits.tsx:458`).
- `tintColor={theme.muted}` on the five bare `RefreshControl`s.
- Fix `refreshing` on Today (`index.tsx:657`) to cover the wardrobe and weather
  refetches, not just the re-rank.
- `RefreshControl` added to Plan and the event board.
- Velocity-carrying `withSpring` for the review-deck fly-off
  (`review-card.tsx:197/203`).
- `recyclingKey` on `plate-thumb.tsx:59`, `avatar.tsx:104`, `ProfileRow.tsx:57`,
  `BorrowRequestRow.tsx:69`; `transition={motion.duration.base}` as the house
  value across all sixteen `<Image>` sites.

---

## 9. Rejections

- **Reject: parallax or shared-element transitions between the closet grid and
  item detail.** Spectacle, not comprehension. `CHARTER.md:38` — "Motion
  supports comprehension; no spectacle." The grid→detail push is already the
  right idiom.
- **Reject: a spring on the Liquid Glass tab bar or any custom tab transition.**
  `(tabs)/_layout.tsx` documents why the native bar is the point; wrapping it in
  JS motion would destroy the scroll-edge effect it exists for.
- **Reject: `react-native-keyboard-controller`.** New native module, dev-client
  rebuild, for a problem `automaticallyAdjustKeyboardInsets` already solves —
  the reasoning at `keyboard-aware-scroll-view.tsx:6-9` is correct and stands.
- **Reject: haptics on list-row taps that merely navigate.** iOS does not tick on
  a push; adding it would make the app feel chatty rather than responsive.
- **Reject: a second bouncy spring.** See §7 — resolve `OutfitPostCard.tsx:239`
  *downward* to `snappy` rather than relaxing the one-bounce rule.
