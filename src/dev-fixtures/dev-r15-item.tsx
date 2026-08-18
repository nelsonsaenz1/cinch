import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ItemStats } from '@/components/item/item-stats';
import { AX_FONT_SCALE } from '@/components/today/reaction-spec';
import { Text } from '@/components/ui/text';
import { WearsWellWith, type RailPiece } from '@/components/item/wears-well-with';
import {
  DELETE_FAILURE_COPY,
  ITEM_COPY,
  LENDING_FAILURE,
  LENDING_PRIVATE_NOTE,
  costPerWearValue,
  railMode,
  deleteConsequence,
  heroHeight,
  priceCell,
  storeConsequence,
} from '@/features/item/item-spec';
import { useTheme } from '@/theme/tokens';

/**
 * DEV ONLY · Redesign 15 — item detail's decision states.
 *
 * Deep-linkable — `cinch:///dev-r15-item?pose=unpriced-worn`. Not a
 * convenience: `simctl` opens URLs and cannot tap, so a state that only a
 * finger can reach has no reproducible evidence.
 *
 * ── WHAT THIS COVERS, AND WHAT IT DELIBERATELY DOES NOT ─────────────────────
 *
 * The frames whose correctness is a matter of WHICH CELL EXISTS and WHICH
 * SENTENCE IS SAID: the four price/wear combinations, the three pairing modes,
 * the destructive consequences, and the lending refusal. A still settles all
 * of those.
 *
 * It draws no photographs at all. Every image on the real screen is a private
 * signed URL for the reader's own garment, and a fixture that fabricated one
 * would be checking the fixture — so the rail tiles here take the same neutral
 * fallback a missing, expired or unauthorized image takes, which is also the
 * accepted missing-image frame.
 */

type Pose =
  | 'priced-worn'
  | 'unpriced-worn'
  | 'priced-never-worn'
  | 'unpriced-never-worn'
  | 'co-wear-rail'
  | 'harmony-rail'
  | 'no-pairing'
  | 'store-confirm'
  | 'delete-confirm'
  | 'delete-failure'
  | 'lending-error';

const POSES: readonly Pose[] = [
  'priced-worn',
  'unpriced-worn',
  'priced-never-worn',
  'unpriced-never-worn',
  'co-wear-rail',
  'harmony-rail',
  'no-pairing',
  'store-confirm',
  'delete-confirm',
  'delete-failure',
  'lending-error',
];

/** price, wears — the four combinations the band has to tell apart. */
const STATS: Partial<Record<Pose, [number | null, number]>> = {
  'priced-worn': [168, 14],
  'unpriced-worn': [null, 14],
  'priced-never-worn': [240, 0],
  'unpriced-never-worn': [null, 0],
};

const tile = (id: string, name: string, coWearCount?: number): RailPiece => ({
  id,
  name,
  imageUri: null,
  coWearCount,
});

const CO_WEAR: RailPiece[] = [
  tile('a', 'Charcoal skirt', 6),
  tile('b', 'Black boots', 4),
  tile('c', 'Linen shirt', 2),
];

const HARMONY: RailPiece[] = [tile('d', 'Cream knit'), tile('e', 'Navy trousers')];

