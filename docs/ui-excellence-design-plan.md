# Cinch UI excellence design plan

Status: **Claude Design accepted after one repository/API truth correction**  
Owner: Claude Design produces; Codex accepts  
Date: 2026-08-15

## Outcome

Produce a build-ready UI atlas for UX-01–UX-10 in `docs/ui-excellence-research.md`. The result must preserve Cinch's warm editorial identity while making the product quieter, more accessible, more content-first, and more resilient.

## Source hierarchy

1. `docs/ui-excellence-research.md` and this brief.
2. Shipping repository behavior and privacy/data contracts at current `main`.
3. Cinch Product Truth and accepted warm-canvas/oxblood/editorial design language.
4. Exact Expo SDK 57 documentation and current Apple HIG.
5. Competitor patterns only as abstracted evidence; never copy expression or trade dress.

## Design invariants

- Keep Today, Closet, Plan, and Explore as the four stable tabs.
- Clothing imagery is the visual hero; chrome recedes.
- One primary action per state. All persistent targets are at least 44pt.
- Meaningful regular text passes 4.5:1; color never carries meaning alone.
- Manual and visible actions remain available when a preview, long press, gesture, or haptic is added.
- Friends-only privacy boundaries and current data visibility do not widen.
- Loading, empty, partial, offline, error, retry, Dynamic Type, VoiceOver, and Reduce Motion behavior are explicit.
- No backend, billing, permissions, dependency, or analytics-contract changes.

## Required atlas

### DE-01 Contrast and semantic roles

Show Today, Closet, Plan, Explore, Profile, Item, Event, and sheets at standard and Increase Contrast. Provide a token-role table: primary, secondary, tertiary/decorative, disabled, border, accent, destructive, success. Identify every role that may render 10–17pt text.

### DE-02 Content-first Closet

Show zero, partial, 10-piece, and mature closets. Include compressed identity/edit/stats, categories/grid above secondary insights, and `Most worn` with accurate empty state. Include 320pt width, AX3, AX5, and long name/bio.

### DE-03 Progressive Today context

Show no-context, collapsed affordance, expanded editor, applied context, validation/error, and returning-state behavior without pushing outfit plates below the useful first fold.

### DE-04 Feed-first Explore and search sheet

Show active feed, empty circle, searching, results, no results, failure, keyboard, recent query if locally supported, and cancel. Search people only under the current contract. Include truthful `New in your circle` hierarchy.

### DE-05 Profile and Settings split

Show profile identity, edit entry, gear entry, Settings index, and existing setting destinations. Define migration of every existing row so no capability disappears. Replace the fake disabled switch with honest copy or remove it.

### DE-06 Resilient media states

Show loading, loaded, unavailable, decode failure, expired URL, missing category, avatar initials, and retry where useful across all image shapes. Fallbacks must look intentional and preserve final geometry.

### DE-07 Interaction and motion grammar

Provide pressed, selected, busy, disabled, success, failure, focus, and Reduce Motion states for buttons, chips, segmented controls, cards, RSVP, save/import, and selection. Specify which writes receive haptics and which never do.

### DE-08 Feedback hierarchy

Inventory existing Alert/sheet/toast/inline cases on touched core surfaces and map each to blocking alert, sheet, inline, NoticeBand, or toast. Include recovery copy and VoiceOver announcement behavior.

### DE-09 Native navigation delight

Show safe preview/context-menu candidates and garment-card zoom behavior with fallback. Explicitly document Closet multi-select gesture protection and visible equivalents for contextual actions.

### DE-10 Attention and finite Explore

Show real unseen dot, read state, invitation dot, new-since-last-visit divider, caught-up footer, empty circle, and offline behavior. Dots are quiet, nonnumeric, and never fabricated.

## Deliverables

- Flow diagram and route/state inventory.
- Annotated high-fidelity frames with realistic Cinch data.
- Component/variant inventory and token deltas.
- Copy table with before/after/reason.
- Motion/haptic table.
- Accessibility behavior and focus order.
- Exact route/component implementation mapping.
- Deviations, risks, and questions; no silent scope changes.

## Acceptance

Codex accepts only when every DE-01–DE-10 item has labeled frames or explicit behavior notes, every existing capability is accounted for, all contrast roles are quantified, every gesture has a visible alternative, all core failure/accessibility states are covered, and the handoff is feasible with the existing SDK 57 stack.

## Accepted source

- Claude Design project: `Cinch UI Excellence Atlas`
- Project ID: `49b82198-7610-4896-a8ba-94d44ce76f68`
- Canvas: `Cinch UI Excellence Atlas.dc.html`
- Handoff: `CINCH-UI-EXCELLENCE-HANDOFF.md`
- Accepted: 2026-08-15 after correcting three acceptance-critical facts:
  - Explore includes the signed-in user's own recent pieces in repository truth; implementation will use the already-exposed `isSelf`/`ownerId` seam and ship the friends-only Variant A without changing privacy or backend contracts.
  - `Link.AppleZoom` is an iOS 18+ navigation transition, not pinch-to-zoom; no pinchable viewer is in scope.
  - Alert modernization is a criterion-driven call-site inventory, not an unsupported claim that only three blocking alerts remain.
- Founder-safe decisions at acceptance: Settings may be a pushed route; the Explore last-seen boundary may use existing user-scoped AsyncStorage and item timestamps without a schema change; if authoritative unreadness cannot be proven, the Explore dot is suppressed.
