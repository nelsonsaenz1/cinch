import { useEffect } from 'react';
import { View, type ViewProps } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/tokens';

export type SkeletonProps = ViewProps & {
  className?: string;
};

// The shimmer's two tones, transcribed from the handoff's own gradient stops.
// Not app tokens — this warm-paper pairing exists only for the sweep itself.
const SHIMMER_BASE = '#ECE8DF';
const SHIMMER_HIGHLIGHT = '#F5F2EB';

// Percentage travel for the highlight band — Yoga layout (unlike RN's
// `transform`) honours percentage strings, so the sweep needs no onLayout
// measurement or shared-value-per-instance width tracking.
const BAND_WIDTH = 60;

/**
 * Loading placeholder. Designed, not a stall — a closet grid resolving into
 * place should feel like the content arriving. A soft highlight band sweeps
 * left-to-right on loop, echoing the handoff's `linear-gradient` shimmer
 * without pulling in a gradient library: two flat tones plus a Reanimated
 * `left` tween cover the same ground.
 */
function Skeleton({ className = '', style, ...rest }: SkeletonProps) {
  const sweep = useSharedValue(0);

  useEffect(() => {
    sweep.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.linear }), -1, false);
  }, [sweep]);

  const highlightStyle = useAnimatedStyle(() => ({
    left: `${interpolate(sweep.value, [0, 1], [-BAND_WIDTH, 100])}%`,
    // Fades in/out at the edges of its own travel so the band reads as a soft
    // pass of light rather than a hard-edged bar sliding across.
    opacity: interpolate(sweep.value, [0, 0.5, 1], [0, 0.9, 0]),
  }));

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={className}
      style={[{ backgroundColor: SHIMMER_BASE, overflow: 'hidden' }, style]}
      {...rest}>
      <Animated.View
        style={[
          { position: 'absolute', top: 0, bottom: 0, width: `${BAND_WIDTH}%`, backgroundColor: SHIMMER_HIGHLIGHT },
          highlightStyle,
        ]}
      />
    </View>
  );
}

/** The small accent-tinted ring next to "Reading your wardrobe…". */
function Spinner() {
  const theme = useTheme();
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(withTiming(360, { duration: 800, easing: Easing.linear }), -1, false);
  }, [rotation]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        style,
        {
          width: 16,
          height: 16,
          borderRadius: 8,
          borderWidth: 2,
          borderColor: theme.rule,
          borderTopColor: theme.accent,
        },
      ]}
    />
  );
}

// The design varies each label bar's width for realism (70/55/65/60%); it's
// still static per-slot, not data, so it stays a presentational-only skeleton.
const LABEL_WIDTHS = ['70%', '55%', '65%', '60%'] as const;

/** Grid-shaped skeleton matching the closet's two-column cutout layout. */
export function ClosetGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View accessibilityLabel="Loading your closet">
      <View className="flex-row items-center gap-2.5 px-gutter pb-5 pt-4">
        <Spinner />
        <Text variant="body" className="text-muted dark:text-muted-dark">
          Reading your wardrobe…
        </Text>
      </View>
      <View className="flex-row flex-wrap px-gutter">
        {Array.from({ length: count }).map((_, i) => (
          <View key={i} className="w-1/2 p-1.5">
            <Skeleton className="aspect-[3/4] w-full rounded-card" />
            <Skeleton
              className="mt-2 h-3 rounded-chip"
              style={{ width: LABEL_WIDTHS[i % LABEL_WIDTHS.length] }}
            />
          </View>
        ))}
      </View>
    </View>
  );
}
