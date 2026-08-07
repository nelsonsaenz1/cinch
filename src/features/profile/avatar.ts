import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

/**
 * Choosing, shrinking and storing a profile photograph.
 *
 * Three things here are deliberate:
 *
 * 1. **No permission request, and no Info.plist key.** `launchImageLibraryAsync`
 *    on iOS 11+ is `PHPickerViewController` running out of process — the app
 *    is handed only the asset the user tapped and never sees the library, so
 *    no photo-library permission is involved at all. This is the same
 *    reasoning `features/ingest/use-capture.ts` documents at length, and the
 *    reason `NSPhotoLibraryUsageDescription` is deliberately suppressed in
 *    app.config.ts. Asking here would show a prompt for access we do not need
 *    and lose everyone who taps "Don't Allow".
 *
 * 2. **Square, cropped in-app, downscaled on-device.** Supabase's Storage
 *    transformations are Pro-only and bill per origin image, which is why
 *    nothing in this app is resized server-side (`lib/image.ts` carries the
 *    full argument). The square comes from `avatar-crop-sheet.tsx` — the
 *    "Move and scale" step that replaced the system picker's own crop UI —
 *    which crops on the original pixels and hands back an edge of at most
 *    `AVATAR_EDGE`. A 1024px square lands well inside the bucket's 2 MB
 *    ceiling and stays sharp on the 88pt edit-sheet disc at 3×.
 *
 * 3. **A new object name every time.** The path is `{user_id}/{ms}.jpg`, never
 *    a fixed `avatar.jpg`. A public bucket sits behind a CDN and an overwritten
 *    URL keeps serving the old face for as long as it is cached — which the
 *    user reads, correctly, as "it didn't save". A fresh name is a fresh URL.
 *    The previous object is deleted after the row is updated, so a failure
 *    part-way leaves a spare file rather than a profile pointing at nothing.
 */

const BUCKET = 'avatars';

/** Side of the stored square, in pixels. Exported for the crop sheet. */
export const AVATAR_EDGE = 1024;
/** JPEG quality. 0.82 is where a face at this size stops visibly improving. */
const AVATAR_QUALITY = 0.82;

/**
 * Open the system picker and return the chosen image, as shot.
 *
 * No `allowsEditing`: the square crop is the app's own "Move and scale" step
 * (`avatar-crop-sheet.tsx`), which the picker hands the full asset to. The
 * system crop UI would run first and then be immediately contradicted by ours
 * — two crop screens for one photograph.
 *
 * Returns null when the picker is dismissed. Dismissal is not an error and
 * must not be reported as one.
 */
export async function pickAvatar(): Promise<ImagePicker.ImagePickerAsset | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1, // Compression happens once, below, after the resize.
  });

  if (result.canceled) return null;
  return result.assets[0] ?? null;
}

/**
 * Downscale to the stored size.
 *
 * A local util rather than `lib/image.ts`'s `prepareThumbnail`, which fits a
 * 400px long edge at quality 0.7 — tuned for a garment cutout on a tray, and
 * visibly soft on a face. Same shape of function, different numbers.
 *
 * The ASPECT RATIO IS PRESERVED even though the result is meant to be square.
 * The crop sheet already produced a square at or under `AVATAR_EDGE`, so this
 * is normally a no-op; forcing an exact square resize instead would silently
 * stretch anything that arrived otherwise (a future call site that does not
 * crop). A non-square avatar is centre-cropped by `contentFit="cover"` in
 * `Avatar`, which is a crop, not a distortion.
 *
 * Never upscales: a 200px photograph stays 200px rather than being
 * interpolated up to a soft 1024.
 */
export async function prepareAvatar(uri: string, width: number, height: number): Promise<string> {
  const context =
    Math.max(width, height) > AVATAR_EDGE
      ? // A single dimension keeps the ratio; which one depends on
        // orientation, or a portrait would be upscaled by its width.
        ImageManipulator.manipulate(uri).resize(
          width >= height ? { width: AVATAR_EDGE, height: null } : { width: null, height: AVATAR_EDGE },
        )
      : ImageManipulator.manipulate(uri);

  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: AVATAR_QUALITY });
  return saved.uri;
}

/**
 * Put a prepared local file in the bucket and return its public URL.
 *
 * Uploads through a signed upload URL for the same reason the garment queue
 * does: it is a plain PUT that `expo-file-system`'s `File.upload` can hand to
 * iOS's background session, so a slow connection does not die when the user
 * switches apps.
 */
export async function uploadAvatar(localUri: string, userId: string): Promise<string> {
  const path = `${userId}/${Date.now()}.jpg`;

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) {
    throw new Error(`Could not get an upload URL: ${error?.message ?? 'unknown error'}`);
  }

  const result = await new File(localUri).upload(data.signedUrl, {
    httpMethod: 'PUT',
    mimeType: 'image/jpeg',
    headers: { 'content-type': 'image/jpeg' },
    sessionType: 'background',
  });

  if (result.status >= 400) throw new Error(`Upload failed with ${result.status}`);

  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/**
 * Delete the object a public avatar URL points at. Best effort, by design.
 *
 * Called after the profile row already points somewhere else, so a failure
 * here costs a stray file and nothing the user can see. It is guarded on the
 * URL actually naming an object in this bucket, under this user's folder:
 * an `avatar_url` seeded from elsewhere (an OAuth provider's CDN, say) is not
 * ours to delete and does not parse to a path here.
 */
export async function deleteAvatarObject(url: string | null, userId: string): Promise<void> {
  if (!url) return;

  const marker = `/${BUCKET}/${userId}/`;
  const at = url.indexOf(marker);
  if (at === -1) return;

  const path = `${userId}/${url.slice(at + marker.length)}`;
  // Query strings are not part of the object name; a cache-buster would make
  // the remove a no-op.
  const clean = path.split('?')[0];
  if (!clean) return;

  await supabase.storage.from(BUCKET).remove([clean]);
}
