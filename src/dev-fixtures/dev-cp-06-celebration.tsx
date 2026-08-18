/**
 * CP-06 fixture — redesign 22, frame 10: the settled celebration.
 *
 * "The exact direction: '10 pieces in'." The whole page is the accent, which is
 * the one place in the app that is true, and the number is the CLOSET's rather
 * than the batch's — the sentence is a claim about what the user now owns.
 *
 * `celebrationFor` is what decides this fires at all, and it refuses three
 * ways: nothing still filing, nothing unresolved, and a genuine CROSSING of the
 * threshold rather than a batch settling on a closet that was already large.
 * Posed here at the moment of the crossing.
 */

import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { PageActions } from '@/components/ingest/capture-parts';
import {
  CELEBRATION_AT,
  CELEBRATION_BODY,
  CELEBRATION_CTA,
  CELEBRATION_SECONDARY,
  PAGE,
  celebrationFor,
  celebrationTitle,
} from '@/features/ingest/capture-spec';
import { canvasAlpha, useTheme } from '@/theme/tokens';

export default function DevCp06CelebrationScreen() {
  const theme = useTheme();
  const count =
    celebrationFor({
      settled: true,
      unresolved: 0,
      closetCount: CELEBRATION_AT,
      closetBefore: CELEBRATION_AT - 6,
    }) ?? CELEBRATION_AT;

  return (
    <SafeAreaView
      edges={['top', 'left', 'right', 'bottom']}
      className="flex-1"
      style={{ backgroundColor: theme.accent }}>
      <View className="flex-1 pb-2">
        <View
          className="flex-row flex-wrap px-gutter pt-5"
          style={{ gap: PAGE.celebrationTileGap }}>
          {Array.from({ length: CELEBRATION_AT }).map((_, i) => (
            <View
              key={i}
              style={{
                width: `${(100 - 4 * 1.9) / 5}%`,
                height: PAGE.celebrationTileHeight,
                borderRadius: PAGE.celebrationTileRadius,
                backgroundColor: canvasAlpha(0.12),
              }}
            />
          ))}
        </View>

        <View className="px-gutter" style={{ paddingTop: 34 }}>
          <Text variant="display" style={{ fontSize: 56, lineHeight: 58, color: theme.canvas }}>
            {celebrationTitle(count)}
          </Text>
          <Text variant="body" className="mt-3" style={{ fontSize: 16, color: theme.blush }}>
            {CELEBRATION_BODY}
          </Text>
        </View>

        <View className="flex-1" />

        <PageActions
          primary={CELEBRATION_CTA}
          primaryTone="inverse"
          onPrimary={() => {}}
          quiet={CELEBRATION_SECONDARY}
          onQuiet={() => {}}
        />
      </View>
    </SafeAreaView>
  );
}
