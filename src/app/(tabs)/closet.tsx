import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryTile } from '@/components/closet/category-tile';
import { ClosetGrid } from '@/components/closet/closet-grid';
import { StatTile } from '@/components/closet/stat-tile';
import { EmptyState } from '@/components/ui/empty-state';
import { Rule } from '@/components/ui/rule';
import { ClosetGridSkeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useCloset } from '@/features/closet/queries';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { costPerWear, type Item, type ItemCategory } from '@/schemas/item';

/**
 * Six categories, which is what makes the board work.
 *
 * Two rows of three is the only arrangement that fits a phone without either
 * shrinking the squares below a readable caption or pushing the wardrobe
 * itself off the first screen. `other` is folded into Accessories rather than
 * given a seventh tile — a lone orphan tile on a third row would cost a whole
 * row of vertical space to say "miscellaneous".
 */
const CATEGORIES: { key: ItemCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'Everything' },
  { key: 'top', label: 'Tops' },
  { key: 'bottom', label: 'Bottoms' },
  { key: 'outerwear', label: 'Outerwear' },
  { key: 'footwear', label: 'Shoes' },
  { key: 'accessory', label: 'Accessories' },
];

type SortKey = 'recent' | 'most-worn' | 'never-worn' | 'cost-per-wear';

const GUTTER = 20;
const GAP = 10;
const COLUMNS = 3;

export default function ClosetScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [category, setCategory] = useState<ItemCategory | 'all'>('all');
  const [sort, setSort] = useState<SortKey>('recent');

  // OUT-13: live closet. The same query Profile's stats already read, so the
  // two screens can never disagree about what the user owns.
  const closet = useCloset();
  const items = useMemo(() => closet.data ?? [], [closet.data]);

  // The garments bucket is private — paths must be signed before an <Image>
  // can render them. One batched request for the whole screen, tiles included.
  const { resolve } = useSignedUrls(items.flatMap((i) => [i.thumbPath, i.cutoutPath]));

  // Floor, not round: three tiles plus two gaps must never exceed the measure,
  // or the last column wraps and the second row collapses into a third.
  const tile = Math.floor((width - GUTTER * 2 - GAP * (COLUMNS - 1)) / COLUMNS);

  const inCategory = useMemo(
    () => (key: ItemCategory | 'all') =>
      key === 'all'
        ? items
        : items.filter((i) =>
            // Accessories absorb `other`, matching the tile that shows them.
            key === 'accessory'
              ? i.category === 'accessory' || i.category === 'other'
              : i.category === key,
          ),
    [items],
  );

  const visible = useMemo(() => {
    const sorted = [...inCategory(category)];
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
  }, [inCategory, category, sort]);

  // The three headline numbers, computed over the WHOLE closet rather than the
  // filtered view: they are facts about the wardrobe, and a number that moved
  // every time you tapped a category would be reporting the filter, not the
  // closet.
  const stats = useMemo(() => {
    const mostWorn = items.reduce<Item | null>(
      (best, i) => (best === null || i.wearCount > best.wearCount ? i : best),
      null,
    );
    const neverWorn = items.filter((i) => i.wearCount === 0).length;

    const priced = items
      .map((i) => costPerWear(i))
      .filter((v): v is number => v !== null && Number.isFinite(v));
    const avgCpw = priced.length
      ? priced.reduce((sum, v) => sum + v, 0) / priced.length
      : null;

    return { mostWorn, neverWorn, avgCpw };
  }, [items]);

  const board = (
    <View style={{ paddingBottom: 4 }}>
      <View className="pb-4 pt-2">
        <Text variant="display" trim accessibilityRole="header">
          My Closet
        </Text>
        <View style={{ marginTop: 12 }}>
          <Rule />
        </View>
        <Text variant="label" className="mt-2 text-muted dark:text-muted-dark">
          {items.length} {items.length === 1 ? 'piece' : 'pieces'}
        </Text>
      </View>

      {/* Two rows of three. `flex-wrap` with a fixed tile width does the
          wrapping, so adding a seventh category later costs nothing. */}
      <View className="flex-row flex-wrap" style={{ gap: GAP }}>
        {CATEGORIES.map((c) => {
          const inIt = inCategory(c.key);
          return (
            <CategoryTile
              key={c.key}
              label={c.label}
              count={inIt.length}
              selected={category === c.key}
              onPress={() => setCategory(c.key)}
              size={tile}
              previews={inIt
                .slice(0, 4)
                .map((i) => resolve(i.thumbPath, i.cutoutPath))
                .filter((u): u is string => Boolean(u))}
            />
          );
        })}
      </View>

      <View style={{ marginTop: 24, marginBottom: 12 }}>
        <Rule />
      </View>
    </View>
  );

  const insights = (
    <View style={{ paddingTop: 28 }}>
      <View>
        <Rule />
      </View>
      <Text variant="eyebrow" className="mb-3 mt-3">
        What it is telling you
      </Text>

      <View className="flex-row" style={{ gap: GAP }}>
        <StatTile
          label="Most worn"
          value={stats.mostWorn ? `${stats.mostWorn.wearCount}×` : '—'}
          detail={stats.mostWorn?.subcategory ?? stats.mostWorn?.category ?? null}
          selected={sort === 'most-worn'}
          onPress={() => setSort(sort === 'most-worn' ? 'recent' : 'most-worn')}
          size={tile}
        />
        <StatTile
          label="Never worn"
          value={`${stats.neverWorn}`}
          detail={
            items.length
              ? `${Math.round((stats.neverWorn / items.length) * 100)}% of closet`
              : null
          }
          selected={sort === 'never-worn'}
          onPress={() => setSort(sort === 'never-worn' ? 'recent' : 'never-worn')}
          size={tile}
        />
        <StatTile
          label="Cost / wear"
          value={stats.avgCpw !== null ? `$${stats.avgCpw.toFixed(2)}` : '—'}
          detail={stats.avgCpw !== null ? 'average' : 'add prices'}
          selected={sort === 'cost-per-wear'}
          onPress={() => setSort(sort === 'cost-per-wear' ? 'recent' : 'cost-per-wear')}
          size={tile}
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
      {closet.isLoading ? (
        <ClosetGridSkeleton />
      ) : (
        <ClosetGrid
          items={visible}
          onItemPress={(item) => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
          resolveImage={resolve}
          ListHeaderComponent={board}
          // The numbers sit under the wardrobe because they are a conclusion
          // drawn from it, and because putting them above would push the
          // clothes themselves below the fold.
          ListFooterComponent={items.length > 0 ? insights : null}
          ListEmptyComponent={
            <View className="h-96">
              <EmptyState
                symbol="tshirt"
                title={category === 'all' ? 'Nothing here yet' : 'Nothing in this drawer'}
                body={
                  category === 'all'
                    ? 'Add a few pieces and Cinch will start putting outfits together for you.'
                    : 'No pieces in this category yet. Tap Everything to see the whole closet.'
                }
                actionTitle={category === 'all' ? 'Add clothes' : undefined}
                onAction={category === 'all' ? () => router.push('/capture') : undefined}
              />
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
