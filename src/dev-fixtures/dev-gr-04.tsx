import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SeatTable } from '@/components/circles/room-parts';
import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/ui/section-header';
import { Text } from '@/components/ui/text';
import { ROOM_MEMBERS, ROOM_NAME, ROOM_PENDING } from '@/dev-fixtures/gr-fixture-data';
import { groupSubtitle, OVERVIEW } from '@/features/circles/copy';

/**
 * GR-04 · redesign 27 — THE ROOM AS A TABLE. The frame this whole page is for.
 *
 * Five people at the table and two seats promised, in ONE grid, with the invite
 * control pinned at the foot.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · The brief's first clause — "member avatars prominent". Sixty-point discs in
 *   a four-column grid, name under each, and nothing else on the page competing
 *   with them. The shipped screen drew the same five people as 44pt settings
 *   rows.
 * · Members and pending seats share the grid because they share the twelve:
 *   `enforce_circle_size` counts `invited` together with `joined`. A pending
 *   seat is drawn on the warm well AND captioned in words, so the difference
 *   between a person and a promise is never the fill alone.
 * · The pending seats are here because the reader OWNS this group. A member
 *   sees the same table without them — see GR-06's note; showing a member who
 *   has been asked and has not answered would be gossip.
 * · The role is stated in words under the name ("5 members · you own this
 *   group"), which the access matrix requires of every screen that has one.
 *
 * DETERMINISM: `invitedAt` null on both promised seats, so the caption is the
 * undated fallback rather than a value that changes overnight.
 */
export default function DevGr04() {
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="px-gutter pb-12 pt-3">
        <Text variant="display" trim accessibilityRole="header">
          {ROOM_NAME}
        </Text>
        <Text variant="note" className="mt-2">
          {groupSubtitle(ROOM_MEMBERS.length, true)}
        </Text>

        <View className="mt-7">
          <SectionHeader title={OVERVIEW.membersHeading} className="mb-4" />
          <SeatTable members={ROOM_MEMBERS} pending={ROOM_PENDING} />
        </View>

        <Text variant="note" className="mt-3">
          {OVERVIEW.footnote}
        </Text>
      </ScrollView>

      <View className="px-gutter pb-4 pt-2">
        <Button
          title={OVERVIEW.invite}
          variant="primary"
          onPress={() => undefined}
          accessibilityLabel={OVERVIEW.invite}
          className="self-stretch"
        />
      </View>
    </SafeAreaView>
  );
}
