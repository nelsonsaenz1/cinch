import type { FlashListRef } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useRef, useState } from 'react';
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

import { ClosetGrid } from '@/components/closet/closet-grid';
import { ClosetMenu } from '@/components/closet/closet-menu';
import { ClosetSkeleton } from '@/components/closet/closet-skeleton';
import { ExampleCloset } from '@/components/closet/example-closet';
import { InsightCard } from '@/components/closet/insight-card';
import { useCapacity } from '@/features/billing/use-capacity';
import { RailCard } from '@/components/closet/rail-card';
import { SelectionBar } from '@/components/closet/selection-bar';
import { StatRow } from '@/components/closet/stat-row';
import { Avatar, Chip, EmptyState, ErrorState, SearchField, Text } from '@/components/ui';
import {
  useClosetScreen,
  type CategoryFilter,
  type ClosetScreenModel,
} from '@/features/closet/use-closet-screen';
import { EditProfileSheet } from '@/features/profile/edit-profile-sheet';
import type { Item } from '@/schemas/item';
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

/** The rail gap and the chip gap — two measures that need not agree. */
const RAIL_GAP = 14;
const CHIP_GAP = 7;

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
  const screen = useClosetScreen();
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
    // C-05. Eyebrow only — search and the menu have nothing to act on. The
    // ScrollView exists for pull-to-refresh, which must survive every state.
    // No identity row: the atlas dropped it for this state entirely — "Six
    // photos from now" replaces the name-and-count line, because there is no
    // name-worthy fact yet ("0 pieces" was never one). Stat row stays
    // suppressed for the same reason it always was — four zeroes under an
    // example grid would undercut the example rather than excuse it.
    body = (
      <ScrollView refreshControl={refreshControl} contentContainerStyle={{ paddingBottom: 96 }}>
        <EyebrowHeader />
        <View className="mt-3 px-gutter">
          <Text variant="title" trim numberOfLines={1} accessibilityRole="header">
            Six photos from now
          </Text>
        </View>
        <View className="mt-4">
          <ExampleCloset onAddPieces={() => router.push('/add-clothes')} />
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
    // collapses — results start at the top, chips stay usable (query + chip
    // compose in the hook), and the footer note keeps the matcher honest.
    const n = screen.visible.length;
    body = (
      <Animated.View style={{ flex: 1 }} entering={FadeIn.duration(motion.duration.fast)}>
        <View className="flex-row items-center gap-3 pl-gutter pr-gutter pt-2">
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
            className="active:opacity-60">
            {/* 15/500 in the accent, per the atlas. Inline colour, never a
                second `text-*` class (button.tsx precedence lesson). */}
            <Text variant="label" style={{ fontSize: 15, lineHeight: 20, color: theme.accent }}>
              Cancel
            </Text>
          </Pressable>
        </View>

        <View className="px-gutter pt-4">
          <Text variant="eyebrow" accessibilityLiveRegion="polite">
            {`${n} ${n === 1 ? 'piece' : 'pieces'}`}
          </Text>
        </View>

        <CategoryChipsRow screen={screen} />

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
          <Masthead screen={screen} onSeeAll={seeAllPieces} onMenu={() => setMenuOpen(true)} />
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
        onGapFeed={() => {
          setMenuOpen(false);
          router.push('/gap-feed');
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

/** C-01's masthead — atlas sections 1–8, in order, inside the list header. */
function Masthead({
  screen,
  onSeeAll,
  onMenu,
}: {
  screen: ClosetScreenModel;
  onSeeAll: () => void;
  onMenu: () => void;
}) {
  return (
    // The grid's contentContainer already pads by GUTTER; pull the masthead
    // back out so its own `px-gutter`/margins measure from the screen edge.
    <View style={{ marginHorizontal: -GUTTER }}>
      <EyebrowHeader onSearch={screen.toggleSearch} onMenu={onMenu} />

      {/* Identity — the face and the name. Sub-line is the hook's derived
          handle-and-city join, collapsing around whatever is missing. */}
      <View className="mt-5 flex-row items-center gap-4 px-gutter">
        <Avatar
          name={screen.name}
          size={66}
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
            <Text variant="label" className={screen.name ? 'mt-2.5' : ''}>
              {screen.handleLine}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Edit profile — full-width, 34pt, rule border, per the atlas. Quiet on
          purpose: the page spends its accent on the unworn numeral. */}
      <Pressable
        onPress={() => screen.setEditing(true)}
        accessibilityRole="button"
        accessibilityLabel="Edit your profile"
        accessibilityHint="Change your name, handle, bio and photo"
        hitSlop={{ top: 5, bottom: 5 }}
        style={{ height: 34 }}
        className="mx-gutter mt-4 items-center justify-center rounded-md border border-rule active:opacity-60">
        <Text variant="label" className="text-ink">
          Edit profile
        </Text>
      </Pressable>

      <View className="mt-5 px-gutter">
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
      <CapacityColophon />

      {/* Both rails, per atlas C-01 — Latest is recency, Favourites is wear
          data. A closet with no wear data yet shows Latest alone; the
          Favourites rail hides rather than rendering empty. */}
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

      {screen.favourites.length > 0 ? (
        <Rail
          title="Favourites"
          aside={
            <Text variant="caption">
              {`${screen.favourites.length} ${screen.favourites.length === 1 ? 'piece' : 'pieces'}`}
            </Text>
          }>
          {screen.favourites.map((item) => (
            <RailCard
              key={item.id}
              item={item}
              variant="favourite"
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

      <CategoryChipsRow screen={screen} />
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
      contentContainerStyle={{ gap: CHIP_GAP, paddingHorizontal: GUTTER, paddingVertical: 10 }}>
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
      {screen.allSelected
        ? sideButton('Deselect all', screen.deselectAll)
        : sideButton('Select all', screen.selectAll)}
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
 * on the masthead).
 *
 * The 10-piece threshold is the free plan's own ceiling
 * (`PLANS.free.items`), not a magic number re-typed here: once a plan's
 * limit rises past it, the "of N" ceiling nobody will reach stops being
 * printed at all, exactly as W-05 requires ("the counter stops saying 'of
 * 10' entirely").
 */
function CapacityColophon() {
  const theme = useTheme();
  const capacity = useCapacity();
  if (capacity.loading) return null;

  const label =
    capacity.limit <= 10
      ? `${capacity.used} OF ${capacity.limit}${capacity.full ? ' · FULL' : ''}`
      : `${capacity.used} ${capacity.used === 1 ? 'PIECE' : 'PIECES'}`;

  return (
    <View className="mt-2 px-gutter">
      {/* `style`, never a second `text-*` class: `caption` already carries
          `text-muted`, and NativeWind resolves two colour utilities on one
          element by key order, not by intent.

          `muted`, not `faint`. This line is where a person learns their closet
          is full, at 11px, and `faint` measures about 3.5:1 on canvas — the
          standing refusal. The whole point of The Wall is that the limit is
          stated plainly rather than discovered at the camera, which it cannot
          be if the sentence is the hardest thing on the screen to read. */}
      <Text
        variant="caption"
        style={{ fontFamily: 'ui-monospace', fontSize: 11, letterSpacing: 0.4, color: theme.muted }}>
        {label}
      </Text>
    </View>
  );
}
