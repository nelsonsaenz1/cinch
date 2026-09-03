import { SymbolView } from 'expo-symbols';
import { View } from 'react-native';

import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import {
  EMPTY,
  ERROR,
  OFFLINE,
  unavailableCountBanner,
} from '@/features/saved-looks/copy';
import { useTheme } from '@/theme/tokens';

/**
 * THE STATES WITH NO CARDS IN THEM — OS-01, OS-09, and OS-06's count banner.
 *
 * Every one is presentational: props in, no query, no navigation, no mutation,
 * and no state of its own. That last part is load-bearing rather than tidy — a
 * component here that owned a `useState` would give the grid a reason to remount
 * it, and a remounted grid starts at the top.
 *
 * ── NOTHING HERE IS A FIXED HEIGHT ─────────────────────────────────────────
 *
 * No heights, no `numberOfLines`, no capped containers. The compositions grow
 * and the page scrolls, which is the only answer §9 permits for AX-XXXL.
 *
 * ── AND EACH ONE IS ALLOWED TO CLAIM EXACTLY ONE THING ─────────────────────
 *
 * `SavedEmptyState` claims there is nothing saved. `SavedErrorState` claims only
 * that the read failed. `OfflineBanner` claims neither — it sits ABOVE real
 * content and says that content may be stale. Getting those three confused is
 * how "Nothing saved yet" came to be shown to people whose saves were merely
 * unreadable, on eleven screens, before `ErrorState` existed.
 */

// ---------------------------------------------------------------------------
// OS-01 · Nothing saved yet
// ---------------------------------------------------------------------------

/**
 * The kit's `EmptyState`, unchanged, plus the hint the frame prints under it.
 *
 * NO ACTION BUTTON, and its absence is the design. The save affordance lives on
 * the look surfaces — Daily, a group, an event — which is precisely where this
 * screen cannot send anybody, because there may be nothing there to save today.
 * So the empty state DESCRIBES the control rather than pretending to be a door
 * to it, and the hint is a picture of the bookmark with its own words beside it.
 *
 * The glyph is the bookmark for the same reason: an empty state whose symbol is
 * not the control it describes is a riddle.
 */
