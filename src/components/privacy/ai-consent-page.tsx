import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { OutlinedAccentButton } from '@/components/privacy/outlined-accent-button';
import { PrivacyPage } from '@/components/privacy/privacy-page';
import { Button, Card, Rule, SectionHeader, Text } from '@/components/ui';
import type { SentItemDetail, SentPhoto } from '@/features/auth/use-ai-privacy';
import {
  CONSENT_FACTS,
  WITHDRAW_CONSEQUENCE,
  WITHOUT_CONSENT,
  WITHOUT_CONSENT_LOST,
  WITHOUT_CONSENT_WORKS,
} from '@/features/privacy/copy';
import { consentStatusLine, fullDate, shortDate } from '@/features/privacy/format';
import { stableImageSource } from '@/features/closet/use-image-urls';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * PD-02 / CN-02 / CN-03 — AI consent, in view.
 *
 * ── The drawn composition ──────────────────────────────────────────────────
 *
 * The consent disclosure re-read rather than re-summarised (the atlas's own
 * rule: "the withdrawal screen shows the original wording, not a summary of
 * it"), then what withdrawal costs, then the button that does it. The wording
 * lives in `features/privacy/copy.ts` beside the citation for every claim.
 *
 * ── CN-02, and what the drawn frame gets wrong about this app ──────────────
 *
 * The declined state gains the pair of lists CN-02 draws — what still works,
 * then what does not, in that order and at that ratio, because the first list
 * is the whole product and the second is three things. The lists themselves are
 * in `copy.ts` with the two corrections this repository forced on them: packing
 * is NOT in the works list, because `packing-brief` refuses without consent
 * exactly as the tagger does, and the stylist chat IS in the lost list, because
 * it stops and `WITHDRAW_CONSEQUENCE` has always said so.
 *
 * Cutouts are in the works list, and that is the correction worth having: they
 * are Apple Vision on the device (`modules/garment-cutout/ios/SubjectLift.swift`)
 * and never depended on consent, so a declined user still gets a garment on a
 * clean ground and fills in the two fields Cinch would have guessed.
 *
 * ── CN-03's toggle, which is not here ──────────────────────────────────────
 *
 * CN-03 draws "Send photographs for reading · On" as a switch. A switch can be
 * flipped back on, and `use-consent.ts:116-119` forbids exactly that: "consent
 * that was withdrawn has to be given again in full, with the disclosure in
 * front of the user, or it is not consent". So withdrawal stays one unfilled
 * oxblood action — which is what CN-03's own annotation asks for, "withdrawal
 * is one 48 pt action ... never dressed as a warning" — and giving it again
 * opens `ConsentSheet`.
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
  /** Opens CN-04. The batch is consented to there, never by this row alone. */
  onOpenBackfill: () => void;

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
  onOpenBackfill,
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
          ? // The row opens CN-04 now; the batch is agreed to there. So the
            // sub-line says what the tap does, not what the back-fill does.
            'Opens the ask. Nothing is sent until you agree to the batch.'
          : 'Available after you give consent.';

  return (
    <PrivacyPage parent="Privacy and data" title="AI consent" intro={intro} onBack={onBack}>
      {/* ── CN-02 · the declined path, drawn as a configuration ──────────── */}
      {granted ? null : (
        <View className="mx-gutter mt-6 gap-2.5">
          <View className="rounded-lg bg-tray p-4">
            <Text variant="body" className="font-medium">
              What still works
            </Text>
            <Text variant="body" className="mt-1" style={{ color: theme.muted }}>
              {WITHOUT_CONSENT_WORKS}
            </Text>
          </View>
          <View className="rounded-lg bg-tray p-4">
            <Text variant="body" className="font-medium">
              What does not
            </Text>
            <Text variant="body" className="mt-1" style={{ color: theme.muted }}>
              {WITHOUT_CONSENT_LOST}
            </Text>
          </View>
        </View>
      )}

      {/* ── What it covers ───────────────────────────────────────────────── */}
      <Card padding="xl" className="mx-gutter mt-6">
        <Text variant="eyebrow">{granted ? 'What it covers' : 'What it would cover'}</Text>
        <View className="mt-3 gap-4">
          {CONSENT_FACTS.map((fact) => (
            // ── The record, at a size a reader can hold to ────────────────
            //
            // One `Text` per fact with the lead nested inside it, so the
            // sentence wraps as ONE sentence. That shape is not a preference:
            // `consent-facts.ts` stores each fact as a bolded opening clause
            // plus the rest of the same sentence, and the privacy page's job is
            // to quote the wording a user agreed to, not to re-cut it.
            //
            // What changed is the size. This was `note` — 13px — and the
            // group's floor is that no legal sentence is set below 15 pt
            // anywhere. It is `body` (17px) now, in `muted`, with the lead in
            // Medium ink: a clause in Medium, never a full sentence.
            //
            // CN-01 draws these as a Medium HEADING plus a separate regular
            // sentence. That shape cannot be built from this record without
            // writing four headings, and four headings on a consent sheet are
            // four new sentences a user never agreed to. See the report.
            <Text key={fact.lead} variant="body" style={{ color: theme.muted }}>
              <Text variant="body" className="font-semibold" style={{ color: theme.ink }}>
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
        <Text variant="body" className="mt-1.5" style={{ color: theme.muted }}>
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

      {/* `callout` (16px), not `noteSmall` (11px). Both of these are sentences
          about a consent decision, and the group's floor is that none of those
          is set below 15 pt. */}
      <Text variant="callout" className="mt-3.5 px-gutter" style={{ color: theme.muted }}>
        {granted
          ? 'You can give it again at any time, from this page.'
          : 'The full disclosure opens first — consent given without reading it is not consent.'}
      </Text>

      {version && grantedAt ? (
        <Text variant="callout" className="mt-1.5 px-gutter" style={{ color: theme.muted }}>
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

      {/* CN-03's "What has been sent". Two counts, not one — see the
          `use-ai-privacy.ts` header for why a single lifetime figure cannot be
          computed honestly, and the report for what that costs CN-03's drawn
          day-by-day log. */}
      <SectionHeader title="What has actually left this phone" className="mb-2 mt-6 px-gutter" />
      <Text variant="body" className="px-gutter" style={{ color: theme.muted }}>
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
          onPress={onOpenBackfill}
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
          <Text variant="callout" className="mt-1" style={{ color: theme.muted }}>
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
          <Text variant="callout" style={{ color: theme.accent }}>
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
            <Text variant="callout" className="mt-3" style={{ color: theme.muted }}>
              Listing searches are not itemised — the record does not say which piece each one was
              about.
            </Text>
          ) : null}
        </View>
      ) : null}
    </PrivacyPage>
  );
}
