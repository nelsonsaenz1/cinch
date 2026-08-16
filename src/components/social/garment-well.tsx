import { Image } from 'expo-image';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { stableImageSource } from '@/features/closet/use-image-urls';

/**
 * UX-06, the social half — a garment well that is never blank without saying so.
 *
 * The failure this fixes is specific and invisible in every screenshot of the
 * happy path. `garments` is a private bucket, so a friend's plate is a signed
 * URL with a one-hour token. Three separate things can leave the well empty:
 * the batch signing has not returned yet, it returned without this path (the
 * object was deleted, or the per-path failure `createSignedUrls` reports
 * inline), or the URL was valid but the bytes failed to decode — a truncated
 * upload, a half-written cache entry, a token that expired between signing and
 * scroll. The first three-quarters of that list already produced a fallback;
 * **decode failure did not**, because `expo-image` reports it through `onError`
 * and nobody was listening. The result was a correct-looking tray-coloured
 * square with nothing in it and no way to tell it from a slow network.
 *
 * So: one `onError` handler, one piece of state, and the same fallback the
 * missing-URL branch already drew. The geometry is the caller's and never
 * changes between states — the well is the same square whether it holds a
 * photograph, a colour, or a mark — because a fallback that resizes makes the
 * page reflow on a failure, which reads as a second bug.
 *
 * **No retry loop.** A failed decode sets a flag keyed to the URL and stops.
 * `useSignedUrls` already re-signs on its own fifty-minute interval, and a new
 * token is a new URL, which clears the flag on the next render — that is the
 * whole recovery path. An `onError` that re-set the source would spin a request
 * loop against storage on exactly the images that are already failing.
 *
 * **No URL in a log or an analytics payload.** A signed URL is a bearer token
 * for someone else's photograph. This component knows one thing went wrong and
 * says so in pixels; it does not report which one, anywhere.
 *
 * Scoped to the social surfaces (Explore rows, friend closet cards) rather than
 * lifted into `components/ui`: UX-06's shared media primitive is the
 * integration owner's, and two competing primitives is a worse outcome than one
 * local adopter that integration folds in. See the handoff note.
 */

export type GarmentWellProps = {
  /** Signed URL for the render. `undefined` while signing, or when it failed. */
  imageUri?: string;
  /** Recycling key for the virtualised parent — the garment id at every call site. */
  recyclingKey: string;
  /**
   * `contain` for a scale-normalised cutout (Explore's tray well), `cover` for a
   * card that fills its frame (the friend grid). Never `cover` on a cutout: the
   * ingest pipeline already trued the scale, and cropping takes it back out.
   */
  contentFit: 'contain' | 'cover';
  /** What to draw when there is nothing to draw — a colour swatch, a mark. */
  fallback: ReactNode;
  /** Layout for the image itself; the well's own box belongs to the caller. */
  style?: { width?: number | `${number}%`; height?: number | `${number}%`; flex?: number };
};

/**
 * The image, or the fallback — decided by whether a URL exists AND whether the
 * last attempt at it decoded.
 */
export function GarmentWell({
  imageUri,
  recyclingKey,
  contentFit,
  fallback,
  style,
}: GarmentWellProps) {
  // The failure is remembered as the URL that failed, not as a boolean, and
  // that is the whole of the reset logic: a re-signed token is a different URL,
  // so `broken` is false again on the next render without anything having to
  // clear the flag. Same for a recycled cell — it cannot inherit the previous
  // garment's failure, because the previous garment's URL is not this one.
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const broken = Boolean(imageUri) && imageUri === failedUri;

  if (!imageUri || broken) {
    return (
      <View
        // The fallback IS the content, not a placeholder over it — announced as
        // such so VoiceOver does not read an empty group where the row's own
        // label already said what the piece is.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="h-full w-full items-center justify-center">
        {fallback}
      </View>
    );
  }

  return (
    <Image
      source={stableImageSource(imageUri)}
      recyclingKey={recyclingKey}
      contentFit={contentFit}
      transition={180}
      cachePolicy="memory-disk"
      onError={() => setFailedUri(imageUri)}
      style={style}
      accessibilityIgnoresInvertColors
    />
  );
}
