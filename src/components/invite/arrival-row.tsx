import { SymbolView } from 'expo-symbols';
import { Pressable, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Text } from '@/components/ui/text';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

export type ArrivalRowModel = {
  userId: string;
  name: string;
  /** "Arrived yesterday", or null when the timestamp is missing. */
  subtitle: string | null;
};

/**
 * One person who came in through the link.
 *
 * Not `ProfileRow`: that row takes a `SocialProfile`, and this list comes from
 * a definer RPC that returns four columns and no avatar — hydrating a whole
 * social profile per row to reuse a component would be a round trip bought for
 * a type. The grammar is the same on purpose (disc, name, quiet line).
 *
 * The row opens their closet, because by the time it is drawn you are already
 * friends — `apply_invite` wrote both edges. That is a door, not a nudge: there
 * is nothing here to chase, no "remind" and no state to act on.
 */
export function ArrivalRow({
  arrival,
  onPress,
  isLast,
}: {
  arrival: ArrivalRowModel;
  onPress?: (userId: string) => void;
  isLast: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={[arrival.name, arrival.subtitle].filter(Boolean).join(', ')}
      onPress={onPress ? () => onPress(arrival.userId) : undefined}
      disabled={!onPress}
      style={{ minHeight: MIN_TAP_TARGET }}
      className={`flex-row items-center gap-3 px-4 py-3.5 active:opacity-60 ${
        isLast ? '' : 'border-b border-hairline'
      }`}>
      <Avatar name={arrival.name} size={34} tone="sand" />

      <View className="flex-1">
        <Text variant="body" numberOfLines={1}>
          {arrival.name}
        </Text>
        {/* `noteSmall`, not `caption`: the atlas sets this line at a regular
            weight and `caption` carries `font-medium`, which would render a
            quiet timestamp as bold grey. In `muted`, not the atlas's #8A8578 —
            3.52:1 is an AA failure. */}
        {arrival.subtitle ? (
          <Text variant="noteSmall" numberOfLines={1} className="mt-0.5">
            {arrival.subtitle}
          </Text>
        ) : null}
      </View>

      {onPress ? (
        <SymbolView
          name="chevron.right"
          size={13}
          tintColor={theme.muted}
          resizeMode="scaleAspectFit"
        />
      ) : null}
    </Pressable>
  );
}
