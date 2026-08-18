import { useRouter } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  CompactGapRow,
  DominantFootnote,
  GapFeedEmpty,
  GapFeedSkeleton,
  GapFeedStop,
  LeadGapCard,
  ScrollHint,
  useAx,
} from '@/components/gap-feed/gap-feed-parts';
import { productReason } from '@/components/gap-feed/gap-prose';
import { GapLimitFooter } from '@/components/gap-feed/limit-footer';
import { ProductSheet } from '@/components/gap-feed/product-sheet';
import { GapShopFooter } from '@/components/gap-feed/shop-row';
import { Button, ScreenHeader, Text } from '@/components/ui';
import { gapLabelLower } from '@/features/closet/gap-feed';
import {
  CARD,
  FEED_CARDS,
  GAP_FEED_COPY,
  TYPE,
  mastheadLine,
  rankEyebrow,
} from '@/features/closet/gap-feed-spec';
import type { CountedKind, Gain } from '@/features/closet/outfit-count';
import { useGapFeed } from '@/features/closet/use-gap-feed';
import { SLOT_FOR_GAP_KIND } from '@/features/commerce/slot';
import type { ShopMatch } from '@/features/commerce/use-shop-match';
import { useTheme } from '@/theme/tokens';

/**
 * The Gap Feed. Redesign 26.
 *
 * THE GAP IS THE PRODUCT. SHOPPING IS THE FOOTNOTE. Every card on this screen
 * is computed from the closet before any shop is consulted, and a card renders
 * complete with no merchant tray at all — the "no merchants" frame is the
 * acceptance case for exactly that, and nothing about it looks like a card with
 * a missing row.
 *
 * ── WHAT REDESIGN 26 CHANGED ───────────────────────────────────────────────
 *
 * The imagery leads. The shipped card opened with a headline and a two-sentence
 * paragraph and put three thumbnails underneath as supporting evidence; the
 * brief is "gap cards led by the outfit-you-can't-make imagery", so the wells
 * run first and the prose is cut to the one sentence audit 85 requires. See
 * `gap-feed-parts.tsx` for why the sentence that survived is the arithmetic and
 * not the evidence.
 *
 * The runner-ups compact. Three full cards of garment wells would make the feed
 * a catalogue of absences and flatten the gap that actually matters most, so
 * the second and third gaps become rows: rank, label, one line, chevron.
 *
 * ── THE HEADER STAYS, AND THE FRAMES DO NOT DRAW ONE ───────────────────────
 *
 * Every frame in this packet opens with the masthead hard against the status
 * bar and no back affordance. This route is PUSHED — from Today's own gap card
 * and from the closet menu — so dropping `ScreenHeader` would buy ~44pt of
 * headline height and leave a pushed screen with no way out but a system edge
 * swipe. That is the standing "never a dead end" refusal, and it costs the
 * frame's exact vertical rhythm rather than the reader's exit. Deviation.
 *
 * ── CORRECTION 21 · A CATALOGUE FAILURE IS SILENT ──────────────────────────
 *
 * There is no outage branch on this screen. `GapShopFooter` renders nothing
 * when the match comes back empty for ANY reason — nothing matched, the
 * preference is off, the account is signed out, the provider is down — and the
 * gap is drawn on its own, because the gap never depended on the partner. The
 * packet's three silence frames all draw exactly this. Provider outages belong
 * to the health alerts, and nothing here reports one to the user.
 *
 * ── NOTHING ON THIS SCREEN BUILDS A LINK ───────────────────────────────────
 *
 * The affiliate URL, the publisher ids and the refusal to attach any per-user
 * parameter all live in `supabase/functions/_shared/commerce.ts` and
 * `gap-shop-match/policy.ts`, neither of which this build touched. This screen
 * receives a `ShopMatch` with a `url` already decided and hands it to
 * `Linking.openURL` unmodified.
 */
