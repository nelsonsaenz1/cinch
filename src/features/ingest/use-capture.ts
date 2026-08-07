import * as ImagePicker from 'expo-image-picker';
import { useCallback, useRef } from 'react';
import { Alert, Linking } from 'react-native';

import { track } from '@/lib/posthog';

import { useQueueStore } from './queue-store';
import { drainQueue } from './upload-queue';

/**
 * Selecting garments to import.
 *
 * The most important thing here is what is NOT done: on iOS 11+,
 * `launchImageLibraryAsync` requires **no photo-library permission at all**.
 * The picker is `PHPickerViewController` running out of process, so iOS hands
 * the app only the assets the user actually tapped. Calling
 * `requestMediaLibraryPermissionsAsync` first would show a prompt we don't
 * need and lose every user who taps "Don't Allow" — and, because Apple now
 * auto-rejects Info.plist keys declaring resources the app never uses, the
 * unused `NSPhotoLibraryUsageDescription` is suppressed in app.config.ts too.
 */

/**
 * Hard ceiling on one batch.
 *
 * `selectionLimit: 0` means "system maximum", which on iOS PHPicker is
 * unlimited — a user can select 500 photos and run the app out of memory.
 * 60 is generous for one pass; more is an explicit second trip.
 */
const SELECTION_LIMIT = 60;

/**
 * The shape both ways in produce. `launchImageLibraryAsync` hands back a full
 * `ImagePickerAsset`; the in-app viewfinder's `takePictureAsync` hands back a
 * `CameraCapturedPicture`, which is the same three fields and no `assetId` —
 * a photograph that has just been taken is not in any library yet.
 */
type CapturedAsset = { uri: string; width: number; height: number; assetId?: string | null };

/**
 * The mode a batch is enqueued in. `local: true` is declined-consent local
 * mode (frame A-04): the same pipeline minus the upload and the tag — photos
 * stay on this phone. Stamped on the job at enqueue so it survives a crash.
 */
type CaptureOptions = { local?: boolean };

function toJobs(assets: CapturedAsset[], opts?: CaptureOptions) {
  return assets.map((asset, index) => ({
    // Stable within a batch and unique across batches without needing a uuid
    // dependency in the hot path.
    id: `${Date.now()}-${index}-${asset.assetId ?? asset.uri.slice(-24)}`,
    localUri: asset.uri,
    width: asset.width,
    height: asset.height,
    ...(opts?.local ? { local: true } : {}),
  }));
}

export function useCapture() {
  const enqueue = useQueueStore((s) => s.enqueue);
  const clearSettled = useQueueStore((s) => s.clearSettled);
  const [cameraPermission, requestCameraPermission] = ImagePicker.useCameraPermissions();

  /**
   * A sitting starts on a clean rail — ONCE PER VISIT, not once per import.
   *
   * `persist` keeps every job that is not `done`, so a failure from a previous
   * sitting comes back on every launch and would otherwise ride along beside
   * the twelve photographs just chosen — counted in "Processing 1 of 13",
   * banner and all, for a garment the user dealt with days ago. Anything still
   * moving is left alone; only the settled residue goes.
   *
   * Sweeping on every import was right while the only way in was a multi-select:
   * one trip to the library, one batch, one rail. The in-app viewfinder makes
   * shooting garments one at a time the ordinary case, and clearing per import
   * would wipe each finished garment off the rail the instant the next shutter
   * fell — taking the "Added 4 of 4" count and the "Review tags" button with it.
   * The residue this exists for belongs to a PREVIOUS sitting, so sweeping it
   * once on the way in is the whole of the job.
   */
  const sweptResidue = useRef(false);
  const sweepOnce = useCallback(() => {
    if (sweptResidue.current) return;
    sweptResidue.current = true;
    clearSettled();
  }, [clearSettled]);

  const pickFromLibrary = useCallback(
    async (opts?: CaptureOptions) => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], // Excludes livePhotos deliberately — real libraries
        // are full of them and we want stills only.
        allowsMultipleSelection: true,
        selectionLimit: SELECTION_LIMIT,
        // NEVER `base64: true` alongside multi-select. It materializes every
        // image as a JS string and is the single most common iOS EXC_RESOURCE
        // memory crash in exactly this flow. Upload from the file URI instead.
        quality: 0.9,
        exif: false,
      });

      if (result.canceled || !result.assets?.length) return 0;

      // Count and source only — never asset ids or file paths.
      track('clothes_import_selected', { source: 'library', count: result.assets.length });
      sweepOnce();
      enqueue(toJobs(result.assets, opts));
      void drainQueue();
      return result.assets.length;
    },
    [sweepOnce, enqueue],
  );

  /**
   * A frame off the in-app viewfinder, straight onto the queue.
   *
   * The file lives in the cache directory and is read from there by
   * `prepareForUpload`, exactly as a picked asset is — nothing downstream knows
   * or cares which of the two doors the garment came through.
   */
  const addPhoto = useCallback(
    (picture: CapturedAsset, opts?: CaptureOptions) => {
      track('clothes_import_selected', { source: 'camera', count: 1 });
      sweepOnce();
      enqueue(toJobs([picture], opts));
      void drainQueue();
      return 1;
    },
    [sweepOnce, enqueue],
  );

  /**
   * The system camera, kept as the fallback for the devices where the in-app
   * preview cannot run at all — a simulator, or a `CameraView` that reports a
   * mount error. It carries its own permission request and its own Settings
   * route because on that path there is no stage-level blocked state to lean
   * on: the user tapped a shutter and something has to answer them.
   */
  const takePhoto = useCallback(
    async (opts?: CaptureOptions) => {
      // The camera genuinely does need permission, unlike the library picker.
      if (!cameraPermission?.granted) {
        const next = await requestCameraPermission();
        if (!next.granted) {
          // Once denied with canAskAgain false, the prompt never appears again
          // and Settings is the only route. Say so rather than silently no-oping.
          if (!next.canAskAgain) {
            Alert.alert(
              'Camera access is off',
              'Turn on camera access in Settings to photograph clothes directly. You can still add photos from your library.',
              [
                { text: 'Not now', style: 'cancel' },
                { text: 'Open Settings', onPress: () => void Linking.openSettings() },
              ],
            );
          }
          return 0;
        }
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.9,
        exif: false,
      });

      if (result.canceled || !result.assets?.length) return 0;

      track('clothes_import_selected', { source: 'camera', count: result.assets.length });
      sweepOnce();
      enqueue(toJobs(result.assets, opts));
      void drainQueue();
      return result.assets.length;
    },
    [cameraPermission, requestCameraPermission, sweepOnce, enqueue],
  );

  return { pickFromLibrary, takePhoto, addPhoto, selectionLimit: SELECTION_LIMIT };
}
