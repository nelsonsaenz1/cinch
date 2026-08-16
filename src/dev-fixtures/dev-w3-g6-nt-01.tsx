import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { DEFAULT_NOTIFICATION_PREFS } from '@/features/push/channels';
import { NotificationPreferencesView } from '@/features/push/preferences-view';

/**
 * NT-01 — preferences, allowed.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · CORRECTION 32, AS FAR AS IT IS TRUE. The five channels are the five in
 *   `features/push/channels.ts` — Morning edit, Friend activity, Borrow
 *   requests, Event reminders, Votes and comments — and their titles are the
 *   atlas's, verbatim. Their DESCRIPTIONS are the code's, and deliberately not
 *   the atlas's paraphrases of them: that file's governing rule is "the
 *   description is the promise", and the senders in
 *   `supabase/functions/send-push` are checked against these exact sentences.
 *   Three of the atlas's rewordings would have broken that — see the group-6
 *   record for which, and for the sender line that disproves each.
 * · The opening sentence COUNTS the channel table rather than stating a
 *   literal five, so a sixth channel cannot appear without this line changing
 *   to match — which is the moment somebody would have to justify it.
 * · EVERY TOGGLE PRINTS ITS STATE AS A WORD under its label, so no preference
 *   is carried by the track colour alone. Votes and comments is the one that
 *   starts off, because it is the channel whose frequency other people set.
 * · FOUR SEND TIMES, the complete set — `morning_edit_at` is constrained to
 *   exactly these four in SQL because the cron runs on the quarter hour. All
 *   four are visible; there is no partially revealed chip to mis-tap.
 * · The morning edit never names the outfit. Naming it would put closet content
 *   on a lock screen, and the server does not have a look at that hour anyway.
 * · The closing line: no notification carries a garment photograph, and
 *   Activity keeps the same 30 days whatever these switches say.
 *
 * DETERMINISM: `DEFAULT_NOTIFICATION_PREFS` is a literal object; nothing here
 * queries, and the schedule opens by default so the send-time rail is in frame.
 */
export default function DevW3G6NT01() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="px-gutter pb-16 pt-4">
        <NotificationPreferencesView
          prefs={DEFAULT_NOTIFICATION_PREFS}
          permission="granted"
          onToggle={() => undefined}
          onPickTime={() => undefined}
          onOpenSettings={() => undefined}
          initialScheduleOpen
        />
      </ScrollView>
    </SafeAreaView>
  );
}
