/**
 * CPV2-02 — the listening state, full screen, and side-effect free.
 *
 * WHY THIS IS A SEPARATE PRESENTATIONAL FILE. The live route owns a recorder,
 * a microphone permission and an upload; a fixture route must own none of
 * those, or opening it would start recording somebody. Splitting the pixels
 * from the machinery is what lets Codex look at this state at all — the
 * alternative is a screenshot taken by hand while actually speaking into a
 * simulator, which is not a repeatable review.
 *
 * So: props in, JSX out. No hooks that fetch, record, permission-check or
 * navigate. The only hook is `useTheme`, and the only optional one is the
 * shared value driving the meter — absent in fixtures, which then draw the
 * static profile the atlas specifies for Reduce Motion.
 *
 * GEOMETRY IS THE ATLAS'S, not an approximation of it. The frame was measured
 * rather than eyeballed: 44 pt Cancel and RECORDING row; 32 pt serif title;
 * a white card at radius 20 with 26/20 padding; ten 5 pt bars at 5 pt gaps in
 * a 96 pt well; the elapsed line centred at 15 pt; Done at 52 pt with radius
 * 12; "Type it instead" at 44 pt. Those numbers are in the constants below with
 * their source named, because the next person to touch this file will otherwise
 * round them.
 */

import { View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import {
  VOICE_DISCLOSURE,
  VOICE_PROMPT,
  VOICE_PROMPT_HELP,
} from '@/features/catalogue/copy';
import { useTheme } from '@/theme/tokens';

/** Atlas CPV2-02: ten bars, 5 pt wide, 5 pt apart, in a 96 pt well. */
const BAR_COUNT = 10;
const BAR_WIDTH = 5;
const BAR_GAP = 5;
const WELL_HEIGHT = 96;
const BAR_MIN = 18;

/**
 * The bar heights the atlas draws, as fractions of the well.
 *
 * This IS the Reduce Motion state — §6: "no animated meter, ring or progress
 * bar — static state changes only" — and it is also what a fixture renders,
 * which is why the two are the same array rather than two that could drift.
 */
const STATIC_PROFILE = [0.27, 0.5, 0.75, 0.4, 0.63, 0.92, 0.46, 0.23, 0.56, 0.31];

export type ListeningScreenProps = {
  /** Seconds elapsed, already floored. Drawn as "0:04 of 0:30". */
  elapsedMs: number;
  /** The ceiling, stated rather than sprung. */
  maxMs: number;
  /**
   * Live level, 0…1, read on the UI thread. Omit for the static profile —
   * fixtures omit it, and so does Reduce Motion.
   */
  amplitude?: SharedValue<number>;
  onDone: () => void;
  onCancel: () => void;
  /** "Type it instead" — keeps whatever is already in the field. */
  onTypeInstead: () => void;
};

export function ListeningScreen({
  elapsedMs,
  maxMs,
  amplitude,
  onDone,
  onCancel,
  onTypeInstead,
}: ListeningScreenProps) {
  const theme = useTheme();

  const clock = `Listening · ${formatClock(elapsedMs)} of ${formatClock(maxMs)}`;

  return (
    <View className="flex-1 bg-canvas">
      {/* Cancel top-left, the recording state top-right. Both 44 pt. */}
      <View className="flex-row items-center justify-between px-gutter pt-1.5">
        <Button
          title="Cancel"
          variant="ghost"
          onPress={onCancel}
          accessibilityHint="Stops recording and deletes it. Your typed words stay."
        />
        <View style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text variant="eyebrow" style={{ color: theme.accent }} accessibilityLiveRegion="polite">
            Recording
          </Text>
        </View>
      </View>

      <View className="px-gutter pt-3.5">
        <Text variant="display">{VOICE_PROMPT}</Text>
        <Text variant="body" className="pt-2 text-muted">
          {VOICE_PROMPT_HELP}
        </Text>
      </View>

      {/* The meter card, vertically centred in what is left. */}
      <View className="flex-1 justify-center px-gutter">
        <View
          className="rounded-[20px] bg-surface"
          style={{ paddingVertical: 26, paddingHorizontal: 20, borderWidth: 1, borderColor: theme.rule }}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              height: WELL_HEIGHT,
              flexDirection: 'row',
              alignItems: 'flex-end',
              justifyContent: 'center',
              gap: BAR_GAP,
            }}>
            {STATIC_PROFILE.slice(0, BAR_COUNT).map((fraction, i) => (
              <Bar key={i} fraction={fraction} index={i} amplitude={amplitude} accent={theme.accent} />
            ))}
          </View>

          <Text
            variant="body"
            className="pt-4 text-center text-muted"
            accessibilityLiveRegion="polite">
            {clock}
          </Text>
        </View>

        <View className="pt-4">
          <Button title="Done" onPress={onDone} accessibilityHint="Stops recording and turns it into words" />
        </View>
        <View className="pt-1">
          <Button title="Type it instead" variant="ghost" onPress={onTypeInstead} />
        </View>

        <Text variant="noteSmall" className="pt-3.5">
          {VOICE_DISCLOSURE}
        </Text>
      </View>
    </View>
  );
}

/**
 * One bar.
 *
 * With no `amplitude` this is a plain `View` at a fixed height — no worklet, no
 * animation, nothing to settle before a screenshot. With one, it scales around
 * its own profile so the ten bars move together but not identically, which is
 * what stops the row reading as a single block.
 */
function Bar({
  fraction,
  index,
  amplitude,
  accent,
}: {
  fraction: number;
  index: number;
  amplitude?: SharedValue<number>;
  accent: string;
}) {
  // Three opacities, as drawn: the tallest bars are solid, the shortest faint.
  const opacity = fraction > 0.6 ? 1 : fraction > 0.35 ? 0.5 : 0.35;
  const base = {
    width: BAR_WIDTH,
    borderRadius: 3,
    backgroundColor: accent,
    opacity,
  } as const;

  if (!amplitude) {
    return <View style={{ ...base, height: Math.round(WELL_HEIGHT * fraction) }} />;
  }
  return <LiveBar base={base} fraction={fraction} index={index} amplitude={amplitude} />;
}

function LiveBar({
  base,
  fraction,
  index,
  amplitude,
}: {
  base: { width: number; borderRadius: number; backgroundColor: string; opacity: number };
  fraction: number;
  index: number;
  amplitude: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    // The profile is the shape; the amplitude is the volume. A phase offset per
    // bar keeps the row from moving as one solid block.
    const phase = 0.75 + 0.25 * Math.sin(index * 1.7);
    const level = Math.max(0, Math.min(1, amplitude.value * phase));
    return { height: Math.max(BAR_MIN, WELL_HEIGHT * fraction * (0.35 + 0.65 * level)) };
  });
  return <Animated.View style={[base, style]} />;
}

/** `0:04`, the way the atlas prints it. */
function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
