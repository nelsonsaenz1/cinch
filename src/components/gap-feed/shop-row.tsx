import { Image } from 'expo-image';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { Text } from '@/components/ui/text';
import {
  BUY_CLAUSE,
  commissionSentence,
  commissionSentenceShort,
  floorPriceLabel,
  openLabel,
  PAID_LINK_LABEL,
} from '@/features/commerce/copy';
import { AX_STACK_SCALE } from '@/features/closet/dynamic-type';
import type { CatalogSlot } from '@/features/commerce/slot';
import { useShopMatch, type ShopMatch } from '@/features/commerce/use-shop-match';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * GF-02 — the merchant tray under a computed gap. The footnote, never the
 * product.
 *
 * ── DISCLOSURE IS PER ROW, NEVER PER BLOCK ─────────────────────────────────
 *
 * Correction 19 and dependency D-4. Until now a single "Paid link" marker sat
 * over the whole block; it was FALSE for every direct row beneath it, which is
 * a claim about Cinch's own motives made to the reader's disadvantage. Each
 * row now decides for itself from `ShopMatch.paid`, which the edge function
 * sets only from a CONFIRMED joined programme (`use-shop-match.ts`):
 *
 *   joined  →  "Open"           with "Paid link" under it
 *   direct  →  "Open at Uniqlo" and no marker at all
 *
 * There is no block-level marker to reintroduce, and `tests/commerce-
 * disclosure.test.ts` fails if one appears: the tray renders exactly as many
 * disclosure strings as there are paid rows.
 *
 * The commission sentence follows the same rule — it exists only because at
 * least one paid row is visible, and it names all three things a commission
 * does not change (the gap, the match, the order).
 *
 * ── WHAT IS NOT HERE ───────────────────────────────────────────────────────
 *
 * · NO PRICE LITERAL. Every figure is `floorPriceLabel(product.priceCents)` —
 *   a floor the feed actually knows, printed as "from $88", never a variant
 *   price, a strikethrough, a was/now pair or a sale badge.
 * · NO OXBLOOD. "Open" is ink text on a joined row and ink text on a direct
 *   one. No accent is spent on a purchase.
 * · NO OUTAGE TRAY. Correction 21: when the catalogue returns nothing — no
 *   match, the preference off, or the provider down — this renders NOTHING and
 *   says nothing. The gap never depended on the partner, and a provider outage
 *   is a health alert, not a card the user has to read past.
 */

/** C-01's cap, restated here because this is the surface that must obey it. */
export const MAX_ROWS = 3;

export type ShopRowsProps = {
  products: readonly ShopMatch[];
  onOpenProduct: (product: ShopMatch) => void;
  /** Fixture override for the largest-Dynamic-Type composition. */
  stacked?: boolean;
};

/**
 * The pure half — takes products, renders the tray. Fixtures render this
 * directly so a canonical frame never touches the network.
 */
export function ShopRows({ products, onOpenProduct, stacked: stackedOverride }: ShopRowsProps) {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const stacked = stackedOverride ?? fontScale >= AX_STACK_SCALE;

  const rows = products.slice(0, MAX_ROWS);
  if (rows.length === 0) return null;

  const paidCount = rows.filter((p) => p.paid).length;
  const commission = stacked ? commissionSentenceShort(paidCount) : commissionSentence(paidCount);

  return (
    <View className="bg-tray" style={{ paddingHorizontal: 18, paddingTop: 14, paddingBottom: 16 }}>
      <Text
        variant="note"
        style={{ color: theme.muted, fontSize: stacked ? 17 : 13 }}
        accessibilityElementsHidden
        importantForAccessibility="no">
        {BUY_CLAUSE}
      </Text>

      <View className="mt-2.5" style={{ gap: 8 }}>
        {rows.map((product) => (
          <MerchantRow
            key={product.id}
            product={product}
            stacked={stacked}
            onPress={() => onOpenProduct(product)}
          />
        ))}
      </View>

      {commission ? (
        <Text
          variant="note"
          className="mt-2.5"
          style={{ color: theme.muted, fontSize: stacked ? 16 : 12, lineHeight: stacked ? 23 : 17 }}>
          {commission}
        </Text>
      ) : null}
    </View>
  );
}

