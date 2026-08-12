import { Image } from 'expo-image';
import { Linking, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { floorPriceLabel, linkDisclosure, shopSheetDisclosure } from '@/features/commerce/copy';
import type { CatalogSlot } from '@/features/commerce/slot';
import { useShopMatch, type ShopMatch } from '@/features/commerce/use-shop-match';
import { shadow, useTheme } from '@/theme/tokens';

/**
 * C-02 — tapping a merchant row (the Gap Feed's, C-01, or a friend's piece's
 * "Find it", C-04) opens THIS, never a browser. Matched products with a shop
 * photo, name, price, and one "Open" action each. The disclosure paragraph is
 * the first thing in the sheet and renders every single time it opens (no
 * "don't show again"), per the directive's own words.
 *
 * Driven by a bare `slot` rather than a Gap Feed `kind` — see
 * `use-shop-match.ts`'s header for why this is the shared primitive between
 * the two callers.
 *
 * Shares `ClosetFullSheet`'s Modal/backdrop/slide-up shell
 * (`components/wall/closet-full-sheet.tsx`) rather than importing it: that
 * component's content is a fixed panel (title/body/two buttons), and this
 * sheet's content is a scrolling product list — different enough content
 * shape that reusing the panel would mean threading a children prop through
 * a component that was deliberately built without one. The chrome (scrim,
 * rounded-top card, drag handle, shadow) is copied verbatim so the two sheets
 * still feel like the same app.
 */
function withAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const SHEET_SHADOW_SCALE = 4;

function ProductRow({ product, first }: { product: ShopMatch; first: boolean }) {
  const theme = useTheme();
  const price = product.priceCents !== null ? floorPriceLabel(product.priceCents, product.currency) : null;

  return (
    <View className={`flex-row items-center gap-3 py-3 ${first ? '' : 'border-t border-hairline'}`}>
      <View className="h-14 w-14 overflow-hidden rounded-md bg-tray">
        <Image
          source={{ uri: product.imageUrl }}
          contentFit="cover"
          style={{ flex: 1 }}
          cachePolicy="memory-disk"
          accessibilityIgnoresInvertColors
        />
      </View>
      <View className="flex-1">
        <Text variant="body" numberOfLines={1} className="font-medium">
          {product.title}
        </Text>
        <Text variant="caption" className="mt-0.5" style={{ color: theme.muted }} numberOfLines={1}>
          {[product.merchantName, price].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <View className="items-end" style={{ gap: 4 }}>
        <Button
          title="Open"
          variant="secondary"
          onPress={() => void Linking.openURL(product.url)}
          className="px-4"
        />
        {/* The disclosure sits ON the link it describes, per product, because
            that is the only place the answer is actually known — and because
            `paid` differs row to row: two merchants in one sheet can be one
            joined programme and one not. commerce-directive.md §4/§6 refusal 8
            forbids abbreviating or hiding it, not stating it precisely. */}
        {/* `muted`, never `faint`: #8A8578 is ~3.5:1 on canvas and fails AA as
            type, and a disclosure nobody can read is not a disclosure. */}
        <Text variant="caption" style={{ color: theme.muted }}>
          {linkDisclosure(product.paid)}
        </Text>
      </View>
    </View>
  );
}

export type ShopSheetProps = {
  /** The slot whose sheet is open; `null` closes it. */
  slot: CatalogSlot | null;
  onDismiss: () => void;
};

export function ShopSheet({ slot, onDismiss }: ShopSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // Same query key `ShopRow` (or a friend item's "Find it" row) already
  // populated — a cache hit, not a second network round trip, as long as the
  // sheet opens within its 5-minute staleTime.
  const match = useShopMatch(slot, slot !== null);
  const products = match.data ?? [];

  return (
    <Modal visible={slot !== null} transparent animationType="slide" onRequestClose={onDismiss}>
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
            maxHeight: '80%',
            shadowColor: theme.ink,
            shadowOpacity: 0.28,
            shadowRadius: shadow.contact.blur * SHEET_SHADOW_SCALE,
            shadowOffset: { width: shadow.contact.dx, height: shadow.contact.dy * SHEET_SHADOW_SCALE },
            ...(Platform.OS === 'android' ? { elevation: 16 } : null),
          }}>
          <View
            className="rounded-t-plate border-t border-rule bg-surface px-gutter pt-5"
            style={{ paddingBottom: insets.bottom + 24 }}>
            <View className="self-center rounded-full bg-rule" style={{ width: 40, height: 4, marginBottom: 18 }} />

            <Text variant="eyebrow" className="mb-1.5">
              Where to buy
            </Text>

            {/* C-02's required paragraph — disclosed on every opening, not
                just the first. Set in `note`/`muted` like every other running
                disclosure sentence in the app (privacy-index-page.tsx's
                InventoryRow is the same register), never faint enough to fail
                AA.

                Correction 19 applies here too: the commission half of this
                paragraph is true only when a paid row is actually in the list
                below it. With no joined merchant among the matches, the sheet
                says so and keeps the half that is always true — that the
                ranking was computed before any shop was consulted. */}
            <Text variant="note" style={{ color: theme.muted }}>
              {shopSheetDisclosure(products.filter((p) => p.paid).length)}
            </Text>

            <View className="mt-3">
              {products.length === 0 ? (
                <Text variant="body" className="py-4" style={{ color: theme.muted }}>
                  {match.isLoading ? 'Looking…' : 'Nothing to show right now.'}
                </Text>
              ) : (
                products.map((p, i) => <ProductRow key={p.id} product={p} first={i === 0} />)
              )}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
