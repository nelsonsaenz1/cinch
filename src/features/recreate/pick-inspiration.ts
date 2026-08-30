import * as ImagePicker from 'expo-image-picker';

import {
  isOfferable,
  type InspirationCandidate,
  type InspirationProvider,
  type LocalInspiration,
} from './sources';

/**
 * The half of the source contract that touches a native module.
 *
 * Split from `sources.ts` on purpose: the rules there are pure so the node
 * suite can import and prove them, while everything that reaches for
 * `expo-image-picker` stays here, out of that graph.
 */

/**
 * The saved-photo source: the library picker, exactly as the shipped flow
 * calls it. Null covers both a dismissal and an empty selection, and neither
 * is an error — the caller must leave the screen as it was (avatar.ts:54).
 */
async function pickFromLibrary(): Promise<LocalInspiration | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.9,
    allowsEditing: false,
  });
  if (picked.canceled) return null;
  const asset = picked.assets[0];
  if (!asset) return null;
  return {
    kind: 'local',
    provider: 'photo',
    imageUri: asset.uri,
    width: asset.width,
    height: asset.height,
    attribution: null,
  };
}

/**
 * Obtain one inspiration from the named source.
 *
 * A source that is not offerable yields null rather than throwing: the UI
 * never draws one, so arriving here means a stale prop or a deep link, and
 * neither deserves a crash.
 */
export async function pickInspiration(
  provider: InspirationProvider,
): Promise<InspirationCandidate | null> {
  if (!isOfferable(provider)) return null;
  if (provider === 'photo') return pickFromLibrary();
  return null;
}