export function SavedEmptyState() {
  const theme = useTheme();

  return (
    <View className="flex-1">
      <EmptyState symbol={EMPTY.symbol} title={EMPTY.title} body={EMPTY.body} />
      <View className="px-gutter pb-8">
        {/*
          AUDIT 100 #29. This used to sit in a `bg-tray` chip, `rounded-md`,
          padded like a control, with the label in `text-accent` — which is
          exactly what a disabled button looks like in this design language,
          and the hint is not a button: it does nothing on tap, and there is
          no affordance here to press. It is instructional copy pointing at a
          control that lives on a different screen, so it is drawn as plain
          caption text with the glyph it is captioning — no fill, no accent
          ink, nothing that invites a tap that would not do anything.
        */}
        <View
          className="flex-row items-center gap-2 self-start"
          // One stop, one sentence: the glyph is the thing being described, so
          // it is part of the label rather than a second element to swipe to.
          accessible
          accessibilityRole="text"
          accessibilityLabel={`${EMPTY.hint}. A bookmark.`}>
          <SymbolView name="bookmark.fill" size={14} tintColor={theme.muted} />
          <Text variant="note" className="text-muted">
            {EMPTY.hint}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// OS-09c · Couldn't load your looks
// ---------------------------------------------------------------------------

/**
 * `ErrorState`, unchanged, so this screen inherits the one thing that matters:
 * an error state refuses to describe the data.
 *
 * "Your saves are safe" is a claim about the WRITE side, and it is one this
 * feature is entitled to make — nothing about a failed list read touches a row.
 * It is the sentence an empty state would have got wrong.
 *
 * `onRetry` is required rather than optional. Without it the screen is a dead
 * end, and the state the reader is in is the one where trying again is the whole
 * remedy. `ErrorState` also carries `accessibilityRole="alert"`, so a failure
 * that appears after a wait is announced rather than merely findable by swiping.
 */
export function SavedErrorState({
  onRetry,
  retrying = false,
}: {
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <ErrorState
      title={ERROR.title}
      body={ERROR.body}
      retryTitle={ERROR.retry}
      onRetry={onRetry}
      retrying={retrying}
    />
  );
}

// ---------------------------------------------------------------------------
// OS-09b · Offline, over real content
// ---------------------------------------------------------------------------

/**
 * A BANNER, NOT A SCREEN, and the difference is the whole point of OS-09b.
 *
 * The looks underneath are the reader's own rows out of the persisted cache.
 * They are true; they may not be current. Replacing them with an error screen
 * would throw away content somebody can use in order to report a condition they
 * can already see in their status bar.
 *
 * `accessibilityRole="summary"` rather than `alert`: this is a standing fact
 * about the page, not an event that arrived, and an alert here would interrupt
 * VoiceOver every time the banner re-rendered.
 */
export function SavedOfflineBanner() {
  const theme = useTheme();

  return (
    <View
      className="mx-gutter mb-3 flex-row items-center gap-3 rounded-md bg-tray px-4 py-3"
      accessible
      accessibilityRole="summary"
      accessibilityLabel={OFFLINE.banner}>
      <SymbolView name="wifi.slash" size={16} tintColor={theme.muted} />
      <Text variant="caption" className="flex-1 text-muted">
        {OFFLINE.banner}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// OS-06b · How many are no longer available
// ---------------------------------------------------------------------------

/**
 * The count over the grid.
 *
 * Drawn only when the number is non-zero — the caller decides, because it
 * already has the count from `resolveSavedListState` and a component that
 * returned null for zero would be a component whose absence is invisible in a
 * layout review.
 *
 * It is a STATEMENT AND NOT AN ACTION. There is nothing useful to offer here:
 * the reader cannot restore somebody else's sharing, and a "Remove them all"
 * button would turn another person's ordinary decision into a prompt to delete
 * the reader's own notes. Each card carries its own way forward.
 */
export function UnavailableCountBanner({ count }: { count: number }) {
  const theme = useTheme();
  const message = unavailableCountBanner(count);

  return (
    <View
      className="mx-gutter mb-3 flex-row items-center gap-3 rounded-md bg-tray px-4 py-3"
      accessible
      accessibilityRole="summary"
      accessibilityLabel={message}>
      <SymbolView name="info.circle" size={16} tintColor={theme.muted} />
      <Text variant="caption" className="flex-1 text-muted">
        {message}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// OS-09a · The wait
// ---------------------------------------------------------------------------

/**
 * The skeleton: three chips and four cards, in the grid's own geometry.
 *
 * A PICTURE OF THE PAGE, not a spinner. It reserves the shapes that are about to
 * arrive, so the content does not jump when it does — and it deliberately shows
 * the FILTER ROW as chips, because a page that gained a whole row after loading
 * would reflow everything under it.
 *
 * Reduce Motion is handled inside `Skeleton` — it reads `useReducedMotion` and
 * drops the sweep for a static 70%, which is §8's rule ("skeleton shimmer is
 * disabled under Reduce Motion") kept in one place rather than re-decided here.
 *
 * `accessibilityElementsHidden` and `importantForAccessibility="no-hide-
 * descendants"`: a wait is not something to read out. VoiceOver users get the
 * screen's busy state from the content that arrives, not from a description of
 * grey rectangles.
 */
export function SavedGridSkeleton({ stacked = false }: { stacked?: boolean }) {
  const chips = [70, 100, 90];
  const cards = stacked ? [0, 1, 2] : [0, 1, 2, 3];

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className="px-gutter">
      <View className="mb-4 flex-row gap-2">
        {chips.map((width, index) => (
          <Skeleton key={width} delay={index * 120} className="h-[34px] rounded-md" style={{ width }} />
        ))}
      </View>

      <View className={stacked ? 'gap-4' : 'flex-row flex-wrap gap-4'}>
        {cards.map((index) => (
          <View key={index} className={stacked ? 'flex-row items-center gap-4' : 'flex-1 basis-[45%] gap-2'}>
            <Skeleton
              delay={index * 120}
              className={stacked ? 'w-[70px] h-[88px] rounded-plate' : 'w-full aspect-[3/4] rounded-plate'}
            />
            <Skeleton delay={index * 120} className="h-[13px] w-3/4 rounded-sm" />
          </View>
        ))}
      </View>
    </View>
  );
}
