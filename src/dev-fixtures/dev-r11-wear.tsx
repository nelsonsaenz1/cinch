import { useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { TodayPlate, WornMark } from '@/components/today/today-plate';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/tokens';
import { FIVE_PIECES, W3Frame, noImages } from '@/components/today/w3-g2-fixtures';
import { AX_FONT_SCALE } from '@/components/today/reaction-spec';
import { TODAY_COPY, piecesLine, positionLabel } from '@/features/today/today-spec';

/**
 * DEV ONLY · Redesign 11 — the wear flow's four resting states.
 *
 * READY is the ordinary card. WORN is the settled mark: one restrained kicker,
 * one sentence, and the two things somebody might actually want next — no
 * confetti, no score, no streak, because celebrating a person for getting
 * dressed is the tone this app does not have.
 *
 * FAILED is the one to look at hardest. A write that did not land must say so
 * without losing the choice: the card stays, the same tap retries, and the copy
 * promises that nothing was recorded twice — which is true, because
 * `wear_outfit_tx` is a single transaction and a retry of a failed one writes
 * once or not at all.
 *
 * UNRATED exists to prove a negative: an unrated wear is a legal wear, and the
 * settled state is identical whether or not anybody rated it.
 */

type Pose = 'ready' | 'worn' | 'unrated' | 'failed';
const POSES: readonly Pose[] = ['ready', 'worn', 'unrated', 'failed'];

export default function DevR11Wear() {
  const [pose, setPose] = useState<Pose>('ready');
  const { width, fontScale } = useWindowDimensions();
  const theme = useTheme();
  const ax = fontScale >= AX_FONT_SCALE;
  const settled = pose === 'worn' || pose === 'unrated';

  return (
    <W3Frame>
      <View className="px-gutter pt-4">
        <Text variant="eyebrow">Redesign 11 · Wear</Text>
        <View className="mt-2 flex-row" style={{ gap: 8, flexWrap: 'wrap' }}>
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

      <View className="px-gutter" style={{ paddingTop: 20 }}>
        <TodayPlate
          view={{
            name: 'The long grey morning',
            piecesLine: piecesLine(FIVE_PIECES),
            garments: FIVE_PIECES,
            weatherMark: '63° · Grey',
            positionLabel: positionLabel(1),
          }}
          width={width - 40}
          large={ax}
          resolveImage={noImages}
        />

        <View style={{ paddingTop: 16 }}>
          {settled ? (
            <WornMark
              // `unrated` proves the settled state does not depend on a rating:
              // same mark, same two actions, same sentence.
              entryId="fixture-entry"
              undoing={false}
              large={ax}
              onUndo={() => {}}
              onAddNote={() => {}}
            />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={TODAY_COPY.wear}
              style={{ minHeight: ax ? 56 : 44 }}
              className="items-center justify-center rounded-md bg-accent px-6">
              <Text variant="label" style={{ color: theme.canvas }}>
                {TODAY_COPY.wear}
              </Text>
            </Pressable>
          )}

          {pose === 'failed' ? (
            <View accessibilityRole="alert" style={{ paddingTop: 14 }}>
              <Text variant="eyebrow">{TODAY_COPY.wearFailedKicker}</Text>
              <Text variant="note" className="mt-2 text-muted">
                {TODAY_COPY.wearFailedBody}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </W3Frame>
  );
}
