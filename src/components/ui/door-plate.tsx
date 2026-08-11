import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { usePressFeedback } from '@/components/ui/use-press-feedback';
import { MIN_TAP_TARGET, shadow, useTheme } from '@/theme/tokens';

/**
 * A door — the plate that offers one way into a flow, drawn once.
 *
 * Reference board D of the Refacing. AC-01's four doors (Camera, Photo
 * Library, Describe it, Talk it in) and T-00's two are this component; the
 * board exists so the build reuses one plate rather than two screens agreeing
 * by hand and then drifting.
 *
 * WHAT A DOOR IS NOT
 *
 * It is not a settings row and it is not a card with a call to action in it.
 * The whole plate is the tap target, so there is no separate control to aim
 * at, and it carries no chevron: a row of four doors that each point right is
 * four arrows saying nothing the plate does not already say.
 *
 * NO DOOR IS EVER OXBLOOD. The doors on a chooser are peers — the page is
 * asking which way in, not recommending one — and the accent means "the one
 * thing to do here". A screen of four accented plates spends the accent four
 * times and answers a question the user was being asked. `AC-03`'s Settings
 * link is the single exception on that page, and it is a link inside the
 * `condition` slot below, not the door.
 *
 * ONE LINE, AND IT IS PROSE. The descriptive line is a sentence in the regular
 * cut ("True colour, one piece at a time."), never a feature list and never
 * Medium — §2.1 of the directive, and the reason `Text` has a `note` variant.
 */
export type DoorPlateProps = {
  /** The door's name — Instrument Serif at the heading step. */
  name: string;
  /** The one descriptive line. A sentence, in the regular cut. */
  line: string;
  /** SF Symbol for the glyph tile. */
  symbol: SymbolViewProps['name'];
  onPress: () => void;
  /**
   * A condition that rides the door — AC-03's "Camera access is off for
   * Cinch." block, stated BEFORE the tap rather than after it. Drawn inside
   * the plate, under the line.
   */
  condition?: ReactNode;
  /**
   * VoiceOver's reading of the door. Defaults to the name; pass the fuller
   * phrasing where the name alone is ambiguous out of context.
   */
  accessibilityLabel?: string;
};

/** §1.4's glyph tile — 56 square, the size the board draws. */
const TILE = 56;
/** `rounded-md`, the tile's own corner. */
const TILE_RADIUS = 12;
/** `rounded-plate` — the plate's corner, and the anchor for the concentric rule. */
const PLATE_RADIUS = 20;

export function DoorPlate({
  name,
  line,
  symbol,
  onPress,
  condition,
  accessibilityLabel,
}: DoorPlateProps) {
  const theme = useTheme();
  const press = usePressFeedback();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? name}
      accessibilityHint={line}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={{ minHeight: MIN_TAP_TARGET }}>
      {/* The shadow rides the outer layer and the corner is on the layer
          below: on iOS a view that clips its children clips its own shadow
          away. Same split as `components/today/plate.tsx`. The compression
          lives out here too, so the plate and everything written on it
          compress as one object. */}
      <Animated.View
        style={[
          {
            shadowColor: theme.ink,
            shadowOpacity: 0.16,
            shadowRadius: shadow.contact.blur,
            shadowOffset: { width: shadow.contact.dx, height: shadow.contact.dy },
          },
          press.style,
        ]}>
        <View
          className="overflow-hidden bg-surface p-gutter"
          style={{ borderRadius: PLATE_RADIUS }}>
          {/* 16 between the tile and the words — the board's gap, and 8×2 on
              the spacing scale rather than a half-step nobody else uses. */}
          <View className="flex-row items-center" style={{ gap: 16 }}>
            <View
              className="items-center justify-center bg-sand"
              style={{ width: TILE, height: TILE, borderRadius: TILE_RADIUS }}>
              {/* An SF Symbol, not an inline SVG — the placeholder glyphs in
                  the atlas HTML are stand-ins for these. */}
              <SymbolView name={symbol} size={24} tintColor={theme.ink} />
            </View>
            {/* `flex-1` and `flex-shrink` together: at the larger Dynamic Type
                settings the name has to wrap inside the column rather than
                push the tile off the plate. */}
            <View className="flex-1">
              {/* No gap between the two: `door` is untrimmed, so Instrument
                  Serif's 1.30 line box already sets the line off the name.
                  A `mt-*` here would be a spacing value off §1.4's scale. */}
              <Text variant="door">{name}</Text>
              <Text variant="note">{line}</Text>
            </View>
          </View>
          {condition ? <View className="mt-3">{condition}</View> : null}
        </View>
      </Animated.View>
    </Pressable>
  );
}

/**
 * The condition block that rides a door — AC-03's shape, exported so the one
 * other page that needs it draws the same object.
 *
 * `rounded` is 8: the concentric rule says inner = outer − inset, and the
 * plate's 20 against its 20 of padding lands at 0, which is not a corner
 * anybody draws. 8 is the nearest step on the scale (§1.3's `DEFAULT`), and
 * the board lands it there rather than inventing the in-between value.
 */
export function DoorCondition({ children }: { children: ReactNode }) {
  return (
    <View className="rounded bg-tray p-3">
      <View className="flex-row items-end justify-between gap-3">{children}</View>
    </View>
  );
}
