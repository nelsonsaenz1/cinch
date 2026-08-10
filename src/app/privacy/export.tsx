import { useRouter } from 'expo-router';
import { Linking } from 'react-native';

import { ExportPage } from '@/components/privacy/export-page';
import {
  useAccountEmail,
  useDataExports,
  useExportDownloadLink,
  useRequestDataExport,
} from '@/features/privacy/use-data-export';

/**
 * PD-04 / PD-05 — Export your data.
 *
 * The wiring only. Which of the two shapes the page draws is decided by the
 * data (`status === 'pending'`), not by a prop this route sets — the atlas's
 * own trigger, and the reason both live in one component.
 */
export default function ExportDataScreen() {
  const router = useRouter();

  const exports = useDataExports();
  const email = useAccountEmail();
  const request = useRequestDataExport();
  const download = useExportDownloadLink();

  return (
    <ExportPage
      loading={exports.isLoading}
      error={exports.isError}
      onRetry={() => {
        void exports.refetch();
      }}
      exports={exports.data ?? []}
      email={email.data ?? null}
      requesting={request.isPending}
      // The refusal comes back from `request_data_export()` already written as
      // a sentence for a human ("you can ask for one export a day"), so it is
      // shown as written rather than replaced with a guess.
      requestError={
        request.error
          ? request.error instanceof Error
            ? request.error.message
            : 'That did not go through. Nothing was requested — try again.'
          : null
      }
      onRequest={() => {
        request.reset();
        request.mutate();
      }}
      // Minted per tap and handed straight to the browser. Nothing is cached:
      // a signed URL outlives the tap by minutes, and a stale one in state is
      // a button that works until it silently does not.
      downloading={download.isPending}
      downloadError={
        download.error
          ? download.error instanceof Error
            ? download.error.message
            : 'That download link could not be made just now.'
          : null
      }
      onDownload={(exportId) => {
        download.reset();
        download.mutate(exportId, {
          onSuccess: (url) => {
            void Linking.openURL(url).catch(() => {});
          },
        });
      }}
      onBack={() => router.back()}
    />
  );
}
