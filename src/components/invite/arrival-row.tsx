import { Pressable, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Text } from '@/components/ui/text';
import {
  FRESH_MARK,
  ROW_AVATAR,
  ROW_AVATAR_AX,
  ROW_HEIGHT,
  ROW_HEIGHT_AX,
  ROW_RADIUS,
} from '@/features/invite/invite-lines';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

export type ArrivalRowModel = {
  userId: string;
  name: string;
  /** `@handle`, or null — the row never invents one. */
  handle: string | null;
  /**
   * Arrived within the last two days — the row wears its mark while true.
   *
   * Optional in the dialect the friends rows already use: a fixture builds
   * these from a static list with no clock of its own, and an absent flag
   * simply draws no mark.
   */
  isNew?: boolean;
};

/**
 * One person who came in through the link.
 *
 * ── WHAT THIS ROW CLAIMS, AND WHAT IT USED TO ───────────────────────────────
 *
 * It claims that this person joined Cinch through your link. That is the whole
 * of `invite_arrivals()`: rows whose `profiles.invited_by` is you.
 *
 * It used to claim more. The previous version of this file said the row "opens
 * their closet, because by the time it is drawn you are already friends —
 * `apply_invite` wrote both edges", and the card above it told the reader "You
 * are friends as soon as they sign in." Both were true at the instant somebody
 * arrived and neither stayed true: `invited_by` is written once and never
 * cleared, while the two `follows` edges can be undone by a removal or a block
 * (`on_block_sever_graph` deletes them outright). So the roster outlives the
 * friendship, and a row is not evidence of a current one.
 *
 * The row therefore says a name, a handle and — for two days — that they are
 * new. It opens their profile, where the server decides what a visitor may
 * see. It does not describe the relationship, and it does not promise a closet.
 */
export function ArrivalRow({
  arrival,
  onPress,
  large = false,
}: {
  arrival: ArrivalRowModel;
  onPress?: (userId: string) => void;
  large?: boolean;
}) {
  const theme = useTheme();

  // One sentence, in reading order, with the mark spoken as the word it is.
  // Never "1 new" — there is no count of fresh arrivals anywhere in this page.
  const spoken = [arrival.name, arrival.handle, arrival.isNew ? FRESH_MARK : null]
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={spoken}
      accessibilityHint={onPress ? 'Opens their profile' : undefined}
      onPress={onPress ? () => onPress(arrival.userId) : undefined}
      disabled={!onPress}
      className={arrival.isNew ? 'flex-row items-center bg-blush' : 'flex-row items-center bg-tray'}
      style={{
        minHeight: large ? ROW_HEIGHT_AX : ROW_HEIGHT,
        borderRadius: ROW_RADIUS,
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 12,
        ...(arrival.isNew ? { borderWidth: 1, borderColor: theme.blushRule } : null),
      }}>
      <Avatar
        name={arrival.name}
        size={large ? ROW_AVATAR_AX : ROW_AVATAR}
        tone={arrival.isNew ? 'accent' : 'sand'}
      />

      <View style={{ flex: 1, minWidth: 0 }}>
        {/* The name truncates; the handle does not. A shortened name is still
            the person, where a shortened handle is a different address. */}
        <Text variant="body" numberOfLines={large ? undefined : 1}>
          {arrival.name}
        </Text>
        {arrival.handle ? (
          <Text variant="noteSmall" className="mt-0.5">
            {arrival.handle}
          </Text>
        ) : null}
        {/* At the accessibility sizes the mark leaves the row's end and takes a
            line of its own rather than being dropped. The frame draws the row
            without it there; a mark carried only by the blush ground would be
            colour as the sole carrier of meaning, which is the one way this
            could fail a reader it is specifically for. */}
        {arrival.isNew && large ? (
          <Text variant="note" style={{ color: theme.accent, marginTop: 2 }}>
            {FRESH_MARK}
          </Text>
        ) : null}
      </View>

      {/* A WORD, never a badge and never a number. Hidden from VoiceOver
          because the row's own label already speaks it, and announcing it twice
          is a stutter. */}
      {arrival.isNew && !large ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="items-center justify-center bg-accent"
          style={{
            borderRadius: 12,
            paddingHorizontal: 12,
            minHeight: 32,
            flexShrink: 0,
          }}>
          <Text variant="label" style={{ color: theme.canvas }}>
            {FRESH_MARK}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Kept for the row's own floor, which is the tap target's. */
export const ARRIVAL_ROW_MIN = MIN_TAP_TARGET;
