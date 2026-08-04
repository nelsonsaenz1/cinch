import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClosetGrid } from '@/components/closet/closet-grid';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';
import { fixtureItems } from '@/features/closet/fixtures';
import type { Item, ItemCategory } from '@/schemas/item';

const CATEGORY_FILTERS: { key: ItemCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'top', label: 'Tops' },
  { key: 'bottom', label: 'Bottoms' },
  { key: 'outerwear', label: 'Outerwear' },
  { key: 'footwear', label: 'Shoes' },
  { key: 'accessory', label: 'Accessories' },
];

type SortKey = 'recent' | 'most-worn' | 'never-worn' | 'cost-per-wear';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'recent', label: 'Recent' },
  { key: 'most-worn', label: 'Most worn' },
  { key: 'never-worn', label: 'Never worn' },
  { key: 'cost-per-wear', label: 'Cost / wear' },
];

export default function ClosetScreen() {
  const router = useRouter();
  const [category, setCategory] = useState<ItemCategory | 'all'>('all');
  const [sort, setSort] = useState<SortKey>('recent');

  // TODO(OUT-13): replace fixtures with a TanStack Query hook against Supabase
  // once the migration is applied to the linked project.
  const items = fixtureItems;

  const visible = useMemo(() => {
    const filtered =
      category === 'all' ? items : items.filter((i) => i.category === category);

    const sorted = [...filtered];
    switch (sort) {
      case 'most-worn':
        sorted.sort((a, b) => b.wearCount - a.wearCount);
        break;
      case 'never-worn':
        // Never-worn first, then least-worn — this is the "what am I not
        // wearing" view, so it must not silently hide worn items entirely.
        sorted.sort((a, b) => a.wearCount - b.wearCount);
        break;
      case 'cost-per-wear': {
        // Items with no price sort last rather than being treated as free.
        const cpw = (i: Item) =>
          i.purchasePrice === null || i.wearCount === 0
            ? Number.POSITIVE_INFINITY
            : i.purchasePrice / i.wearCount;
        sorted.sort((a, b) => cpw(a) - cpw(b));
        break;
      }
      case 'recent':
      default:
        sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    return sorted;
  }, [items, category, sort]);

  const countFor = (key: ItemCategory | 'all') =>
    key === 'all' ? items.length : items.filter((i) => i.category === key).length;

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
      <View className="px-gutter pb-3 pt-2">
        <Text variant="display">Closet</Text>
        <Text variant="label" className="mt-1">
          {items.length} {items.length === 1 ? 'piece' : 'pieces'}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 px-gutter pb-3">
        {CATEGORY_FILTERS.map((f) => (
          <Chip
            key={f.key}
            label={f.label}
            count={countFor(f.key)}
            selected={category === f.key}
            onPress={() => setCategory(f.key)}
            accessibilityHint={`Filter closet to ${f.label}`}
          />
        ))}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2 px-gutter pb-4">
        {SORTS.map((s) => (
          <Chip
            key={s.key}
            label={s.label}
            selected={sort === s.key}
            onPress={() => setSort(s.key)}
            accessibilityHint={`Sort closet by ${s.label}`}
          />
        ))}
      </ScrollView>

      <ClosetGrid
        items={visible}
        onItemPress={(item) => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
        ListEmptyComponent={
          <View className="h-96">
            <EmptyState
              symbol="tshirt"
              title="Nothing here yet"
              body={
                category === 'all'
                  ? 'Add a few pieces and Cinch will start putting outfits together for you.'
                  : 'No pieces in this category yet.'
              }
              actionTitle={category === 'all' ? 'Add clothes' : undefined}
              onAction={category === 'all' ? () => router.push('/capture') : undefined}
            />
          </View>
        }
      />
    </SafeAreaView>
  );
}
