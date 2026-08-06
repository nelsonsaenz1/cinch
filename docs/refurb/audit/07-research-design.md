# 07 — Open-source research: implementation technique for the refurbishment

Scope per `docs/refurb/CHARTER.md`: this is a survey of **implementation
technique**, not visual identity. Nothing here is a recommendation to import
another app's look — Cinch's canon (locked palette, Plate grammar, spring
presets in `src/theme/tokens.ts`) stays fixed. Every "adopt/adapt" verdict
means *the technique gets rebuilt in Cinch's own style with Cinch's own
tokens*, using libraries already in `package.json`.

**Already installed** (confirmed from `package.json`, 2026-08-06):
`react-native-reanimated` 4.5.1, `react-native-worklets` 0.10.1,
`react-native-gesture-handler` ~2.32, `react-native-screens` ~4.26,
`@shopify/react-native-skia` 2.6.2, `@shopify/flash-list` 2.0.2,
`expo-image` ~57.0.2, `expo-glass-effect` ~57.0.1, `expo-haptics` ~57.0.1,
`react-native-svg` 15.15.4, `react-native-view-shot` 5.1.0, `nativewind`
4.2.6, `expo-router` 57.0.10. **Not installed**: Moti, Zeego, Lottie,
gorhom's bottom-sheet/tab-bar, react-content-loader, Redash, FlashList is
already present so Shopify's is a non-issue. Any repo whose pattern requires
one of the not-installed packages is flagged explicitly — the charter
requires written justification (license, maintenance, size) before adding
anything, so those are scored "adapt" (rebuild the technique on what's
installed) rather than "adopt" (pull in the dependency) unless stated
otherwise.

Star counts and dates below were captured live in research (2026-08-06) via
GitHub's web UI; where GitHub's page didn't surface an exact last-commit
date the commit count is given instead as an activity proxy.

---

## 1. bluesky-social/social-app

- **Stars**: ~18.2k · **License**: MIT (patent non-aggression pledge)
- **Purpose**: Official Bluesky client — RN + TypeScript, feed-heavy social app, iOS/Android/Web from one codebase.
- **Maintenance**: Very active, funded team, near-daily commits.
- **Patterns useful to Cinch**:
  1. Feed virtualization tuned for mixed media aspect ratios (images/video in a scroll feed) — relevant to Lately and Plan's day-strip.
  2. Optimistic UI for social actions (like/repost) that resolves silently on the network round trip — maps directly to Cinch's outfit love/pass and vote reactions.
  3. Careful separation of gesture-driven UI (swipe actions, pull-to-refresh) from list virtualization so gestures never fight the scroll responder.
- **Verdict**: **Adapt.** Its optimistic-update pattern for reactions is the most transferable idea for outfit love/pass and social voting — implementable today with `@tanstack/react-query`'s `onMutate` (already installed) without touching UI code from Bluesky at all. Reject anything about its visual/feed layout — that's Bluesky's identity, not a Cinch reference.

## 2. Expensify/App

- **Stars**: ~5.0k (per GitHub's own counter; the repo has 284k+ commits) · **License**: MIT
- **Purpose**: "New Expensify" — chat-centered financial collaboration app, RN.
- **Maintenance**: Extremely active (paid contributor bounty program).
- **Patterns useful to Cinch**:
  1. Heavy use of skeleton/optimistic rendering so screens never show a blank spinner — a chat message or a report row renders in a "pending" visual state instantly.
  2. Offline-first architecture with a local cache (Onyx) that renders before confirming with network — relevant to Cinch's offline Today state (explicitly called out as a required state in the charter's page inventory).
  3. Currency/number formatting treated as first-class UI, not an afterthought — directly analogous to Cinch's cost-per-wear numbers being "the point, not fine print."
- **Verdict**: **Adapt.** The "numbers as UI, not caption" discipline is the most valuable transferable idea for cost-per-wear and colour-harmony displays. The offline-first rendering posture (render from cache immediately, reconcile after) is worth adapting for Today's offline state, using the already-installed `@tanstack/react-query-persist-client` + `query-sync-storage-persister`, which already does most of this. Reject Expensify's chat-heavy IA — not applicable to Cinch's page inventory.

## 3. software-mansion/react-native-reanimated

