import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SavedPage } from '@/components/boards/saved-page';
import { Text } from '@/components/ui/text';
import { resolveFixtureImages, SV_BOARDS, SV_NOW, SV_PLATES } from '@/features/boards/w3-g5-fixtures';

/**
 * SV-01 — all saved: three, four and five-piece plates.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · audit 98 — NO TILE LOOKS LIKE A MISSING ASSET. The quadrant is a fixed 2×2
 *   at 3pt gaps, and the four plates here are the four cases:
 *     – "Linen and corduroy" has three pieces, so its fourth cell is a SAND
 *       CELL CARRYING "3 pieces" — type, which is exactly what a failed image
 *       could never have.
 *     – "Rainy Tuesday" has four pieces and one of them has no photograph, so
 *       that cell is a SILHOUETTE — the piece exists, its picture does not, and
 *       those are different facts.
 *     – "Quiet authority" has five pieces: four are shown and the total is
 *       stated in the metadata ("5 pieces · Saved in August · worn once")
 *       rather than crammed in as a fifth cell or a "+1" badge.
 *     – "Sunday market" has four photographs and nothing to resolve.
 * · audit 98 — SAVED STATE AND WEAR COUNT ARE DISTINCT, in that order, in one
 *   13pt line. Never-worn is WORDS ("not worn yet"), never a zero and never a
 *   dash — "Rainy Tuesday" is the case.
 * · audit 98 — the chips are 14pt regular with counts inline ("All 14", "Work
 *   5"), the held one Medium, and the rail carries the same honest partial the
 *   Closet does: "Travelling light" runs off the edge rather than being
 *   truncated to a word that means nothing.
 * · No oxblood is spent on this page.
 *
 * DETERMINISM: `SV_NOW` is a literal and every `savedAt` is a literal, so the
 * saved months do not drift with the calendar. The photographs are the repo's
 * own licensed set through `expo-asset`. No query, no clock, no network.
 */
export default function DevW3G5SV01() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-canvas">
      <SavedPage
        loading={false}
        error={false}
        plates={SV_PLATES}
        boards={SV_BOARDS}
        imageUrisFor={resolveFixtureImages}
        onOpenBoard={() => undefined}
        onOpenPlate={() => undefined}
        onPlanALook={() => undefined}
        now={SV_NOW}
      />
    </View>
  );
}
