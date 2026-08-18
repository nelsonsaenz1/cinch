import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { usePressFeedback } from '@/components/ui/use-press-feedback';
import { canvasAlpha, MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * A door — the plate that offers one way into a flow, drawn once.
 *
 * AC-01's four doors and The Ten's lead door are this component, and so is the
 * single camera door under TR-06's resume card. The component exists so the
 * build reuses one plate rather than several screens agreeing by hand and then
 * drifting.
 *
 * ── WHAT REDESIGN 23 CHANGED ──────────────────────────────────────────────
 *
 * The plate was a white `surface` card with a contact shadow, 20pt corners and
 * a 56pt sand tile holding an SF Symbol in `ink`. The accepted frame replaces
 * all four of those:
 *
 *   - The GROUND is a warm tint, not white, and there is no shadow. The doors
 *     are painted onto the paper rather than lifted off it, which is what lets
 *     four of them sit in a column without reading as four floating cards.
 *   - The TILE is 74×78 at 11pt and carries drawn imagery (`art`) rather than
 *     a glyph. `symbol` still works and is still what the onboarding resume
 *     door passes; it is the fallback, not the default.
 *   - The CORNER comes down to 16 and the padding to 13/15, which is the
 *     frame's own measure and tighter than the old 20 of gutter on every side.
 *   - A `condition` is a paper block INSIDE the plate, inset 11 from its
 *     edges, with its recovery stacked under the sentence rather than beside
 *     it. The old row put a link at the right-hand end of a two-line
 *     paragraph, where at large Dynamic Type it had nowhere to go.
 *
 * ── WHAT DID NOT CHANGE ───────────────────────────────────────────────────
 *
 * THE VOICE DOOR IS "Describe by voice". Audit 66 closed on one line — "the
 * voice door is Describe by voice; 'Talk it in' appears nowhere in the group"
 * — and this comment carried the retired name for months after every screen
 * had stopped using it, which is the worst place for it: a comment on the
 * shared primitive is what a new door gets copied from. The names all come
 * from `features/ingest/intake-routes.ts` now, and no caller retypes one.
 *
 * WHAT A DOOR IS NOT. It is not a settings row and it is not a card with a
 * call to action in it. The whole plate is the tap target, so there is no
 * separate control to aim at, and it carries no chevron: a column of four
 * doors that each point right is four arrows saying nothing the plate does not
 * already say.
 *
 * NO PEER DOOR IS EVER ACCENTED. The doors on a chooser are peers — the page
 * is asking which way in, not recommending one. `tone="accent"` exists for
 * exactly one caller, The Ten, which is not a peer and is not an intake
 * method: it is a guided run that USES these doors, drawn above the group and
 * absent entirely at the cap. AC-03's Settings link is the other accent on
 * that page, and it is a link inside the `condition` slot below, not a door.
 *
 * ONE LINE, AND IT IS PROSE. The descriptive line is a sentence in the regular
 * cut, never a feature list and never Medium — §2.1 of the directive, and the
 * reason `Text` has a `note` variant.
 *
 * THE NAME IS THE SERIF. The artifact sets peer names in Helvetica 17 at
 * weight 600. That cut does not exist here and may not be reintroduced: TY-01
 * deletes every weight from product components and `tests/type-weight.test.ts`
 * sweeps all of `src/` for one. `door` (Instrument Serif at the 20pt heading
 * step) is the app's answer to the same question and is what the artifact
 * itself reaches for the moment it wants a door to feel like a door — The Ten
 * is drawn in Instrument Serif in every frame that contains it.
 */
export type DoorPlateProps = {
  /** The door's name — Instrument Serif at the heading step. */
  name: string;
  /** The one descriptive line. A sentence, in the regular cut. */
  line: string;
  /**
   * The drawing on the tile — redesign 23's imagery. Takes precedence over
   * `symbol`; a door that passes neither gets an empty tile, which is a
   * legitimate state for a plate whose art has not been drawn yet.
   */
  art?: ReactNode;
  /** SF Symbol, for the callers that have not moved to `art`. */
  symbol?: SymbolViewProps['name'];
  onPress: () => void;
  /**
   * A condition that rides the door — AC-02's "Camera access is off for
   * Cinch." block, stated BEFORE the tap rather than after it. Drawn inside
   * the plate, under the line.
   */
  condition?: ReactNode;
  /**
   * The door's method is currently unavailable, so its tile and its name step
   * back — the frame's own treatment for a door carrying a blocking condition.
   *
   * It does NOT disable anything. The plate stays a full-width, full-height
   * target and still opens what it names; what changes is that the reader can
   * see which of the four is the one with a sentence attached. A door that
   * cannot be pressed is a door that loses a photograph, which is the whole of
   * W-02 and the reason AC-03 refuses to dim anything for capacity.
   */
  subdued?: boolean;
  /**
   * `sand` (default) is a peer. `accent` is the oxblood lead door, and there
   * is exactly one caller — see the note above.
   */
  tone?: 'sand' | 'accent';
  /**
   * VoiceOver's reading of the door. Defaults to the name; pass the fuller
   * phrasing where the name alone is ambiguous out of context.
   */
  accessibilityLabel?: string;
};

/** The frame's tile: 74 wide, 78 tall, 11pt corner. */
const TILE_W = 74;
const TILE_H = 78;
const TILE_RADIUS = 11;
/** The glyph, for the `symbol` fallback. Sized to the old plate's proportion. */
const SYMBOL_SIZE = 28;

/** The plate itself. 16pt corner, 13 vertical / 15 horizontal, 14 to the words. */
const PLATE_RADIUS = 16;
const PAD_V = 13;
const PAD_H = 15;
/** With a condition below, the header row gives 2pt back to it. */
const PAD_V_CONDITIONED = 11;
const TILE_GAP = 14;
/** Between the name and its line. The serif's own line box does the rest. */
const WORDS_GAP = 4;

/** The tile's ground on an accent plate — `canvas` at a low alpha, never a fourth oxblood. */
const ACCENT_TILE_ALPHA = 0.16;
/** The line under an accent plate's name. */
const ACCENT_LINE_ALPHA = 0.8;
/** The tile of a door whose method is unavailable. */
const SUBDUED_TILE_OPACITY = 0.5;

/** The condition's inset from the plate's own edges. */
const CONDITION_INSET = 11;
const CONDITION_PAD_V = 11;
const CONDITION_PAD_H = 13;
/**
 * `concentric(16, 11)` is 5, which is not a corner anybody draws at this size;
 * the frame lands the inner block at 11 — the same radius as the tile beside
 * it, which is the curvature the eye actually compares it to.
 */
const CONDITION_RADIUS = 11;
const CONDITION_GAP = 7;

export function DoorPlate({
  name,
  line,
  art,
  symbol,
  onPress,
  condition,
  subdued = false,
  tone = 'sand',
  accessibilityLabel,
}: DoorPlateProps) {
  const theme = useTheme();
  const press = usePressFeedback();
  const lead = tone === 'accent';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? name}
      accessibilityHint={line}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={{ minHeight: MIN_TAP_TARGET }}>
      {/* The compression lives on the outer layer so the plate and everything
          written on it compress as one object. `className` has no effect on a
          Reanimated view — NativeWind's interop is registered for the RN
          primitives only — so the ground and the corner are inline here. */}
      <Animated.View
        style={[
          {
            borderRadius: PLATE_RADIUS,
            overflow: 'hidden',
            backgroundColor: lead ? theme.accent : theme.sand,
          },
          press.style,
        ]}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: TILE_GAP,
            paddingHorizontal: PAD_H,
            paddingTop: PAD_V,
            paddingBottom: condition ? PAD_V_CONDITIONED : PAD_V,
          }}>
          <View
            style={{
              width: TILE_W,
              height: TILE_H,
              borderRadius: TILE_RADIUS,
              backgroundColor: lead ? canvasAlpha(ACCENT_TILE_ALPHA) : theme.canvas,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: subdued ? SUBDUED_TILE_OPACITY : 1,
            }}>
            {art ?? (symbol ? <SymbolView name={symbol} size={SYMBOL_SIZE} tintColor={theme.ink} /> : null)}
          </View>
          {/* `flex-1` so the name wraps inside the column at the larger
              Dynamic Type settings rather than pushing the tile off the plate.
              Nothing here shrinks or ellipsizes; the door grows. */}
          <View style={{ flex: 1, gap: WORDS_GAP }}>
            <Text
              variant={lead ? 'plate' : 'door'}
              style={{ color: lead ? theme.canvas : subdued ? theme.muted : theme.ink }}>
              {name}
            </Text>
            <Text variant="note" style={lead ? { color: canvasAlpha(ACCENT_LINE_ALPHA) } : undefined}>
              {line}
            </Text>
          </View>
        </View>
        {condition ? (
          <View style={{ marginHorizontal: CONDITION_INSET, marginBottom: CONDITION_INSET }}>
            {condition}
          </View>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

/**
 * The condition block that rides a door — exported so the fixtures and the one
 * other page that needs it draw the same object.
 *
 * A COLUMN, NOT A ROW. It used to put the sentence and its recovery side by
 * side, which worked while the sentence was short and broke the moment
 * Dynamic Type grew it: the link had no width left and wrapped to one word per
 * line. Stacked, the sentence takes the measure it needs and the action sits
 * under it on a full 44pt row, which is also the order VoiceOver should read
 * them in.
 *
 * Its ground is `canvas` — paper inside the tinted plate, so the block reads
 * as something laid ON the door rather than as a darker part of it.
 */
export function DoorCondition({ children }: { children: ReactNode }) {
  return (
    <View
      className="bg-canvas"
      style={{
        borderRadius: CONDITION_RADIUS,
        paddingVertical: CONDITION_PAD_V,
        paddingHorizontal: CONDITION_PAD_H,
        gap: CONDITION_GAP,
      }}>
      {children}
    </View>
  );
}

/**
 * The one action a condition may carry — AC-02's "Open Settings", CP-04's "How
 * to update", and the declined-consent door's "Change this".
 *
 * THIS IS THE CHOOSER'S ACCENT, and it is spent here rather than on a door
 * because a door that offered a coloured recovery would stop being a peer. A
 * link inside a condition is a recovery from a state; a coloured door is a
 * recommendation, and the page's whole question is which of four the reader
 * wants.
 *
 * A full 44pt row rather than a hit-slopped word: it sits at the bottom of a
 * block whose sentence may be two or three lines long, and a target that moves
 * with the text above it needs a floor of its own.
 */
export function DoorConditionAction({
  title,
  accessibilityLabel,
  accessibilityHint,
  onPress,
}: {
  title: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
      className="active:opacity-60">
      <Text variant="label" style={{ color: theme.accent }}>
        {title}
      </Text>
    </Pressable>
  );
}
