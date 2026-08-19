import type { FlashListRef } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CapacityBand } from '@/components/closet/capacity-band';
import { ClosetGrid } from '@/components/closet/closet-grid';
import { ClosetInspirationSheet } from '@/components/closet/closet-inspiration-sheet';
import { ClosetMenu } from '@/components/closet/closet-menu';
import { ClosetSkeleton } from '@/components/closet/closet-skeleton';
import { EmptyCloset } from '@/components/closet/empty-closet';
import { ExampleCloset } from '@/components/closet/example-closet';
import { FavoriteOutfitsRail } from '@/components/closet/favorite-outfits-rail';
import { useFavoriteOutfits } from '@/features/styling/use-favorite-outfits';
import { InsightCard } from '@/components/closet/insight-card';
import { Placement } from '@/features/billing/placements';
import { PLANS } from '@/features/billing/plans';
import { useCapacity } from '@/features/billing/use-capacity';
import { usePlan } from '@/features/billing/use-plan';
import { useGate } from '@/features/billing/use-gate';
import { RailCard } from '@/components/closet/rail-card';
import { SelectionBar } from '@/components/closet/selection-bar';
import { StatRow } from '@/components/closet/stat-row';
import { ZeroIdentityHeader } from '@/components/closet/zero-identity-header';
import { Avatar, Chip, EmptyState, ErrorState, SearchField, Text } from '@/components/ui';
import {
  CLOSET_EVENTS,
  closetBulkProps,
  closetCapacityProps,
  closetFilterProps,
  closetPlansDoorProps,
  closetSelectionProps,
  closetViewedProps,
} from '@/features/closet/closet-analytics';
import {
  CLOSET_COPY,
  FAB_BOTTOM,
  FAB_RIGHT,
  FAB_SIZE,
  addPieceDisabled,
  capacityState,
  filterKind,
  mastheadCounts,
  railsPresent,
  selectAllLabel,
  selectionSize,
} from '@/features/closet/closet-spec';
import { searchSummary } from '@/features/closet/search-summary';
import { useClosetInspiration } from '@/features/closet/use-closet-inspiration';
import {
  useClosetScreen,
  type CategoryFilter,
  type ClosetScreenModel,
} from '@/features/closet/use-closet-screen';
import { EditProfileSheet } from '@/features/profile/edit-profile-sheet';
import type { Item } from '@/schemas/item';
import { track } from '@/lib/posthog';
import { GUTTER, MIN_TAP_TARGET, motion, useTheme } from '@/theme/tokens';

/**
 * The closet, per the founder's Closet State Atlas (C-01…C-06; see
 * docs/design/closet-redesign-spec.md). Every derivation lives in
 * `useClosetScreen` — this file is the render tree and nothing else.
 *
 * The search `TextInput` sits OUTSIDE the FlashList: a controlled input in a
 * virtualised `ListHeaderComponent` remounts, and loses focus, on every
 * keystroke. The rest of the masthead has no input and rides in the header so
 * it scrolls away with the grid.
 */

/**
 * CI-01's separation between the zero state's three blocks — identity, then the
 * example closet, then the starter card.
 *
 * One constant for both gaps because they are one decision: the blocks are
 * peers, and a page that separated identity-from-example differently from
 * example-from-starter would be claiming a grouping CI-01 does not draw.
 */
const ZERO_BLOCK_GAP = 26;

/** The rail gap and the chip gap — two measures that need not agree. */
const RAIL_GAP = 14;
/** C-01/C-02/C-03 all draw the category rail at an 8pt gap. */
const CHIP_GAP = 8;

/**
 * C-03 — the filter rail's own row, and audit 61's proof.
 *
 * "Chips are 38 pt tall inside a 44 pt row with 8 pt gaps, so hit regions do
 * not overlap." The row is 44 here, exactly; the CHIP is the shipped `compact`
 * at 32, because its height lives in `ui/chip-spec.ts` and this lane may not
 * change a shared primitive. Recorded as a serialization request.
 *
 * The vertical padding is what makes the row 44 around a 32pt chip.
 */
const CHIP_ROW_HEIGHT = 44;
const CHIP_ROW_PAD_Y = 6;

/**
 * Every stored category the recategorise sheet can file a piece under, with
 * the label a person would say. Values are the schema's `itemCategory` enum —
 * a label without a value here is a choice the mutation cannot apply.
 */
const CATEGORY_CHOICES: { label: string; value: Item['category'] }[] = [
  { label: 'Top', value: 'top' },
  { label: 'Bottom', value: 'bottom' },
  { label: 'Outerwear', value: 'outerwear' },
  { label: 'Dress', value: 'dress' },
  { label: 'Footwear', value: 'footwear' },
  { label: 'Bag', value: 'bag' },
  { label: 'Headwear', value: 'headwear' },
  { label: 'Jewelry', value: 'jewelry' },
  { label: 'Accessory', value: 'accessory' },
  { label: 'Other', value: 'other' },
];

