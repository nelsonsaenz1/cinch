import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConsentSheet } from '@/components/ingest/consent-sheet';
import { Text } from '@/components/ui/text';

/**
 * DEV ONLY · Wave 3 atlas state CN-01 — first consent.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · audit 73 — four facts a reader can separate. No numerals, no rules, air
 *   between them, each one 17px with a Medium lead clause and a regular
 *   remainder. Nothing on the sheet sets a full sentence in Medium.
 * · correction 01 — the title and the opening sentence separate the on-device
 *   cutout from the model call, so a reader knows what they are consenting to.
 * · audit 74 — the actions sit below the scroll region on a hairline, so the
 *   sheet cannot cover them; the legal line is inside the scroll at 16px and
 *   is a 44pt target in its own right.
 * · "Oxblood spent here" — the filled primary, and the policy link. Nothing
 *   else on the frame spends the accent; the numerals that used to are gone.
 *
 * WHAT IS DELIBERATELY NOT DRAWN
 *
 * · The four sentences are `CONSENT_FACTS`, the record. CN-01 draws four
 *   different ones. See the lane report.
 * · "Not now". Nothing can honour a deferral from inside this component.
 *
 * DETERMINISM: no clock, no random source, no network, no image, no spinner.
 * The sheet's own entrance is the platform's modal slide, which settles.
 */
export default function DevW3G4Cn01() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    // The atlas's own staging: the shot already taken, waiting dark behind the
    // sheet. The decision is about a real photograph, not a hypothetical.
    <View className="flex-1 bg-ink">
      <View className="flex-1 items-center justify-center">
        <Text variant="label" style={{ color: 'rgba(251,250,246,0.4)' }}>
          1 photo ready
        </Text>
      </View>
      <ConsentSheet visible busy={false} onAccept={() => {}} onDecline={() => {}} />
    </View>
  );
}
