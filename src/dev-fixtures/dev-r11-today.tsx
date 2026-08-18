import { useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { ContextChips } from '@/components/today/context-chips';
import { PlateDots, TodayPlate } from '@/components/today/today-plate';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/tokens';
import {
  FIVE_PIECES,
  FOUR_PIECES,
  THREE_PIECES,
  W3Frame,
  noImages,
} from '@/components/today/w3-g2-fixtures';
import { AX_FONT_SCALE } from '@/components/today/reaction-spec';
import {
  TODAY_COPY,
  isThinWardrobe,
  piecesLine,
  positionLabel,
  resolveWeather,
  type PlateIndex,
} from '@/features/today/today-spec';

/**
 * DEV ONLY · Redesign 11 — the day, and the five ways it can be drawn.
 *
 * One cycler rather than five routes, because the states differ by a line and a
 * fill and the point of looking at them is the COMPARISON: whether the applying
 * line reads as work in progress rather than as an error, whether a card with
 * no photographs is still obviously an outfit, whether a thin wardrobe reads as
 * a wardrobe rather than as a failure.
 *
 * Deterministic by construction, on the wave's rule: no network, no clock, no
 * spinner. `FIXTURE_TAKEN` is a literal, `noImages` resolves every path to
 * undefined so every tile takes the neutral fallback, and the weather read is
 * computed from fixed inputs rather than from a device.
 */

const FIXTURE_NOW = new Date(2026, 7, 18, 9, 41, 0);
const FIXTURE_TAKEN = new Date(2026, 7, 18, 9, 12, 0);

const NAMES = ['The long grey morning', 'Something with a coat', 'Cognac and charcoal'];
const SETS = [FIVE_PIECES, FOUR_PIECES, THREE_PIECES];

type Pose = 'normal' | 'applying' | 'thin' | 'no-images' | 'weather-off';

const POSES: readonly Pose[] = ['normal', 'applying', 'thin', 'no-images', 'weather-off'];

export default function DevR11Today() {
  const [pose, setPose] = useState<Pose>('normal');
  const [active, setActive] = useState<PlateIndex>(1);
  const { width, fontScale } = useWindowDimensions();
  const theme = useTheme();
  const ax = fontScale >= AX_FONT_SCALE;

  const weather = resolveWeather({
    conditionLabel: 'Grey',
    temperatureLabel: '63°',
    fetchedAt: pose === 'weather-off' ? null : FIXTURE_TAKEN,
    permissionOff: pose === 'weather-off',
    failed: false,
    now: FIXTURE_NOW,
  });

  // A thin wardrobe is genuinely fewer cards — not three cards with two of them
  // greyed out, which would be a count wearing a disguise.
  const count = pose === 'thin' ? 2 : 3;
  const cards = Array.from({ length: count }, (_, i) => i);

  return (
    <W3Frame>
      <View className="px-gutter pt-4">
        <Text variant="eyebrow">Redesign 11 · Today</Text>
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

      <View className="px-gutter" style={{ paddingTop: 16 }}>
        <ContextChips
          view={{
            weatherChip: weather.chip,
            occasion: 'no_plans',
            feel: 'easy',
            open: null,
            large: ax,
            onOpen: () => {},
            onOccasion: () => {},
            onFeel: () => {},
            onWeather: () => {},
          }}
        />
      </View>

      <View className="flex-row" style={{ paddingTop: 20 }}>
        {cards.map((i) => (
          <View key={i} style={{ width: width - 40, marginLeft: i === 0 ? 20 : 12 }}>
            <TodayPlate
              view={{
                name: NAMES[i] ?? NAMES[0],
                piecesLine: piecesLine(SETS[i] ?? SETS[0]),
                garments: SETS[i] ?? SETS[0],
                weatherMark: weather.mark,
                positionLabel: positionLabel((i + 1) as PlateIndex),
                applyingLabel: pose === 'applying' ? TODAY_COPY.applying : null,
              }}
              width={width - 40}
              large={ax}
              // Every pose resolves to undefined: `no-images` is the state the
              // others are checked against, and a fixture that could load a
              // photograph would be checking the network rather than the card.
              resolveImage={noImages}
            />
            <View style={{ paddingTop: 16 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={TODAY_COPY.wear}
                style={{ minHeight: ax ? 56 : 44 }}
                className="items-center justify-center rounded-md bg-accent px-6">
                <Text variant="label" style={{ color: theme.canvas }}>
                  {TODAY_COPY.wear}
                </Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>

      <PlateDots count={count} active={active} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Advance the dots"
        onPress={() => setActive(((active % count) + 1) as PlateIndex)}
        style={{ minHeight: 44 }}
      />

      {isThinWardrobe(count) ? (
        <View className="px-gutter" style={{ paddingTop: 18 }}>
          <Text variant="eyebrow">{TODAY_COPY.thinKicker}</Text>
          <Text variant="body" className="mt-2 text-muted">
            {TODAY_COPY.thinBody}
          </Text>
        </View>
      ) : null}
    </W3Frame>
  );
}
