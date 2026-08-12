import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClosetGrid } from '@/components/closet/closet-grid';
import { C07_STORED } from '@/components/closet/w3-g3-fixture-data';
import { Text } from '@/components/ui/text';
import { storedMetaLine } from '@/features/closet/piece-meta';

/** Paths are already URIs in the fixture, so the resolver just picks the first. */
const resolve = (...paths: (string | null | undefined)[]) =>
  paths.find((p): p is string => typeof p === 'string' && p.length > 0);

/**
 * C-07 — stored pieces, at the active ceiling.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · "Capacity as fact, no tier named" — `12 stored · 148 of 150 active`, both
 *   figures printed, no price and no upgrade action anywhere on the frame.
 * · "Stored photo at 72% opacity" — and no contact shadow, which the garment
 *   card has never drawn, so that half is true by construction.
 * · "the tray states what is kept before what is withheld".
 * · The metadata line swaps cost-per-wear for what matters here.
 *
 * WHAT IT CANNOT SHOW, AND WHY
 *
 * The frame's line is `Stored in March · worn 7 times`. THE STORING DATE IS NOT
 * IN THE DATABASE: `items` records when a garment was filed and whether it is
 * archived, never when it was archived, and `created_at` is a different fact
 * that would print under the storing date's name. So the clause is omitted and
 * the half that is true is printed — see `storedMetaLine`.
 *
 * The stored CEILING is claim 6 and is not drawn anywhere: "What the screen
 * should say when the stored count also reaches its limit is not yet defined."
 *
 * DETERMINISM: the counts are the frame's literals rather than live queries — a
 * fixture that read `useCapacity` would draw a different sentence on every
 * account. The shipping screen derives the same line from the real counts and
 * omits the active half rather than guessing while they load.
 */
export default function DevW3G3C07() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="px-gutter pt-2">
        <Text variant="plate" trim accessibilityRole="header">
          Stored pieces
        </Text>
        <Text variant="note" className="mt-1">
          12 stored · 148 of 150 active
        </Text>
      </View>

      <View className="mx-gutter mt-4 rounded-md bg-tray px-4 py-3.5">
        <Text variant="label" className="text-ink">
          Stored pieces stay yours
        </Text>
        <Text variant="note" className="mt-1">
          They keep their photographs, wear history and price. They are not styled into outfits and
          do not count against your 150 active pieces.
        </Text>
      </View>

      <View className="mt-4 flex-1">
        <ClosetGrid items={C07_STORED} stored metaFor={storedMetaLine} resolveImage={resolve} />
      </View>

      <View className="border-t border-hairline bg-tray px-gutter pb-4 pt-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Activate a piece"
          style={{ minHeight: 48 }}
          className="items-center justify-center rounded-md border border-rule">
          <Text variant="body" className="text-ink" style={{ fontSize: 15 }}>
            Activate a piece
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
