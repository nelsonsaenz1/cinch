import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AloneState } from '@/components/circles';
import { SeatTable } from '@/components/circles/room-parts';
import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/ui/section-header';
import { Text } from '@/components/ui/text';
import { OWNER, ROOM_NAME } from '@/dev-fixtures/gr-fixture-data';
import { ALONE, groupSubtitle, OVERVIEW } from '@/features/circles/copy';

/**
 * GR-05 · redesign 27 — a group with only its owner in it. THE LIVENESS STATE.
 *
 * NOT AN EMPTY STATE, and this frame exists to keep it from becoming one.
 * `handle_new_circle` writes the owner in as `joined` in the same transaction
 * that creates the group, and the schema enforces no floor of two — a minimum
 * would make creation impossible. So this is the FIRST state of every group,
 * not a degenerate one.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · The table is drawn, with the one seat that IS taken at it. The shipped
 *   screen replaced the whole composition with a centred block, which said
 *   "nothing here" with its layout while its words said the opposite.
 * · The band is the sentence, not an apology. No glyph of absence — every
 *   glyph in the states kit means absence, and this room is missing nothing it
 *   was promised.
 * · The label at the foot is `ALONE.action` ("Invite a friend"), not
 *   `OVERVIEW.invite` ("Invite someone"). This state is asking for THE first
 *   person; a room with people in it is asking for another. Two words for one
 *   act, which is why the copy module holds both.
 *
 * Compare with GR-03. Both arrive as a page with no other people on it and they
 * are different problems with different actions.
 */
export default function DevGr05() {
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="px-gutter pb-12 pt-3">
        <Text variant="display" trim accessibilityRole="header">
          {ROOM_NAME}
        </Text>
        <Text variant="note" className="mt-2">
          {groupSubtitle(1, true)}
        </Text>

        <AloneState />

        <View className="mt-7">
          <SectionHeader title={OVERVIEW.membersHeading} className="mb-4" />
          <SeatTable members={[OWNER]} />
        </View>

        <Text variant="note" className="mt-3">
          {OVERVIEW.footnote}
        </Text>
      </ScrollView>

      <View className="px-gutter pb-4 pt-2">
        <Button
          title={ALONE.action}
          variant="primary"
          onPress={() => undefined}
          accessibilityLabel={ALONE.action}
          className="self-stretch"
        />
      </View>
    </SafeAreaView>
  );
}
