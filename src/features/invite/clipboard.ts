/**
 * The one place in the app that names `expo-clipboard`.
 *
 * WHY THIS FILE EXISTS — and it is not hypothetical
 *
 * `import * as Clipboard from 'expo-clipboard'` at the top of
 * `src/app/invite.tsx` took the ENTIRE APP down on launch. Not the invite
 * screen: the app. The simulator threw
 *
 *     Uncaught Error: Cannot find native module 'ExpoClipboard'
 *     <global>  invite.tsx:1
 *
 * before any screen rendered, on a deep link to an unrelated route.
 *
 * The reason is expo-router. It builds its route tree by statically importing
 * every file under `src/app/`, so a top-level import in ANY route file is
 * evaluated at startup regardless of where the user is going. A native module
 * that is missing throws during module evaluation, which the importing screen
 * cannot catch, and there is no screen left to catch it in anyway.
 *
 * This is the second native dependency in two waves to need this treatment —
 * `src/features/push/native.ts` documents the first. Treat it as house style:
 * **a native module gets a guarded require, always, and every other file
 * imports the shim.** Typecheck passes either way. All 416 tests pass either
 * way. Only a binary without the module tells you, and by then it is either a
 * simulator (cheap) or an over-the-air update (every user, at once).
 *
 * Copy is not load-bearing. IV-01 draws two buttons and Share is the one that
 * matters; when this reports unavailable the invite page draws Share alone,
 * which is a complete way to send a link rather than a degraded one.
 */

interface ClipboardModule {
  setStringAsync(text: string): Promise<boolean>;
}

function load(): ClipboardModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-clipboard') as ClipboardModule | undefined;
    return mod && typeof mod.setStringAsync === 'function' ? mod : null;
  } catch {
    return null;
  }
}

const loaded = load();

/**
 * Whether this binary can copy to the clipboard.
 *
 * A fact about the build, not a preference: `expo-clipboard` arrived with the
 * invite wave, so the binary in the field does not have it and any bundle that
 * reaches that binary must not assume otherwise.
 */
export const CLIPBOARD_AVAILABLE: boolean = loaded !== null;

/**
 * Copy, reporting whether it happened. Never throws — a false return is the
 * caller's cue to leave the confirmation off rather than claim a copy that
 * did not occur.
 */
export async function copyText(text: string): Promise<boolean> {
  if (!loaded) return false;
  try {
    await loaded.setStringAsync(text);
    return true;
  } catch {
    return false;
  }
}
