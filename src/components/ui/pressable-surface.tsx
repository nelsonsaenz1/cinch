import { forwardRef, useCallback } from 'react';
import { Pressable, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { usePressFeedback } from '@/components/ui/use-press-feedback';
import { haptics, type HapticIntent } from '@/lib/haptics';
import { MIN_TAP_TARGET } from '@/theme/metrics';

/**
 * UX-07 — one press response, wearing a shape any surface can adopt.
 *
 * `usePressFeedback` has existed since Wave 3 and answers the question
 * correctly: a slight compression and dim, interpolated, Reduce-Motion-safe by
 * construction. What it does not answer is the ADOPTION question. Using it costs
 * four lines and a structural change — an `Animated.View` inside the `Pressable`
 * with the visuals moved onto it — which is why 30 call sites took it and
 * roughly 225 did not, and why the ones that did not fell back on NativeWind's
 * `active:opacity-*`: a class toggle that snaps in one frame, carries no scale,
 * and had accumulated four different opacities before `PRESSED_OPACITY` existed.
 *
 * This component is the hook with the structural cost already paid. A raw
 * `Pressable` becomes a compliant one by changing its name and nothing else.
 *
 * ── What it composes ─────────────────────────────────────────────────────────
 *
 * · The compression and dim, from `usePressFeedback`, on an inner animated
 *   layer — so a caller's `className` keeps painting the ground exactly as it
 *   did. NativeWind's interop is registered for the RN primitives and not for
 *   Reanimated's wrappers, so the ground CANNOT move onto the animated layer;
 *   putting the layer INSIDE and letting it carry only the transform is what
 *   makes this a drop-in rather than a rewrite of every call site's styling.
 * · The 44pt floor, as `minHeight` — Apple's minimum, not a target, and the one
 *   invariant the design plan states for every persistent control.
 * · `accessibilityState` derived from `disabled`/`busy`, so a control that
 *   cannot act says so to VoiceOver as well as to the eye. The research names
 *   "maintain visible disabled/busy states" as part of UX-07; announcing them is
 *   the same requirement one layer down.
 * · An optional haptic INTENT — a name from `lib/haptics`, never a strength.
 *   Off by default: the policy is that most presses get no tick, and a default
 *   of `undefined` is what makes that the path of least resistance.
 *
 * ── What it deliberately does not do ─────────────────────────────────────────
 *
 * It does not fire the haptic when disabled, and it does not fire it on
 * `onPressIn` — a tick before the action is a promise the press may not keep.
 * It does not own layout: no padding, no radius, no ground. And it does not
 * replace `Button` or `Chip`, which have their own visual contracts pinned by
 * `button-spec.ts` and `chip-spec.ts`; this is for the surfaces that never had
 * one — cards, rows, tiles, icon targets.
 */
export type PressableSurfaceProps = Omit<PressableProps, 'style' | 'children'> & {
  children?: React.ReactNode;
  className?: string;
  /**
   * A haptic intent from `lib/haptics`, or omitted for silence.
   *
   * Omitted is the default and the common case. Per UX-07, routine navigation
   * gets no tick — and there is no navigation intent to pass here even if a call
   * site wanted one.
   */
  haptic?: HapticIntent;
  /**
   * Reported to VoiceOver as `busy`, and suppresses both the press animation and
   * the haptic. Distinct from `disabled`: a busy control is one the user already
   * acted on, and it must not accept a second press while the first is in
   * flight.
   */
  busy?: boolean;
  /**
   * Drop the 44pt `minHeight` floor.
   *
   * For the few surfaces whose geometry is fixed by a grid — a closet tile in a
   * three-column row is far past 44 already, and a `minHeight` on it is dead
   * weight — and for a control nested inside a parent that already provides the
   * target. NOT an escape hatch for making something small: a target under 44pt
   * needs `hitSlop`, which `Pressable` takes directly.
   */
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
  /**
   * Layout for the animated layer that wraps the children.
   *
   * THE ONE THING ADOPTION COSTS, and it is worth stating plainly rather than
   * discovering. The compression has to ride a `Animated.View`, and that view is
   * a real layout box between the `Pressable` and its children — so a call site
   * whose `className` arranged those children (`flex-row`, `items-center`,
   * `justify-between`) is now arranging ONE child instead of three, and the row
   * collapses to a column.
   *
   * Padding, radius, ground and margin on the `Pressable` are unaffected and
   * stay exactly where they are; only the arrangement of the children moves. It
   * has to move to a `style` rather than a `className` because NativeWind's
   * interop is registered for the RN primitives and not for Reanimated's
   * wrappers — a class here would silently do nothing, which is the same trap
   * `tokens.ts` documents for `bg-sand` on a Button's animated ground.
   *
   * Defaults to `{ flex: 1 }`, which is right for the common case of a surface
   * that fills its target.
   */
  contentStyle?: StyleProp<ViewStyle>;
};

export const PressableSurface = forwardRef<View, PressableSurfaceProps>(function PressableSurface(
  {
    children,
    className = '',
    haptic,
    busy = false,
    fill = false,
    contentStyle,
    disabled,
    accessibilityState,
    onPress,
    onPressIn,
    onPressOut,
    style,
    ...rest
  },
  ref,
) {
  const inert = Boolean(disabled) || busy;
  const press = usePressFeedback(!inert);

  const handlePress = useCallback<NonNullable<PressableProps['onPress']>>(
    (event) => {
      // Guarded even though `Pressable` is passed `disabled`: `busy` can flip
      // true between the press-in and the press, and the guard is cheaper than
      // reasoning about that race at every call site.
      if (inert) return;
      if (haptic) haptics[haptic]();
      onPress?.(event);
    },
    [inert, haptic, onPress],
  );

  return (
    <Pressable
      ref={ref}
      disabled={inert}
      // Merged rather than replaced: `selected`, `checked` and `expanded` are
      // the caller's to state, and only the two this component actually knows
      // about are filled in here.
      accessibilityState={{ disabled: inert, busy, ...accessibilityState }}
      onPress={handlePress}
      onPressIn={(event) => {
        press.onPressIn();
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        press.onPressOut();
        onPressOut?.(event);
      }}
      style={[fill ? null : { minHeight: MIN_TAP_TARGET }, style]}
      className={className}
      {...rest}>
      {/* The animated layer sits INSIDE and carries the transform — see the
          header for why it cannot sit outside, and `contentStyle` for the one
          thing that costs a caller. */}
      <Animated.View style={[contentStyle ?? { flex: 1 }, press.style]}>{children}</Animated.View>
    </Pressable>
  );
});
