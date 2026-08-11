import { useEffect } from 'react';
import { View, type ViewProps } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/tokens';

export type SkeletonProps = ViewProps & {
  className?: string;
  /**
   * Milliseconds before the sweep starts. The Lately atlas staggers its rows
   * 120ms apart so a card of placeholders reads as lines arriving in order
   * rather than one graphic pulsing; per-instance because only the composed
   * skeleton knows which row it is.
   */
  delay?: number;
};

// The shimmer's two tones, transcribed from the handoff's own gradient stops.
// Not app tokens — this warm-paper pairing exists only for the sweep itself.
// (The Lately atlas restates the base as #EDE8DD, a point away; the handoff's
// stop stays authoritative for the shared primitive.)
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
 *
 * Exported: this is the primitive the composed skeletons below are built from,
 * and the one any screen with a shape of its own should build from too. It was
 * module-private for a while, which is why 45 screens shipped a bare
 * `ActivityIndicator` — the designed option was not reachable.
 */
export function Skeleton({ className = '', style, delay = 0, ...rest }: SkeletonProps) {
  const reduced = useReducedMotion();
  const sweep = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    sweep.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 1300, easing: Easing.linear }), -1, false),
    );
    // A loop with -1 repetitions outlives its component unless it is told not
    // to; on a screen that mounts a dozen of these, that is a dozen worklets
    // still ticking after the content arrived.
    return () => cancelAnimation(sweep);
  }, [reduced, sweep, delay]);

  const highlightStyle = useAnimatedStyle(() =>
    reduced
      ? {
          // Reduce Motion: the band parks in the middle of its own travel at
          // half strength. The cell keeps the soft two-tone depth that says
          // "placeholder" and loses only the part that moves.
          left: `${(100 - BAND_WIDTH) / 2}%`,
          opacity: 0.45,
        }
      : {
          left: `${interpolate(sweep.value, [0, 1], [-BAND_WIDTH, 100])}%`,
          // Fades in/out at the edges of its own travel so the band reads as a
          // soft pass of light rather than a hard-edged bar sliding across.
          opacity: interpolate(sweep.value, [0, 0.5, 1], [0, 0.9, 0]),
        },
  );

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
export function Spinner() {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const rotation = useSharedValue(0);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (reduced) {
      // Rotation is the vestibular half of a spinner; a cross-fade is not, and
      // Apple treats opacity as the sanctioned substitute. The ring still has
      // to say "working" — a frozen one says "stuck".
      //
      // `ReduceMotion.Never` on both the tween and the repeat is required, not
      // decorative: Reanimated defaults every animation to `System`, so the
      // setting that asked for this pulse would otherwise cancel it on the
      // first frame.
      pulse.value = withRepeat(
        withTiming(0.35, {
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          reduceMotion: ReduceMotion.Never,
        }),
        -1,
        true,
        undefined,
        ReduceMotion.Never,
      );
      return () => cancelAnimation(pulse);
    }
    rotation.value = withRepeat(withTiming(360, { duration: 800, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(rotation);
  }, [reduced, rotation, pulse]);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
    opacity: pulse.value,
  }));

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

/**
 * The lead-in line above a skeleton — the ring plus a sentence saying what is
 * being read. Optional, and deliberately so: it earns its place on a whole
 * screen (Closet, Today) where the wait is the only thing happening, and gets
 * in the way inside a card that already has a heading over it.
 */
export function SkeletonLead({ label }: { label: string }) {
  return (
    <View className="flex-row items-center gap-2.5 px-gutter pb-5 pt-4">
      <Spinner />
      <Text variant="body" className="text-muted">
        {label}
      </Text>
    </View>
  );
}

// The design varies each label bar's width for realism (70/55/65/60%); it's
// still static per-slot, not data, so it stays a presentational-only skeleton.
const LABEL_WIDTHS = ['70%', '55%', '65%', '60%'] as const;

