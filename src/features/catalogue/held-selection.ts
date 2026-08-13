/**
 * CPV2-11 — the selection somebody made just before their closet turned out to
 * be full, kept for a day so acquiring room does not cost them the work.
 *
 * WHY THIS IS CLIENT-SIDE, AND WHY THAT IS THE ANSWER RATHER THAN A COMPROMISE
 *
 * §10.5 of the handoff leaves this open: "does a held selection persist, and
 * for how long? The one-day hold drawn here is a proposal. SERVER." Reading
 * the frame against what it is actually for settles it without a server:
 *
 *   NOTHING IN CPV2-11 IS CROSS-DEVICE. The hold exists so that a person who
 *   taps "Add 3 to closet", is told there is room for one, goes to Membership
 *   or archives a piece, and comes back, finds their three colours still
 *   ticked. Every step of that happens on the phone they are holding, within
 *   minutes. A server row would make it survive a reinstall — which nobody
 *   asked for and which is the only thing it would buy.
 *
 *   AND IT IS NOT DURABLE DATA. It is three catalogue row ids and a family.
 *   Losing it costs one re-selection from a screen the user can still reach.
 *   Putting it in Postgres would mean a table, RLS, a sweep job and a
 *   migration for something whose worst-case failure is a shrug.
 *
 * So it is AsyncStorage, the same store `consent-mode.ts` and `queue-store.ts`
 * already use, and NO new server contract exists — which is what the ruling
 * asked for.
 *
 * SCOPED TO THE USER, and that is not decoration. Two people sign in on one
 * phone more often than anyone designs for, and a hold read back under the
 * wrong account would pre-tick colourways of a garment the reader never chose
 * and then import them on a tap. The key carries the user id and
 * `readHeldSelection` refuses a hold whose id does not match the caller's.
 *
 * ONE DAY, and expiry is checked on READ rather than swept. A hold whose
 * moment has passed is indistinguishable from no hold at all, so there is
 * nothing to clean up and no job that has to be running for the promise to
 * hold.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CatalogueColourway, CatalogueFamily } from './types';

const KEY = 'cinch.catalogue.held-selection.v1';

/** §10.5's proposal, taken as the answer. */
export const HOLD_TTL_MS = 24 * 60 * 60 * 1000;

export type HeldSelection = {
  /** Whose hold this is. A mismatch is treated as no hold. */
  userId: string;
  /** Epoch ms. Compared on read; nothing sweeps. */
  heldAt: number;
  family: CatalogueFamily;
  /** The colourways that were ticked, in the order they were ticked. */
  colours: CatalogueColourway[];
};

/**
 * Put the selection down.
 *
 * Never throws. A hold that could not be written is a hold that is not there,
 * and the screen behind it still works — refusing the capacity message because
 * a key/value write failed would turn a nicety into an outage.
 */
export async function holdSelection(
  userId: string,
  family: CatalogueFamily,
  colours: readonly CatalogueColourway[],
  now: number,
): Promise<void> {
  if (!userId || colours.length === 0) return;
  try {
    const held: HeldSelection = { userId, heldAt: now, family, colours: [...colours] };
    await AsyncStorage.setItem(KEY, JSON.stringify(held));
  } catch {
    // See above.
  }
}

/**
 * Read the hold, if there is one that belongs to this caller and is still
 * inside its day. Anything else — no hold, another account's, expired,
 * unparseable — is `null`, which the screen already draws as "no hold".
 */
export async function readHeldSelection(
  userId: string,
  now: number,
): Promise<HeldSelection | null> {
  if (!userId) return null;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const held = JSON.parse(raw) as HeldSelection;
    return isLiveHold(held, userId, now) ? held : null;
  } catch {
    return null;
  }
}

/**
 * The whole rule, as a pure function, so a test can walk it without a store.
 *
 * Shape is checked as well as ownership and age: this value has been through
 * JSON and a schema change would otherwise arrive as an undefined field deep
 * inside a render.
 */
export function isLiveHold(held: HeldSelection | null, userId: string, now: number): boolean {
  if (!held || typeof held !== 'object') return false;
  if (held.userId !== userId) return false;
  if (typeof held.heldAt !== 'number' || !Number.isFinite(held.heldAt)) return false;
  if (now - held.heldAt >= HOLD_TTL_MS) return false;
  if (!held.family || typeof held.family.familyId !== 'string') return false;
  return Array.isArray(held.colours) && held.colours.length > 0;
}

/** Let it go — on a successful import, and when the user changes their mind. */
export async function releaseHeldSelection(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // As above.
  }
}
