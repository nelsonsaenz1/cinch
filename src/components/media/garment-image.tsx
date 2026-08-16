import { Image, type ImageContentFit, type ImageStyle } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp } from 'react-native';

import {
  mediaSource,
  mediaWell,
  pictureKey,
  type LoadPhase,
  type MediaWell,
} from '@/components/media/media-state';

/**
 * ONE GARMENT PICTURE, AND WHAT HAPPENS WHEN THERE ISN'T ONE — UX-06.
 *
 * Every garment well in this app used to be the same two lines:
 *
 *     {uri ? <Image source={…} /> : <ConsideredMark />}
 *
 * which handles a missing PATH and nothing else. The pictures are private
 * storage objects behind signed URLs re-issued every fifty minutes, so a fetch
 * that fails, a signature that expires between the render and the request, and
 * a body that will not decode all land in the `uri` branch and draw a blank
 * rectangle with no explanation and no way back. That is the well UX-06 refuses.
 *
 * This component is that ternary with the other three outcomes wired to the
 * SAME fallback the call site already drew. A reader sees one thing when the
 * photograph is not available, whatever the reason, because it is one fact.
 *
 * ── WHAT IT DELIBERATELY DOES NOT DO ──────────────────────────────────────
 *
 * It does not retry. A failed load is sticky until the picture itself changes
 * (`pictureKey`, not the raw URI — the signer rotates the token hourly and a
 * reset keyed on the URI would re-request a dead object forever). The
 * implementation plan's line is "image fallbacks must not retry in loops", and
 * the loop it is naming is exactly that one. Pull-to-refresh is the retry on
 * every screen this appears on.
 *
 * It does not log. `error` from expo-image can carry the request URL, and a
 * signed URL is a bearer credential for someone's photograph — it does not go
 * to the console, to analytics, or into an accessibility string.
 *
 * It does not change geometry. The box is whatever the caller's `style` says,
 * from the first frame to the last, and both the photograph and the fallback
 * fill it absolutely. A well that resized when a load failed would reflow the
 * name and the metadata under it, which is the second half of a blank well.
 *
 * It draws no waiting mark of its own. The fallback is for "there is no
 * photograph", and flashing that mark for the frame before a photograph
 * arrives would make every scroll flicker between two truths; a waiting well
 * shows its ground, which is the geometry the picture is about to occupy.
 * A caller with something truer to say while waiting passes `waiting`.
 */
export type GarmentImageProps = {
  /** The signed URL, or nothing. Absent, unsigned and failed all draw `fallback`. */
  uri?: string | null;
  /**
   * What the well shows when there is no photograph to show. Drawn centred and
   * filling the box, so it holds the final geometry rather than collapsing.
   */
  fallback: React.ReactNode;
  /** Drawn instead of the ground while the bytes are on their way. Rarely needed. */
  waiting?: React.ReactNode;
  /** FlashList recycling — resets the view before the next source loads. */
  recyclingKey?: string | null;
  contentFit?: ImageContentFit;
  /** Milliseconds of cross-dissolve. `0` for anything view-shot will capture. */
  transition?: number;
  /** The box. Whatever the old `<Image>` here was given — usually `{ flex: 1 }`. */
  style?: StyleProp<ImageStyle>;
  /**
   * Told what the well settled on, whenever that changes.
   *
   * The one caller that needs it is the item hero, whose floating back and edit
   * discs invert depending on whether there is a photograph under them: a
   * canvas chevron on a pale tray is an invisible way out of the screen.
   */
  onWell?: (well: MediaWell) => void;
  accessible?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: 'image';
};

export function GarmentImage({
  uri,
  fallback,
  waiting,
  recyclingKey,
  contentFit = 'cover',
  transition = 180,
  style,
  onWell,
  accessible,
  accessibilityLabel,
  accessibilityRole,
}: GarmentImageProps) {
  const [phase, setPhase] = useState<LoadPhase>('loading');
  // Retiring a stale phase belongs to render, not an Effect — this is React's
  // own "adjusting state when a prop changes" pattern, the same one Today uses
  // to retire a stale shortlist override. A new picture is `loading` in the
  // SAME commit that points at it, rather than one commit later showing the
  // previous garment's verdict.
  const [key, setKey] = useState(() => pictureKey(uri));
  const nextKey = pictureKey(uri);
  if (nextKey !== key) {
    setKey(nextKey);
    setPhase('loading');
  }

  const well = mediaWell(uri, nextKey === key ? phase : 'loading');

  // An Effect, unlike the reset above: this one tells ANOTHER component
  // something, and setting a parent's state from a child's render is the one
  // thing React will not allow. Nothing here reads a signed URL.
  useEffect(() => {
    onWell?.(well);
    // `onWell` is an inline arrow at its one call site; depending on it would
    // re-run this on every parent render for no change in what it reports.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [well]);

  const source = mediaSource(uri);

  return (
    <View
      style={[styles.box, style]}
      accessible={accessible}
      accessibilityRole={accessible ? accessibilityRole : undefined}
      accessibilityLabel={accessible ? accessibilityLabel : undefined}>
      {source && well !== 'fallback' ? (
        <Image
          source={source}
          recyclingKey={recyclingKey}
          contentFit={contentFit}
          transition={transition}
          cachePolicy="memory-disk"
          style={StyleSheet.absoluteFill}
          // `onDisplay`, not `onLoad`: the bytes being in hand is not the same
          // as the picture being on screen, and it is the second one the
          // fallback has to get out of the way for.
          onDisplay={() => setPhase('loaded')}
          // Nothing from `event` is read. The message carries the request URL,
          // and a signed URL is a credential.
          onError={() => setPhase('failed')}
          accessibilityIgnoresInvertColors
        />
      ) : null}

      {well === 'photograph' ? null : (
        <View style={styles.mark} pointerEvents="none">
          {well === 'waiting' ? (waiting ?? null) : fallback}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // `flex: 1` by default so a well that used to hand `{ flex: 1 }` to <Image>
  // behaves identically; a caller with an explicit measure overrides it.
  box: { flex: 1 },
  mark: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