- **Stars**: ~10.9k · **License**: MIT
- **Purpose**: The core animation library Cinch is already built on.
- **Maintenance**: Very active, Software Mansion core team.
- **Patterns useful to Cinch**:
  1. The `apps/common-app` example app in the repo is the canonical reference for layout animations (`entering`/`exiting`/`layout`), shared-element-style transitions, and `useAnimatedScrollHandler` — all APIs Cinch already depends on.
  2. Its worklet-based gesture-to-animation wiring (drag → spring release) is the reference implementation for anything Cinch does with drag gestures (e.g., dismissing a sheet, reordering closet items).
  3. Demonstrates keeping expensive layout math off the JS thread entirely, which is the actual mechanism behind "Instagram-grade" perceived smoothness the charter asks for.
- **Verdict**: **Adopt as reference, no new dependency** — Cinch already ships this exact library and version. Treat the repo's own example app as the implementation playbook for every spring/gesture pattern below rather than any third-party wrapper.

## 4. software-mansion/react-native-gesture-handler

- **Stars**: ~6.8k · **License**: MIT
- **Purpose**: Native touch/gesture primitives — also already installed (~2.32).
- **Maintenance**: Very active, same team as Reanimated.
- **Patterns useful to Cinch**:
  1. Composed gestures (`Gesture.Simultaneous`, `Gesture.Race`) for pinch-to-zoom-and-pan on a single garment photo — relevant to item detail and the review/capture flow.
  2. `Gesture.Pan().activeOffsetX()` patterns for swipe actions inside a scrollable list without hijacking vertical scroll — relevant to Closet row actions and Lately card dismissal.
- **Verdict**: **Adopt as reference, no new dependency.** Already installed; use its own example app patterns directly.

## 5. software-mansion/react-native-screens

- **Stars**: ~3.7k · **License**: MIT
- **Purpose**: Native navigation primitives underlying `expo-router`'s stacks — already installed (~4.26).
- **Maintenance**: Active, Software Mansion + Expo.
- **Patterns useful to Cinch**: Native stack transition tuning (`stackAnimation`, `transitionSpec`), full-screen modal presentation styles that match iOS system sheets — relevant to the capture→review flow and profile-edit sheet, keeping presentation native rather than JS-simulated.
- **Verdict**: **Adopt as reference, no new dependency.** Already the transport under `expo-router`; the gain here is auditing whether Cinch is using its native transition options fully rather than any custom crossfade.

## 6. wcandillon/can-it-be-done-in-react-native

- **Stars**: ~4.2k · **License**: MIT
- **Purpose**: William Candillon's "Can it be done in React Native?" video series source — Reanimated + Skia micro-interaction studies.
- **Maintenance**: Lower commit velocity (video-series cadence, not a product), but the code still targets current Reanimated/Skia APIs and is widely cited.
- **Patterns useful to Cinch**:
  1. Skia-based image treatments (masking, gradient overlays, blur-in reveal) — directly relevant since Cinch already ships Skia and the field guide's Plate identity depends on considered image presentation.
  2. Physically-motivated release/settle animations (drag-then-spring-back) built purely on Reanimated worklets, no extra dependency.
  3. Scroll-driven parallax/reveal effects for hero imagery — relevant to Today's outfit plates and the shareable-outfit export frame.
- **Verdict**: **Adapt.** This is the single best pattern-reference repo for what Cinch can do with its *already-installed* Skia + Reanimated combo — e.g., a considered garment-photo reveal on Today, or a Skia-drawn gradient wash under the numbers on an outfit card. None of it requires a new dependency; it's a technique library, not a component library.

## 7. wcandillon/react-native-redash

- **Stars**: ~2.1k · **License**: MIT
- **Purpose**: Grab-bag of Reanimated/Gesture-Handler math helpers (vectors, bezier easing, snap-points) from the same author as #6.
- **Maintenance**: Moderate — mature, stable API, infrequent but not abandoned.
- **Patterns useful to Cinch**: Snap-point math for drag-to-dismiss sheets, vector helpers for pan gestures. All are small, copyable utility functions (a few dozen lines each), not a runtime dependency users need to install wholesale.
- **Verdict**: **Reject as a dependency** (charter: no new deps without written justification, and the value here is a handful of math utilities, not a whole package) but **adapt by porting the 1–2 specific helper functions** (e.g. snap-point resolution for a drag gesture) directly into Cinch's own gesture code, credited in a comment, rather than adding the package.

## 8. gorhom/react-native-bottom-sheet

