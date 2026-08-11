import Storage from 'expo-sqlite/kv-store';

/**
 * The two persisted facts about a processing-consent answer, in one place.
 *
 * WHY THIS IS ITS OWN MODULE — the same argument as `consent-facts.ts`, one
 * layer down. Two screens now ask the consent question: the Add Clothes
 * chooser (AC-04) asks it on the door tapped, and the capture surface still
 * asks it for anyone who arrives by another route. Both have to read and write
 * the SAME two keys, because a decline recorded under one string and read
 * under another is an app that asks a user to answer a privacy question twice
 * and shows them the "what changes" explainer twice with it.
 *
 * A plain `.ts` with no React in it, so `scripts/run-tests.mjs` can bundle
 * anything that imports it — esbuild cannot parse React Native's Flow source,
 * so a `.tsx` here would take the suite down.
 */

/**
 * Whether this account answered the consent sheet with "Keep my photos on this
 * phone".
 *
 * There is no server-side "declined" record — consent never granted and
 * consent declined look identical in `profiles` — so the decline is persisted
 * here, in the same kv-store the upload queue uses, with `revokedAt` from the
 * server as corroboration for a decline made on another device. The flag only
 * ever widens local mode; it never grants anything.
 */
export const DECLINED_KEY = 'cinch.ai-consent.declined.v1';

/**
 * Whether A-04, the one full account of what declining changes, has been
 * shown. It is shown once, at the moment of decline, and never again — no
 * second ask, no second explainer.
 */
export const EXPLAINER_SEEN_KEY = 'cinch.ai-consent.decline-explainer-seen.v1';

export function readFlag(key: string): boolean {
  try {
    return Storage.getItemSync(key) === 'true';
  } catch {
    return false;
  }
}

export function writeFlag(key: string, value: boolean): void {
  try {
    Storage.setItemSync(key, value ? 'true' : 'false');
  } catch {
    // Worst case the explainer shows once more; never block the flow over it.
  }
}
