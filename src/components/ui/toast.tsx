import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { MIN_TAP_TARGET, spring, useTheme } from '@/theme/tokens';

export type ToastProps = {
  message: string;
  /** The trailing semibold verb — "Undo", "Retry". */
  actionLabel: string;
  onAction: () => void;
  /** Fired once the toast has finished LEAVING, for callers that clean up. */
  onDismiss?: () => void;
  visible: boolean;
};

/**
 * BR-06's ink toast — the one dark object in the system, bottom-anchored over
 * whatever screen mounts it. It renders and animates; it does NOT time itself
 * out. The 5-second window is a data-layer fact (the mutation actually fires
 * when it closes), so the timer lives with the mutation, never in chrome that
 * could be unmounted apart from it.
 *
 * `spring.smooth` carries `ReduceMotion.System`, so under the accessibility
 * setting the toast appears and leaves without travelling.
 */
export function Toast({ message, actionLabel, onAction, onDismiss, visible }: ToastProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // Kept in the tree while it animates out — the consent sheet's
  // policyMounted pattern. `progress` is 0 = parked below, 1 = shown.
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(visible ? 1 : 0);

  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) {
      setMounted(true);
      progress.set(withSpring(1, spring.snappy));
    } else {
      progress.set(
        withSpring(0, spring.smooth, (finished) => {
          if (finished) {
            runOnJS(setMounted)(false);
            if (onDismiss) runOnJS(onDismiss)();
          }
        }),
      );
    }
  }

  const slide = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 24 }],
  }));

  if (!mounted) return null;

  return (
    // box-none so the strip above the toast never eats the screen's touches.
    <View
      pointerEvents="box-none"
      className="absolute left-5 right-5"
      style={{ bottom: insets.bottom + 16 }}>
      <Animated.View
        accessibilityRole="alert"
        className="flex-row items-center justify-between gap-3"
        // BR-06: ink ground, r14 (no token lands on 14 — `md` is 12 — so the
        // atlas value stays inline), 14/16 padding.
        style={[
          {
            backgroundColor: theme.ink,
            borderRadius: 14,
            paddingVertical: 14,
            paddingHorizontal: 16,
          },
          slide,
        ]}>
        {/* Canvas on ink, inline — the same label treatment Button gives its
            ink variant; a `text-*` class cannot reliably beat the variant's. */}
        <Text variant="note" className="flex-1" style={{ color: theme.canvas }}>
          {message}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          hitSlop={12}
          style={{ minHeight: MIN_TAP_TARGET }}
          className="justify-center active:opacity-60">
          {/* Same 14px step as the message; the semibold cut alone marks it
              as the verb, per the atlas. */}
          <Text variant="note" className="font-semibold" style={{ color: theme.canvas }}>
            {actionLabel}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}
