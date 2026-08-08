import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GapCard } from '@/components/gap-feed/gap-card';
import { ClosetFullSheet } from '@/components/wall/closet-full-sheet';
import { Button, EmptyState, ErrorState, ScreenHeader, Text } from '@/components/ui';
import { Placement } from '@/features/billing/placements';
import { useGate } from '@/features/billing/use-gate';
import { gapLabelLower, ordinal, swapAdvice } from '@/features/closet/gap-feed';
import type { CountedKind } from '@/features/closet/outfit-count';
import { useGapFeed } from '@/features/closet/use-gap-feed';
import { useTheme } from '@/theme/tokens';

/**
 * The Gap Feed — Directive 3, states G-01 through G-05.
 *
 * "What one more piece would do" — ranked, computed, fully legible. Nothing
 * is blurred, greyed or teased; the lock is a stated fact in each card's
 * colophon row (G-03's treatment, built into `GapCard` itself) and in this
 * screen's own footer, never a padlock badge or a scrim.
 *
 * G-05 (one gap dominates) is not a separate route — it's the same screen,
 * branching on `useGapFeed().dominant`, which is null for an ordinary
 * balanced closet and the tied leaders for an unbalanced one. The feed never
 * pads a dominant closet out with weak suggestions to look full.
 */
export default function GapFeedScreen() {
  const router = useRouter();
  const theme = useTheme();
  const model = useGapFeed();
  const gate = useGate();
  const [gatePresenting, setGatePresenting] = useState(false);
  const [lockedKind, setLockedKind] = useState<CountedKind | null>(null);

  const openDetail = (kind: CountedKind) => router.push(`/gap-feed/${kind}`);

  const seePlans = () => {
    setGatePresenting(true);
    void gate.present(Placement.AddGarmentOverLimit).finally(() => {
      setGatePresenting(false);
      setLockedKind(null);
    });
  };

  const swapInstead = () => {
    const kind = lockedKind;
    setLockedKind(null);
    if (kind) router.push(`/wall-swap?add=${kind}`);
  };

  let body: React.ReactNode;

  if (model.error) {
    body = (
      <ErrorState
        title="Couldn't read your closet"
        body="Check your connection and try again."
        onRetry={model.refetch}
      />
    );
  } else if (model.loading && !model.ready) {
    body = (
      <View className="flex-1 items-center justify-center px-gutter">
        <Text variant="label">Reading your closet…</Text>
      </View>
    );
  } else if (model.outfitsToday === 0 && model.ranked.every((g) => g.gain === 0)) {
    // Nothing to rank yet — a closet too small or too empty to have a gap
    // worth naming. Honest rather than padded with a suggestion that gains
    // nothing.
    body = (
      <EmptyState
        symbol="sparkles"
        title="Nothing to suggest yet"
        body="Add a few more pieces and Cinch can work out what one more would unlock."
      />
    );
  } else {
    const lock = model.capacity.full
      ? { used: model.capacity.used, limit: model.capacity.limit }
      : undefined;

    const cards = model.dominant ?? model.ranked.slice(0, 3);
    const isDominant = model.dominant !== null;

    body = (
      <ScrollView contentContainerClassName="px-gutter pb-10" contentContainerStyle={{ gap: 10 }}>
        <View className="pt-2">
          {/* `muted`, not the atlas's literal `faint` — `faint` is ~3.5:1 on
              canvas and fails AA as text (standing refusal #1); `eyebrow`'s
              own colour already carries `muted`. */}
          <Text
            variant="eyebrow"
            style={{ fontFamily: 'ui-monospace', letterSpacing: 1.2 }}
            className="mb-1.5">
            {`Your closet · ${model.capacity.used} ${model.capacity.used === 1 ? 'piece' : 'pieces'} · ${model.outfitsToday} ${model.outfitsToday === 1 ? 'outfit' : 'outfits'}`}
          </Text>
          {/* No `mt-*` here — it cancels against the trim on a serif Text.
              The gap lives on the eyebrow's `mb-1.5` above instead. */}
          <Text variant="title" trim style={{ fontSize: 30, lineHeight: 34 }}>
            {isDominant ? 'One piece is doing all the work' : 'What one more piece would do'}
          </Text>
          {/* `style`, never a second `text-*` class: `variant="body"` already
              carries `text-ink`, and NativeWind resolves two colour utilities
              on one element by key order, not by intent. */}
          <Text variant="body" className="mt-2" style={{ color: theme.muted }}>
            {isDominant
              ? 'Nearly every outfit you have runs through the same piece.'
              : 'Worked out from what you own. Ranked by how many new outfits each would actually make.'}
          </Text>
        </View>

        {cards.map((gain, i) => (
          <GapCard
            key={gain.kind}
            gain={gain}
            tally={model.tally}
            pairings={model.pairingsFor(gain.kind)}
            large={isDominant}
            lock={lock}
            onPress={() => openDetail(gain.kind)}
            onAddAnyway={() => setLockedKind(gain.kind)}
          />
        ))}

        {isDominant ? (
          <View className="mt-1">
            <Text variant="caption">
              Nothing else comes close: {gapLabelLower(model.tally, nextWeakestKind(model))} adds
              nothing at all until there's something new to wear it with.
            </Text>
          </View>
        ) : null}

        <View className="mt-2 border-t border-rule pt-4" style={{ gap: 8 }}>
          {isDominant && cards[0] ? (
            (() => {
              const advice = swapAdvice(model.tally, cards[0].kind);
              return advice ? (
                <Button
                  title={advice}
                  variant="secondary"
                  onPress={() => router.push(`/wall-swap?add=${cards[0].kind}`)}
                />
              ) : null;
            })()
          ) : null}

          {/* The paywall CTA only belongs on screen when it's actually the
              next step — a paying user with room left sees the identical
              ranking (rule: "same advice, paid or free") and no "See plans"
              spent on nothing, per the one-oxblood-action rule. */}
          {model.capacity.full ? (
            <>
              <Text variant="label">Adding an eleventh piece needs a larger closet.</Text>
              <Button title="See plans" variant="primary" loading={gatePresenting} onPress={seePlans} />
            </>
          ) : (
            <Text variant="label">{`Room for ${model.capacity.remaining} more in your closet.`}</Text>
          )}
        </View>
      </ScrollView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader title="The Gap Feed" onBack={() => router.back()} />

      {body}

      <ClosetFullSheet
        visible={lockedKind !== null}
        eyebrow={
          lockedKind
            ? `${gapLabelLower(model.tally, lockedKind)} · +${model.ranked.find((g) => g.kind === lockedKind)?.gain ?? 0} outfits`
            : ''
        }
        title={`Your closet holds ${model.capacity.limit}. This would be the ${ordinal(model.capacity.limit + 1)}.`}
        body="Two ways forward, and neither loses anything you've photographed."
        onSeePlans={seePlans}
        seePlansBusy={gatePresenting}
        secondaryLabel="Swap a piece out instead"
        onSecondary={swapInstead}
        footnote={`Swapping keeps your ${model.capacity.limit} at ${model.capacity.limit}. The suggestion stays here either way.`}
        onDismiss={() => setLockedKind(null)}
      />
    </SafeAreaView>
  );
}

/** The weakest ranked kind — the "adds nothing" line in G-05's footer. */
function nextWeakestKind(model: ReturnType<typeof useGapFeed>): CountedKind {
  const weakest = [...model.ranked].sort((a, b) => a.gain - b.gain)[0];
  return weakest?.kind ?? 'tops';
}
