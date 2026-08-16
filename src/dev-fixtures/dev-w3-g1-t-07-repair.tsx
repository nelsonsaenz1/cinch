/**
 * DEV ONLY — Wave 3 Group 1 canonical fixture: T-07, the repair state.
 *
 * Ten pieces filed and the closet still cannot be styled — the state that
 * replaced T-04 (the substitution sheet) when the named-slot template was
 * removed. The template could not produce this frame, because it guaranteed
 * its own success; generic positions can, so the flow needs somewhere honest
 * to stand that is neither a reveal it has not earned nor a dead end.
 *
 * The fixture's ten are four tops, three coats and three bags — no footwear
 * anywhere, so `countOutfits` is nought and the card names exactly that. The
 * grid stays live underneath: every tile opens its piece, which is the fix.
 *
 * Deterministic by construction: the slot list and its classified wardrobe are
 * literals built by `ten-fixtures.ts`, the photographs are bundled assets, and
 * no figure on the page is read from a clock or a network.
 */

import { SafeAreaView } from "react-native-safe-area-context";

import { fixtureT07Repair } from "@/components/dev/ten-fixtures";
import { TenBody } from "@/components/onboarding/ten-body";
import { TenRepair } from "@/components/onboarding/ten-repair";
import { Text } from "@/components/ui/text";

export default function Fixture() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  const { slots, names, images, readiness } = fixtureT07Repair();
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={["top"]}>
      <TenBody
        readiness={readiness}
        slots={slots}
        garmentNames={names}
        imageUris={images}
        footer={<TenRepair readiness={readiness} onCheckPiece={() => {}} />}
      />
    </SafeAreaView>
  );
}