export default function DevR15Item() {
  const params = useLocalSearchParams<{ pose?: string }>();
  const linked = (POSES as readonly string[]).includes(params.pose ?? '')
    ? (params.pose as Pose)
    : 'priced-worn';

  // The URL is the source of truth; a tap is an override the URL clears.
  // expo-router does not remount a screen when only the query string changes.
  const [pose, setPose] = useState<Pose>(linked);
  const [seenLink, setSeenLink] = useState(linked);
  if (linked !== seenLink) {
    setSeenLink(linked);
    setPose(linked);
  }

  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const ax = fontScale >= AX_FONT_SCALE;

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  const stats = STATS[pose];
  const pieces =
    pose === 'co-wear-rail' ? CO_WEAR : pose === 'harmony-rail' ? HARMONY : pose === 'no-pairing' ? [] : null;
  // Derived through the policy rather than branched here, so the fixture and
  // the shipping screen agree about which claim the heading is making.
  const mode = railMode(pose === 'co-wear-rail' ? CO_WEAR.length : 0, HARMONY.length);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="pb-24">
        <View className="px-gutter pt-4">
          <Text variant="eyebrow">Redesign 15 · Item detail</Text>
          <View className="mt-2 flex-row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {POSES.map((p) => (
              <Pressable
                key={p}
                accessibilityRole="button"
                accessibilityLabel={p}
                onPress={() => setPose(p)}
                style={{ minHeight: 44, justifyContent: 'center' }}
                className={p === pose ? 'rounded-md bg-sand px-3' : 'rounded-md bg-tray px-3'}>
                <Text variant="label">{p}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {stats ? (
          <View style={{ paddingTop: 20 }}>
            {/* The hero's well, at its shipping height and with no image —
                which is exactly the accepted missing-image frame. */}
            <View
              className="mx-gutter bg-sand"
              style={{ height: heroHeight(ax), borderRadius: 18 }}
              accessible
              accessibilityRole="image"
              accessibilityLabel="Camel wool coat"
            />
            <View className="mt-4 px-gutter">
              <Text variant="plate" trim style={{ fontSize: ax ? 34 : 30 }}>
                Camel wool coat
              </Text>
              <Text variant="eyebrow" className="mt-1">
                OUTERWEAR · CAMEL
              </Text>
            </View>

            <View className="mt-5">
              <ItemStats
                wears={stats[1]}
                costPerWear={
                  priceCell(stats[0], stats[1]) === null
                    ? null
                    : stats[1] > 0
                      ? `$${costPerWearValue(stats[0], stats[1])!.toFixed(2)}`
                      : `$${stats[0]!.toFixed(2)}`
                }
                sinceLast={stats[1] > 0 ? '31 Aug' : null}
                neverWorn={stats[1] === 0}
                stacked={ax}
              />
            </View>

            {/* The prompt — the ONLY route to a price, because Cinch never
                estimates one. */}
            {stats[0] === null ? (
              <View className="mt-5 px-gutter">
                <Text variant="label">{ITEM_COPY.noPriceTitle}</Text>
                <Text variant="note" className="mt-1.5">
                  {ITEM_COPY.noPriceBody}
                </Text>
                <Text variant="label" className="mt-3" style={{ color: theme.accent }}>
                  {ITEM_COPY.addPrice}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {pieces !== null ? (
          <View style={{ paddingTop: 24 }}>
            {/* `none` is the rail's own empty branch, so the component takes
                the surviving two and decides the no-data state itself. */}
            <WearsWellWith
              pieces={pieces}
              mode={mode === 'harmony' ? 'harmony' : 'coWear'}
              onPressPiece={() => {}}
            />
          </View>
        ) : null}

        {pose === 'store-confirm' || pose === 'delete-confirm' ? (
          <View className="px-gutter" style={{ paddingTop: 28 }}>
            <Text variant="title" trim>
              Out of rotation, or gone?
            </Text>
            <Text variant="note" className="mt-3">
              {storeConsequence(14)} {deleteConsequence(14)}
            </Text>
          </View>
        ) : null}

        {pose === 'delete-failure' ? (
          <View className="px-gutter" style={{ paddingTop: 28 }}>
            <Text variant="title" trim>
              {DELETE_FAILURE_COPY.title}
            </Text>
            <Text variant="note" className="mt-3">
              {DELETE_FAILURE_COPY.body}
            </Text>
          </View>
        ) : null}

        {pose === 'lending-error' ? (
          <View className="px-gutter" style={{ paddingTop: 28 }}>
            <Text variant="label">Lending</Text>
            <Text variant="note" className="mt-1.5">
              {LENDING_PRIVATE_NOTE}
            </Text>
            <Text variant="note" className="mt-4" style={{ color: theme.critical }}>
              {LENDING_FAILURE}
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
