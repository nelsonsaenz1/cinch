import * as ImagePicker from 'expo-image-picker';
import { useCallback } from 'react';
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

function toJobs(assets: ImagePicker.ImagePickerAsset[]) {
  return assets.map((asset, index) => ({
    // Stable within a batch and unique across batches without needing a uuid
    // dependency in the hot path.
    id: `${Date.now()}-${index}-${asset.assetId ?? asset.uri.slice(-24)}`,
    localUri: asset.uri,
    width: asset.width,
    height: asset.height,
  }));
}

export function useCapture() {
  const enqueue = useQueueStore((s) => s.enqueue);
  /**
   * A new batch starts on a clean rail.
   *
   * `persist` keeps every job that is not `done`, so a failure from a previous
   * sitting comes back on every launch and would otherwise ride along beside
   * the twelve photographs just chosen — counted in "Processing 1 of 13",
   * banner and all, for a garment the user dealt with days ago. Anything still
   * moving is left alone; only the settled residue goes.
   */
  const clearSettled = useQueueStore((s) => s.clearSettled);
  const [cameraPermission, requestCameraPermission] = ImagePicker.useCameraPermissions();

  const pickFromLibrary = useCallback(async () => {
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
    clearSettled();
    enqueue(toJobs(result.assets));
    void drainQueue();
    return result.assets.length;
  }, [clearSettled, enqueue]);

  const takePhoto = useCallback(async () => {
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
    clearSettled();
    enqueue(toJobs(result.assets));
    void drainQueue();
    return result.assets.length;
  }, [cameraPermission, requestCameraPermission, clearSettled, enqueue]);

  return { pickFromLibrary, takePhoto, selectionLimit: SELECTION_LIMIT };
}
