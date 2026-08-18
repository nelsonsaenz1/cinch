import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ClosedInvitationRow, MemberRow, PendingInvitationRow } from '@/components/circles';
import { SectionHeader } from '@/components/ui/section-header';
import { Text } from '@/components/ui/text';
import { ROOM_MEMBERS, ROOM_NAME, ROOM_PENDING } from '@/dev-fixtures/gr-fixture-data';
import {
  invitationsWaiting,
  MANAGE,
  manageOwnerSubtitle,
  membersHeading,
  PENDING,
} from '@/features/circles/copy';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * GR-07 · redesign 27 — Manage, as the owner sees it.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · Each row is its own plate with air around it, and the destructive control
 *   sits at the far edge of it with `hitSlop` on top. That gap is protection a
 *   hairline never gave: "Remove Alexandria" and "Remove Christopher" are now
 *   separated by something you can see.
 * · The two sections have two grounds — members on `tray`, waiting invitations
 *   on `blush` — AND two headings AND a status printed on every waiting row.
 *   Three channels agreeing; the fill alone carries nothing.
 * · THE OWNER'S ROW HAS NO REMOVE. Removing yourself is leaving, and the
 *   transition trigger refuses `owner → left` outright. Absent, never disabled:
 *   a greyed-out Remove implies the reader could eject them under some other
 *   circumstance, and nobody can.
 * · The removal promise is printed under the roster, where the act is — "They
 *   are told they were removed, NOT WHO REMOVED THEM." There is no remover
 *   field on `circle_members` for a later screen to leak, so the sentence is
 *   structural rather than a policy somebody has to remember.
 * · The Closed section shows "Declined" and nothing else. PC-05's frame also
 *   draws "Revoked by you"; a withdrawn invitation and a removed member are the
 *   SAME `removed` state on the same column, deliberately, so guessing between
 *   them would put the word "removed" beside somebody who merely never
 *   answered.
 * · The exit is a sand slab with an oxblood label, not a filled oxblood button.
 *   Deleting is a door, and the confirmation behind it is where the commitment
 *   lives.
 */
export default function DevGr07() {
  const theme = useTheme();
  const joined = ROOM_MEMBERS;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScrollView contentContainerClassName="px-gutter pb-12 pt-3">
        <Text variant="display" trim accessibilityRole="header">
          {MANAGE.ownerTitle}
        </Text>
        <Text variant="note" className="mt-2">
          {manageOwnerSubtitle(ROOM_NAME)}
        </Text>

        <SectionHeader title={membersHeading(joined.length)} className="mt-8 mb-2.5" />
        <View>
          {joined.map((member, index) => (
            <MemberRow
              key={member.userId}
              name={member.name}
              isOwner={index === 0}
              joinedAt={null}
              onRemove={index === 0 ? undefined : () => undefined}
            />
          ))}
        </View>

        <Text variant="note" className="mt-3 text-muted">
          {MANAGE.removalNote}
        </Text>

        <View className="mt-8">
          <SectionHeader
            title={PENDING.waitingHeading}
            className="mb-2.5"
            trailing={<Text variant="note">{invitationsWaiting(ROOM_PENDING.length)}</Text>}
          />
          <View>
            {ROOM_PENDING.map((seat) => (
              <PendingInvitationRow
                key={seat.userId}
                name={seat.name}
                invitedAt={seat.invitedAt}
                onWithdraw={() => undefined}
              />
            ))}
          </View>

          <SectionHeader title={PENDING.closedHeading} className="mt-6 mb-2.5" />
          <View>
            <ClosedInvitationRow
              name="Theo Barrington"
              status={PENDING.declined}
              onInviteAgain={() => undefined}
            />
          </View>

          <Text variant="note" className="mt-3">
            {PENDING.footnote}
          </Text>
        </View>

        <SectionHeader title={MANAGE.groupHeading} className="mt-10 mb-2.5" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={MANAGE.delete}
          onPress={() => undefined}
          hitSlop={8}
          style={{ minHeight: MIN_TAP_TARGET }}
          className="items-center justify-center rounded-plate bg-tray px-5 py-4 active:opacity-60">
          <Text variant="label" style={{ color: theme.accent }}>
            {MANAGE.delete}
          </Text>
        </Pressable>

        <Text variant="note" className="mt-3">
          {MANAGE.ownerCannotLeave}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
