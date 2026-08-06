# 08 — Feature-Pattern Research

Read-only research pass per `docs/refurb/CHARTER.md`. Twenty repos, chosen for
technical depth on the eleven areas assigned, cross-referenced against Cinch's
actual code (not just the surface a screenshot would show) so every verdict is
grounded in what Cinch already does or already decided not to do. Star counts,
license, and last-push date pulled from the GitHub API on 2026-08-06.

The single governing constraint, restated because it disqualifies more repos
here than it qualifies: **no new dependency without written justification**,
and **no new product areas**. So almost every verdict below is "adapt the
technique in code we already own" rather than "add the package." Where a repo
is included purely as an architecture reference with no realistic adoption
path, that's stated up front.

---

## A. Feed interaction patterns — the deep dive

### 1. `bluesky-social/social-app`

**18,180 stars · MIT · pushed 2026-08-06 (active daily) · React Native (iOS/Android/Web)**

The team's own prior art, mined again at the file level rather than the
product level this time. Three findings worth carrying forward:

**The shadow cache (`src/state/cache/post-shadow.ts`).** Bluesky does not
patch TanStack Query's cache to show an optimistic like. It keeps a
module-level `WeakMap<PostView, Partial<PostShadow>>` keyed on the *post
object's identity*, plus an `EventEmitter` keyed on the post's URI. A like
tap calls `updatePostShadow(queryClient, uri, {likeUri})`, which (a) walks
every query cache that could contain that post — feed pages, notifications,
thread view, search results, quote view, bookmarks, explore previews, via a
`findAllPostsInQueryData` generator per cache — and stamps the shadow into
the WeakMap for each object it finds, then (b) emits one event on the URI.
Every `usePostShadow(post)` hook anywhere on screen is listening for that
exact URI and re-renders by merging the shadow onto its own `post` prop at
read time (`mergeShadow`, which recomputes `likeCount`/`repostCount` from the
delta rather than trusting a server-echoed count). The result: a like tapped
in a thread view updates the same post's tally in the feed behind it and in
search results, instantly, with **zero cache-shape coupling** — the shadow
is an overlay, not a write, so it can't corrupt an `InfiniteData` page or
require every query to agree on a normalized shape.

This is answering a problem Cinch does not fully have yet (Cinch has no
surface where the same entity — an item, a look — renders concurrently in
three different query caches), but Explore's `NewAddition` already renders
an item that could independently appear in the Closet grid, and any future
surface that reuses `event_outfit_posts` across the board and a detail sheet
would hit exactly this. Filed as a technique, not a task.

**Cursor pagination (`src/state/queries/post-feed.ts`).** The interesting
part isn't the cursor itself (an opaque server string, threaded through
`useInfiniteQuery`'s `pageParam` — standard) — it's two things layered on
top: (1) **over-fetch to compensate for client-side filtering.** `MIN_POSTS
= 30` is the target page size, but the query asks the API for exactly that
many and then applies moderation filtering *after* the fetch, which can drop
rows below the target — so a page can render short rather than the UI
silently starving. (2) **memoized page selection.** The `select` function
diffs `data.pages` against the *previous* run's `data.pages` by reference
identity and reuses already-tuned/already-moderated pages verbatim when nothing
upstream changed (`lastRun.current`), only re-running the (moderation-check +
thread-tuning) pipeline on pages that are new or whose inputs changed. That's
the difference between an `O(n)` re-render cost per keystroke-adjacent state
change and an `O(new pages)` one on a feed that can hold hundreds of items.

**Feed item recycling — the negative finding.** Bluesky's main timeline runs
on a *plain* `FlatList` (wrapped in `src/view/com/util/List.tsx`, a thin
Reanimated-aware shim adding a shared `ScrollContext`, an `onItemSeen`
viewability callback for impression tracking, and video-autoplay wiring) —
**not** FlashList. `@shopify/flash-list` is not in their `package.json` at
all. That's a useful data point precisely because Cinch already committed to
FlashList v2 for the closet grid: it confirms FlashList's advantage is
real but narrows on New Architecture RN (v2 measures automatically; v0.74+
core `FlatList` recycling improved too), and that a social team with Bluesky's
scale chose to spend engineering effort on *scroll-handler consolidation and
viewability-driven work-shedding* (pause video, stop image decode off-screen)
rather than swapping the list primitive. Worth knowing before anyone proposes
moving Explore's timeline onto FlashList as a "modernization" — the marginal
win is unproven at Cinch's per-friend-circle scale, and the invalidate cost
of doing it wrong (losing scroll position, breaking `KeyboardAwareScrollView`
composition Explore already depends on) is real.

