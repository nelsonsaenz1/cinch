# Cinch launch-polish backlog

Status: **Approved for design and implementation on 2026-08-15.** The ten items below are the bounded launch-polish program. Design acceptance precedes UI implementation; native venue search requires a new iOS runtime/build.

Principle: less copy, stronger hierarchy, exact alignment, and no new service unless it creates obvious user value.

## Ranked top 10

1. **Remove “What one more piece would do.”** Delete the Closet menu row and its dead-end surface; do not replace it with more explanation.
2. **Make every First 10 photo replaceable.** Tapping a filled slot should open a focused review with Retake and Choose another photo, while preserving the slot and progress if the user cancels.
3. **Fix New Event field clipping.** Occasion, Where, and Note for the group must keep typed text vertically centered/fully visible across one line, multiline input, keyboard states, and Dynamic Type.
4. **Redesign the planned-event detail page.** Lead with event, time/place, and the user’s look; demote logistics and social utilities; remove duplicate sentences and keep the primary next action above the fold.
5. **Add nearby venue autocomplete to Where.** Suggest restaurants, bars, cafés, and other relevant points of interest as the user types, biased to the event/user region; always retain “Use as typed” and manual entry. Prefer on-device MapKit search over a new paid vendor.
6. **Run a copy-density reduction pass on the core journey.** Today, Closet, First 10, New Event, Event Detail, Plan, and Explore should each have one clear headline and at most one supporting sentence before the primary action. Remove repeated disclaimers, captions, and explanations already conveyed by labels or layout.
7. **Run a shared alignment-and-spacing pass.** Standardize title baselines, left gutters, card insets, stat centering, section spacing, badge-to-card spacing, and vertical rhythm across Today, Closet, Plan, Explore, and Events.
8. **Harden all form and keyboard behavior.** Every creation/edit sheet needs a visible Back/Cancel route, keyboard avoidance, scroll-to-focused-field behavior, unblocked submit controls, preserved drafts, and no content hidden beneath the keyboard or safe areas.
9. **Stress-test real content instead of fixture-perfect content.** Check long restaurant names, long group notes, large accessibility text, empty/partial events, denied location, slow/offline search, canceled events, and 1/10 through 10/10 closet progress for truncation, overlap, or misleading states.
10. **Simplify event cards before adding imagery.** Give date, venue, host/group, and look status a strict hierarchy; remove redundant metadata and decorative boxes. If cards still need visual identity after that pass, test a quiet MapKit/location treatment or deterministic venue color—not third-party restaurant photos yet.

## Venue-image decision held for later

- Real restaurant photos are technically possible through a licensed places provider, but they bring per-request cost, mandatory attribution, caching restrictions, inconsistent photo quality, and another external dependency.
- Apple MapKit provides nearby point-of-interest search and autocomplete but not a simple restaurant-photo feed. MapKit Look Around or map imagery is a different, location-based treatment and is not guaranteed for every venue.
- Launch recommendation: ship excellent nearby venue suggestions and clean event cards first. Revisit real venue photos only after event usage shows that the image materially improves planning or return behavior.

## Execution sequence

1. Reproduce and capture each item on a real device/simulator.
2. Freeze concise copy, spacing rules, form behavior, event-card hierarchy, event-detail hierarchy, and failure states in the accepted design atlas.
3. Implement the three isolated packets defined in `docs/launch-polish-implementation-plan.md`; merge only through the integration owner.
4. Treat item 5 as a native-build packet because device-local MapKit search requires native integration. Manual entry remains the zero-permission, offline-safe fallback.
5. Run automated checks, then independent visual and behavioral acceptance across realistic content and accessibility states.
6. Commit and push a clean scoped candidate. Build a new iOS binary for the MapKit runtime change; do not alter the currently submitted App Store candidate without a separate release decision.
