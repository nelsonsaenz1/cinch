import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PickerFooterTray, PiecePicker } from '@/components/share-look/piece-picker';
import { Text } from '@/components/ui/text';
import { canCompose } from '@/features/share-look/compose';
import { G5_CANDIDATES, G5_STACK_THREE } from '@/features/event-outfits/w3-g5-fixtures';
import type { Garment } from '@/lib/styling';

/**
 * SL-01 / AX — largest Dynamic Type: two columns, taller bar.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · The three-column grid becomes TWO so a garment name can be read without
 *   wrapping to three lines.
 * · The bar keeps its function by DROPPING THE THUMBNAIL STRIP and growing to
 *   138 pt (`SELECTION_BAR_HEIGHT_AX`) — "the count and the order statement
 *   carry the information the thumbnails carried". Compose grows to 56 pt.
 * · Selection numbers grow to 28 pt circles so they remain the SECOND CHANNEL
 *   at any type size. The outline is the first; neither is colour.
 * · A full extra grid row is still visible above the bar, which is the
 *   acceptance criterion.
 *
 * The `ax` flag is passed explicitly here so the frame renders its state
 * without the reviewer changing a system setting. In the shipping screen it is
 * read from `useWindowDimensions().fontScale` — the real setting — not from a
 * prop, so this fixture stages the layout, never the trigger.
 *
 * DETERMINISM: identical to SL-01's, plus the flag. No clock, no network.
 */
export default function DevW3G5SL01AX() {
  const [stack, setStack] = useState<Garment[]>([...G5_STACK_THREE]);
  const [refused, setRefused] = useState(false);

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="flex-row items-center justify-between px-gutter pt-2" style={{ minHeight: 44 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel">
          <Text variant="body" className="text-muted">
            Cancel
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Suggest">
          <Text variant="body">Suggest</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerClassName="px-gutter pb-4 pt-4">
        <PiecePicker
          candidates={G5_CANDIDATES}
          stack={stack}
          ax
          resolveImage={(...paths) => paths.find((p): p is string => Boolean(p))}
          onChangeStack={(next) => {
            setRefused(false);
            setStack(next);
          }}
          onRefused={() => setRefused(true)}
        />
      </ScrollView>

      <View className="px-gutter">
        <PickerFooterTray
          stack={stack}
          ax
          resolveImage={(...paths) => paths.find((p): p is string => Boolean(p))}
          canCompose={canCompose(stack)}
          refused={refused}
          onCompose={() => undefined}
        />
      </View>
    </SafeAreaView>
  );
}
