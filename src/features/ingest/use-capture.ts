import * as ImagePicker from 'expo-image-picker';
import { useCallback, useRef } from 'react';
import { Alert, Linking } from 'react-native';

import { track } from '@/lib/posthog';

import { useQueueStore } from './queue-store';
import { drainQueue } from './upload-queue';

/**
 * Selecting garments to import.
 *
 * The system picker is `PHPickerViewController`, so iOS hands the app only the
 * assets the user actually tapped. We do not call
 * `requestMediaLibraryPermissionsAsync` first or ask for broad library access.
 * `NSPhotoLibraryUsageDescription` is still present because Apple's static
 * scan requires it for the photo-library APIs linked by expo-image-picker.
 *
 * ── Acquiring a photo is separate from committing it (Directive 4, W-02) ───
 *
 * Every door below used to enqueue the moment a picture existed. None of them
 * do any more: `commit` is the one function in this module that touches the
 * upload/tag queue, and `pickFromLibrary`/`takePhoto` now only ever hand back
 * the assets they acquired. The split exists because the Wall's W-02 forbids
 * disabling the shutter on a full closet — its atlas is explicit that "the
 * limit applies to the closet, not the camera" — while the app still has a
 * real reason to refuse the EXPENSIVE half of a capture on a garment that
 * cannot be added: the upload and the paid tagging call, not the act of
 * taking the picture. `capture.tsx`'s `settleCapture` decides, per photo,
 * whether the result of a door below goes straight to `commit` or waits —
 * held in component state, never persisted — behind the closet-full sheet.
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
export type CapturedAsset = {
  uri: string;
  width: number;
  height: number;
  assetId?: string | null;
};

/**
 * The mode a batch is enqueued in. `local: true` is declined-consent local
 * mode (frame A-04): the same pipeline minus the upload and the tag — photos
 * stay on this phone. Stamped on the job at enqueue so it survives a crash.
 */
export type CaptureOptions = { local?: boolean };

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

  /**
   * Commit already-acquired photos to the upload/tag queue — the only
   * function in this module that calls `enqueue`. See the file header for why
   * "acquire" and "commit" are two different steps now.
   */
  const commit = useCallback(
    (assets: CapturedAsset[], opts?: CaptureOptions) => {
      if (assets.length === 0) return 0;
      sweepOnce();
      enqueue(toJobs(assets, opts));
      void drainQueue();
      return assets.length;
    },
    [sweepOnce, enqueue],
  );

  const pickFromLibrary = useCallback(async (): Promise<CapturedAsset[]> => {
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

    if (result.canceled || !result.assets?.length) return [];

    // Count and source only — never asset ids or file paths.
    track('clothes_import_selected', { source: 'library', count: result.assets.length });
    return result.assets;
  }, []);

  /**
   * The system camera, kept as the fallback for the devices where the in-app
   * preview cannot run at all — a simulator, or a `CameraView` that reports a
   * mount error. It carries its own permission request and its own Settings
   * route because on that path there is no stage-level blocked state to lean
   * on: the user tapped a shutter and something has to answer them.
   */
  const takePhoto = useCallback(async (): Promise<CapturedAsset[]> => {
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
        return [];
      }
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      exif: false,
    });

    if (result.canceled || !result.assets?.length) return [];

    track('clothes_import_selected', { source: 'camera', count: result.assets.length });
    return result.assets;
  }, [cameraPermission, requestCameraPermission]);

  return { pickFromLibrary, takePhoto, commit, selectionLimit: SELECTION_LIMIT };
}
