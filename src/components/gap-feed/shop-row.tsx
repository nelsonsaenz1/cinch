import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { GarmentImage } from '@/components/media/garment-image';
import { Text } from '@/components/ui/text';
import { usePressFeedback } from '@/components/ui/use-press-feedback';
import {
  BUY_CLAUSE,
  commissionSentence,
  commissionSentenceShort,
  floorPriceLabel,
  openLabel,
  PAID_LINK_LABEL,
} from '@/features/commerce/copy';
import {
  CARD,
  GAP_FEED_COPY,
  MAX_MERCHANT_ROWS,
  MERCHANT_ROW,
  TYPE,
} from '@/features/closet/gap-feed-spec';
import type { CatalogSlot } from '@/features/commerce/slot';
import { useShopMatch, type ShopMatch } from '@/features/commerce/use-shop-match';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

import { useAx } from './gap-feed-parts';

/**
 * GF-02 — the merchant tray under a computed gap. The footnote, never the
 * product.
 *
 * Redesign 26 restyles this tray into the wave's card language — a sand ground
 * inside the gap card, an oxblood tracked eyebrow, and each merchant on its own
 * white card with a real press response. NOT ONE RULE ABOUT MONEY MOVED. The
 * paragraphs below are the shipped reasoning, unchanged, and the parts of it
 * that are law are called out again at the end.
 *
 * ── DISCLOSURE IS PER ROW, NEVER PER BLOCK ─────────────────────────────────
 *
 * Correction 19 and dependency D-4. Until 2026-08-11 a single "Paid link"
 * marker sat over the whole block; it was FALSE for every direct row beneath
 * it, which is a claim about Cinch's own motives made to the reader's
 * disadvantage. Each row decides for itself from `ShopMatch.paid`, which the
 * edge function sets only from a CONFIRMED joined programme
 * (`use-shop-match.ts`):
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
 * ── THE ARTIFACT DOES NOT DRAW THE COMMISSION SENTENCE. IT STAYS. ──────────
 *
 * Redesign 26's tray frames end after the last merchant row. That is the one
 * instruction in this packet that is refused outright: the sentence is a
 * disclosure that exists whenever a paid link is on screen, `commerce-
 * directive.md` §4 is what puts it there, and a frame omitting it is a frame
 * that did not know about it. Deleting a disclosure to match a picture is the
 * exact failure correction 19 was written about, one level down. Reported as a
 * deviation.
 *
 * ── PAID LINK IS `muted`, NOT THE CLAY ─────────────────────────────────────
 *
 * The frames set the marker in `accentWarm` (#B08A76), which is ~2.9:1 on the
 * white row and fails AA. §6 refusal 8 is that the disclosure is "never
 * abbreviated, greyed, or hidden behind an icon" — a clay that fails contrast
 * is greying it by another name. `muted` is the app's quiet-but-legible tone
 * and is what ships. Deviation, and not a close call.
 *
 * ── WHAT IS STILL NOT HERE ─────────────────────────────────────────────────
 *
 * · NO PRICE LITERAL. Every figure is `floorPriceLabel(product.priceCents)` —
 *   a floor the feed actually knows, printed as "from $88", never a variant
 *   price, a strikethrough, a was/now pair or a sale badge. A row whose price
 *   is unknown prints the merchant alone; it never prints a placeholder.
 * · NO OXBLOOD. "Open" is ink text on a joined row and ink text on a direct
 *   one. No accent is spent on a purchase anywhere in this product — which is
 *   why the wave's "primary CTAs go oxblood" rule stops at this component's
 *   edge, and why the tray's eyebrow is the only accent in it.
 * · NO OUTAGE TRAY. Correction 21: when the catalogue returns nothing — no
 *   match, the preference off, the account signed out, or the provider down —
 *   this renders NOTHING and says nothing. The gap never depended on the
 *   partner, and a provider outage is a health alert, not a card the user has
 *   to read past. The redesign's own silence frames draw exactly this, and the
 *   silence is the absence of a branch rather than a branch.
 * · NO LINK BUILT HERE. `ShopMatch.url` arrives from the edge function already
 *   decided. Nothing in the app bundle constructs an affiliate URL, attaches a
 *   clickref, a SubID or any other per-user parameter, or knows a publisher
 *   id. That construction lives in `supabase/functions/_shared/commerce.ts`
 *   and this build did not touch it.
 */

/**
 * C-01's cap. Declared in `gap-feed-spec.ts` so a test can read it — a constant
 * that only exists inside a `.tsx` is a constant nothing can hold — and
 * re-exported under its original name for the fixtures that already import it
 * from here.
 */
