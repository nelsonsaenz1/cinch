import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { EventMember } from '@/features/events/types';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/** "DK" from "Dana Kim", "DA" from "dana" alone. Never empty, never throws. */
function initialsFor(member: EventMember, isSelf: boolean): string {
  if (isSelf) return 'ME';
  const name = member.displayName ?? member.username ?? '';
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1] ?? '') : '';
  const letters = last ? `${first[0] ?? ''}${last[0] ?? ''}` : first.slice(0, 2);
  return (letters || '?').toUpperCase();
}

/**
 * One line of the guest list: initials chip, name, state — and, for the host
 * looking at an attendee, the quiet remove affordance.
 *
 * States render by the product's silence rules: `joined` says nothing (being
 * on the list is the statement), `invited` reads "Still deciding" — a state,
 * not a deficiency — and `declined` never reaches this component at all
 * (the roster query refuses to fetch it).
 */
export function RosterRow({
  member,
  isSelf,
  onRemove,
  isLast,
}: {
  member: EventMember;
  isSelf: boolean;
  /** Host-only. Rendered as a quiet text action; confirm before calling. */
  onRemove?: () => void;
  /** Suppresses the bottom hairline on the last row of the list. */
  isLast?: boolean;
}) {
  const theme = useTheme();

  const name = isSelf ? 'You' : (member.displayName ?? member.username ?? 'A guest');
  const standing =
    member.role === 'host' ? 'Hosting' : member.state === 'invited' ? 'Still deciding' : null;

  return (
    <View
      accessibilityLabel={[name, standing].filter(Boolean).join(', ')}
      style={{ minHeight: MIN_TAP_TARGET }}
      className={[
        'flex-row items-center gap-3 py-2.5',
        isLast ? '' : 'border-b border-hairline dark:border-hairline-dark',
      ].join(' ')}>
      <View className="h-8 w-8 items-center justify-center rounded-full bg-sand">
        <Text variant="caption" style={{ color: theme.ink }}>
          {initialsFor(member, isSelf)}
        </Text>
      </View>

      <View className="flex-1">
        <Text variant="body" numberOfLines={1}>
          {name}
        </Text>
        {member.username && member.displayName && !isSelf ? (
          <Text variant="caption" className="text-faint dark:text-faint-dark" numberOfLines={1}>
            @{member.username}
          </Text>
        ) : null}
      </View>

      {standing ? (
        <Text variant="label" className="text-faint dark:text-faint-dark">
          {standing}
        </Text>
      ) : null}

      {onRemove ? (
        <Pressable
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${name}`}
          hitSlop={8}
          style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
          className="active:opacity-60">
          <Text variant="label" className="text-muted dark:text-muted-dark">
            Remove
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
