import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { Linking, Pressable, View, type LayoutChangeEvent } from 'react-native';

import { SectionHeader } from '@/components/ui/section-header';
import { Text } from '@/components/ui/text';
import type { ShelfCard } from '@/features/explore/shop-feed';
import { PAID_LINK_LABEL } from '@/features/commerce/copy';
import { track } from '@/lib/posthog';
import { MIN_TAP_TARGET } from '@/theme/tokens';

/**
 * The shop shelf on Explore — ONE compact grid, and a door to the rest.
 *
 * ── WHY THIS REPLACED TWO FULL SHELVES (P1 #18, 2026-09-02) ────────────────
 *
 * Explore had grown a closet-similarity feed and a partner feed, each an
 * unbounded grid, stacked under a page whose empty state is four lines long.
 * The result read as a merchant feed with friends at the top — which inverts
 * the only promise the page makes. Commerce is subordinate here by
 * construction now: at most six cards, below every piece of social content,
 * one line of copy, and everything else behind `/shop`, where a person who
 * wants a shop has said so by tapping.
 *
 * ── DISCLOSURE IS PER CARD, NEVER PER BLOCK ────────────────────────────────
 *
 * The grid mixes paid partner stock with catalogue rows Cinch earns nothing
 * on, so a block-level "paid links" line above it would be false for half the
 * grid — the exact defect `tests/commerce-disclosure.test.ts` exists to
 * prevent. Each paid card carries `PAID_LINK_LABEL` under it and no card that
 * is not paid does. Cinch still has no cart and no checkout; every card opens
 * the merchant's own page and says so.
 *
 * Renders nothing without cards — absent, not greyed — and the caller gates it
 * on the person's own "Show where to buy" switch (C-03), so turning that off
 * removes this the way it removes every other shop surface.
 *
 * ── THE SHELF'S OWN DENOMINATORS (ledger A46, 2026-09-05) ─────────────────
 *
 * `explore_shop_product_opened` had never fired, lifetime — not from a
 * customer, and not from the harness that loaded 979 cards on 09-01/03 —
 * and the only other number was `explore_shop_feed_loaded`, which counts
 * READS, not a grid on screen. Nothing could say whether the shelf was
 * invisible (nothing drew, or it sat below the fold of a long page) or
 * visible and unwanted. So the shelf now reports two facts about itself:
 * `explore_shop_shelf_shown {cards, paid}` when it settles (the caller fires
 * it, because a zero-card shelf renders nothing and cannot report), and
 * `explore_shop_shelf_reached` when its top edge enters the viewport — the
 * caller measures the scroll, this component only hands up its own y via
 * `onLayout`. Both once per mount, both counts only.
 */
export function ShopShelf({
  cards,
  total,
  onSeeMore,
  onLayout,
}: {
  cards: ShelfCard[];
  /** How many cards the door leads to. "See more" is absent when it is a lie. */
  total: number;
  onSeeMore: () => void;
  /** The shelf's y within the scroll content, for the "reached" measurement. */
  onLayout?: (y: number) => void;
}) {
  // The impression, from the one place that knows a grid actually drew.
  // `cards.length` is the dependency so an empty-then-filled shelf reports
  // once it fills; the ref keeps a refill from reporting twice.
  const shown = useRef(false);
  useEffect(() => {
    if (shown.current || cards.length === 0) return;
    shown.current = true;
    track('explore_shop_shelf_shown', {
      cards: cards.length,
      paid: cards.filter((card) => card.paid).length,
    });
  }, [cards]);

  if (cards.length === 0) return null;

  const open = (card: ShelfCard) => {
    // The event carries NOTHING about the card: not the merchant, not the
    // kind, not the title. That a shelf item was opened is the whole fact.
    // `shelf` keeps the bound `posthog.tsx` declares for it — 'partner' on a
    // paid card, absent on a closet-similarity one — so merging the two
    // shelves into one grid did not widen a single property.
    if (card.paid) track('explore_shop_product_opened', { shelf: 'partner' });
    else track('explore_shop_product_opened');
    void Linking.openURL(card.pageUrl);
  };

  return (
    <View
      className="mt-10 px-gutter"
      onLayout={onLayout ? (e: LayoutChangeEvent) => onLayout(e.nativeEvent.layout.y) : undefined}>
      <SectionHeader title="From the shops" className="mb-1" />
      <Text variant="note" className="mb-3 text-muted">
        Picked from the kinds of pieces you already own. Each opens the shop’s own page.
      </Text>

      <View className="flex-row flex-wrap justify-between">
        {cards.map((card) => (
          <Pressable
            key={card.key}
            accessibilityRole="link"
            accessibilityLabel={`${card.title}${card.merchant ? `, at ${card.merchant}` : ''}. ${
              card.paid ? 'Paid link — opens the shop.' : 'Opens the shop.'
            }`}
            onPress={() => open(card)}
            className="mb-4 active:opacity-70"
            style={{ width: '48.5%' }}>
            <View
              className="items-center justify-center rounded-md border border-hairline bg-surface"
              style={{ aspectRatio: 0.8, overflow: 'hidden' }}>
              <Image
                source={{ uri: card.imageUrl }}
                style={{ width: '100%', height: '100%' }}
                contentFit="contain"
                transition={150}
                accessibilityIgnoresInvertColors
              />
            </View>
            <Text variant="label" className="mt-2 text-ink">
              {card.title}
            </Text>
            <Text variant="note" className="mt-0.5 text-muted">
              {card.paid
                ? `${card.merchant} · ${PAID_LINK_LABEL}`
                : (card.brand ?? card.merchant ?? 'Opens the shop')}
            </Text>
          </Pressable>
        ))}
      </View>

      {total > cards.length ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="See more from the shops"
          onPress={onSeeMore}
          style={{ minHeight: MIN_TAP_TARGET }}
          className="mt-1 flex-row items-center active:opacity-60">
          <Text variant="label" className="text-accent">
            See more
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
