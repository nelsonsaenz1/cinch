import { useCallback } from 'react';
import { Pressable, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { usePressFeedback } from '@/components/ui/use-press-feedback';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme/tokens';

import { chipSpec } from './chip-spec';

export type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Renders a count suffix in tabular numerals, e.g. filter result counts. */
  count?: number;
  accessibilityHint?: string;
  /**
   * `outline` (default) is the interactive chip: a hairline ring that fills
   * with the accent when selected. `fill` is the READ-ONLY descriptive tag the
   * approved closet frame draws — a sand ground with no ring at all.
   *
   * Scoped deliberately rather than made the global style: the category filter
   * needs the outlined/filled pair to carry its selected state, and a filled
   * resting chip would leave it nothing to change into. Radius stays 12 in
   * both tones — the frame's 999 capsule is a recorded deviation, and one
   * radius grammar beats a 2px match to a mock that broke its own scale.
   *
   * `dashed` is the ABSENCE of a tag drawn as one — item detail's "+ Tag" at
   * the end of the chip row (I-01). Scoped to that shape rather than offered as
   * a general "add" style: it is the only chip in the app whose label names an
   * action instead of a value, and the muted ring and label are exactly what
   * keep it from reading as a tag the garment already carries.
   */
  tone?: 'outline' | 'fill' | 'dashed';
  /**
   * What the selected outline chip fills with. `accent` is the app-wide
   * default; the Closet State Atlas draws its category row's active chip in
   * ink (C-01), so the closet passes `ink`. Additive — no existing call site
   * changes meaning.
   */
  selectedGround?: 'accent' | 'ink';
  /**
   * A 9px colour dot before the label — item detail's colour chips (I-01),
   * where "Cognac" is only half of what the tag says and the dot is the rest.
   *
   * A bare `View` rather than `Swatch`, and a prop rather than a leading slot:
   * `Swatch`'s size union is the five circles the app genuinely draws (14–30),
   * and 9 is under all of them because this is chip furniture sized to a 13px
   * label, not a swatch a finger ever goes near. Nullable on purpose — the
   * tagger writes name-only colours (see `itemColor` in schemas/item.ts), and a
   * chip with no hex is simply a labelled chip. Never an invented colour.
   */
  swatchHex?: string | null;
  /**
   * How much of the 44pt floor the chip draws rather than borrows.
   *
   * `compact` (default) is what every existing call site gets: a 32pt chip
   * whose touch target is padded out to 44 with `hitSlop`. Right for a filter
   * rail or a row of tags, where the chips are a texture and drawing them all
   * at 44 would make a wall.
   *
   * `tap` is 44pt of REAL geometry with roomier padding — the New Occasion
   * atlas's dress-code row (N-04) and the two chips on a dateless occasion
   * (N-10). The atlas argues for it directly: "44pt of real geometry, wrapped,
   * never a scrolling row that hides the fourth option." Four chips that wrap
   * onto two lines only stay comfortable if the lines are far enough apart to
   * aim between, which invisible hitSlop cannot give you — overlapping slop
   * between wrapped rows makes the boundary a coin toss. Border and label size
   * are untouched: this is geometry, not a second chip style.
   */
  size?: 'compact' | 'tap';
};

/**
 * The workhorse of tag editing. The review deck needs a correction to take one
 * tap, so tags are always chips — never a picker, never a dropdown, never a
 * form field.
 */