export default function GapFeedScreen() {
  const router = useRouter();
  const theme = useTheme();
  const ax = useAx();
  const model = useGapFeed();
  const [sheet, setSheet] = useState<{ product: ShopMatch; gain: Gain } | null>(null);

  /**
   * NO HAPTIC HERE, and that is the policy rather than an omission.
   *
   * The wave's brief asks for "light impact on card taps". `lib/haptics.ts` is
   * the app's only door onto the taptic engine and it deliberately exports no
   * navigation intent — "a tab change, a push, a sheet presentation and a
   * scroll all arrive with their own system feedback, and adding a tick to them
   * is the texture Apple's HIG warns about". `tests/haptic-policy.test.ts`
   * holds it. A gap card opens a detail route; it commits nothing. Reaching for
   * `haptics.commit()` here would be calling a write intent on a read, which is
   * worse than the missing tick. Deviation.
   */
  const openDetail = (kind: CountedKind) => router.push(`/gap-feed/${kind}`);

  const refresh = () => model.refetch();

  const nothingWorthNaming =
    model.outfitsToday === 0 && model.ranked.every((g) => g.gain === 0);

  const cards = model.dominant ?? model.ranked.slice(0, FEED_CARDS);

  // Two ceilings, two remedies — `useCapacity` keeps them apart because the
  // database does (migration 20260808190100). The total ceiling wins when both
  // are hit: storing cannot help there.
  const ceiling: 'active' | 'total' | null = model.capacity.storageFull
    ? 'total'
    : model.capacity.full
      ? 'active'
      : null;

  let body: React.ReactNode;

  if (model.error) {
    body = (
      <View style={{ gap: 14 }}>
        <GapFeedStop retrying={model.refreshing} />
        <Button
          title={
            model.refreshing ? GAP_FEED_COPY.readError.retrying : GAP_FEED_COPY.readError.action
          }
          variant="primary"
          loading={model.refreshing}
          onPress={refresh}
        />
      </View>
    );
  } else if (model.loading && !model.ready) {
    body = <GapFeedSkeleton />;
  } else if (nothingWorthNaming) {
    // A closet too small or too empty to have a gap worth naming. Honest rather
    // than padded with a suggestion that gains nothing.
    body = (
      <View style={{ gap: 20 }}>
        <GapFeedEmpty pieces={model.pairingsFor('tops', 2).shown} />
        <Button
          title={GAP_FEED_COPY.empty.action}
          variant="primary"
          onPress={() => router.push('/add-clothes')}
        />
      </View>
    );
  } else {
    body = (
      <View style={{ gap: CARD.gap }}>
        {cards.map((gain, i) =>
          i === 0 ? (
            <LeadGapCard
              key={gain.kind}
              eyebrow={rankEyebrow(i)}
              gain={gain}
              tally={model.tally}
              pieces={model.pairingsFor(gain.kind, 2).shown}
              // The unit is defined once, on the card that introduces it.
              gloss
              onPress={() => openDetail(gain.kind)}
              footer={
                // The limit is stated ONCE, on the leading card, and it takes
                // the tray footer that would otherwise hold merchants: a screen
                // that cannot accept a new piece has no business leading with
                // where to buy one.
                ceiling ? (
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
          ) : (
            <CompactGapRow
              key={gain.kind}
              eyebrow={rankEyebrow(i)}
              gain={gain}
              tally={model.tally}
              onPress={() => openDetail(gain.kind)}
            />
          ),
        )}

        {/* At the largest type only the leading card fits a viewport, so the
            fact that there is more is stated rather than left to be found. */}
        {ax ? <ScrollHint remaining={cards.length - 1} /> : null}

        {model.dominant ? (
          <DominantFootnote label={gapLabelLower(model.tally, nextWeakestKind(model))} />
        ) : null}
      </View>
    );
  }

  /**
   * ONE FACT, ONE REPORT.
   *
   * The packet draws two refresh states — a pull indicator and a "checking for
   * changes from your other device" band — and they are the same fact reported
   * twice: a read is in flight over content already on screen. `useGapFeed` has
   * no way to tell a user's pull from a window-refocus refetch, and inventing
   * one so a banner could claim the refresh came from another DEVICE would be
   * asserting something this screen does not know. The system refresh indicator
   * says it once, in the place iOS users already look. Deviation.
   */
  const refreshing = model.ready && !model.error && model.refreshing;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader align="leading" onBack={() => router.back()} />

      <ScrollView
        contentContainerClassName="px-gutter pb-12 pt-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.accent} />
        }>
        <Text
          variant="title"
          trim
          style={{
            fontSize: ax ? TYPE.mastheadAx : TYPE.masthead,
            lineHeight: ax ? TYPE.mastheadAx + 4 : TYPE.mastheadLineHeight,
          }}>
          {GAP_FEED_COPY.title}
        </Text>

        {/* ONE line. The atlas's earlier draft read "computed from what you own
            and what you actually wear" — the second half is not true of this
            app and is not implemented here: `rankGaps` reads the tally only
            (`features/closet/outfit-count.ts`), and no wear record enters the
            ranking. Claiming the wear log was consulted would be a claim about
            how the advice was produced, which is the one thing this screen
            cannot get wrong. */}
        {model.error ? null : (
          <Text
            variant="body"
            className="mt-2"
            style={{
              color: theme.muted,
              fontSize: ax ? TYPE.supportingAx : TYPE.supporting,
              lineHeight: ax ? TYPE.supportingAxLineHeight : 22,
            }}>
            {mastheadLine({
              activeFull: model.capacity.full,
              totalFull: model.capacity.storageFull,
              cards: cards.length,
            })}
          </Text>
        )}

        <View className="mt-4">{body}</View>
      </ScrollView>

      <ProductSheet
        product={sheet?.product ?? null}
        reason={sheet ? productReason(model.tally, sheet.gain) : ''}
        onDismiss={() => setSheet(null)}
      />
    </SafeAreaView>
  );
}

/** The weakest ranked kind — the "adds nothing" line under a dominant gap. */
function nextWeakestKind(model: ReturnType<typeof useGapFeed>): CountedKind {
  const weakest = [...model.ranked].sort((a, b) => a.gain - b.gain)[0];
  return weakest?.kind ?? 'tops';
}
