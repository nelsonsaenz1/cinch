import { useEffect } from 'react';
import { View, type ViewProps } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

export type SkeletonProps = ViewProps & {
  className?: string;
};

/**
 * Loading placeholder. Designed, not a spinner — a closet grid resolving into
 * place should feel like the content arriving, not like the app stalling.
 */
export function Skeleton({ className = '', ...rest }: SkeletonProps) {
  const pulse = useSharedValue(0.4);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(0.85, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [pulse]);

  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      style={style}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={`bg-tray dark:bg-tray-dark ${className}`}
      {...rest}
    />
  );
}

/** Grid-shaped skeleton matching the closet's two-column cutout layout. */
export function ClosetGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View className="flex-row flex-wrap px-gutter" accessibilityLabel="Loading your closet">
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} className="w-1/2 p-1.5">
          <Skeleton className="aspect-[3/4] w-full rounded-card" />
          <Skeleton className="mt-2 h-3 w-2/3 rounded-chip" />
        </View>
      ))}
    </View>
  );
}
