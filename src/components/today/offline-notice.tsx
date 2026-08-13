import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * T-09's notice — offline, and honest about which part may be wrong.
 *
 * The atlas's sentence is "This is yesterday's look, saved on the phone.
 * Today's weather is not in it." The first half of that is not true of this
 * app: nothing caches a rendered plate. What happens offline is that the local
 * engine builds a look NOW, from the closet React Query has persisted, with no
 * forecast to score against. So the sentence names that instead — same shape,
 * same admission, and the part that may be wrong is identified either way.
 *
 * Extracted so the shipping screen and the `dev-w3-g2-t09` fixture render the
 * same component rather than two copies of one paragraph.
 */
export function OfflineNotice({ onRetry }: { onRetry: () => void }) {
  const theme = useTheme();

  return (
    <View className="mx-gutter mt-3 rounded-md bg-tray p-3.5" accessibilityLiveRegion="polite">
      <Text variant="label">
        No connection
      </Text>
      <Text variant="note" className="mt-1">
        This look was built on your phone from your saved closet. Today&rsquo;s weather is not in
        it — that is the part that may be wrong.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Try again"
        onPress={onRetry}
        style={{ minHeight: MIN_TAP_TARGET, minWidth: 76 }}
        className="mt-2.5 items-center justify-center self-start rounded-md border border-rule px-3 active:opacity-70">
        <Text variant="label" style={{ color: theme.ink }}>
          Try again
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * The sentence that stands where the offline reactions would be.
 *
 * One string, exported, because it is a CLAIM about behaviour and the two
 * places that print it must never drift: there is no write queue on this
 * screen, so nothing may promise that a tap is held and sent later.
 */
export const OFFLINE_ACTIONS_REASON =
  'Reactions and marking a look worn both need a connection. Nothing is queued — they will be here when you are back.';
