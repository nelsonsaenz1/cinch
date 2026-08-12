import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GapCard } from '@/components/gap-feed/gap-card';
import { productReason } from '@/components/gap-feed/gap-prose';
import { GapLimitFooter } from '@/components/gap-feed/limit-footer';
import { ProductSheet } from '@/components/gap-feed/product-sheet';
import { GapShopFooter } from '@/components/gap-feed/shop-row';
import { EmptyState, ErrorState, ScreenHeader, Text } from '@/components/ui';
import { gapLabelLower } from '@/features/closet/gap-feed';
import type { CountedKind, Gain } from '@/features/closet/outfit-count';
import { useGapFeed } from '@/features/closet/use-gap-feed';
import { SLOT_FOR_GAP_KIND } from '@/features/commerce/slot';
import type { ShopMatch } from '@/features/commerce/use-shop-match';
import { useTheme } from '@/theme/tokens';

/**
 * The Gap Feed — GF-01, GF-02 and GF-04.
 *
 * THE GAP IS THE PRODUCT. SHOPPING IS THE FOOTNOTE. Every card on this screen
 * is computed from the closet before any shop is consulted, and a card renders
 * complete with no merchant tray at all — GF-01 is the acceptance case for
 * exactly that, and nothing about it looks like a card with a missing row.
 *
 * ── AUDIT 84 · A COMPUTED GAP IN THE FIRST VIEWPORT ────────────────────────
 *
 * The masthead is one serif line and one sentence. It used to be a 30pt
 * headline plus a two-line paragraph plus an eyebrow, which pushed the first
 * card's headline down by roughly 50pt for no information. Measured layout, at
 * 393pt and the default text scale, with the numbers each line contributes:
 *
 *     safe-area top inset (393×852 device)                       59
 *     ScreenHeader: pt-2 + a 36pt disc                            8 + 36
 *     masthead paddingTop                                        10
 *     "What your closet is missing" — 30pt Instrument Serif,
 *       trimmed to its cap height                                ~21
 *     sentence marginTop 6 + one 15/22.5 line                     6 + 22
 *     scroll paddingTop                                          14
 *     card padding 18 + 11pt eyebrow (~13) + 6pt gap             18 + 13 + 6
 *     ───────────────────────────────────────────────────────────────────
 *     first gap headline, top of frame                          ≈213
 *
 * The atlas annotates 112pt. Its own GF-01 frame does not measure 112 either:
 * summing that frame's declared boxes (52 status + 10 + 31.8 + 6 + 22.5 + 16 +
 * 18 + 13.2 + 6) puts its first card headline at ≈175pt, and 112 lands inside
 * the masthead sentence. The 112 is unreachable on a real device for a reason
 * the frame cannot show: the frame has no navigation affordance, and this
 * route is PUSHED — dropping the header to buy 44pt would leave a pushed
 * screen with no way back, which is a worse defect than a headline 100pt
 * lower. What audit 84 actually asks a reviewer to check (§14) is "the first
 * computed gap is in the first viewport at 393pt", and at 213pt of an 852pt
 * frame the whole first card — headline, explanation and evidence — is above
 * the fold with room to spare.
 *
 * ── CORRECTION 21 · A CATALOGUE FAILURE IS SILENT ──────────────────────────
 *
 * There is no outage branch on this screen. `GapShopFooter` renders nothing
 * when the match comes back empty for ANY reason — nothing matched, the
 * preference is off, the provider is down — and the gap is drawn on its own,
 * because the gap never depended on the partner. Provider outages belong to
 * the health alerts, and nothing here reports one to the user.
 */
