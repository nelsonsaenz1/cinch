import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import {
  CUTOUT_ACCEPT_ACTION,
  CUTOUT_FAILED_BODY,
  CUTOUT_FAILED_TITLE,
  CUTOUT_RETRY_ACTION,
  cutoutFailureLine,
} from '@/features/ingest/cutout-failure';
import { acceptFullPhoto, retryCutout } from '@/features/ingest/upload-queue';

/**
 * CP-05 — "Processing failed, photo kept."
 *
 * Deliberately NOT a dialog, a modal or a toast. "Failure sits over its own
 * subject": it renders inline on the capture surface, under the rail carrying
 * the piece it is about, so it can be read next to the thing it describes and
 * ignored while the session continues. **The shutter stays live throughout — a
 * failure in one piece never stops the session** — which a modal would break
 * and which is why one was not used.
 *
 * Not styled as an error either. There is no critical tone here and no red: a
 * failed cutout is a degraded result, not a lost piece, and dressing it as a
 * failure would contradict the sentence it is printing.
 */
export function CutoutFailedNotice({
  jobId,
  count,
}: {
  /** The job whose cutout failed. The two actions both act on this one. */
  jobId: string;
  /** How many pieces in this session are in the same state. */
  count: number;
}) {
  const [retrying, setRetrying] = useState(false);
  const line = cutoutFailureLine(count);

  return (
    <View className="mt-4 border-t border-hairline pt-4" accessibilityLabel={CUTOUT_FAILED_TITLE}>
      <Text variant="label" className="text-ink">
        {CUTOUT_FAILED_TITLE}
      </Text>
      {/* What survived first, what is missing second. */}
      <Text variant="body" className="mt-2 text-muted">
        {CUTOUT_FAILED_BODY}
      </Text>
      {line ? (
        <Text variant="note" className="mt-1">
          {line}
        </Text>
      ) : null}

      {/* Peers of equal height, only the retry filled. Accepting is a named
          outcome, so it is a real button rather than a dismissal affordance. */}
      <View className="mt-3.5 flex-row items-center gap-2">
        <Button
          title={CUTOUT_RETRY_ACTION}
          variant="ink"
          loading={retrying}
          onPress={() => {
            // One pass per tap. `retryCutout` does not schedule, back off or
            // repeat; a second failure simply leaves this notice where it is.
            setRetrying(true);
            void retryCutout(jobId).finally(() => setRetrying(false));
          }}
        />
        <Button
          title={CUTOUT_ACCEPT_ACTION}
          variant="ghost"
          onPress={() => acceptFullPhoto(jobId)}
          accessibilityHint="Keeps the full photograph as this piece's image. The piece is already in your closet."
        />
      </View>
    </View>
  );
}
