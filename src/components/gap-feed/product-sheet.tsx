import { Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GarmentImage } from '@/components/media/garment-image';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { usePressFeedback } from '@/components/ui/use-press-feedback';
import { GAP_FEED_COPY, SHEET } from '@/features/closet/gap-feed-spec';
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

import { useAx } from './gap-feed-parts';

/**
 * GF-03 — the product sheet. ONE product, ONE merchant.
 *
 * Redesign 26 gives it the wave's image-forward treatment: the merchant's own
 * photograph runs full-bleed across the top of the sheet, and the panel below
 * it holds a thumbnail, the title, the disclosures and one filled action. The
 * money rules are untouched; the paragraphs that carry them are the shipped
 * ones and are reproduced here in full.
 *
 * ── WHY THIS IS NOT `shop-sheet.tsx` ───────────────────────────────────────
 *
 * `ShopSheet` lists a slot's matches and is what a friend's "Find it" opens
 * (C-04). This sheet is what a single merchant ROW opens, and the difference is
 * load-bearing for correction 19: a product sheet is always one merchant, so a
 * marker in its header is a per-merchant marker and is therefore correct —
 * which is only true because the sheet cannot hold a second merchant. A list
 * sheet cannot have that header, and a header this sheet inherited from a list
 * would be the block-level marker correction 19 removed.
 *
 * ── WHAT THE HEADER AND THE PARAGRAPH DO ───────────────────────────────────
 *
 *   joined  →  marker "Paid link"; the commission paragraph, in full, naming
 *              what commission does not change; action "Open Everlane".
 *   direct  →  no marker anywhere; NO commission paragraph at all; action
 *              "Open at the merchant".
 *
 * A softened commission sentence on a direct sheet would be the same false
 * claim in a quieter voice, so it is absent rather than hedged.
 *
 * The artifact labels the DIRECT sheet's action "Open at Uniqlo" and the paid
 * one "Open at Everlane". Both are refused in favour of the shipped
 * `openSheetLabel`, which is pinned by `tests/commerce-disclosure.test.ts` and
 * documented in `features/commerce/copy.ts`: a direct sheet stays generic
 * precisely so the sentence cannot be read as an endorsement of a shop Cinch
 * has no arrangement with, and a paid sheet names the merchant without the
 * preposition that would make the two forms look identical. Deviation.
 *
 * ── CORRECTION 12 · PROVENANCE ─────────────────────────────────────────────
 *
 * The retailer is named as the source of BOTH the picture and the price, and
 * staleness is admitted: the catalogue is a licensed snapshot, not a live read
 * of the shop's page. The listing service is not named here — Privacy →
 * Shopping partners names it in full, and that page is where the complete
 * answer belongs.
 *
 * ── AT LARGEST TYPE, NOTHING IS TRADED AWAY ────────────────────────────────
 *
 * The AX frame drops the provenance and commission paragraphs and replaces
 * them with "Scroll for the merchant and commission note". That is refused:
 * they are disclosures, the body already scrolls, and a disclosure a reader has
 * to go and find is the "hidden behind an icon" failure §6 refusal 8 names,
 * wearing a sentence instead of an icon. What the AX composition DOES take from
 * the frame is dropping the thumbnail — the hero photograph above it is the
 * same picture, and at that type size the thumbnail was only stealing width
 * from the title. Deviation.
 *
 * ── NO OXBLOOD ON A PURCHASE ───────────────────────────────────────────────
 *
 * The one filled action is `variant="ink"`. The accent is not spent on buying
 * anywhere in this product; the only accent on the sheet is "Back to the gap",
 * which buys nothing and changes nothing.
 *
 * ── PRICE ──────────────────────────────────────────────────────────────────
 *
 * `floorPriceLabel` — "from $88" — never a literal, and never an exact price
 * this app has not verified: the feed knows a floor, not the variant the user
 * would end up in. A product with no known price prints the merchant alone.
 *
 * ── THE LINK ───────────────────────────────────────────────────────────────
 *
 * `Linking.openURL(product.url)`. The URL arrives from the edge function fully
 * formed; nothing here appends, rewrites or inspects it, and no user identity
 * has ever been attached to it — see `supabase/functions/_shared/commerce.ts`,
 * which this build did not touch.
 */
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

