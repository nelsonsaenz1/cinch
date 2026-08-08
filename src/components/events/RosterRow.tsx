import { View } from 'react-native';

import { Avatar, Button } from '@/components/ui';
import { Text } from '@/components/ui/text';
import type { EventMember } from '@/features/events/types';
import { MIN_TAP_TARGET } from '@/theme/tokens';

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
      <Avatar
        name={isSelf ? null : (member.displayName ?? member.username)}
        size={32}
        fallback={isSelf ? 'ME' : '?'}
      />

      <View className="flex-1">
        <Text variant="body" numberOfLines={1}>
          {name}
        </Text>
        {member.username && member.displayName && !isSelf ? (
          // `caption` already carries `text-muted` — no second `text-*` class
          // stacked on it, and `muted` (not `faint`) is the AA-clean choice
          // for real content (event-social-contract.md §4.1).
          <Text variant="caption" numberOfLines={1}>
            @{member.username}
          </Text>
        ) : null}
      </View>

      {standing ? (
        <Text variant="label">{standing}</Text>
      ) : null}

      {onRemove ? (
        <Button
          title="Remove"
          variant="ghost"
          onPress={onRemove}
          accessibilityLabel={`Remove ${name}`}
          className="px-0"
        />
      ) : null}
    </View>
  );
}
