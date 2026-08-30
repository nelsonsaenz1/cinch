import { SymbolView } from 'expo-symbols';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * The features, actively visible — founder order 2026-08-30.
 *
 * Explore's social doors used to live one tap down, behind the ellipsis
 * sheet; the sheet stays (it is the management surface), but the three
 * things a visitor most often came to DO now stand on the page: find
 * someone, see your circle, bring a friend in. One row, three quiet tiles,
 * the closet chip-row's register — not a second tab bar.
 */

type Door = { key: string; label: string; glyph: string; onPress: () => void };

export function ExploreDoors({
  onFindPeople,
  onFriends,
  onInvite,
}: {
  onFindPeople: () => void;
  onFriends: () => void;
  onInvite: () => void;
}) {
  const theme = useTheme();
  const doors: Door[] = [
    { key: 'find', label: 'Find people', glyph: 'magnifyingglass', onPress: onFindPeople },
    { key: 'friends', label: 'Your circle', glyph: 'person.2', onPress: onFriends },
    { key: 'invite', label: 'Invite', glyph: 'envelope', onPress: onInvite },
  ];

  return (
    <View className="flex-row gap-2 px-gutter pt-3">
      {doors.map((door) => (
        <Pressable
          key={door.key}
          accessibilityRole="button"
          accessibilityLabel={door.label}
          onPress={door.onPress}
          style={{ minHeight: MIN_TAP_TARGET }}
          className="flex-1 flex-row items-center justify-center gap-1.5 rounded-md border border-rule bg-surface px-2 active:opacity-70">
          <SymbolView name={door.glyph as never} size={14} tintColor={theme.ink} resizeMode="scaleAspectFit" />
          <Text variant="label">{door.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
