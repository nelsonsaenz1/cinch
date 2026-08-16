/**
 * DEV ONLY — Wave 3 Group 1 canonical fixture: T-02 / AX.
 *
 * The Ten at the largest supported type. The grid drops from three columns to two and the tile becomes square rather than shrinking the label; the slot reasoning sentence is dropped because the title carries it, and the three actions stack in the same order. Recomposition, never truncation.
 *
 * Deterministic by construction: the slot list is a literal built by
 * `ten-fixtures.ts`, the photographs are bundled assets, and no figure on the
 * page is read from a clock or a network.
 */

import { SafeAreaView } from "react-native-safe-area-context";

import { fixtureT02 } from "@/components/dev/ten-fixtures";
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

  const { slots, names, images, readiness } = fixtureT02();
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <TenBody
        readiness={readiness}
        slots={slots}
        garmentNames={names}
        imageUris={images}
        fontScale={1.8}
      ></TenBody>
    </SafeAreaView>
  );
}
