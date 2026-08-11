import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { memo } from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { usePressFeedback } from '@/components/ui/use-press-feedback';
import { wearsLabel } from '@/features/closet/item-name';
import { stableImageSource } from '@/features/closet/use-image-urls';
import type { FriendItem } from '@/features/social-graph/types';
import { useTheme } from '@/theme/tokens';
import { MAX_DISPLAY_SCALE } from '@/theme/type-scale';

/**
 * What a friend's garment is CALLED — the same grammar as `pieceName` in
 * features/closet/item-name.ts (colour first, then the tagger's word,
 * capitalised), restated here because that function is typed to the owner's
 * full `Item` and the friend projection is deliberately narrower. Same three
 * fields, same fallback, so a garment reads identically in her closet and in
 * yours.
 */
export function friendPieceName(item: FriendItem): string {
  const kind = item.subcategory ?? (item.category === 'other' ? null : item.category);
  if (!kind) return 'Untagged item';
  const raw = [item.colors[0]?.name, kind].filter(Boolean).join(' ');
  if (!raw) return 'Untagged item';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export type FriendItemCardProps = {
  item: FriendItem;
  /** Signed URL for the thumb/cutout — storage paths are not URLs. */
  imageUri?: string;
  /** Opens the FC-03 sheet. Every card opens; the sheet says whether to ask. */
  onPress?: (item: FriendItem) => void;
};

/**
 * One garment in a friend's closet grid — FC-01, same grammar as the owner's
 * own C-01 card: 196pt well, 12pt radius, hairline border, 13/600 name at 7pt,
 * caption at 3pt. Nothing about the card announces that it belongs to someone
 * else except what is missing — no cost per wear (what she paid is hers; the
 * wear count stays because it is the part of the number that is about wearing
 * rather than spending), no needs-review, no selection.
 *
 * BORROWABLE is the one badge and the only oxblood in the grid — her mark, set
 * per piece in her own Closet. A not-for-lending piece renders in full; the
 * refusal lives in the sheet, not on the card.
 */
function FriendItemCardComponent({ item, imageUri, onPress }: FriendItemCardProps) {
  const theme = useTheme();
  const press = usePressFeedback();

  const a11yLabel = [
    friendPieceName(item),
    wearsLabel(item.wearCount),
    item.borrowable ? 'available to borrow' : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint="Opens this piece"
      onPress={() => onPress?.(item)}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      // No width class: FlashList's two-column layout sizes the cell.
      // px-1.5 both sides = the atlas's 12pt column gap; pb-2.5 = its 14pt
      // row gap, exactly as item-card.tsx sets them.
      className="px-1.5 pb-2.5">
      <Animated.View style={press.style}>
        <View className="h-[196px] w-full overflow-hidden rounded-md border border-hairline bg-tray">
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
            <View className="flex-1 items-center justify-center">
              <SymbolView
                name="tshirt"
                size={26}
                tintColor={theme.hairline}
                resizeMode="scaleAspectFit"
              />
            </View>
          )}

          {/* 9/600 tracked uppercase on the accent, 8pt in — the same badge
              build as the owner's never-worn badge, because it is the same
              object: one small flag in the well's corner. */}
          {item.borrowable ? (
            <View className="absolute left-2 top-2 rounded-sm bg-accent px-[7px] py-[3px]">
              <Text
                variant="colophon"
                numberOfLines={1}
                maxFontSizeMultiplier={MAX_DISPLAY_SCALE}
                style={{ color: theme.canvas, fontSize: 9, letterSpacing: 1.1, lineHeight: 12 }}>
                Borrowable
              </Text>
            </View>
          ) : null}
        </View>

        <View className="mt-[7px]">
          <Text variant="label" numberOfLines={1} className="text-ink">
            {friendPieceName(item)}
          </Text>
          <Text variant="caption" numberOfLines={1} className="mt-[3px]">
            {wearsLabel(item.wearCount)}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

// Friend closets can be as deep as the owner's own; same memo, same reason.
export const FriendItemCard = memo(FriendItemCardComponent);