export default function GapFeedScreen() {
  const router = useRouter();
  const theme = useTheme();
  const model = useGapFeed();
  const [sheet, setSheet] = useState<{ product: ShopMatch; gain: Gain } | null>(null);

  const openDetail = (kind: CountedKind) => router.push(`/gap-feed/${kind}`);

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
    // A closet too small or too empty to have a gap worth naming. Honest
    // rather than padded with a suggestion that gains nothing.
    body = (
      <EmptyState
        symbol="sparkles"
        title="Nothing to suggest yet"
        body="Add a few more pieces and Cinch can work out what one more would unlock."
      />
    );
  } else {
    const cards = model.dominant ?? model.ranked.slice(0, 3);

    // Two ceilings, two remedies — `useCapacity` keeps them apart because the
    // database does (migration 20260808190100). The total ceiling wins when
    // both are hit: storing cannot help there.
    const ceiling: 'active' | 'total' | null = model.capacity.storageFull
      ? 'total'
      : model.capacity.full
        ? 'active'
        : null;

    body = (
      <ScrollView contentContainerClassName="px-5 pb-10 pt-3.5" contentContainerStyle={{ gap: 12 }}>
        {cards.map((gain, i) => (
          <GapCard
            key={gain.kind}
            eyebrow={i === 0 ? 'Biggest gap' : i === 1 ? 'Second gap' : 'Third gap'}
            gain={gain}
            tally={model.tally}
            pairings={model.pairingsFor(gain.kind)}
            // The unit is defined once, on the card that introduces it.
            gloss={i === 0}
            onPress={() => openDetail(gain.kind)}
            footer={
              // The limit is stated ONCE, on the leading card, and it takes the
              // tray footer that would otherwise hold merchants: a screen that
              // cannot accept a new piece has no business leading with where to
              // buy one.
              i === 0 && ceiling ? (
                <GapLimitFooter
                  ceiling={ceiling}
                  used={ceiling === 'active' ? model.capacity.used : model.capacity.stored}
                  limit={ceiling === 'active' ? model.capacity.limit : model.capacity.storedLimit}
                  onChooseToStore={
                    ceiling === 'active'
                      ? () => router.push(`/wall-swap?add=${gain.kind}`)
                      : undefined
                  }
                  onSeeStored={() => router.push('/storage')}
                />
              ) : (
                <GapShopFooter
                  slot={SLOT_FOR_GAP_KIND[gain.kind]}
                  onOpenProduct={(product) => setSheet({ product, gain })}
                />
              )
            }
          />
        ))}

        {model.dominant ? (
          <Text variant="caption" style={{ color: theme.muted }}>
            {`Nothing else comes close: ${gapLabelLower(model.tally, nextWeakestKind(model))} adds nothing at all until there’s something new to wear it with.`}
          </Text>
        ) : null}
      </ScrollView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader align="leading" onBack={() => router.back()} />

      <View className="px-6 pt-2.5">
        <Text variant="title" trim style={{ fontSize: 30, lineHeight: 32 }}>
          What your closet is missing
        </Text>
        {/* ONE sentence. The atlas draws "computed from what you own and what
            you actually wear" — the second half is not true of this app and is
            not implemented here: `rankGaps` reads the tally only
            (`features/closet/outfit-count.ts`), and no wear record enters the
            ranking. Claiming the wear log was consulted would be a claim about
            how the advice was produced, which is the one thing this screen
            cannot get wrong. */}
        <Text variant="body" className="mt-1.5" style={{ color: theme.muted, fontSize: 15, lineHeight: 22 }}>
          {subtitle(model)}
        </Text>
      </View>

      {body}

      <ProductSheet
        product={sheet?.product ?? null}
        reason={sheet ? productReason(model.tally, sheet.gain) : ''}
        onDismiss={() => setSheet(null)}
      />
    </SafeAreaView>
  );
}

/**
 * The masthead's one sentence.
 *
 * At an active limit it names the limit, because that is the fact that governs
 * every card under it. Otherwise it counts the cards actually drawn — "three
 * gaps" over two cards is a small lie the reader can see.
 */
function subtitle(model: ReturnType<typeof useGapFeed>): string {
  if (model.capacity.storageFull) {
    return 'Every slot you have is taken, stored pieces included.';
  }
  if (model.capacity.full) {
    return 'Your active shelf is full, so adding means swapping first.';
  }
  const n = (model.dominant ?? model.ranked.slice(0, 3)).length;
  const word = n === 1 ? 'One gap' : n === 2 ? 'Two gaps' : 'Three gaps';
  return `${word}, computed from what you own.`;
}

/** The weakest ranked kind — the "adds nothing" line under a dominant gap. */
function nextWeakestKind(model: ReturnType<typeof useGapFeed>): CountedKind {
  const weakest = [...model.ranked].sort((a, b) => a.gain - b.gain)[0];
  return weakest?.kind ?? 'tops';
}
