import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConsentSheet } from '@/components/ingest/consent-sheet';
import { BackButton } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import {
  useSentItemDetails,
  useSentPhotos,
  useUntaggedCount,
} from '@/features/auth/use-ai-privacy';
import { useAiConsent, useGrantAiConsent, useRevokeAiConsent } from '@/features/auth/use-consent';
import { useCloset } from '@/features/closet/queries';
import { stableImageSource, useSignedUrls } from '@/features/closet/use-image-urls';
import { startBackfill } from '@/features/ingest/upload-queue';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * Privacy — design frame A-06, "the way back".
 *
 * One switch, stating the current state and the date it was set, over the
 * ledger of what actually happened: how many photos have really left the
 * phone (counted from `ai_calls`, the server's own record) and how many items
 * a back-fill would send. The back-fill is a separate, explicit act — flipping
 * the switch NEVER retroactively uploads a closet.
 *
 * Turning ON goes through the full ConsentSheet: a bare toggle would be
 * re-consenting to text last read weeks ago, so the sheet is the only door
 * (use-consent.ts documents why). Turning OFF is one accurate confirmation —
 * friction on the un-sharing direction is a dark pattern, but the dialog must
 * be exact about the blast radius, because the fear that stops people
 * withdrawing consent is not knowing what breaks.
 *
 * While a back-fill runs the untagged count is polled and the card drains in
 * place — quiet numbers, no progress theatre.
 */

/** "12 March" — the app's date voice (profile.tsx's trial line), never a placeholder. */
function sinceDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
}

/** "12 March 2026" — the consent record's fuller form, for the footer. */
function recordedDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** "{n} photos sent." / "1 photo sent." / "No photo has left this phone." */
function sentClause(sent: number): string {
  if (sent === 0) return 'No photo has left this phone.';
  return `${sent} ${sent === 1 ? 'photo' : 'photos'} sent.`;
}

/**
 * The honest state line under the switch label. Every branch is a fact the
 * server can back: dates from the consent record, counts from `ai_calls`.
 */
function statusLine(
  granted: boolean,
  grantedAt: string | null,
  revokedAt: string | null,
  sent: number,
): string {
  if (granted) {
    return grantedAt
      ? `On since ${sinceDate(grantedAt)}. ${sentClause(sent)}`
      : `On. ${sentClause(sent)}`;
  }
  return revokedAt
    ? `Off since ${sinceDate(revokedAt)}. ${sentClause(sent)}`
    : `Off. ${sentClause(sent)}`;
}

/** How often the untagged count is re-asked while a back-fill drains. */
const BACKFILL_POLL_MS = 4000;

