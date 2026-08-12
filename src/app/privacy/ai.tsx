import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { AiConsentPage } from '@/components/privacy/ai-consent-page';
import { BackfillSheet } from '@/components/privacy/backfill-sheet';
import { WithdrawConsentSheet } from '@/components/privacy/withdraw-consent-sheet';
import { ConsentSheet } from '@/components/ingest/consent-sheet';
import {
  useListingSendCount,
  useSentItemDetails,
  useSentPhotos,
  useUntaggedCount,
} from '@/features/auth/use-ai-privacy';
import { useAiConsent, useGrantAiConsent, useRevokeAiConsent } from '@/features/auth/use-consent';
import { useCloset } from '@/features/closet/queries';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { startBackfill } from '@/features/ingest/upload-queue';

/**
 * PD-02 / PD-03 — AI consent, and the sheet that withdraws it.
 *
 * The wiring only; the page is `components/privacy/ai-consent-page.tsx` and
 * every sentence on it is in `features/privacy/copy.ts` beside its citation.
 *
 * Two rules this route exists to hold:
 *
 *   1. Giving consent goes through `ConsentSheet` and never a bare control.
 *      `use-consent.ts:116-119` — consent that was withdrawn has to be given
 *      again in full, with the disclosure in front of the user, or it is not
 *      consent.
 *   2. The back-fill is entered by pressing the back-fill, and by nothing
 *      else. Giving consent must never retroactively upload a closet.
 */

/** How often the untagged count is re-asked while a back-fill drains. */
const BACKFILL_POLL_MS = 4000;

export default function AiConsentScreen() {
  const router = useRouter();

  const consent = useAiConsent();
  const grantConsent = useGrantAiConsent();
  const revokeConsent = useRevokeAiConsent();
  const sentPhotos = useSentPhotos();
  const listingSends = useListingSendCount();
  const closet = useCloset();

  const [consentVisible, setConsentVisible] = useState(false);
  const [withdrawVisible, setWithdrawVisible] = useState(false);
  // CN-04. The row opens this; this starts the send. Rule 2 below is why the
  // two are separate: the batch is a bigger question than the setting, and it
  // gets its own ask with its own count.
  const [backfillVisible, setBackfillVisible] = useState(false);
  const [sentListOpen, setSentListOpen] = useState(false);
  // idle → sending → done. `sending` is entered only by pressing the card.
  const [backfill, setBackfill] = useState<'idle' | 'sending' | 'done'>('idle');

  const untagged = useUntaggedCount({
    // Polls only while a send is draining; the count reaching zero stops it.
    refetchInterval:
      backfill === 'sending'
        ? (query) => (query.state.data === 0 ? false : BACKFILL_POLL_MS)
        : false,
  });

  const granted = consent.data?.granted ?? false;

  // The drain finishing is what "done" means. Derived rather than stored, so
  // there is no setState-in-effect race: `backfill` stays 'sending' and the
  // phase below reads 'done' the moment the count hits zero.
  const drained = backfill === 'sending' && untagged.data === 0;
  const backfillPhase: 'idle' | 'sending' | 'done' = drained ? 'done' : backfill;

  // The closet is refetched once on drain so the new tags are on the grid the
  // moment the user goes looking for them.
  useEffect(() => {
    if (drained) {
      void closet.refetch();
      void sentPhotos.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drained]);

  const runBackfill = async () => {
    setBackfillVisible(false);
    setBackfill('sending');
    try {
      const { enqueued } = await startBackfill();
      if (enqueued === 0) {
        // Nothing needed sending after all — the count query was stale.
        setBackfill('done');
        void untagged.refetch();
      }
    } catch (err) {
      setBackfill('idle');
      Alert.alert(
        'Could not start tagging',
        err instanceof Error ? err.message : 'Something went wrong. Nothing was sent.',
      );
    }
  };

  const sentIds = useMemo(() => (sentPhotos.data ?? []).map((p) => p.itemId), [sentPhotos.data]);
  const sentDetails = useSentItemDetails(sentIds, sentListOpen);
  const thumbPaths = useMemo(
    () =>
      sentListOpen
        ? sentIds.flatMap((id) => {
            const d = sentDetails.data?.[id];
            return d ? [d.thumbPath, d.cutoutPath] : [];
          })
        : [],
    [sentListOpen, sentIds, sentDetails.data],
  );
  const thumbs = useSignedUrls(thumbPaths);

  const ready =
    consent.data !== undefined && sentPhotos.data !== undefined && listingSends.data !== undefined;

  return (
    <>
      <AiConsentPage
        granted={granted}
        ready={ready}
        grantedAt={consent.data?.grantedAt ?? null}
        revokedAt={consent.data?.revokedAt ?? null}
        version={consent.data?.version ?? null}
        taggedCount={sentPhotos.data?.length ?? 0}
        listingCount={listingSends.data ?? 0}
        untaggedCount={untagged.data ?? null}
        backfillPhase={backfillPhase}
        onOpenBackfill={() => setBackfillVisible(true)}
        sentListOpen={sentListOpen}
        onToggleSentList={() => setSentListOpen((open) => !open)}
        sentPhotos={sentPhotos.data ?? []}
        sentDetails={sentDetails.data}
        sentDetailsLoading={sentListOpen && sentDetails.isLoading}
        resolveThumb={(cutoutPath, thumbPath) => thumbs.resolve(cutoutPath, thumbPath)}
        onBack={() => router.back()}
        onWithdraw={() => setWithdrawVisible(true)}
        onGive={() => setConsentVisible(true)}
        busy={revokeConsent.isPending}
      />

      {/* CN-04 — the batch, asked for separately from the setting. Rendered
          only with a real count: the sheet's whole content is that number, and
          a sheet that opened saying "0 pieces" would be a control with nothing
          to do. */}
      <BackfillSheet
        visible={backfillVisible && (untagged.data ?? 0) > 0}
        count={untagged.data ?? 0}
        onRunBackfill={() => void runBackfill()}
        onCancel={() => setBackfillVisible(false)}
      />

      {/* PD-03. */}
      <WithdrawConsentSheet
        visible={withdrawVisible}
        busy={revokeConsent.isPending}
        onCancel={() => setWithdrawVisible(false)}
        onWithdraw={() =>
          revokeConsent.mutate(undefined, {
            onSuccess: () => setWithdrawVisible(false),
            onError: (err) => {
              setWithdrawVisible(false);
              Alert.alert(
                'Could not withdraw consent',
                err instanceof Error
                  ? err.message
                  : 'Something went wrong. Your settings have not changed.',
              );
            },
          })
        }
      />

      {/* The only door back to "on": the full disclosure, which is what
          records a fresh version and timestamp. */}
      <ConsentSheet
        visible={consentVisible}
        busy={grantConsent.isPending}
        onAccept={() =>
          grantConsent.mutate(undefined, {
            onSuccess: () => setConsentVisible(false),
            onError: (err) =>
              Alert.alert(
                'Could not turn AI tagging on',
                err instanceof Error
                  ? err.message
                  : 'Something went wrong. Your settings have not changed.',
              ),
          })
        }
        onDecline={() => setConsentVisible(false)}
      />
    </>
  );
}
