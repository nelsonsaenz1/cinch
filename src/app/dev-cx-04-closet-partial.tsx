import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClosetGrid } from '@/components/closet/closet-grid';
import { ExampleCloset } from '@/components/closet/example-closet';
import { C01_PIECES, C08_PIECES } from '@/components/closet/w3-g3-fixture-data';
import { Text } from '@/components/ui/text';
import { PLANS } from '@/features/billing/plans';

/** Paths are already URIs in the fixture, so the resolver just picks the first. */
const resolve = (...paths: (string | null | undefined)[]) =>
  paths.find((p): p is string => typeof p === 'string' && p.length > 0);

/**
 * CX-04 — a closet under way, with the example preview below it.
 *
 * EIGHT PIECES, and eight is chosen rather than convenient: it is the exact
 * count where the two thresholds disagree. `MIN_CLOSET_FOR_OUTFITS` is 8, so
 * Today is already styling this person; `PLANS.free.items` is 10, so the
 * example is still showing. Both are true, and this frame is the evidence that
 * the correction kept them apart rather than reconciling one away.
 *
 * What this frame is evidence for:
 *
 * · the owned grid is FIRST and interactive, exactly as it is at forty pieces;
 * · the example sits BELOW it as a list footer — never a row inside the grid,
 *   never a cell mixed among owned pieces;
 * · the preview's geometry is unmistakably different: four across at 76pt
 *   against the real card's two across at 196;
 * · the progress line reads "Add 2 more pieces", counted from the free ten.
 *
 * DETERMINISM: the eight pieces are literals in `w3-g3-fixture-data`, their
 * photographs are the repo's own licensed set, and nothing here reads a clock,
 * a random source or a network.
 */
const EIGHT = [...C01_PIECES, ...C08_PIECES];

export default function DevCx04ClosetPartial() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  const remaining = PLANS.free.items - EIGHT.length;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ClosetGrid
        items={EIGHT}
        onItemPress={() => {}}
        onItemLongPress={() => {}}
        selectedIds={null}
        resolveImage={resolve}
        ListHeaderComponent={
          <View className="px-gutter pb-3 pt-2">
            <Text variant="eyebrow">Your closet</Text>
            <Text variant="note" className="mt-1">
              {`${EIGHT.length} of ${PLANS.free.items} pieces`}
            </Text>
          </View>
        }
        ListFooterComponent={
          <View className="pt-8">
            <ExampleCloset variant="compact" remaining={remaining} />
          </View>
        }
      />
    </SafeAreaView>
  );
}
