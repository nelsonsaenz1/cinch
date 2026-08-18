import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { usePressFeedback } from '@/components/ui/use-press-feedback';
import { PAGE } from '@/features/ingest/capture-spec';
import { leading } from '@/theme/font-metrics';
import { canvasAlpha, useTheme } from '@/theme/tokens';

/**
 * M-03 — "Want the listing photo instead?", the ingest invitation.
 *
 * A card that sits INLINE in the capture flow once tagging has settled, never a
 * modal over a screen somebody was already reading. The whole argument of the
 * frame is that this is an offer: the photograph they took is already in the
 * closet and complete, and the only thing on the table is whether the shop's
 * own shot should be what the closet displays.
 *
 * ── WHAT REDESIGN 22 CHANGED (frame 15) ────────────────────────────────────
 *
 * The card was a bordered `surface` plate with an oxblood pill in it and a 28pt
 * dismissal disc in its top corner. Frame 15 paints the WHOLE CARD oxblood —
 * "a single oxblood moment" — with a canvas capsule for the look and the
 * dismissal promoted from a disc to a labelled row under it. Still exactly two
 * affordances, which is the rule the disc was serving; a disc is simply a worse
 * way to say "not now" than the words are.
 *
 * ── WHAT IT DID NOT CHANGE ─────────────────────────────────────────────────
 *
 * The substance, which the artifact insists on twice: "unchanged in substance",
 * "it introduces no price, no vendor, no billing surface". The sentence is the
 * shipped one, and it is about a PHOTOGRAPH — Cinch looking for the retailer's
 * own shot of a piece and using it in the closet. Frame 15's own words
 * ("Cinch can write the listing from the photograph you just took") describe
 * selling the garment, which is a different feature and one this card has never
 * opened; adopting them would have the card promise something the tap does not
 * do. Recorded as a deviation.
 *
 * Frame 15 also draws a thumbnail well beside the headline. This component is
 * handed a brand and a kind, not an image, and the piece it is about is the one
 * the user is already looking at on the page above — so the well is not drawn
 * rather than drawn with a placeholder garment in it. Recorded as a deviation.
 *
 * Purely presentational: it owns no persistence, no query and no knowledge of
 * whether it has been dismissed before. The capture screen decides whether this
 * renders at all, because "has this account already said no" is a fact about
 * the account rather than about the card.
 */

/** The serif title, at frame 15's 25px on the oxblood ground. */
const TITLE_STYLE = { fontSize: 25, lineHeight: leading('instrument', 25, 1.05) };

/** The body, at frame 15's 14.5px. Size and line height move together. */
const BODY_STYLE = { fontSize: 14.5, lineHeight: leading('helvetica', 14.5, 1.5) };

/** The card's two actions, at the frame's 54 and 48 — both over the 44pt floor. */
const LOOK_HEIGHT = 54;
const DISMISS_HEIGHT = 48;

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
  const lookPress = usePressFeedback();
  const dismissPress = usePressFeedback();

  // Both sentences end on the same promise, because it is the same promise:
  // the photograph they took is kept whatever they choose here.
  const body = brand
    ? `Cinch can look for ${brand}’s own shot of this ${piece} and use it in your closet. Your photograph stays either way.`
    : `Cinch can look for the retailer’s own shot of this ${piece} and use it in your closet. Your photograph stays either way.`;

  return (
    <View
      style={{
        borderRadius: PAGE.offerRadius,
        padding: 20,
        gap: 14,
        backgroundColor: theme.accent,
      }}>
      {/* Inline colour throughout, never a `text-*` class: every variant here
          carries `text-ink` or `text-muted`, and NativeWind resolves two colour
          utilities on one element by key order in the generated stylesheet
          rather than by intent — which on this ground is the difference between
          a headline and a smudge. */}
      <Text variant="plate" style={{ ...TITLE_STYLE, color: theme.canvas }}>
        Want the listing photo instead?
      </Text>

      <Text variant="body" style={{ ...BODY_STYLE, color: canvasAlpha(0.78) }}>
        {body}
      </Text>

      <View style={{ gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Have a look"
          accessibilityHint="Opens the listing-photo search for this piece"
          onPress={onFind}
          onPressIn={lookPress.onPressIn}
          onPressOut={lookPress.onPressOut}
          style={{ minHeight: LOOK_HEIGHT }}>
          <Animated.View
            style={[
              {
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: LOOK_HEIGHT / 2,
                backgroundColor: theme.canvas,
              },
              lookPress.style,
            ]}>
            <Text variant="body" style={{ fontSize: 16, color: theme.accent }}>
              Have a look
            </Text>
          </Animated.View>
        </Pressable>

        {/* The second affordance, and the reason this card is never an ambush.
            It was a 28pt disc in the corner; the frame gives it words, which is
            the only change — the outcome is identical and still permanent. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Not now"
          accessibilityHint="Hides this offer for good. You can still find the listing photo from the piece itself."
          onPress={onDismiss}
          onPressIn={dismissPress.onPressIn}
          onPressOut={dismissPress.onPressOut}
          style={{ minHeight: DISMISS_HEIGHT }}>
          <Animated.View
            style={[
              { flex: 1, alignItems: 'center', justifyContent: 'center' },
              dismissPress.style,
            ]}>
            <Text variant="body" style={{ fontSize: 15, color: canvasAlpha(0.8) }}>
              Not now
            </Text>
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}
