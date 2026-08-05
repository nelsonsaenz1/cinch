import { FlashList } from '@shopify/flash-list';
import { View } from 'react-native';

import { ItemCard } from '@/components/closet/item-card';
import type { Item } from '@/schemas/item';

export type ClosetGridProps = {
  items: Item[];
  onItemPress?: (item: Item) => void;
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
};

/**
 * FlashList v2 — note there are no size-estimate props any more. v2 is a
 * New-Architecture rewrite that measures automatically, so `estimatedItemSize`
 * and friends from v1 tutorials are gone, not merely optional.
 */
export function ClosetGrid({
  items,
  onItemPress,
  resolveImage,
  ListEmptyComponent,
  ListHeaderComponent,
  ListFooterComponent,
  refreshControl,
}: ClosetGridProps) {
  return (
    <FlashList
      data={items}
      numColumns={2}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <ItemCard
          item={item}
          onPress={onItemPress}
          imageUri={resolveImage?.(item.thumbPath, item.cutoutPath)}
        />
      )}
      ListEmptyComponent={ListEmptyComponent}
      ListHeaderComponent={ListHeaderComponent}
      ListFooterComponent={ListFooterComponent}
      // Plain style, deliberately: FlashList is not wrapped by NativeWind, so a
      // contentContainerClassName here is silently dropped — no gutter, no
      // bottom padding, and nothing errors. 20 = spacing.gutter, 96 = pb-24.
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 96 }}
      ItemSeparatorComponent={() => <View className="h-1" />}
      refreshControl={refreshControl}
      showsVerticalScrollIndicator={false}
    />
  );
}
