import { ActivityIndicator, View } from 'react-native';

import { PrivacyPage } from '@/components/privacy/privacy-page';
import { Button, Card, ErrorState, Rule, SectionHeader, Skeleton, Text } from '@/components/ui';
import {
  EXPORT_LIMIT_NOTE,
  FRIENDS_NOT_INCLUDED,
  MANIFEST_ROWS,
} from '@/features/privacy/copy';
import {
  earlierExportLine,
  exportStateOf,
  formatBytes,
  fullDate,
  timeOfDay,
  type DataExport,
} from '@/features/privacy/format';
import { useTheme } from '@/theme/tokens';

/**
 * PD-04 and PD-05 — "Export your data", in its two shapes.
 *
 * One component, because they are one page: the manifest is what you see when
 * nothing is being assembled, and the pending card takes its place when
 * something is. The atlas's trigger is literally `export.status === pending`.
 *
 * ── No progress bar ────────────────────────────────────────────────────────
 *
 * The atlas draws one at 38%. There is no `progress` column and there will not
 * be one; the migration says why (`20260810120000_data_exports.sql:8-12`): "a
 * bar is only honest if something can compute the fraction. Assembling a
 * manifest is a handful of queries with no meaningful midpoint". So the card
 * carries a spinner — the platform's own indeterminate control, which also
 * respects the accessibility settings a hand-rolled loop would have to
 * reimplement — and says in words what is happening.
 *
 * ── Expiry is a fact about the clock ───────────────────────────────────────
 *
 * `expires_at < now()`, derived at render, never a status. The atlas's "the
 * link expires after seven days" is not stated anywhere here: nothing in the
 * migration sets `expires_at`, so the number is not this page's to promise.
 * The real date is printed off the row instead.
 */

/** One line of the manifest — the real filename, and what arrives in it. */
function ManifestRow({ name, body, first }: { name: string; body: string; first: boolean }) {
  return (
    <View className={`flex-row gap-3 px-4 py-3.5 ${first ? '' : 'border-t border-hairline'}`}>
      <Text variant="body" className="w-[104px] font-medium">
        {name}
      </Text>
      <Text variant="note" className="flex-1">
        {body}
      </Text>
    </View>
  );
}

export type ExportPageProps = {
  loading: boolean;
  error: boolean;
  onRetry: () => void;

  /** Newest first. The page is a rendering of this list and nothing else. */
  exports: DataExport[];
  /** Where the archive goes. Null while the session is still being read. */
  email: string | null;

  requesting: boolean;
  /** The rpc's own sentence — "you can ask for one export a day". */
  requestError: string | null;
  onRequest: () => void;

  /**
   * Redeem a finished archive. Optional so `dev-privacy` can draw the card
   * without a network, and so the button is simply absent rather than inert
   * anywhere it cannot work.
   */
  onDownload?: (exportId: string) => void;
  downloading?: boolean;
  /** The function's own sentence — "that link has expired", and so on. */
  downloadError?: string | null;

  onBack: () => void;
};

