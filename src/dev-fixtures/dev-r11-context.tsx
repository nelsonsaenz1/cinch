import { useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { ContextChips } from '@/components/today/context-chips';
import { Text } from '@/components/ui/text';
import { W3Frame } from '@/components/today/w3-g2-fixtures';
import { AX_FONT_SCALE } from '@/components/today/reaction-spec';
import {
  DEFAULT_CONTEXT,
  resolveWeather,
  type ContextFacet,
  type FeelId,
  type OccasionId,
} from '@/features/today/today-spec';

/**
 * DEV ONLY · Redesign 11 — the context row, and the four weather states.
 *
 * The row is live: tapping a chip opens its options in place and tapping an
 * option commits, with no confirm step, so the interaction can be checked as an
 * interaction rather than as three screenshots.
 *
 * The weather cycler is the part worth looking at carefully. `ok`, `stale`,
 * `off` and `unavailable` are four different sentences about four different
 * facts, and the failure mode this fixture exists to catch is any two of them
 * looking the same — particularly `off` and `unavailable`, which are a
 * permission this reader has not given and a reading this device could not get.
 */

const NOW = new Date(2026, 7, 18, 9, 41, 0);
const FRESH = new Date(2026, 7, 18, 9, 12, 0);
const OLD = new Date(2026, 7, 18, 7, 4, 0);

type WeatherPose = 'ok' | 'stale' | 'off' | 'unavailable';
const POSES: readonly WeatherPose[] = ['ok', 'stale', 'off', 'unavailable'];

export default function DevR11Context() {
  const [pose, setPose] = useState<WeatherPose>('ok');
  const [occasion, setOccasion] = useState<OccasionId>(DEFAULT_CONTEXT.occasion);
  const [feel, setFeel] = useState<FeelId>(DEFAULT_CONTEXT.feel);
  const [open, setOpen] = useState<ContextFacet | null>(null);
  const { fontScale } = useWindowDimensions();
  const ax = fontScale >= AX_FONT_SCALE;

  const read = resolveWeather({
    conditionLabel: pose === 'unavailable' ? null : 'Grey',
    temperatureLabel: pose === 'unavailable' ? null : '63°',
    fetchedAt: pose === 'ok' ? FRESH : pose === 'stale' ? OLD : null,
    permissionOff: pose === 'off',
    failed: pose === 'unavailable',
    now: NOW,
  });

  return (
    <W3Frame>
      <View className="px-gutter pt-4">
        <Text variant="eyebrow">Redesign 11 · Context</Text>
        <View className="mt-2 flex-row" style={{ gap: 8, flexWrap: 'wrap' }}>
          {POSES.map((p) => (
            <Pressable
              key={p}
              accessibilityRole="button"
              accessibilityLabel={`Weather ${p}`}
              onPress={() => setPose(p)}
              style={{ minHeight: 44, justifyContent: 'center' }}
              className={p === pose ? 'rounded-md bg-sand px-3' : 'rounded-md bg-tray px-3'}>
              <Text variant="label">{p}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ paddingTop: 20 }}>
          <ContextChips
            view={{
              weatherChip: read.chip,
              occasion,
              feel,
              open,
              large: ax,
              onOpen: setOpen,
              onOccasion: (id) => {
                setOccasion(id);
                setOpen(null);
              },
              onFeel: (id) => {
                setFeel(id);
                setOpen(null);
              },
              onWeather: () => {},
            }}
          />
        </View>

        {/* What the card would carry, printed here so the mark can be read
            without a card around it. Absent entirely on two of the four — a
            known-unknown is omitted, never dashed. */}
        <View style={{ paddingTop: 28 }}>
          <Text variant="eyebrow">Plate mark</Text>
          <Text variant="body" className="mt-2 text-muted">
            {read.mark ?? '(none — the reading is not known)'}
          </Text>
          <Text variant="eyebrow" className="mt-5">
            State
          </Text>
          <Text variant="body" className="mt-2 text-muted">
            {read.state}
          </Text>
        </View>
      </View>
    </W3Frame>
  );
}
