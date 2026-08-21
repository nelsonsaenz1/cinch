import { useRouter } from 'expo-router';
import { Linking, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton, ErrorState, Notice, Skeleton, Text } from '@/components/ui';
import {
  DEFAULT_NOTIFICATION_PREFS,
  PUSH_AVAILABLE,
  useAskPushPermission,
  useNotificationPrefs,
  usePushPermission,
  useSetNotificationPrefs,
  type MorningEditTime,
  type NotificationChannelKey,
} from '@/features/push';
import { NotificationPreferencesView } from '@/features/push/preferences-view';

/**
 * Notifications — atlas 37 (NP-01…NP-04), pushed from Profile & settings.
 *
 * The wiring only. Every state lives in `NotificationPreferencesView`, which
 * `dev-notifications.tsx` drives with fixtures, so what is verified in the dev
 * route is the same component that ships rather than a replica of it.
 *
 * REACHABILITY. Profile renders the row that leads here only when
 * `NOTIFICATION_SETTINGS_AVAILABLE` is true — that is, only on a binary that
 * actually contains `expo-notifications`. This screen is nonetheless written to
 * survive being reached without one (a dev deep link, a stale link): the
 * preference reads and writes are ordinary Supabase and work fine, and the
 * permission layer answers `unsupported` without ever touching the module. What
 * it must never do is ask for a permission it cannot ask for, which is why
 * every ask is behind `PUSH_AVAILABLE`.
 */
export default function NotificationsScreen() {
  const router = useRouter();

  const prefs = useNotificationPrefs();
  const save = useSetNotificationPrefs();
  const permission = usePushPermission();
  const ask = useAskPushPermission();

  /**
   * A channel moved.
   *
   * The write goes first and optimistically — the switch is the user's own
   * answer and has nothing to reconcile against. The system prompt follows,
   * and only on the way ON: "asked for in context… the first time a channel is
   * switched on, not at launch and not during the tour."
   *
   * `askPushPermission` is the one that decides whether a prompt is actually
   * raised: already granted registers a token and shows nothing, a hard denial
   * shows nothing (iOS will not ask twice, and a tap that silently does nothing
   * is worse than the banner NP-03 puts up instead). If the person declines,
   * the switch stays where they put it — the preference is remembered, the
   * phone simply will not act on it yet.
   */
  const onToggle = (key: NotificationChannelKey, next: boolean) => {
    const current = prefs.data ?? DEFAULT_NOTIFICATION_PREFS;
    save.mutate({ ...current, [key]: next });
    if (next && PUSH_AVAILABLE) ask.mutate();
  };

  const onPickTime = (value: MorningEditTime) => {
    const current = prefs.data ?? DEFAULT_NOTIFICATION_PREFS;
    if (current.morningEditAt === value) return;
    save.mutate({ ...current, morningEditAt: value });
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      {/* The same header privacy.tsx draws, for the same reason: this is the
          second page of the Profile sheet, and the two settings sub-pages
          should be visibly the same object. `pt-5` clears the sheet grabber. */}
      <View className="flex-row items-center px-gutter pb-1 pt-5">
        <BackButton onPress={() => router.back()} label="Back to settings" />
        <Text variant="plate" trim className="flex-1 text-center">
          Settings
        </Text>
        <View className="h-9 w-9" />
      </View>

      <ScrollView contentContainerClassName="px-gutter pb-24 pt-6">
        {prefs.isLoading ? (
          <View accessibilityLabel="Loading your notification settings">
            <Skeleton className="h-8 w-56 rounded-chip" />
            <View className="mt-5 gap-2">
              <Skeleton className="h-4 w-full rounded-chip" />
              <Skeleton className="h-4 w-3/4 rounded-chip" />
            </View>
            <Skeleton className="mt-8 h-[260px] w-full rounded-plate" />
          </View>
        ) : prefs.isError ? (
          <ErrorState
            title="Your notification settings didn’t load"
            body="Nothing has changed — whatever you had switched on is still switched on. This is only the screen failing to read it."
            onRetry={() => void prefs.refetch()}
            retrying={prefs.isRefetching}
          />
        ) : (
          <>
            <NotificationPreferencesView
              prefs={prefs.data ?? DEFAULT_NOTIFICATION_PREFS}
              // `undetermined` while the permission read is in flight: it is
              // the state in which nothing is claimed about the phone. Drawing
              // NP-03's banner on a slow read would tell somebody their phone
              // was refusing notifications before we had asked it.
              permission={permission.data ?? 'undetermined'}
              onToggle={onToggle}
              onPickTime={onPickTime}
              onOpenSettings={() => void Linking.openSettings()}
            />
            {/* The optimistic write already rolled back, so the switch on
                screen is accurate; this says why it moved back. */}
            {save.isError ? (
              <Notice
                className="mt-4"
                tone="critical"
                message="That didn’t save — your settings are unchanged. Try the switch again."
              />
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
