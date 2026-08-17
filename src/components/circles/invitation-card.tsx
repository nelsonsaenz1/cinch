import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Rule } from '@/components/ui/rule';
import { Text } from '@/components/ui/text';
import {
  acceptAccessibilityLabel,
  declineAccessibilityLabel,
  declineNote,
  INVITATION,
  invitationFrom,
  memberLine,
} from '@/features/circles/copy';

/**
 * AN INVITATION, AS IT REACHES THE PERSON WHO HAS TO ANSWER IT — PC-04.
 *
 * ══ WHAT IS NOT ON THIS CARD ═══════════════════════════════════════════════
 *
 * **The roster.** Not a stack of faces, not a "with Ada, Ben and 2 others", not
 * a count of who is *invited*. The frame's promise is exact — "You will see who
 * else is in it after you accept. Nothing of yours is shared until then." — and
 * the schema keeps it rather than this component remembering to: the membership
 * select policy is "your own row, always; everyone else's only if you are
 * `joined`", which is a deliberate departure from `event_members`'
 * `can_see_event`. An invitee who asked for the roster would be handed one row:
 * their own.
 *
 * `memberCount` is the one fact that crosses, and it comes from
 * `circle_member_count(uuid)` — a scalar, deliberately not a view, because a
 * view is joinable back to the membership table and names people while a scalar
 * cannot be decomposed. It counts `joined` only: counting invitations would
 * tell this reader that three other people are "in" a group none of them has
 * agreed to join yet.
 *
 * ══ AND DECLINING IS NOT A DOOR CLOSING ════════════════════════════════════
 *
 * The note under the buttons says what the inviter learns (the answer, and
 * nothing else) and that the door stays open. Both are true of the schema, not
 * just of the sentence: `can_see_circle` admits `declined` precisely so a
 * turned-down invitation stays reachable, and the transition trigger permits
 * `declined → joined` and `declined → invited` both.
 *
 * Presentational only — `onAccept` and `onDecline` are callbacks. The refusal
 * this card cannot express is the seat that vanished while it waited; that is
 * `AcceptRefusedNotice` in `state-screens.tsx`.
 */
export function InvitationCard({
  groupName,
  inviterName,
  memberCount,
  onAccept,
  onDecline,
  pending = false,
}: {
  groupName: string;
  /** Null when a display name never arrived — the copy falls back, not the UI. */
  inviterName: string | null;
  /** `joined` only. How many, never who. */
  memberCount: number;
  onAccept: () => void;
  onDecline: () => void;
  /** True while either answer is in flight. Both buttons go inert together. */
  pending?: boolean;
}) {
  return (
    <Card padding="lg">
      {/* The name is the heading, because the first question anybody has about
          an invitation is what it is to. `trim` collapses the serif line box to
          the cap height; it is safe here because the name is a heading with its
          own line, and nothing sits tight underneath it. */}
      <Text variant="plate" trim accessibilityRole="header">
        {groupName}
      </Text>

      <Text variant="note" className="mt-2">
        {memberLine(memberCount)}
      </Text>
      <Text variant="note" className="mt-0.5">
        {invitationFrom(inviterName)}
      </Text>

      <Text variant="body" className="mt-4 text-muted">
        {INVITATION.body}
      </Text>

      {/* Accept is the page's one ink action; Decline is the quiet peer beside
          it. Neither is oxblood: declining is not destructive — the invitation
          survives it and can be accepted later — and spending the accent here
          would say otherwise. */}
      <View className="mt-5" style={{ gap: 10 }}>
        <Button
          title={INVITATION.accept}
          variant="ink"
          loading={pending}
          onPress={onAccept}
          accessibilityLabel={acceptAccessibilityLabel(groupName)}
        />
        <Button
          title={INVITATION.decline}
          variant="secondary"
          disabled={pending}
          onPress={onDecline}
          accessibilityLabel={declineAccessibilityLabel(groupName)}
          accessibilityHint={declineNote(inviterName)}
        />
      </View>

      <View className="mt-5">
        <Rule />
      </View>
      <Text variant="note" className="mt-3">
        {declineNote(inviterName)}
      </Text>
    </Card>
  );
}
