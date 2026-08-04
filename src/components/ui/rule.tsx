import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { fadeEasing } from '@/theme/tokens';

/**
 * The 1px structural rule of the plate grammar. `hairline` is for quiet row
 * dividers; this is the printed line that carries the lookbook's structure.
 */
export function Rule({ className = '' }: { className?: string }) {
  return <View className={`h-hair w-full bg-rule dark:bg-rule-dark ${className}`} />;
}

/** A rule that draws itself left to right, like a pen stroke. */
export function DrawnRule({ delay = 0 }: { delay?: number }) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: 420, easing: Easing.bezier(...fadeEasing) }),
    );
  }, [delay, progress, reduced]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scaleX: progress.value }],
  }));

  return (
    <View className="w-full overflow-hidden">
      <Animated.View
        className="bg-rule dark:bg-rule-dark"
        style={[{ height: 1, transformOrigin: 'left' }, style]}
      />
    </View>
  );
}
