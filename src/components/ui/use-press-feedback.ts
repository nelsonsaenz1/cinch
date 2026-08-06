import {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { motion, PRESSED_OPACITY, spring } from '@/theme/tokens';

/**
 * How far a control compresses under a thumb. Apple's own filled controls sit
 * around 3%; more than that reads as a toy, less and the finger cannot tell.
 */
const PRESSED_SCALE = 0.97;

/**
 * The app's one press response: a slight compression and dim, interpolated.
 *
 * NativeWind's `active:opacity-*` is a *class toggle* — it snaps 1.0 → 0.7 in a
 * single frame, back the same way, and carries no scale at all. Every native
 * control the user compares this to compresses. Four different pressed
 * opacities had also accumulated across the app (60/70/80/90 — two rails on the
 * same screen disagreed), which is why the value lives in `PRESSED_OPACITY`
 * rather than here.
 *
 * Reduce Motion is handled by construction: `withTiming` and `spring.snappy`
 * both carry `ReduceMotion.System`, so the pressed state still *arrives* when
 * the setting is on — it simply arrives without a tween, which is the correct
 * behaviour for feedback the user asked for.
 *
 * Usage: spread the handlers onto a `Pressable` and put `style` on an
 * `Animated.View`. Note that `className` has no effect on Reanimated
 * components in this project — NativeWind's interop is registered for the RN
 * primitives only — so anything the animated layer needs must be an inline
 * style.
 *
 * @param enabled Pass `false` for a disabled or loading control, so a press
 *   that cannot do anything does not pretend otherwise.
 */
export function usePressFeedback(enabled = true) {
  const progress = useSharedValue(0);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - progress.value * (1 - PRESSED_SCALE) }],
    opacity: 1 - progress.value * (1 - PRESSED_OPACITY),
  }));

  const onPressIn = () => {
    if (!enabled) return;
    progress.value = withTiming(1, { duration: motion.duration.fast });
  };

  // Released unconditionally: `enabled` can flip to false mid-press (a button
  // that starts loading under the thumb), and a control left held down is worse
  // than one that never depressed.
  const onPressOut = () => {
    progress.value = withSpring(0, spring.snappy);
  };

  return { style, onPressIn, onPressOut };
}
