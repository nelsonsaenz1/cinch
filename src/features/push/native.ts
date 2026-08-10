/**
 * The one place in the app that names `expo-notifications`.
 *
 * WHY THIS FILE EXISTS
 *
 * Push is a native capability. `expo-notifications` ships a native module, and
 * the module is only in the binary once a store build has been cut. Everything
 * else in this wave — the diary, the boards, Activity, the tour — ships over
 * the air onto the binary that is already in the field, which does NOT have it.
 *
 * A top-level `import * as Notifications from 'expo-notifications'` anywhere in
 * the app would therefore take the whole bundle down on launch: the package's
 * entry point calls `requireNativeModule`, which throws when the module is
 * absent, and a throw during module evaluation is not catchable by the screen
 * that imported it. One OTA, every user, white screen.
 *
 * So the import happens exactly once, inside a try, behind a `require`. If it
 * fails, `PUSH_AVAILABLE` is false and the rest of the app treats push as a
 * feature that does not exist on this device:
 *
 *   * Profile & settings does not render the Notifications row,
 *   * no token is registered,
 *   * no permission is ever requested.
 *
 * Nothing dead ships, nothing throws, and the identical bundle turns the whole
 * feature on the moment it runs on a binary that has the module. See
 * docs/design/diary-boards-activity-contract.md §6.2.
 *
 * THE RULE FOR EVERY OTHER FILE: import from here, never from
 * 'expo-notifications'. A single stray direct import undoes all of it, and it
 * will not be caught by typecheck, by tests, or by the simulator — only by the
 * OTA.
 */

/**
 * The surface of `expo-notifications` this app actually uses, named here so
 * consumers get types without importing the package. Deliberately small: it is
 * a list of what push is allowed to do, and growing it is a decision.
 */
export interface PushModule {
  getPermissionsAsync(): Promise<{ status: string; canAskAgain: boolean }>;
  requestPermissionsAsync(): Promise<{ status: string; canAskAgain: boolean }>;
  getExpoPushTokenAsync(options?: { projectId?: string }): Promise<{ data: string }>;
  setNotificationHandler(handler: unknown): void;
}

function load(): PushModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-notifications') as PushModule | undefined;
    // A module that resolved but has no `getPermissionsAsync` is a version
    // whose shape we do not know. Treated as absent rather than called blind.
    return mod && typeof mod.getPermissionsAsync === 'function' ? mod : null;
  } catch {
    return null;
  }
}

/**
 * Resolved once, at module scope, because the answer cannot change during a
 * session: a binary either has the native module or it does not.
 */
const loaded = load();

/**
 * Whether this build can send or receive a notification at all.
 *
 * Every push-adjacent surface keys off this. It is not a preference, not a
 * permission, and not a setting the user can change — it is a fact about the
 * binary they are running.
 */
export const PUSH_AVAILABLE: boolean = loaded !== null;

/**
 * The module, or null. Callers should prefer `PUSH_AVAILABLE` for rendering
 * decisions and reach for this only where they genuinely need to call into it.
 */
export const push: PushModule | null = loaded;
