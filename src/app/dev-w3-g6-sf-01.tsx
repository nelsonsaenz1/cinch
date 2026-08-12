import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BlockedRows } from '@/components/social/BlockedList';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { G6_BLOCKED, G6_NOW } from '@/features/social-graph/w3-g6-fixtures';

/**
 * SF-01 (= BL-01) — the blocked list, settled.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · AUDIT 99 / CORRECTION 28 — the whole consequence of being blocked is
 *   stated ONCE at the top, in regular 17pt prose, and it includes the fact
 *   people most want and most often have to guess: none of them is told. Each
 *   row then draws person, handle and `blocked_at` and nothing else. The
 *   "reported" annotation is gone: `content_reports` is a separate record and
 *   this list never joins it.
 * · The second row has no display name and falls back to its handle, drawn
 *   with the `@` so it reads as a handle rather than as a name.
 * · Every avatar is a tray-filled monogram. `G6_BLOCKED[0]` carries a real
 *   `avatarUrl` and it is never rendered — `BlockedRow` passes
 *   `imageUri={null}` unconditionally, which is the one thing `ProfileRow`
 *   (the grammar every other people-list uses) would not do.
 * · Unblock is INK, never oxblood: reversing a block is a restoration.
 * · Blocking someone new is not available here; the footer names where it
 *   lives, keeping report and block two taps deep.
 *
 * DETERMINISM: `G6_NOW` is a literal, so "Blocked in June" cannot become
 * "Blocked in June 2026" when the year turns. No query, no clock, no network.
 */
export default function DevW3G6SF01() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader title="Blocked people" />
      <ScrollView contentContainerClassName="px-gutter pb-10 pt-4">
        <View>
          <BlockedRows
            rows={G6_BLOCKED}
            now={G6_NOW}
            onUnblock={() => undefined}
            onRetry={() => undefined}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
