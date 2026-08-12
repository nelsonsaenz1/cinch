import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClosetGrid } from '@/components/closet/closet-grid';
import { C01_PIECES } from '@/components/closet/w3-g3-fixture-data';
import { Text } from '@/components/ui/text';

const resolve = (...paths: (string | null | undefined)[]) =>
  paths.find((p): p is string => typeof p === 'string' && p.length > 0);

/** The sweater and the blouse — the two the frame picks. Frozen, not derived. */
const PICKED = new Set([C01_PIECES[0].id, C01_PIECES[2].id]);

/**
 * C-04 — multi-select, two pieces picked.
 *
 * The frame's point is that "selection is carried on three channels — a 2.5 pt
 * outline, a filled tick, and the metadata line replaced by the word Selected —
 * so it survives greyscale and a colour-blind reading." A reviewer should be
 * able to turn this capture to greyscale and still say which two are chosen.
 *
 * The count is the title, not a badge, and the tray states the consequence
 * before its buttons: storing is a move, and reversible, which is why the
 * destructive word is absent.
 */
export default function DevW3G3C04() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="flex-row items-center justify-between px-gutter pt-2">
        <Text variant="label" className="text-accent">
          Done
        </Text>
        <Text variant="label" className="text-ink">
          2 selected
        </Text>
        <Text variant="label" className="text-accent">
          Select all
        </Text>
      </View>
      <View className="mt-2 flex-1">
        <ClosetGrid items={C01_PIECES} resolveImage={resolve} selectedIds={PICKED} />
      </View>
      <View className="border-t border-hairline px-gutter pb-6 pt-3">
        <Text variant="note">
          Removing puts a piece in stored, not out of Cinch. Nothing is deleted from this row.
        </Text>
      </View>
    </SafeAreaView>
  );
}
