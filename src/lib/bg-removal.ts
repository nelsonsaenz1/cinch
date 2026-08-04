/**
 * Background removal — the single swap point for the cutout provider.
 *
 * This wrapper exists because the recommended implementation
 * (`react-native-nitro-vision-kit`, Apple Vision subject lifting) is five weeks
 * old with one maintainer, and it sits on the app's primary screen. Nothing
 * outside this file may import it. Swapping to
 * `@six33/react-native-bg-removal`, or to a server call, is then a change to
 * one function rather than to three screens.
 *
 * Constraints that shaped this API:
 *  - Apple Vision subject lifting is iOS 17+, and does NOT run in the Simulator.
 *    `isSupported()` must be checked before every batch, and the UI needs a real
 *    fallback rather than an empty grid.
 *  - Vision is trained on *salient subjects*, not garments. It will sometimes
 *    lift the hanger, a hand, or the mannequin. So the result carries every
 *    detected subject, and the caller is expected to offer a "wrong one, retry"
 *    affordance instead of assuming index 0 is the garment.
 *  - These modules decode full-resolution images into memory and hand back
 *    native objects that must be released explicitly, so `remove()` always
 *    disposes in a `finally`.
 */

export type Cutout = {
  /** file:// URI of a transparent PNG. */
  uri: string;
  width: number;
  height: number;
};

export type RemoveResult =
  | { ok: true; subjects: Cutout[] }
  /**
   * Not an exception — an unliftable photo is an ordinary outcome (a flat-lay
   * on a patterned rug, white-on-white, sheer fabric). The item still saves
   * with its original photo; it just has no cutout yet.
   */
  | { ok: false; reason: 'unsupported-device' | 'no-subject' | 'failed'; message?: string };

export interface BackgroundRemover {
  isSupported(): Promise<boolean>;
  remove(imageUri: string): Promise<RemoveResult>;
}

/**
 * Placeholder implementation.
 *
 * The real one requires `react-native-nitro-vision-kit`, which is native code
 * and therefore needs a development build — it cannot run in Expo Go, and it
 * cannot run in the Simulator at all. Until that build exists this reports
 * unsupported, which drives the designed no-cutout state rather than a crash.
 *
 * Replacing it is: install the package, implement `remove()` against
 * `analyzeImage`, dispose the returned HybridObject in a `finally`, and delete
 * this comment. Nothing else in the app changes.
 */
class UnavailableRemover implements BackgroundRemover {
  async isSupported() {
    return false;
  }

  async remove(): Promise<RemoveResult> {
    return {
      ok: false,
      reason: 'unsupported-device',
      message: 'Cutouts need a development build on a physical iPhone running iOS 17 or later.',
    };
  }
}

export const backgroundRemover: BackgroundRemover = new UnavailableRemover();
