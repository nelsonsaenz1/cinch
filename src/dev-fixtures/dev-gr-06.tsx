import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GroupFullNotice } from '@/components/circles';
import { SeatTable } from '@/components/circles/room-parts';
import { SectionHeader } from '@/components/ui/section-header';
import { Text } from '@/components/ui/text';
import { FULL_MEMBERS, ROOM_NAME } from '@/dev-fixtures/gr-fixture-data';
import { groupSubtitle, OVERVIEW } from '@/features/circles/copy';

/**
 * GR-06 · redesign 27 — every seat taken. The cap, stated where it can be acted
 * on.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · THERE IS NO INVITE CONTROL AT THE FOOT. `canInvite` is false at the cap, so
 *   the control is ABSENT rather than disabled, and the band above says why in
 *   words. A greyed-out button with no sentence is a refusal nobody can read.
 * · The band is `tray`, not `blush` and not an error. A full group has twelve
 *   people in it; a glyph of absence over it would be false in the most literal
 *   way available, and nothing failed — the read worked and the write was
 *   refused, so `ErrorState`'s "Cinch couldn't read this" would be a lie about
 *   which half went wrong. `summary`, not `alert`: a fact about the room.
 * · This state is OWNER-ONLY and the resolver enforces it, not the screen. A
 *   member in a twelve-seat group is in a perfectly ordinary group —
 *   `resolveCircleState` resolves `joined` before it ever reaches the seat
 *   check, so a member cannot be shown a wall even by accident.
 * · Twelve discs is also the AX-XXXL argument in miniature: the grid grows, the
 *   page scrolls, and nothing is capped or truncated to make it fit.
 */
export default function DevGr06() {
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="px-gutter pb-12 pt-3">
        <Text variant="display" trim accessibilityRole="header">
          {ROOM_NAME}
        </Text>
        <Text variant="note" className="mt-2">
          {groupSubtitle(FULL_MEMBERS.length, true)}
        </Text>

        <GroupFullNotice />

        <View className="mt-7">
          <SectionHeader title={OVERVIEW.membersHeading} className="mb-4" />
          <SeatTable members={FULL_MEMBERS} />
        </View>

        <Text variant="note" className="mt-3">
          {OVERVIEW.footnote}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
