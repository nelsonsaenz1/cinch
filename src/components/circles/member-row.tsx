import { Pressable, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Text } from '@/components/ui/text';
import {
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
 */

/** 44pt, which is both the disc and the tap target. One number, one place. */
const AVATAR = 44;

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
    <View className="flex-row items-center gap-2 px-4 py-3" style={{ minHeight: MIN_TAP_TARGET }}>
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
 * PC-05 — an invitation still out in the world.
 *
 * The status is a fact, not a nudge: there is no chaser, no "waiting 3 days"
 * and no reminder control. An invite-only room that pressured people would be
 * the opposite of the thing it is for.
 *
 * `onWithdraw` is the owner's way back out. It is the same act as a removal in
 * the schema (`invited → removed`) and is worded differently on purpose —
 * nothing was taken away, because nothing had been accepted.
 */
export function PendingInvitationRow({
  name,
  onWithdraw,
}: {
  name: string;
  onWithdraw?: () => void;
}) {
  return (
    <View className="flex-row items-center gap-2 px-4 py-3" style={{ minHeight: MIN_TAP_TARGET }}>
      <View accessible accessibilityRole="text" accessibilityLabel={pendingRowAccessibilityLabel(name)} className="flex-1" style={{ minWidth: 0 }}>
        <Identity name={name} detail={PENDING.status} />
      </View>
      {onWithdraw ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${PENDING.withdraw} the invitation to ${name}`}
          onPress={onWithdraw}
          hitSlop={8}
          style={{ minHeight: MIN_TAP_TARGET, flexGrow: 0, flexShrink: 0 }}
          className="justify-center px-2 active:opacity-60">
          <Text variant="note">{PENDING.withdraw}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
