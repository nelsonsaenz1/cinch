import { useRouter } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { QuadrantPlate } from '@/components/boards/quadrant-plate';
import { Text } from '@/components/ui/text';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import {
  useFavoriteOutfits,
  useUnfavoriteOutfit,
} from '@/features/styling/use-favorite-outfits';
import { GUTTER, useTheme } from '@/theme/tokens';

const CARD_WIDTH = 164;

function wornDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
    new Date(value),
  );
}

export function FavoriteOutfitsRail() {
  const router = useRouter();
  const theme = useTheme();
  const favorites = useFavoriteOutfits();
  const unfavorite = useUnfavoriteOutfit();
  const paths = (favorites.data ?? []).flatMap((outfit) => outfit.imagePaths);
  const { resolve } = useSignedUrls(paths);

  if (!favorites.data?.length) return null;

  return (
    <View className="pt-8">
      <View className="flex-row items-end justify-between px-gutter">
        <View>
          <Text variant="eyebrow">FAVORITE OUTFITS</Text>
          <Text variant="note" className="mt-1">
            Private to you
          </Text>
        </View>
        <Text variant="caption">{favorites.data.length}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 14, paddingHorizontal: GUTTER, paddingTop: 12 }}>
        {favorites.data.map((outfit) => (
          <View
            key={outfit.id}
            style={{ width: CARD_WIDTH }}
            className="overflow-hidden rounded-lg border border-rule bg-surface">
            <Pressable
              onPress={() => router.push(`/diary/${outfit.id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${outfit.name}, ${outfit.itemIds.length} pieces`}>
              <QuadrantPlate
                size={CARD_WIDTH}
                pieceCount={outfit.itemIds.length}
                imageUris={outfit.imagePaths.map((path) => resolve(path ?? undefined))}
              />
              <View className="px-3 pb-2 pt-2.5">
                <Text variant="note" numberOfLines={1} style={{ color: theme.ink }}>
                  {outfit.name}
                </Text>
                <Text variant="caption" className="mt-1">
                  Worn {wornDate(outfit.wornAt)}
                </Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() => unfavorite.mutate(outfit.id)}
              disabled={unfavorite.isPending}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${outfit.name} from favorites`}
              className="min-h-11 justify-center border-t border-rule px-3 active:opacity-60">
              <Text variant="caption" style={{ color: theme.accent }}>
                Remove
              </Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