export function Chip({
  label,
  selected = false,
  onPress,
  count,
  accessibilityHint,
  tone = 'outline',
  selectedGround = 'accent',
  swatchHex,
  size = 'compact',
}: ChipProps) {
  const theme = useTheme();
  const spec = chipSpec({ tone, selected, selectedGround, size, pressable: Boolean(onPress) });
  // The app's one press response (UX-07). A chip had NO visible pressed state
  // at all — the haptic ticked and the pixels sat still, which on a filter
  // rail read as a dead tap until the count changed. The compression rides an
  // Animated.View around the drawn chip, because the ground and ring live on
  // an inner View (NativeWind cannot paint Reanimated wrappers) and a scale
  // on the content alone would squeeze the label inside a rigid ring.
  const feedback = usePressFeedback(Boolean(onPress));

  // The selection tick every other control in the app gives a tap. A chip IS a
  // selection, so this is the one intent it can spend. Best-effort by
  // construction in lib/haptics — a failure never eats the press.
  const press = useCallback(() => {
    if (!onPress) return;
    haptics.selection();
    onPress();
  }, [onPress]);

  // ── AUDIT 2026-09-02 · 46 · AN INERT CHIP IS NOT A CONTROL ────────────────
  //
  // "Tag chips are inconsistently exposed as buttons versus plain text;
  // normalize interaction and semantics." Every chip in the app was a
  // `Pressable` whether or not it had anything to press: the role was already
  // reported honestly as `text`, but the node still claimed a 44pt padded touch
  // target, still ran the press-feedback hooks, and — on item detail, where
  // four of the five tags are read-only — put four dead targets in a row beside
  // one live one. A finger that lands on a target and gets nothing is the
  // clearest possible statement that a screen is broken.
  //
  // A chip with no handler is now a plain `View`. Nothing else changes: the
  // ground, the ring, the swatch and the label are the same drawn output, and
  // `chipSpec` already withheld the pressed `active:` class from this case.
  const Frame = onPress ? Pressable : View;

  return (
    <Frame
      accessibilityRole={onPress ? 'button' : 'text'}
      // Reported only for a chip that can actually be pressed. `selected` is a
      // state a control is IN, and item detail draws its category chip in the
      // selected ink treatment purely as a look — announcing "selected" on a tag
      // nobody can toggle describes an affordance that is not there.
      accessibilityState={onPress ? { selected } : undefined}
      accessibilityHint={accessibilityHint}
      onPress={onPress ? press : undefined}
      // A compact chip's visual height stays 32 and the touch target is padded
      // out to 44pt. A `tap` chip already IS 44, so it takes no vertical slop:
      // in a wrapped row the slop of one line would reach into the next and
      // leave the boundary between them ambiguous.
      hitSlop={spec.hitSlop}
      onPressIn={feedback.onPressIn}
      onPressOut={feedback.onPressOut}
      // The Pressable carries its own height, exactly as Button does. The
      // 2026-08-20 compression pass (dc26774) moved every style onto the
      // inner View and left this Pressable bare, and a bare Pressable whose
      // only child is a Reanimated wrapper stopped receiving presses at all —
      // production `closet_filter` events stop within hours of that OTA, and
      // the 2026-08-31 funnel run's "category stayed top" was this same dead
      // row under the item editor's chips. Button never lost its presses, and
      // the one structural difference was this line plus the wrapper's
      // pointerEvents below.
      style={{ minHeight: spec.minHeight }}>
      <Animated.View style={feedback.style} pointerEvents="none">
        <View
          style={{ minHeight: spec.minHeight, ...(spec.borderColor ? { borderColor: spec.borderColor } : null) }}
          className={`flex-row items-center justify-center rounded-chip ${spec.padding} ${spec.ground}`}>
      {/* Inline geometry rather than a class: 9px has no spacing step, and it
          should not get one for a single dot. `mr-1.5` is the atlas's 6px gap. */}
      {swatchHex ? (
        <View
          className="mr-1.5"
          style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: swatchHex }}
        />
      ) : null}
      {/* Inline style, not a className: `variant="label"` already carries
 `text-muted`, and NativeWind gives no guaranteed precedence between
          two `text-*` utilities on one element — so a `text-canvas` class here
          lost and the selected chip read muted-on-accent. */}
      <Text
        variant="label"
        style={{ color: theme[spec.label] }}>
        {label}
      </Text>
      {/* `statSmall`, not `stat` + a `text-label` override: two size utilities
          on one element have no defined precedence in NativeWind — the same
          hazard as the colours above. The variant names the size once. */}
      {count !== undefined ? (
        <Text
          variant="statSmall"
          className="ml-1.5"
          style={{ color: `${theme[spec.count.token]}${spec.count.alpha ?? ''}` }}>
          {count}
        </Text>
      ) : null}
        </View>
      </Animated.View>
    </Frame>
  );
}
