import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { barTone, WAVEFORM, WAVEFORM_PITCH } from '@/features/intake/walkthrough-spec';
import { useTheme } from '@/theme/tokens';

/**
 * V-02's seismograph.
 *
 * The directive is explicit about what this is NOT: not a circle, not a
 * pulsing orb. It is "the most honest possible representation of 'I am
 * hearing you'" — a single horizontal rule of ~48 short vertical strokes,
 * scrolling right to left, each stroke's height set by amplitude at the
 * moment it was drawn. Someone stares at this for up to four minutes, so it
 * has to be calm rather than showy, and it must never drop a frame.
 *
 * WHY THE PROP IS A SHARED VALUE, NOT A NUMBER
 *
 * `useRecorder` (src/features/intake/use-recorder.ts) already answers this
 * exactly the way this component needs it answered: `amplitude` is a
 * Reanimated `SharedValue<number>`, written by a JS-thread interval at ~30Hz,
 * specifically so nothing downstream has to re-render 30 times a second. That
 * hook's own comment explains why: routing 30 updates/sec through `useState`
 * is ~30 React renders a second for the whole subtree, which is the one thing
 * a four-minute-long screen cannot afford. LevelMeter reads `amplitude.value`
 * from its own UI-thread sampling tick below and never touches React state for
 * anything that changes faster than once per tick — the only `setState`-shaped
 * work in this file is the `setInterval` that schedules those ticks, and that
 * fires at ~11Hz, not 30.
 *
 * HOW THE SCROLL WORKS WITHOUT RE-RENDERING 48 VIEWS
 *
 * Instead of moving 48 real strokes, the buffer holds 49 samples (48 visible +
 * one waiting just past the right edge) at FIXED x-positions, and a single
 * `translateX` on the whole row animates continuously from 0 to -PITCH. The
 * instant that reaches -PITCH, the buffer array is reassigned one slot to the
 * left (oldest sample dropped, new one appended) and `translateX` snaps back
 * to 0 — which lands every stroke in exactly the pixel position it was already
 * occupying, so the reset is invisible and the motion reads as continuous. The
 * same technique any strip-chart recorder uses: the pens don't move, the paper
 * does.
 */

