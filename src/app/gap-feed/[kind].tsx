import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AbsenceWell, OwnedWell, useAx } from '@/components/gap-feed/gap-feed-parts';
import { gainSentence, gapEvidence } from '@/components/gap-feed/gap-prose';
import { Button, ScreenHeader, Text } from '@/components/ui';
import { ClosetFullSheet } from '@/components/wall/closet-full-sheet';
import { Placement } from '@/features/billing/placements';
import { useGate } from '@/features/billing/use-gate';
import { corePreviewRows, gapLabel, gapLabelLower, ordinal } from '@/features/closet/gap-feed';
import {
  GAP_FEED_COPY,
  TILE,
  TYPE,
  absenceNoun,
  rankEyebrow,
} from '@/features/closet/gap-feed-spec';
import { COUNTED_KINDS, type CountedKind } from '@/features/closet/outfit-count';
import { useGapFeed, type GapPiece } from '@/features/closet/use-gap-feed';
import { useTheme } from '@/theme/tokens';

/**
 * One computed gap, expanded. Redesign 26.
 *
 * The outfits are previewed with the user's real garments and a marked absence
 * where the missing piece goes — never a picture of a garment nobody owns.
 * `corePreviewRows` (`features/closet/gap-feed.ts`) only ever samples ids the
 * wardrobe actually has; the dashed well beside them is drawn by
 * `AbsenceWell`, from a noun and a border.
 *
 * ── WHAT REDESIGN 26 CHANGED ───────────────────────────────────────────────
 *
 * The outfit rows become the body of the page rather than a list inside it:
 * three equal wells per row in the feed card's own geometry, with the caption
 * moved UNDER the row where it can name both garments in full instead of being
 * squeezed into a right-aligned column. The primary action leaves its bordered
 * box and becomes a full-width filled control pinned under a one-line
 * statement of the capacity fact, which is the frame's composition and also the
 * honest reading order: what is true, then what you can do about it.
 *
 * ── "SEE PLANS" FIRES EXACTLY AS SHIPPED ───────────────────────────────────
 *
 * RESTYLE ONLY. The button is the same button: it sets `locked`, which presents
 * `ClosetFullSheet`, whose `onSeePlans` calls
 * `gate.present(Placement.AddGarmentOverLimit)`. Same placement key, same
 * trigger, same routing, same busy state, same cancellation path. Nothing about
 * the money door moved — only its fill, its width and the line above it.
 *
 * The artifact draws a THIRD action on that sheet ("Not now") and a different
 * title. `ClosetFullSheet` is a shared component belonging to another lane —
 * The Wall and Add clothes present it too — and the wave builds on disjoint
 * files, so its chrome is left alone and reported rather than edited from here.
 *
 * ── THE PAYWALL'S TWO RETURNS ──────────────────────────────────────────────
 *
 * `gate.present` resolves whether the user bought or cancelled, and this screen
 * cannot tell which. So the return state says only what it knows: nothing
 * changed, and the door is still here. It is NOT reported as a failure — a
 * cancellation is a decision, and dressing it as an error is how a paywall
 * teaches people to distrust the screen that opened it.
 */
