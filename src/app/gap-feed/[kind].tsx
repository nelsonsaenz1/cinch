import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { gainSentence } from '@/components/gap-feed/gap-prose';
import { ClosetFullSheet } from '@/components/wall/closet-full-sheet';
import { Button, ScreenHeader, Text } from '@/components/ui';
import { Placement } from '@/features/billing/placements';
import { useGate } from '@/features/billing/use-gate';
import { corePreviewRows, gapLabel, gapLabelLower, ordinal } from '@/features/closet/gap-feed';
import { COUNTED_KINDS, type CountedKind } from '@/features/closet/outfit-count';
import { useGapFeed, type GapPiece } from '@/features/closet/use-gap-feed';
import { stableImageSource } from '@/features/closet/use-image-urls';
import { useTheme } from '@/theme/tokens';

/**
 * G-02 — one suggestion, expanded.
 *
 * The outfits are previewed with the user's real garments and a marked
 * absence where the missing piece goes — never a picture of a garment nobody
 * owns. `corePreviewRows` (gap-feed.ts) only ever samples ids the wardrobe
 * actually has; the dashed tile below is drawn by this screen, not sourced.
 */
export default function GapDetailScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { kind: rawKind } = useLocalSearchParams<{ kind: string }>();
  const kind: CountedKind = (COUNTED_KINDS as readonly string[]).includes(rawKind ?? '')
    ? (rawKind as CountedKind)
    : 'shoes';

  const model = useGapFeed();
  const gate = useGate();
  const [gatePresenting, setGatePresenting] = useState(false);
  const [locked, setLocked] = useState(false);

  const gain = model.ranked.find((g) => g.kind === kind);

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
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader align="leading" onBack={() => router.back()} />

      <ScrollView contentContainerClassName="px-gutter pb-10">
        <Text variant="eyebrow" className="mb-1.5">
          {`The gap · ${kind}`}
        </Text>
        <Text variant="title" trim style={{ fontSize: 32, lineHeight: 36 }}>
          {model.ready ? gapLabel(model.tally, kind) : '…'}
        </Text>
        {gain ? (
          // Audit 85 reaches this screen too: the old line printed a delta with
          // a unit but no base ("7 outfits you don't have yet"), which is half
          // a fact. `gainSentence` names the unit and both endpoints, from the
          // same `countOutfits()` the card above it read.
          <Text variant="body" className="mt-2" style={{ color: theme.muted }}>
            {`${gainSentence(model.tally, gain)} Here ${
              rows.shown.length === 1 ? 'is one of them' : `are ${rows.shown.length} of them`
            }.`}
          </Text>
        ) : null}

        <View className="mt-4" style={{ gap: 8 }}>
          {rows.shown.map((row, i) => (
            <View
              key={i}
              className="flex-row items-center gap-2 rounded-md border border-rule bg-surface px-3 py-2.5">
              {row.map((piece) => (
                <View key={piece.id} className="h-[54px] w-[54px] overflow-hidden rounded-lg bg-tray">
                  {piece.imageUri ? (
                    <Image
                      source={stableImageSource(piece.imageUri)}
                      contentFit="contain"
                      style={{ flex: 1, padding: 3 }}
                      cachePolicy="memory-disk"
                      accessibilityIgnoresInvertColors
                    />
                  ) : null}
                </View>
              ))}
              {/* The marked absence — never a rendered or sourced picture. */}
              <View
                className="h-[54px] w-[54px] items-center justify-center rounded-lg border border-dashed"
                style={{ borderColor: theme.accent, backgroundColor: theme.blush }}>
                <Text variant="caption" style={{ fontSize: 11, lineHeight: 13, color: theme.accent, textAlign: 'center' }}>
                  {`the\n${kind === 'shoes' ? 'shoes' : kind === 'dresses' ? 'dress' : kind.slice(0, -1)}`}
                </Text>
              </View>
              <View className="flex-1 items-end">
                <Text variant="caption" style={{ textAlign: 'right' }}>
                  {row.map((p) => p.name).join(' & ')}
                </Text>
              </View>
            </View>
          ))}
          {/* `muted`, never `faint`: #8A8578 fails AA as type on canvas. */}
          {rows.more > 0 ? (
            <Text variant="label" className="pl-1" style={{ color: theme.muted }}>
              {`and ${rows.more} more`}
            </Text>
          ) : null}
        </View>

        <View className="mt-6 rounded-[16px] border border-rule bg-surface px-4 py-4">
          {model.capacity.full ? (
            <>
              <Text variant="body" style={{ color: theme.muted }}>
                {`Your closet is full at ${model.capacity.limit}. Adding this needs room for the ${ordinal(model.capacity.limit + 1)} piece.`}
              </Text>
              <Button title="See plans" variant="primary" className="mt-3" loading={gatePresenting} onPress={() => setLocked(true)} />
            </>
          ) : (
            <>
              <Text variant="body" style={{ color: theme.muted }}>
                There’s room in your closet for this one.
              </Text>
              <Button
                title="Add clothes"
                variant="primary"
                className="mt-3"
                onPress={() => router.push('/add-clothes')}
              />
            </>
          )}
        </View>
      </ScrollView>

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
        body="Two ways forward, and neither loses anything you've photographed."
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
