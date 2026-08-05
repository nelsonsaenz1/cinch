import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { stableImageSource } from '@/features/closet/use-image-urls';

export type CategoryTileProps = {
  label: string;
  count: number;
  selected: boolean;
  onPress: () => void;
  /** Up to four signed thumbnails, newest first. */
  previews: string[];
  /** Side length in points — the caller derives it so a row divides exactly. */
  size: number;
};

/**
 * One category of the closet, as a square.
 *
 * The shape is doing real work. A row of text chips gives every category the
 * same weight and shows nothing of what is inside; a board of squares is how
 * Pinterest and Instagram both let you recognise a collection before reading
 * its name — you see the clothes, not the word "Outerwear". The tile is split
 * rather than overlaid because a label sitting on top of arbitrary garment
 * photographs is legible only until someone photographs a white shirt.
 *
 * The preview is a 2×2 of the most recent pieces, which is deliberately a
 * board cover and not a hero image: one cutout would imply that item is the
 * category, and would flicker to a different garment every time the newest
 * upload changed.
 */
export function CategoryTile({
  label,
  count,
  selected,
  onPress,
  previews,
  size,
}: CategoryTileProps) {
  // The tray strip has to clear two lines of type at accessibility sizes
  // without eating the whole tile, so it is a fixed measure rather than a
  // fraction of the square.
  const captionH = 46;
  const artH = size - captionH;
  const shown = previews.slice(0, 4);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${count} ${count === 1 ? 'piece' : 'pieces'}`}
      accessibilityHint={`Show only ${label}`}
      accessibilityState={{ selected }}
      style={{ width: size }}
      className="active:opacity-80">
      <View
        style={{ height: size }}
        className={
          // The selected tile is named by an ink border rather than an accent
          // fill: the accent is spent on the primary action, and a filled tile
          // would out-shout the garments it is meant to be showing.
          `overflow-hidden rounded-plate ${
            selected
              ? 'border-2 border-ink bg-sand dark:border-ink-dark dark:bg-sand-dark'
              : 'border border-hairline bg-tray dark:border-hairline-dark dark:bg-tray-dark'
          }`
        }>
        <View style={{ height: artH }} className="flex-row flex-wrap">
          {shown.length > 0 ? (
            shown.map((uri, i) => (
              <View
                key={`${uri}-${i}`}
                style={{
                  // One image fills the frame; two split it; three or four make
                  // the quarter grid.
                  width: shown.length === 1 ? '100%' : '50%',
                  height: shown.length <= 2 ? '100%' : '50%',
                }}>
                <Image
                  source={stableImageSource(uri)}
                  // Contain, matching the item cards below. `cover` fills the
                  // quadrant more handsomely but crops, and a wardrobe tile
                  // that amputates the garment it is advertising is worse than
                  // one with tray showing around it.
                  contentFit="contain"
                  transition={150}
                  cachePolicy="memory-disk"
                  style={{ width: '100%', height: '100%' }}
                  accessibilityIgnoresInvertColors
                />
              </View>
            ))
          ) : (
            <View className="flex-1 items-center justify-center">
              <Text variant="colophon" className="text-muted dark:text-muted-dark">
                Empty
              </Text>
            </View>
          )}
        </View>

        <View
          style={{ height: captionH }}
          className="justify-center border-t border-rule px-2.5 dark:border-rule-dark">
          <Text variant="label" numberOfLines={1} className="text-ink dark:text-ink-dark">
            {label}
          </Text>
          <Text variant="colophon" className="text-muted dark:text-muted-dark">
            {count}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
