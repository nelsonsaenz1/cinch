import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { stableImageSource } from '@/features/closet/use-image-urls';
import type { FriendItem } from '@/features/social-graph/types';
import { useTheme } from '@/theme/tokens';

export type FriendItemCardProps = {
  item: FriendItem;
  /** Signed URL for the thumb/cutout — storage paths are not URLs. */
  imageUri?: string;
  /** Fires only for borrowable items; the card itself withholds the affordance otherwise. */
  onAskToBorrow?: (item: FriendItem) => void;
};

/**
 * One garment in a friend's closet grid. Deliberately quieter than the owner's
 * own `ItemCard`: no wear counts, no cost-per-wear, no badges — none of that
 * data crosses the friend boundary (the `friend_items` view projects
 * presentation columns only), and the card must not imply otherwise.
 *
 * A not-for-lending piece still renders in full — it is part of the look of
 * her closet — it simply carries no ask. The server trigger is the enforcement;
 * this card is the courtesy.
 */
function FriendItemCardComponent({ item, imageUri, onAskToBorrow }: FriendItemCardProps) {
  const theme = useTheme();

  const a11yLabel = [
    item.subcategory ?? item.category,
    item.colors[0]?.name,
    item.brand,
    item.borrowable ? 'available to borrow' : 'not for lending',
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      accessibilityRole={item.borrowable ? 'button' : 'text'}
      accessibilityLabel={a11yLabel}
      accessibilityHint={item.borrowable ? 'Ask to borrow this piece' : undefined}
      onPress={item.borrowable ? () => onAskToBorrow?.(item) : undefined}
      disabled={!item.borrowable}
      // No width class: FlashList's two-column layout sizes the cell.
      className="p-1.5 active:opacity-80">
      <View className="aspect-[4/5] w-full overflow-hidden rounded-lg bg-tray">
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
          <View className="flex-1 items-center justify-center">
            <SymbolView
              name="tshirt"
              size={26}
              tintColor={theme.hairline}
              resizeMode="scaleAspectFit"
            />
          </View>
        )}
      </View>

      <View className="mt-2 px-0.5">
        <Text variant="label" numberOfLines={1} className="text-ink">
          {item.subcategory ?? item.category}
        </Text>
        <View className="mt-1 flex-row items-baseline justify-between">
          <Text variant="caption" numberOfLines={1} className="flex-1 text-muted">
            {[item.colors[0]?.name, item.brand].filter(Boolean).join(' · ') || item.category}
          </Text>
          {/* The borrow line: an invitation in the accent, or the quiet fact
              that there is none. Never a lock badge — it isn't a secret, it
              just isn't requestable. */}
          {item.borrowable ? (
            <Text variant="caption" className="text-accent">
              Ask to borrow
            </Text>
          ) : (
            <Text variant="colophon">Not for lending</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// Friend closets can be as deep as the owner's own; same memo, same reason.
export const FriendItemCard = memo(FriendItemCardComponent);
