import { useRouter } from 'expo-router';
import { Linking } from 'react-native';

import { ExportPage } from '@/components/privacy/export-page';
import {
  useAccountEmail,
  useDataExports,
  useExportDownloadLink,
  useRequestDataExport,
} from '@/features/privacy/use-data-export';
import { useBoundedLoad } from '@/lib/use-bounded-load';

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

  /**
   * UX #52 — the export history's skeleton is bounded now.
   *
   * "Data Export enters two large unlabeled skeleton blocks with no visible
   * progress, retry, or explanation." The retry existed but only behind a
   * failure; a read that simply never returned left the two blocks shimmering
   * with nothing to press. The bound gives that wait an end and the same retry.
   *
   * The ASYNCHRONY the finding also asks about is a different read: the archive
   * itself is assembled server-side and mailed, and the pending card below
   * already says so in words ("You can leave this screen — the email arrives
   * at …"). What was missing was that the WAIT ON THE HISTORY did not say it
   * was a different thing; the labelled skeleton in `ExportPage` now does.
   */
  const load = useBoundedLoad({
    loading: exports.isLoading,
    error: exports.isError,
    retrying: exports.isRefetching,
    onRetry: () => void exports.refetch(),
  });

  return (
    <ExportPage
      loading={load.state === 'skeleton'}
      error={load.state === 'error'}
      timedOut={load.timedOut}
      onRetry={load.retry}
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