export const MAX_ROWS = MAX_MERCHANT_ROWS;

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
  const systemAx = useAx();
  const stacked = stackedOverride ?? systemAx;

  const rows = products.slice(0, MAX_ROWS);
  if (rows.length === 0) return null;

  const paidCount = rows.filter((p) => p.paid).length;
  const commission = stacked ? commissionSentenceShort(paidCount) : commissionSentence(paidCount);

  return (
    <View
      style={{
        backgroundColor: theme.sand,
        paddingHorizontal: CARD.trayPaddingX,
        paddingTop: CARD.trayPaddingTop,
        paddingBottom: CARD.trayPaddingBottom,
      }}>
      <Text
        variant="eyebrow"
        style={{
          fontSize: stacked ? TYPE.eyebrowAx : TYPE.eyebrow,
          letterSpacing: TYPE.eyebrowTracking,
          color: theme.accent,
        }}
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

/**
 * The product thumbnail.
 *
 * `GarmentImage` rather than a bare `<Image>` so a catalogue picture that will
 * not load lands on the same designed cell an owned garment's missing photo
 * does. The artifact draws a generic garment silhouette here; this draws the
 * page's own "No photo" cell instead, because the page already answers "there
 * is no picture" in one voice and a second answer would make the reader work
 * out whether they mean different things. They do not.
 */
function MerchantThumb({ product, stacked }: { product: ShopMatch; stacked: boolean }) {
  const theme = useTheme();

  return (
    <View
      className="overflow-hidden bg-sand"
      style={{
        width: stacked ? MERCHANT_ROW.axThumbWidth : MERCHANT_ROW.thumbWidth,
        height: stacked ? MERCHANT_ROW.axThumbHeight : MERCHANT_ROW.thumbHeight,
        borderRadius: MERCHANT_ROW.thumbRadius,
        flex: 0,
      }}>
      <GarmentImage
        uri={product.imageUrl}
        contentFit="cover"
        style={{ flex: 1 }}
        fallback={
          <Text
            variant="eyebrow"
            style={{ fontSize: 10, letterSpacing: 0.5, color: theme.muted, textAlign: 'center' }}>
            {GAP_FEED_COPY.noPhoto}
          </Text>
        }
      />
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
  const press = usePressFeedback();
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

  if (stacked) {
    // GF-02 / AX. The row unstacks into a card: name, product and price on
    // their own lines, the disclosure at 14pt rather than 11 — a disclosure
    // that does not scale with the type is a disclosure that disappears — and
    // Open as a full-width 48pt action beneath them.
    return (
      <Pressable
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        accessibilityRole="button"
        accessibilityLabel={spoken}>
        <Animated.View
          style={[
            press.style,
            {
              borderRadius: MERCHANT_ROW.radius,
              backgroundColor: theme.surface,
              padding: 13,
            },
          ]}>
          <View className="flex-row items-center" style={{ gap: 12 }}>
            <MerchantThumb product={product} stacked />
            <View className="flex-1">
              <Text variant="body" style={{ fontSize: 19 }}>
                {product.title}
              </Text>
              <Text variant="body" className="mt-0.5" style={{ color: theme.muted, fontSize: 17 }}>
                {[product.merchantName, price].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </View>

          {/* INSIDE the row, above the row's own action: correction 19 is
              explicit that no block-level marker exists, and at largest type
              only one merchant is on screen at a time — which is exactly when a
              tray-level marker would be indistinguishable from a row-level one
              and then be wrong the moment the reader scrolls to the next
              merchant. */}
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
            style={{ minHeight: MERCHANT_ROW.axActionHeight }}>
            <Text variant="body" style={{ fontSize: 19 }}>
              {action}
            </Text>
          </View>
        </Animated.View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={spoken}>
      <Animated.View
        style={[
          press.style,
          {
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: MERCHANT_ROW.radius,
            backgroundColor: theme.surface,
            paddingHorizontal: MERCHANT_ROW.paddingX,
            paddingVertical: MERCHANT_ROW.paddingY,
            gap: MERCHANT_ROW.gap,
            minHeight: MIN_TAP_TARGET + 12,
          },
        ]}>
        <MerchantThumb product={product} stacked={false} />
        <View className="flex-1">
          {/* The product leads and the merchant follows it, which is the frame's
              order and the honest one: the reader is looking for the garment,
              and the shop is where it happens to be. Weight is not available to
              separate them (TY-01), so the product is ink at 15 and the shop is
              muted at 13 — size and colour doing what bold does in the frame. */}
          <Text variant="body" style={{ fontSize: 15, lineHeight: 20 }}>
            {product.title}
          </Text>
          <Text variant="caption" className="mt-px" style={{ color: theme.muted }}>
            {[product.merchantName, price].filter(Boolean).join(' · ')}
          </Text>
          {product.paid ? (
            <Text
              variant="eyebrow"
              style={{ fontSize: 10, letterSpacing: 0.5, marginTop: 3, color: theme.muted }}>
              {PAID_LINK_LABEL}
            </Text>
          ) : null}
        </View>
        <View className="items-end" style={{ flex: 0 }}>
          {/* Ink, not oxblood, and text rather than a filled control: no accent
              is spent on buying anywhere in this product. */}
          <Text variant="body" style={{ fontSize: 14 }}>
            {action}
          </Text>
        </View>
      </Animated.View>
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