/** Grid-shaped skeleton matching the closet's two-column cutout layout. */
export function ClosetGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View accessibilityLabel="Loading your closet">
      <SkeletonLead label="Reading your wardrobe…" />
      <View className="flex-row flex-wrap px-gutter">
        {Array.from({ length: count }).map((_, i) => (
          <View key={i} className="w-1/2 p-1.5">
            {/* Geometry tracks item-card.tsx L51 exactly — aspect-[4/5] and
                rounded-lg, not the 3/4 + 20px this used to guess at. A
                skeleton whose cell is a different shape from the cell that
                replaces it makes the whole grid jump when data lands, which
                reads as a bug rather than as content arriving. */}
            <Skeleton className="aspect-[4/5] w-full rounded-lg" />
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

/**
 * One list row: monogram disc, name, subtitle. Matches the anatomy shared by
 * `RosterRow`, `ProfileRow` and the invite candidate rows — 32pt circle, two
 * bars, hairline beneath.
 */
export function RowSkeleton({
  avatar = true,
  isLast = false,
  width = '60%',
}: {
  /** Set false for rows that are text-only, e.g. a borrow thread. */
  avatar?: boolean;
  isLast?: boolean;
  /** The primary bar's width. Vary it across a list so rows don't stripe. */
  width?: `${number}%`;
}) {
  return (
    <View
      className={[
 'flex-row items-center gap-3 py-2.5',
        isLast ? '' : 'border-b border-hairline',
      ].join(' ')}
      style={{ minHeight: 44 }}>
      {avatar ? <Skeleton className="h-8 w-8 rounded-full" /> : null}
      <View className="flex-1 gap-2">
        <Skeleton className="h-3.5 rounded-chip" style={{ width }} />
        <Skeleton className="h-2.5 w-1/3 rounded-chip" />
      </View>
    </View>
  );
}

// Same reasoning as LABEL_WIDTHS: a column of identical bars reads as a
// loading *graphic*, a ragged one reads as names about to arrive.
const ROW_WIDTHS = ['62%', '48%', '70%', '54%', '66%'] as const;

/**
 * A list of `RowSkeleton`s in the gutter — friends, the guest list, borrow
 * threads, blocked users. The replacement for the app's two other loading
 * dialects: the bare `ActivityIndicator` and the bare sentence
 * ("Reading your circle…"), neither of which says anything about the shape of
 * what is coming.
 */
export function ListSkeleton({
  count = 4,
  avatar = true,
  label,
}: {
  count?: number;
  avatar?: boolean;
  /** Renders the ring-and-sentence lead-in above the rows. */
  label?: string;
}) {
  return (
    <View accessibilityLabel={label ?? 'Loading'}>
      {label ? <SkeletonLead label={label} /> : null}
      <View className="px-gutter">
        {Array.from({ length: count }).map((_, i) => (
          <RowSkeleton
            key={i}
            avatar={avatar}
            isLast={i === count - 1}
            width={ROW_WIDTHS[i % ROW_WIDTHS.length]}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * The outfit plate, before it has an outfit — the shape of `plate.tsx`'s card
 * (title row, reasoning, garment well, colophon, the ruled cost-per-wear
 * footer) with every line of type replaced by a bar.
 *
 * Today spent every other state on a real composition and then fell back to a
 * centred spinner for the one state the user sees every single morning. A
 * plate-shaped wait tells her the plate is coming; a spinner tells her nothing
 * and could just as well resolve into an error.
 */
export function PlateSkeleton({ count = 1 }: { count?: number }) {
  return (
    <View accessibilityLabel="Styling your day">
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} className="mb-section px-gutter">
          <Card padding="lg">
            {/* Title + the weather colophon opposite it. */}
            <View className="flex-row items-baseline justify-between gap-3">
              <Skeleton className="h-5 flex-1 rounded-chip" />
              <Skeleton className="h-2.5 w-16 rounded-chip" />
            </View>

            {/* The two-line reasoning. */}
            <View className="mt-3 gap-2">
              <Skeleton className="h-3.5 w-full rounded-chip" />
              <Skeleton className="h-3.5 w-4/5 rounded-chip" />
            </View>

            {/* The garment well. The stack it stands in for is taller than it
                is wide, so the placeholder is too — a square here collapses
                the card and the page reflows when the outfit lands. */}
            <Skeleton className="mt-4 aspect-[5/4] w-full rounded-lg" />

            <Skeleton className="mt-3 h-3 w-2/3 rounded-chip" />

            {/* The ruled footer: label left, cost-per-wear figure right. */}
            <View className="mt-4 flex-row items-center justify-between border-t border-rule pt-3">
              <Skeleton className="h-3.5 w-24 rounded-chip" />
              <Skeleton className="h-4 w-14 rounded-chip" />
            </View>
          </Card>
        </View>
      ))}
    </View>
  );
}
