import { PUSH_AVAILABLE } from '@/features/push/native';

/**
 * The push client, in one import path.
 *
 * The view component is deliberately NOT re-exported here: `notifications.tsx`
 * and `dev-notifications.tsx` import it by path, and Profile & settings should
 * be able to ask the one question below without pulling a screen's worth of
 * React Native into its import graph.
 */

export {
  allChannelsOff,
  channelsInGroup,
  DEFAULT_MORNING_EDIT_TIME,
  DEFAULT_NOTIFICATION_PREFS,
  MORNING_EDIT_SLOTS,
  morningEditDescription,
  morningEditLabel,
  normalizeMorningEditTime,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_GROUPS,
  prefsFromRow,
  rowFromPrefs,
  type MorningEditTime,
  type NotificationChannel,
  type NotificationChannelGroup,
  type NotificationChannelKey,
  type NotificationPrefs,
  type NotificationPrefsRow,
} from '@/features/push/channels';

export {
  askPushPermission,
  readPushPermission,
  useAskPushPermission,
  usePushPermission,
  type PushPermission,
} from '@/features/push/permission';

export { useNotificationPrefs, useSetNotificationPrefs } from '@/features/push/prefs';

export { registerPushToken } from '@/features/push/token';

export { PUSH_AVAILABLE } from '@/features/push/native';

/**
 * **Whether Profile & settings renders the Notifications row at all.**
 *
 * This is the predicate the integrator wants. It is a fact about the binary,
 * resolved once at module scope: `expo-notifications` ships a native module,
 * the module is only in the app once a store build has been cut, and this wave
 * ships over the air onto a binary that does not have it. On that binary the
 * whole feature does not exist — no row, no screen, no token, and the system
 * permission is never requested — which is what lets the same bundle be safe to
 * publish and safe to build (contract §6.2).
 *
 *   {NOTIFICATION_SETTINGS_AVAILABLE ? (
 *     <SettingsRow label="Notifications" onPress={() => router.push('/notifications')} />
 *   ) : null}
 *
 * It is an alias of `PUSH_AVAILABLE` rather than a second source of truth. It
 * exists under its own name because the question the row is asking — "is there
 * anything for this row to lead to?" — is worth stating once, in one place,
 * instead of every caller re-deriving it and one of them getting it backwards.
 *
 * Not a hook: there is nothing to subscribe to. A binary either has the module
 * or it does not, and the answer cannot change during a session.
 */
export const NOTIFICATION_SETTINGS_AVAILABLE: boolean = PUSH_AVAILABLE;
