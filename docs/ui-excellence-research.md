# Cinch UI excellence research

Status: **Evidence synthesis; ten-item program frozen**  
Owner: Codex  
Date: 2026-08-15

## Product decision

Cinch should feel like a calm personal wardrobe that becomes social only when invited. It must not become a shopping feed, an AI mascot, an infinite stranger feed, or a collection of fashionable effects.

The strongest repeated jobs across wardrobe apps are: see everything I own, decide what to wear now, play with combinations, remember what worked, plan ahead, buy less, and ask trusted people for help. The highest-rated competitors succeed when the clothes remain the visual hero and the app respects the work required to build a closet.

## Evidence base

- Apple Human Interface Guidelines: stable labeled destinations, one clearly emphasized action, 44pt targets, semantic adaptive colors, purposeful motion, strong alignment, and navigation/control chrome that does not compete with content.
- Whering: whole-closet visibility, playful outfit generation, and planning are loved; upload failures, inaccurate tags, buried filters, and context-free suggestions are recurring complaints.
- Indyx: editorial imagery, adjustable closet density, filters, outfit boards, calendar, and private-by-default social are praised; cataloging effort and buried controls remain friction.
- Stylebook: depth, control, longevity, and ownership build trust; users still ask for filters closer to the closet surface.
- Acloset: background cleanup, metadata, weather, calendar, and statistics deliver value; AI-forward visual clutter and repetitive suggestions are warnings.
- Cladwell: focused daily utility and weather/activity context are strong; commerce that interrupts the dressing job is rejected.
- Combyne and Pinterest: direct visual play and save-to-collection loops are engaging; ad density, shopping pressure, and infinite-scroll behavior are not appropriate for Cinch.
- Instagram, BeReal, Strava, LTK, Airbnb, and TikTok: transferable patterns are finite friend activity, durable saves, direct manipulation, contextual actions, clear progress, stable destinations, and accessibility controls. Their attention-maximizing or commerce-heavy mechanics are explicitly rejected.
- Current Cinch repository audit: known contrast debt, an inaccurate “Favourites” label, blank-image risk across roughly 50 image sites, inconsistent press feedback across roughly 255 Pressables, a content-obscuring Explore search masthead, a mixed Profile/Settings information architecture, and 43 blocking alerts.

## Ten-item slate

### UX-01 — Accessible semantic contrast

Meaningful small text may no longer use `faint`, `byline`, or `ghost` colors that fail 4.5:1 against the canvas. Preserve the warm palette; remap text roles to compliant semantic tokens and reserve low-contrast colors for nonessential decoration, disabled states, and skeletons.

### UX-02 — Closet becomes content-first and honest

Compress the identity/edit/stats header so garments appear sooner. Rename the current “Favourites” rail to “Most worn,” because it is derived from wear count. Put categories and the owned grid ahead of secondary insights. Do not create a fake favorite state or backend contract.

### UX-03 — Today context through progressive disclosure

Keep the only permission-free occasion input, but replace the permanent full composer with a compact `Add context` affordance. Expand only on intent, preserve entered context, and keep the three outfit plates as the first visual priority.

### UX-04 — Explore becomes feed-first and truthful

Move username search from a permanent masthead block to an explicit header search action and dedicated search sheet. Use honest friend-activity language such as `New in your circle`; do not call recently added pieces “looks and ideas.” Keep search prominent in the empty state.

### UX-05 — Separate Profile identity from Settings

The profile surface should present identity, closet signals, and editable public/profile fields. Move membership, privacy, people controls, notifications, help, diagnostics, sign out, and deletion under a clearly labeled Settings route reached by a gear action. Remove the disabled fake switch for Daily outfit styling or express it as honest information.

### UX-06 — Resilient garment and avatar media

Create one shared image primitive with geometry-matched loading, decode/error fallback, consistent transition/cache behavior, and category/swatch fallback. Adopt it across Closet, Today, Item, Plan, Explore, friend items, and avatars. A failed or expired signed URL must never leave a blank unexplained well.

### UX-07 — Consistent tactile feedback and motion budget

Adopt one shared press interaction across frequent controls. Animation explains spatial/state change and never delays utility. Haptics are limited to committed state changes, selection, success, and destructive confirmation—not routine navigation. Respect Reduce Motion and maintain visible disabled/busy states.

### UX-08 — Modern feedback hierarchy

Blocking alerts are reserved for destructive or irreversible choices. Recoverable errors live inline or in NoticeBand; success and low-risk confirmation use the shared toast; choices use existing sheets. Preserve accessibility announcements and never hide the recovery action.

### UX-09 — Selective native-feeling navigation

Use Expo Router SDK 57 native previews/menus/zoom only where gestures do not conflict. Garment cards keep normal tap; Closet long-press remains multi-select, so it must not be stolen by a context menu. Friend items and other safe objects may expose 3–5 contextual actions, with every action also available visibly.

### UX-10 — Calm attention cues and finite social closure

Use a quiet dot—not a count badge—on Plan for actionable invitations, and on Explore only when genuinely unseen friend activity exists. Add a true new-since-last-visit boundary and a finite `You're caught up with your circle` ending. Never manufacture urgency or add public engagement metrics.

## Explicit rejections

- No fifth tab, central action tab, infinite stranger feed, autoplay video, public leaderboard, wear streak pressure, extra accent palette, persistent AI persona, venue imagery, or surprise commerce.
- No dark-mode project, widget, visual-search system, true-favorites schema, new paid service, analytics recipient, permission, dependency, or backend migration in this pass.
- No copied competitor layout, animation, icon treatment, wording, or trade dress.
- No broad native Swift rewrite. Existing Expo/native primitives are the correct boundary for this program.

## Release debt outside this ten

The production route bundle still contains 205 `dev-*` fixture routes. They are auth-inaccessible but still registered. Keep this separate from UI implementation and address it as a release-bundle hardening packet after this program. Expand the screenshot matrix beyond its current four surfaces before final release acceptance.

