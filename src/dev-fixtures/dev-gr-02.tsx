import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GroupRow, InvitationCard } from '@/components/circles';
import { SectionHeader } from '@/components/ui/section-header';
import { Text } from '@/components/ui/text';
import {
  INVITED_ROOM,
  INVITER,
  ROOM_NAME,
  SECOND_ROOM,
} from '@/dev-fixtures/gr-fixture-data';
import {
  GROUPS_TITLE,
  INVITATION,
  invitationsWaiting,
  NO_GROUPS,
} from '@/features/circles/copy';

/**
 * GR-02 · redesign 27 — the list with an invitation waiting on it.
 *
 * THE WARM BAND, IN ITS PLACE. The invitation is drawn on `blush` — the app's
 * warmest surface — and it is drawn ABOVE the reader's own rooms, because it is
 * the only thing on the screen waiting on them.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · The band names who asked, what it is to, and how many have joined — and
 *   NOT ONE MEMBER. "You will see who else is in it after you accept" is kept
 *   by the shape of the data: the membership select policy hands an invitee
 *   their own row and the count comes from a scalar RPC that cannot be
 *   decomposed into people. There is no roster on this card to leak.
 * · Accept carries the oxblood; Decline is the quiet peer. Declining is
 *   reversible in the schema and nothing here dresses it as a loss.
 * · The heading is `INVITATION.heading` — the reader's INCOMING invitations —
 *   and never `PENDING.heading`, which is the owner's outgoing ones under the
 *   same noun two taps away.
 *
 * DETERMINISM: `invitedAt` is null, so the meta line drops its elapsed clause
 * rather than depending on the wall clock.
 */
export default function DevGr02() {
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="px-gutter pb-12 pt-3">
        <Text variant="display" trim accessibilityRole="header">
          {GROUPS_TITLE}
        </Text>
        <Text variant="note" className="mt-2">
          {NO_GROUPS.footnote}
        </Text>

        <View className="mt-6">
          <SectionHeader
            title={INVITATION.heading}
            trailing={<Text variant="note">{invitationsWaiting(1)}</Text>}
          />
          <View className="mt-3">
            <InvitationCard
              groupName={INVITED_ROOM}
              inviterName={INVITER}
              invitedAt={null}
              memberCount={5}
              onAccept={() => undefined}
              onDecline={() => undefined}
            />
          </View>
        </View>

        <View className="mt-8" style={{ gap: 12 }}>
          <GroupRow name={ROOM_NAME} memberCount={5} isOwner onOpen={() => undefined} />
          <GroupRow name={SECOND_ROOM} memberCount={6} isOwner={false} onOpen={() => undefined} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