export type LevelMeterProps = {
  /**
   * 0…1, mutated on the JS thread at roughly 30Hz by the caller — see
   * `useRecorder`. LevelMeter samples this itself on its own ~11Hz cadence
   * (STROKE_INTERVAL_MS below); it does not need or want every one of the
   * caller's 30 updates a second, only enough to keep 48 strokes worth of
   * history moving smoothly.
   */
  amplitude: SharedValue<number>;
  /**
   * Freezes the meter in place without unmounting it — for V-02's Pause,
   * where the recording (and the screen) holds rather than resetting.
   * Defaults to true.
   */
  active?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * ── REDESIGN 24: WIDER, WARMER, SAME MECHANISM ─────────────────────────────
 *
 * Every geometry and colour value below now comes from `walkthrough-spec.ts`,
 * transcribed from the approved artifact: "Waveform 76pt tall, 4pt bars, 3pt
 * gaps, alternating oxblood and clay." The strokes grew, the gaps tightened,
 * the field went from 40pt to 76pt, and the single ink-at-35% tone became the
 * two warm accents.
 *
 * WHAT DID NOT CHANGE IS THE PART THAT WAS ARGUED. Same ~11Hz sampling of the
 * caller's shared value, same 48-stroke history, same strip-chart translate,
 * same Reduce Motion collapse, same `accessibilityElementsHidden`. This is a
 * paint pass over a mechanism that already represents amplitude honestly, and
 * the tone alternates by INDEX rather than by sample (`barTone`) precisely so
 * that colour never encodes loudness — a hue that moved with volume would be
 * the waveform inferring content, which is the one thing it must never do.
 */

/** ~48 strokes, per the directive, exactly. */
const STROKE_COUNT = WAVEFORM.count;
/** One extra slot, held just past the right edge, mid-transition into view. */
const BUFFER_SIZE = STROKE_COUNT + 1;
/**
 * How often a new sample enters. 48 strokes × 90ms ≈ 4.3s of visible history —
 * slow enough to read as calm rather than jittery, fast enough that a fresh
 * syllable shows up on screen almost immediately. Deliberately coarser than
 * the caller's own ~30Hz poll (see the file comment): a seismograph does not
 * need to catch every instantaneous peak, only to keep proving it is awake.
 */
const STROKE_INTERVAL_MS = 90;
const STROKE_WIDTH = WAVEFORM.barWidth;
const STROKE_GAP = WAVEFORM.gap;
const PITCH = WAVEFORM_PITCH;
/** A stroke never fully disappears — a flat line reads as broken, not calm. */
const STROKE_MIN_HEIGHT = WAVEFORM.minHeight;
const STROKE_MAX_HEIGHT = WAVEFORM.height;

export function LevelMeter({ amplitude, active = true, style }: LevelMeterProps) {
  const reduceMotion = useReducedMotion();
  const theme = useTheme();
  // Reduce Motion: the continuous scroll and the per-stroke grow/shrink both
  // collapse to instant steps. The meter still updates every tick and still
  // proves the app is listening — only the gliding motion between ticks is
  // removed, the same trade review-card.tsx makes for its fly-off.
  const tickDuration = reduceMotion ? 0 : STROKE_INTERVAL_MS;

  const buffer = useSharedValue<number[]>(new Array(BUFFER_SIZE).fill(0));
  const scrollX = useSharedValue(0);

  useEffect(() => {
    if (!active) return;

    const id = setInterval(() => {
      // Read, not subscribe — a plain JS-thread read of the caller's shared
      // value. This is the only JS-thread work in the file, and it is cheap:
      // one array slice/spread of 49 numbers, ~11 times a second.
      const sample = amplitude.value;
      buffer.value = [...buffer.value.slice(1), sample];
      scrollX.value = 0;
      scrollX.value = withTiming(-PITCH, { duration: tickDuration, easing: Easing.linear });
    }, STROKE_INTERVAL_MS);

    return () => clearInterval(id);
  }, [active, amplitude, buffer, scrollX, tickDuration]);

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: scrollX.value }],
  }));

  return (
    // Decorative — the recording's real state (Pause/Done, elapsed time) is
    // carried by ordinary accessible controls elsewhere on V-02. A moving
    // bar-chart with no state to announce is noise to VoiceOver, not content.
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.frame, style]}>
      <Animated.View style={[styles.row, rowStyle]}>
        {Array.from({ length: BUFFER_SIZE }, (_, i) => i).map((i) => (
          <Stroke
            key={i}
            index={i}
            buffer={buffer}
            duration={tickDuration}
            colour={theme[barTone(i)]}
          />
        ))}
      </Animated.View>
    </View>
  );
}

function Stroke({
  index,
  buffer,
  duration,
  colour,
}: {
  index: number;
  buffer: SharedValue<number[]>;
  duration: number;
  /** Resolved from `barTone(index)` by the caller — fixed for this stroke's
   *  lifetime, so nothing about the colour tracks the sample. */
  colour: string;
}) {
  const style = useAnimatedStyle(() => {
    const sample = buffer.value[index] ?? 0;
    const height = interpolate(
      sample,
      [0, 1],
      [STROKE_MIN_HEIGHT, STROKE_MAX_HEIGHT],
      Extrapolation.CLAMP,
    );
    return {
      // Eased rather than linear: an amplitude spike should arrive briskly and
      // settle gently, which is what keeps 48 of these changing at once from
      // reading as a flicker.
      height: withTiming(height, { duration, easing: Easing.out(Easing.quad) }),
    };
  });

  return <Animated.View style={[styles.stroke, { backgroundColor: colour }, style]} />;
}

const styles = StyleSheet.create({
  frame: {
    height: STROKE_MAX_HEIGHT,
    width: STROKE_COUNT * PITCH,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: STROKE_MAX_HEIGHT,
  },
  stroke: {
    width: STROKE_WIDTH,
    marginRight: STROKE_GAP,
    borderRadius: STROKE_WIDTH / 2,
  },
});
