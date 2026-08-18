import { useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { TodayPlate } from '@/components/today/today-plate';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/tokens';
import { FIVE_PIECES, W3Frame, noImages } from '@/components/today/w3-g2-fixtures';
import { AX_FONT_SCALE } from '@/components/today/reaction-spec';
import { TODAY_COPY, exhaustedBody, piecesLine, positionLabel } from '@/features/today/today-spec';

/**
 * DEV ONLY · Redesign 11 — the four days that do not end in an outfit.
 *
 * They are drawn together because the failure this fixture exists to catch is
 * any two of them reading the same. They are four different facts:
 *
 *   NO VIABLE  — the wardrobe is real and nothing in it works for the occasion.
 *                An OUTCOME, not an error, and the action changes the occasion
 *                rather than blaming the closet.
 *   EXHAUSTED  — "show another" ran out of genuinely different looks. Additive:
 *                the plates are still there above it.
 *   OFFLINE ·  — the closet is on the phone, so there ARE outfits; what is gone
 *   CACHED       is the write, and the control says so rather than promising a
 *                queue this app does not have.
 *   OFFLINE ·  — the closet has never been read on this phone, so there is
 *   NO CACHE     nothing to build from. The network is named as the reason;
 *                the wardrobe is not blamed for it.
 */

type Pose = 'no-viable' | 'exhausted' | 'offline-cached' | 'offline-empty';
const POSES: readonly Pose[] = ['no-viable', 'exhausted', 'offline-cached', 'offline-empty'];

const OFFLINE_REASON = 'Marking a wear needs a connection.';

export default function DevR11Refusals() {
  const [pose, setPose] = useState<Pose>('no-viable');
  const { width, fontScale } = useWindowDimensions();
  const theme = useTheme();
  const ax = fontScale >= AX_FONT_SCALE;

  return (
    <W3Frame>
      <View className="px-gutter pt-4">
        <Text variant="eyebrow">Redesign 11 · Refusals</Text>
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

      <View className="px-gutter" style={{ paddingTop: 24 }}>
        {pose === 'no-viable' ? (
          <View>
            <Text variant="title" trim>
              {TODAY_COPY.noViableTitle}
            </Text>
            <Text variant="body" className="mt-4 text-muted">
              {TODAY_COPY.noViableBody}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={TODAY_COPY.noViableAction}
              style={{ minHeight: ax ? 56 : 44 }}
              className="mt-7 items-center justify-center rounded-md bg-accent px-6">
              <Text variant="label" style={{ color: theme.canvas }}>
                {TODAY_COPY.noViableAction}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {pose === 'exhausted' ? (
          <View>
            <Text variant="eyebrow">{TODAY_COPY.exhaustedKicker}</Text>
            <Text variant="body" className="mt-2 text-muted">
              {exhaustedBody('Grey', 'Dinner out')}
            </Text>
          </View>
        ) : null}

        {pose === 'offline-empty' ? (
          <View>
            <Text variant="eyebrow">{TODAY_COPY.offlineKicker}</Text>
            <Text variant="body" className="mt-2 text-muted">
              {TODAY_COPY.offlineNoCacheBody}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={TODAY_COPY.tryAgain}
              style={{ minHeight: ax ? 56 : 44 }}
              className="mt-7 items-center justify-center rounded-md px-6">
              <Text variant="label" className="text-muted">
                {TODAY_COPY.tryAgain}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {pose === 'offline-cached' ? (
          <View>
            <Text variant="eyebrow">{TODAY_COPY.offlineKicker}</Text>
            <Text variant="body" className="mb-5 mt-2 text-muted">
              {TODAY_COPY.offlineCachedBody}
            </Text>
            <TodayPlate
              view={{
                name: 'The long grey morning',
                piecesLine: piecesLine(FIVE_PIECES),
                garments: FIVE_PIECES,
                // The closet's date, not a temperature: the forecast is
                // precisely the thing that could not be reached.
                weatherMark: 'Closet as of Mon, 17 Aug',
                positionLabel: positionLabel(1),
              }}
              width={width - 40}
              large={ax}
              resolveImage={noImages}
            />
            <View style={{ paddingTop: 16 }}>
              <View
                accessibilityRole="button"
                accessibilityState={{ disabled: true }}
                accessibilityLabel={`${TODAY_COPY.wear}. ${OFFLINE_REASON}`}
                className="items-center justify-center rounded-md bg-tray px-6"
                style={{ minHeight: ax ? 56 : 44 }}>
                <Text variant="label" className="text-muted">
                  {TODAY_COPY.wear}
                </Text>
              </View>
              <Text variant="note" className="mt-2 text-muted">
                {OFFLINE_REASON}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    </W3Frame>
  );
}