export default function PrivacyScreen() {
  const theme = useTheme();
  const router = useRouter();

  const consent = useAiConsent();
  const grantConsent = useGrantAiConsent();
  const revokeConsent = useRevokeAiConsent();
  const sentPhotos = useSentPhotos();
  const closet = useCloset();

  const [consentVisible, setConsentVisible] = useState(false);
  const [sentListOpen, setSentListOpen] = useState(false);
  // idle → sending → done. `sending` is entered only by pressing the card;
  // the switch cannot reach it.
  const [backfill, setBackfill] = useState<'idle' | 'sending' | 'done'>('idle');

  const untagged = useUntaggedCount({
    // Polls only while a send is draining; the count reaching zero stops it.
    refetchInterval:
      backfill === 'sending'
        ? (query) => (query.state.data === 0 ? false : BACKFILL_POLL_MS)
        : false,
  });

  const granted = consent.data?.granted ?? false;
  const untaggedCount = untagged.data ?? null;
  const sentCount = sentPhotos.data?.length ?? null;

  // The drain finishing is what "done" means — every photo the back-fill sent
  // has its tags back. Derived rather than stored: `backfill` stays 'sending'
  // and the phase below reads 'done' the moment the count hits zero, so there
  // is no setState-in-effect race. The card cannot be pressed again from
  // 'done' (it is disabled), so the raw state never needs resetting.
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

  /**
   * The withdrawal the consent sheet promises — moved here from profile.tsx,
   * where the switch used to live. One confirmation, accurate about what
   * stops and what keeps working (both lists are true as written: outfit
   * generation is a local beam search and never needed the network).
   */
  const confirmRevoke = () => {
    Alert.alert(
      'Turn off AI tagging',
      'Nothing more will be sent to our AI provider.\n\nWhat stops: tagging new pieces automatically, the stylist chat, and the AI rewriting your outfit suggestions.\n\nWhat keeps working: your whole closet, everything already tagged, and outfit suggestions — those are built on your phone and never needed the AI.\n\nYou can turn it back on here whenever you like.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Turn off',
          style: 'destructive',
          onPress: () =>
            revokeConsent.mutate(undefined, {
              onError: (err) =>
                Alert.alert(
                  'Could not turn off AI tagging',
                  err instanceof Error
                    ? err.message
                    : 'Something went wrong. Your settings have not changed.',
                ),
            }),
        },
      ],
    );
  };

  const runBackfill = async () => {
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

  // The paragraph under the switch. n = 0 (or unknown) drops the second
  // sentence rather than printing a wrong number — keep honest.
  const paragraph = useMemo(() => {
    const lead = 'Turning this on sends new photos as you add them.';
    if (!untaggedCount) return lead;
    return `${lead} It doesn’t go back through the ${untaggedCount} ${
      untaggedCount === 1 ? 'item' : 'items'
    } already in your closet unless you ask it to.`;
  }, [untaggedCount]);

  // "See what we sent" — the rows behind the footer link.
  const sentIds = useMemo(
    () => (sentPhotos.data ?? []).map((p) => p.itemId),
    [sentPhotos.data],
  );
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

  const stateReady = consent.data !== undefined && sentCount !== null;

  // Footer: only a consent record can be "recorded". After a revoke the
  // version and timestamp are nulled (use-consent.ts) — no record, no line.
  const footerVisible = granted && consent.data?.grantedAt && consent.data?.version;

  const backfillVisible =
    backfillPhase !== 'idle' || (untaggedCount !== null && untaggedCount > 0);
  const backfillActive = granted && backfillPhase === 'idle' && (untaggedCount ?? 0) > 0;

  const backfillTitle =
    backfillPhase === 'done'
      ? 'Done — those photos are tagged'
      : backfill === 'sending'
        ? `Sending ${untaggedCount ?? 0} ${untaggedCount === 1 ? 'photo' : 'photos'}…`
        : `Tag the ${untaggedCount} ${untaggedCount === 1 ? 'item' : 'items'} I already have`;
  const backfillSub =
    backfillPhase === 'done'
      ? 'Their tags are in your closet now.'
      : backfill === 'sending'
        ? 'Tags fill in on each item as they come back.'
        : granted
          ? 'Sends those photos once, then stops.'
          : 'Sends those photos once, then stops. Available after you turn tagging on.';

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      {/* The nav row the atlas draws: back chevron, serif centred title. The
          trailing spacer mirrors the 36pt disc so the title truly centres.
          `pt-5` clears the sheet grabber, as on profile. */}
      <View className="flex-row items-center px-gutter pb-1 pt-5">
        <BackButton onPress={() => router.back()} />
        <Text variant="plate" trim accessibilityRole="header" className="flex-1 text-center">
          Privacy
        </Text>
        <View className="h-9 w-9" />
      </View>

      <ScrollView contentContainerClassName="px-gutter pb-24 pt-6">
        <Text variant="title" trim accessibilityRole="header">
          AI tagging
        </Text>

        {/* The one row — label, the honest state line, the switch. Hairline
            rules top and bottom, per the atlas. */}
        <View className="mt-5 flex-row items-start justify-between gap-4 border-b border-t border-rule py-4">
          <View className="flex-1">
            <Text variant="body">Send photos for tagging</Text>
            <Text
              variant="caption"
              className="mt-1 text-muted"
              style={{ maxWidth: 210 }}>
              {stateReady
                ? statusLine(
                    granted,
                    consent.data?.grantedAt ?? null,
                    consent.data?.revokedAt ?? null,
                    sentCount ?? 0,
                  )
                : 'Checking your setting…'}
            </Text>
          </View>
          {stateReady ? (
            <Switch
              value={granted}
              onValueChange={(next) => {
                if (next) {
                  // Re-granting opens the same full disclosure a new user
                  // sees — that is what records a fresh version and
                  // timestamp. Never a bare toggle-to-on.
                  setConsentVisible(true);
                } else {
                  confirmRevoke();
                }
              }}
              disabled={revokeConsent.isPending || grantConsent.isPending}
              trackColor={{ false: theme.rule, true: theme.ink }}
              accessibilityRole="switch"
              accessibilityState={{ checked: granted }}
              accessibilityLabel="Send photos for tagging"
              accessibilityHint={
                granted
                  ? 'Turns off AI tagging — nothing more is sent'
                  : 'Opens the AI consent details'
              }
            />
          ) : (
            <ActivityIndicator size="small" color={theme.faint} />
          )}
        </View>

        <Text variant="callout" className="mt-5" style={{ color: theme.muted }}>
          {paragraph}
        </Text>

        {/* The back-fill — a separate, explicit act. Inert until tagging is
            on; hidden when there is nothing it would send; drains in place
            once pressed. Never triggered by the switch. */}
        {backfillVisible ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={backfillTitle}
            accessibilityHint={backfillActive ? 'Sends those photos once, then stops' : undefined}
            accessibilityState={{ disabled: !backfillActive, busy: backfillPhase === 'sending' }}
            disabled={!backfillActive}
            onPress={() => void runBackfill()}
            style={{ minHeight: MIN_TAP_TARGET }}
            className={`mt-6 rounded-lg bg-sand p-4 ${backfillActive ? 'active:opacity-60' : ''}`}>
            <View className="flex-row items-center gap-3">
              {backfillPhase === 'sending' ? (
                <ActivityIndicator size="small" color={theme.accent} />
              ) : null}
              <Text variant="body" className="flex-1 font-medium">
                {backfillTitle}
              </Text>
            </View>
            <Text variant="caption" className="mt-1 text-muted">
              {backfillSub}
            </Text>
          </Pressable>
        ) : null}

        {/* The record. Only a live consent has one — after a revoke the
            version and timestamp are nulled, so there is nothing to cite. */}
        {footerVisible ? (
          <Pressable
            accessibilityRole={sentCount ? 'link' : 'text'}
            accessibilityLabel={
              sentCount ? 'See what we sent' : undefined
            }
            onPress={sentCount ? () => setSentListOpen((open) => !open) : undefined}
            disabled={!sentCount}
            style={{ minHeight: MIN_TAP_TARGET }}
            className="mt-7 justify-center border-t border-rule pt-5 active:opacity-60">
            <Text variant="caption" className="text-muted">
              {`Consent recorded ${recordedDate(consent.data!.grantedAt!)}, policy v${consent.data!.version}. `}
              {sentCount ? (
                <Text variant="caption" style={{ color: theme.accent }}>
                  {sentListOpen ? 'Hide the list' : 'See what we sent'}
                </Text>
              ) : null}
            </Text>
          </Pressable>
        ) : null}

        {/* What we sent — one quiet row per item whose photo really went out,
            newest first. Thumb, name, sent date; nothing else to say. */}
        {footerVisible && sentListOpen ? (
          <View className="mt-2">
            {sentDetails.isLoading ? (
              <View className="py-4">
                <ActivityIndicator size="small" color={theme.faint} />
              </View>
            ) : (
              (sentPhotos.data ?? []).map((photo, index) => {
                const detail = sentDetails.data?.[photo.itemId];
                const uri = detail
                  ? thumbs.resolve(detail.cutoutPath, detail.thumbPath)
                  : undefined;
                return (
                  <View
                    key={photo.itemId}
                    className={`flex-row items-center gap-3 py-2.5 ${
                      index > 0 ? 'border-t border-hairline' : ''
                    }`}>
                    <View className="h-12 w-9 overflow-hidden rounded-sm bg-tray">
                      {uri ? (
                        <Image
                          source={stableImageSource(uri)}
                          style={{ width: '100%', height: '100%' }}
                          contentFit="cover"
                          accessibilityIgnoresInvertColors
                        />
                      ) : null}
                    </View>
                    <Text variant="body" className="flex-1" numberOfLines={1}>
                      {detail?.name ?? 'Item'}
                    </Text>
                    <Text variant="caption" className="text-muted">
                      {sinceDate(photo.sentAt)}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        ) : null}
      </ScrollView>

      <ConsentSheet
        visible={consentVisible}
        busy={grantConsent.isPending}
        onAccept={() => {
          grantConsent.mutate(undefined, {
            onSuccess: () => setConsentVisible(false),
            onError: (err) =>
              Alert.alert(
                'Could not turn AI tagging on',
                err instanceof Error
                  ? err.message
                  : 'Something went wrong. Your settings have not changed.',
              ),
          });
        }}
        onDecline={() => setConsentVisible(false)}
      />
    </SafeAreaView>
  );
}
