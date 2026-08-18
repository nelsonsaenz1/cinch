import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { SheetHeader, SheetShell } from '@/components/events/date-sheet';
import { InviteFriendRow } from '@/components/events/InviteFriendRow';
import { Text } from '@/components/ui/text';
import type { InviteRow } from '@/features/events/invite-rows';

/** One friend, as the composer knows them. */
export type GuestCandidate = {
  userId: string;
  name: string;
  username: string | null;
};

export type GuestSheetProps = {
  visible: boolean;
  friends: readonly GuestCandidate[];
  /** The ids already chosen, seeded on every open. */
  value: readonly string[];
  /** Fired once, on Done, with the whole selection. */
  onDone: (userIds: string[]) => void;
  onClose: () => void;
};

/** About seven rows — tall enough to scan, short enough to stay a sheet. */
const LIST_HEIGHT = 380;

/**
 * Who's going — the composer's guest row, as its own question.
 *
 * A batch checklist over the FRIENDS graph, never a directory search: invites
 * ride friendship, which is `event-social-contract.md`'s rule and the reason
 * this sheet reads its rows from `useFriends()` upstream rather than searching
 * anything. It is the same picker the event's own Invite screen draws — the
 * rows are literally `InviteFriendRow` — asked one step earlier.
 *
 * Nothing is sent from here. The selection is a draft the composer owns, and
 * the invites go out through the existing `useInviteMembers` batch mutation
 * only after the event itself has been created and has an id to hang them on.
 * The create mutation's contract is untouched.
 */
export function GuestSheet({ visible, friends, value, onDone, onClose }: GuestSheetProps) {
  const [picked, setPicked] = useState<string[]>([...value]);

  // Re-seeded on open, the `DateSheet` way — never in an effect.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setPicked([...value]);
  }

  const toggle = (userId: string) =>
    setPicked((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    );

  return (
    <SheetShell
      visible={visible}
      onRequestClose={onClose}
      grabber
      accessibilityLabel="Who’s going">
      <SheetHeader title="Who’s going?" onDone={() => onDone(picked)} />

      {friends.length === 0 ? (
        // Not an error, and not a dead end: an account with no friends yet has
        // an event to create and people to add to it afterwards.
        <View className="mt-4 pb-2">
          <Text variant="note">
            Nobody to add yet. You can invite people once the event exists.
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ height: LIST_HEIGHT }}
          className="mt-3.5"
          showsVerticalScrollIndicator={false}>
          {friends.map((friend, index) => (
            <InviteFriendRow
              key={friend.userId}
              row={rowFor(friend)}
              selected={picked.includes(friend.userId)}
              isLast={index === friends.length - 1}
              onToggle={() => toggle(friend.userId)}
            />
          ))}
        </ScrollView>
      )}
    </SheetShell>
  );
}

/**
 * Every friend is selectable here, and none of them carries a standing.
 *
 * The roster states `InviteRow` exists to express — hosting, going, still
 * deciding, can't make it — are facts about an event that does not exist yet,
 * so there is nothing for this sheet to report and no row it must refuse.
 */
function rowFor(friend: GuestCandidate): InviteRow {
  return {
    userId: friend.userId,
    name: friend.name,
    username: friend.username,
    standing: null,
    selectable: true,
    alreadyInvited: false,
  };
}