export function ExportPage({
  loading,
  error,
  onRetry,
  exports,
  email,
  requesting,
  requestError,
  onRequest,
  onDownload,
  downloading = false,
  downloadError = null,
  onBack,
}: ExportPageProps) {
  const theme = useTheme();

  const latest = exports[0] ?? null;
  const latestState = latest ? exportStateOf(latest) : null;
  const pending = latestState === 'pending';

  // "Earlier" means every row that is not the one being reported on above.
  // Every state of `latest` gets its own card, so the head of the list is
  // always already accounted for — printing it twice would read as two
  // requests on one day, which the one-a-day rule makes impossible.
  const earlier = latest ? exports.slice(1) : [];

  const destination = email ?? 'your account email';

  return (
    <PrivacyPage
      parent="Privacy & data"
      title="Export your data"
      intro={
        pending
          ? undefined
          : `A zip file, emailed to ${destination}. Ask for it here and it is put together on our side.`
      }
      onBack={onBack}>
      {loading ? (
        <View className="mt-6 gap-3 px-gutter">
          <Skeleton className="h-24 w-full rounded-plate" />
          <Skeleton className="h-24 w-full rounded-plate" />
        </View>
      ) : error ? (
        <ErrorState
          compact
          title="Couldn’t read your exports."
          body="Cinch couldn’t reach the record of what you have asked for. Nothing has changed — no request was lost and none was made."
          onRetry={onRetry}
        />
      ) : (
        <>
          {/* ── PD-05 · being put together ─────────────────────────────── */}
          {pending && latest ? (
            <Card padding="xl" className="mx-gutter mt-6">
              <View className="flex-row items-center gap-3">
                <ActivityIndicator size="small" color={theme.accent} />
                <Text variant="body" className="flex-1 font-medium">
                  Being put together
                </Text>
              </View>
              <Text variant="note" className="mt-2">
                {`Requested at ${timeOfDay(latest.requestedAt)}. We will email ${destination} when the file is ready — how long that takes depends on how much is in your closet.`}
              </Text>
            </Card>
          ) : null}

          {/* The finished one, when it is the most recent thing that happened.
              It now carries a download, which it deliberately did not before:
              the archive sits in a bucket with no policies, so a signed-in
              client cannot mint its own URL, and this card used to say so
              rather than draw a button that would lie. The function grew a
              `link` action that redeems the row's `object_path` on request,
              so the button is real — minted per tap, because a signed URL is
              short-lived and one cached here would work for a while and then
              quietly stop. */}
          {latestState === 'ready' && latest ? (
            <Card padding="xl" className="mx-gutter mt-6">
              <Text variant="body" className="font-medium">
                Ready
              </Text>
              <Text variant="note" className="mt-2">
                {[
                  `Emailed to ${destination}`,
                  latest.bytes != null && latest.bytes > 0 ? formatBytes(latest.bytes) : null,
                  latest.expiresAt ? `links work until ${fullDate(latest.expiresAt)}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                .
              </Text>
              {onDownload ? (
                <Button
                  title="Download it here"
                  variant="secondary"
                  className="mt-4"
                  loading={downloading}
                  accessibilityHint="Opens the archive. The link is made fresh each time."
                  onPress={() => onDownload(latest.id)}
                />
              ) : null}
              {downloadError ? (
                <Text variant="note" className="mt-2" style={{ color: theme.accent }}>
                  {downloadError}
                </Text>
              ) : null}
            </Card>
          ) : null}

          {latestState === 'failed' && latest ? (
            <Card padding="xl" className="mx-gutter mt-6">
              <Text variant="body" className="font-medium">
                That export did not finish
              </Text>
              <Text variant="note" className="mt-2">
                {latest.error ??
                  'Something went wrong while it was being put together. Nothing of yours changed — ask again below.'}
              </Text>
            </Card>
          ) : null}

          {/* ── PD-04 · the manifest, and the ask ──────────────────────── */}
          {pending ? null : (
            <>
              <SectionHeader title="What is in the file" className="mb-2 mt-7 px-gutter" />
              <Card className="mx-gutter">
                {MANIFEST_ROWS.map((row, index) => (
                  <ManifestRow
                    key={row.name}
                    name={row.name}
                    body={row.body}
                    first={index === 0}
                  />
                ))}
              </Card>

              <Text variant="noteSmall" className="mt-3.5 px-gutter">
                {FRIENDS_NOT_INCLUDED}
              </Text>

              <View className="mt-6 px-gutter">
                <Button
                  title="Request export"
                  variant="ink"
                  className="h-[52px]"
                  loading={requesting}
                  accessibilityHint="Starts putting your file together. It arrives by email."
                  onPress={onRequest}
                />
              </View>

              {requestError ? (
                // The rpc writes its refusals as sentences for a human — "you
                // can ask for one export a day" — so it is shown as written
                // rather than replaced with a guess at what went wrong.
                <Text
                  variant="note"
                  accessibilityLiveRegion="polite"
                  className="mt-3 px-gutter"
                  style={{ color: theme.critical }}>
                  {requestError}
                </Text>
              ) : null}

              <Text variant="noteSmall" className="mt-3.5 px-gutter">
                {EXPORT_LIMIT_NOTE}
              </Text>
            </>
          )}

          {/* ── Earlier exports ────────────────────────────────────────── */}
          {earlier.length > 0 ? (
            <>
              <SectionHeader title="Earlier exports" className="mb-2 mt-8 px-gutter" />
              <Card className="mx-gutter">
                {earlier.map((row, index) => (
                  <View
                    key={row.id}
                    className={`px-4 py-3.5 ${index === 0 ? '' : 'border-t border-hairline'}`}>
                    <Text variant="body" className="font-medium">
                      {fullDate(row.requestedAt)}
                    </Text>
                    <Text variant="note" className="mt-0.5">
                      {earlierExportLine(row)}
                    </Text>
                  </View>
                ))}
              </Card>

              <View className="mt-4 px-gutter">
                <Rule />
                <Text variant="noteSmall" className="mt-3.5">
                  Expired links cannot be reopened. Ask for a fresh export instead.
                </Text>
              </View>
            </>
          ) : null}
        </>
      )}
    </PrivacyPage>
  );
}
