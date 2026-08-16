import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PickerFooterTray, PiecePicker } from '@/components/share-look/piece-picker';
import { Text } from '@/components/ui/text';
import { canCompose } from '@/features/share-look/compose';
import { G5_CANDIDATES, G5_STACK_THREE } from '@/features/event-outfits/w3-g5-fixtures';
import type { Garment } from '@/lib/styling';

/**
 * SL-01 — three selected, order explicit.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · audit 97 — the selection bar is 88 pt (`SELECTION_BAR_HEIGHT`), down from
 *   148, which leaves THREE FULL GRID ROWS on screen against an acceptance
 *   floor of one extra row. Nine candidates at three-up is exactly three rows,
 *   so the frame shows the whole grid above the bar.
 * · Selection carries an OUTLINE AND A NUMBER, so it survives greyscale and
 *   states the order at the same time. No colour-only state anywhere.
 * · correction 27 — the thumbnail strip is sized for the CEILING (`MAX_PIECES`
 *   thumbs at 36 pt) and never scrolls, and the bar's status line is where the
 *   count, the requirement and the refusal all live.
 * · The bar keeps its height and its shape at every count, so nothing jumps
 *   when the first piece is chosen or the last one removed.
 *
 * The picker is INTERACTIVE here on purpose: tapping a seventh piece is the
 * refusal state, and `dev-w3-g5-sl-02` draws the empty and failed ends. The
 * initial three are a frozen literal, so the frame opens identically every run.
 *
 * DETERMINISM: frozen candidates and a frozen initial stack. No clock, no
 * network, no spinner, no shimmer.
 */
export default function DevW3G5SL01() {
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
        <Text variant="colophon">Build a look</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Suggest">
          <Text variant="body">Suggest</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerClassName="px-gutter pb-4 pt-4">
        <PiecePicker
          candidates={G5_CANDIDATES}
          stack={stack}
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
          resolveImage={(...paths) => paths.find((p): p is string => Boolean(p))}
          canCompose={canCompose(stack)}
          refused={refused}
          onCompose={() => undefined}
        />
      </View>
    </SafeAreaView>
  );
}
