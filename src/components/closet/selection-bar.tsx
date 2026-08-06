import { ActivityIndicator, Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

export type SelectionBarProps = {
  /** How many pieces are picked. Zero is a real state — everything can be unpicked. */
  count: number;
  /** True while the removal is in flight; both controls go inert. */
  busy?: boolean;
  onCancel: () => void;
  onRemove: () => void;
};

/**
 * The closet's selection header — Cancel, the count, and Remove.
 *
 * PINNED above the grid rather than folded into the closet's own masthead, and
 * that is the whole reason this is a separate component. The masthead rides in
 * the FlashList's `ListHeaderComponent` (it scrolls away with the identity
 * page, per 03a), so a Remove control placed there would be somewhere up the
 * page — invisible at the exact moment a long press two hundred rows down
 * creates a selection. A destructive control the user cannot find is worse
 * than no bulk removal at all.
 *
 * Top rather than bottom: the tab bar owns the bottom edge, and a floating bar
 * over it either covers the tabs or sits at an arbitrary height above them.
 *
 * Remove reads its own count ("Remove 3"), because the confirmation that
 * follows is about a number the user has to already believe — a bare "Remove"
 * over a scrolled-away selection is how people delete four things meaning two.
 */
export function SelectionBar({ count, busy = false, onCancel, onRemove }: SelectionBarProps) {
  const theme = useTheme();
  const nothingPicked = count === 0;

  return (
    <View className="flex-row items-center justify-between border-b border-hairline px-gutter py-2">
      <Pressable
        onPress={onCancel}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Cancel selection"
        hitSlop={8}
        style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
        className="active:opacity-60">
        <Text variant="label" className="text-ink">
          Cancel
        </Text>
      </Pressable>

      {/* The count in the serif, small — the same "a number is a fact" idiom
          the profile stats use, at label size so it never outweighs the two
          controls it sits between. */}
      <Text variant="label" className="text-muted" accessibilityLiveRegion="polite">
        {nothingPicked ? 'Select pieces' : `${count} selected`}
      </Text>

      <Pressable
        onPress={onRemove}
        disabled={busy || nothingPicked}
        accessibilityRole="button"
        accessibilityLabel={nothingPicked ? 'Remove' : `Remove ${count}`}
        accessibilityState={{ disabled: busy || nothingPicked, busy }}
        hitSlop={8}
        style={{ minHeight: MIN_TAP_TARGET, justifyContent: 'center' }}
        className="active:opacity-60">
        {busy ? (
          <ActivityIndicator size="small" color={theme.accent} />
        ) : (
          // Dimmed rather than hidden when nothing is picked: the control is
          // what explains why the mode exists, and a header that changes shape
          // as you tick the first piece reads as a glitch.
          <Text variant="label" className={nothingPicked ? 'text-accent opacity-40' : 'text-accent'}>
            {nothingPicked ? 'Remove' : `Remove ${count}`}
          </Text>
        )}
      </Pressable>
    </View>
  );
}
