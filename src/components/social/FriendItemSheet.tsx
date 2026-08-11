import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Pressable, View } from 'react-native';

import { friendPieceName } from '@/components/social/FriendItemCard';
import { SheetOverlay } from '@/components/social/FriendOverflowSheet';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { PAID_LINK_LABEL } from '@/features/commerce/copy';
import { useShowWhereToBuy } from '@/features/commerce/queries';
import { wearsLabel } from '@/features/closet/item-name';
import { stableImageSource } from '@/features/closet/use-image-urls';
import type { FriendItem } from '@/features/social-graph/types';
import { useTheme } from '@/theme/tokens';

/**
 * FC-03 — a friend's piece, tapped open. Only the three things a borrower
 * needs: what it is, how hard it has been worn, and whether it is free.
 * Price, receipts, storage status and notes never cross the privacy layer,
 * so this sheet does not even have the props to leak them.
 *
 * commerce-directive.md C-04 adds a fourth, conditional thing: "Find it",
 * when — and only when — BOTH sides have opted in. `item.shoppable` is the
 * OWNER's consent (C-05, `profiles.shoppable`, carried on `FriendItem` since
 * 20260811150000); `showWhereToBuy` is the VIEWER's own preference (C-03) —
 * the same switch that hides the Gap Feed's merchant rows on this device.
 * Either one being off removes the row entirely; neither is a fact the other
 * side ever learns from this sheet.
 */

/**
 * `last worn Tuesday` — the day, in the register a person would use, not the
 * item-detail band's compressed "6d" (that grammar belongs to a figure under
 * a rule; this one sits mid-sentence). Today/yesterday by name, the weekday
 * inside a week, then a date; the year only when it is not this one. Null in,
 * null out — the caller drops the clause rather than guessing.
 */
export function lastWornClause(iso: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;

  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  if (days <= 0) return 'last worn today';
  if (days === 1) return 'last worn yesterday';
  if (days < 7) return `last worn ${then.toLocaleDateString('en-US', { weekday: 'long' })}`;
  const sameYear = then.getFullYear() === new Date().getFullYear();
  return `last worn ${then.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    ...(sameYear ? null : { year: 'numeric' }),
  })}`;
}

export type FriendItemSheetProps = {
  /** The piece being looked at. Non-null shows the sheet. */
  item: FriendItem | null;
  /** The owner's display name; the possessive uses her first word of it. */
  ownerName: string;
  /** Signed URL for the thumb/cutout — storage paths are not URLs. */
  imageUri?: string;
  onClose: () => void;
  /** Fires only from the borrowable branch — there is no other way to ask. */
  onAsk: (item: FriendItem) => void;
  /** C-04 — fires only when the row is actually showing (both sides opted in). */
  onFindIt: (item: FriendItem) => void;
};

export function FriendItemSheet({
  item,
  ownerName,
  imageUri,
  onClose,
  onAsk,
  onFindIt,
}: FriendItemSheetProps) {
  const theme = useTheme();
  // Only fetched while a piece is actually open — `enabled` on the hook's own
  // query would need threading through; simpler to accept the one extra read
  // each time the sheet opens; react-query's cache makes every open after the
  // first free anyway.
  const showWhereToBuy = useShowWhereToBuy();

  if (item === null) {
    return (
      <SheetOverlay visible={false} onClose={onClose}>
        {null}
      </SheetOverlay>
    );
  }

  const firstName = ownerName.trim().split(/\s+/)[0] || ownerName;
  const meta = [`${firstName}’s`, wearsLabel(item.wearCount), lastWornClause(item.lastWornAt)]
    .filter(Boolean)
    .join(' · ');

  // C-04's gate: the owner's consent AND the viewer's own preference. Neither
  // alone is enough — see the module docblock.
  const canFindIt = item.shoppable && (showWhereToBuy.data ?? true);

  return (
    <SheetOverlay visible onClose={onClose}>
      <View className="overflow-hidden rounded-plate border border-rule bg-surface">
        <View className="h-[230px] bg-tray">
          {imageUri ? (
            <Image
              source={stableImageSource(imageUri)}
              recyclingKey={item.id}
              contentFit="cover"
              transition={180}
              cachePolicy="memory-disk"
              style={{ flex: 1 }}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View className="flex-1 items-center justify-center">
              <SymbolView
                name="tshirt"
                size={32}
                tintColor={theme.hairline}
                resizeMode="scaleAspectFit"
              />
            </View>
          )}
          {item.borrowable ? (
            <View className="absolute left-3 top-3 rounded-[5px] bg-accent px-[7px] py-[3px]">
              <Text
                variant="colophon"
                numberOfLines={1}
                maxFontSizeMultiplier={1.4}
                style={{ color: theme.canvas, fontSize: 9, letterSpacing: 1.1, lineHeight: 12 }}>
                Borrowable
              </Text>
            </View>
          ) : null}
        </View>

        <View className="px-[18px] pb-[18px] pt-4">
          <Text variant="title" trim accessibilityRole="header">
            {friendPieceName(item)}
          </Text>
          <Text variant="note" className="mt-2.5">
            {meta}
          </Text>

          {/* C-04 — "Find it", the same subordinate register the Gap Feed's
              own merchant row uses (ShopRow): a plain pressable line, never a
              button competing with "Ask to borrow"'s weight below it. Placed
              above the borrow action rather than folded into it — asking to
              borrow and buying your own are two different intentions, and
              conflating their affordances would blur which one a tap means. */}
          {canFindIt ? (
            <Pressable
              onPress={() => onFindIt(item)}
              accessibilityRole="button"
              accessibilityLabel={`Find it — ${PAID_LINK_LABEL}`}
              accessibilityHint="Opens shop suggestions in a sheet"
              className="mt-3 flex-row items-center active:opacity-60"
              style={{ gap: 6 }}>
              <Text variant="label" style={{ color: theme.accent }}>
                Find it
              </Text>
              <Text variant="caption" style={{ color: theme.faint }}>
                ·
              </Text>
              <Text variant="caption" className="font-medium" style={{ color: theme.faint }}>
                {PAID_LINK_LABEL}
              </Text>
            </Pressable>
          ) : null}

          {item.borrowable ? (
            <>
              {/* Ink, not oxblood: FC-03 draws the ask as the plain dark
                  button — the badge above is the page's oxblood, and asking
                  is the ordinary thing to do here, not the irreversible one. */}
              <Button
                title="Ask to borrow"
                variant="ink"
                onPress={() => onAsk(item)}
                className="mt-3.5"
              />
              <Text variant="note" className="mt-2.5">
                They get one message with the piece attached. Nothing is reserved, and no answer
                is the same as no.
              </Text>
            </>
          ) : (
            /* The button's footprint stays and goes quiet rather than
               disappearing, so the sheet does not change shape between
               pieces. Not a disabled Button: a greyed control implies a
               permission you might one day get, and there is no way to ask
               at all. A plain bordered View is also invisible to the tab
               order, which is the honest amount of interactivity. */
            <View
              accessibilityRole="text"
              accessibilityLabel="Not up for lending"
              style={{ minHeight: 44 }}
              className="mt-3.5 items-center justify-center rounded-md border border-rule">
              {/* `muted`, not the atlas's #A8A294: byline-tier greys fail AA
                  on small text (settled: the faint ruling), and this label is
                  the only place the fact is stated. */}
              <Text variant="body" className="font-medium text-muted">
                Not up for lending
              </Text>
            </View>
          )}
        </View>
      </View>
    </SheetOverlay>
  );
}