**Verdict: adapt (technique, not package).** The shadow-cache *pattern* —
component-local optimistic display reconciled by an event, never a cache
write — is the right shape for Cinch's own vote refinement (see §8 below).
Nothing here is a dependency; it's ~80 lines of vanilla TS Cinch could write
itself if a second concurrent-render surface ever needs it. Not needed today.

---

## B. Pull-to-refresh + infinite scroll ergonomics

### 2. `TanStack/query`

**50,078 stars · MIT · pushed 2026-08-03 · already a Cinch dependency (`@tanstack/react-query` 5.101.4)**

Not researched as a candidate — researched as the library Cinch already
runs, to check Cinch's usage against the maintainers' own guidance. Two
points matter: (1) the docs' own optimistic-updates guide names **two**
patterns, not one — "UI-only" (render straight off `mutation.variables`
while `isPending`, no cache write at all) and "cache-write" (`onMutate` +
snapshot + rollback + mandatory `onSettled` refetch to reconcile with the
server). Cinch's codebase has adopted neither by name but is closest to a
disciplined third option: invalidate-and-refetch with no client-side
prediction at all (see `features/closet/mutations.ts:97`, `"the user just
changed both queues. Invalidate rather than optimistic-[...]"` and
`features/event-outfits/mutations.ts:110`, `"No optimistic cache writes
anywhere in this file [...] the invalidate-don't-patch rule"`). That's a
deliberate, documented house rule — not an oversight — so any refinement
proposal has to work *with* it, which is why §8 below reaches for the
UI-only pattern (component-local, no cache write) rather than the cache-write
one Bluesky uses. (2) `staleTime: STALE.INFINITY` on Bluesky's feed query
paired with explicit invalidation on write is the same shape Cinch's
`useCloset` uses implicitly — worth naming as confirmation Cinch's instinct
matches the library's own recommended pattern for "list that only changes
when the user changes it."

**Verdict: adopt (already adopted).** No action — noted so the vote-pill
refinement in §8 doesn't accidentally propose reinventing what the library
already offers under a different name.

### 3. `Shopify/flash-list`

**7,168 stars · MIT · pushed 2026-08-05 · already a Cinch dependency**

Cinch's own `closet-grid.tsx` already runs FlashList v2 correctly (no
`estimatedItemSize`, `extraData` for selection-mode re-renders, `recyclingKey`
on every cell's `Image`). Checked against the v2 migration notes for anything
Cinch might have missed: nothing found. The one gap worth flagging is
structural, not a FlashList issue — see §8's pagination item: Explore's
`NEW_ADDITIONS_LIMIT = 40` isn't a FlashList concern at all, it's a hard
`.limit(40)` in the query with no `fetchNextPage`, so a woman with an active
circle can lose real, un-seen additions off the bottom with no signal that
more exist.

**Verdict: preserve exactly.** No changes; cited for the pagination finding.

### 4. `react/react-native` (formerly `facebook/react-native` — the GitHub org moved)

**126,298 stars · MIT · pushed 2026-08-06 · the framework underneath Expo**

Baseline reference for `RefreshControl` and `VirtualizedList`'s own
recycling, to confirm nothing in Cinch's several `RefreshControl` call sites
(`explore.tsx`, `closet.tsx` ×2, `friends/index.tsx` — not all checked this
pass) deviates from platform-idiomatic tint/spacing. Explore's refresh
handler firing three separate `refetch()` calls (`additions`, `friends`,
`following`) rather than one combined query is the one pattern worth a note:
each is independently awaited-and-forgotten (`void`), so `RefreshControl`'s
spinner tracks `isRefetching` on only two of the three (`additions.isRefetching
|| friends.isRefetching`) — `following` can still be in flight when the
spinner stops. Minor; not in the top-8 below because it's cosmetic (worst
case: the spinner ends a beat early on a screen most users pull once and
move on from).

**Verdict: reject as adoption target** — it's the platform, not a pattern to
import. Noted for the sub-finding above only.

### 5–7. Software Mansion's RN primitives — `react-native-reanimated` (10,947★, MIT, pushed 2026-08-06), `react-native-gesture-handler` (6,774★, MIT, pushed 2026-08-06), `react-native-screens` (3,705★, MIT, pushed 2026-08-06)

