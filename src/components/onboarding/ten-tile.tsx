import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Text } from '@/components/ui/text';
import { EMPTY_SLOT_LABEL, type TenSlot } from '@/features/onboarding/ten-slots';
import { useTheme } from '@/theme/tokens';

/**
 * One cell of The Ten's grid — T-01, T-02, T-05, T-06.
 *
 * Four looks, one component, and the atlas redraws all four:
 *
 *  - EMPTY: a tray cell at r12 with a hairline, a plus glyph, and the word
 *    inside the tile rather than captioned beneath it. The label moved in
 *    because a caption under every cell is a fifth row of type in a grid that
 *    has to fit ten cells above the fold. The word is GENERIC — "Add a piece",
 *    never "Dress" or "Bag". A cell that names a category before anything has
 *    been photographed is the same failure as the shirt icon below: a picture
 *    of a garment the user may not own, and an instruction they did not ask
 *    for. What a filed piece IS comes from the classifier, never from here.
 *  - FOREGROUNDED: a white ground and a 1.5px INK ring. Deliberately not the
 *    accent — the accent is spent once per frame and T-01 spends it on
 *    Photograph. A ring plus a lighter ground is two channels, which is what
 *    the accessibility rule asks for, and neither of them is colour alone.
 *  - FILLED: the photograph, full bleed, and NO name under it. An empty cell
 *    needs its word; a filled one is a picture of the garment and the word
 *    beneath it was only ever restating the row it sits in.
 *
 * An icon of a shirt is never drawn for an empty slot: "an icon of a shirt is a
 * picture of a shirt the user does not own."
 */

/** The one place `faint` is allowed: a placeholder GLYPH, never type. */
const PLACEHOLDER_GLYPH = '#8A8578';

function PlusGlyph({ colour }: { colour: string }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 20 20">
      <Path d="M10 3 v14 M3 10 h14" stroke={colour} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}

export function TenTile({
  slot,
  size,
  height,
  foregrounded,
  garmentName,
  imageUri,
  onPress,
}: {
  slot: TenSlot;
  /** Column width, measured by the grid. */
  size: number;
  /** Cell height, measured by the grid from the atlas's own ratio. */
  height: number;
  /** This slot is the one the bottom card currently argues for. */
  foregrounded: boolean;
  /** The garment's real name once tagged — spoken, never printed on the tile. */
  garmentName?: string | null;
  imageUri?: string;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const label = EMPTY_SLOT_LABEL;

  const body = (() => {
    if (slot.status === 'filled') {
      return (
        <View
          className="overflow-hidden bg-tray"
          style={{ width: size, height, borderRadius: 12, borderWidth: 1, borderColor: theme.rule }}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              contentFit="cover"
              style={{ width: '100%', height: '100%' }}
              accessibilityIgnoresInvertColors
            />
          ) : null}
        </View>
      );
    }

    const ring = foregrounded
      ? { backgroundColor: theme.surface, borderWidth: 1.5, borderColor: theme.ink }
      : { backgroundColor: theme.tray, borderWidth: 1, borderColor: theme.rule };

    return (
      <View
        className="items-center justify-center"
        style={{ width: size, height, borderRadius: 12, gap: 8, ...ring }}>
        <PlusGlyph colour={foregrounded ? theme.ink : PLACEHOLDER_GLYPH} />
        <Text
          numberOfLines={1}
          style={{
            fontSize: 12,
            lineHeight: 15,
            fontFamily: 'HelveticaNeue',
            // `muted`, never the atlas's own #4A463E — that value is the
            // annotation ink of the design document, not one of the nine
            // colours, and a slot word is real type a person has to read.
            color: foregrounded ? theme.ink : theme.muted,
          }}>
          {label}
        </Text>
      </View>
    );
  })();

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      // "Slot 3, empty, currently suggested" — position and status, in that
      // order, per the atlas's VoiceOver table. The category is gone from the
      // empty label because the position no longer has one to speak; a filled
      // tile names its real garment, which is the one thing the drawing does
      // not print.
      accessibilityLabel={
        slot.status === 'filled'
          ? (garmentName ?? `Slot ${slot.id}, filed`)
          : `Slot ${slot.id}, empty${foregrounded ? ', currently suggested' : ''}`
      }
      style={{ width: size }}
      className={onPress ? 'active:opacity-70' : ''}>
      {body}
    </Pressable>
  );
}
