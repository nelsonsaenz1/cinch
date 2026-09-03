# Performance audit — 2026-09-02

Scope: `/Users/nelsonsaenz/cinch`, Expo 57 / React Native 0.86 (new arch, Hermes) / React Query / Supabase. Audit only — no files under `src/`, `supabase/`, `tests/`, or `scripts/` were modified.

## How to read this

This codebase is unusually disciplined about performance already — signed-URL batching, `expo-image` cache-key stability, FlashList v2, memoized generation, deferred update checks, and a hand-tuned React Query persistence allowlist are all in place and well documented in-line (often citing a specific incident, e.g. the 2026-08-20 Plan-tab freeze). Because of that, the findings below skew toward **specific regressions against the app's own established conventions** and **quantifiable scaling risk**, rather than generic anti-patterns — most of the generic ones (missing `keyExtractor`, uncleaned subscriptions, context thrash, N+1 loops) were checked for and not found.

---

## Top 15 findings

| # | Finding | File:line | Est. user impact |
|---|---|---|---|
| 1 | Outfit-generator Stage C is combinatorial in mid-layer × outerwear counts, uncapped by any beam before full scoring | `src/lib/styling/generate.ts:208-240` | High — same failure class as the documented 8/20 freeze, not covered by that fix; scales to ~200k `scoreOutfit` calls at 500 items |
| 2 | "Wears well with" rail bypasses the app's own signed-URL cache-key convention | `src/components/item/wears-well-with.tsx:72-80` | Medium — item detail rail re-downloads garment thumbnails every ~50 min instead of hitting disk cache |
| 3 | The Ten onboarding grid keys `<Image>` on the raw rotating signed URL | `src/components/onboarding/ten-parts.tsx:329-345`, `src/app/the-ten.tsx:452-462` | Medium — forces a full remount/reflicker of filled slots on every URL re-sign during a multi-minute onboarding flow |
| 4 | `select('*')` on `items` fetches the unused raw-model `ai_tags` blob on every closet read | `src/features/closet/queries.ts:64-94,129-138,167-207` | Medium — pure wasted payload + JSON-parse on every closet/review-queue load, scales with closet size |
| 5 | No supporting index for the review-queue filter | `src/features/closet/queries.ts:169-175` vs `supabase/migrations/20260803154431_initial_schema.sql:116-123` | Low-medium today, grows with closet size (audit's own 500-item ceiling) |
| 6 | Primary closet read has no `.limit()` | `src/features/closet/queries.ts:129-138` | Low today, compounds with #1 and #4 as closets grow |
| 7 | Two independent image-prep passes run sequentially per upload job | `src/features/ingest/upload-queue.ts:727-728,781-782` | Low-medium — adds latency to every photo in a bulk import burst |
| 8 | Two independent object uploads run sequentially per job | `src/features/ingest/upload-queue.ts:815-820` | Low — same shape as #7, smaller win |
| 9 | Item-detail tag-poll invalidates the *entire* closet query, not the one item | `src/app/item/[id].tsx:411-418` | Low-medium — full wardrobe refetch every 4s while any tag is in flight |
| 10 | Derived job arrays recomputed unmemoized on a screen that re-renders per progress tick | `src/app/capture.tsx:807-814` | Low — bounded array size, but avoidable churn during active uploads |
| 11 | `components/ui` barrel re-exports 26 unrelated primitives to 54 importers | `src/components/ui/index.ts:10-77` | Low — Metro doesn't eliminate unused re-exports; marginal since most primitives ship app-wide anyway |
| 12 | `dev-fixtures` (387 files, 2.0 MB source) are unreachable dead code, not merely `__DEV__`-gated | `src/dev-fixtures/`, `src/app/_layout.tsx:154-167` | None on the shipped bundle (verified excluded) — but flags a broken dev-QA tool and vestigial gating logic |
| 13 | Two competing signed-URL cache-key implementations coexist | `src/features/closet/use-image-urls.ts:86-89` vs `src/components/media/media-state.ts:80-105` | None directly, but the drift is what produced #2/#3 |
| 14 | `sweepPendingTags` processes tag requests strictly sequentially | `src/features/ingest/upload-queue.ts:1098-1099` | Low — intentional rate-limiting, but worth confirming batch size is small |
| 15 | React Query defaults are well-tuned; flag only as a positive control | `src/lib/query-client.ts:19-30` | None — included so the audit records what was checked and found healthy |

Detail on each follows, grouped by the audit's original categories.

---

## 1. Lists

**Result: no significant issues found.** The closet grid (`src/components/closet/closet-grid.tsx`) uses FlashList v2 (`@shopify/flash-list@2.0.2`) correctly:
- `keyExtractor={(item) => item.id}` (line 102) — stable.
- `extraData` is explicitly set to a string combining stacked-mode and selection size (line 101) so cell recycling doesn't hide selection/Dynamic-Type changes — a real subtlety handled correctly.
- No `estimatedItemSize`/`getItemType` is set, which is correct for FlashList **v2** (auto-sizing; v1 props are gone, not merely optional — see the file's own comment at line 61-63).
- `ItemCard` is wrapped in `React.memo` (`src/components/closet/item-card.tsx:327`).

Every other long-ish collection in the app (`FlatList` in `src/app/(tabs)/index.tsx:1726` for Today's outfit plates, `src/app/friends/[userId].tsx` and `src/components/social/FriendItemCard.tsx` via FlashList) has a stable `keyExtractor`. The many `ScrollView` + `.map()` call sites found (catalogue taxonomy pickers, settings rows, activity feed inside a bounded 40-item unit per `src/app/(tabs)/explore.tsx:504` comment, dev-fixtures) are all bounded, small collections by construction — not FlashList candidates.

## 2. Images

**Two real regressions against an otherwise strong convention (findings #2 and #3 above).**

The app has a deliberate, well-documented pattern for signed URLs: strip the rotating `?token=` query so `expo-image`'s disk cache keys on the stable object path, not the URL. It exists in **two** places:
- `src/features/closet/use-image-urls.ts:86-89` (`stableImageSource`) — unconditional `split('?')[0]`, used at 17+ call sites (`match-sheet.tsx`, `garment-search-sheet.tsx`, `gap-card.tsx`, `item-edit-sheet.tsx`, `review-card.tsx`, `plate-card.tsx`, social components, etc.).
- `src/components/media/media-state.ts:52-105` (`pictureKey`/`mediaSource`, consumed by `GarmentImage`) — a newer, *conditional* version that only strips the query when what remains still names a file, specifically to avoid colliding every Metro dev-asset URL onto one cache key (documented at line 63-78). Used by `ClosetGrid`/`ItemCard` (`src/components/closet/item-card.tsx:214-219`, passing `recyclingKey={item.id}`).

Both are legitimate and battle-tested. But two call sites use **neither**:

- **`src/components/item/wears-well-with.tsx:72-80`** — the `Well` component renders `<Image source={{ uri: piece.imageUri }} cachePolicy="memory-disk" ... />` with no `cacheKey`. `piece.imageUri` is populated at `src/app/item/[id].tsx:297` via `resolve(piece.listingPath, piece.cutoutPath, piece.thumbPath)` — the same `useSignedUrls().resolve` that produces the exact token-bearing URLs the two helpers above exist to neutralize. Per the codebase's own account of this bug class (`media-state.ts:56-61`): "the same garment photograph was written to disk under a new key every hour and never once read back... every cell fell back to a placeholder even though the bytes were already on the device." The "Wears well with" / "Pairs by colour" rail on the item detail screen (a screen users revisit constantly while building outfits) will silently refetch every tile over the network roughly hourly instead of hitting the local cache expo-image already has.

- **`src/components/onboarding/ten-parts.tsx:334`** — worse: `<Image key={imageUri} source={{ uri: imageUri }} .../>`, using the *raw rotating URL itself* as the React reconciliation key. `imageUri` comes from `src/app/the-ten.tsx:452-462`'s `resolve(g.platePath, g.cutoutPath, g.thumbPath)`. Any time the signed URL is re-signed (`REFETCH_AFTER_MS = 50 * 60_000` in `use-image-urls.ts:12`) while a user is still in the first-run "Ten" flow, every filled slot's `<Image>` component — not just its source — unmounts and remounts, which will visibly flash/reflow the tile in addition to defeating the cache.

Fix for both: route through `stableImageSource(...)` (already imported app-wide) or `GarmentImage`, and never key an element on a value that changes without the underlying resource changing.

**Everything else checked was healthy:** `use-image-urls.ts` batches all signed-URL requests for a screen into one Storage call (`createSignedUrls`, line 42-44) rather than per-image — every screen surveyed (`explore.tsx`, `(tabs)/index.tsx`, `item/[id].tsx`, `the-ten.tsx`, etc.) calls `useSignedUrls` once at the container level with a `flatMap` of all paths, not per-row. `src/lib/image.ts` correctly downsizes to 1024px (upload) / 400px (thumbnail) client-side via the native `ImageManipulator`, avoiding Supabase's per-origin-image billing — this doesn't block the JS thread since it's a native module call, not JS pixel manipulation.

## 3. Queries

**React Query defaults (`src/lib/query-client.ts:19-30`) are deliberately tuned and correct:** `staleTime: 5min`, `gcTime: 24h`, `refetchOnWindowFocus: false`, `retry: 2`. No query overrides `refetchOnMount`/`refetchOnWindowFocus` inappropriately; the only two `staleTime: 0` overrides found are for push-permission status and a dev fixture, both legitimately always-fresh reads.

**`ai_tags` waste (#4).** `src/features/closet/queries.ts:60-62` documents that `ai_tags` (the tagger's raw model response) is deliberately excluded from the mapped `Item` type because "nothing in the app reads it." But the fetch itself is `select('*')` at lines 134, 167(ish), and 198 (`useCloset`, `useReviewQueue`) — so the raw JSON blob is pulled over the wire and discarded for every item, every closet load. At 200-500 items this is avoidable payload and parse cost on the single most-visited screen in the app. Same `select('*')` pattern recurs at `src/features/closet/storage.ts:165`, `src/features/styling/queries.ts:116`, `src/features/event-outfits/queries.ts:63,69,74,167`, `src/features/intake/queries.ts:51,83`, `src/features/social-graph/queries.ts:318,359,434,517` — worth an explicit-column pass across all `items`-table reads; the `trips`-table ones checked (`src/features/plan/use-trips.ts:121` etc.) are `limit(1)` single-row reads and not a concern.

**Missing index (#5).** `useReviewQueue`/`useReviewCount` (`src/features/closet/queries.ts:169-175`) filter `user_verified = false AND status IN ('tagged','needs_review')`. The schema's only relevant partial index, `items_pending_tag_idx` (`supabase/migrations/20260803154431_initial_schema.sql:120`), covers `status IN ('pending_tag','needs_review')` — a *different* status pair. This query falls back to the plain `items_user_id_idx` btree and scans the user's whole row set. Low-impact at today's per-user counts (Postgres will happily filter a few hundred rows), but worth closing given the audit's own 500-item ceiling.

**Missing `.limit()` (#6).** `useCloset` (`src/features/closet/queries.ts:129-138`) is unbounded. Reasonable for a personal wardrobe today, but it's the one query whose cost compounds directly with closet size and with finding #4.

**No waterfalls found.** The one dependent-query chain located (`src/app/activity/reaction/[id].tsx:92`, `enabled: Boolean(event.data?.subjectId)`) is a genuine data dependency, not an avoidable one. `useShopFeed` (`src/features/explore/use-shop-feed.ts:56`) fans out its per-slot browse calls with `Promise.all`, not sequentially. No `for...of` loop containing `await supabase...` was found anywhere in `src/` except two intentionally-sequential, rate-limited cases (`upload-queue.ts:1098-1099` sweeping tag requests one at a time — see #14 — and a 4-item storage-path cleanup loop in `closet/mutations.ts:270`, which is fixed-size and trivial).

**Realtime**: the one realtime channel in the app (`src/features/events/use-event-channel.ts:27-70`) is opened in `useFocusEffect` and torn down with `supabase.removeChannel` on blur (line 63-67) — correctly scoped, not leaked.

## 4. Render

**No problematic context providers.** The app has exactly one React context (`ToastContext`, `src/components/ui/toast-host.tsx:92`); its provider value is `useMemo`'d (line 147: `useMemo<ToastApi>(() => ({ show, dismiss }), [show, dismiss])`) with both `show`/`dismiss` themselves `useCallback`'d. `src/app/_layout.tsx` and `src/features/context/` were checked for the described "value object recreated per render" anti-pattern and it is not present — `useStyleContext` and friends are built from `useQuery`/`useMemo`, not a raw context.

**Styling engine (`src/lib/styling`)** is correctly memoized at its one consumer, `src/features/styling/use-outfits.ts:139-149`: `generateOutfits` runs inside `useMemo` keyed on `[enabled, wardrobe, context, profile.weights, profile.affinities, favorites.data]`. The other two callers of `generateOutfits` (`src/features/stylist/use-chat.ts:399,449`, `src/features/plan/packing.ts:127,217,331,343`) are inside async message/packing handlers, not render bodies — correct. `outfit-count.ts`'s arithmetic counter and `gap-feed.ts`'s tally-based helpers are O(1)/O(4) over a 4-bucket `Tally`, not the wardrobe array, and the `Tally` itself is built once via `useMemo(() => tallyOf(items), [items])` (`src/app/(tabs)/index.tsx:1082`).

**Zustand.** Only two stores exist (`src/features/ingest/queue-store.ts`, `src/features/ingest/local-photos.ts`). Selectors observed (`src/app/the-ten.tsx:278,477`, `src/app/capture.tsx:388-391`, `src/app/review.tsx:78`) select primitives or the raw `jobs` array field directly — no selector was found constructing a fresh object/array inline inside the zustand selector itself (which would cause an extra re-render every store tick). The one mild inefficiency (#10) is downstream: `src/app/capture.tsx:807-814` calls `selectFailedJobs(jobs)` / `cutoutFailures(jobs)` / two inline `.filter()`s directly in the render body rather than in a `useMemo`, on a screen that re-renders on every upload-progress percentage change. `jobs` is bounded (the docblocks reference a "60-photo import" as the stress case) so this is cheap in absolute terms, but it's the one spot doing unmemoized array work on a high-frequency render path.

**Reanimated.** No shared-value writes inside a `.map()`/`for` loop were found in the files that combine `useSharedValue` with iteration (`(tabs)/index.tsx`, `(tabs)/plan.tsx`, `match-sheet.tsx`, `skeleton.tsx`, `today/plate.tsx`, `upload-queue-list.tsx`, `stack-composer.tsx`) — the shared values in those files are per-component instances, not per-loop-iteration writes on the JS thread.

## 5. Startup

**Result: deliberately staged, no blocking network calls before first paint.** `src/app/_layout.tsx`:
- Splash is held only on font loading (`SplashScreen.preventAutoHideAsync()` at line 41, hidden at line 263 once `fontsLoaded || fontError`).
- `PersistQueryClientProvider` wraps everything, but rehydration is synchronous-local (SQLite kv-store, not network) — see §6.
- `UpdateCoordinator` (`src/features/updates/update-coordinator.tsx`) defers its first `expo-updates` check by `LAUNCH_CHECK_DELAY_MS = 4_000` (`src/features/updates/policy.ts:9`) and fires it as `void check('launch')` — fire-and-forget, never blocks rendering.
- `AnalyticsProperties` (`src/features/analytics/analytics-properties.tsx`) is effect-driven and de-duplicates sends via a ref (`sent`, line 46) so it never fires a PostHog person-update per render.
- `AuthGate`'s session-loading branch (`src/app/_layout.tsx:224-232`) renders a static wordmark on the same canvas color as the splash screen rather than a spinner — a deliberate anti-flicker choice, not a perf issue, but worth noting it's intentional.

No issue found here beyond what's already covered by finding #1 (the styling engine, which *is* invoked on the first Today render via `useOutfits`, but is bounded by the memoization described in §4 and only becomes expensive at the closet sizes quantified in the next section).

## 6. Persistence

**`src/lib/query-client.ts`** uses `expo-sqlite/kv-store` with `createSyncStoragePersister` — a deliberate choice over MMKV, documented in-line (lines 7-17) as "worth it only if profiling shows this is a bottleneck, which for a closet-sized cache it will not be." This is a reasonable call given what's actually persisted.

**What's persisted is small and correct.** `PERSISTED_KEYS = new Set(['closet', 'wardrobe', 'style-profile', 'trips'])` (line 81) — an explicit allowlist, not a blocklist. Explicitly excluded: `signed-urls` (would rehydrate expired image URLs), `ai-consent` (must be read fresh), `outfit-rerank`/`chat-history` (model output, consent-sensitive), and weather/location/forecast (staleness = wrong forecast). Only successful queries are dehydrated (`shouldDehydrateQuery`, line 83-87). A schema-version buster (`PERSIST_SCHEMA`, line 101-102) invalidates the blob wholesale on a shape change, and `purgePersistedCache()` (line 124-126) is wired to every `SIGNED_IN`/`SIGNED_OUT`/`USER_UPDATED` auth transition from `_layout.tsx:69-78` to prevent a shared-device data leak.

The one thing this persisted allowlist *does* pull in is the full `items` array under the `closet` key — including the `ai_tags` waste from finding #4, since `toItem()` strips it before the object ever reaches the cache, this doesn't inflate the persisted blob; only the network payload is affected. No images or large binary blobs are persisted — paths only, resolved to signed URLs at read time.

**`expo-sqlite` is used, but only via its synchronous key-value wrapper** (`expo-sqlite/kv-store`), not as a relational store — i.e. it backs the React Query persister, not a local `items` table. This matches the audit's question ("is it used?") — yes, but narrowly, and appropriately for the current data volumes.

## 7. Timers/subscriptions

**Result: no leaks found.** Full inventory:
- `setInterval` call sites: `src/app/walkthrough/index.tsx:124`, `src/app/item/[id].tsx:415` (see finding #9 for its scope, not its cleanup), `src/features/auth/use-connectivity.ts:43`, `src/features/intake/use-recorder.ts:268,275`, `src/components/intake/LevelMeter.tsx:124` — every one is inside a `useEffect` (or ref-tracked and cleared in `use-recorder.ts`) with a matching `clearInterval` in the cleanup function.
- `AppState.addEventListener` call sites: `use-style-context.ts:179`, `use-camera-access.ts:91,150,212`, `update-coordinator.tsx:118`, `use-explore-unseen.ts:170`, `use-recorder.ts:230` — all inside `useEffect` with `sub.remove()` (or equivalent) in cleanup. The one exception, `src/features/ingest/upload-queue.ts:1383`, is a deliberate **module-level singleton** guarded by a `sweeperStarted` flag (line 1359-1360, 1377-1378) and explicitly documented as "never removed... it lives as long as the process does, and there is exactly one" — correct by design, not a leak.
- The one realtime channel (`use-event-channel.ts`) is scoped to `useFocusEffect` and torn down on blur — see §3.

## 8. Bundle

**`dev-fixtures` is not actually a bundle-size problem (finding #12 — informational).** `src/dev-fixtures/` contains 387 `.tsx` files (2.0 MB of source), and `src/app/_layout.tsx:154-167` contains logic to intercept `dev-*` route segments and bounce them in production, with a comment describing "Twelve `dev-*` screens... ship in the production bundle whether or not anything linked to them." That comment is now stale: a repo-wide search found **no file under `src/app/` that imports from or re-exports `src/dev-fixtures/`**, and no `dev-*.tsx` files exist under `src/app/` itself (only `src/dev-fixtures/dev-screens.tsx`'s own index references paths like `/dev-closet-visibility`). Since Metro's bundle graph is reachability-based from `expo-router/entry` → `src/app/**`, and nothing in that graph imports the fixtures directory, **the 387 files are already fully excluded from the shipped JS bundle** — verified, not assumed. The practical consequence is the opposite of a perf bug: the `cinch://dev-screens` deep link and every route the AuthGate special-cases can no longer resolve to anything (there's no `src/app/dev-*.tsx` for expo-router to register), so the fixture index this app relies on for visual QA is currently unreachable in `__DEV__` too. Worth a look, but as a broken-tooling ticket, not a performance one.

**`components/ui` barrel (finding #11).** `src/components/ui/index.ts:10-77` re-exports 26 symbols from ~20 submodules. 54 files import through this barrel path rather than the direct per-file path (526 files use the direct paths, so the barrel is a minority pattern but not a rare one). Metro does not perform cross-module dead-code elimination on unused named re-exports by default, so any of those 54 files technically pulls the whole barrel's module graph (Reanimated-backed `pressable-surface.tsx`, `door-plate.tsx`, etc.) into its dependency chain even if it only destructures `{ Text }`. In practice the marginal cost is likely small — nearly every one of those 20 components is already reachable from elsewhere in the app (they're shared UI primitives) — but it's the one true barrel-import pattern the audit's item 8 asked about, and a mechanical `eslint-plugin-import`-style rule against importing from `@/components/ui` (keeping only the 526 direct-path imports as the sanctioned form) would remove the ambiguity.

**No heavy dependency used for a tiny purpose was found.** `package.json` carries no `moment`/`lodash`-class general utility library; date/time handling is hand-rolled in `use-style-context.ts` (`currentSeason`, `minutesFromMidnight`). `posthog-react-native` is configured with `enableSessionReplay: false` and `autocapture={{ captureTouches: false, captureScreens: false }}` (`src/lib/posthog.tsx:54,1233`), avoiding the two heaviest optional features of that SDK.

## 9. Styling generator complexity (`src/lib/styling/generate.ts`)

This is finding #1, expanded with the derivation.

**Where it runs, and how it's guarded.** `generateOutfits` is synchronous and on-device (per the file's own header, "a few milliseconds"). Its one render-path caller (`src/features/styling/use-outfits.ts:139-149`) wraps it in `useMemo`, so it does **not** re-run on every render — only when wardrobe, context, weights, affinities, or favorites change. Its two other callers (`use-chat.ts`, `packing.ts`) are event-driven, not render-path. The accessory-attachment step was already optimized once (comment at `generate.ts:272-281` describes the 2026-08-20 Plan-tab freeze and its fix: attaching accessories only to the `count` chosen outfits instead of all `BEAM_FINAL` candidates).

**What was *not* addressed by that fix: Stage C's own layering fan-out (lines 208-234).** Stage A (`cores`) and Stage B (`shod`) are both beam-capped (`BEAM_CORE = 48`, `BEAM_SHOD = 64`, `generate.ts:36-37`) *before* the next stage runs. Stage C is not: for each of the (up to 64) `rankedShod` bases, it loops over the **full, uncapped** `mids` (`slots.mid_layer`) and `outers` (`slots.outerwear`) pools (lines 223-233), including the nested "mid-layer under outerwear" branch (`for (const outer of outers) { ...; for (const mid of mids) ... }`, lines 226-232). Every combination produced is then scored in full (`pool.map(scoreOutfit)`, line 239) *before* `topBy(scored, BEAM_FINAL)` trims it back down to 40 (line 240). So the number of full `scoreOutfit` calls per generation is approximately:

```
64 × (1 + m + o × (1 + m))     where m = |mid_layer items|, o = |outerwear items|
```

Assuming garments split roughly evenly across the engine's 9 slots (`base_top, mid_layer, bottom, dress, outerwear, footwear, bag, headwear, accessory`):

| Closet size | items/slot (≈N/9) | Stage-C combos scored | vs. 200-item baseline |
|---|---|---|---|
| 50 | ~6 | ~2,800 | 0.08× |
| 200 | ~22 | ~34,000 | 1× (this is the size that produced the 8/20 incident) |
| 500 | ~56 | ~205,000 | ~6× |

Each `scoreOutfit` call (`src/lib/styling/score.ts:145-204`) runs 9 independent rules (palette, formality, weather, occasion, proportion, pattern, season, freshness, affinity) over the 2-6 garments in that candidate, several of which do pairwise color/silhouette comparisons — call it on the order of 100-300 primitive operations plus a handful of small object/array allocations per call once notes and feature-vector objects are counted. At 500 items that's tens of millions of operations and ~200k short-lived object allocations in a single synchronous pass on the JS thread, purely from Stage C — on top of the `topBy` sort of that same ~205k-element array (`generate.ts:240`, an `O(n log n)` sort of the *whole* candidate pool just to keep the top 40).

**Why this matters despite the memoization in §4:** the memo only prevents *redundant* re-runs, not the cost of a *necessary* one. A user with a 500-item, layer-heavy wardrobe (winter coats + knitwear counted generously toward `mid_layer`/`outerwear`) will pay this cost on: first Today load, any weather-context change (temperature crossing the `allowsMidLayer`/`allowsOuterwear`/`wantsOuterwear` thresholds at `generate.ts:94-98` on a shoulder-season day), any stylist chat question, and Plan-tab packing generation — i.e. exactly the surfaces the 2026-08-20 incident was about, and exactly the closet-size ceiling (500 items) this audit was asked to check against.

**Suggested direction (not implemented — audit only):** cap `mids`/`outers` with the same `topBy(..., some bound, coreScore)` pattern already used for `cores` and `shod` before the nested loop at line 226-232, rather than only capping the *result*.

---

## Appendix: what was checked and found healthy (no write-up needed above)

- `keyExtractor` stability across every `FlatList`/`FlashList` in the app.
- N+1 Supabase loops (`for...of` containing `await supabase...`) — none found outside two trivial, fixed-size or intentionally-rate-limited cases.
- Context provider value-object churn — one context in the whole app, correctly memoized.
- `refetchOnWindowFocus`/`refetchOnMount` overrides — none found beyond two justified `staleTime: 0` cases.
- Realtime channel and `AppState` listener cleanup — every non-singleton listener is scoped and cleaned up.
- `expo-image` `recyclingKey` on the one actual FlashList of garment photos (`ClosetGrid`/`ItemCard`) — present and correct.
- Font loading / splash-hide timing, `expo-updates` check timing — both deliberately deferred and non-blocking.
- React Query global defaults — tuned, not left at library defaults.