export default function GapDetailScreen() {
  const router = useRouter();
  const theme = useTheme();
  const ax = useAx();
  const { kind: rawKind } = useLocalSearchParams<{ kind: string }>();
  const kind: CountedKind = (COUNTED_KINDS as readonly string[]).includes(rawKind ?? '')
    ? (rawKind as CountedKind)
    : 'shoes';

  const model = useGapFeed();
  const gate = useGate();
  const [gatePresenting, setGatePresenting] = useState(false);
  const [gateReturned, setGateReturned] = useState(false);
  const [locked, setLocked] = useState(false);

  const gain = model.ranked.find((g) => g.kind === kind);
  const rank = model.ranked.findIndex((g) => g.kind === kind);

  const byKind = useMemo(() => {
    const shown = COUNTED_KINDS.filter((k) => k !== kind);
    const out: Partial<Record<CountedKind, GapPiece[]>> = {};
    for (const k of shown) out[k] = model.pairingsFor(k, 999).shown;
    return out;
  }, [kind, model]);

  const rows = corePreviewRows<GapPiece>(kind, byKind, gain?.gain ?? 0, 3);

  const seePlans = () => {
    setGatePresenting(true);
    void gate.present(Placement.AddGarmentOverLimit).finally(() => {
      setGatePresenting(false);
      setLocked(false);
      setGateReturned(true);
    });
  };

  const wellHeight = ax ? TILE.axHeight : TILE.detailHeight;
  const evidence = gain ? gapEvidence(model.tally, gain) : null;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top', 'bottom']}>
      <ScreenHeader align="leading" onBack={() => router.back()} />

      <ScrollView contentContainerClassName="px-gutter pb-6">
        <Text
          variant="eyebrow"
          style={{
            fontSize: ax ? TYPE.eyebrowAx : TYPE.eyebrow,
            letterSpacing: TYPE.eyebrowTracking,
            color: theme.accent,
          }}>
          {rankEyebrow(rank)}
        </Text>
        <Text
          variant="title"
          trim
          className="mt-2"
          style={{
            fontSize: ax ? TYPE.headlineAx : TYPE.detailTitle,
            lineHeight: ax ? TYPE.headlineAx + 4 : TYPE.detailTitleLineHeight,
          }}>
          {model.ready ? gapLabel(model.tally, kind) : '…'}
        </Text>

        {gain ? (
          // Audit 85 reaches this screen too: the old line printed a delta with
          // a unit but no base ("7 outfits you don't have yet"), which is half
          // a fact. `gainSentence` names the unit and both endpoints, from the
          // same `countOutfits()` the feed card read. The EVIDENCE sentence
          // lives here rather than on the card, because the card now says it
          // with the imagery instead.
          <Text
            variant="body"
            className="mt-3"
            style={{
              color: theme.muted,
              fontSize: ax ? TYPE.supportingAx : TYPE.supporting,
              lineHeight: ax ? TYPE.supportingAxLineHeight : TYPE.supportingLineHeight,
            }}>
            {evidence ? `${evidence} ${gainSentence(model.tally, gain)}` : gainSentence(model.tally, gain)}
          </Text>
        ) : null}

        <View className="mt-5" style={{ gap: 18 }}>
          {rows.shown.map((row, i) => (
            <View key={i}>
              <View
                className="flex-row"
                style={{ gap: TILE.gap }}
                accessibilityElementsHidden
                importantForAccessibility="no">
                {row.map((piece) => (
                  <OwnedWell key={piece.id} piece={piece} height={wellHeight} />
                ))}
                {/* The marked absence — never a rendered or sourced picture. */}
                <AbsenceWell noun={absenceNoun(kind)} height={wellHeight} />
              </View>
              <Text
                variant="body"
                className="mt-2"
                style={{
                  color: theme.muted,
                  fontSize: ax ? 18 : 15,
                  lineHeight: ax ? 26 : 21,
                }}>
                {GAP_FEED_COPY.detail.rowCaption(row.map((p) => p.name))}
              </Text>
            </View>
          ))}

          {/* `muted`, never `faint`: #8A8578 fails AA as type on canvas. */}
          {rows.more > 0 ? (
            <Text variant="body" style={{ color: theme.muted, fontSize: ax ? 18 : 15 }}>
              {GAP_FEED_COPY.detail.more(rows.more)}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      {/* The pinned footer. One line of fact, then one full-width action. */}
      <View
        className="px-gutter pb-2 pt-3"
        style={{ borderTopWidth: 1, borderTopColor: theme.hairline }}>
        {gateReturned && !gatePresenting ? (
          <Text variant="body" className="mb-2" style={{ color: theme.muted, lineHeight: 22 }}>
            {GAP_FEED_COPY.detail.cancelled}
          </Text>
        ) : (
          <Text variant="body" className="mb-2" style={{ color: theme.muted, lineHeight: 22 }}>
            {model.capacity.full
              ? GAP_FEED_COPY.detail.full(model.capacity.limit)
              : GAP_FEED_COPY.detail.room}
          </Text>
        )}

        {model.capacity.full ? (
          <Button
            title={
              gatePresenting ? GAP_FEED_COPY.detail.presenting : GAP_FEED_COPY.detail.plansAction
            }
            variant="primary"
            loading={gatePresenting}
            onPress={() => setLocked(true)}
          />
        ) : (
          <Button
            title={GAP_FEED_COPY.detail.addAction}
            variant="primary"
            onPress={() => router.push('/add-clothes')}
          />
        )}
      </View>

      {/* Audit 85 again: no bare "+7" survives on this screen either. The
          eyebrow names the two endpoints the sheet's decision is about. */}
      <ClosetFullSheet
        visible={locked}
        eyebrow={
          gain
            ? `${gapLabelLower(model.tally, kind)} · ${gain.total - gain.gain} to ${gain.total} outfit cores`
            : gapLabelLower(model.tally, kind)
        }
        title={`Your closet holds ${model.capacity.limit}. This would be the ${ordinal(model.capacity.limit + 1)}.`}
        body="Two ways forward, and neither loses anything you’ve photographed."
        onSeePlans={seePlans}
        seePlansBusy={gatePresenting}
        secondaryLabel="Swap a piece out instead"
        onSecondary={() => {
          setLocked(false);
          router.push(`/wall-swap?add=${kind}`);
        }}
        footnote={`Swapping keeps your ${model.capacity.limit} at ${model.capacity.limit}. The suggestion stays here either way.`}
        onDismiss={() => setLocked(false)}
      />
    </SafeAreaView>
  );
}
