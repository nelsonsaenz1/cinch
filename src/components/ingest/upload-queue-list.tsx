import { Image } from 'expo-image';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/ui/text';
import { motion, useTheme } from '@/theme/tokens';
import { STAGE_LABEL, type JobStage, type UploadJob } from '@/features/ingest/queue-store';

// The per-item status words live in the store beside the stages they name, so
// the rail and the headline above it cannot drift into two spellings of the
// same moment — which is exactly what "cleaning up…" over "Cleaning…" was.

/**
 * What a thumbnail calls itself.
 *
 * The design's rail reads `Coat ✓ · Knit ✓ · Cleaning… · Queued · Queued` —
 * finished pieces are NAMED, and only the ones still in flight fall back to
 * their stage. A garment has no truthful name until the tagger has said what it
 * is, so the name appears exactly when it becomes true and never before.
 */
function captionFor(job: UploadJob): string {
  if (job.stage === 'done' && job.label) return `${job.label} ✓`;
  return STAGE_LABEL[job.stage];
}

// Stages where work is actively moving — these thumbnails get the shimmer.
const IN_FLIGHT: JobStage[] = ['preparing', 'cutout', 'uploading', 'tagging'];

// The sheen's resting tone, and the top of its breath.
const SHEEN_LOW = 0.18;
const SHEEN_HIGH = 0.45;

// The thumbnail's entrance, per the design: 180 ms, deliberately between the
// motion scale's `fast` (140) and `base` (220) — slow enough not to arrive in
// one hard frame, quick enough to keep pace with a shutter being worked.
const ENTER_MS = 180;

/**
 * A light sheen that breathes across a thumbnail while its garment is being
 * cleaned up — the design's "shimmer". Opacity-only, so it runs on the UI
 * thread and never blocks the import going on underneath.
 *
 * Reanimated rather than the RN Animated API it was first written against: the
 * rail now also carries an entering animation, and one motion regime per file
 * is worth more than the handful of lines the swap costs.
 */
function Shimmer({ color }: { color: string }) {
  const reduced = useReducedMotion();
  const opacity = useSharedValue(SHEEN_LOW);

  useEffect(() => {
    // Reduce Motion: the sheen holds at its resting tone. The caption under the
    // thumbnail already names the stage, so nothing is lost but the breathing.
    if (reduced) return;
    opacity.value = withRepeat(withTiming(SHEEN_HIGH, { duration: 700 }), -1, true);
    // An import can be cancelled or finish mid-breath; an unbounded loop left
    // running behind an unmounted thumbnail is a leak, not a flourish.
    return () => cancelAnimation(opacity);
  }, [reduced, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: color }, style]}
    />
  );
}

function Thumb({ job }: { job: UploadJob }) {
  const theme = useTheme();
  const done = job.stage === 'done';
  const failed = job.stage === 'failed';
  const queued = job.stage === 'queued';
  const inFlight = IN_FLIGHT.includes(job.stage);

  return (
    // The wrapper exists for the entrance alone: a thumbnail appearing at the
    // end of the rail is the app's single loudest "is this working?" moment,
    // and it used to arrive in one hard frame. NativeWind classes do not reach
    // Reanimated components, so the layout stays on the plain View inside.
    <Animated.View entering={FadeIn.duration(ENTER_MS)}>
      <View
        className="mr-2.5 w-[52px]"
        accessibilityLabel={`${captionFor(job)}${failed && job.error ? `. ${job.error}` : ''}`}>
        <View
          className={`overflow-hidden rounded ${queued ? 'border border-dashed border-rule' : ''}`}
          style={{ height: 64 }}>
          <Image
            source={job.localUri}
            contentFit="cover"
            transition={motion.duration.fast}
            // Fully present once added; faded while queued so it reads as "not yet".
            style={{ width: '100%', height: '100%', opacity: done ? 1 : queued ? 0.4 : 0.7 }}
            accessibilityIgnoresInvertColors
          />
          {inFlight ? <Shimmer color={theme.surface} /> : null}
        </View>

        <Text
          variant="caption"
          numberOfLines={1}
          className="mt-1 text-center"
          style={failed ? { color: theme.critical } : undefined}>
          {captionFor(job)}
        </Text>
      </View>
    </Animated.View>
  );
}

export function UploadQueueList({ jobs }: { jobs: UploadJob[] }) {
  // Natural order: the queue works front-to-back, so finished pieces sit on the
  // left and what is still coming reads to the right, matching the design.
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {jobs.map((job) => (
        <Thumb key={job.id} job={job} />
      ))}
    </ScrollView>
  );
}
