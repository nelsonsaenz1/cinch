import { SymbolView } from 'expo-symbols';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { AX_FONT_SCALE } from '@/components/today/reaction-spec';
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
  const { fontScale } = useWindowDimensions();
  const ax = fontScale >= AX_FONT_SCALE;
  const doors: Door[] = [
    { key: 'find', label: 'Find people', glyph: 'magnifyingglass', onPress: onFindPeople },
    { key: 'friends', label: 'Your circle', glyph: 'person.2', onPress: onFriends },
    { key: 'invite', label: 'Invite', glyph: 'envelope', onPress: onInvite },
  ];

  /**
   * ── ONE ROW UNTIL A ROW STOPS HOLDING THREE ─────────────────────────────
   *
   * Directive #35: "Explore's action-card labels wrap outside their
   * containers." Three `flex-1` tiles on a 375 pt screen are about 110 pt
   * each; "Find people" at 1.8× is roughly 120 pt of type beside a glyph and a
   * gap, and a `Text` in a flex row with nothing telling it to shrink simply
   * draws past its tile's border. That is the label outside the container the
   * audit saw — not a wrap, an overflow.
   *
   * Above the threshold the row becomes a column: each door full width, its
   * glyph and label leading rather than centred, at the same 44 pt floor.
   * Three full-width rows cost more vertical space than three tiles, and the
   * page below them scrolls, so nothing is lost that the reader needed.
   */
  return (
    <View className={ax ? 'gap-2 px-gutter pt-3' : 'flex-row gap-2 px-gutter pt-3'}>
      {doors.map((door) => (
        <Pressable
          key={door.key}
          accessibilityRole="button"
          accessibilityLabel={door.label}
          onPress={door.onPress}
          style={{ minHeight: MIN_TAP_TARGET }}
          className={`flex-row items-center gap-1.5 rounded-md border border-rule bg-surface active:opacity-70 ${
            ax ? 'px-3 py-2' : 'flex-1 justify-center px-2'
          }`}>
          <SymbolView name={door.glyph as never} size={14} tintColor={theme.ink} resizeMode="scaleAspectFit" />
          {/* `flexShrink` so a label can never draw past its own border, in
              either arrangement. It has room to be whole in both, so nothing
              is expected to wrap — this is the guarantee that it cannot spill
              if a longer word ever lands here. */}
          <Text variant="label" style={{ flexShrink: 1 }}>
            {door.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
