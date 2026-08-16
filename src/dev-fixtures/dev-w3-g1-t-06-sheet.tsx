/**
 * DEV ONLY — Wave 3 Group 1 canonical fixture: T-06 (the stop sheet).
 *
 * The tenth piece lands and the flow STOPS. Not a paywall: the reader has not
 * seen a single outfit yet, and no price, tier name or upgrade action appears
 * here. The eyebrow is words — "Ten of ten", never 10/10, because a score is a
 * mark out of something and this is a position arrived at.
 *
 * Deterministic by construction: the outfit count is `countOutfits` over a
 * literal slot list, so it is computed and reproducible rather than typed.
 */

import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { fixtureT06 } from "@/components/dev/ten-fixtures";
import { TenBody } from "@/components/onboarding/ten-body";
import { TenStopSheetBody } from "@/components/onboarding/ten-stop-sheet";
import { Text } from "@/components/ui/text";

export default function Fixture() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  const { slots, names, images, readiness } = fixtureT06();

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <View className="flex-1" style={{ opacity: 0.35 }} pointerEvents="none">
        <TenBody
          slots={slots}
          readiness={readiness}
          garmentNames={names}
          imageUris={images}
        />
      </View>
      <View>
        <TenStopSheetBody
          count={readiness.outfits}
          onSeeOutfits={() => {}}
          onBackToGrid={() => {}}
        />
      </View>
    </SafeAreaView>
  );
}
