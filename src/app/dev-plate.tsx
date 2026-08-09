import { useState } from 'react';
import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FIXTURE_OUTFIT } from '@/components/dev/fixtures';
import { Plate } from '@/components/today/plate';
import type { ReactionValue } from '@/components/today/reaction-bar';
import { Text } from '@/components/ui/text';

/**
 * DEV ONLY — a signed-out preview of the signature component at
 * cinch://dev-plate. Fixtures live in src/components/dev/fixtures.ts.
 * It ships nothing: outside __DEV__ it renders a refusal.
 *
 * Genuinely interactive, matching the atlas's own "try the buttons" note on
 * D-02…D-09: love/pass/wear are wired to local state that resolves to
 * `saved` on a delay, exactly the shape of an optimistic write against the
 * real mutations in (tabs)/index.tsx. Long-press a plain `onReact={() => {}}`
 * used to leave the card visually inert — the pill filled nothing, because
 * no `reacted` prop ever came back.
 */
export default function DevPlateScreen() {
  const [reacted, setReacted] = useState<ReactionValue | null>(null);
  const [worn, setWorn] = useState(false);
  const [wearing, setWearing] = useState(false);

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas dark:bg-canvas-dark">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark">
      <ScrollView contentContainerClassName="pt-6">
        <Plate
          outfit={FIXTURE_OUTFIT}
          index={0}
          occasion="dinner at 7"
          colophon={{ city: 'Brooklyn', feelsLikeC: 17 }}
          resolveImage={() => undefined}
          reacted={reacted}
          worn={worn}
          wearing={wearing}
          onReact={(value) => {
            // D-02/D-05 → D-03 (or D-06, tap "Couldn't save" to see it fail
            // instead — this fixture always resolves to saved).
            setReacted({ ...value, status: 'pending' });
            setTimeout(() => setReacted((prev) => (prev ? { ...prev, status: 'saved' } : prev)), 700);
          }}
          onWear={() => {
            // D-08 → D-07.
            setWearing(true);
            setTimeout(() => {
              setWearing(false);
              setWorn(true);
            }, 700);
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
