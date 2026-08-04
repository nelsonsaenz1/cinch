import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * Client-side image preparation.
 *
 * Doing this on-device rather than server-side is a deliberate cost decision:
 * Supabase Storage's image transformations are Pro-only and bill **per origin
 * image** ($5 per 1,000), so a user uploading 100 garments would consume an
 * entire monthly allowance. Resizing here costs nothing and also shrinks the
 * upload payload during the 100-photo burst, which is what the progress bar
 * actually measures on cellular.
 *
 * Downscaling to 1024px additionally cuts vision-model image tokens (1568 →
 * ~1036 on the standard-resolution tier) with no measured accuracy loss for
 * garment attribute extraction.
 *
 * Note this uses the imperative `ImageManipulator.manipulate()` rather than the
 * `useImageManipulator` hook, because it runs inside the upload queue rather
 * than a component.
 */

/** Long edge for the image sent to the tagging model and kept as the display original. */
const UPLOAD_MAX_EDGE = 1024;
/** Long edge for the closet grid thumbnail. */
const THUMB_MAX_EDGE = 400;

export type PreparedImage = {
  uri: string;
  width: number;
  height: number;
};

/**
 * Resize so the LONG edge is at most `maxEdge`, preserving aspect ratio.
 *
 * `resize` preserves ratio when given a single dimension, so which dimension to
 * pass depends on orientation — passing `width` on a portrait photo would
 * upscale it.
 */
async function resizeToLongEdge(
  uri: string,
  sourceWidth: number,
  sourceHeight: number,
  maxEdge: number,
  compress: number,
): Promise<PreparedImage> {
  const longEdge = Math.max(sourceWidth, sourceHeight);

  // Never upscale — a small photo stays small.
  if (longEdge <= maxEdge) {
    const rendered = await ImageManipulator.manipulate(uri).renderAsync();
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress });
    return { uri: saved.uri, width: saved.width, height: saved.height };
  }

  const isLandscape = sourceWidth >= sourceHeight;
  const context = ImageManipulator.manipulate(uri).resize(
    isLandscape ? { width: maxEdge, height: null } : { width: null, height: maxEdge },
  );

  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

/** The image uploaded as the original and sent to the tagging model. */
export function prepareForUpload(uri: string, width: number, height: number) {
  return resizeToLongEdge(uri, width, height, UPLOAD_MAX_EDGE, 0.8);
}

/** The grid thumbnail. Generated locally so Storage transformations are never billed. */
export function prepareThumbnail(uri: string, width: number, height: number) {
  return resizeToLongEdge(uri, width, height, THUMB_MAX_EDGE, 0.7);
}
