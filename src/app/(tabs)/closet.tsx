import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClosetGrid } from '@/components/closet/closet-grid';
import { ClosetGridSkeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useCloset } from '@/features/closet/queries';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { costPerWear, type Item, type ItemCategory } from '@/schemas/item';
import { useTheme } from '@/theme/tokens';

/**
 * The closet, as the handoff design draws it: a fixed masthead — title, a live
 * search, the three headline numbers, and the category filter — sitting above a
 * scrolling two-column grid of the actual garments.
 *
 * Everything above the grid is deliberately OUTSIDE the FlashList rather than
 * riding as a ListHeader. A controlled <TextInput> inside a virtualised list's
 * header loses focus on every keystroke, because the header re-renders and the
 * input remounts. Keeping the masthead fixed also matches the design: the
 * numbers and filter stay put while only the wardrobe scrolls.
 */
const CATEGORIES: { key: ItemCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'top', label: 'Tops' },
  { key: 'bottom', label: 'Bottoms' },
  { key: 'outerwear', label: 'Outerwear' },
  { key: 'footwear', label: 'Shoes' },
  { key: 'accessory', label: 'Accessories' },
];

const GUTTER = 20;

export default function ClosetScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [category, setCategory] = useState<ItemCategory | 'all'>('all');
  const [query, setQuery] = useState('');

  // OUT-13: live closet. The same query Profile's stats already read, so the
  // two screens can never disagree about what the user owns.
  const closet = useCloset();
  const items = useMemo(() => closet.data ?? [], [closet.data]);

  // Garment paths are private — sign them before an <Image> can render them.
  const { resolve } = useSignedUrls(items.flatMap((i) => [i.thumbPath, i.cutoutPath]));

  const inCategory = useMemo(
    () => (key: ItemCategory | 'all') =>
      key === 'all'
        ? items
        : items.filter((i) =>
            // Accessories absorb `other`, so nothing falls through the filter.
            key === 'accessory'
              ? i.category === 'accessory' || i.category === 'other'
              : i.category === key,
          ),
    [items],
  );

  // The three headline numbers, computed over the WHOLE closet, not the filtered
  // view: they are facts about the wardrobe, and a number that moved every time
  // you tapped a category would be reporting the filter, not the closet.
  const stats = useMemo(() => {
    const mostWorn = items.reduce<Item | null>(
      (best, i) => (best === null || i.wearCount > best.wearCount ? i : best),
      null,
    );
    const neverWorn = items.filter((i) => i.wearCount === 0).length;
    const priced = items
      .map((i) => costPerWear(i))
      .filter((v): v is number => v !== null && Number.isFinite(v));
    const avgCpw = priced.length ? priced.reduce((s, v) => s + v, 0) / priced.length : null;
    return { mostWorn, neverWorn, avgCpw };
  }, [items]);

  // Category, then the live search over the words a person would actually type:
  // what it is, its colour, the brand. Newest first within the result.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (i: Item) =>
      !q ||
      [i.subcategory, i.category, i.brand, ...i.colors.map((c) => c.name)]
        .filter(Boolean)
        .some((s) => s!.toLowerCase().includes(q));
    return inCategory(category)
      .filter(matches)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [inCategory, category, query]);

  const masthead = (
    <View style={{ paddingHorizontal: GUTTER }}>
      <View className="flex-row items-baseline justify-between pt-2">
        <Text variant="display" trim accessibilityRole="header">
          Closet
        </Text>
        <Text variant="label" className="text-faint dark:text-faint-dark">
          {items.length} {items.length === 1 ? 'piece' : 'pieces'}
        </Text>
      </View>

      {/* Search */}
      <View className="mt-3 flex-row items-center gap-2 rounded-md bg-tray px-3.5 dark:bg-tray-dark">
        <SymbolView name="magnifyingglass" size={15} tintColor={theme.faint} resizeMode="scaleAspectFit" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search your wardrobe"
          placeholderTextColor={theme.faint}
          returnKeyType="search"
          clearButtonMode="while-editing"
          accessibilityLabel="Search your wardrobe"
          style={{ flex: 1, paddingVertical: 11, fontFamily: 'HelveticaNeue', fontSize: 15, color: theme.ink }}
        />
      </View>

      {/* The three headline numbers — a divided strip, informational. */}
      <View className="mt-3.5 flex-row border-y border-hairline dark:border-hairline-dark">
        <StatCell
          value={stats.mostWorn ? `${stats.mostWorn.wearCount}×` : '—'}
          label="Most worn"
        />
        <StatCell
          value={`${stats.neverWorn}`}
          label="Never worn"
          accent={stats.neverWorn > 0}
          divided
        />
        <StatCell
          value={stats.avgCpw !== null ? `$${stats.avgCpw.toFixed(2)}` : '—'}
          label="Avg / wear"
        />
      </View>

      {/* Category filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 7, paddingVertical: 12 }}>
        {CATEGORIES.map((c) => {
          const selected = category === c.key;
          return (
            <Pressable
              key={c.key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityHint={`Show only ${c.label}`}
              onPress={() => setCategory(c.key)}
              className={`rounded-full border px-3.5 py-1.5 active:opacity-70 ${
                selected
                  ? 'border-ink bg-ink dark:border-ink-dark dark:bg-ink-dark'
                  : 'border-rule bg-transparent dark:border-rule-dark'
              }`}>
              <Text
                variant="label"
                // Inline, not a className: the variant's own text-muted and a
                // text-canvas class have no guaranteed precedence.
                style={{ color: selected ? theme.canvas : theme.muted }}>
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark" edges={['top']}>
      {closet.isLoading ? (
        // The masthead swaps down to just the title while loading — the search,
        // stat strip and chips have nothing to act on yet, but the design keeps
        // the "Closet" title standing above the spinner so the page doesn't jump.
        <>
          <View style={{ paddingHorizontal: GUTTER }} className="pt-2">
            <Text variant="display" trim accessibilityRole="header">
              Closet
            </Text>
          </View>
          <ClosetGridSkeleton />
        </>
      ) : (
        <>
          {masthead}
          <ClosetGrid
            items={visible}
            onItemPress={(item) => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
            resolveImage={resolve}
            // The grid's only refetch affordance. The ingest queue invalidates
            // on its own when an import settles; this is for everything else —
            // an edit on another device, a delete that raced the cache.
            refreshControl={
              <RefreshControl refreshing={closet.isRefetching} onRefresh={() => void closet.refetch()} />
            }
            ListEmptyComponent={
              <EmptyCloset
                query={query}
                category={category}
                onAdd={() => router.push('/capture')}
              />
            }
          />
        </>
      )}
    </SafeAreaView>
  );
}

/**
 * The empty rail — the design's 03c.
 *
 * Centred, not hard-left like the shared `EmptyState`, and the placeholder is
 * three dashed garment rails rather than an icon: the shape of what is missing
 * says "hang something here" far better than a t-shirt glyph. The same dashed
 * grammar the empty Today uses, so the two read as one app.
 */
function EmptyCloset({
  query,
  category,
  onAdd,
}: {
  query: string;
  category: ItemCategory | 'all';
  onAdd: () => void;
}) {
  const wholeCloset = category === 'all' && !query;

  const title = query ? 'Nothing matches' : wholeCloset ? 'An empty rail' : 'Nothing in this drawer';
  const body = query
    ? 'No pieces match that search. Try a colour, a brand, or the kind of garment.'
    : wholeCloset
      ? 'Add a few pieces and this fills with your real wardrobe — worn counts, cost-per-wear, the lot.'
      : 'No pieces in this category yet. Tap All to see the whole closet.';

  return (
    <View className="items-center px-8 pt-16">
      <View className="flex-row gap-2">
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={{ width: 52, height: 74 }}
            className="rounded-md border border-dashed border-rule bg-tray dark:border-rule-dark dark:bg-tray-dark"
          />
        ))}
      </View>

      <Text variant="title" className="mt-7 text-center">
        {title}
      </Text>
      <Text variant="body" className="mt-3 max-w-[260px] text-center text-muted dark:text-muted-dark">
        {body}
      </Text>

      {wholeCloset ? (
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel="Add clothes"
          className="mt-6 h-12 items-center justify-center rounded-md bg-ink px-7 active:opacity-90 dark:bg-ink-dark">
          <Text variant="callout" className="font-semibold" style={{ color: '#FBFAF6' }}>
            Add clothes
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** One column of the headline-numbers strip: a serif figure over a tiny cap label. */
function StatCell({
  value,
  label,
  accent = false,
  divided = false,
}: {
  value: string;
  label: string;
  accent?: boolean;
  divided?: boolean;
}) {
  return (
    <View
      className={`flex-1 items-center py-2.5 ${
        divided ? 'border-x border-hairline dark:border-hairline-dark' : ''
      }`}>
      <Text
        variant="stat"
        className={accent ? 'text-accent dark:text-accent-dark' : 'text-ink dark:text-ink-dark'}>
        {value}
      </Text>
      <Text variant="colophon" className="mt-0.5">
        {label}
      </Text>
    </View>
  );
}
