import { Pressable, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Text } from '@/components/ui/text';
import {
  closedRowAccessibilityLabel,
  inviteAgainAccessibilityLabel,
  invitedLabel,
  joinedLabel,
  MANAGE,
  memberRowAccessibilityLabel,
  PENDING,
  pendingRowAccessibilityLabel,
  removeAccessibilityLabel,
} from '@/features/circles/copy';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * THE ROSTER'S TWO ROWS — PC-07, and PC-07b.
 *
 * `MemberRow` is somebody who is in the group. `PendingInvitationRow` is
 * somebody who has been asked and has not answered. They are deliberately two
 * components rather than one with a `state` prop: the second has no Owner badge
 * and no join date because neither exists yet, and a single row that blanked
 * two of its four fields on a flag is how a roster comes to draw an empty
 * "Joined" line under a person who has not joined.
 *
 * ── EVERYTHING THAT COULD BE A COLOUR IS A WORD ─────────────────────────────
 *
 * The Owner badge prints "Owner". Not a crown, not a tint, not a heavier
 * weight — the app has one sans cut and hierarchy is never carried by weight
 * (TY-01), so a badge that leaned on any of those would be meaning carried by
 * exactly the channel the atlas forbids. The pending row prints its status the
 * same way. `PC-06-AX` is the proof this survives: at AX-XXXL the badge drops
 * BELOW the name and "Joined Mar 4" takes its own line, which `flex-wrap` on
 * the identity block does with no measurement and no breakpoint.
 *
 * ── AND NOTHING NAMES WHO REMOVED ANYBODY ───────────────────────────────────
 *
 * PC-07: "They are told they were removed, not who removed them." There is no
 * remover field on `circle_members` to leak, and no row here goes looking for
 * one. `removed` and `left` rows are not drawn at all — the roster this
 * component fills is the `joined` one.
 *
 * ── AND WHY EACH ROW IS NOW ITS OWN PLATE ───────────────────────────────────
 *
 * Redesign 27 sets the roster as separate warm slabs with air between them
 * rather than as hairline-separated rows inside one card, and gives the WAITING
 * rows the blush ground the invitation bands use. Two reasons, and neither is
 * decoration:
 *
 * · A destructive control sits on most of these rows. Air around each plate
 *   works WITH the `hitSlop` rather than instead of it, and unlike a hairline
 *   it is visible — the separation between "Remove Alexandria" and "Remove
 *   Christopher" is now a gap you can see rather than a line you can measure.
 * · The two sections are different kinds of thing. Members are people in a
 *   room; waiting invitations are offers out in the world. The frames separate
 *   them by GROUND — and the headings above them, plus the status ON each row,
 *   say the same thing in words, so nothing is carried by the fill alone.
 */

/** 44pt, which is both the disc and the tap target. One number, one place. */
const AVATAR = 44;

/**
 * The two grounds a roster plate can have.
 *
 * `tray` is somebody who is here. `blush` is a seat that is promised — the same
 * warmth the invitation bands carry, because it is the same fact seen from the
 * other side. Never the only carrier of that difference: every blush row also
 * prints its status as a word.
 */
const PLATE = 'mb-2 flex-row items-center gap-2 rounded-plate px-4 py-3';

/**
 * The identity block, shared by both rows.
 *
 * `flex-1` with `minWidth: 0` on the block and `flex-none` on whatever sits
 * beside it: that pair is what lets a long name wrap and a status run to the
 * action's edge without pushing it off the row. No `numberOfLines` anywhere —
 * a person's name is the whole of what the row identifies, and a truncated one
 * is a clipped meaning rather than a tidy row.
 */
