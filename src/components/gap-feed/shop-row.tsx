import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { floorPriceLabel, merchantsClause, PAID_LINK_LABEL } from '@/features/commerce/copy';
import { SLOT_FOR_GAP_KIND, type CatalogSlot } from '@/features/commerce/slot';
import { useShopMatch } from '@/features/commerce/use-shop-match';
import { gapLabel, type Gain, type Tally } from '@/features/closet/gap-feed';
import { useTheme } from '@/theme/tokens';

/**
 * C-01 — the Gap Feed's merchant row, a subordinate second line under each
 * `GapCard`. Rendered as that card's own sibling rather than folded inside
 * it: the card's `onPress` already opens the gap detail, and this row opens a
 * different thing (the C-02 product sheet) — nesting one Pressable inside
 * another is an accessibility trap RN never resolves cleanly, and the two
 * targets staying siblings is what "subordinate, never heavier" cashes out to
 * visually as well (smaller type, muted colour, a plain top rule, no card
 * border of its own).
 *
 * ABSENT ENTIRELY, never a placeholder or a skeleton: C-01 states this in as
 * many words, and a loading spinner under every gap card would be a
 * merchant-shaped promise the match may not keep.
 */
export type ShopRowProps = {
  tally: Tally;
  gain: Gain;
  /** The resolved catalogue slot — the caller (this screen) owns the sheet
   *  state, so it needs the slot, not just the kind, to open it. */
  onPress: (slot: CatalogSlot) => void;
};

export function ShopRow({ tally, gain, onPress }: ShopRowProps) {
  const theme = useTheme();
  const slot = SLOT_FOR_GAP_KIND[gain.kind];
  const match = useShopMatch(slot, true);
  const products = match.data ?? [];

  if (products.length === 0) return null;

  const floor = products.reduce(
    (min, p) => (p.priceCents !== null && (min === null || p.priceCents < min) ? p.priceCents : min),
    null as number | null,
  );
  const currency = products.find((p) => p.priceCents !== null)?.currency ?? null;

  const headline = `${gapLabel(tally, gain.kind)} would give you ${gain.gain} more ${
    gain.gain === 1 ? 'outfit' : 'outfits'
  }.`;
  const merchants = merchantsClause(products.map((p) => p.merchantName));
  const priceLine = floor !== null ? `${merchants} — ${floorPriceLabel(floor, currency)}.` : `${merchants}.`;

  return (
    <Pressable
      onPress={() => onPress(slot)}
      accessibilityRole="button"
      accessibilityLabel={`${headline} ${priceLine} ${PAID_LINK_LABEL}`}
      accessibilityHint="Opens shop suggestions in a sheet"
      className="mt-2 border-t border-hairline pt-2 active:opacity-60">
      <Text variant="caption" style={{ color: theme.muted, lineHeight: 17 }}>
        {headline}
      </Text>
      <View className="mt-0.5 flex-row items-center" style={{ gap: 6 }}>
        <Text variant="caption" style={{ color: theme.faint, fontStyle: 'italic', flexShrink: 1 }}>
          {priceLine}
        </Text>
        <Text variant="caption" style={{ color: theme.faint }}>
          ·
        </Text>
        {/* Never abbreviated, greyed further, or hidden behind an icon —
            commerce-directive.md §4/§6 refusal 8. This IS the `faint`/`caption`
            weight every other trailing fact on this row already uses; nothing
            here is quieter than its neighbours. */}
        <Text variant="caption" className="font-medium" style={{ color: theme.faint }}>
          {PAID_LINK_LABEL}
        </Text>
      </View>
    </Pressable>
  );
}
