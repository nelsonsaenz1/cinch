import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton, Chip, Text } from '@/components/ui';
import {
  DEFAULT_NOTIFICATION_PREFS,
  NOTIFICATION_CHANNELS,
  PUSH_AVAILABLE,
  type MorningEditTime,
  type NotificationChannelKey,
  type NotificationPrefs,
  type PushPermission,
} from '@/features/push';
import { NotificationPreferencesView } from '@/features/push/preferences-view';

/**
 * Notification preferences fixture — `cinch://dev-notifications`.
 *
 * The four states of atlas 37 (NP-01…NP-04), held against the real
 * `NotificationPreferencesView` — the same component `notifications.tsx` ships,
 * with fixture settings and a fixture permission in place of the two Supabase
 * reads and the native module.
 *
 * This route exists because **the states cannot otherwise be looked at at all**.
 * `expo-notifications` is not in the binary in the field, so `PUSH_AVAILABLE`
 * is false, Profile renders no Notifications row, and the real screen has no
 * door. NP-03 in particular needs a phone that has refused permission, which is
 * not a thing a simulator without the module can even be put into.
 *
 * The handlers are real, not poses: toggling a switch here changes the fixture,
 * so switching everything off in NP-01 walks the page into NP-02's note under
 * your hands, and the four times in NP-04 actually select. Nothing touches the
 * network and nothing touches the native module — see the banner below, which
 * says out loud which binary you are looking at this on.
 */

const FRAMES = [
  'NP-01 Default',
  'NP-02 All off',
  'NP-03 Denied',
  'NP-04 Morning edit',
] as const;
type Frame = (typeof FRAMES)[number];

const ALL_OFF: NotificationPrefs = {
  ...DEFAULT_NOTIFICATION_PREFS,
  ...(Object.fromEntries(NOTIFICATION_CHANNELS.map((c) => [c.key, false])) as Record<
    NotificationChannelKey,
    boolean
  >),
};

/**
 * What each frame starts from. NP-03 deliberately starts from the DEFAULTS, not
 * from off: its whole point is that a denial leaves the remembered values
 * alone, and a fixture that showed every switch off would demonstrate the
 * opposite of the state it is named after.
 */
const FIXTURES: Record<
  Frame,
  { prefs: NotificationPrefs; permission: PushPermission; scheduleOpen: boolean }
> = {
  'NP-01 Default': {
    prefs: DEFAULT_NOTIFICATION_PREFS,
    permission: 'granted',
    scheduleOpen: false,
  },
  'NP-02 All off': { prefs: ALL_OFF, permission: 'granted', scheduleOpen: false },
  'NP-03 Denied': { prefs: DEFAULT_NOTIFICATION_PREFS, permission: 'denied', scheduleOpen: false },
  'NP-04 Morning edit': {
    prefs: DEFAULT_NOTIFICATION_PREFS,
    permission: 'granted',
    scheduleOpen: true,
  },
};

export default function DevNotificationsScreen() {
  const [frame, setFrame] = useState<Frame>('NP-01 Default');
  const [prefs, setPrefs] = useState<NotificationPrefs>(FIXTURES['NP-01 Default'].prefs);
  const [permission, setPermission] = useState<PushPermission>('granted');

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  const select = (next: Frame) => {
    setFrame(next);
    setPrefs(FIXTURES[next].prefs);
    setPermission(FIXTURES[next].permission);
  };

  return (
    <View className="flex-1 bg-canvas">
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* The escape hatch. Every other frame is one chip away, but the route
            itself has to be leavable — see "Make the dev routes escapable". */}
        <View className="flex-row items-center gap-3 px-gutter pb-1 pt-3">
          <BackButton label="Leave the fixture" />
          <Text variant="colophon">{frame} · Notification preferences</Text>
        </View>

        {/* Which binary this is. The screen renders identically either way —
            that is the point of the guarded require — but somebody looking at
            NP-01 should know whether a real permission prompt is even possible
            on the build in their hand. */}
        <Text variant="note" className="px-gutter pb-1">
          {PUSH_AVAILABLE
            ? 'This build HAS the notifications module. Fixture handlers only — nothing is written.'
            : 'This build has no notifications module, so the real screen has no door in Profile. Fixture handlers only.'}
        </Text>

        <ScrollView contentContainerClassName="px-gutter pb-32 pt-4">
          <NotificationPreferencesView
            // Remounted per frame so NP-04 opens already expanded and the
            // others open closed, without the expansion becoming a controlled
            // prop the real screen would then have to own.
            key={frame}
            prefs={prefs}
            permission={permission}
            initialScheduleOpen={FIXTURES[frame].scheduleOpen}
            onToggle={(key, next) => setPrefs((current) => ({ ...current, [key]: next }))}
            onPickTime={(value: MorningEditTime) =>
              setPrefs((current) => ({ ...current, morningEditAt: value }))
            }
            onOpenSettings={() =>
              Alert.alert(
                'Open iOS Settings',
                'The real screen calls Linking.openSettings() here. The fixture stops short of leaving the app so the switcher stays reachable.',
              )
            }
          />
        </ScrollView>
      </SafeAreaView>

      <View className="absolute bottom-0 left-0 right-0 border-t border-rule bg-canvas px-3 pb-8 pt-2.5">
        <View className="flex-row flex-wrap gap-2">
          {FRAMES.map((f) => (
            <Chip
              key={f}
              label={f}
              selected={frame === f}
              selectedGround="ink"
              onPress={() => select(f)}
            />
          ))}
        </View>
      </View>
    </View>
  );
}
