import { Image } from 'expo-image';
import { Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import {
  commissionParagraph,
  floorPriceLabel,
  LISTING_SERVICE_LINE,
  openSheetLabel,
  PAID_LINK_LABEL,
  provenanceLine,
} from '@/features/commerce/copy';
import type { ShopMatch } from '@/features/commerce/use-shop-match';
import { MIN_TAP_TARGET, shadow, useTheme } from '@/theme/tokens';

/**
 * GF-03 — the product sheet. ONE product, ONE merchant.
 *
 * ── WHY THIS IS NOT `shop-sheet.tsx` ───────────────────────────────────────
 *
 * `ShopSheet` lists a slot's matches and is what a friend's "Find it" opens
 * (C-04). This sheet is what a single merchant ROW opens, and the difference
 * is load-bearing for correction 19: a product sheet is always one merchant,
 * so a marker in its header is a per-merchant marker and is therefore correct
 * — which is only true because the sheet cannot hold a second merchant. A list
 * sheet cannot have that header, and a header this sheet inherited from a list
 * would be the block-level marker correction 19 removed.
 *
 * ── WHAT THE HEADER AND THE PARAGRAPH DO ───────────────────────────────────
 *
 *   joined  →  header marker "Paid link"; the commission paragraph, in full,
 *              naming what commission does not change; action "Open Everlane".
 *   direct  →  no marker anywhere; NO commission paragraph at all; action
 *              "Open at the merchant".
 *
 * A softened commission sentence on a direct sheet would be the same false
 * claim in a quieter voice, so it is absent rather than hedged.
 *
 * ── CORRECTION 12 · PROVENANCE ─────────────────────────────────────────────
 *
 * The retailer is named as the source of BOTH the picture and the price, and
 * staleness is admitted: the catalogue is a licensed snapshot, not a live read
 * of the shop's page. The listing service is not named here — Privacy →
 * Shopping partners names it in full, and that page is where the complete
 * answer belongs. This sheet's line agrees with that page rather than
 * replacing it ("The pictures beside each result are the shops' own").
 *
 * ── NO OXBLOOD ON A PURCHASE ───────────────────────────────────────────────
 *
 * The one filled action is `variant="ink"`. The accent is not spent on buying
 * anywhere in this product, and "Back to the gap" is a quiet 44pt exit that
 * buys nothing and changes nothing.
 *
 * ── PRICE ──────────────────────────────────────────────────────────────────
 *
 * `floorPriceLabel` — "from $88" — never a literal, and never an exact price
 * this app has not verified: the feed knows a floor, not the variant the user
 * would end up in.
 */
function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const SHEET_SHADOW_SCALE = 4;

function ScrollBody({ inline, children }: { inline: boolean; children: React.ReactNode }) {
  if (inline) return <View className="pb-2">{children}</View>;
  return (
    <ScrollView contentContainerClassName="pb-2" showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}

export type ProductSheetProps = {
  /** The product whose sheet is open; `null` closes it. */
  product: ShopMatch | null;
  /** "Why this was suggested" — the gap's own arithmetic, restated. */
  reason: string;
  onDismiss: () => void;
};

export function ProductSheet({ product, reason, onDismiss }: ProductSheetProps) {
  return (
    <Modal visible={product !== null} transparent animationType="slide" onRequestClose={onDismiss}>
      {product ? <ProductSheetBody product={product} reason={reason} onDismiss={onDismiss} /> : null}
    </Modal>
  );
}

/**
 * The sheet's contents without its Modal — what the canonical fixture renders,
 * so a frame is drawn by the same code the app runs and no `Modal` has to be
 * opened to photograph it.
 */
export function ProductSheetBody({
  product,
  reason,
  onDismiss,
  inline = false,
}: {
  product: ShopMatch;
  reason: string;
  onDismiss: () => void;
  /** Draw in place rather than over a scrim — fixtures only. */
  inline?: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const price = product.priceCents !== null ? floorPriceLabel(product.priceCents, product.currency) : null;
  const commission = commissionParagraph(product.paid, product.merchantName);

  const panel = (
    <View
      className="rounded-t-plate bg-canvas"
      style={{ paddingBottom: inline ? 20 : insets.bottom + 16 }}>
      <View className="flex-row items-center justify-between px-5 pt-3.5">
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Back to the gap"
          accessibilityHint="Closes this without opening anything or buying anything"
          style={{ width: MIN_TAP_TARGET, height: MIN_TAP_TARGET }}
          className="items-center justify-center rounded-full bg-tray active:opacity-60">
          <Text variant="body" style={{ fontSize: 15 }}>
            ✕
          </Text>
        </Pressable>

        {/* Correct HERE and only here: a product sheet is one merchant, so this
            marker describes exactly one link. Absent on a direct sheet. */}
        {product.paid ? (
          <Text variant="eyebrow" style={{ fontSize: 11, letterSpacing: 0.5, color: theme.muted }}>
            {PAID_LINK_LABEL}
          </Text>
        ) : null}
      </View>

      {/* A plain View when drawn in place: a fixture puts two of these inside
          one scroller, and a nested vertical ScrollView there would collapse
          to zero height and swallow the frame. */}
      <ScrollBody inline={inline}>
        <View className="flex-row px-5 pt-3" style={{ gap: 14 }}>
          <View
            className="overflow-hidden bg-tray"
            style={{ width: 132, height: 160, borderRadius: 12, flex: 0 }}>
            <Image
              source={{ uri: product.imageUrl }}
              contentFit="cover"
              style={{ flex: 1 }}
              cachePolicy="memory-disk"
              accessibilityIgnoresInvertColors
            />
          </View>
          <View className="flex-1">
            <Text variant="body" style={{ fontSize: 15, color: theme.muted }}>
              {product.merchantName}
            </Text>
            <Text variant="title" trim className="mt-1" style={{ fontSize: 26, lineHeight: 29 }}>
              {product.title}
            </Text>
            {price ? (
              <Text variant="body" className="mt-2" style={{ fontSize: 20 }}>
                {price}
              </Text>
            ) : null}
            <Text variant="note" className="mt-1">
              {provenanceLine(product.merchantName)}
            </Text>
            <Text variant="noteSmall" className="mt-1.5">
              {LISTING_SERVICE_LINE}
            </Text>
          </View>
        </View>

        <View className="px-6 pt-5">
          <Text variant="eyebrow" style={{ letterSpacing: 1.4 }}>
            Why this was suggested
          </Text>
          <Text variant="body" className="mt-1.5" style={{ fontSize: 16, lineHeight: 24 }}>
            {reason}
          </Text>
        </View>

        {commission ? (
          <View className="px-5 pt-4">
            <View className="rounded-md bg-tray" style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
              <Text variant="body" style={{ fontSize: 15, lineHeight: 23 }}>
                {commission}
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollBody>

      <View className="px-5 pt-4">
        <Button
          title={openSheetLabel(product.paid, product.merchantName)}
          variant="ink"
          onPress={() => void Linking.openURL(product.url)}
        />
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Back to the gap"
          style={{ minHeight: MIN_TAP_TARGET }}
          className="mt-1 items-center justify-center active:opacity-60">
          <Text variant="body" style={{ fontSize: 16, color: theme.muted }}>
            Back to the gap
          </Text>
        </Pressable>
      </View>
    </View>
  );

  if (inline) return panel;

  return (
    <View style={{ flex: 1, backgroundColor: withAlpha(theme.ink, 0.4) }}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
        accessibilityHint="Nothing is bought or changed; this closes the sheet."
      />
      <View
        accessibilityViewIsModal
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: '86%',
          shadowColor: theme.ink,
          shadowOpacity: 0.28,
          shadowRadius: shadow.contact.blur * SHEET_SHADOW_SCALE,
          shadowOffset: { width: shadow.contact.dx, height: shadow.contact.dy * SHEET_SHADOW_SCALE },
          ...(Platform.OS === 'android' ? { elevation: 16 } : null),
        }}>
        {panel}
      </View>
    </View>
  );
}
