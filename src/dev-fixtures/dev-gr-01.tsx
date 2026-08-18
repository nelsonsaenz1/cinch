import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GroupRow } from '@/components/circles';
import { Text } from '@/components/ui/text';
import { ROOM_NAME, SECOND_ROOM, THIRD_ROOM } from '@/dev-fixtures/gr-fixture-data';
import { GROUPS_TITLE, NO_GROUPS } from '@/features/circles/copy';

/**
 * GR-01 · redesign 27 — the groups list, populated.
 *
 * THE CANONICAL LIST FRAME. Three rooms as three warm plates with air between
 * them, each carrying its name in the serif at plate size, the seat marks, and
 * the data line that states how many and whether the reader owns it.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · The plates are separate. A card of hairline-separated rows said "one list";
 *   these rooms share nothing but the reader, and the frames say so.
 * · The seat marks carry the COUNT and nothing else. The artifact draws real
 *   member faces here; `SeatMarks` explains at length why this does not — the
 *   list has no roster to draw from, and the row's spoken label is pinned to a
 *   sentence that names nobody, so faces would be four facts to the eye and
 *   three to VoiceOver.
 * · The visibility promise sits under the masthead, on the page it is about,
 *   rather than only inside the empty state where it is read once.
 *
 * DETERMINISM: no clock, no network, no query.
 */
export default function DevGr01() {
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="px-gutter pb-12 pt-3">
        <Text variant="display" trim accessibilityRole="header">
          {GROUPS_TITLE}
        </Text>
        <Text variant="note" className="mt-2">
          {NO_GROUPS.footnote}
        </Text>

        <View className="mt-6" style={{ gap: 12 }}>
          <GroupRow name={ROOM_NAME} memberCount={5} isOwner onOpen={() => undefined} />
          <GroupRow name={SECOND_ROOM} memberCount={6} isOwner={false} onOpen={() => undefined} />
          <GroupRow name={THIRD_ROOM} memberCount={4} isOwner={false} onOpen={() => undefined} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
