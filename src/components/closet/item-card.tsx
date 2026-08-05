import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { type Item, costPerWear } from '@/schemas/item';
import { useTheme } from '@/theme/tokens';
import { stableImageSource } from '@/features/closet/use-image-urls';

export type ItemCardProps = {
  item: Item;
  onPress?: (item: Item) => void;
  /** Signed URL for the thumb/cutout — storage paths are not URLs. */
  imageUri?: string;
};

/**
 * A single garment in the closet grid.
 *
 * Cutouts sit on a neutral warm tray so nothing tints the garment — the tray
 * colour is the one surface in the app that must never carry the accent.
 */
function ItemCardComponent({ item, onPress, imageUri }: ItemCardProps) {
  const theme = useTheme();
  const cpw = costPerWear(item);
  const needsReview = item.status === 'needs_review';
  const swatch = item.colors[0]?.hex;

  // VoiceOver: a grid of garment cutouts is meaningless to a screen reader
  // without this. Build the sentence a person would actually say.
  const a11yLabel = [
    item.subcategory ?? item.category,
    item.colors[0]?.name,
    item.brand,
    item.wearCount > 0 ? `worn ${item.wearCount} times` : 'never worn',
    needsReview ? 'needs review' : null,
  ]
    .filter(Boolean)
    .join(', ');

  const neverWorn = item.wearCount === 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      onPress={() => onPress?.(item)}
      // No width class: FlashList's two-column layout already sizes the cell —
      // a w-1/2 here would render every card at a quarter of the screen.
      className="p-1.5 active:opacity-80">
      <View className="aspect-[4/5] w-full overflow-hidden rounded-lg bg-tray dark:bg-tray-dark">
        {imageUri ? (
          <Image
            source={stableImageSource(imageUri)}
            contentFit="contain"
            transition={180}
            cachePolicy="memory-disk"
            style={{ flex: 1 }}
            accessibilityIgnoresInvertColors
          />
        ) : (
          // No cutout yet. This is the default in the Simulator, where subject
          // lifting cannot run — so it has to look considered, not broken.
          <View className="flex-1 items-center justify-center">
            <SymbolView
              name={needsReview ? 'exclamationmark.triangle' : 'tshirt'}
              size={26}
              tintColor={needsReview ? theme.warning : theme.hairline}
              resizeMode="scaleAspectFit"
            />
          </View>
        )}

        {/* One badge only. A needs-review flag is the more urgent thing to say,
            so it wins the corner; otherwise the never-worn flag — in the accent
            — is the whole "get more from what you own" pitch made visible. */}
        {needsReview ? (
          <View className="absolute left-2 top-2 rounded-sm bg-warning px-2 py-0.5">
            <Text variant="caption" className="text-canvas dark:text-canvas">
              Needs review
            </Text>
          </View>
        ) : neverWorn ? (
          <View className="absolute left-2 top-2 rounded-sm bg-accent px-2 py-0.5">
            <Text variant="colophon" className="text-canvas dark:text-canvas">
              Never worn
            </Text>
          </View>
        ) : null}

        {swatch ? (
          <View
            className="absolute bottom-2 right-2 h-3.5 w-3.5 rounded-full border border-canvas/60"
            style={{ backgroundColor: swatch }}
          />
        ) : null}
      </View>

      <View className="mt-2 px-0.5">
        <Text variant="label" numberOfLines={1} className="text-ink dark:text-ink-dark">
          {item.subcategory ?? 'Untagged item'}
        </Text>
        {/* wears on the left, cost-per-wear on the right in the serif — the
            garment's whole story in one line. Never-worn reads in the accent. */}
        <View className="mt-1 flex-row items-baseline justify-between">
          <Text
            variant="caption"
            className={neverWorn ? 'text-accent dark:text-accent-dark' : 'text-muted dark:text-muted-dark'}>
            {neverWorn ? 'Never worn' : `${item.wearCount} ${item.wearCount === 1 ? 'wear' : 'wears'}`}
          </Text>
          <Text variant="stat" className="text-label text-ink dark:text-ink-dark">
            {cpw !== null ? `$${cpw.toFixed(2)}` : '—'}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

// The grid can hold hundreds of these; re-rendering them all on a filter change
// is the difference between smooth and janky.
export const ItemCard = memo(ItemCardComponent);