- **Stars**: ~9.1k · **License**: MIT
- **Purpose**: The de facto standard RN bottom sheet — snap points, backdrop, keyboard handling, FlashList integration.
- **Maintenance**: Very active.
- **Patterns useful to Cinch**:
  1. Snap-point + backdrop + keyboard-avoidance combination is exactly the shape of interaction the charter prefers for new states ("a sheet/inline state is preferred" over new pages) — e.g. event creation, garment quick-edit.
  2. Its gesture-to-spring handoff (drag velocity feeds directly into the release spring, matching `spring.snappy`/`spring.smooth` distinctions Cinch already has) is the reference implementation worth studying even without the package.
- **Verdict**: **Adapt, not adopt.** Not installed, and a full bottom-sheet library is more surface area than Cinch's page inventory needs (the charter's page list is locked and modest). Rebuild the specific snap-point-plus-backdrop pattern directly on the already-installed `react-native-gesture-handler` + `react-native-reanimated`, styled with Cinch's own corner/radius and canvas tokens — this is a well-trodden ~150-line pattern, not a reason to add a dependency.

## 9. gorhom/react-native-animated-tabbar

- **Stars**: ~1.9k · **License**: MIT
- **Purpose**: Animated tab-bar presets (bubble, flashy, material) for React Navigation.
- **Maintenance**: Author notes it's community/sponsorship-maintained; slower cadence than the bottom-sheet library.
- **Patterns useful to Cinch**: Icon-morph and label-reveal transitions on tab selection.
- **Verdict**: **Reject.** Cinch's navigation is native tabs (charter: "Navigation structure is locked... native tabs"). A JS-rendered animated tab bar would replace native `UITabBar` — the opposite direction from "native, quiet, editorial." Any tab-selection polish should go through the native tab APIs (`expo-router`'s native tabs config), not this library. Recorded here only because it was a research target explicitly named in the brief.

## 10. Shopify/flash-list

- **Stars**: ~7.2k · **License**: MIT
- **Purpose**: High-performance virtualized list, drop-in `FlatList` replacement — **already installed** (2.0.2).
- **Maintenance**: Very active, Shopify core team.
- **Patterns useful to Cinch**:
  1. v2's automatic sizing (no `estimatedItemSize` needed) simplifies Closet's grid and Lately's feed.
  2. Masonry layout support — relevant if Closet's grid ever needs variable-height garment cards (it doesn't today, but useful to know it's there without a new dependency).
- **Verdict**: **Adopt** — already installed; confirm Closet/Lately are on FlashList v2's simplified API rather than any hand-estimated sizing left over from v1 migration.

## 11. Shopify/react-native-skia

- **Stars**: ~8.5k · **License**: MIT
- **Purpose**: 2D graphics engine (Skia) for RN — **already installed** (2.6.2).
- **Maintenance**: Very active, Shopify core team.
- **Patterns useful to Cinch**:
  1. Canvas-based image masking/cropping — relevant to Capture's photo cleanup step and any garment cutout treatment.
  2. Shader-driven gradient washes and blur — a legitimate way to add the Plate identity's editorial polish (e.g., a considered gradient under a plate number) without any new dependency, since Skia is already in the app.
  3. Skia's `Image` + `useImage` hook composes cleanly with `expo-image`'s caching, avoiding double-decoding.
- **Verdict**: **Adopt** — already installed; underused if Cinch isn't yet using it for anything beyond what's shipped. Worth an inventory of where Skia could replace a flat `View`+shadow with a genuinely considered drawn surface (e.g. the shareable-outfit export frame, which the brief calls "the app's best advertisement").

## 12. nandorojo/moti

- **Stars**: ~4.5k · **License**: MIT
- **Purpose**: Declarative animation API ("`animate={{opacity: 1}}`") built on top of Reanimated 3.
- **Maintenance**: Active but built against Reanimated 3 conventions; Cinch is on Reanimated 4.
- **Patterns useful to Cinch**: Declarative-style entrance/exit animations reduce boilerplate versus hand-writing `useAnimatedStyle`.
- **Verdict**: **Reject** — new dependency, and its main value (less boilerplate) is exactly cancelled out by the fact that Reanimated 4's own `entering`/`exiting`/`layout` props already give a declarative surface, which Cinch already uses. Adding Moti on top of Reanimated 4 would be two animation vocabularies for the same job — a real regression against the charter's "no new dependencies without justification," since the justification here doesn't clear the bar.

