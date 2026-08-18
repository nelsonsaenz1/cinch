import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CapacityBand } from '@/components/closet/capacity-band';
import { AX_FONT_SCALE } from '@/components/today/reaction-spec';
import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import type { Plan } from '@/features/billing/plans';
import {
  CLOSET_COPY,
  FAB_BOTTOM,
  FAB_RIGHT,
  FAB_SIZE,
  capacityState,
  mastheadCounts,
  selectAllLabel,
  selectionCountLabel,
  selectionNote,
} from '@/features/closet/closet-spec';
import { useTheme } from '@/theme/tokens';

/**
 * DEV ONLY · Redesign 14 — the closet's capacity, chips and selection states.
 *
 * Deep-linkable — `cinch:///dev-r14-closet?pose=total-full`. Not a
 * convenience: `simctl` opens URLs and cannot tap, so a state that only a
 * finger can reach has no reproducible evidence.
 *
 * ── WHAT THIS FIXTURE COVERS, AND WHAT IT DOES NOT ──────────────────────────
 *
 * It draws the parts of the accepted atlas that are DECISIONS: the three
 * plans' ceilings, the two different capacity walls with their two different
 * remedies, the chip row with query-aware counts, and the selection header at
 * one, many and all. Those are the frames whose correctness is a matter of
 * which sentence and which door, and a still can settle them.
 *
 * It deliberately does NOT restage the grid, the rails or the mutation sheets
 * with fabricated garments. Those are the reader's own pieces on the real
 * route, and a fixture that invented eighty-four of them would be checking the
 * fixture. They are photographed on the shipping screen instead.
 */

type Pose =
  | 'free-nine'
  | 'free-full'
  | 'standard'
  | 'pro'
  | 'active-full-room'
  | 'total-full'
  | 'chips'
  | 'selection-one'
  | 'selection-many'
  | 'selection-all'
  | 'empty';

const POSES: readonly Pose[] = [
  'free-nine',
  'free-full',
  'standard',
  'pro',
  'active-full-room',
  'total-full',
  'chips',
  'selection-one',
  'selection-many',
  'selection-all',
  'empty',
];

/** Plan, active, activeLimit, archived, total, storedLimit — the server's own shape. */
const BANDS: Partial<Record<Pose, [Plan, string, number, number, number, number, number]>> = {
  'free-nine': ['free', 'Free', 9, 10, 2, 11, 30],
  'free-full': ['free', 'Free', 10, 10, 4, 14, 30],
  standard: ['standard', 'Standard', 84, 150, 26, 110, 450],
  pro: ['pro', 'Pro', 312, 1000, 168, 480, 3000],
  'active-full-room': ['standard', 'Standard', 150, 150, 96, 246, 450],
  'total-full': ['standard', 'Standard', 150, 150, 300, 450, 450],
};

const CHIPS: [string, number][] = [
  ['All', 84],
  ['Dresses', 14],
  ['Tops', 22],
  ['Shoes', 11],
  ['Coats', 9],
  ['Knitwear', 7],
  ['Bags', 5],
];

const SELECTION: Partial<Record<Pose, [number, number]>> = {
  'selection-one': [1, 9],
  'selection-many': [3, 9],
  'selection-all': [9, 9],
};

export default function DevR14Closet() {
  const params = useLocalSearchParams<{ pose?: string }>();
  const linked = (POSES as readonly string[]).includes(params.pose ?? '')
    ? (params.pose as Pose)
    : 'standard';

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

  const band = BANDS[pose];
  const selection = SELECTION[pose];

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="pb-40">
        <View className="px-gutter pt-4">
          <Text variant="eyebrow">Redesign 14 · Closet</Text>
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

        {selection ? (
          <View style={{ paddingTop: 24 }}>
            <View className="flex-row items-center justify-between px-gutter" style={{ minHeight: 34 }}>
              <Text variant="label" style={{ color: theme.accent, fontSize: 15 }}>
                {CLOSET_COPY.cancel}
              </Text>
              <Text variant="label" className="text-ink" style={{ fontSize: 15 }}>
                {selectionCountLabel(selection[0])}
              </Text>
              <Text variant="label" style={{ color: theme.accent, fontSize: 15 }}>
                {selectAllLabel(selection[0], selection[1])}
              </Text>
            </View>
            <Text variant="note" className="mt-6 px-gutter text-muted">
              {selectionNote(selection[0], selection[1])}
            </Text>
          </View>
        ) : null}

        {pose === 'empty' ? (
          <View className="px-gutter" style={{ paddingTop: 60 }}>
            <Text variant="title" trim>
              {CLOSET_COPY.emptyTitle}
            </Text>
            <Text variant="body" className="mt-4 text-muted">
              {CLOSET_COPY.emptyBody}
            </Text>
          </View>
        ) : null}

        {band ? (
          <View style={{ paddingTop: 24 }}>
            <View className="px-gutter">
              <Text variant="wordmark" trim style={{ fontSize: ax ? 38 : 32 }}>
                {CLOSET_COPY.title}
              </Text>
              <Text variant="note" className="mt-1">
                {mastheadCounts(band[2], band[4])}
              </Text>
            </View>
            <View className="px-gutter" style={{ paddingTop: 14 }}>
              <CapacityBand
                plan={band[0]}
                planName={band[1]}
                active={band[2]}
                activeLimit={band[3]}
                archived={band[4]}
                total={band[5]}
                storedLimit={band[6]}
                state={capacityState({
                  active: band[2],
                  activeLimit: band[3],
                  stored: band[5],
                  storedLimit: band[6],
                })}
                large={ax}
                onDoor={() => {}}
              />
            </View>
          </View>
        ) : null}

        {pose === 'chips' || band ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingVertical: 12, alignItems: 'center' }}>
            {CHIPS.map(([label, count]) => (
              <Chip
                key={label}
                label={label}
                count={count}
                selected={label === 'All'}
                selectedGround="ink"
                onPress={() => {}}
              />
            ))}
          </ScrollView>
        ) : null}
      </ScrollView>

      {/* The add control, at its shipping measures — never disabled, and clear
          of where the tab bar would be. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={CLOSET_COPY.addPiece}
        onPress={() => {}}
        className="absolute items-center justify-center bg-accent"
        style={{
          right: FAB_RIGHT,
          bottom: FAB_BOTTOM,
          width: FAB_SIZE,
          height: FAB_SIZE,
          borderRadius: FAB_SIZE / 2,
        }}>
        <Text
          variant="label"
          allowFontScaling={false}
          style={{ color: theme.canvas, fontSize: 26 }}>
          +
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}
