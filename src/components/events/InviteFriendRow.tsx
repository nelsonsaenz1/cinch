import { SymbolView } from 'expo-symbols';
import { Pressable, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Text } from '@/components/ui/text';
import type { InviteRow } from '@/features/events/invite-rows';
import { useTheme } from '@/theme/tokens';

/** 64pt including padding — the atlas's own figure: "the target clears 44 in
 *  both directions with room for a thumb arriving off-centre." */
const ROW_HEIGHT = 64;
const CHECK_SIZE = 24;

/**
 * One row of the Invite Friends picker — IF-04's inventory, one component.
 *
 * Ends in exactly one thing: a checkbox when a tap changes something, a word
 * when it does not. Never both, never a greyed control standing in for
 * either — "a greyed control invites a tap that does nothing; a word answers
 * the question the tap would have asked."
 *
 * The whole 64pt row toggles, not the 24px circle (IF-04's "Tap target"
 * note). Selected rows tint blush — event-social-contract.md §2: "Invite
 * Friends | the selected row tint" is where this surface spends its one
 * blush.
 */
export function InviteFriendRow({
  row,
  selected,
  isLast = false,
  onToggle,
}: {
  row: InviteRow;
  selected: boolean;
  isLast?: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const checked = row.selectable && selected;

  // A declined row that can be asked again states the reason on its own
  // line rather than a plain @handle — "re-inviting someone who said no is a
  // decision, so it is spelled out."
  const secondLine =
    row.selectable && row.alreadyInvited
      ? `${row.standing} · ask again`
      : row.username
        ? `@${row.username}`
        : null;

  return (
    <Pressable
      onPress={row.selectable ? onToggle : undefined}
      disabled={!row.selectable}
      accessibilityRole={row.selectable ? 'checkbox' : 'text'}
      accessibilityState={row.selectable ? { checked } : undefined}
      accessibilityLabel={[row.name, row.selectable ? secondLine : row.standing]
        .filter(Boolean)
        .join(', ')}
      style={{ minHeight: ROW_HEIGHT, backgroundColor: checked ? theme.blush : 'transparent' }}
      className={[
        'flex-row items-center gap-3 px-4',
        isLast ? '' : 'border-b border-hairline dark:border-hairline-dark',
        row.selectable ? 'active:opacity-70' : '',
      ].join(' ')}>
      <Avatar name={row.name} size={38} />

      <View className="min-w-0 flex-1">
        <Text
          variant="body"
          numberOfLines={1}
          style={row.alreadyInvited ? { color: theme.muted } : undefined}>
          {row.name}
        </Text>
        {secondLine ? (
          // `caption` already carries `text-muted` — no override needed, and
          // none reaching for `faint`: a handle or a decline reason is real
          // content someone reads, and `faint` is ~3.5:1 on canvas, an AA
          // failure the redesign rules refuse to add another instance of.
          <Text variant="caption" numberOfLines={1} className="mt-0.5">
            {secondLine}
          </Text>
        ) : null}
      </View>

      {row.selectable ? (
        <View
          style={{
            width: CHECK_SIZE,
            height: CHECK_SIZE,
            borderRadius: CHECK_SIZE / 2,
            borderWidth: checked ? 0 : 1.5,
            borderColor: theme.ruleStrong,
            backgroundColor: checked ? theme.ink : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {checked ? (
            <SymbolView
              name="checkmark"
              size={12}
              weight="bold"
              tintColor={theme.canvas}
              resizeMode="scaleAspectFit"
            />
          ) : null}
        </View>
      ) : (
        <Text variant="label" style={{ color: theme.muted }}>
          {row.standing}
        </Text>
      )}
    </Pressable>
  );
}
