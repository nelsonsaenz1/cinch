import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import { useCloset } from '@/features/closet/queries';
import { useSignedUrls, stableImageSource } from '@/features/closet/use-image-urls';
import { costPerWear, type Item } from '@/schemas/item';
import { useTheme } from '@/theme/tokens';

/** "Oct 2023" from an ISO date, for the owned-since line. */
function monthYear(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/** How long since it was last on — the design's fourth stat. Honest when never. */
function sinceLastWorn(item: Item): string {
  if (!item.lastWornAt || item.wearCount === 0) return 'Never';
  const then = new Date(item.lastWornAt).getTime();
  if (Number.isNaN(then)) return '—';
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return '1d';
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)} mo`;
  return `${Math.round(days / 365)} yr`;
}

/** Item detail — one garment and its story. */
export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useTheme();

  // Resolved from the same live query the grid renders, so navigating here is
  // a cache hit, not a second fetch.
  const closet = useCloset();
  const item = (closet.data ?? []).find((i) => i.id === id);
  const cpw = item ? costPerWear(item) : null;

  const { resolve } = useSignedUrls([item?.cutoutPath, item?.thumbPath]);
  const imageUri = resolve(item?.cutoutPath, item?.thumbPath);

  if (closet.isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas dark:bg-canvas-dark">
        <ActivityIndicator color={theme.muted} />
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas dark:bg-canvas-dark">
        <Text variant="body">This piece is no longer in your closet.</Text>
        <Button title="Back" variant="ghost" onPress={() => router.back()} className="mt-4" />
      </SafeAreaView>
    );
  }

  const ownedSince = monthYear(item.purchaseDate ?? item.createdAt);
  const colours = item.colors.slice(0, 4);

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark">
      {/* Back, with the category named in the middle like the design's header. */}
      <View className="flex-row items-center justify-between px-gutter pt-2">
        <Button title="Back" variant="ghost" onPress={() => router.back()} />
        <Text variant="colophon">{item.subcategory ? item.category : ''}</Text>
        <View style={{ width: 56 }} />
      </View>

      <ScrollView contentContainerClassName="px-gutter pb-24">
        <View className="mt-2 aspect-square w-full items-center justify-center overflow-hidden rounded-plate bg-tray dark:bg-tray-dark">
          {imageUri ? (
            <Image
              source={stableImageSource(imageUri)}
              contentFit="contain"
              transition={200}
              cachePolicy="memory-disk"
              style={{ width: '100%', height: '100%' }}
              accessibilityIgnoresInvertColors
            />
          ) : null}
        </View>

        <Text variant="title" className="mt-5">
          {item.subcategory ?? 'Untagged item'}
        </Text>
        {ownedSince ? (
          <Text variant="label" className="mt-1 text-faint dark:text-faint-dark">
            Owned since {ownedSince}
          </Text>
        ) : null}

        {/* The 2×2 stat grid. Cost-per-wear is the inverted hero tile — it is the
            number no competitor computes, so it gets the ink. Internal cross
            lines come from per-cell borders; the outer frame from the container. */}
        <View className="mt-6 overflow-hidden rounded-plate border border-rule dark:border-rule-dark">
          <View className="flex-row">
            <StatBox value={`${item.wearCount}×`} label="Worn" edge="rb" />
            <StatBox
              value={item.purchasePrice !== null ? `$${item.purchasePrice.toFixed(0)}` : '—'}
              label="Paid"
              edge="b"
            />
          </View>
          <View className="flex-row">
            <StatBox
              value={cpw !== null ? `$${cpw.toFixed(2)}` : '—'}
              label="Cost per wear"
              edge="r"
              invert
            />
            <StatBox value={sinceLastWorn(item)} label="Since last worn" />
          </View>
        </View>

        {item.description ? (
          <Text variant="body" className="mt-5 text-muted dark:text-muted-dark">
            {item.description}
          </Text>
        ) : null}

        {item.occasions.length > 0 ? (
          <View className="mt-6">
            <Text variant="eyebrow" className="mb-3">
              Suits
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {item.occasions.map((o) => (
                <Chip key={o} label={o} />
              ))}
            </View>
          </View>
        ) : null}

        {colours.length > 0 ? (
          <View className="mt-6">
            <Text variant="eyebrow" className="mb-3">
              Colours
            </Text>
            <View className="flex-row items-center gap-2.5">
              {colours.map((c, i) =>
                c.hex ? (
                  <View
                    key={`${c.name}-${i}`}
                    className="h-6 w-6 rounded-full border border-rule dark:border-rule-dark"
                    style={{ backgroundColor: c.hex }}
                  />
                ) : null,
              )}
              <Text variant="label" className="text-muted dark:text-muted-dark">
                {colours.map((c) => c.name).join(' · ')}
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * One cell of the stat grid. `edge` names which internal borders it draws so the
 * cross lines never double up; `invert` is the ink hero tile.
 *
 * Colours are set by `style`, not className: on the inverted tile a `text-canvas`
 * class does NOT reliably beat the `stat` variant's own `text-ink` (NativeWind
 * gives no guaranteed precedence between two `text-*` utilities that land on the
 * same element), which rendered the hero figure ink-on-ink — invisible. An
 * inline style always wins, so the value is legible on both tiles.
 */
function StatBox({
  value,
  label,
  edge = '',
  invert = false,
}: {
  value: string;
  label: string;
  edge?: 'rb' | 'b' | 'r' | '';
  invert?: boolean;
}) {
  const theme = useTheme();
  const borders = `${edge.includes('r') ? 'border-r ' : ''}${edge.includes('b') ? 'border-b ' : ''}`;
  return (
    <View className={`flex-1 p-4 ${borders}border-rule dark:border-rule-dark ${invert ? 'bg-ink' : ''}`}>
      <Text variant="stat" className="text-figure" style={{ color: invert ? theme.canvas : theme.ink }}>
        {value}
      </Text>
      <Text
        variant="colophon"
        className="mt-1"
        style={{ color: invert ? 'rgba(251,250,246,0.7)' : theme.faint }}>
        {label}
      </Text>
    </View>
  );
}
