import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import { useCloset } from '@/features/closet/queries';
import { useSignedUrls , stableImageSource } from '@/features/closet/use-image-urls';
import { costPerWear } from '@/schemas/item';
import { useTheme } from '@/theme/tokens';

/** Item detail — full stats and tag editing. Fleshed out in OUT-14. */
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

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark">
      <View className="flex-row items-center justify-between px-gutter pt-2">
        <Button title="Back" variant="ghost" onPress={() => router.back()} />
      </View>

      <ScrollView contentContainerClassName="px-gutter pb-24">
        <View className="mt-2 aspect-square w-full items-center justify-center overflow-hidden rounded-card bg-tray dark:bg-tray-dark">
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
        {item.description ? (
          <Text variant="body" className="mt-2 text-muted dark:text-muted-dark">
            {item.description}
          </Text>
        ) : null}

        <View className="mt-6 flex-row justify-between rounded-card border border-hairline p-5 dark:border-hairline-dark">
          <View>
            <Text variant="stat" className="text-figure">
              {item.wearCount}
            </Text>
            <Text variant="label">Wears</Text>
          </View>
          <View>
            <Text variant="stat" className="text-figure">
              {cpw !== null ? `$${cpw.toFixed(2)}` : '—'}
            </Text>
            <Text variant="label">Cost / wear</Text>
          </View>
          <View>
            <Text variant="stat" className="text-figure">
              {item.purchasePrice !== null ? `$${item.purchasePrice.toFixed(0)}` : '—'}
            </Text>
            <Text variant="label">Paid</Text>
          </View>
        </View>

        {item.occasions.length > 0 ? (
          <View className="mt-6">
            <Text variant="caption" className="mb-3">
              Occasions
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {item.occasions.map((o) => (
                <Chip key={o} label={o} selected />
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
