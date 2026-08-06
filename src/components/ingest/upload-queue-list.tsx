import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Animated, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/tokens';
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

/**
 * A light sheen that breathes across a thumbnail while its garment is being
 * cleaned up — the design's "shimmer", built on the RN Animated API so it costs
 * nothing and needs no new dependency. Opacity-only, so it stays on the UI
 * thread via the native driver and never blocks the import running underneath.
 */
function Shimmer({ color }: { color: string }) {
  const [opacity] = useState(() => new Animated.Value(0.18));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.18, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity }]}
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
    <View
      className="mr-2.5 w-[52px]"
      accessibilityLabel={`${captionFor(job)}${failed && job.error ? `. ${job.error}` : ''}`}>
      <View
        className={`overflow-hidden rounded ${queued ? 'border border-dashed border-rule' : ''}`}
        style={{ height: 64 }}>
        <Image
          source={job.localUri}
          contentFit="cover"
          transition={120}
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
