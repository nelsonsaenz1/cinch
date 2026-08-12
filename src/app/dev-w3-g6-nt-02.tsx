import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/ui/text';
import { DEFAULT_NOTIFICATION_PREFS } from '@/features/push/channels';
import { NotificationPreferencesView } from '@/features/push/preferences-view';

/**
 * NT-02 — denied at the system level.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · THE CAUSE IS STATED ONCE, at the top, with the one route out. Every row
 *   below then shifts to the conditional — "Would arrive: …" — rather than
 *   each repeating the reason.
 * · PREFERENCES ARE EXPLICITLY REMEMBERED, and the switches still draw their
 *   remembered values. A switch that snapped to off because the phone refused
 *   delivery would be the app rewriting a preference nobody changed, and
 *   someone who allows notifications later would have to set five of them
 *   again.
 * · AN OVERRIDDEN TOGGLE CARRIES FOUR CHANNELS: tray track, paper knob,
 *   conditional wording, and a stated cause. What it does NOT carry is reduced
 *   opacity — that would take the label and the description down with it, and
 *   those are exactly what a reader deciding whether to go to Settings has to
 *   be able to read. WCAG exempts a disabled control; it has never exempted the
 *   prose beside one.
 * · The page closes by naming where the information waits instead — Activity,
 *   for the same 30 days either way — rather than by explaining a schedule
 *   that cannot run.
 * · The conditional sentence is BUILT FROM the same description the enabled row
 *   prints, so the two cannot drift into two different promises.
 */
export default function DevW3G6NT02() {
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
          permission="denied"
          onToggle={() => undefined}
          onPickTime={() => undefined}
          onOpenSettings={() => undefined}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
