import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { OutlinedAccentButton } from '@/components/privacy/outlined-accent-button';
import { PrivacyPage } from '@/components/privacy/privacy-page';
import { Button, Card, Rule, SectionHeader, Text } from '@/components/ui';
import type { SentItemDetail, SentPhoto } from '@/features/auth/use-ai-privacy';
import { CONSENT_FACTS, WITHDRAW_CONSEQUENCE, WITHOUT_CONSENT } from '@/features/privacy/copy';
import { consentStatusLine, fullDate, shortDate } from '@/features/privacy/format';
import { stableImageSource } from '@/features/closet/use-image-urls';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * PD-02 — AI consent, in view.
 *
 * ── The drawn composition ──────────────────────────────────────────────────
 *
 * The consent disclosure re-read rather than re-summarised (the atlas's own
 * rule: "the withdrawal screen shows the original wording, not a summary of
 * it"), then what withdrawal costs, then the button that does it. The wording
 * lives in `features/privacy/copy.ts` beside the citation for every claim.
 *
 * ── The state the atlas does not draw ──────────────────────────────────────
 *
 * The atlas draws only the granted state, which leaves the page undefined for
 * anyone who declined at first run or withdrew last week — and that is a large
 * fraction of the people who would come looking. So the not-granted state is
 * defined here: the same disclosure, in the conditional, an honest line saying
 * it has not been given, and a way to give it.
 *
 * THAT WAY IS `ConsentSheet`, NEVER A BARE TOGGLE. `use-consent.ts:116-119` is
 * explicit: "consent that was withdrawn has to be given again in full, with the
 * disclosure in front of the user, or it is not consent". A switch here would
 * be re-consenting to text last read weeks ago.
 *
 * ── The two truthful things the atlas does not draw either ─────────────────
 *
 * The back-fill and the "See what we sent" ledger both exist on the shipping
 * privacy screen and both stay, in a clearly separate section further down the
 * scroll. Removing truthful disclosure from the page whose purpose is
 * disclosure would be a regression, and neither has anywhere else to live.
 *
 * Purely presentational — props in, callbacks out. `dev-privacy.tsx` drives
 * every branch from fixtures.
 */

export type AiConsentPageProps = {
  granted: boolean;
  /** False while the consent record or the counts are still being read. */
  ready: boolean;
  grantedAt: string | null;
  revokedAt: string | null;
  /** The policy version on record — only a live consent has one. */
  version: number | null;

  /** Items whose photo went to the tagger. */
  taggedCount: number;
  /** Listing searches — the second door. Counted, never added to the first. */
  listingCount: number;

  /** Items with no AI tags, or null while unread. */
  untaggedCount: number | null;
  backfillPhase: 'idle' | 'sending' | 'done';
  onRunBackfill: () => void;

  sentListOpen: boolean;
  onToggleSentList: () => void;
  sentPhotos: SentPhoto[];
  sentDetails: Record<string, SentItemDetail> | undefined;
  sentDetailsLoading: boolean;
  /** Cutout first, thumb second — the closet's own resolution order. */
  resolveThumb: (cutoutPath: string | null, thumbPath: string | null) => string | undefined;

  onBack: () => void;
  onWithdraw: () => void;
  onGive: () => void;
  busy?: boolean;
};

export function AiConsentPage({
  granted,
  ready,
  grantedAt,
  revokedAt,
  version,
  taggedCount,
  listingCount,
  untaggedCount,
  backfillPhase,
  onRunBackfill,
  sentListOpen,
  onToggleSentList,
  sentPhotos,
  sentDetails,
  sentDetailsLoading,
  resolveThumb,
  onBack,
  onWithdraw,
  onGive,
  busy = false,
}: AiConsentPageProps) {
  const theme = useTheme();

  const intro = !ready
    ? 'Reading your setting…'
    : granted
      ? grantedAt
        ? `You agreed to this on ${fullDate(grantedAt)}. The wording below is the same wording you saw then.`
        : 'You have agreed to this. The wording below is the same wording you saw.'
      : revokedAt
        ? `You have not given this. Nothing has been sent since you withdrew it on ${fullDate(revokedAt)}. Here is what it would cover.`
        : 'You have not given this, so nothing is being sent. Here is what it would cover.';

  // The back-fill is offered only when there is something for it to send, and
  // it is inert until tagging is on — a row that appears out of nowhere after a
  // toggle is a worse surprise than one that waits (settings-row.tsx's rule).
  const backfillVisible = backfillPhase !== 'idle' || (untaggedCount ?? 0) > 0;
  const backfillActive = granted && backfillPhase === 'idle' && (untaggedCount ?? 0) > 0;

  const backfillTitle =
    backfillPhase === 'done'
      ? 'Done — those photos are tagged'
      : backfillPhase === 'sending'
        ? `Sending ${untaggedCount ?? 0} ${untaggedCount === 1 ? 'photo' : 'photos'}…`
        : `Tag the ${untaggedCount} ${untaggedCount === 1 ? 'item' : 'items'} I already have`;

  const backfillSub =
    backfillPhase === 'done'
      ? 'Their tags are in your closet now.'
      : backfillPhase === 'sending'
        ? 'Tags fill in on each item as they come back.'
        : granted
          ? 'Sends those photos once, then stops.'
          : 'Sends those photos once, then stops. Available after you give consent.';

  return (
    <PrivacyPage parent="Privacy & data" title="AI consent" intro={intro} onBack={onBack}>
      {/* ── What it covers ───────────────────────────────────────────────── */}
      <Card padding="xl" className="mx-gutter mt-6">
        <Text variant="eyebrow">{granted ? 'What it covers' : 'What it would cover'}</Text>
        <View className="mt-3 gap-3">
          {CONSENT_FACTS.map((fact) => (
            // One Text per paragraph with the lead nested inside it, so the
            // sentence wraps as one sentence. `note` for the body: `label` and
            // `caption` carry `font-medium` and would render the atlas's
            // regular weight as bold.
            <Text key={fact.lead} variant="note">
              <Text variant="note" className="font-semibold" style={{ color: theme.ink }}>
                {fact.lead}
              </Text>
              {fact.rest}
            </Text>
          ))}
        </View>
      </Card>

      {/* ── The cost, stated before the button ───────────────────────────── */}
      <View className="mx-gutter mt-4 rounded-lg bg-tray p-4">
        <Text variant="body" className="font-medium">
          {granted ? 'If you withdraw' : 'Without it'}
        </Text>
        <Text variant="note" className="mt-1.5">
          {granted ? WITHDRAW_CONSEQUENCE : WITHOUT_CONSENT}
        </Text>
      </View>

      <View className="mt-6 px-gutter">
        {granted ? (
          <OutlinedAccentButton
            title="Withdraw consent"
            hint="Opens a confirmation. Nothing is withdrawn until you confirm."
            loading={busy}
            disabled={!ready}
            onPress={onWithdraw}
          />
        ) : (
          <Button
            title="Give AI consent"
            variant="ink"
            className="h-[52px]"
            disabled={!ready}
            accessibilityHint="Opens the full disclosure. Nothing is sent until you accept it."
            onPress={onGive}
          />
        )}
      </View>

      <Text variant="noteSmall" className="mt-3.5 px-gutter">
        {granted
          ? 'You can give it again at any time, from this page.'
          : 'The full disclosure opens first — consent given without reading it is not consent.'}
      </Text>

      {version && grantedAt ? (
        <Text variant="noteSmall" className="mt-1.5 px-gutter">
          {`Consent recorded ${fullDate(grantedAt)}, policy v${version}.`}
        </Text>
      ) : null}

      {/* ═══ Below the drawn composition ══════════════════════════════════
          Everything from here down is the shipping screen's own disclosure,
          kept because taking it off this page would be a regression. Ruled
          off and re-headed so it reads as a second section rather than a
          continuation of the consent text. */}
      <View className="mt-9 px-gutter">
        <Rule />
      </View>

      <SectionHeader title="What has actually left this phone" className="mb-2 mt-6 px-gutter" />
      <Text variant="note" className="px-gutter">
        {ready
          ? consentStatusLine(granted, grantedAt, revokedAt, taggedCount, listingCount)
          : 'Counting…'}
      </Text>

      {/* The back-fill — a separate, explicit act. Giving consent NEVER
          retroactively uploads a closet; only this does. */}
      {backfillVisible ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={backfillTitle}
          accessibilityHint={backfillActive ? 'Sends those photos once, then stops' : undefined}
          accessibilityState={{ disabled: !backfillActive, busy: backfillPhase === 'sending' }}
          disabled={!backfillActive}
          onPress={onRunBackfill}
          style={{ minHeight: MIN_TAP_TARGET }}
          className={`mx-gutter mt-4 rounded-lg bg-sand p-4 ${
            backfillActive ? 'active:opacity-60' : ''
          }`}>
          <View className="flex-row items-center gap-3">
            {backfillPhase === 'sending' ? (
              <ActivityIndicator size="small" color={theme.accent} />
            ) : null}
            <Text variant="body" className="flex-1 font-medium">
              {backfillTitle}
            </Text>
          </View>
          <Text variant="note" className="mt-1">
            {backfillSub}
          </Text>
        </Pressable>
      ) : null}

      {/* The ledger. One quiet row per item whose photo really went out. */}
      {sentPhotos.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={sentListOpen ? 'Hide the list' : 'See what we sent'}
          onPress={onToggleSentList}
          style={{ minHeight: MIN_TAP_TARGET }}
          className="mx-gutter mt-4 justify-center active:opacity-60">
          <Text variant="note" style={{ color: theme.accent }}>
            {sentListOpen ? 'Hide the list' : 'See what we sent'}
          </Text>
        </Pressable>
      ) : null}

      {sentListOpen ? (
        <View className="mx-gutter mt-1">
          {sentDetailsLoading ? (
            <View className="py-4">
              <ActivityIndicator size="small" color={theme.muted} />
            </View>
          ) : (
            sentPhotos.map((photo, index) => {
              const detail = sentDetails?.[photo.itemId];
              const uri = detail
                ? resolveThumb(detail.cutoutPath, detail.thumbPath)
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
                  <Text variant="note">{shortDate(photo.sentAt)}</Text>
                </View>
              );
            })
          )}
          {/* Why the second door has no rows. Said here rather than left as a
              gap the reader has to notice: `garment-search` records no
              `item_id`, so a listing send cannot be tied back to a piece. */}
          {listingCount > 0 ? (
            <Text variant="noteSmall" className="mt-3">
              Listing searches are not itemised — the record does not say which piece each one was
              about.
            </Text>
          ) : null}
        </View>
      ) : null}
    </PrivacyPage>
  );
}
