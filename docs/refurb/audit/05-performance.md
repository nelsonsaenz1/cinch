# 05 — Performance / perceived-speed audit

Scope: `src/` — lists and virtualization, pagination, signed-URL churn, image
handling, TanStack Query config, layout shift, main-thread work, launch path.
Read-only audit per `docs/refurb/CHARTER.md`. Baseline assumption throughout:
a demo-sized account (~10–50 closet items, ~5 friends, small events).

Overall shape: this codebase is unusually disciplined about performance
already — signed-URL batching, `stableImageSource` cache-key stripping,
`recyclingKey`/`cachePolicy` on every recycled list cell, `refetchOnWindowFocus:
false`, a documented persisted-query allowlist, and a local-first outfit
generator that never blocks first paint. The findings below are the real gaps
in an otherwise careful system, not a laundry list of missing basics.

---

## Lists: virtualization

- [preserve exactly] `src/components/closet/closet-grid.tsx:47` — closet grid
  uses FlashList v2, `keyExtractor`, `extraData={selectedIds}` (correct pattern
  for selection state that doesn't live in `data`), and a memoized
  `ItemCard`. This is the reference-quality list in the app.
- [preserve exactly] `src/app/friends/[userId].tsx:1` and
  `src/components/social/FriendItemCard.tsx` — friend closet also uses
  FlashList with `recyclingKey`/`cachePolicy`. Consistent with the closet grid.
- [preserve exactly] `src/app/(tabs)/explore.tsx:317-339` — the friend-feed
  timeline (`NewAdditionRow` inside grouped `.map`) is a `ScrollView`/`.map`,
  not virtualized — correct choice here because `useNewAdditions` is
  server-capped at `NEW_ADDITIONS_LIMIT = 40` (`src/features/explore/queries.ts:45`),
  documented as "a lookbook page, not an infinite feed." At 40 rows a ScrollView
  is fine; don't "fix" this into a FlashList.
- [fix friction] `src/app/event/[id]/comments.tsx:180-225` — the comment
  thread is `ScrollView` + `.map` over `useEventComments`, which has **no
  limit at all** (see Unbounded queries below). At demo scale (a handful of
  comments) this is invisible. It stops being invisible the first time a
  popular event's table-talk thread hits a few hundred rows: every comment
  mounts at once, `CommentRow` is not memoized, and the realtime channel
  invalidates the whole key on every new comment or vote-adjacent change while
  the screen is open, re-rendering every row each time. Fix: cap the query
  (see below) and/or memoize `CommentRow`.
- [preserve exactly] `src/app/event/[id]/outfits.tsx:458-486` — each
  attendee's board is a horizontal `ScrollView`/`.map` over that one person's
  looks. Bounded by construction (one person's posted outfits, realistically
  1-5), so virtualization would be over-engineering.
- No `FlatList` is used anywhere in the app for a real, growing dataset — the
  one `FlatList` grep hit (`src/components/ingest/garment-search-sheet.tsx:386`)
  is a comment explaining why a *fixed six-tile grid* is hand-laid instead of
  using one. Not a finding, just confirming the inventory: FlashList (closet,
  friend closet) vs. ScrollView+`.map` (everything else, all currently
  small-n) is the actual split.

## Unbounded queries — enumerated and ranked by realistic row growth

None of these paginate. Ranked by how fast a real user's row count grows
past "harmless" for a `ScrollView`/full-fetch pattern:

1. **[fix friction] `src/features/event-outfits/queries.ts:159-180`
   (`useEventComments`)** — `select('*').eq('event_id', eventId)`, no
   `.limit()`. Every comment on an event — table talk plus every look's
   thread — is one cache entry, refetched whole on every realtime change.
   Highest growth risk of the group: a lively event easily produces 100+
   comments, and this is also the query with no virtualization on the render
   side (see above) and a realtime subscription that can fire many times
   during one open screen. **This is the one item on this list actually worth
   prioritizing** — it's the only unbounded query paired with an unvirtualized
   list and a chatty invalidation source.
2. **[fix friction] `src/features/closet/queries.ts:111-143` (`useCloset`)**
   — `select('*').eq('user_id', userId).eq('is_archived', false).order(...)`,
   no `.limit()`/`.range()`. The docblock in
   `src/features/styling/queries.ts:100-104` explicitly claims "the closet
   grid wants display shapes and pagination" — **that pagination doesn't
   exist**. Mitigated today by FlashList's virtualized rendering and the
   30-piece closet cap enforced server-side (`enforce_item_limit`, referenced
   in `src/features/closet/mutations.ts:166-171`) — so the realistic ceiling
   is ~30 rows on Free/current tiers, which is genuinely fine. Flag only
   because the comment overclaims and because a future tier with a higher
   item cap would silently inherit an unbounded fetch with no code change
   needed to notice.
3. **[minor polish] `src/features/styling/queries.ts:105-125`
   (`useWardrobe`)** — same unbounded shape as closet, deliberately (needs the
   whole wardrobe for the beam search). Correct as designed; only flagged so
   it isn't miscounted as an oversight.
4. **[minor polish] `src/features/social-graph/queries.ts:263-337`
   (`useBorrowRequests`)** — no limit; every borrow request the user is ever
   party to, forever, refetched whole. At demo scale (a handful of live
   threads) irrelevant; would matter after months of use with no archiving.
5. **[minor polish] `src/features/social-graph/queries.ts:346-390`
   (`useBlockedUsers`)** — no limit. Realistically stays small for the app's
   lifetime; low priority.
6. **[preserve exactly] `src/features/explore/queries.ts`,
   `src/features/event-outfits/queries.ts:201-250` (`useMyPostableOutfits`,
   `.limit(60)`), `src/features/events/queries.ts` (`useInviteCandidates`
   `.limit(20)`, `useProfileSearch` `.limit(10)` each side)** — these are
   already capped. No action.

No wishlist feature exists in `src/` yet (grep confirms `wishlist_items` is
referenced only as a DB cascade target in a mutations docblock, not read by
any query/screen) — nothing to audit there.

## Signed-URL churn

- [preserve exactly] `src/features/closet/use-image-urls.ts:27-69`
  (`useSignedUrls`) — this is the strongest piece of the whole performance
  story. Paths are deduped + sorted before keying the query (stable cache
  hits regardless of call-site order), signing is batched into one
  `createSignedUrls` call per screen rather than N per-image calls, `staleTime`
  matches a 50-minute refetch interval against a 60-minute TTL so a URL can
  never expire on screen, and `gcTime` matches the TTL exactly. This is a
  textbook implementation; do not change the shape of it.
- [preserve exactly] `stableImageSource` (`use-image-urls.ts:86-89`) strips
  the query string for the `expo-image` `cacheKey` — documented as fixing a
  real bug where every re-signing (hourly) silently orphaned the disk cache
  under a new key. Load-bearing; changing this reintroduces the bug it fixes.
- [minor polish] `src/app/(tabs)/closet.tsx:134-136` — signs
  `platePath + cutoutPath + thumbPath` for **every** item in the closet
  (`items.flatMap((i) => [i.platePath, i.cutoutPath, i.thumbPath])`), even
  though the grid cells only ever resolve `thumbPath`/`cutoutPath`
  (`ClosetGrid`'s `resolveImage` call in `closet-grid.tsx:61`) — `platePath`
  is used only by the favourites/most-worn/latest-pieces rails, which render
  at most `FAVOURITE_LIMIT = 8` items. For a 50-item closet this signs ~100
  extra paths in the one batched request rather than the ~16 the rails
  actually need. Not a network round-trip cost (still one request), but it's
  needless signing-endpoint work and a larger response payload on every
  closet load/pull-to-refresh. Fix: sign `platePath` only for the rail slice,
  not the whole closet.
- [preserve exactly] Per-path failures degrade gracefully — `createSignedUrls`
  reports failures inline instead of throwing, so one deleted storage object
  can't blank a whole grid (`use-image-urls.ts:50-52`).

## Image handling (expo-image)

- [preserve exactly] Every image rendered inside a recycled list cell sets
  both `recyclingKey` and `cachePolicy="memory-disk"`:
  `src/components/closet/item-card.tsx:80-88`,
  `src/components/social/FriendItemCard.tsx:52-58`,
  `src/features/explore/new-addition-row.tsx:90-96`,
  `src/components/today/garment-cell.tsx:212-219`. This is the correct,
  consistent pattern and is the reason the grid doesn't flash stale images
  during fast scrolling/recycling.
- [minor polish] `src/components/social/ProfileRow.tsx:56-63` — avatar
  `<Image source={{ uri: profile.avatarUrl }}>` with no `cachePolicy` and no
  `recyclingKey`. Rendered inside `.map()`-based friend/request/search-result
  lists (`src/app/friends/index.tsx`, `src/app/(tabs)/explore.tsx:220-238`,
  `src/app/event/[id]/invite.tsx`). Low impact because `avatarUrl` is a public,
  stable URL (no re-signing) and these lists are small and not FlashList-
  recycled, so there's no cross-item bitmap bleed to worry about — but adding
  `cachePolicy="memory-disk"` costs nothing and brings it in line with every
  other avatar/thumb in the app.
- [minor polish] `src/components/social/BorrowRequestRow.tsx:69-74` has
  `cachePolicy="memory-disk"` but no `recyclingKey` — low impact (not a
  recycled list), skip unless touching the file for other reasons.
- [minor polish] `src/components/plan/day-row.tsx:130`,
  `src/components/ingest/upload-queue-list.tsx:71` — plain `<Image>`, no
  `cachePolicy`. Both render inside `.map()` loops over small, bounded lists
  (a trip's days; the active upload queue), not FlashList cells, so this is
  cosmetic consistency rather than a real perf gap.
- [preserve exactly] `thumbPath` vs `cutoutPath` vs `platePath` discipline is
  correct everywhere checked: the closet grid resolves
  `thumbPath → cutoutPath` (small, list-appropriate); the favourites/most-worn/
  latest-pieces rails and item detail resolve `platePath → cutoutPath` (the
  styled full-size asset, appropriate for a larger single card); nowhere does
  a full-res original get requested for a grid cell.

## Query config

- [preserve exactly] `src/lib/query-client.ts:19-30` — global
  `staleTime: 5min`, `gcTime: 24h`, `refetchOnWindowFocus: false`. This
  single setting is why tab returns don't visibly re-flicker content that
  hasn't changed — confirmed no screen overrides it to something more
  aggressive than necessary.
- [preserve exactly] `src/lib/query-client.ts:73-79` (`shouldDehydrateQuery`)
  — persists exactly `closet`, `wardrobe`, `style-profile` to SQLite and
  deliberately excludes `signed-urls` (would rehydrate expired/broken image
  URLs), `ai-consent`, and anything model-derived. This is the reason cold
  start shows real content instead of a spinner — well-reasoned, don't widen
  or narrow the allowlist without equal care.
- [preserve exactly] `useSignedUrls`'s per-query `staleTime`/`refetchInterval`
  (see above) and `useEventPosts`/`useMyVote`/`useEventComments`'s
  `staleTime: 15_000` (`src/features/event-outfits/queries.ts:58,129,163`) —
  short enough to stay fresh under the realtime channel, long enough to avoid
  refetching on every remount while the screen cycles focus.
- [fix friction] **No mutation in the app uses `onMutate` for an optimistic
  update.** Grepped for `onMutate` across `src/` — zero hits. Every mutation
  (`useFollow`/`useUnfollow`, `useCastVote`/`useRetractVote`, `useVerifyItem`,
  `useRetagItem`, `useRemoveItems`, `useSetBorrowable`, `useRequestBorrow`)
  goes server round-trip → `onSuccess`/`onSettled` → `invalidateQueries` →
  refetch → re-render. This is the single biggest perceived-latency gap in
  the app: every tap that changes something visible (follow a friend, pick a
  look, remove a piece, verify a review-deck item) shows nothing happening
  until a full network round trip completes, then a second round trip
  (refetch) before the new state paints. On a good connection this is ~200–
  600ms of visible nothing per tap; on a bad one it reads as unresponsive.
  Concretely worst for `useCastVote`/`useRetractVote`
  (`src/features/event-outfits/mutations.ts:113-171`, off-limits to edit per
  the charter's do-not-touch list, so this is a note for whoever owns that
  file next) — that mutation's `onSettled` invalidates all four
  `useEventPosts` sub-fetches (posts, items, counts, votes) plus `myVoteKey`,
  meaning tapping a pick waits for the vote write, then re-fetches and re-
  joins four queries, before the crown/checkmark updates. The follow button
  in `useFollow` (`src/features/social-graph/mutations.ts:33-54`) has the
  same shape and is not off-limits — that's the safe place to add the first
  optimistic-update pattern (toggle the button state via `setQueryData` on
  `onMutate`, roll back `onError`) since `follows` is a simple insert with a
  well-defined 23505 duplicate case already handled.
- [preserve exactly] `useOutfits`'s two-stage design
  (`src/features/styling/use-outfits.ts:79-153`) is the opposite of the above
  — it's the one place in the app that already nails perceived speed: the
  local beam search returns synchronously on first render, and only the AI
  re-rank prose streams in later behind `isEnhancing`. Worth pointing at as
  the pattern the mutation-side fixes above should aspire to.

## Layout shift

- [preserve exactly] `src/app/(tabs)/closet.tsx:318-329` and the `isError`
  branch immediately after — the screen keeps the "Closet" title mounted
  across loading/error/loaded states and swaps only the body
  (`ClosetGridSkeleton` → grid), so the title never jumps. Documented
  explicitly in the code as intentional.
- [preserve exactly] `src/app/event/[id]/outfits.tsx:287-298`
  (`BoardSkeleton`) — skeleton dimensions (`h-72` card at a fixed `width: 300`)
  match `OutfitPostCard`'s real rendered size, so there's no reflow when data
  lands. Same for `ThreadSkeleton` in `comments.tsx:33-48` (avatar disc +
  two text lines matching `CommentRow`'s shape).
- [fix friction] `src/app/item/[id].tsx:124-130` — item detail's loading
  state is a bare `<ActivityIndicator>` on an otherwise-empty screen, not a
  skeleton, while the closet grid it's normally navigated *from* is already
  showing that item's card. Because navigation is usually "tap a card in an
  already-loaded closet," `closet.isLoading` is almost always already
  `false` by the time this screen mounts (`useCloset()` is a warm cache hit
  per the code's own comment at line 92-93), so this branch is rarely seen in
  practice — low real-world impact, but worth a skeleton matching the detail
  layout (image + stat row) for the cold-navigation case (deep link, or a
  slow first closet fetch).
- [preserve exactly] Every other loading state checked (`ErrorState`,
  `EmptyState` compositions in explore/friends/events) uses matched-size
  skeleton primitives (`RowSkeleton`, `NewAdditionsSkeleton`,
  `ClosetGridSkeleton`) rather than spinners, and consistently distinguishes
  loading vs. error vs. empty rather than collapsing them — this distinction
  is called out repeatedly in the code comments as a deliberate fix for a
  real class of past bug (empty state shown over a network error), and it's
  followed consistently everywhere checked.

## Main-thread work in render

- [minor polish] `src/app/item/[id].tsx:36-48,99` (`harmonyCount`) — runs an
  O(closet-size) OKLCH color-distance comparison (`pairHarmony`) on **every
  render** of the item detail screen, not memoized. The screen has local
  `useState` for the price-edit draft field, so every keystroke while editing
  price re-renders the screen and re-runs this loop over the whole closet.
  At demo scale (10–50 items, cheap float math per pair) this is genuinely
  imperceptible — flagged because it's a one-line fix
  (`useMemo(() => harmonyCount(item, closet.data ?? []), [item, closet.data])`)
  that removes any doubt as the closet grows, not because it's currently
  visible.
- [preserve exactly] `src/features/styling/use-outfits.ts:93-106` — the beam
  search (`generateOutfits`) and its `fromEngine` mapping are both correctly
  wrapped in `useMemo` keyed on the actual inputs. This is the heaviest
  computation in the app (a scored search over the wardrobe) and it's handled
  right.
- [preserve exactly] `src/app/(tabs)/closet.tsx:140-177` — `closetStats`,
  `mostWornItems` (×2), `visible` (search filter + sort) are all `useMemo`'d
  against `items`/`query`/`category`. Good.
- [fix friction] `src/app/event/[id]/outfits.tsx:139-148` — `commentCountFor`
  and `voterNamesFor` are plain closures (not `useCallback`/memoized),
  each doing an O(comments)/O(voters) `.filter()`/`.map()`, called once per
  look inside `BoardBand`'s render for every board on the page. `BoardBand`
  itself is not wrapped in `memo`, so every vote/pending-state change on the
  page re-renders every attendee's entire board and re-runs these filters for
  every look on every board. At demo scale (a handful of attendees, a
  handful of looks each) this is invisible; the fix (memoize `BoardBand`,
  lift `commentCountFor`/`voterNamesFor` to `useMemo`-built `Map`s) is cheap
  and worth doing opportunistically if this file is touched for visual
  changes, but not worth a dedicated pass.
- [preserve exactly] `ItemCard` (`src/components/closet/item-card.tsx:184`)
  and `FriendItemCard`, `new-addition-row.tsx`'s row component are all
  wrapped in `memo` — the three list-cell components that actually need it
  (rendered dozens of times per screen) have it. `BoardBand` above is the one
  gap in an otherwise-consistent pattern.

## Launch path

- [preserve exactly] `src/app/_layout.tsx` — splash screen is held via
  `SplashScreen.preventAutoHideAsync()` until fonts resolve
  (`fontsLoaded || fontError`, lines 190-209), preventing the documented
  "system fallback then reflow" jolt. `PersistQueryClientProvider` wraps
  everything so `closet`/`wardrobe`/`style-profile` rehydrate from SQLite
  before first paint — meaning a cold start with good persisted data paints
  real content immediately rather than a spinner-then-fetch. `AuthGate`
  blocks only on `session.loading`, which resolves from AsyncStorage (fast,
  local) rather than a network round trip.
- [preserve exactly] `src/app/(tabs)/index.tsx` (Today) — the two-stage
  outfit generation (see Query config above) means the tab that opens by
  default never blocks first paint on a network call; the beam search runs
  synchronously against the persisted/warm wardrobe cache.
- [preserve exactly] `src/features/context/use-style-context.ts:132-180` —
  location/weather/calendar context queries are all `enabled`-gated on
  session and each other, carry 10–30 minute `staleTime`s, and are strictly
  supplementary to the outfits that already rendered from the local engine —
  confirmed these never gate Today's first paint.
- [minor polish] No dev-only code was found running unconditionally before
  first paint — `dev-*` routes are registered (Expo Router auto-registers
  every file under `src/app/`) but gated to `__DEV__` in `AuthGate`
  (`_layout.tsx:140-145`) and bounced in production. Not a runtime cost, just
  noting it was checked.

---

## Top 10, ranked by user-visible impact on a demo-sized account

1. **[high] No optimistic updates anywhere (`onMutate` grep: zero hits).**
   Every follow, vote, delete, retag, and borrowable-toggle waits a full
   round trip before anything on screen changes. This is the single largest
   perceived-speed gap in the app — bigger than any list/pagination issue at
   demo scale, because it's felt on nearly every interactive tap. Start with
   `useFollow`/`useUnfollow` (`src/features/social-graph/mutations.ts:33-80`,
   not off-limits) as the reference implementation; `useCastVote`/
   `useRetractVote` would benefit the most (four invalidated queries per tap)
   but that file is charter-fenced this session.
2. **[med] `useEventPosts`/`useCastVote` invalidation fans out to four
   parallel queries per vote** (`src/features/event-outfits/queries.ts:52-118`,
   mutation file off-limits) — even with optimistic updates eventually added
   elsewhere, this is the highest-latency single interaction in the app today:
   tap → write → refetch(posts, items, counts, votes) → re-render.
3. **[med] `useEventComments` has no `.limit()` and its render is an
   unvirtualized `ScrollView`/`.map()`** (`src/features/event-outfits/queries.ts:159-180`,
   `src/app/event/[id]/comments.tsx:180-225`) — the one unbounded query paired
   with an unvirtualized list AND a chatty realtime invalidation source. Not
   visible at 10-50 items; becomes visible first among all the "unbounded"
   findings as an event's table talk grows.
4. **[low] Closet-wide signing includes `platePath` for every item, not just
   the rail slice** (`src/app/(tabs)/closet.tsx:134-136`) — larger-than-
   necessary signing payload on every closet load/refresh; still one batched
   request, so the cost is signing-endpoint work and payload size, not
   round-trip count.
5. **[low] `BoardBand` not memoized; `commentCountFor`/`voterNamesFor` are
   unmemoized O(n) closures re-created and re-run per render**
   (`src/app/event/[id]/outfits.tsx:139-148,405`) — every vote re-renders and
   re-filters every board on the event-outfits screen. Invisible at demo
   scale; cheap to fix if the file is touched anyway.
6. **[low] `harmonyCount` in item detail runs unmemoized on every render,
   including every price-field keystroke** (`src/app/item/[id].tsx:36-48,99`)
   — one-line `useMemo` fix, currently imperceptible at closet sizes this app
   enforces (30-item cap).
7. **[low] `useCloset` and `useBorrowRequests`/`useBlockedUsers` have no
   `.limit()`/`.range()`** (`src/features/closet/queries.ts:111-143`,
   `src/features/social-graph/queries.ts:263-390`) — currently safe (closet
   capped server-side at 30; the others grow slowly), but worth a pagination
   pass before any tier raises the closet cap, and the styling/queries.ts
   docblock's claim that the closet grid "wants... pagination" should either
   get real pagination or have the comment corrected.
8. **[low] Item detail's loading state is a bare spinner, not a
   layout-matched skeleton** (`src/app/item/[id].tsx:124-130`) — rarely hit in
   practice since navigation there is almost always a warm-cache hit from an
   already-loaded closet grid.
9. **[low] A handful of avatar/row `<Image>`s omit `cachePolicy`/
   `recyclingKey`** (`ProfileRow.tsx`, `BorrowRequestRow.tsx`, `day-row.tsx`,
   `upload-queue-list.tsx`) — cosmetic consistency gap against an otherwise
   uniform pattern; no measurable impact given these aren't FlashList-recycled
   cells.
10. **[preserve] Everything else audited — FlashList usage, signed-URL
    batching/caching, global query defaults, persisted-cache allowlist,
    thumb/cutout/plate discipline, skeleton dimension-matching, and the
    launch path's font/session/cache sequencing — is already at the standard
    the rest of this list is trying to bring the stragglers up to. The
    system's defaults are good; the findings above are the exceptions, not
    the rule.**
