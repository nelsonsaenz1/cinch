import { FlashList } from '@shopify/flash-list';
import { View } from 'react-native';

import { ItemCard } from '@/components/closet/item-card';
import type { Item } from '@/schemas/item';

export type ClosetGridProps = {
  items: Item[];
  onItemPress?: (item: Item) => void;
  ListHeaderComponent?: React.ComponentType | React.ReactElement | null;
  ListEmptyComponent?: React.ComponentType | React.ReactElement | null;
};

/**
 * FlashList v2 — note there are no size-estimate props any more. v2 is a
 * New-Architecture rewrite that measures automatically, so `estimatedItemSize`
 * and friends from v1 tutorials are gone, not merely optional.
 */
export function ClosetGrid({
  items,
  onItemPress,
  ListHeaderComponent,
  ListEmptyComponent,
}: ClosetGridProps) {
  return (
    <FlashList
      data={items}
      numColumns={2}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ItemCard item={item} onPress={onItemPress} />}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
      contentContainerClassName="px-gutter pb-24"
      ItemSeparatorComponent={() => <View className="h-1" />}
      showsVerticalScrollIndicator={false}
    />
  );
}
