import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * The page signing off — the day's one door to the social loop.
 *
 * IV-01 is live and permanent, and until this line existed it was reachable
 * only from `friends/index.tsx`, a screen a new member has no reason to open.
 * So the loop had no door on the app's most-visited page.
 *
 * IT IS A COLOPHON, NOT A BANNER. No card, no tray fill, no illustration, no
 * count of anything — and ink, never accent, because the frame's one oxblood
 * belongs to the plate's wear action. A drawn button here would read as a
 * prompt; a line at the foot of the scroll reads as the page ending.
 *
 * The caller decides when: only at the foot of a day that actually worked (see
 * the render condition in `(tabs)/index.tsx`), never over a refusal, an
 * offline notice or the empty-closet floor.
 *
 * Wraps rather than truncates — at AX sizes the link drops under the sentence
 * instead of pushing it off the gutter.
 */
export function InviteLine({ onInvite }: { onInvite: () => void }) {
  const theme = useTheme();

  return (
    <View className="flex-row flex-wrap items-center" style={{ columnGap: 10 }}>
      <Text variant="note" style={{ flexShrink: 1 }}>
        Better with the people you dress with.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Invite a friend"
        onPress={onInvite}
        hitSlop={8}
        style={{ minHeight: MIN_TAP_TARGET }}
        className="justify-center active:opacity-60">
        <Text variant="label" className="underline" style={{ color: theme.ink }}>
          Invite a friend
        </Text>
      </Pressable>
    </View>
  );
}
