/**
 * The opaque handle a spoken catalogue query is filed under.
 *
 * THIS FILE EXISTS BECAUSE THE FIRST TWO ATTEMPTS BOTH HAD A RUNTIME
 * PRECONDITION THAT A TYPECHECK CANNOT SEE.
 *
 *   `crypto.randomUUID()` was the first, on the assumption that something
 *   polyfilled a global `crypto`. Nothing does: `react-native-quick-crypto` is
 *   required lazily inside `lib/supabase.ts` for at-rest key encryption and
 *   never touches `globalThis`, and `expo-crypto` is not a dependency at all.
 *
 *   `uuid.v4()` from `expo-modules-core` was the second, and it is better —
 *   `CoreModule.swift` really does export a native `uuidv4`, so it ships with
 *   every Expo app and adds nothing to `package.json`. But it is still a
 *   NATIVE binding read off `globalThis.expo`, and its own implementation
 *   throws by hand when that binding is missing.
 *
 * Both failures land in the same place: a crash reachable only by tapping the
 * microphone, on a path no test in this repo can execute and no typecheck can
 * see. So this asks each source in turn and falls through.
 *
 * THE LAST RUNG IS NOT CRYPTOGRAPHIC AND DOES NOT NEED TO BE. This id is a
 * filename inside one user's own storage namespace, chosen by their device,
 * used once, and deleted with the audio. It is not a token, it authorises
 * nothing, and it is never checked against anything — the server validates only
 * that it is UUID-SHAPED, because an id that could contain a slash would be an
 * id that could name a path. Collisions would have to happen within a single
 * user's own folder within 24 hours to matter at all, and `Math.random()` is
 * comfortably past that. A dependency for this would be a dependency for
 * nothing.
 */

type ExpoGlobal = { uuidv4?: () => string };

/** Which source answered. Reported by the dev probe route; never sent anywhere. */
export type RequestIdSource = 'expo-native' | 'web-crypto' | 'fallback';

export function requestIdSource(): RequestIdSource {
  const expo = (globalThis as { expo?: ExpoGlobal }).expo;
  if (typeof expo?.uuidv4 === 'function') return 'expo-native';
  if (typeof globalThis.crypto?.randomUUID === 'function') return 'web-crypto';
  return 'fallback';
}

/** A v4-shaped identifier. Never throws. */
export function newRequestId(): string {
  const expo = (globalThis as { expo?: ExpoGlobal }).expo;
  if (typeof expo?.uuidv4 === 'function') {
    try {
      return expo.uuidv4();
    } catch {
      // Fall through. A native binding that exists and then fails is not a
      // reason to lose the recording the user just made.
    }
  }
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    try {
      return globalThis.crypto.randomUUID();
    } catch {
      // As above.
    }
  }
  return fallbackUuid();
}

/**
 * RFC 4122 v4 layout, filled from `Math.random`. See the header on why that is
 * the right amount of rigour for this particular string.
 *
 * Exported so the test can exercise the LAST rung directly. Node has
 * `crypto.randomUUID`, so a test that only called `newRequestId` would never
 * reach this one — and this is the rung most likely to be wrong, because it is
 * the only one written here rather than borrowed.
 */
export function fallbackUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
