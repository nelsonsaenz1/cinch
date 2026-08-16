import { SafeAreaView } from 'react-native-safe-area-context';

import { ExportPage } from '@/components/privacy/export-page';
import { EXPORT_READY } from '@/components/privacy/w3-g4-fixtures';
import { Text } from '@/components/ui/text';

/**
 * DEV ONLY · Wave 3 atlas state PV-03 — export, ready.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · correction 15's real content: "save the pictures while the links last".
 *   A reader who files the download and comes back in a month finds the data
 *   intact and the photographs gone, and this is the only moment that sentence
 *   can still be acted on.
 * · "Sizes and dates printed, never estimated" — the size is
 *   `data_exports.bytes`, measured off the assembled archive by the worker, and
 *   the expiry is the row's own `expires_at` rather than a promised window.
 *   Nothing here says "seven days"; nothing in the migration sets one.
 * · The download is minted per tap, so the button is real rather than a cached
 *   link that would work for a while and then quietly stop.
 *
 * DETERMINISM: every field of `EXPORT_READY` is a frozen literal, and its
 * `expiresAt` is far enough ahead that `exportStateOf` cannot derive `expired`
 * between now and any capture. `downloading` is false, so no spinner mounts.
 */
export default function DevW3G4Pv03Ready() {
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
      exports={[EXPORT_READY]}
      email="sophie@mail.com"
      requesting={false}
      requestError={null}
      onRequest={() => {}}
      onDownload={() => {}}
      downloading={false}
      downloadError={null}
      onBack={() => {}}
    />
  );
}