All three already Cinch dependencies. Reviewed for pull-to-refresh and
deep-link/transition idioms specifically: Reanimated's own example gallery
demonstrates a custom gesture-driven pull-to-refresh (spring-back on release,
via `useAnimatedScrollHandler` + `withSpring`) as an alternative to the
platform `RefreshControl` Cinch uses everywhere today. It would let the pull
affordance use `spring.smooth` — the app's own motion token — instead of the
platform spinner's fixed easing, which is a genuine "Instagram-grade" texture
upgrade. It is also a real rewrite of a working, accessible, VoiceOver-safe
primitive on every list screen in the app for a purely aesthetic gain, and
custom pull-to-refresh gestures are a well-known source of new dropped-gesture
and stuck-spinner bugs. `react-native-screens`' native-stack deep-link
restoration (the state a `Linking` URL resolves into on cold start) is
already what `expo-router` builds on, so Cinch's deep linking already gets
this for free.

**Verdict: reject** the custom pull-to-refresh gesture (cost/benefit fails the
"refinement, not redesign" test — replacing a working accessible primitive
app-wide for a spring-curve difference most users won't consciously register).
**Preserve exactly** on the native-stack deep-link behavior — already correct.

---

## C. Image selection / caching pipelines

### 8. `immich-app/immich`

**109,858 stars · AGPL-3.0 · pushed 2026-08-06 · self-hosted photo/video management, Flutter mobile client**

Not RN, included as the highest-regarded OSS reference for photo-grid
pagination and thumbnail pipelines at real scale (self-hosted libraries
running into six figures of assets). Their generation pipeline writes
multiple derivatives per asset (thumbnail, preview, and a blurhash-style
low-res placeholder persisted as a column, not regenerated client-side) and
serves the smallest derivative the current view needs — exactly Cinch's own
`thumb_path` / `cutout_path` / `plate_path` three-tier scheme, already
matching this pattern (`features/explore/queries.ts`'s doc comment: "Plates
first, cutouts next, the photograph last"). Confirms Cinch's existing
derivative strategy is sound rather than surfacing a gap.

**Verdict: preserve exactly.** Cinch's own pipeline already does the thing
this repo is admired for; no change indicated.

### 9. `react-native-image-picker/react-native-image-picker`

**8,637 stars · MIT · pushed 2026-03-17 (slower cadence — last release ~5 months old at research time, but the repo isn't stale, just mature) · alternative to `expo-image-picker`**

Cinch runs `expo-image-picker` (Expo SDK 57) for capture, which is the
correct choice inside an Expo-managed workflow — this repo requires bare/
prebuild config and exists mainly for apps that need native-module-level
control `expo-image-picker` doesn't expose (custom camera UI, multi-select
galleries with cropping baked in). Its README is nonetheless a good checklist
of permission-denial edge cases: iOS Limited Photo Library access (post-14),
Android scoped-storage `READ_MEDIA_IMAGES` vs legacy storage permission
branches, and the "user picked, then revoked permission mid-picker" race.
Worth a five-minute pass against Cinch's `capture.tsx` permission handling to
confirm all three are covered — not verified in this pass (out of scope: this
agent's task was feature-pattern research, not a permissions audit).

**Verdict: reject as a dependency swap** (would mean leaving the Expo managed
workflow's image picker for no capability Cinch currently needs — direct
charter violation of "no new dependency without justification," and there is
none here). **Adapt**: the permission-edge-case checklist, as a follow-up
audit item, not this pass's scope.

### 10. `expo/expo` (the `expo-image` package specifically)

**51,393 stars · MIT · pushed 2026-08-06 · already a Cinch dependency**

Confirmed against Cinch's own usage (`plate-thumb.tsx`, `item-card.tsx`,
`garment-cell.tsx`): `cachePolicy="memory-disk"`, `recyclingKey` on every
FlashList cell's `Image`, and the documented `stableImageSource` workaround
in `features/closet/use-image-urls.ts` for the fact that expo-image caches
on full URI (including query-string signature) — so Cinch strips the signing
params before handing the URI to `Image`'s cache key, which is exactly the
technique the expo-image maintainers themselves recommend in their caching
FAQ for signed-URL backends (Supabase Storage is one of the named examples).
Cinch already discovered and applied the canonical fix independently.

**Verdict: preserve exactly.** Textbook-correct usage already in place.

---

## D. Link previews

### 11. `microlinkhq/metascraper`

**2,721 stars · MIT · pushed recently · Node.js metadata/OG-tag scraper**

Included because the task named the area, but Cinch has no surface that
renders an arbitrary external URL as a rich card today — no bio-link field,
no "share a link in a borrow request" flow, nothing in the locked page
inventory implies one. A link-preview feature would be a **new product
surface** by the charter's own decision test (`does this fit the locked
palette and existing pages` — there's no existing page for it to land in).

**Verdict: reject — out of scope by charter.** Documented for completeness;
no adaptation proposed. If a future (non-refurb) product decision adds
bio links or in-app links, `metascraper`'s server-side OG-tag extraction
(run in an Edge Function, cached in Postgres, never client-side — avoiding a
mobile app making an unbounded fetch to an attacker-controlled URL) is the
right shape to copy then, not now.

---

## E. Optimistic like/vote patterns

Covered principally via #1 (Bluesky) and #2 (TanStack Query) above. One more:

### 12. `Expensify/App`

**4,993 stars · MIT · pushed 2026-08-06 · large FOSS React Native app (chat-centric expense management)**

Chosen for scale: one of the largest fully open-source production RN
codebases, and — like Cinch — built offline-first with heavy optimistic UI
across a real backend (Onyx, their own client-side reactive store, roughly
analogous in spirit to what TanStack Query's cache does for Cinch). Their
optimistic-request convention (`optimisticData` / `successData` /
`failureData` triples passed into every API call site) is the cache-write
pattern again, at app-wide scale, with a hard-won rule worth stealing as
*discipline* even without the machinery: every optimistic write ships
alongside its own explicit rollback, authored at the same call site, never
inferred. Cinch's `invalidate-don't-patch` rule sidesteps needing this
machinery at all (there's nothing to roll back if nothing was optimistically
written) — which, now having read Expensify's alternative, reads like the
simpler and more defensible choice for a codebase this size, not a shortcut
Cinch should reconsider.

**Verdict: reject adoption, confirms existing approach.** Expensify's own
scale is the argument *for* keeping Cinch's simpler rule, not against it.

---

## F. Notifications / mentions models

### 13. `discourse/discourse`

**47,611 stars · GPL-2.0 · pushed 2026-08-06 · widely regarded as best-in-class OSS notification architecture**

Discourse's notification center groups by *type* (like, mention, reply,
group-invite, etc.), collapses repeats of the same type on the same object
into one row with a "+N others" tail, and marks read on scroll-into-view
rather than on open — meaning the unread count decrements as you actually
see items, not as a side effect of opening a screen that happens to contain
them. None of this has a landing spot in Cinch's locked page inventory: there
is no notifications screen, and the charter is explicit that new *pages*
need documented necessity with a sheet/inline state strongly preferred. The
one piece that *does* fit an existing surface without becoming a new page is
the count itself — see §8's tab-badge refinement, which borrows only "an
unread number badges an existing icon," not the model behind it.

**Verdict: reject the model; adapt one number.** Full notification-center
architecture is out of scope; an unread-count badge on an existing tab icon
is in scope and proposed in §8.

### 14. `mattermost/mattermost`

**38,696 stars · source-available "Other" license (not pure OSI — flag before
citing as a licensing precedent for anything actually copied) · pushed 2026-08-06**

Included for its mention-grouping and "@here / @all" style batching, and
for its channel-level mute/notification-preference model (per-conversation
overrides on top of a global default) — a pattern that would matter if Cinch
ever added per-event or per-friend notification granularity. Nothing in
Cinch's current surface needs this; events and friend circles today have no
notification preferences at all (silent by design in several places —
`social-graph/mutations.ts`: "No notification fires anywhere; silence is
always ambiguous" on unfollow, and `event-outfits/mutations.ts`: "Silent to
everyone — retraction never notifies" on vote withdrawal). That silence
appears to be a deliberate product stance, not a gap, so this repo's pattern
doesn't map to anything to change.

**Verdict: reject.** No landing surface; the silence Cinch already ships
looks intentional rather than missing.

### 15. `supabase/supabase`

**107,639 stars · Apache-2.0 · pushed 2026-08-06 · Cinch's actual backend**

Researched for Realtime's Postgres-changes-as-notifications pattern
(`supabase.channel().on('postgres_changes', ...)`), since it's the natural
transport if Cinch ever wants a live badge count without polling. Cinch
already has exactly one Realtime subscription in the codebase
(`features/events/use-event-channel.ts`, scoped to one event's comment/post
activity while that event screen is open) — so the precedent for "subscribe,
don't poll" is established; extending it to a standing app-wide subscription
for friend-request/borrow-request counts is a bigger commitment (a
long-lived channel outliving any one screen, reconnect-on-background
handling) than this pass's proposed badge needs. The badge in §8 is scoped
to refetch-on-focus/pull-to-refresh, matching how `useFrienderCount` already
behaves on Closet (`"Nobody tells this device that someone followed you, so
the pull is the only thing that ever makes the FOLLOWERS numeral current"`)
— i.e., the codebase already accepts eventual-not-live consistency for
exactly this class of number.

**Verdict: adapt the existing single-event-channel precedent for a possible
future live badge; not needed for the refinement proposed now.**

---

## G. Search UX

### 16. `typesense/typesense`

**26,405 stars · GPL-3.0 · pushed 2026-08-05 · typo-tolerant instant-search engine**

Not a dependency candidate (a whole search engine for Cinch's in-app friend
search and closet search, which run over tables in the low hundreds-to-low-
thousands of rows per user, is disproportionate infrastructure — Postgres
`ilike` prefix matching, which is what `features/social-graph/queries.ts` and
`features/events/queries.ts` already do, is the right amount of engine for
this data volume). Researched purely for the *client-side ergonomics*
Typesense's own reference UI and InstantSearch-style integrations
demonstrate: **debounce the query, not the render.** Every Typesense-backed
search box waits ~150–200ms of no keystrokes before firing, which is the one
thing conspicuously absent from all three of Cinch's live search fields.

Checked directly: `useProfileSearch` (`features/social-graph/queries.ts:161`),
`useInviteCandidates` (`features/events/queries.ts:244`), and the closet's
own in-memory filter (`app/(tabs)/closet.tsx:167`, client-side so debounce
matters less there but the two network-backed ones fire a fresh Supabase
round trip on every keystroke once past the 2-character floor). Neither
query hook debounces the key that drives `queryKey`; TanStack Query dedupes
identical keys but a fast typist still fires one request per keystroke on the
network-backed searches. This is real, both as unnecessary Supabase load and
as visible jank if a slow connection has three requests racing and resolving
out of order — the last-fired request should always win, but nothing in
either hook enforces that ordering beyond React Query's own key-based
cancellation, which does handle it correctly, so the actual user-facing cost
here is purely wasted round trips, not a correctness bug.

**Verdict: adapt (no dependency).** Debounce the query key with
`useDeferredValue` (React 19, already available with no new import) or a
~15-line `useDebouncedValue` hook. Proposed in §8.

---

## H. Drafts / offline behavior

### 17. `element-hq/element-x-ios`

**912 stars · AGPL-3.0 · pushed 2026-08-06 · Matrix's flagship iOS client, SwiftUI/Rust — not React Native**

Included despite the platform mismatch because Matrix clients solve a genuinely
hard version of "draft persistence across app kill" (a composed-but-unsent
message must survive the OS killing the app mid-type, survive account
switching, and never leak into the wrong room) and Element's approach —
persisting the draft keyed to the conversation the moment text stops
changing for ~1s, not on every keystroke, and clearing it only after the
server confirms send — is a clean debounced-write pattern. Cinch has exactly
one free-text compose surface with meaningful loss-on-kill risk: the borrow
request message field and the event comment/compliment composer
(`components/event-outfits/PostComposer.tsx`, not read in full this pass).
Whether either currently persists a draft across a background/kill cycle
wasn't verified — flagged as a follow-up check, not a confirmed gap.

**Verdict: reject the codebase as a reference for anything beyond the
technique; adapt the debounced-persist-on-pause pattern** *if* the follow-up
check finds Cinch's composers don't already survive backgrounding. Not
promoted to the top-8 below because it's conditional on an unverified premise.

### 18. `GetStream/stream-chat-react-native`

**1,175 stars · "Other" (source-available; the SDK is free but talks to
Stream's paid hosted Chat API) · pushed 2026-08-06**

Reviewed for its offline queue (compose while offline → message sits in a
"sending" state → auto-retries on reconnect, `NetInfo`-driven) as a pattern
reference for event comments/borrow requests written while the device has no
connectivity. The SDK itself is disqualified outright: it requires Stream's
hosted backend, which is a second backend alongside Supabase — a non-starter
under "no new dependency" and, more fundamentally, an architecture change
(splitting the social layer across two vendors) the charter's page-inventory
and navigation locks don't contemplate touching.

**Verdict: reject outright**, dependency and architecture both disqualify it.
Noted only because the offline-queue *shape* (optimistic local row, retry-on-
reconnect via `NetInfo`) is worth knowing exists as prior art if Cinch's own
comment composer ever needs one — no evidence gathered this pass that it does.

---

## I. Deep linking

Covered by #5–7 (`react-native-screens`) and #10/#4 (`expo/expo`,
`expo-router`) above: Cinch's `expo-router` file-based routing already gets
correct deep-link → screen-stack restoration for free from `expo-router` +
`react-native-screens`' native-stack state serialization. `event/[id]/*.tsx`
and `friends/[userId].tsx`'s dynamic segments are exactly the pattern every
repo researched converges on (URL segment → typed route param → query hook),
so there's nothing to import here — Cinch's existing routing already is the
reference implementation this category would recommend.

**Verdict: preserve exactly.**

---

## J. Reporting / blocking UX

### 19. `mastodon/mastodon`

**50,178 stars · AGPL-3.0 · pushed 2026-08-06 · the most-cited OSS reference for report/block flows**

Mastodon's report flow asks for a reason from a fixed, short taxonomy before
letting free text in — structurally identical to Cinch's own
`REPORT_REASONS` list in `features/social-graph/moderation.ts:41` (five
options, "Other" last, explicit in the code comment about why: "a report we
can't categorise beats an abuse we never hear about"). Cinch's own comment
here is, word for word, the same reasoning Mastodon's own moderation docs
give for keeping the reason list short and closed-with-an-escape-hatch. No
delta found.

Their block UX differs in one place worth naming: Mastodon shows the
blocker a confirmation with *consequences spelled out* ("they won't be able
to follow or message you; you won't see their posts") before committing,
whereas Cinch's `useBlockUser` fires immediately from wherever it's called
(the confirmation, if any, lives in the calling screen, not the hook —
not verified across every block entry point this pass). Worth a spot-check
that every block button in Cinch (friend profile, event roster) confirms
with the same consequence sentence Mastodon prints, since a silent
one-tap block is a higher-stakes accidental-tap surface than most controls
in the app.

**Verdict: preserve the reason-taxonomy design (already matches best
practice). Spot-check confirmation copy consistency** — not promoted to the
top-8 (likely already handled per-screen; flagged for a cheaper follow-up
grep rather than this pass's deeper research budget).

### 20. `pixelfed/pixelfed`

**7,051 stars · AGPL-3.0 · pushed 2026-06-29 (slightly cooler cadence than the
others but not stale) · federated Instagram-alternative, PHP/Laravel + a
React Native-adjacent... actually a native-ish mobile client**

The closest product shape to Cinch of anything on this list: a photo-forward,
profile-and-grid social app. Its blocking model is notably *quieter* than
Mastodon's — blocking someone does not notify them, mirrors Cinch's own
"the blocked woman sees nothing and is told nothing" design
(`social-graph/moderation.ts:99`) exactly. Its profile-grid interaction
(tap opens detail, long-press offers a quick-action sheet) is the same
tap/long-press split Cinch's `closet.tsx` already implements for selection
mode (`togglePicked` / `beginSelection`). No delta found in either area —
cited because two independent products converging on the same UX
independently is itself useful confirmation that Cinch's existing choices
are the industry-standard ones, not idiosyncratic.

**Verdict: preserve exactly.** Confirms current design; no action.

---

## K. Profile interaction patterns

Covered by #20 (Pixelfed) above and by direct comparison against Cinch's own
`closet.tsx`, which already implements the "page IS the profile" pattern
(stats row, highlights rail, grid, one continuous scroll) the founder
specified directly rather than via a researched repo — no external pattern
proposed here that Cinch doesn't already have a considered reason for its
current choice.

---

## Summary table

| # | Repo | Stars | License | Maintained | Area | Verdict |
|---|------|------:|---------|------------|------|---------|
| 1 | bluesky-social/social-app | 18,180 | MIT | active | Feed/shadow cache | Adapt (technique) |
| 2 | TanStack/query | 50,078 | MIT | active | Optimistic patterns | Adopt (already) |
| 3 | Shopify/flash-list | 7,168 | MIT | active | List recycling | Preserve |
| 4 | react/react-native | 126,298 | MIT | active | RefreshControl baseline | Reject (is platform) |
| 5 | software-mansion/react-native-reanimated | 10,947 | MIT | active | Custom pull-to-refresh | Reject |
| 6 | software-mansion/react-native-gesture-handler | 6,774 | MIT | active | Gesture primitives | Preserve |
| 7 | software-mansion/react-native-screens | 3,705 | MIT | active | Deep-link restoration | Preserve |
| 8 | immich-app/immich | 109,858 | AGPL-3.0 | active | Image derivative pipeline | Preserve |
| 9 | react-native-image-picker/react-native-image-picker | 8,637 | MIT | maintained | Picker permission edge cases | Reject swap / adapt checklist |
| 10 | expo/expo (expo-image) | 51,393 | MIT | active | Image caching | Preserve |
| 11 | microlinkhq/metascraper | 2,721 | MIT | active | Link previews | Reject (no surface) |
| 12 | Expensify/App | 4,993 | MIT | active | Optimistic UI at scale | Reject (confirms current) |
| 13 | discourse/discourse | 47,611 | GPL-2.0 | active | Notification center | Reject model / adapt badge |
| 14 | mattermost/mattermost | 38,696 | Source-available | active | Mention grouping | Reject (no surface) |
| 15 | supabase/supabase | 107,639 | Apache-2.0 | active | Realtime notifications | Adapt precedent (future) |
| 16 | typesense/typesense | 26,405 | GPL-3.0 | active | Search debounce | Adapt (no dependency) |
| 17 | element-hq/element-x-ios | 912 | AGPL-3.0 | active | Draft persistence | Conditional adapt |
| 18 | GetStream/stream-chat-react-native | 1,175 | Source-available | active | Offline message queue | Reject (2nd backend) |
| 19 | mastodon/mastodon | 50,178 | AGPL-3.0 | active | Report/block UX | Preserve / spot-check |
| 20 | pixelfed/pixelfed | 7,051 | AGPL-3.0 | active | Profile grid + quiet block | Preserve |

---

## Eight refinements for existing screens

Each is a refinement of a screen already in the locked inventory — no new
page, no new dependency, no cache-write pattern contradicting the codebase's
own `invalidate-don't-patch` rule.

**1. Debounce the two network-backed search fields.**
`src/features/social-graph/queries.ts:161` (`useProfileSearch`) and
`src/features/events/queries.ts:244` (`useInviteCandidates`) fire a fresh
Supabase round trip on every keystroke past the 2-character floor. Wrap the
trimmed query in `useDeferredValue` (React 19, no import needed) at the two
call sites — `src/app/(tabs)/explore.tsx:50` and
`src/app/event/[id]/invite.tsx:41` — or a small shared `useDebouncedValue`
hook if `useDeferredValue`'s scheduling proves too eager under load. Fewer
wasted requests, less flicker on a slow connection, zero new dependency.
*(Source: pattern observed across every Typesense/InstantSearch-style search
UI researched — #16.)*

**2. Unread badge on the tab that owns friend requests.**
`src/app/(tabs)/_layout.tsx` has no badge logic anywhere; `useFriendRequests`
(imported in `src/app/friends/index.tsx:18`) already computes the exact count
that should drive it. A woman with two pending requests currently has no
signal from the tab bar that anything is waiting — she finds out only by
opening Closet → Followers → Friends. Add a small dot-or-count badge to the
Closet tab icon (where the follower/friend surface lives) sourced from the
same `useFriendRequests` query, refetched on focus the way `useFollowerCount`
already is (`closet.tsx:277`, `"the pull is the only thing that ever makes
the FOLLOWERS numeral current"` — same eventual-consistency posture, just
also on tab focus). Classifies as "add missing state," not a new page.
*(Source: notification-badge pattern common to #13 Discourse and #14
Mattermost, scoped down to "badge a count," not their full model.)*

**3. Explore's 40-item cap needs a continuation, not a wall.**
`src/features/explore/queries.ts:45` (`NEW_ADDITIONS_LIMIT = 40`) is a hard
`.limit(40)` with no `fetchNextPage` — a woman with an active circle can have
genuine unseen additions fall off the bottom with zero signal more exist.
Convert `useNewAdditions` to `useInfiniteQuery` keyed on `created_at` cursor
(both halves of the union — `friend_items` and the caller's own `items` —
already `order('created_at', ...)`, so a keyset cursor is a straightforward
`.lt('created_at', cursor)` addition to both branches) and add a quiet
"Earlier" affordance at the foot of the timeline in
`src/app/(tabs)/explore.tsx:339` (after the last day group, before the
"Your circle" link), matching the field guide's restraint — text link, not
a spinner-triggering auto-load, so the page still reads as "a lookbook page,
not an infinite feed" per the existing doc comment at
`features/explore/queries.ts:44`.
*(Source: #1 Bluesky's cursor-pagination shape, #3 FlashList's own pagination
guidance.)*

**4. Vote pill: show the tap before the network confirms it.**
`src/components/event-outfits/VotePill.tsx:66` replaces the entire label
with a spinner while `pending` is true, so a tap on "Pick" shows *nothing*
readable as "picked" until the round trip settles — a beat of dead air on
the app's one voting interaction. `event-outfits/mutations.ts` is off-limits
this session (charter's concurrent-territory list), and rightly so — this
doesn't need it. Add local `useState` in `VotePill.tsx` itself (or the
screen that owns `onToggle`, `src/app/event/[id]/outfits.tsx` — not
off-limits) holding the tapped-but-not-settled picked state, flip the label
to "Picked" immediately on tap, and keep the disabled/opacity treatment
`pending` already provides as the "still working" signal instead of hiding
the label behind a spinner. This is TanStack Query's own "UI-only" optimistic
pattern (#2) — no cache write, so it can't conflict with `invalidate-don't-
patch` — reconciled automatically the moment `onSettled`'s invalidation
lands the real `votes`/`picked` props.
*(Source: #1 Bluesky's shadow-cache *display* discipline, applied without
its cache-write machinery; #2 TanStack's documented UI-only pattern.)*

**5. Closet's three-refetch pull doesn't track its third query.**
`src/app/(tabs)/closet.tsx:271` (`refresh`) fires four `refetch()` calls but
`ClosetGrid`'s `refreshControl` only watches `closet.isRefetching`
(`closet.tsx:412`) — `identity`, `outfitCount`, and `followerCount` can still
be settling after the spinner has already stopped. Combine the flag:
`refreshing={closet.isRefetching || identity.isRefetching ||
outfitCount.isRefetching || followerCount.isRefetching}`. Same fix applies to
Explore's `refreshing` at `explore.tsx:81`, which already combines two of its
three (`additions`, `friends`) but drops `following`. Small, but it's exactly
the kind of "the spinner lied for half a second" seam that reads as sloppy
on a screen this considered everywhere else.
*(Source: #4 react-native's own `RefreshControl` contract — `refreshing`
should track everything the gesture kicked off.)*

**6. Borrow-request and event-invite composers: confirm draft survival.**
Flagged as a check, not a confirmed fix (this pass's research budget didn't
extend to tracing every composer's lifecycle). `components/event-outfits/
PostComposer.tsx` and the borrow-request message field in
`features/social-graph/mutations.ts`'s `useRequestBorrow` caller (wherever
that `TextInput` lives — not located this pass) should be checked for
whether typed-but-unsent text survives the app backgrounding or the OS
reclaiming memory. If it doesn't, the fix is a debounced (~1s idle)
`AsyncStorage` write keyed to the conversation/event id, cleared on send —
no new dependency, `@react-native-async-storage/async-storage` is already
implied by TanStack Query's own persist-client setup
(`@tanstack/query-sync-storage-persister` is already a Cinch dependency).
*(Source: #17 Element's debounced-draft-persist pattern.)*

**7. Block confirmation copy: verify every entry point states the consequence.**
`useBlockUser` (`social-graph/mutations.ts:102`) fires immediately from
wherever it's invoked; the confirmation dialog (if any) is owned by each
calling screen, not the hook, so consistency isn't structurally guaranteed.
Grep every call site of `useBlockUser` (`friends/[userId].tsx` is the
obvious one; check event roster contexts too) and confirm each shows the
same "she won't be able to follow or message you; this can't be undone from
here" shape of sentence before committing — matching the specificity
`closet.tsx`'s own remove-item confirmation already sets as the house
standard (`"It leaves your closet and its photos are deleted. This can't be
undone."`, `closet.tsx:246`). A silent one-tap block is a higher-stakes
accidental-tap surface than most controls in the app and deserves the same
named-consequence treatment Cinch already gives item deletion.
*(Source: #19 Mastodon's consequence-stated block confirmation.)*

**8. Friend-request and borrow-request rows: loading skeleton parity.**
Not verified in depth this pass, flagged from the pattern established at
`app/(tabs)/closet.tsx:328` (`ClosetGridSkeleton`) and `explore.tsx:262`
(`NewAdditionsSkeleton`) — both screens researched this pass show a shaped
skeleton, not a spinner, while loading. Worth a quick check that
`friends/index.tsx`'s requests list and any borrow-request list use the same
`RowSkeleton` idiom already built and used in `event/[id]/invite.tsx:118`
rather than a bare `ActivityIndicator`, for the same "the shape of the
content should be visible before the content is" reasoning the rest of the
app already applies.
*(Source: general "perceived speed" throughline across every feed-pattern
repo researched, not one specific repo.)*
