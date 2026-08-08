import { SymbolView } from 'expo-symbols';
import { Pressable, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { leading } from '@/theme/font-metrics';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * M-03 — "Want the listing photo instead?", the ingest invitation.
 *
 * A card that sits INLINE in the capture flow once tagging has settled, never a
 * modal over a screen somebody was already reading. The whole argument of the
 * frame is that this is an offer: the photograph they took is already in the
 * closet and complete, and the only thing on the table is whether the shop's
 * own shot should be what the closet displays.
 *
 * Two affordances and no more. The oxblood action opens the match flow; the
 * 28pt disc dismisses the card for good. There is deliberately no "not now" —
 * a third control would make declining feel like a deferral, and the item
 * detail row is the permanent way in for anyone who changes their mind.
 *
 * Purely presentational: it owns no persistence, no query and no knowledge of
 * whether it has been dismissed before. The capture screen decides whether this
 * renders at all, because "has this account already said no" is a fact about
 * the account rather than about the card.
 */

/**
 * The card's radius, and the action's. 12px is `rounded-md` — the labelled
 * control radius, never a capsule — but `Card` draws itself at `rounded-plate`
 * (20px) with no prop to change it, and a second `rounded-*` class beside its
 * own has no defined precedence. A plain View at the atlas's radius rather than
 * a Card fighting its own class.
 */
const CARD_RADIUS = 12;

/** The atlas's 18pt inner inset — between `Card`'s `lg` (16) and `xl` (20). */
const CARD_PADDING = 18;

/**
 * The serif title, at 22px. Between `plate` (24) and nothing below it, so the
 * size moves inline while the family and colour stay with the variant — the
 * precedence hazard documented in ui/text.tsx. The line height is computed
 * from Instrument Serif's real metrics rather than typed, because a leading
 * below the face's own line box slices the ascenders.
 */
const TITLE_STYLE = { fontSize: 22, lineHeight: leading('instrument', 22, 1.2) };

/**
 * The body, at 15px — between `label` (13) and `callout` (16). Size and line
 * height move together; overriding one without the other is what clips glyphs.
 */
const BODY_STYLE = { fontSize: 15, lineHeight: leading('helvetica', 15, 1.5) };

/** The atlas's dismissal disc. 28pt drawn, 44pt to the thumb via `hitSlop`. */
const CLOSE_DIAMETER = 28;

export type ListingOfferProps = {
  /**
   * The brand the tagger guessed, or null when it guessed none. The sentence
   * changes rather than the offer: naming a retailer Cinch never identified
   * would make a specific promise out of a general one.
   */
  brand: string | null;
  /**
   * What the piece IS, in the tagger's own lowercase word — "coat", "wool
   * coat". The bare kind, not the full display name: "look for Arket's own
   * shot of this cognac shearling coat" reads as a description of a photograph
   * rather than of a garment.
   */
  piece: string;
  /** Opens the match flow for this piece. */
  onFind: () => void;
  /** Dismisses the card. The caller is responsible for making that permanent. */
  onDismiss: () => void;
};

export function ListingOffer({ brand, piece, onFind, onDismiss }: ListingOfferProps) {
  const theme = useTheme();

  // Both sentences end on the same promise, because it is the same promise:
  // the photograph they took is kept whatever they choose here.
  const body = brand
    ? `Cinch can look for ${brand}’s own shot of this ${piece} and use it in your closet. Your photograph stays either way.`
    : `Cinch can look for the retailer’s own shot of this ${piece} and use it in your closet. Your photograph stays either way.`;

  return (
    <View
      className="mt-4 border border-rule bg-surface dark:border-rule-dark"
      style={{ borderRadius: CARD_RADIUS, padding: CARD_PADDING }}>
      <View className="flex-row items-start justify-between gap-3">
        <Text variant="plate" className="flex-1" style={TITLE_STYLE}>
          Want the listing photo instead?
        </Text>
        {/* The second affordance, and the reason this card is never an ambush.
            A disc, not a labelled control — `rounded-full` on a 1:1 box is the
            one shape the radius scale allows it on. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss the listing photo offer"
          accessibilityHint="Hides this offer for good. You can still find the listing photo from the piece itself."
          onPress={onDismiss}
          hitSlop={(MIN_TAP_TARGET - CLOSE_DIAMETER) / 2}
          className="items-center justify-center rounded-full border border-rule active:opacity-60 dark:border-rule-dark"
          style={{ width: CLOSE_DIAMETER, height: CLOSE_DIAMETER }}>
          <SymbolView name="xmark" size={10} tintColor={theme.faint} resizeMode="scaleAspectFit" />
        </Pressable>
      </View>

      {/* Tone inline: `body` carries `text-ink`, and NativeWind resolves two
          colour utilities on one element by key order rather than by intent. */}
      <Text variant="body" className="mt-2.5" style={{ ...BODY_STYLE, color: theme.muted }}>
        {body}
      </Text>

      <Button title="Find the listing photo" className="mt-4" onPress={onFind} />
    </View>
  );
}
