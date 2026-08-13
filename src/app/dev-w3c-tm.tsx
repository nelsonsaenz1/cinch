import { ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Masthead } from '@/app/(tabs)/index';
import { Text } from '@/components/ui/text';

/**
 * TM-01 / TM-02 / TM-03 — the masthead, at the widths and the type step.
 *
 * ── WHAT THIS FIXTURE CAN AND CANNOT SHOW ─────────────────────────────────
 *
 * TM-03 is fully drawable here: `stacked` forces the AX3 branch, so the
 * greeting's removal and the calendar control's collapse are both visible on
 * any device.
 *
 * TM-01 versus TM-02 IS NOT. The greeting's step follows the real window
 * width — 30 pt under 430, 32 pt at or above it — and a fixture cannot lie to
 * `useWindowDimensions` without reimplementing the masthead, which would make
 * the review a review of the copy rather than of the screen. So the live width
 * is printed below and the pair is checked by opening this route on two
 * simulators: a 393 pt iPhone and a 430 pt Pro Max. Stated rather than faked.
 *
 * A fixed `now` so the greeting and the date do not change between captures.
 */
const NOON = new Date('2026-08-07T09:41:00');

export default function DevW3cTm() {
  const { width, fontScale } = useWindowDimensions();

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScrollView contentContainerClassName="pb-16">
        <Text variant="eyebrow" className="px-gutter pt-4">
          {`${width >= 430 ? 'TM-02' : 'TM-01'} · live width ${Math.round(width)} pt · scale ${fontScale.toFixed(2)}`}
        </Text>
        <Masthead city="Denver" name="Nelson" weather="Feels 72°F, clear" now={NOON} unseen={false} />

        <View className="mt-10 border-t border-rule pt-4">
          <Text variant="eyebrow" className="px-gutter">
            TM-03 · AX3, the greeting yields and the calendar collapses
          </Text>
          <Masthead
            city="Denver"
            name="Nelson"
            weather="Feels 72°F, clear"
            now={NOON}
            unseen={false}
            stacked
          />
        </View>

        <Text variant="note" className="mt-10 px-gutter">
          Open this route on a 393 pt iPhone and on a 430 pt Pro Max. The greeting must hold one
          line on both, and the two must read as the same screen.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
