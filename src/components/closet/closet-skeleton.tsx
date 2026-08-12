import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { motion, useTheme } from '@/theme/tokens';

/**
 * C-06 — the closet loading.
 *
 * ── WHY THIS DOES NOT USE `ui/skeleton.tsx`'s `Skeleton` ──────────────────
 *
 * That primitive is a SWEEP: a highlight band travelling left-to-right on an
 * infinite loop. C-06 refuses it in as many words — "The bars carry a 380 ms
 * opacity breath at 6% amplitude, and under Reduce Motion they hold at their
 * mid value — no shimmer sweep in either case, and no spinner." A sweep is a
 * different animal from a breath: it implies direction and progress across the
 * cell, which is the bar treatment this group has already refused once.
 *
 * So the bars here are plain views under one shared `breath` value. One shared
 * value, not one per bar: a dozen independent worklets ticking at 380ms is a
 * dozen chances for them to drift out of phase, and a placeholder grid whose
 * cells pulse against each other reads as noise rather than as waiting.
 *
 * ── SKELETON GEOMETRY = FINAL GEOMETRY ────────────────────────────────────
 *
 * "Every placeholder occupies the exact rectangle its content will occupy: 168
 * pt wells, 15 pt name bars, 13 pt metadata bars in the lighter tray tone, and
 * chips at their real widths, so nothing shifts when data lands."
 *
 * Those four figures are read off the shipping card, not off the frame's
 * picture of it: `ItemCard` draws a 168pt well (it was 196 before Wave 3 and
 * this file still said 170), a 15pt name and a 13pt metadata line, in a grid
 * whose columns are `px-1.5` either side. A skeleton measured against the old
 * card is the shift the state exists to prevent.
 *
 * The masthead block above the grid deliberately still mirrors the masthead
 * this screen SHIPS — identity row, stat row — rather than the serif title
 * block C-01's frame draws, because mirroring is the whole criterion and the
 * masthead rebuild is not this lane's state. See the lane report.
 */

/**
 * The breath, as the frame specifies it: 6% of amplitude, so the bars travel
 * between 94% and 100% opacity and hold at 97% — the mid value — whenever they
 * are not moving.
 */
const BREATH_LOW = 0.94;
const BREATH_HIGH = 1;
const BREATH_MID = (BREATH_LOW + BREATH_HIGH) / 2;

/** The chips at their real widths, per the frame. */
const CHIP_WIDTHS = [78, 86, 104, 70] as const;
/** Name and metadata bar widths, varied per slot; still static, still literal. */
const NAME_WIDTHS = [120, 104, 132, 96] as const;
const META_WIDTHS = [150, 138, 118, 144] as const;

export type ClosetSkeletonProps = {
  /**
   * Hold every bar at the mid value and start no animation at all.
   *
   * For the canonical fixture. A captured viewport cannot reproduce a running
   * loop — its bytes differ between two screenshots of the same code — so the
   * frame that gets captured has to be a settled one. Reduce Motion reaches
   * the same still frame by its own route, which is the frame's own rule.
   */
  still?: boolean;
};

export function ClosetSkeleton({ still = false }: ClosetSkeletonProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const held = still || reduced;

  const breath = useSharedValue(0.5);
  useEffect(() => {
    if (held) {
      breath.value = 0.5;
      return;
    }
    breath.value = withRepeat(
      withTiming(1, { duration: motion.duration.slow, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    // A -1 repeat outlives its component unless told otherwise; on a screen
    // that mounts a dozen bars that is a dozen worklets still ticking after
    // the closet has arrived.
    return () => cancelAnimation(breath);
  }, [held, breath]);

  const breathing = useAnimatedStyle(() => ({
    opacity: interpolate(breath.value, [0, 1], [BREATH_LOW, BREATH_HIGH]),
  }));

  const primary = { backgroundColor: theme.sand };
  // "metadata bars in the lighter tray tone" — the frame's own second value.
  const secondary = { backgroundColor: theme.tray };

  /**
   * One bar. A plain call, not a nested component: a component declared inside
   * a render body is a new type on every render, so React unmounts and remounts
   * every bar — which would restart the breath from zero on each pass and is
   * what `react/no-unstable-nested-components` exists to catch.
   *
   * `style`, never `className`: NativeWind's interop skips Reanimated views, so
   * a class here would be silently dropped.
   */
  const bar = (key: string | number, style: Record<string, unknown>) => (
    <Animated.View
      key={key}
      style={[style, held ? { opacity: BREATH_MID } : breathing]}
    />
  );

  return (
    <View accessibilityLabel="Loading your closet">
      {/* Identity row — 66pt avatar circle, name bar, sub-line bar. Mirrors the
          masthead this screen ships, which is the criterion. */}
      <View className="flex-row items-center px-gutter" style={{ paddingTop: 14, gap: 14 }}>
        {bar('avatar', { ...primary, width: 66, height: 66, borderRadius: 33 })}
        <View className="flex-1">
          {bar('name', { ...primary, width: 150, height: 20, borderRadius: 4 })}
          {bar('handle', { ...secondary, marginTop: 8, width: 110, height: 11, borderRadius: 4 })}
        </View>
      </View>

      {/* Stat row — four equal columns between the hairlines. */}
      <View
        className="mx-gutter flex-row border-b border-t border-hairline"
        style={{ marginTop: 22, paddingVertical: 14 }}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} className="flex-1 items-center">
            {bar(i, { ...primary, width: 40, height: 18, borderRadius: 4 })}
          </View>
        ))}
      </View>

      {/* The chips at their real widths and their real height — 38pt at r12,
          the same geometry `CategoryChipsRow` lays out, padded left only so the
          rail's honest partial survives into the wait. */}
      <View className="flex-row" style={{ marginTop: 14, gap: 8, paddingLeft: 20 }}>
        {CHIP_WIDTHS.map((width, i) =>
          bar(i, { ...primary, width, height: 38, borderRadius: 12 }),
        )}
      </View>

      {/* The grid, at the CARD's geometry: a 168pt well, a 15pt name bar 10pt
          under it, a 13pt metadata bar 6pt under that. `px-1.5` per column is
          the card's own inset, so the wells land where the photographs will. */}
      <View className="flex-row flex-wrap px-gutter" style={{ marginTop: 16 }}>
        {NAME_WIDTHS.map((nameWidth, i) => (
          <View key={i} className="px-1.5 pb-2.5" style={{ width: '50%' }}>
            {bar('well', { ...primary, height: 168, borderRadius: 12 })}
            {bar('name', {
              ...primary,
              marginTop: 10,
              width: nameWidth,
              height: 15,
              borderRadius: 4,
            })}
            {bar('meta', {
              ...secondary,
              marginTop: 6,
              width: META_WIDTHS[i],
              height: 13,
              borderRadius: 4,
            })}
          </View>
        ))}
      </View>
    </View>
  );
}
