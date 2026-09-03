import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  CollectionFilterBar,
  SavedCard,
  SavedEmptyState,
  SavedErrorState,
  SavedGridSkeleton,
  SavedOfflineBanner,
  UnavailableCountBanner,
} from '@/components/saved-looks';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { useConnectivity } from '@/features/auth/use-connectivity';
import { AX_STACK_SCALE } from '@/features/closet/dynamic-type';
import {
  SAVED_EVENTS,
  filterAppliedProps,
  listViewedProps,
  retryTappedProps,
  stateShownProps,
} from '@/features/saved-looks/analytics';
import { COLLECTIONS, SAVED_TITLE } from '@/features/saved-looks/copy';
import { savedAgo } from '@/features/saved-looks/dates';
import { useSavedCollections, useSavedLooks, withSavedCounts } from '@/features/saved-looks/queries';
import {
  collectionCounts,
  filterSaves,
  resolveSavedListState,
  showsFilterBar,
  type SavedFilter,
} from '@/features/saved-looks/states';
import { haptics } from '@/lib/haptics';
import { track } from '@/lib/posthog';
import { useBoundedLoad } from '@/lib/use-bounded-load';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * OS-01 / OS-03 / OS-06b / OS-09 / OS-10b — the shelf, and the four things it
 * can be instead of a shelf.
 *
 * ── THE FIVE STATES ARE NOT DECIDED HERE ───────────────────────────────────
 *
 * `resolveSavedListState` decides them, and its ordering is the whole reason it
 * exists: loading outranks everything, offline-WITH-content outranks failure
 * (those rows are real and usable), failure outranks emptiness, and a screen
 * that has not heard back must never draw "Nothing saved yet" — which would
 * teach somebody with fourteen kept looks how to make their first. This file
 * passes the queries in and draws what comes back.
 *
 * ── THE FILTER NEVER REFETCHES ─────────────────────────────────────────────
 *
 * §10 in as many words. `filter` is component state, `filterSaves` narrows the
 * loaded array, and no query key mentions it. Beyond the wasted round trip, a
 * refetch per chip would re-resolve `availability` for every row and make a
 * revoked look flicker between states while somebody browses their own shelves.
 *
 * ── AND THE GRID BECOMES A LIST AT ONE THRESHOLD ───────────────────────────
 *
 * `AX_STACK_SCALE`, the same 1.5 the closet grid, the item stat band and the
 * review sheet already change at. OS-10b draws this screen's version. One
 * threshold across the app means one moment where it visibly becomes its
 * large-type self, rather than three screens relayouting at three different
 * settings.
 *
 * ── WHY THIS IS `/saved-looks` AND NOT `/saved` ────────────────────────────
 *
 * `/saved` is taken, by the kept-plate lookbook that ships today against atlas
 * 35 (KP-01/02/05) — a different accepted design with its own screen, its own
 * sheet and its own tests. The OS handoff assumes a four-tab bar of Daily /
 * Circles / Activity / Saved, and the shipped bar is Today / Closet / Plan /
 * Explore, so the collision is not incidental: two accepted atlases both want
 * the word. Merging them is a product decision about what "Saved" means, not an
 * implementation detail, so this packet takes an unambiguous path and leaves the
 * decision where it belongs. Every route below is otherwise the handoff's §1,
 * segment for segment.
 */
