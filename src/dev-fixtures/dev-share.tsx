import { useLocalSearchParams } from 'expo-router';
import { useCallback, useRef } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FIXTURE_ITEMS, FIXTURE_OUTFIT } from '@/components/dev/fixtures';
import { PlateCard } from '@/components/share/plate-card';
import { Text } from '@/components/ui/text';
import { sharePlate } from '@/features/share/capture-plate';

/**
 * A name long enough to overrun one line — proves the atlas's shrink rule
 * ("longer names shrink to 112pt rather than wrap to three") rather than the
 * wrap, which is the half of the type ramp a short fixture never reaches.
 */
const FIXTURE_LONG_NAME = {
  ...(FIXTURE_OUTFIT as object),
  name: 'The long slow Thursday afternoon',
} as never;

/**
 * The smallest composition the card ever has to hold. Two pieces cannot make a
 * stagger the way five can, so this is where an empty-looking stack shows up.
 */
const FIXTURE_TWO_PIECES = {
  ...(FIXTURE_OUTFIT as object),
  candidate: { items: FIXTURE_ITEMS.slice(0, 2), score: 0.74 },
} as never;

/**
 * Every piece claims a photograph that cannot be resolved — the closet mid-
 * import, or a cache the OS reclaimed. Distinct from the states above, whose
 * garments carry no paths at all: here the card asks for a plate, is told no,
 * and must still fill the tile with the garment's swatch. That branch is the
 * one that ships an empty tile when it breaks.
 */
const FIXTURE_NO_PHOTOS = {
  ...(FIXTURE_OUTFIT as object),
  candidate: {
    items: FIXTURE_ITEMS.map((g) => ({
      ...g,
      platePath: `plates/${g.id}.png`,
      cutoutPath: `cutouts/${g.id}.png`,
      thumbPath: `thumbs/${g.id}.jpg`,
    })),
    score: 0.87,
  },
} as never;

/**
 * DEV ONLY — the 360×640 share poster rendered on-screen at cinch://dev-share,
 * so the artifact can be reviewed and screenshotted without opening the share
 * sheet. What appears here is exactly what view-shot captures.
 *
 * The states below are the ones the redesigned card actually varies: whether
 * there is weather to print, how long the name is, how many pieces the stack
 * has to compose, and whether the closet has photographs. Each is a rule from
 * the share card atlas made visible, so a regression is something you can see
 * on this screen rather than something a reviewer finds in a screenshot a
 * friend received.
 *
 * cinch://dev-share?share=1 additionally runs the real capture pipeline on
 * mount — captureRef → system share sheet — and logs the captured file's URI,
 * so the true 1080×1920 artifact can be pulled from the simulator container
 * and inspected pixel-for-pixel. No finger required, which matters when the
 * only hands available are a CLI's.
 */
export default function DevShareScreen() {
  const { share } = useLocalSearchParams<{ share?: string }>();
  const cardRef = useRef<View>(null);

  const handleReady = useCallback(() => {
    void sharePlate(cardRef)
      .then((uri) => console.log(`[dev-share] captured ${uri}`))
      .catch((err) => console.log(`[dev-share] capture failed: ${String(err)}`));
  }, []);

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <ScrollView contentContainerClassName="items-center gap-6 py-6">
        {/* SC-01, the reference state the atlas PNG prints. 22°C is 72°F, so
            the signature has to read "FEELS 72°F" — if it doesn't, the card
            and the atlas have drifted apart. Only this one carries the ref and
            the capture wiring: ?share=1 must produce ONE artifact, and the
            reference state is the one worth inspecting at full size. */}
        <Text variant="eyebrow">Five pieces, with weather</Text>
        {/* Border outside the ref so the review chrome never enters the capture. */}
        <View className="border border-rule">
          <View ref={cardRef} collapsable={false}>
            <PlateCard
              outfit={FIXTURE_OUTFIT}
              occasion="dinner at 7"
              colophon={{ city: 'Brooklyn', feelsLikeC: 22 }}
              resolveImage={() => undefined}
              onReady={share === '1' ? handleReady : undefined}
            />
          </View>
        </View>

        {/* The atlas's first hard rule: "No weather, no colophon — it is never
            estimated." The line must be ABSENT here, not a dash and not a
            placeholder; a dash is the app admitting it looked and found
            nothing, which is not a thing a lookbook card says. */}
        <Text variant="eyebrow">No weather</Text>
        <View className="border border-rule">
          <PlateCard
            outfit={FIXTURE_OUTFIT}
            occasion="dinner at 7"
            colophon={{ city: null, feelsLikeC: null }}
            resolveImage={() => undefined}
          />
        </View>

        <Text variant="eyebrow">Long name</Text>
        <View className="border border-rule">
          <PlateCard
            outfit={FIXTURE_LONG_NAME}
            occasion="dinner at 7"
            colophon={{ city: 'Brooklyn', feelsLikeC: 22 }}
            resolveImage={() => undefined}
          />
        </View>

        <Text variant="eyebrow">Two pieces</Text>
        <View className="border border-rule">
          <PlateCard
            outfit={FIXTURE_TWO_PIECES}
            occasion="dinner at 7"
            colophon={{ city: 'Brooklyn', feelsLikeC: 22 }}
            resolveImage={() => undefined}
          />
        </View>

        {/* The atlas's "no missing photographs" rule, which is not about hiding
            the gap but about every tile falling back to its swatch. An empty
            tile on this row is an empty tile a friend receives. */}
        <Text variant="eyebrow">No photographs</Text>
        <View className="border border-rule">
          <PlateCard
            outfit={FIXTURE_NO_PHOTOS}
            occasion="dinner at 7"
            colophon={{ city: 'Brooklyn', feelsLikeC: 22 }}
            resolveImage={() => undefined}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
