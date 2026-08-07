import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { memo } from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { usePressFeedback } from '@/components/ui/use-press-feedback';
import { pieceName } from '@/features/closet/item-name';
import { stableImageSource } from '@/features/closet/use-image-urls';
import { type Item, costPerWear } from '@/schemas/item';
import { useTheme } from '@/theme/tokens';

export type RailCardProps = {
  item: Item;
  /**
   * `latest` — the 92×110 card of the LATEST PIECES rail: name below the well,
   * then a wears line (or NEVER WORN in the accent).
   * `favourite` — the 74×74 card of the FAVOURITES rail: just the garment and
   * its cost-per-wear; a favourite needs no introduction.
   */
  variant: 'latest' | 'favourite';
  /** Signed URL for the plate/cutout — storage paths are not URLs. */
  imageUri?: string;
  onPress?: (item: Item) => void;
};

/** The image well — same recipe both variants, different measure. */
function Well({
  item,
  imageUri,
  width,
  height,
}: {
  item: Item;
  imageUri?: string;
  width: number;
  height: number;
}) {
  const theme = useTheme();
  return (
    <View
      className="overflow-hidden rounded-[10px] border border-hairline bg-tray dark:border-hairline-dark dark:bg-tray-dark"
      style={{ width, height }}>
      {imageUri ? (
        <Image
          source={stableImageSource(imageUri)}
          recyclingKey={item.id}
          contentFit="cover"
          transition={180}
          cachePolicy="memory-disk"
          style={{ flex: 1 }}
          accessibilityIgnoresInvertColors
        />
      ) : (
        // No cutout yet — the norm in the Simulator, where subject lifting
        // cannot run. Considered, not broken.
        <View className="flex-1 items-center justify-center">
          <SymbolView name="tshirt" size={20} tintColor={theme.hairline} resizeMode="scaleAspectFit" />
        </View>
      )}
    </View>
  );
}

/**
 * A garment in one of the masthead rails — C-01's LATEST PIECES and
 * FAVOURITES. Pure presentation: the caller decides which garments qualify.
 */
function RailCardComponent({ item, variant, imageUri, onPress }: RailCardProps) {
  const press = usePressFeedback(Boolean(onPress));
  const neverWorn = item.wearCount === 0;
  const cpw = costPerWear(item);

  const a11yLabel = [
    pieceName(item),
    variant === 'latest'
      ? neverWorn
        ? 'never worn'
        : `worn ${item.wearCount} ${item.wearCount === 1 ? 'time' : 'times'}`
      : cpw !== null
        ? `$${cpw.toFixed(2)} per wear`
        : null,
  ]
    .filter(Boolean)
    .join(', ');

  if (variant === 'favourite') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        onPress={onPress ? () => onPress(item) : undefined}
        disabled={!onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        className="w-[74px]">
        <Animated.View style={press.style}>
          <Well item={item} imageUri={imageUri} width={74} height={74} />
          {/* 10pt muted, per the atlas. Favourites are earned by cost-per-wear,
              but the recency fallback can seat a piece here without a price —
              the wears line keeps the caption honest instead of blank. */}
          <Text variant="caption" numberOfLines={1} className="mt-[5px]" style={{ fontSize: 10 }}>
            {cpw !== null
              ? `$${cpw.toFixed(2)} / wear`
              : `${item.wearCount} ${item.wearCount === 1 ? 'wear' : 'wears'}`}
          </Text>
        </Animated.View>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      onPress={onPress ? () => onPress(item) : undefined}
      disabled={!onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      className="w-[92px]">
      <Animated.View style={press.style}>
        <Well item={item} imageUri={imageUri} width={92} height={110} />
        {/* Name 11/500 in ink — `caption` is 11pt/HelveticaNeue-Medium; only the
            colour changes, per the file-wide override convention. */}
        <Text variant="caption" numberOfLines={1} className="mt-[6px] text-ink dark:text-ink-dark">
          {pieceName(item)}
        </Text>
        {neverWorn ? (
          // The oxblood eyebrow — 10/500 tracked uppercase. The rail is where a
          // new piece first appears, so this is the accent's first chance to say
          // "wear it".
          <Text
            variant="colophon"
            numberOfLines={1}
            className="mt-[2px] text-accent dark:text-accent-dark"
            style={{ letterSpacing: 0.6 }}>
            Never worn
          </Text>
        ) : (
          <Text variant="caption" numberOfLines={1} className="mt-[2px]" style={{ fontSize: 10 }}>
            {`${item.wearCount} ${item.wearCount === 1 ? 'wear' : 'wears'}`}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

// Rails re-render with the masthead; a dozen memoized cards is cheap insurance.
export const RailCard = memo(RailCardComponent);
