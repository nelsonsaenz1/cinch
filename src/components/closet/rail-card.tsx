import { SymbolView } from 'expo-symbols';
import { memo } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { GarmentImage } from '@/components/media/garment-image';
import { AX_FONT_SCALE } from '@/components/today/reaction-spec';
import { Text } from '@/components/ui/text';
import { usePressFeedback } from '@/components/ui/use-press-feedback';
import { pieceName } from '@/features/closet/item-name';
import { type Item, costPerWear } from '@/schemas/item';
import { useTheme } from '@/theme/tokens';

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
  const theme = useTheme();
  return (
    <View
      className="overflow-hidden rounded-md border border-hairline bg-tray"
      style={{ width, height }}>
      {/* No cutout yet is the norm in the Simulator, where subject lifting
          cannot run; an expired signature and a body that will not decode land
          on the same considered mark (UX-06), never on an empty well. */}
      <GarmentImage
        uri={imageUri}
        recyclingKey={item.id}
        contentFit="cover"
        transition={180}
        fallback={
          <SymbolView name="tshirt" size={20} tintColor={theme.hairline} resizeMode="scaleAspectFit" />
        }
      />
    </View>
  );
}

/**
 * A garment in one of the masthead rails — C-01's LATEST PIECES and
 * FAVOURITES. Pure presentation: the caller decides which garments qualify.
 */
/**
 * Directive #35, "Closet's chips and content clip".
 *
 * Every caption on this card is `numberOfLines={1}` inside a 74 or 92 pt
 * column. At the standard sizes that is a tidy default — "$3.19 / wear" and
 * most garment names fit. At the accessibility sizes it is a truncation, and
 * the name line is the only place the rail prints what the piece IS: at 1.8×
 * a 92 pt column holds about six characters, so LATEST PIECES becomes a row of
 * photographs captioned "Charc…", "Navy …", "Black…".
 *
 * So above the threshold the card widens and the captions wrap. The well grows
 * with it — a 92 pt photograph under a 160 pt caption reads as a mistake — and
 * the rail simply shows fewer cards per screen, which is the trade every
 * horizontal rail makes at large type and the only one that keeps the words.
 */
const AX_LATEST_WIDTH = 160;
const AX_LATEST_WELL_HEIGHT = 190;
const AX_MOST_WORN_WIDTH = 128;

function RailCardComponent({ item, variant, imageUri, onPress }: RailCardProps) {
  const press = usePressFeedback(Boolean(onPress));
  const { fontScale } = useWindowDimensions();
  const ax = fontScale >= AX_FONT_SCALE;
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
        className={ax ? undefined : 'w-[74px]'}
        style={ax ? { width: AX_MOST_WORN_WIDTH } : undefined}>
        <Animated.View style={press.style}>
          <Well
            item={item}
            imageUri={imageUri}
            width={ax ? AX_MOST_WORN_WIDTH : 74}
            height={ax ? AX_MOST_WORN_WIDTH : 74}
          />
          {/* 10pt muted, per the atlas. A piece can earn this rail on wears
              alone, with no price to divide by — the wears line keeps the
              caption honest instead of blank. */}
          <Text
            variant="caption"
            numberOfLines={ax ? 2 : 1}
            className="mt-[5px]"
            style={{ fontSize: 10 }}>
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
      className={ax ? undefined : 'w-[92px]'}
      style={ax ? { width: AX_LATEST_WIDTH } : undefined}>
      <Animated.View style={press.style}>
        <Well
          item={item}
          imageUri={imageUri}
          width={ax ? AX_LATEST_WIDTH : 92}
          height={ax ? AX_LATEST_WELL_HEIGHT : 110}
        />
        {/* Name 11/500 in ink — `caption` is 11pt/HelveticaNeue-Medium; only the
            colour changes, per the file-wide override convention. */}
        <Text variant="caption" numberOfLines={ax ? 3 : 1} className="mt-[6px] text-ink">
          {pieceName(item)}
        </Text>
        {neverWorn ? (
          // The oxblood eyebrow — 10/500 tracked uppercase. The rail is where a
          // new piece first appears, so this is the accent's first chance to say
          // "wear it".
          <Text
            variant="colophon"
            numberOfLines={ax ? 2 : 1}
            className="mt-[2px] text-accent"
            style={{ letterSpacing: 0.6 }}>
            Never worn
          </Text>
        ) : (
          <Text
            variant="caption"
            numberOfLines={ax ? 2 : 1}
            className="mt-[2px]"
            style={{ fontSize: 10 }}>
            {`${item.wearCount} ${item.wearCount === 1 ? 'wear' : 'wears'}`}
          </Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

// Rails re-render with the masthead; a dozen memoized cards is cheap insurance.
export const RailCard = memo(RailCardComponent);