function MerchantRow({
  product,
  stacked,
  onPress,
}: {
  product: ShopMatch;
  stacked: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const price = product.priceCents !== null ? floorPriceLabel(product.priceCents, product.currency) : null;
  const action = openLabel(product.paid, product.merchantName);

  /**
   * "Everlane, wide-leg twill, from eighty-eight dollars, paid link, opens
   * Everlane." The row's disclosure is inside the row's OWN label, which is
   * the whole of correction 19 restated for VoiceOver. `floorPriceLabel`'s
   * "from $88" is spoken as "from eighty-eight dollars" by the screen reader
   * itself — spelling the number out here would make it read twice.
   */
  const spoken = [
    product.merchantName,
    product.title,
    price,
    product.paid ? PAID_LINK_LABEL.toLowerCase() : null,
    `opens ${product.merchantName}`,
  ]
    .filter(Boolean)
    .join(', ');

  const thumb = (
    <View
      className="overflow-hidden bg-sand"
      style={{
        width: stacked ? 48 : 40,
        height: stacked ? 58 : 48,
        borderRadius: 8,
        flex: 0,
      }}>
      <Image
        source={{ uri: product.imageUrl }}
        contentFit="cover"
        style={{ flex: 1 }}
        cachePolicy="memory-disk"
        accessibilityIgnoresInvertColors
      />
    </View>
  );

  if (stacked) {
    // GF-02 / AX. The row unstacks into a card: name, product and price on
    // their own lines, the disclosure at 14pt Medium rather than 11 — a
    // disclosure that does not scale with the type is a disclosure that
    // disappears — and Open as a full-width 48pt action beneath them.
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={spoken}
        className="rounded-md bg-canvas active:opacity-70"
        style={{ padding: 13 }}>
        <View className="flex-row items-center" style={{ gap: 12 }}>
          {thumb}
          <View className="flex-1">
            <Text variant="body" style={{ fontSize: 19 }}>
              {product.merchantName}
            </Text>
            <Text variant="body" className="mt-0.5" style={{ color: theme.muted, fontSize: 17 }}>
              {product.title}
            </Text>
            {price ? (
              <Text variant="body" style={{ color: theme.muted, fontSize: 17 }}>
                {price}
              </Text>
            ) : null}
          </View>
        </View>

        {/* INSIDE the row, above the row's own action: the atlas sketches this
            marker at the top of the tray, but correction 19 is explicit that
            no block-level marker exists, and at largest type only one merchant
            is on screen at a time — which is exactly when a tray-level marker
            would be indistinguishable from a row-level one and then be wrong
            the moment the reader scrolls to the next merchant. */}
        {product.paid ? (
          <Text
            variant="eyebrow"
            className="mt-3"
            style={{ fontSize: 14, letterSpacing: 0.5, color: theme.muted }}>
            {PAID_LINK_LABEL}
          </Text>
        ) : null}

        <View
          className="mt-2 items-center justify-center rounded-md border border-rule"
          style={{ minHeight: 48 }}>
          <Text variant="body" style={{ fontSize: 19 }}>
            {action}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      className="flex-row items-center rounded-md bg-canvas active:opacity-70"
      style={{ paddingHorizontal: 13, paddingVertical: 11, gap: 11, minHeight: MIN_TAP_TARGET + 12 }}>
      {thumb}
      <View className="flex-1">
        <Text variant="body" style={{ fontSize: 15 }}>
          {product.merchantName}
        </Text>
        <Text variant="caption" className="mt-px" style={{ color: theme.muted }}>
          {[product.title, price].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <View className="items-end" style={{ flex: 0 }}>
        {/* Ink, not oxblood, and text rather than a filled control: no accent
            is spent on buying anywhere in this product. */}
        <Text variant="body" style={{ fontSize: 14 }}>
          {action}
        </Text>
        {product.paid ? (
          <Text
            variant="eyebrow"
            style={{ fontSize: 10, letterSpacing: 0.5, marginTop: 2, color: theme.muted }}>
            {PAID_LINK_LABEL}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export type GapShopFooterProps = {
  slot: CatalogSlot;
  onOpenProduct: (product: ShopMatch) => void;
  stacked?: boolean;
};

/**
 * The hooked half — one slot's matches, or nothing at all.
 *
 * `useShopMatch` already returns an empty list for every failure mode
 * (`use-shop-match.ts`: "A failed match is silence, not an error state"), so
 * correction 21's silent catalogue failure is not a branch added here; it is
 * the absence of one. There is no loading row, no skeleton and no retry: all
 * three would be a merchant-shaped promise under a card that is already
 * showing the real, computed gap.
 */
export function GapShopFooter({ slot, onOpenProduct, stacked }: GapShopFooterProps) {
  const match = useShopMatch(slot, true);
  return <ShopRows products={match.data ?? []} onOpenProduct={onOpenProduct} stacked={stacked} />;
}
