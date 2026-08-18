/**
 * DEV ONLY — Wave 3 Group 1 canonical fixture: V-02 / V-03.
 *
 * The recording frame, and the one surface in this walkthrough that has no
 * other way of being photographed: the live route needs a microphone, and a
 * simulator has none. Without this fixture redesign 24's signature frame — the
 * elapsed figure at display scale, the wide warm waveform under it, the
 * supporting line, the silence nudge as a band — could only ever be checked on
 * a device, by hand, once.
 *
 * WHY IT DRAWS THE REAL METER. `LevelMeter` takes a Reanimated shared value and
 * samples it on its own tick, so a fixture can hand it a CONSTANT and get the
 * shipping component at a fixed amplitude rather than a second drawing of it.
 * The bars still animate into place on mount — that is the component being
 * itself — and they settle to one height, which is what makes the frame
 * photographable twice.
 *
 * Deterministic by construction: a literal elapsed figure, a literal amplitude,
 * a literal paused flag, and a literal nudge. Nothing here reads a clock.
 */

import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSharedValue } from 'react-native-reanimated';

import { LevelMeter } from '@/components/intake/LevelMeter';
import { WalkthroughBand, WalkthroughChrome } from '@/components/intake/walkthrough-parts';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import {
  recordingStateLabel,
  recordingSupportLine,
  TYPE,
} from '@/features/intake/walkthrough-spec';

/** 1:12 — the artifact's own silence-nudge frame. */
const ELAPSED = '1:12';
/** Mid-scale, so the bars read as speech rather than as a flat room. */
const AMPLITUDE = 0.62;
/** V-03's first nudge, in slot order — the same list the route cycles. */
const NUDGE = 'Tops?';

export default function Fixture() {
  const amplitude = useSharedValue(AMPLITUDE);

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-canvas">
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        {/* No exit in the chrome, exactly as the route draws it. See the note
            on the listening phase in `walkthrough/index.tsx`: a Cancel here
            would have to answer "and the audio?", and neither answer is a
            chrome change. */}
        <WalkthroughChrome state={recordingStateLabel(false)} />

        <View className="px-gutter" style={{ marginTop: 8 }}>
          <Text
            variant="display"
            style={{
              fontSize: TYPE.timer,
              lineHeight: Math.round(TYPE.timer * TYPE.timerLeading),
              fontVariant: ['tabular-nums'],
            }}>
            {ELAPSED}
          </Text>
        </View>

        <View className="items-center" style={{ marginTop: 22 }}>
          <LevelMeter amplitude={amplitude} active={false} />
        </View>

        <View className="px-gutter" style={{ marginTop: 22 }}>
          <Text variant="note" style={{ fontSize: 17, lineHeight: 26 }}>
            {recordingSupportLine(false)}
          </Text>
        </View>

        <View className="px-gutter" style={{ marginTop: 16 }}>
          <WalkthroughBand body={NUDGE} />
        </View>

        <View style={{ flex: 1 }} />

        <View className="px-gutter" style={{ gap: 10 }}>
          <Button title="Done" onPress={() => {}} className="self-stretch" />
          <Button title="Pause" variant="secondary" onPress={() => {}} className="self-stretch" />
        </View>
      </SafeAreaView>
    </View>
  );
}
