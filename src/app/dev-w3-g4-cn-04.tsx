import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackfillSheet } from '@/components/privacy/backfill-sheet';
import { UNTAGGED_COUNT } from '@/components/privacy/w3-g4-fixtures';
import { Text } from '@/components/ui/text';

/**
 * DEV ONLY · Wave 3 atlas state CN-04 — backfill existing pieces.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · "Volume and duration printed" — the volume half. 61 is the untagged count
 *   from the closet, printed twice: once as the headline and once inside the
 *   sentence about what will be sent. It is a count, so it is printed rather
 *   than described as "some".
 * · Consent to a batch is asked separately from consent to the feature. The
 *   row on the AI page opens this; this is what starts the send.
 * · What will NOT change is stated beside what will — cutouts, wear history,
 *   prices and any name the user wrote themselves.
 * · "Oxblood spent here": the filled "Read all 61", and nothing else.
 *
 * WHAT IS NOT DRAWN, AND WHY
 *
 * · "Choose which ones". `startBackfill()` enqueues every untagged piece and
 *   takes no selection; there is no partial back-fill anywhere in the
 *   repository, client or server. A dead control is worse than an absent one.
 * · "over about two minutes". Nothing measures throughput, so the duration
 *   would be an estimate printed as a fact. Omitted, with the reason.
 *
 * DETERMINISM: the count is a literal, there is no clock, no image and no
 * spinner — `busy` is false, so the primary never shows its indicator.
 */
export default function DevW3G4Cn04() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    // The sheet rises over the AI-consent page in the app; the ground here is
    // the canvas it dims, kept plain so the frame is a picture of the sheet.
    <View className="flex-1 bg-canvas">
      <BackfillSheet
        visible
        count={UNTAGGED_COUNT}
        busy={false}
        onRunBackfill={() => {}}
        onCancel={() => {}}
      />
    </View>
  );
}
