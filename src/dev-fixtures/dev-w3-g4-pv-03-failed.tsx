import { SafeAreaView } from 'react-native-safe-area-context';

import { ExportPage } from '@/components/privacy/export-page';
import { EXPORT_FAILED } from '@/components/privacy/w3-g4-fixtures';
import { Text } from '@/components/ui/text';

/**
 * DEV ONLY · Wave 3 atlas state PV-03 — export, failed.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · Failure confirms the two things a reader needs and cannot check: nothing
 *   was emailed, and nothing of theirs moved. "Nothing silently lost."
 * · Asking again is offered in the same breath, and it starts a fresh copy
 *   rather than resuming something the user cannot see.
 * · The manifest and the button stay on screen, so the failed card is a report
 *   rather than a dead end.
 *
 * `error` on the row is null here on purpose: the worker writes its own
 * sentence when it has one, and this frame is the branch a reader hits when it
 * does not — which is the sentence this component owns and therefore the one
 * worth having a picture of.
 *
 * DETERMINISM: frozen literals throughout; no spinner, no clock-derived state.
 */
export default function DevW3G4Pv03Failed() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <ExportPage
      loading={false}
      error={false}
      onRetry={() => {}}
      exports={[EXPORT_FAILED]}
      email="sophie@mail.com"
      requesting={false}
      requestError={null}
      onRequest={() => {}}
      onBack={() => {}}
    />
  );
}
