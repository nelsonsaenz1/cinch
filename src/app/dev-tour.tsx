import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/ui';
import { TourFrameView } from '@/features/onboarding/tour-frames';
import { TOUR_FRAMES } from '@/features/onboarding/tour-copy';
import { frameAt, nextIndex } from '@/features/onboarding/tour-state';

/**
 * DEV ONLY — the first-run tour at `cinch://dev-tour`.
 *
 * The three frames are the real `TourFrameView`, not a redrawing of it, so
 * what is reviewed here is what ships. The handlers are wired to the switcher
 * rather than to no-ops: Next advances, Skip and "I'll look around first" land
 * on the TR-04 card, and that card opens the real destination. Nothing here is
 * a frame you cannot get out of.
 *
 * TR-04 has no page of its own on purpose — it is `(tabs)/index`'s existing
 * empty state, which this wave does not rebuild. The card below says so and
 * then opens it.
 */
export default function DevTourScreen() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return <Switcher />;
}

const LABELS: Record<string, string> = {
  'TR-01': 'The promise — the one dark ground',
  'TR-02': 'The camera — photograph to plate',
  'TR-03': 'The ritual — two real ways out',
};

function Switcher() {
  const router = useRouter();
  // 3 is TR-04, which is a destination rather than a frame.
  const [index, setIndex] = useState(0);
  const ids = [...TOUR_FRAMES.map((f) => f.id), 'TR-04'];
  const onFrame = index < TOUR_FRAMES.length;
  const frame = onFrame ? frameAt(index) : null;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <StatusBar style={frame?.ground === 'ink' ? 'light' : 'dark'} />
      <View className="flex-row flex-wrap gap-2 px-gutter pb-2 pt-1">
        {ids.map((id, i) => (
          <Text
            key={id}
            onPress={() => setIndex(i)}
            variant="colophon"
            style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}
            className={
              i === index ? 'border border-accent bg-accent-light text-accent' : 'border border-rule'
            }>
            {id}
          </Text>
        ))}
      </View>
      <Text variant="label" className="px-gutter pb-2">
        {frame ? LABELS[frame.id] : 'After — where “I’ll look around first” lands'}
      </Text>

      <View style={{ flex: 1 }}>
        {frame ? (
          <TourFrameView
            frame={frame}
            index={index}
            onNext={() => setIndex(nextIndex(index) ?? index)}
            onSkip={() => setIndex(TOUR_FRAMES.length)}
            onCamera={() => router.push('/capture')}
            onLookAround={() => setIndex(TOUR_FRAMES.length)}
          />
        ) : (
          <AfterCard onOpen={() => router.replace('/(tabs)')} />
        )}
      </View>
    </SafeAreaView>
  );
}

/**
 * TR-04. Not a frame and not a rebuild — a pointer at the screen that already
 * exists, so the last thing a reviewer checks is the real empty state and not
 * a second drawing of it.
 */
function AfterCard({ onOpen }: { onOpen: () => void }) {
  return (
    <View className="flex-1 justify-center px-gutter">
      <Text variant="title" trim>
        TR-04 is Today
      </Text>
      <Text variant="body" className="text-muted" style={{ marginTop: 16 }}>
        The tour ends on the Today empty state, which the app already has and this wave does not
        touch: no coach marks, no spotlight overlay, no second tour. The three frames exist to make
        that page make sense, and TR-04 is the proof they did.
      </Text>
      <Text variant="note" style={{ marginTop: 12 }}>
        src/app/(tabs)/index.tsx — the `canGenerate` branch.
      </Text>
      <View style={{ marginTop: 28 }}>
        <Button title="Open Today" variant="ink" onPress={onOpen} className="self-stretch" />
      </View>
    </View>
  );
}
