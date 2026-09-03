import { memo } from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { GarmentImage } from '@/components/media/garment-image';
import { GarmentSwatch } from '@/components/media/garment-swatch';
import { Text } from '@/components/ui/text';
import { usePressFeedback } from '@/components/ui/use-press-feedback';
import { pieceName } from '@/features/closet/item-name';
import { type Item, costPerWear } from '@/schemas/item';

export type RailCardProps = {
  item: Item;
  /**
   * `latest` — the 92×110 card of the LATEST PIECES rail: name below the well,
   * then a wears line (or NEVER WORN in the accent).
   * `mostWorn` — the 74×74 card of the MOST WORN rail: just the garment and its
   * cost-per-wear.
   *
   * This variant was called `favourite` until UX-02. Nothing about the rail
   * changed — it was always `mostWornItems`, ranked by wear count — but calling
   * wear data a favourite claimed a nomination the reader never made and a
   * flag the schema does not have. The name now says what the derivation does.
   */
  variant: 'latest' | 'mostWorn';
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
  return (
    <View
      className="overflow-hidden rounded-md border border-hairline bg-tray"
      style={{ width, height }}>
      {/* No cutout yet is the norm in the Simulator, where subject lifting
          cannot run; an expired signature and a body that will not decode land
          on the same considered mark (UX-06), never on an empty well.

          AUDIT 2026-09-02 · 62. That mark used to be a hairline `tshirt` glyph,
          which is a hanger in every well: a rail of six of them says only that
          six pieces exist. The shared swatch says WHICH six — the garment's own
          colour where the row carries a hex, and its name either way. The
          `mostWorn` card is 74pt square and drops the caption, because 11pt
          type in a 74pt box wraps to nothing legible. */}
      <GarmentImage
        uri={imageUri}
        recyclingKey={item.id}
        contentFit="cover"
        transition={180}
        fallback={
          <GarmentSwatch
            label={pieceName(item)}
            hex={item.colors[0]?.hex}
            showLabel={width >= 88}
          />
        }
      />
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

  if (variant === 'mostWorn') {
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
          {/* 10pt muted, per the atlas. A piece can earn this rail on wears
              alone, with no price to divide by — the wears line keeps the
              caption honest instead of blank. */}
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
        <Text variant="caption" numberOfLines={1} className="mt-[6px] text-ink">
          {pieceName(item)}
        </Text>
        {neverWorn ? (
          // The oxblood eyebrow — 10/500 tracked uppercase. The rail is where a
          // new piece first appears, so this is the accent's first chance to say
          // "wear it".
          <Text
            variant="colophon"
            numberOfLines={1}
            className="mt-[2px] text-accent"
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
