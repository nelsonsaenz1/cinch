import { View } from 'react-native';

import { WarmBand } from '@/components/circles/room-parts';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import {
  acceptAccessibilityLabel,
  declineAccessibilityLabel,
  declineNote,
  INVITATION,
  invitationFrom,
  invitationMetaLine,
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
  invitedAt = null,
  memberCount,
  onAccept,
  onDecline,
  pending = false,
}: {
  groupName: string;
  /** Null when a display name never arrived — the copy falls back, not the UI. */
  inviterName: string | null;
  /** When the invitation was last made. Null drops the "· 2 hours ago" clause. */
  invitedAt?: string | null;
  /** `joined` only. How many, never who. */
  memberCount: number;
  onAccept: () => void;
  onDecline: () => void;
  /** True while either answer is in flight. Both buttons go inert together. */
  pending?: boolean;
}) {
  const meta = invitationMetaLine(inviterName, invitedAt);

  return (
    <View>
      {/*
        THE CARD IS THE INVITATION. THE BUTTONS ARE NOT PART OF IT.

        PC-04 draws a bordered card holding the whole of what is being offered
        and sets Accept and Decline on the canvas beneath it, and the split is
        the argument: what the card contains is a claim about a group, and the
        two controls are the reader's answer to it. Buttons inside the border
        made the promise ("Nothing of yours is shared until then") read as part
        of the same object as the button that shares something.

        WHAT CHANGED IN REDESIGN 27: the border became a GROUND. The frames
        draw every invitation on the app's warmest surface — blush — and the
        reason is the brief's own phrase, "invitations as warm bands". An
        invitation is the one thing on this whole flow that is being offered to
        the reader rather than reported at them, and a hairline card said the
        opposite: it looked exactly like the four other white cards the app
        uses for facts. The words are untouched.
      */}
      <WarmBand>
        {/* Who asked, first — the frame's order, and the first question anybody
            has about an invitation. */}
        <View
          accessible
          accessibilityRole="text"
          accessibilityLabel={meta.spoken}
          className="flex-row items-center gap-3">
          <Avatar name={inviterName ?? ''} size={44} />
          <View className="flex-1" style={{ minWidth: 0 }}>
            <Text variant="body">{invitationFrom(inviterName)}</Text>
            <Text variant="note" className="mt-0.5">
              {meta.drawn}
            </Text>
          </View>
        </View>

        {/* Air, where the shipped card drew a hairline. Every rule token in the
            palette is warm ink at a low alpha and goes muddy over `blush` —
            `blushRule` exists for exactly this and `Rule` does not offer it —
            so the separation is spent as space instead. It was never carrying
            meaning; it was carrying the card's own grammar, and the card is a
            band now. */}
        <View className="mt-5" />

        {/* What it is to. `trim` collapses the serif line box to the cap
            height; safe here because the name is a heading on its own line. */}
        <Text variant="plate" trim accessibilityRole="header">
          {groupName}
        </Text>
        <Text variant="note" className="mt-2">
          {memberLine(memberCount)}
        </Text>

        <Text variant="body" className="mt-4 text-muted">
          {INVITATION.body}
        </Text>
      </WarmBand>

      {/* Accept is the page's one oxblood commitment; Decline is the quiet peer
          beside it.

          THE ACCENT MOVED HERE IN REDESIGN 27, from ink. The old argument was
          that oxblood on Accept would make Decline read as the destructive
          twin — but oxblood in this app is the ACTION colour, not the warning
          one (`critical` is the warning one, and it is a different hex), and
          every frame of this flow draws Accept filled in it. The screen has
          exactly one commitment on it and this is the commitment. Decline stays
          `secondary`, which is what actually says it is not destructive:
          declining is reversible — `can_see_circle` admits `declined` precisely
          so it is — and nothing about it is dressed as a loss. */}
      <View className="mt-5" style={{ gap: 10 }}>
        <Button
          title={INVITATION.accept}
          variant="primary"
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

      {/* Centred under the pair, where PC-04 sets it: it is a caption on the
          choice, and above the buttons it would be read before there was
          anything to caption. */}
      <Text variant="note" className="mt-4 text-center">
        {declineNote(inviterName)}
      </Text>
    </View>
  );
}
