/**
 * The speech ROUTE, decided from capability alone.
 *
 * Split from `local-speech.ts` for the same mechanical reason `buckets.ts` is
 * split from `analytics.ts`: that file imports the native module, which imports
 * `expo-modules-core`, which imports React Native — a Flow-typed source the
 * test bundler cannot parse. The decision is the part worth testing against
 * every combination of states, so it lives here where a test can reach it.
 */

import type {
  SpeechAuthorization,
  SpeechFailureReason,
  SpeechSupport,
} from '../../../modules/garment-cutout/src/GarmentVision.types';

/** What the screen should do with the microphone. */
export type SpeechRoute =
  /** Transcribe on the device. No consent, no quota, no upload. */
  | { kind: 'local' }
  /**
   * The device cannot do it. Offer the cloud path, naming the reason — never
   * take it automatically.
   */
  | { kind: 'offer_cloud'; because: SpeechFailureReason | 'unsupported_device' }
  /** Permission has not been asked for yet. */
  | { kind: 'needs_permission' }
  /** Permission was refused. Settings is the only route back. */
  | { kind: 'blocked'; authorization: SpeechAuthorization };

/**
 * Decide, from support alone, before anything is recorded.
 *
 * Pure so the decision can be tested against every combination of states rather
 * than against a device. `null` support means the native module is absent —
 * Android, web, Expo Go, or a build before this packet — and the answer there
 * is the cloud path Cinch has always used.
 */
export function routeFor(support: SpeechSupport | null): SpeechRoute {
  if (!support) return { kind: 'offer_cloud', because: 'unsupported_device' };

  // The Simulator has no speech stack at all. Apple's constraint, not ours.
  if (support.simulator) return { kind: 'offer_cloud', because: 'unsupported_device' };

  if (support.authorization === 'not_determined') return { kind: 'needs_permission' };
  if (support.authorization !== 'authorized') {
    return { kind: 'blocked', authorization: support.authorization };
  }

  if (!support.localeSupported) return { kind: 'offer_cloud', because: 'locale_unsupported' };
  if (!support.onDeviceSupported) {
    return { kind: 'offer_cloud', because: 'on_device_unsupported' };
  }
  if (!support.available) return { kind: 'offer_cloud', because: 'unavailable' };

  return { kind: 'local' };
}

/**
 * What the screen says when the phone cannot do it.
 *
 * Each reason gets its own sentence because each has a different remedy, and a
 * single "couldn't transcribe" would send somebody to check their wifi over a
 * missing language model. The cloud sentence names the trade explicitly — the
 * recording leaves the device — because that is the decision being offered.
 */
export const CLOUD_OFFER: Record<SpeechFailureReason | 'unsupported_device', string> = {
  unsupported_device:
    'This phone cannot turn speech into words on its own. Cinch can do it on its servers instead — your recording leaves the device and is deleted straight after.',
  on_device_unsupported:
    'Your phone does not have the offline language pack for this. Cinch can transcribe on its servers instead — your recording leaves the device and is deleted straight after.',
  locale_unsupported:
    'Your phone has no offline recogniser for this language. Cinch can transcribe on its servers instead — your recording leaves the device and is deleted straight after.',
  unavailable:
    'Speech recognition is unavailable on this phone right now. Cinch can transcribe on its servers instead — your recording leaves the device and is deleted straight after.',
  not_authorized:
    'Cinch needs permission to turn speech into words. You can grant it in Settings, or type the piece instead.',
  recognition_failed:
    'That did not come out as words. Try again, or type the piece instead.',
};