function Identity({
  name,
  badge,
  detail,
}: {
  name: string;
  badge?: string;
  detail?: string;
}) {
  return (
    <View className="flex-1 flex-row items-center gap-3" style={{ minWidth: 0 }}>
      <Avatar name={name} size={AVATAR} />
      <View className="flex-1" style={{ minWidth: 0 }}>
        {/* `flex-wrap`, so the badge sits beside the name while there is room
            and drops under it when there is not — PC-06-AX's reflow, done by
            the layout rather than by a size query. */}
        <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
          <Text variant="body">{name}</Text>
          {badge ? (
            <View className="rounded-md bg-sand px-2 py-0.5">
              <Text variant="eyebrow">{badge}</Text>
            </View>
          ) : null}
        </View>
        {detail ? (
          <Text variant="note" className="mt-0.5">
            {detail}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * The quiet destructive control beside a name.
 *
 * A text button rather than a bordered pill: one filled action per row with a
 * text alternative beside it is the house rule (`friend-rows.tsx`), and a
 * roster of eleven outlined Remove pills is a stack of badges rather than a
 * list of people. `critical` is 8.04:1 on canvas and is a permitted text role
 * — but the WORD is what says what the control does; the colour only agrees
 * with it.
 *
 * Its own 44pt target, `flex-none`, and `hitSlop` on top: a destructive control
 * must never be a graze off the row beside it.
 */
function RemoveButton({ name, onRemove }: { name: string; onRemove: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={removeAccessibilityLabel(name)}
      accessibilityHint={MANAGE.removalNote}
      onPress={onRemove}
      hitSlop={8}
      style={{ minHeight: MIN_TAP_TARGET, flexGrow: 0, flexShrink: 0 }}
      className="justify-center px-2 active:opacity-60">
      <Text variant="note" style={{ color: theme.critical }}>
        {MANAGE.remove}
      </Text>
    </Pressable>
  );
}

export function MemberRow({
  name,
  isOwner,
  joinedAt,
  /**
   * Omitted for everyone the reader may not remove — themselves, and every row
   * when the reader is not the owner. ABSENT rather than disabled: a disabled
   * Remove beside another member's name would imply the reader could eject them
   * under some other circumstance, and the only person who can is the owner.
   */
  onRemove,
}: {
  name: string;
  isOwner: boolean;
  joinedAt: string | null;
  onRemove?: () => void;
}) {
  return (
    <View className={`${PLATE} bg-tray`} style={{ minHeight: MIN_TAP_TARGET }}>
      <View accessible accessibilityRole="text" accessibilityLabel={memberRowAccessibilityLabel({ name, isOwner, joinedAt })} className="flex-1" style={{ minWidth: 0 }}>
        <Identity
          name={name}
          badge={isOwner ? MANAGE.ownerBadge : undefined}
          detail={joinedLabel(joinedAt)}
        />
      </View>
      {onRemove ? <RemoveButton name={name} onRemove={onRemove} /> : null}
    </View>
  );
}

/**
 * The quiet, non-destructive control beside a name — Revoke, Invite again.
 *
 * Shares `RemoveButton`'s geometry and not its colour. Neither of these ends
 * anybody's access to anything: revoking withdraws an offer nobody accepted,
 * and inviting again reopens one. `critical` is spent on the one act that
 * throws a person out of a room they are standing in.
 */
function RowAction({
  label,
  accessibilityLabel,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={8}
      style={{ minHeight: MIN_TAP_TARGET, flexGrow: 0, flexShrink: 0 }}
      className="justify-center px-2 active:opacity-60">
      <Text variant="note">{label}</Text>
    </Pressable>
  );
}

/**
 * PC-05's Waiting section — an invitation still out in the world.
 *
 * The status is a fact, not a nudge: it says when the owner asked and stops.
 * There is no chaser, no "still waiting" and no reminder control; an
 * invite-only room that pressured people would be the opposite of the thing it
 * is for. The date is the frame's own treatment and it is the reason the
 * standing "waiting for an answer" label is now only the undated fallback — a
 * label that never changes starts, after a week of looking at it, to read as
 * the app asking on the owner's behalf.
 *
 * `onWithdraw` is the owner's way back out. It is the same act as a removal in
 * the schema (`invited → removed`) and is worded differently on purpose —
 * nothing was taken away, because nothing had been accepted.
 */
export function PendingInvitationRow({
  name,
  invitedAt = null,
  onWithdraw,
}: {
  name: string;
  invitedAt?: string | null;
  onWithdraw?: () => void;
}) {
  return (
    <View className={`${PLATE} bg-blush`} style={{ minHeight: MIN_TAP_TARGET }}>
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={pendingRowAccessibilityLabel(name, invitedAt)}
        className="flex-1"
        style={{ minWidth: 0 }}>
        <Identity name={name} detail={invitedLabel(invitedAt)} />
      </View>
      {onWithdraw ? (
        <RowAction
          label={PENDING.withdraw}
          accessibilityLabel={`${PENDING.withdraw} the invitation to ${name}`}
          onPress={onWithdraw}
        />
      ) : null}
    </View>
  );
}

/**
 * PC-05's Closed section — an invitation that is no longer waiting on anybody.
 *
 * ── WHY THIS ROW EXISTS AT ALL, WHEN THE INVITATION IS OVER ─────────────────
 *
 * Because the door is not. The transition trigger permits
 * `declined → invited`, and `can_see_circle` keeps a declined row visible
 * precisely so that is reachable. Without this row the only record of a
 * turned-down invitation is its absence, and an owner who wanted to ask again
 * after a month would have to remember they ever asked.
 *
 * ── AND WHY IT SAYS ONLY WHAT IT KNOWS ─────────────────────────────────────
 *
 * PC-05 draws three closed statuses: "Declined", "Revoked by you" and
 * "Canceled · no longer a mutual friend". Only the first is derivable — a
 * revoked invitation and a removed member are the SAME `removed` state on the
 * same column, deliberately, and there is no field to tell them apart. The
 * `status` prop is therefore passed in rather than computed here, and the
 * manage surface passes the one status it can stand behind.
 */
export function ClosedInvitationRow({
  name,
  status,
  onInviteAgain,
}: {
  name: string;
  status: string;
  onInviteAgain?: () => void;
}) {
  return (
    <View className={`${PLATE} bg-tray`} style={{ minHeight: MIN_TAP_TARGET }}>
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={closedRowAccessibilityLabel(name, status)}
        className="flex-1"
        style={{ minWidth: 0 }}>
        <Identity name={name} detail={status} />
      </View>
      {onInviteAgain ? (
        <RowAction
          label={PENDING.inviteAgain}
          accessibilityLabel={inviteAgainAccessibilityLabel(name)}
          onPress={onInviteAgain}
        />
      ) : null}
    </View>
  );
}
