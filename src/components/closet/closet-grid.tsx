import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { View } from 'react-native';

import { ItemCard } from '@/components/closet/item-card';
import type { Item } from '@/schemas/item';
import { GUTTER } from '@/theme/tokens';

export type ClosetGridProps = {
  items: Item[];
  onItemPress?: (item: Item) => void;
  /** Long press on a tile — the way into the closet's selection mode. */
  onItemLongPress?: (item: Item) => void;
  /**
   * The picked ids, or null when the grid is not selecting. A `Set` rather
   * than an array: this is read once per visible cell on every render, and an
   * `includes` over a two-hundred-piece selection is a scroll stutter.
   */
  selectedIds?: ReadonlySet<string> | null;
  /** Storage paths → signed URLs; the grid prefers the thumb, falls back to the cutout. */
  resolveImage?: (...paths: (string | null | undefined)[]) => string | undefined;
  ListEmptyComponent?: React.ComponentType | React.ReactElement | null;
  // Kept for callers that want to ride content inside the list. The closet's
  // own masthead deliberately sits OUTSIDE it (see (tabs)/closet.tsx): a
  // controlled TextInput in a list header loses focus on every keystroke.
  ListHeaderComponent?: React.ComponentType | React.ReactElement | null;
  ListFooterComponent?: React.ComponentType | React.ReactElement | null;
  /** Passed straight to FlashList — pull-to-refresh for the closet. */
  refreshControl?: React.ReactElement<import('react-native').RefreshControlProps>;
  /** The underlying FlashList, for callers that need to scroll it ("See all"). */
  listRef?: React.Ref<FlashListRef<Item>>;
};

/**
 * FlashList v2 — note there are no size-estimate props any more. v2 is a
 * New-Architecture rewrite that measures automatically, so `estimatedItemSize`
 * and friends from v1 tutorials are gone, not merely optional.
 */
export function ClosetGrid({
  items,
  onItemPress,
  onItemLongPress,
  selectedIds = null,
  resolveImage,
  ListEmptyComponent,
  ListHeaderComponent,
  ListFooterComponent,
  refreshControl,
  listRef,
}: ClosetGridProps) {
  return (
    <FlashList
      ref={listRef}
      data={items}
      numColumns={2}
      keyExtractor={(item) => item.id}
      // `extraData` is what makes a selection visible: FlashList memoizes cells
      // against the data array, which does not change when a tick is toggled.
      extraData={selectedIds}
      renderItem={({ item }) => (
        <ItemCard
          item={item}
          onPress={onItemPress}
          onLongPress={onItemLongPress}
          selecting={selectedIds !== null}
          selected={selectedIds?.has(item.id) ?? false}
          imageUri={resolveImage?.(item.listingPath, item.thumbPath, item.cutoutPath)}
        />
      )}
      ListEmptyComponent={ListEmptyComponent}
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={ListFooterComponent}
      // Plain style, deliberately: FlashList is not wrapped by NativeWind, so a
      // contentContainerClassName here is silently dropped — no gutter, no
      // bottom padding, and nothing errors. `GUTTER` is the same measure
      // `px-gutter` gives every other page; 96 = pb-24.
      contentContainerStyle={{ paddingHorizontal: GUTTER, paddingBottom: 96 }}
      ItemSeparatorComponent={() => <View className="h-1" />}
      refreshControl={refreshControl}
      showsVerticalScrollIndicator={false}
      // Search mode puts a live text field directly above this grid; scrolling
      // the results is how a person says they are done typing.
      keyboardDismissMode="on-drag"
    />
  );
}