/** The picture the merchant supplies, or the page's own "no photo" cell. */
function ProductPicture({
  product,
  width,
  height,
  radius,
}: {
  product: ShopMatch;
  width?: number;
  /** Omitted for the full-bleed hero, which takes its box from its parent. */
  height?: number;
  radius: number;
}) {
  const theme = useTheme();

  return (
    <View
      className="overflow-hidden bg-tray"
      style={{ width, height, borderRadius: radius, flex: height === undefined ? 1 : 0 }}>
      <GarmentImage
        uri={product.imageUrl}
        contentFit="cover"
        style={{ flex: 1 }}
        fallback={
          <Text
            variant="eyebrow"
            style={{ fontSize: 11, letterSpacing: 0.8, color: theme.muted, textAlign: 'center' }}>
            {GAP_FEED_COPY.noPhoto}
          </Text>
        }
      />
    </View>
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
  ax: axOverride,
}: {
  product: ShopMatch;
  reason: string;
  onDismiss: () => void;
  /** Draw in place rather than over a scrim — fixtures only. */
  inline?: boolean;
  /** Fixture override for the largest-Dynamic-Type composition. */
  ax?: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const systemAx = useAx();
  const ax = axOverride ?? systemAx;
  const back = usePressFeedback();

  const price = product.priceCents !== null ? floorPriceLabel(product.priceCents, product.currency) : null;
  const commission = commissionParagraph(product.paid, product.merchantName);

  const panel = (
    <View
      className="bg-canvas"
      style={{
        borderTopLeftRadius: SHEET.radius,
        borderTopRightRadius: SHEET.radius,
        paddingBottom: inline ? 20 : insets.bottom + 12,
      }}>
      {/* The grabber. Decorative — the sheet is dismissed by the scrim, by the
          named exit below, and by the system's own gesture. */}
      <View className="items-center pt-2.5" accessibilityElementsHidden importantForAccessibility="no">
        <View
          style={{
            width: SHEET.grabberWidth,
            height: SHEET.grabberHeight,
            borderRadius: SHEET.grabberHeight,
            backgroundColor: theme.sand,
          }}
        />
      </View>

      <ScrollBody inline={inline}>
        <View
          className="flex-row"
          style={{ paddingHorizontal: SHEET.paddingX, paddingTop: 14, gap: 14 }}>
          {ax ? null : (
            <ProductPicture
              product={product}
              width={SHEET.thumbWidth}
              height={SHEET.thumbHeight}
              radius={SHEET.thumbRadius}
            />
          )}
          <View className="flex-1">
            <Text
              variant="title"
              trim
              style={{ fontSize: ax ? 28 : 26, lineHeight: ax ? 31 : 29 }}>
              {product.title}
            </Text>
            <Text
              variant="body"
              className="mt-2"
              style={{ fontSize: ax ? 19 : 15, color: theme.muted }}>
              {[product.merchantName, price].filter(Boolean).join(' · ')}
            </Text>
            {/* Correct HERE and only here: a product sheet is one merchant, so
                this marker describes exactly one link. Absent on a direct
                sheet. It grows with the type — a disclosure that does not scale
                is a disclosure that disappears. */}
            {product.paid ? (
              <Text
                variant="eyebrow"
                className="mt-1.5"
                style={{ fontSize: ax ? 14 : 11, letterSpacing: 0.5, color: theme.muted }}>
                {PAID_LINK_LABEL}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={{ paddingHorizontal: SHEET.paddingX, paddingTop: 18 }}>
          <Text
            variant="body"
            style={{ fontSize: ax ? 19 : 16, lineHeight: ax ? 27 : 24 }}>
            {reason}
          </Text>

          <Text
            variant="body"
            className="mt-3"
            style={{ color: theme.muted, fontSize: ax ? 18 : 15, lineHeight: ax ? 26 : 23 }}>
            {`${provenanceLine(product.merchantName)} ${LISTING_SERVICE_LINE}`}
          </Text>

          {commission ? (
            <Text
              variant="body"
              className="mt-3"
              style={{ color: theme.muted, fontSize: ax ? 18 : 15, lineHeight: ax ? 26 : 23 }}>
              {commission}
            </Text>
          ) : null}
        </View>
      </ScrollBody>

      <View style={{ paddingHorizontal: SHEET.paddingX, paddingTop: 16 }}>
        <Button
          title={openSheetLabel(product.paid, product.merchantName)}
          variant="ink"
          onPress={() => void Linking.openURL(product.url)}
        />
        <Pressable
          onPress={onDismiss}
          onPressIn={back.onPressIn}
          onPressOut={back.onPressOut}
          accessibilityRole="button"
          accessibilityLabel="Back to the gap"
          accessibilityHint="Closes this without opening anything or buying anything"
          style={{ minHeight: MIN_TAP_TARGET }}
          className="mt-1 items-center justify-center">
          <Animated.View style={back.style}>
            <Text variant="body" style={{ fontSize: 16, color: theme.accent }}>
              Back to the gap
            </Text>
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );

  if (inline) return panel;

  return (
    <View style={{ flex: 1, backgroundColor: theme.scrim }}>
      {/* The merchant's photograph, full-bleed behind the panel. It is the
          product, so it is the picture — the wave's image-forward rule applied
          where the image genuinely IS the subject. Hidden from VoiceOver and
          transparent to touch: the panel names the garment, the shop and the
          price, and an unlabelled picture between the scrim and the title would
          be one more stop on the way to the disclosure. */}
      <View
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: `${Math.round(SHEET.heroRatio * 100)}%`,
        }}>
        <ProductPicture product={product} height={undefined} radius={0} />
      </View>

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
