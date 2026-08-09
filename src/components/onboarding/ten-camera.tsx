import { CameraView } from 'expo-camera';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { TenCameraChrome } from '@/components/onboarding/ten-camera-chrome';
import { EmptyState } from '@/components/ui/empty-state';
import { useCameraAccess } from '@/features/ingest/use-camera-access';
import { useCapture } from '@/features/ingest/use-capture';
// Aliased: `track` below is this screen's job-tracking helper, and the two
// would otherwise shadow each other.
import { track as trackEvent } from '@/lib/posthog';
import { selectPhaseLabel, useQueueStore } from '@/features/ingest/queue-store';
import type { TenSlot } from '@/features/onboarding/ten-slots';

/**
 * T-03, wired to the real pipeline.
 *
 * "Processing never blocks the next photograph — the count moves when the row
 * is written, not when the shutter fires" (The Ten atlas). A job's `itemId`
 * IS that row: `upload-queue.ts` writes it the moment the INSERT lands, well
 * before the tagging pass finishes — so this watches for `itemId`, not for
 * `stage === 'done'`, and reports the slot filled as soon as it appears.
 */
export function TenCamera({
  slot,
  slots,
  onFilled,
  onCancel,
}: {
  slot: TenSlot;
  slots: readonly TenSlot[];
  /** Fires once with the new row's id — the slot's `garmentId`. */
  onFilled: (itemId: string) => void;
  onCancel: () => void;
}) {
  const { access, openSettings } = useCameraAccess();
  /**
   * Acquiring and committing are two steps (see the header of use-capture.ts).
   * The Ten commits immediately: the tenth slot IS the free ceiling, so a
   * guided capture can never be the piece that overflows it — the eleventh is
   * T-06's stop, which happens after this screen, not inside it.
   */
  const { pickFromLibrary, takePhoto, commit } = useCapture();
  const cameraRef = useRef<CameraView>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);
  const [shooting, setShooting] = useState(false);
  const live = access === 'granted' && !previewFailed;

  // The one job this shot belongs to — set the instant it is enqueued, so a
  // slow tagging pass never blocks the flow from moving on to slot N+1. State,
  // not a ref: `phase` below reads it during render, and a ref read there
  // would go stale between renders instead of driving one.
  const [trackedJobId, setTrackedJobId] = useState<string | null>(null);
  const filledRef = useRef(false);
  const jobs = useQueueStore((s) => s.jobs);
  const phase = trackedJobId ? selectPhaseLabel(jobs) : null;

  useEffect(() => {
    if (!trackedJobId || filledRef.current) return;
    const job = jobs.find((j) => j.id === trackedJobId);
    if (job?.itemId) {
      filledRef.current = true;
      onFilled(job.itemId);
    }
  }, [jobs, trackedJobId, onFilled]);

  const track = useCallback(() => {
    // The newest job in the store the instant after an enqueue — synchronous
    // with the zustand push, so this is reliable without a returned id.
    const latest = useQueueStore.getState().jobs;
    const job = latest[latest.length - 1];
    if (job) setTrackedJobId(job.id);
  }, []);

  const shoot = useCallback(async () => {
    const camera = cameraRef.current;
    // No in-app preview to shoot from — a simulator, or a mount that failed.
    // The system camera is the same fallback capture.tsx uses.
    if (!live || !camera || !cameraReady) {
      // `takePhoto` fires the analytics event itself, on its way through the
      // system camera.
      if (commit(await takePhoto()) > 0) track();
      return;
    }
    setShooting(true);
    try {
      const picture = await camera.takePictureAsync({ quality: 0.9, exif: false });
      if (picture?.uri) {
        // The in-app preview never goes through `takePhoto`, so nothing has
        // counted this shot yet. Reported with the same name and source as the
        // system-camera path, or The Ten would look like a flow nobody uses.
        trackEvent('clothes_import_selected', { source: 'camera', count: 1 });
        commit([{ uri: picture.uri, width: picture.width, height: picture.height }]);
        track();
      }
    } catch {
      setPreviewFailed(true);
    } finally {
      setShooting(false);
    }
  }, [live, cameraReady, commit, takePhoto, track]);

  const library = useCallback(() => {
    void pickFromLibrary().then((assets) => {
      if (commit(assets) > 0) track();
    });
  }, [pickFromLibrary, commit, track]);

  return (
    <TenCameraChrome
      slot={slot}
      slots={slots}
      phase={phase}
      onCancel={onCancel}
      stage={
        access === 'blocked' ? (
          <View className="flex-1 items-center justify-center bg-canvas dark:bg-canvas-dark">
            <EmptyState
              symbol="camera.fill"
              tone="blocked"
              title="Camera access is off"
              body="Turn the camera on in Settings, or add this piece from your library instead."
              actionTitle="Open Settings"
              onAction={openSettings}
            />
          </View>
        ) : live ? (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing="back"
            mode="picture"
            active
            onCameraReady={() => setCameraReady(true)}
            onMountError={() => setPreviewFailed(true)}
          />
        ) : null
      }
      onLibrary={library}
      onShoot={() => void shoot()}
      shooting={shooting}
      shutterEnabled={live}
    />
  );
}