export default function SavedLooksScreen() {
  const router = useRouter();
  const theme = useTheme();
  const reduced = useReducedMotion();
  const { fontScale } = useWindowDimensions();
  const online = useConnectivity();

  const saves = useSavedLooks();
  const collections = useSavedCollections();

  /**
   * The chosen shelf. Component state, deliberately — see the header. It
   * survives a refetch and a re-render, and it is intentionally NOT reset when
   * the list changes: somebody filtered to "Fall layering" who then saves
   * something new should still be looking at Fall layering.
   */
  const [filter, setFilter] = useState<SavedFilter>(null);

  const rows = useMemo(() => saves.data ?? [], [saves.data]);

  /**
   * UX #30 — the saved grid's skeleton is bounded now.
   *
   * The finding names this screen by name: "Saved Looks and Wear Diary can
   * remain in skeleton states long enough to look like an unfinished page."
   * `resolveSavedListState` had no clock — `loading: saves.isLoading` was true
   * for as long as the query was, which for a request that never returns is
   * the whole session. The bound is fed in as `loading`, so the existing state
   * machine keeps deciding everything else and simply stops being told to wait
   * forever; a timeout arrives as `failed`, wearing the timeout's own words.
   */
  const load = useBoundedLoad({
    loading: saves.isLoading,
    error: saves.isError,
    retrying: saves.isRefetching,
    onRetry: () => {
      track(SAVED_EVENTS.retryTapped, retryTappedProps());
      void saves.refetch();
      void collections.refetch();
    },
  });

  const state = useMemo(
    () =>
      resolveSavedListState({
        loading: load.state === 'skeleton',
        failed: load.failed,
        // Offline only counts as offline once the read has actually failed or
        // is empty; a successful read over a connection the device believes is
        // down is still a successful read, and banners it does not need are
        // banners nobody believes next time.
        offline: !online && (saves.isError || rows.length > 0),
        saves: rows,
      }),
    [load.state, load.failed, saves.isError, online, rows],
  );

  const counts = useMemo(() => collectionCounts(rows), [rows]);
  const shelves = useMemo(
    () => withSavedCounts(collections.data ?? [], counts),
    [collections.data, counts],
  );

  /**
   * The filter, applied — and cleared when the shelf it names goes away.
   *
   * A collection deleted on this device or another leaves `filter` pointing at
   * nothing, which would draw an empty grid under a chip row that no longer has
   * that chip in it. Resolving to All is the honest answer: the shelf is gone,
   * so the reader is looking at everything.
   */
  const visible = useMemo(() => {
    if (filter && !shelves.some((shelf) => shelf.id === filter)) return rows;
    return filterSaves(rows, filter);
  }, [rows, shelves, filter]);

  const stacked = fontScale >= AX_STACK_SCALE;

  /**
   * The denominator, fired when cards are genuinely on screen.
   *
   * `outfit_set_viewed`'s rule: count what was RENDERED, never what was
   * fetched. Four of this screen's states are reads that produced no grid, and
   * counting them would inflate the denominator with exactly the sessions where
   * the product showed nothing.
   *
   * Keyed on the state kind and the count rather than on the array, so a
   * background refetch that returns the same rows does not re-fire.
   */
  const drawsGrid = state.kind === 'populated' || state.kind === 'offline';
  useEffect(() => {
    if (!drawsGrid) return;
    track(
      SAVED_EVENTS.listViewed,
      listViewedProps({ saveCount: rows.length, hasCollections: shelves.length > 0 }),
    );
  }, [drawsGrid, rows.length, shelves.length]);

  /** The three states that stand in for a list, each counted once per arrival. */
  useEffect(() => {
    if (state.kind === 'loading') track(SAVED_EVENTS.stateShown, stateShownProps('loading'));
    if (state.kind === 'offline') track(SAVED_EVENTS.stateShown, stateShownProps('offline'));
    if (state.kind === 'error') track(SAVED_EVENTS.stateShown, stateShownProps('error'));
  }, [state.kind]);

  const refresh = useCallback(() => {
    void saves.refetch();
    void collections.refetch();
  }, [saves, collections]);

  const choose = useCallback((next: SavedFilter) => {
    // A chip toggled is exactly what `selection()` is reserved for — a value
    // changing under the finger — and this was the one selection control in the
    // area that acknowledged nothing at all.
    haptics.selection();
    setFilter(next);
    track(SAVED_EVENTS.filterApplied, filterAppliedProps(next === null));
  }, []);

  const open = useCallback(
    (saveId: string) => {
      router.push({ pathname: '/saved-looks/[saveId]', params: { saveId } });
    },
    [router],
  );

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader title={SAVED_TITLE} backLabel="Back" />

      <View className="flex-row items-end justify-between px-gutter pt-3">
        <Text variant="display" trim accessibilityRole="header">
          {SAVED_TITLE}
        </Text>
        {/*
          The way into the collections screen, drawn only once there is
          something to organise. A "Collections" link over an empty shelf is a
          door into a room with nothing in it — and OS-01 deliberately offers no
          action at all, because the only useful next act is on another screen.
        */}
        {drawsGrid ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={COLLECTIONS.title}
            onPress={() => router.push('/saved-looks/collections')}
            hitSlop={8}
            style={{ minHeight: MIN_TAP_TARGET }}
            className="justify-center active:opacity-60">
            <Text variant="label" style={{ color: theme.accent }}>
              {COLLECTIONS.title}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {state.kind === 'offline' ? <SavedOfflineBanner /> : null}
      {drawsGrid && state.unavailableCount > 0 ? (
        <UnavailableCountBanner count={state.unavailableCount} />
      ) : null}

      {showsFilterBar(state, shelves) ? (
        <CollectionFilterBar
          collections={shelves}
          total={rows.length}
          value={filter}
          onChange={choose}
        />
      ) : null}

      <ScrollView
        contentContainerClassName="pb-24"
        contentContainerStyle={state.kind === 'empty' ? { flexGrow: 1 } : undefined}
        refreshControl={
          <RefreshControl
            refreshing={saves.isRefetching}
            onRefresh={refresh}
            tintColor={theme.muted}
          />
        }>
        {state.kind === 'loading' ? (
          <SavedGridSkeleton stacked={stacked} />
        ) : state.kind === 'error' ? (
          <SavedErrorState onRetry={load.retry} retrying={load.retrying} timedOut={load.timedOut} />
        ) : state.kind === 'empty' ? (
          <SavedEmptyState />
        ) : (
          // Keyed on the filter so a chip tap remounts the grid and the page
          // turns over rather than repainting in place. The container geometry
          // is unchanged, so nothing shifts — only the cards fade. Skipped
          // whole, not shortened, when Reduce Motion is on.
          <Animated.View
            key={filter ?? 'all'}
            entering={reduced ? undefined : FadeIn.duration(160)}
            className={stacked ? 'gap-4 px-gutter' : 'flex-row flex-wrap gap-4 px-gutter'}
            accessibilityRole="list">
            {visible.map((save) => (
              <View key={save.id} className={stacked ? '' : 'basis-[47%] grow'}>
                <SavedCard
                  save={save}
                  savedAgo={savedAgo(save.savedAt)}
                  onPress={() => open(save.id)}
                  offline={state.kind === 'offline'}
                  stacked={stacked}
                />
              </View>
            ))}
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
