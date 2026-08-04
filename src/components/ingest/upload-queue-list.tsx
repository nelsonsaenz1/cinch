import { Image } from 'expo-image';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { JobStage, UploadJob } from '@/features/ingest/queue-store';

const STAGE_LABEL: Record<JobStage, string> = {
  queued: 'Waiting',
  preparing: 'Preparing',
  cutout: 'Cutting out',
  uploading: 'Uploading',
  tagging: 'Tagging',
  done: 'Added',
  failed: 'Failed',
};

function StageRow({ job }: { job: UploadJob }) {
  const failed = job.stage === 'failed';
  const done = job.stage === 'done';

  return (
    <View
      className="mb-2 flex-row items-center rounded-card bg-tray p-2 dark:bg-tray-dark"
      accessibilityLabel={`${STAGE_LABEL[job.stage]}${failed && job.error ? `. ${job.error}` : ''}`}>
      <Image
        source={job.localUri}
        contentFit="cover"
        transition={120}
        style={{ width: 44, height: 56, borderRadius: 8 }}
        accessibilityIgnoresInvertColors
      />

      <View className="ml-3 flex-1">
        <Text variant="body" className={failed ? 'text-critical' : ''}>
          {STAGE_LABEL[job.stage]}
        </Text>

        {failed && job.error ? (
          <Text variant="label" numberOfLines={2} className="mt-0.5 text-critical">
            {job.error}
          </Text>
        ) : (
          // A determinate bar during upload, an indeterminate track otherwise —
          // never a spinner with no sense of how much is left, since this runs
          // for minutes across a 60-photo batch.
          <View className="mt-2 h-1 overflow-hidden rounded-chip bg-hairline dark:bg-hairline-dark">
            <View
              className={done ? 'h-full bg-positive' : 'h-full bg-accent dark:bg-accent-dark'}
              style={{ width: `${Math.round((done ? 1 : job.progress) * 100)}%` }}
            />
          </View>
        )}
      </View>
    </View>
  );
}

export function UploadQueueList({ jobs }: { jobs: UploadJob[] }) {
  // Newest first — during a long import the user cares about what is happening
  // now, not what finished five minutes ago.
  const ordered = [...jobs].reverse();
  return (
    <View>
      {ordered.map((job) => (
        <StageRow key={job.id} job={job} />
      ))}
    </View>
  );
}
