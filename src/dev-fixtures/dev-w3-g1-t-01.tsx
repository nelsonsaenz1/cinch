/**
 * DEV ONLY — Wave 3 Group 1 canonical fixture: T-01.
 *
 * First run, nothing photographed. All ten tiles are on screen before any scrolling — which is what makes "order is guidance" legible rather than merely stated — and the count reads "0 of 10" because the flow has genuinely started. Slot one carries no Skip: the decline appears from the second slot onward.
 *
 * Deterministic by construction: the slot list is a literal built by
 * `ten-fixtures.ts`, the photographs are bundled assets, and no figure on the
 * page is read from a clock or a network.
 */

import { SafeAreaView } from "react-native-safe-area-context";

import { fixtureT01 } from "@/components/dev/ten-fixtures";
import { TenBody } from "@/components/onboarding/ten-body";
import { Text } from "@/components/ui/text";

export default function Fixture() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  const { slots, names, images, readiness } = fixtureT01();
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <TenBody
        readiness={readiness}
        slots={slots}
        garmentNames={names}
        imageUris={images}
      ></TenBody>
    </SafeAreaView>
  );
}