export default function ClosetScreen() {
  const router = useRouter();
  const theme = useTheme();
  const screen = useClosetScreen({
    onBulk: (action, result) => track(CLOSET_EVENTS.bulk, closetBulkProps(action, result)),
  });

  // WHICH KINDS of filter are active — never the category as text, and never
  // the query. Somebody typing a brand or "interview" into their own closet is
  // telling this app about their life, and none of it belongs on a server.
  const kind = filterKind(screen.category, screen.query);
  const reportedFilter = useRef<string | null>(null);
  useEffect(() => {
    if (kind === null) {
      reportedFilter.current = null;
      return;
    }
    if (reportedFilter.current === kind) return;
    reportedFilter.current = kind;
    track(CLOSET_EVENTS.filter, closetFilterProps(kind));
  }, [kind]);

  // One, many or all — never the number.
  const pickedCount = screen.picked?.size ?? 0;
  const size = selectionSize(pickedCount, screen.items.length);
  const reportedSize = useRef<string | null>(null);
  useEffect(() => {
    if (size === null) {
      reportedSize.current = null;
      return;
    }
    if (reportedSize.current === size) return;
    reportedSize.current = size;
    track(CLOSET_EVENTS.selection, closetSelectionProps(size));
  }, [size]);
  const inspiration = useClosetInspiration();
  const [menuOpen, setMenuOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlashListRef<Item>>(null);

  const selecting = screen.picked !== null;

  // "See all" on the Latest rail: the grid IS the all, so the affordance
  // clears the one filter that could hide pieces from it and brings the first
  // row of cards to the top (spec §5's sanctioned reading of "scrolls to").
  const seeAllPieces = () => {
    screen.setCategory('All');
    // Next frame, so the scroll measures the grid the cleared filter produces.
    requestAnimationFrame(() => {
      if (screen.items.length > 0)
        listRef.current?.scrollToIndex({ index: 0, animated: true, viewPosition: 0 });
    });
  };

  /**
   * C-04's Recategorise: the native sheet, not a custom picker — ten rows of
   * plain text is exactly what an action sheet is for. Android's Alert caps
   * at three buttons, so it gets the same rows knowing the platform truncates;
   * the app ships iOS-first and the old menu accepted the same trade.
   */
  const chooseCategory = () => {
    if (Platform.OS !== 'ios') {
      Alert.alert('Move to', undefined, [
        ...CATEGORY_CHOICES.map((c) => ({
          text: c.label,
          onPress: () => void screen.recategorise(c.value),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ]);
      return;
    }
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'Move to',
        options: [...CATEGORY_CHOICES.map((c) => c.label), 'Cancel'],
        cancelButtonIndex: CATEGORY_CHOICES.length,
      },
      (index) => {
        const choice = CATEGORY_CHOICES[index];
        if (choice) void screen.recategorise(choice.value);
      },
    );
  };

  const refreshControl = (
    <RefreshControl
      refreshing={screen.refreshing}
      onRefresh={screen.refresh}
      tintColor={theme.muted}
    />
  );

  /**
   * How many pieces the free ten is still waiting on — or null once it is not
   * waiting on any, which is the signal to draw no example at all.
   *
   * `PLANS.free.items`, deliberately NOT `MIN_CLOSET_FOR_OUTFITS`. Styling
   * begins at eight and the motivation stays until ten; both are true at nine,
   * and reconciling them would delete one of two different facts. See the
   * docblock on `example-closet.tsx`.
   *
   * Counted over `screen.items` — everything owned — rather than
   * `screen.visible`, so a category chip cannot make the example appear by
   * filtering a full closet down to three.
   */
  const exampleRemaining =
    screen.items.length > 0 && screen.items.length < PLANS.free.items
      ? PLANS.free.items - screen.items.length
      : null;

  // ── The six atlas states, one branch each ─────────────────────────────────

  let body: React.ReactNode;

  if (screen.loading) {
    // C-06. Eyebrow stays put so nothing shifts when the data lands; the
    // fade-out is the crossfade — Reanimated keeps the exiting skeleton
    // mounted while the wardrobe arrives over it.
    body = (
      // `style`, NOT `className`: NativeWind's interop skips Reanimated
      // components, so `flex-1` as a class would be silently dropped and the
      // skeleton would collapse to nothing.
      <Animated.View style={{ flex: 1 }} exiting={FadeOut.duration(motion.duration.fast)}>
        <EyebrowHeader />
        <ClosetSkeleton />
      </Animated.View>
    );
  } else if (screen.error && screen.items.length === 0) {
    // A failed fetch is not an empty wardrobe: rendering the ghost slots here
    // would tell someone with 200 garments "add your closet" over a network
    // error that has nothing to do with what she owns. Gated on `items` being
    // empty because React Query keeps cached data through a failed refetch —
    // a closet that IS on hand renders normally and retry rides pull-to-refresh.
    body = (
      <>
        <EyebrowHeader />
        <ErrorState
          title="Couldn't read your closet"
          body="Check your connection and try again."
          retrying={screen.refreshing}
          onRetry={screen.refresh}
        />
      </>
    );
  } else if (screen.items.length === 0) {
    // CI-01 — identity, then the example, then the invitation.
    //
    // C-05 built this state around the absence: eyebrow, count, and a card
    // explaining what a closet is for. CX-03 put the photographic example back
    // above that card. Both were pages about a wardrobe that does not exist,
    // and about nobody — while every OTHER state of this tab opens with the
    // reader's own face and name. Zero was the one state where Closet stopped
    // being a profile, at exactly the moment a new account first opens it.
    //
    // So the person comes first now. The three blocks are ordered
    // identity → example → starter and separated by ZERO_BLOCK_GAP, which is
    // the whole product change: the example is the same bundled fixture with
    // the same badge, and the starter card keeps CX-03's exact words.
    //
    // Search and the menu still pass no handlers — they have nothing to act on
    // — and the FILTER ROW IS STILL ABSENT rather than present-and-disabled.
    body = (
      <ScrollView
        refreshControl={refreshControl}
        contentContainerStyle={{ paddingBottom: 96 }}>
        <EyebrowHeader />
        <View className="mt-1 px-gutter">
          {/* CX-03, kept and kept HERE. The strip below states "0 PIECES", but
              only this line carries the ceiling the free tier is counting
              toward, which is the fact CX-03 was written to restore. It rides
              with the eyebrow rather than under the identity so the profile
              block opens on the person. */}
          <Text variant="note">{`0 of ${PLANS.free.items} pieces`}</Text>
        </View>

        <View className="mt-5">
          <ZeroIdentityHeader
            name={screen.name}
            handleLine={screen.handleLine}
            bio={screen.bioLine}
            avatarUrl={screen.avatarUrl}
            // Coalesced HERE rather than in the strip: `outfits` and
            // `followers` are `undefined` until their queries land, and C-01
            // renders that as an em dash because there a dash means "not known
            // yet". At zero pieces the zero is the point — four dashes on a
            // first launch read as a page that failed — and an account that
            // genuinely has friends still prints the number it has.
            stats={{
              pieces: screen.stats.pieces,
              outfits: screen.stats.outfits ?? 0,
              unworn: screen.stats.unworn,
              followers: screen.stats.followers ?? 0,
            }}
            onEditProfile={() => screen.setEditing(true)}
          />
        </View>

        {/* Measured from the stat strip's own lower rule — the profile
            divider — so the example reads as the next thing rather than as
            part of the identity above it. */}
        <View style={{ marginTop: ZERO_BLOCK_GAP }}>
          <ExampleCloset variant="full" />
        </View>

        {/* `stacked`: the starter card sits a stated distance below the
            example. Centred, its `flex-1` would eat the leftover height and
            put an unpredictable gap here. */}
        <View style={{ marginTop: ZERO_BLOCK_GAP }}>
          <EmptyCloset flow="stacked" onAddClothes={() => router.push('/add-clothes')} />
        </View>
      </ScrollView>
    );
  } else if (selecting) {
    // C-04. Masthead, rails, insight and chips collapse — the grid is the
    // whole page under the count header. The grid shows the UNFILTERED closet
    // so `Select all` and what's on screen can never disagree.
    body = (
      <View className="flex-1">
        <SelectionHeader screen={screen} />
        <ClosetGrid
          items={screen.items}
          onItemPress={screen.togglePicked}
          onItemLongPress={screen.beginSelection}
          selectedIds={screen.picked}
          resolveImage={screen.resolve}
          refreshControl={refreshControl}
          // The floating bar covers ~155pt of the grid's tail; without this
          // spacer the last row's tick zone can never scroll clear of it.
          ListFooterComponent={<View style={{ height: insets.bottom + 160 }} />}
        />
        {/* Pinned over the grid's bottom edge — a Delete control that scrolls
            away with the list is a Delete control nobody can reach. The atlas
            seats this bar where the tab bar was, but the native Liquid Glass
            bar cannot be dismissed from JS and draws over anything at
            bottom: 0 — so the bar floats just clear of it instead, and the
            atlas's 26pt home-indicator padding shrinks to its 12pt top. */}
        <View className="absolute inset-x-0" style={{ bottom: insets.bottom + 52 }}>
          <SelectionBar
            count={screen.picked?.size ?? 0}
            busy={screen.removePending || screen.recategorisePending}
            bottomPadding={12}
            onRecategorise={chooseCategory}
            onDelete={screen.confirmRemovePicked}
          />
        </View>
      </View>
    );
  } else if (screen.searching) {
    // C-02. The tray field replaces the whole header block and the masthead
    // collapses — "opening search replaces the title block rather than pushing
    // it down, so the grid does not jump". Chips stay usable: the held chip and
    // the typed query COMPOSE (both in the hook and in the sentence below).
    const summary = searchSummary({
      count: screen.visible.length,
      category: screen.category,
      query: screen.query,
    });
    body = (
      <Animated.View style={{ flex: 1 }} entering={FadeIn.duration(motion.duration.fast)}>
        {/* The field occupies the masthead's own 44pt row, and it now stands
            that tall on its own metrics — `DOOR_HEIGHT` is 11 + 22 + 11. The
            `min-h-[44px]` that used to ride here was the reason the
            placeholder read as vertically cut off: it grew the container to
            44 while leaving the input's text rect at 19pt, a point under the
            floor Helvetica Neue needs at 16. Height and line box belong to the
            field, not to whoever mounts it. See `search-field-spec.ts`. */}
        <View className="flex-row items-center gap-2.5 px-gutter pt-2">
          <View className="flex-1">
            <SearchField
              value={screen.query}
              onChangeText={screen.setQuery}
              autoFocus
              placeholder="Search your wardrobe"
            />
          </View>
          <Pressable
            onPress={screen.toggleSearch}
            accessibilityRole="button"
            accessibilityLabel="Cancel search"
            hitSlop={{ top: 14, bottom: 14, left: 12, right: 12 }}
            style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
            className="active:opacity-60">
            {/* MUTED, NOT THE ACCENT. C-02 draws Cancel at 16px in the frame's
                secondary colour: this is the way back out of a mode, not the
                one action the frame is spending its oxblood on. Inline colour,
                never a second `text-*` class (button.tsx precedence lesson).
                Regular cut, because the constitution reserves Medium for labels
                and filled actions and this is neither. */}
            <Text variant="body" style={{ fontSize: 16, color: theme.muted }}>
              Cancel
            </Text>
          </Pressable>
        </View>

        <CategoryChipsRow screen={screen} />

        {/* The composition, in words — "the held chip and the typed query
            compose rather than override". Below the chips, as the frame draws
            it: the sentence describes the row above as much as the grid below,
            and it is silent when there is nothing to compose or nothing found
            (the grid's own empty state carries that). */}
        {summary ? (
          <View className="px-gutter pb-1 pt-1">
            <Text variant="note" accessibilityLiveRegion="polite">
              {summary}
            </Text>
          </View>
        ) : null}

        <ClosetGrid
          listRef={listRef}
          items={screen.visible}
          onItemPress={screen.openItem}
          onItemLongPress={screen.beginSelection}
          selectedIds={null}
          resolveImage={screen.resolve}
          refreshControl={refreshControl}
          ListEmptyComponent={<EmptySearch query={screen.query} category={screen.category} />}
          ListFooterComponent={
            <Text variant="noteSmall" className="px-1.5 pt-4" style={{ fontSize: 12, lineHeight: 17 }}>
              Searching matches name, colour and fabric — nothing you don’t own.
            </Text>
          }
        />
      </Animated.View>
    );
  } else {
    // C-01. Masthead sections ride in the FlashList header — no TextInput
    // lives among them, so the focus hazard that exiles the search field
    // doesn't apply here.
    body = (
      <ClosetGrid
        listRef={listRef}
        items={screen.visible}
        onItemPress={screen.openItem}
        onItemLongPress={screen.beginSelection}
        selectedIds={null}
        resolveImage={screen.resolve}
        refreshControl={refreshControl}
        ListHeaderComponent={
          <>
            <Masthead screen={screen} onMenu={() => setMenuOpen(true)} />
            {/* THE RAILS MOVED ABOVE THE GRID — redesign 14, and the
                directive's own "Most worn / Favourites rails surfaced at top".
                They were a footer, on the previous wave's argument that
                derived readings should not delay the first garment. That was
                right when the grid was two large columns and the rails were
                three of them; at three dense columns the grid still starts
                within a screen, and a rail nobody scrolls to is a rail that
                may as well not exist.
                Each is absent when its derivation has no data — never an empty
                rail, which would promise something the screen cannot show. */}
            <ClosetRails screen={screen} />
          </>
        }
        // What is ABOUT the closet rather than IN it stays below it: the
        // insight card and the example preview. Only the two RAILS moved up —
        // they are pieces, and a rail of pieces belongs with the pieces.
        //
        // CX-04's example preview keeps its rule: a footer rather than a
        // header or an injected cell, so the reader's own pieces stay first
        // and interactive and nothing fictional can be reached by scrolling
        // the grid itself.
        ListFooterComponent={
          <SecondaryInsights
            screen={screen}
            onSeeAll={seeAllPieces}
            exampleRemaining={exampleRemaining}
          />
        }
        ListEmptyComponent={
          // The closet has pieces, but none under the chosen chip — the honest
          // "nothing filed under X yet", never the ghost-slot composition.
          <EmptySearch query="" category={screen.category} />
        }
      />
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      {/* C-03's dimming is the screen's own render — the menu draws no scrim.
          `pointerEvents` gates the page so a dimmed control can't be tapped. */}
      <View style={{ flex: 1, opacity: menuOpen ? 0.4 : 1 }} pointerEvents={menuOpen ? 'none' : 'auto'}>
        {body}
      </View>

      {/* ADD PIECE — persistent, and NEVER DISABLED. Redesign 14.
          The wall is met at the ADD ATTEMPT, truthfully, by the server. A
          control greyed out before the attempt teaches somebody the app is
          broken rather than that their closet is full, and it removes the one
          moment where the limit can be explained with its remedy.
          `addPieceDisabled()` is a stated function rather than an absent prop
          so a test has something to hold when somebody reaches for `disabled`.

          100pt above the frame bottom so it clears the native Liquid Glass tab
          bar at every device height — that bar cannot be dismissed from JS and
          draws over anything at bottom: 0. Hidden while picking and while the
          menu is open: a floating add control over a selection bar is two
          primaries arguing. */}
      {selecting || menuOpen || screen.items.length === 0 ? null : (
        <Pressable
          onPress={() => router.push('/add-clothes')}
          disabled={addPieceDisabled()}
          accessibilityRole="button"
          accessibilityLabel={CLOSET_COPY.addPiece}
          className="absolute items-center justify-center bg-accent active:opacity-80"
          style={{
            right: FAB_RIGHT,
            bottom: FAB_BOTTOM,
            width: FAB_SIZE,
            height: FAB_SIZE,
            borderRadius: FAB_SIZE / 2,
          }}>
          <SymbolView
            name="plus"
            size={24}
            tintColor={theme.canvas}
            resizeMode="scaleAspectFit"
            fallback={
              // `allowFontScaling={false}`: the plus is an ICON, not type.
              // At AX-XXXL a scaling glyph outgrows the 60pt circle and clips
              // into something that reads as a different symbol entirely —
              // which is exactly what the first AX capture showed.
              <Text
                variant="label"
                allowFontScaling={false}
                style={{ color: theme.canvas, fontSize: 26 }}>
                +
              </Text>
            }
          />
        </Pressable>
      )}

      <ClosetMenu
        visible={menuOpen}
        // Overlay coordinates are safe-area-relative here, so the component's
        // screen-relative default would float the card too low: 8pt header
        // padding + the 34pt button + 8pt of air puts it just under the row.
        anchor={{ top: 50, right: GUTTER }}
        reviewCount={screen.reviewCount}
        onReviewTags={() => {
          setMenuOpen(false);
          router.push('/review');
        }}
        onSelectPieces={() => {
          setMenuOpen(false);
          screen.enterSelection();
        }}
        onStorage={() => {
          setMenuOpen(false);
          router.push('/storage');
        }}
        onProfileSettings={() => {
          setMenuOpen(false);
          router.navigate('/profile');
        }}
        onDismiss={() => setMenuOpen(false)}
      />

      {/* Mounted only while open, so its read of `profiles` costs nothing on
          a screen the user is only scrolling. */}
      {screen.editing ? (
        <EditProfileSheet visible onClose={() => screen.setEditing(false)} />
      ) : null}

      <ClosetInspirationSheet
        visible={inspiration.show && !screen.loading && !screen.error}
        onDismiss={inspiration.dismiss}
        onStart={() => {
          inspiration.dismiss();
          screen.setEditing(true);
        }}
      />
    </SafeAreaView>
  );
}

/**
 * The header row every state opens with: the tracked eyebrow, and — when the
 * state has anything for them to do — the two 34pt circular icon buttons.
 * C-05 and C-06 pass no handlers and get the eyebrow alone.
 */
function EyebrowHeader({
  onSearch,
  onMenu,
}: {
  onSearch?: () => void;
  onMenu?: () => void;
}) {
  return (
    <View
      className="flex-row items-center justify-between px-gutter pt-2"
      style={{ minHeight: 34 }}>
      <Text variant="eyebrow" accessibilityRole="header">
        Your closet
      </Text>
      {onSearch || onMenu ? (
        <View className="flex-row items-center" style={{ gap: 10 }}>
          {onSearch ? (
            <HeaderIcon name="magnifyingglass" label="Search your wardrobe" onPress={onSearch} />
          ) : null}
          {onMenu ? (
            <HeaderIcon
              name="ellipsis"
              label="More closet actions"
              hint="Review tags, select pieces, open storage, or open your profile"
              onPress={onMenu}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** A 34pt hairline circle; the hit slop pads it out to the 44pt floor. */
function HeaderIcon({
  name,
  label,
  hint,
  onPress,
}: {
  name: SymbolViewProps['name'];
  label: string;
  /** Only the ellipsis needs one: a glyph that opens a menu has to say so. */
  hint?: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      hitSlop={(MIN_TAP_TARGET - 34) / 2}
      style={{ width: 34, height: 34 }}
      className="items-center justify-center rounded-full border border-hairline active:opacity-60">
      <SymbolView name={name} size={15} tintColor={theme.ink} resizeMode="scaleAspectFit" />
    </Pressable>
  );
}

/**
 * C-01's masthead, compressed to the four things a closet needs before it can
 * show a garment — UX-02.
 *
 * ── WHAT WAS ABOVE THE FIRST ROW OF CARDS, AND WHAT IS NOW ────────────────
 *
 * The atlas's masthead was eight sections deep: eyebrow, a 66pt identity block,
 * a full-width Edit button on its own line, the stat row, the capacity line,
 * the Latest rail, the Most worn rail, the insight card, and only then the
 * chips. On a 393×852 iPhone the first garment cleared the fold by nothing at
 * all — a wardrobe app that opened on a profile and two summaries OF the
 * wardrobe rather than on the wardrobe.
 *
 * Four sections survive here, and every one of them is either the person or a
 * way into the grid:
 *
 *   · the eyebrow, with search and the menu
 *   · identity — the face, the name, and Edit as a trailing action on the SAME
 *     row rather than a button on its own line
 *   · the stat row and the capacity line, which are four numbers, not a card
 *   · the category chips, immediately above the pieces they filter
 *
 * NOTHING IS DELETED. Both rails and the insight card moved below the grid
 * (`SecondaryInsights`), where they are still a scroll away and still say the
 * same thing — see the ListFooterComponent note on the C-01 branch.
 *
 * `ZeroIdentityHeader` is untouched: the zero state has no grid to get out of
 * the way of, and CI-01's identity → example → starter order is the whole
 * product decision of that branch.
 */
function Masthead({ screen, onMenu }: { screen: ClosetScreenModel; onMenu: () => void }) {
  return (
    // The grid's contentContainer already pads by GUTTER; pull the masthead
    // back out so its own `px-gutter`/margins measure from the screen edge.
    <View style={{ marginHorizontal: -GUTTER }}>
      <EyebrowHeader onSearch={screen.toggleSearch} onMenu={onMenu} />

      {/* Identity — the face, the name, and the way to change them, on one row.
          Sub-line is the hook's derived handle-and-city join, collapsing around
          whatever is missing.

          The avatar is 52 rather than 66. It is still the largest thing in the
          block and still unmistakably the reader's own face; the 14pt bought
          back is 14pt of garment. */}
      <View className="mt-4 flex-row items-center gap-3.5 px-gutter">
        <Avatar
          name={screen.name}
          size={52}
          tone="accent"
          imageUri={screen.avatarUrl ?? undefined}
          fallback="?"
        />
        <View className="flex-1">
          {screen.name ? (
            <Text variant="title" trim numberOfLines={1} accessibilityRole="header">
              {screen.name}
            </Text>
          ) : null}
          {screen.handleLine ? (
            <Text variant="label" className={screen.name ? 'mt-2' : ''} numberOfLines={1}>
              {screen.handleLine}
            </Text>
          ) : null}
        </View>

        {/* Edit, as the identity row's own trailing action.
            A full-width bordered button on its own line cost about 50pt to say
            what one word says here, and a control that is edge-to-edge reads as
            the page's primary action — which on a closet it is not. The label
            keeps its full sentence for VoiceOver, the hit region is padded past
            the 44pt floor, and it stays quiet: the page spends its accent on
            the unworn numeral. */}
        <Pressable
          onPress={() => screen.setEditing(true)}
          accessibilityRole="button"
          accessibilityLabel="Edit your profile"
          accessibilityHint="Change your name, handle, bio and photo"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 8 }}
          style={{ minHeight: 34, justifyContent: 'center' }}
          className="active:opacity-60">
          <Text variant="label" className="text-ink">
            Edit
          </Text>
        </Pressable>
      </View>

      {/* "84 active · 26 stored" — the accepted masthead line.
          Two numbers rather than one, because the closet has two populations
          and the stored one is invisible on this screen: a person who put
          twenty pieces away and sees only "84" has no way to tell whether they
          are still there. */}
      <View className="mt-1 px-gutter">
        <ClosetCountsLine />
      </View>

      <View className="mt-4 px-gutter">
        <StatRow
          pieces={screen.stats.pieces}
          outfits={screen.stats.outfits}
          unworn={screen.stats.unworn}
          followers={screen.stats.followers}
        />
      </View>

      {/* The Wall, W-01/W-05 — full reads as a stated count, never a
          disabled control, and the ceiling disappears the moment it stops
          being one. */}
      <CapacityBandRow large={false} />

      <CategoryChipsRow screen={screen} />
    </View>
  );
}

/**
 * Everything the closet knows ABOUT itself, under the closet — UX-02.
 *
 * The two rails and the insight card are derived readings of the same pieces
 * the grid above is already showing. They were worth keeping and they were not
 * worth opening on, which is exactly what a footer is for.
 *
 * Both rails keep the visibility rules they have always had: Latest appears
 * when there is anything at all, Most worn appears only once something has
 * been worn, and neither renders empty. No piece-count threshold gates either
 * one — the implementation plan refuses the atlas's unbriefed 5/15 rules.
 */
/**
 * The two rails, above the grid. Redesign 14.
 *
 * ── ABSENT, NEVER EMPTY ─────────────────────────────────────────────────────
 *
 * Most worn renders only once something has been worn, because it is a
 * DERIVATION and a derivation with no data has nothing to say. Favourite
 * outfits renders only when outfits have been favourited — and it is the
 * private favourite-OUTFITS rail from redesign 13, not a favourite-garment
 * state. No garment on this screen carries a favourite marker, because no
 * such state exists and drawing one would invent it.
 *
 * A rail that rendered empty would be worse than either: it would tell
 * somebody who has worn nothing that they have most-worn pieces, and then show
 * them a blank.
 */
function ClosetRails({ screen }: { screen: ClosetScreenModel }) {
  // Read here as well as inside the rail, so the PRESENCE decision and the
  // rail's own render agree. `useFavoriteOutfits` is a react-query hook, so
  // this is one cache read rather than a second request.
  const favorites = useFavoriteOutfits();

  // Which rails were on screen. Never what is in them, never how many — a
  // count of owned pieces is a wardrobe size and does not travel.
  const rails = railsPresent(
    screen.mostWornRail.length > 0,
    (favorites.data?.length ?? 0) > 0,
  );
  const reported = useRef<string | null>(null);
  useEffect(() => {
    if (reported.current === rails) return;
    reported.current = rails;
    track(CLOSET_EVENTS.viewed, closetViewedProps(rails));
  }, [rails]);

  if (rails === 'none') return null;

  return (
    <View style={{ marginHorizontal: -GUTTER }}>
      {screen.mostWornRail.length > 0 ? (
        // MOST WORN, not "Favourites" — the set is `mostWornItems`, ranked by
        // wear count. Nothing in this app lets a person nominate a favourite
        // GARMENT and no column records one; the rail says what it is made of.
        <Rail
          title={CLOSET_COPY.mostWorn}
          aside={
            <Text variant="caption">
              {`${screen.mostWornRail.length} ${screen.mostWornRail.length === 1 ? 'piece' : 'pieces'}`}
            </Text>
          }>
          {screen.mostWornRail.map((item) => (
            <RailCard
              key={item.id}
              item={item}
              variant="mostWorn"
              imageUri={screen.resolve(item.listingPath, item.platePath, item.cutoutPath)}
              onPress={screen.openItem}
            />
          ))}
        </Rail>
      ) : null}

      <FavoriteOutfitsRail />
    </View>
  );
}

function SecondaryInsights({
  screen,
  onSeeAll,
  exampleRemaining,
}: {
  screen: ClosetScreenModel;
  onSeeAll: () => void;
  /** Pieces still owed to the free ten, or null when none are. See the caller. */
  exampleRemaining: number | null;
}) {
  return (
    // Same negative gutter as the masthead: the grid's contentContainer pads by
    // GUTTER, and these sections measure from the screen edge.
    <View style={{ marginHorizontal: -GUTTER }}>
      {screen.latestPieces.length > 0 ? (
        <Rail
          title="Latest pieces"
          aside={
            <Pressable
              onPress={onSeeAll}
              accessibilityRole="button"
              accessibilityLabel="See all pieces"
              hitSlop={{ top: 14, bottom: 14, left: 12, right: 12 }}
              className="active:opacity-60">
              <Text variant="caption">See all</Text>
            </Pressable>
          }>
          {screen.latestPieces.map((item) => (
            <RailCard
              key={item.id}
              item={item}
              variant="latest"
              imageUri={screen.resolve(item.listingPath, item.platePath, item.cutoutPath)}
              onPress={screen.openItem}
            />
          ))}
        </Rail>
      ) : null}

      <View className="mt-6 px-gutter">
        <InsightCard
          worn={screen.insight.worn}
          total={screen.insight.total}
          unworn={screen.insight.unworn}
        />
      </View>

      {exampleRemaining === null ? null : (
        <View className="pt-8">
          <ExampleCloset variant="compact" remaining={exampleRemaining} />
        </View>
      )}
    </View>
  );
}

/** A masthead rail: eyebrow + right-aligned aside over a horizontal scroll. */
function Rail({
  title,
  aside,
  children,
}: {
  title: string;
  aside: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View className="mt-6">
      <View className="flex-row items-baseline justify-between px-gutter">
        <Text variant="eyebrow">{title}</Text>
        {aside}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: GUTTER, gap: RAIL_GAP, paddingTop: 12 }}>
        {children}
      </ScrollView>
    </View>
  );
}

/**
 * The browsing row with live counts — one `category` state shared by the
 * identity view and search mode, so the two can never disagree about which
 * chip is selected. Zero-count categories are already dropped by the hook.
 *
 * ── AUDIT 61, AND WHY THERE IS NOTHING ELSE HERE ──────────────────────────
 *
 * C-03 is the proof frame: "the last chip is whole, it clears the frame edge by
 * 20 pt, and the partial chip is now at the left where the row continues
 * backwards. Nothing about the row's appearance changes between ends — there is
 * no fade, no arrow and no gradient mask, because a rail that is padded honestly
 * does not need one."
 *
 * `paddingHorizontal: GUTTER` IS that honesty, and GUTTER is 20: a horizontal
 * ScrollView applies its content padding at BOTH ends of the scrollable
 * content, so the same one value gives the 20pt lead inset C-01 draws and the
 * 20pt trailing inset C-03 draws. There is deliberately no gradient, no chevron
 * and no `contentInset` trick anywhere in this component — every one of them
 * exists to apologise for a rail that ends flush, and this one does not.
 */
function CategoryChipsRow({ screen }: { screen: ClosetScreenModel }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // A ScrollView grows to fill its parent by default; as a flex child of
      // the search column that stretched every chip screen-tall. The row's
      // height is its content's, nothing more.
      style={{ flexGrow: 0 }}
      contentContainerStyle={{
        gap: CHIP_GAP,
        paddingHorizontal: GUTTER,
        paddingVertical: CHIP_ROW_PAD_Y,
        minHeight: CHIP_ROW_HEIGHT,
        alignItems: 'center',
      }}>
      {screen.categories.map(({ category, count }) => (
        <Chip
          key={category}
          label={category}
          count={count}
          selected={screen.category === category}
          // C-01's active chip is ink, not the accent — oxblood on this screen
          // is reserved for the unworn figure and the never-worn flags.
          selectedGround="ink"
          onPress={() => screen.setCategory(category)}
        />
      ))}
    </ScrollView>
  );
}

/** C-04's header: Cancel / "{n} selected" / Select all (Deselect when full). */
function SelectionHeader({ screen }: { screen: ClosetScreenModel }) {
  const theme = useTheme();
  const count = screen.picked?.size ?? 0;

  const sideButton = (label: string, onPress: () => void) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={{ top: 14, bottom: 14, left: 12, right: 12 }}
      className="active:opacity-60">
      <Text variant="label" style={{ fontSize: 15, lineHeight: 20, color: theme.accent }}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View
      className="flex-row items-center justify-between px-gutter pt-2"
      style={{ minHeight: 34 }}>
      {sideButton('Cancel', screen.cancelSelection)}
      {/* 15/600 in ink; a live region so VoiceOver counts along. */}
      <Text
        variant="label"
        accessibilityLiveRegion="polite"
        style={{ fontSize: 15, lineHeight: 20 }}
        className="text-ink">
        {`${count} selected`}
      </Text>
      {/* The label is derived rather than branched on a second boolean, so the
          word and the action can never disagree. */}
      {screen.allSelected
        ? sideButton(selectAllLabel(count, count), screen.deselectAll)
        : sideButton(selectAllLabel(count, count + 1), screen.selectAll)}
    </View>
  );
}

/**
 * The grid's nothing-found state — honest about which filter emptied it. Both
 * the search field and a category chip with nothing filed under it land here.
 */
function EmptySearch({ query, category }: { query: string; category: CategoryFilter }) {
  const filtered = category !== 'All';
  const title = query || filtered ? 'Nothing matches' : 'An empty rail';
  const body = query
    ? 'No pieces match that search. Try a colour, a brand, or the kind of garment.'
    : filtered
      ? `Nothing filed under ${category.toLowerCase()} yet.`
      : 'Add a few pieces and your whole wardrobe becomes searchable here.';

  // `compact` drops the flex-1 centring, which needs a flex parent and
  // collapses to nothing inside a FlashList's ListEmptyComponent.
  return <EmptyState compact symbol="magnifyingglass" title={title} body={body} />;
}

/**
 * The Wall's W-01/W-05 — "10 OF 10 · FULL" while the free ceiling is the
 * live constraint, plain "N PIECES" once it stops being one. Full reads as a
 * stated fact here, never a disabled control: nothing on this screen greys
 * out or blocks the add tile at the limit (the closet-full sheet lives at
 * the moment of the attempt — capture.tsx's W-02 — not as a standing warning
 * on the masthead). Still true with the `See plans` link beside it: a link is
 * a door, not a gate — the add tile stays live at ten, and the sheet it opens
 * is the same one the attempt raises.
 *
 * The 10-piece threshold is the free plan's own ceiling
 * (`PLANS.free.items`), not a magic number re-typed here: once a plan's
 * limit rises past it, the "of N" ceiling nobody will reach stops being
 * printed at all, exactly as W-05 requires ("the counter stops saying 'of
 * 10' entirely").
 */
/**
 * Capacity, as the designed band. Redesign 14.
 *
 * ── WHAT THIS REPLACES, AND WHY ─────────────────────────────────────────────
 *
 * `CapacityColophon` — an 11pt line reading "84 PIECES", with "· FULL"
 * appended and a See plans link beside it. Three things were wrong with it.
 *
 * It printed a bare count on paid plans and a fraction only under ten, so the
 * one number that matters — how much room is left — was invisible to exactly
 * the people with a lot of pieces. It showed a WALL as a suffix on a colophon,
 * which is the smallest type on the screen carrying the largest fact. And it
 * knew only one wall: `capacity.full` was true whether or not storage had room,
 * so somebody who could have stored a piece and somebody who could not were
 * shown the same line and offered the same door.
 *
 * The band states both ceilings on one track, and `capacityState` tells the two
 * walls apart so each gets the remedy that actually works.
 *
 * The client displays and preflights; the server decides. Nothing here gates a
 * write, and `addPieceDisabled()` is stated as a function so the "Add piece is
 * never disabled" contract has something a test can hold.
 */
/** The masthead's own line: how many are out, and how many are put away. */
function ClosetCountsLine() {
  const capacity = useCapacity();
  if (capacity.loading) return null;
  return (
    <Text variant="note">
      {mastheadCounts(capacity.used, Math.max(0, capacity.stored - capacity.used))}
    </Text>
  );
}

function CapacityBandRow({ large }: { large: boolean }) {
  const capacity = useCapacity();
  const { plan, copy } = usePlan();
  const gate = useGate();
  const router = useRouter();
  const reported = useRef<string | null>(null);

  const state = capacityState({
    active: capacity.used,
    activeLimit: capacity.limit,
    stored: capacity.stored,
    storedLimit: capacity.storedLimit,
  });

  // Which of three walls, and nothing about the ceiling or the usage — a
  // wardrobe size is a wealth proxy and a near-unique number.
  useEffect(() => {
    if (capacity.loading || reported.current === state) return;
    reported.current = state;
    track(CLOSET_EVENTS.capacityState, closetCapacityProps(state));
  }, [capacity.loading, state]);

  if (capacity.loading) return null;

  return (
    <View className="px-gutter" style={{ paddingTop: 12 }}>
      <CapacityBand
        plan={plan}
        planName={copy.name}
        active={capacity.used}
        activeLimit={capacity.limit}
        archived={Math.max(0, capacity.stored - capacity.used)}
        total={capacity.stored}
        storedLimit={capacity.storedLimit}
        state={state}
        large={large}
        onDoor={(door) => {
          if (door === 'store') {
            router.push('/storage');
            return;
          }
          // The plans door, reported as opened and never with a plan or a
          // price attached.
          track(CLOSET_EVENTS.plansDoor, closetPlansDoorProps());
          void gate.present(Placement.AddGarmentOverLimit);
        }}
      />
    </View>
  );
}