## 13. nandorojo/zeego

- **Stars**: ~2.3k · **License**: MIT
- **Purpose**: Native context/dropdown menus (iOS `UIMenu` / Android) with a Radix-UI-like React API.
- **Maintenance**: Active, same author as Moti.
- **Patterns useful to Cinch**: True native long-press context menus (haptic-backed, OS-rendered) — relevant to garment long-press actions in Closet (e.g. quick edit/delete/mark-worn) instead of a custom action sheet.
- **Verdict**: **Adapt, flag for justification.** This is the one case in this survey where a new dependency might genuinely be worth writing up: native context menus are hard to hand-roll well (they need `UIMenu` bridging), and `expo-haptics` is already installed so the haptic half is free. If Closet needs long-press quick actions, this is the specific, narrow case to bring to the founder for a written justification — not a blanket "adopt." Until that justification is written, treat it as **reject (pending)** and use a bottom-sheet action list (already buildable per #8) as the interim, dependency-free pattern.

## 14. dominicstop/react-native-ios-context-menu

- **Stars**: ~700 · **License**: MIT
- **Purpose**: Lower-level iOS-only `UIMenu` wrapper (predates Zeego, which wraps a similar primitive with a nicer API).
- **Maintenance**: Slower cadence, smaller community than Zeego.
- **Patterns useful to Cinch**: Same native-context-menu idea as #13, iOS-only which matches Cinch's iOS-only scope, but less ergonomic API and smaller community than Zeego.
- **Verdict**: **Reject** — Zeego (#13) is the better-maintained wrapper around the same native capability; no reason to consider both. Recorded for completeness since it's the technique's origin point.

## 15. PedroBern/react-native-collapsible-tab-view

- **Stars**: ~1.1k (community continuation; not currently published under a `callstack` org — the brief's mention of "callstack examples" led here as the closest actively-maintained match) · **License**: MIT
- **Purpose**: Collapsible-header + swipeable-tabs component built on Reanimated + Gesture Handler.
- **Maintenance**: Moderate.
- **Patterns useful to Cinch**: Scroll-driven header collapse synced across multiple tab panes — the technique (not the package) is relevant if Closet's category browsing (tops/bottoms/outerwear/shoes/accessories) ever wants a collapsing header with the usage-insight summary shrinking as the user scrolls into the grid.
- **Verdict**: **Adapt, no new dependency.** The collapse-on-scroll technique is a straightforward `useAnimatedScrollHandler` + `interpolate` pattern on already-installed Reanimated — worth studying the repo's `AnimatedHeader.tsx` for the exact interpolation math, not worth installing the package for a single collapsing header.

## 16. jobtoday/react-native-image-viewing

- **Stars**: ~950 · **License**: MIT
- **Purpose**: Lightweight full-screen image gallery viewer — pinch-zoom, double-tap zoom, swipe-to-dismiss.
- **Maintenance**: Lower commit velocity (mature, stable, "done" library) but no sign of abandonment issues in open issues.
- **Patterns useful to Cinch**: The gesture composition for a garment-photo full-screen viewer (pinch + pan + swipe-down-to-dismiss with a fading backdrop) — relevant to item detail's photo and to reviewing a captured garment full-screen.
- **Verdict**: **Adapt, no new dependency.** This exact interaction is buildable on the already-installed Gesture Handler + Reanimated combo (composed pinch/pan/tap gestures decaying into a spring dismiss) — the repo is valuable purely as a read-only reference for the gesture composition, not as an install candidate, since it's a ~600-line single-purpose component that would otherwise be a dependency for one screen.

## 17. danilowoz/react-content-loader

- **Stars**: ~14k · **License**: MIT
- **Purpose**: SVG-based skeleton-loading placeholders; has an RN build (`react-content-loader/native`) built on `react-native-svg`.
- **Maintenance**: Mature, stable, still actively used industry-wide though lower recent commit velocity (feature-complete library).
- **Patterns useful to Cinch**: Shimmer/skeleton placeholders for Closet's loading state and Today's outfit-generation wait — both explicitly required states per the charter's page inventory ("Include a good empty state and a good loading state").
- **Verdict**: **Reject as a dependency, adapt the technique.** `react-native-svg` is already installed, so the entire technique (an animated gradient sweeping across SVG shapes matching each screen's real layout) is buildable in perhaps 40–60 lines with Reanimated driving the shimmer's `translateX`/opacity — no reason to add a dependency whose only job is generating that SVG shape config. Build a single small `<Skeleton>` primitive in Cinch's own component library instead.

## 18. Dimillian/IceCubesApp

- **Stars**: ~7.0k · **License**: AGPL-3.0
- **Purpose**: SwiftUI Mastodon client — cited here as a **pattern reference only** (native SwiftUI, not RN; per the assignment brief, treat as inspiration for technique, not a codebase to port).
- **Maintenance**: Active.
- **Patterns useful to Cinch** (technique only — Cinch does not use SwiftUI):
  1. Streaming/live-update handling that lets list items update in place without a jarring refresh — the RN-equivalent target is React Query's cache updates driving Reanimated `layout` transitions on FlashList items.
  2. Grouped, activity-typed notification design — relevant conceptually to how Cinch might structure Lately's activity feed groupings (votes, comments, picks) if that ships.
  3. Cross-device position sync as a "the app remembers you" perceived-quality signal — relevant to Today/Plan scroll-position restoration.
- **Verdict**: **Reference only, no adoption.** AGPL-3.0 license alone would rule out any code reuse in a closed-source commercial app regardless of design merit — flagging this explicitly since AGPL is viral. Treat purely as a "how good native apps structure live-updating state" case study, never as a source of copied UI.

## 19. b3ll/Motion

- **Stars**: ~1.5k · **License**: BSD-2-Clause
- **Purpose**: Physics-based animation engine (spring/decay/basic) for Swift/UIKit by Adam Bell (ex-Apple). Pattern reference only — not RN.
- **Maintenance**: Moderate, mature/stable API.
- **Patterns useful to Cinch** (technique only):
  1. Interruptible animations — a released gesture's velocity feeds directly into a spring's initial velocity so a redirected drag never "resets" the motion. This is exactly what Reanimated's `withSpring(value, { velocity })` already supports; Motion is a clean conceptual reference for getting that math right.
  2. Decay animations for momentum-scroll-like release, distinct from spring settle — worth distinguishing from Cinch's `spring.smooth`/`snappy`/`bouncy` trio, which are all spring-class; a decay curve might be the right physics for a fling-to-dismiss gesture rather than forcing it through a spring preset.
- **Verdict**: **Reference only, no adoption** — Swift/UIKit, not applicable as a dependency to an RN app. Valuable purely for the interruptibility and decay-vs-spring conceptual distinction, both directly implementable via Reanimated's existing `withDecay`/`withSpring` primitives, already installed.

## 20. expo/expo

- **Stars**: ~51.4k · **License**: MIT
- **Purpose**: The Expo SDK monorepo itself — source of every `expo-*` package Cinch depends on (image, glass-effect, haptics, router, camera, etc.).
- **Maintenance**: Very active, Expo core team.
- **Patterns useful to Cinch**:
  1. The monorepo's own module test/example apps are the most authoritative reference for correct usage of `expo-glass-effect` (liquid-glass materials, directly relevant to iOS-native surface treatments) and `expo-image`'s caching/transition props — both already installed and likely under-explored relative to their full API surface.
  2. `expo-router`'s own docs/examples for native-tab configuration are the correct source for any native-tab-bar polish (badge, selected-state icon) rather than a JS tab-bar library (see #9's rejection).
- **Verdict**: **Adopt as reference, no new dependency.** Already the source of Cinch's own SDK version; the highest-value use of this repo is checking Cinch's usage of `expo-glass-effect` and `expo-image` against the SDK's own example apps for missed capabilities (e.g. blur-transition-in on image load, materials on sheets/modals) rather than treating it as a place to find new packages.

---

## The 8 highest-value patterns for Cinch, with already-installed implementation sketches

1. **Optimistic reactions (outfit love/pass, social votes).**
   *From: bluesky-social/social-app (#1).*
   Implement via `@tanstack/react-query`'s `useMutation({ onMutate })`: write the new reaction state into the query cache immediately, let the mutation resolve in the background, roll back on error. No animation library needed — the perceived-speed win is architectural, not visual. Pair with a `spring.snappy` scale-tap on the reaction control itself (already the tokened preset for controls).

2. **Numbers-as-UI treatment for cost-per-wear / colour harmony.**
   *From: Expensify/App (#2).*
   Not a component to build so much as a discipline: route every stat display through one shared `<Stat>`/`<Colophon>` primitive (tabular-nums font-variant, consistent baseline alignment) rather than ad hoc `<Text>` usage, so the "data is the moat" numbers read as authored typography, not debug output. Zero new dependency — `expo-google-fonts/instrument-serif` and system font are already in place; check `fontVariant: ['tabular-nums']` is applied everywhere a number appears.

3. **Skia-drawn garment photo treatment (mask/gradient/reveal).**
   *From: wcandillon/can-it-be-done-in-react-native (#6), Shopify/react-native-skia (#11).*
   Use `@shopify/react-native-skia`'s `useImage` + `<Canvas>`/`<Image>` with a `LinearGradient` or blur `ImageFilter` to give Today's plate photos and the shareable-outfit export frame a genuinely considered treatment (e.g. a soft vignette or gradient wash behind the garment, consistent with the Plate/lookbook identity) instead of a flat `<Image>` + drop-shadow `View`. Already installed; currently likely under-used relative to what shipped in `package.json`.

4. **Sheet-based quick actions instead of new pages.**
   *From: gorhom/react-native-bottom-sheet (#8), technique only.*
   Build one small internal `<QuickActionSheet>` on `react-native-gesture-handler`'s `Gesture.Pan` + `Reanimated`'s `withSpring` (snap-point resolution: compare release velocity/position against 2–3 fixed Y offsets, same math as Redash's snap-point helper in #7, ported not installed) styled with Cinch's own radius/canvas tokens. Use for garment quick-edit, event creation — satisfies the charter's stated preference for "a sheet/inline state" over a new page.

5. **Native long-press context menu for garment quick actions** (flagged for justification).
   *From: nandorojo/zeego (#13).*
   This is the one pattern in the set that may warrant an actual new dependency — hand-rolling `UIMenu` bridging is nontrivial. Until a written justification (license/maintenance/size) is filed per the charter, use pattern #4 (a bottom sheet action list, triggered on long-press with `expo-haptics`' `.impactAsync(.medium)`, already installed) as the dependency-free interim.

6. **Full-screen garment photo viewer (pinch/pan/swipe-to-dismiss).**
   *From: jobtoday/react-native-image-viewing (#16).*
   Compose `Gesture.Pinch()`, `Gesture.Pan()`, and `Gesture.Tap()` (all already available via installed Gesture Handler) with `Gesture.Simultaneous`/`Gesture.Race`; drive scale/translate via `useAnimatedStyle`, and resolve a downward pan past a threshold into a `withSpring` dismiss with fading backdrop opacity interpolated from pan distance. Relevant to item detail and the capture/review flow.

7. **Skeleton loading matched to real layout.**
   *From: danilowoz/react-content-loader (#17), technique only.*
   Build one `<Skeleton>` primitive: an `Animated.View` with a `LinearGradient` (via `react-native-svg`, already installed) sweeping via a looping `withRepeat(withTiming(...))` translateX, shaped per-screen (Closet grid cells, Today's outfit-plate skeleton) rather than a generic shimmer bar. Satisfies the charter's required loading states without a new SVG-generation dependency.

8. **Scroll-driven collapsing header for Closet's category browsing.**
   *From: PedroBern/react-native-collapsible-tab-view (#15), technique only.*
   `useAnimatedScrollHandler` capturing scroll offset → `interpolate` header height/opacity/usage-insight-summary scale within a fixed range, applied to Closet's category header as the FlashList scrolls. Already-installed Reanimated primitives only; no separate tab-view package needed since Cinch's category switching doesn't need swipeable panes, just header collapse.

---

### Rejected outright (recorded per charter's "reject with reason" requirement)

- **gorhom/react-native-animated-tabbar (#9)** — conflicts with the locked native-tabs navigation structure.
- **nandorojo/moti (#12)** — duplicates Reanimated 4's own declarative surface; new dependency with no net capability gain.
- **dominicstop/react-native-ios-context-menu (#14)** — superseded by the better-maintained Zeego for the same native capability.
- **Dimillian/IceCubesApp (#18)** — AGPL-3.0, incompatible with a closed-source commercial app regardless of design merit; reference-only.
- **wcandillon/react-native-redash (#7)** and **danilowoz/react-content-loader (#17)** — valuable techniques, but as whole-package installs they're rejected in favor of porting the specific few dozen lines needed directly into Cinch's own code.
