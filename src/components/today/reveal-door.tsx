import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { numberWord } from '@/features/onboarding/reveal-copy';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * THE REVEAL DOOR — the interrupt's grammar, spent on the app's own moment.
 *
 * Rendered on Today exactly once per account: a closet that can already
 * generate, belonging to someone the Reveal has never been shown to. That
 * combination used to be impossible — the Reveal was the Ten's finish line —
 * and then the capture and import flows made it the COMMON case: people
 * filled their closet from the tabs and the proof moment, with the
 * `reveal_complete` paywall placement behind it, never fired for anyone
 * (production walk, 2026-08-30).
 *
 * Same tray, same radius, same single-oxblood-action rule as the occasion
 * interrupt above it. The count is the engine's own, passed in from the
 * screen that already computed it — this card does no arithmetic and makes
 * no promise the Reveal will not keep.
 */
export function RevealDoor({ outfitCount, onOpen }: { outfitCount: number; onOpen: () => void }) {
  const theme = useTheme();
  const counted =
    outfitCount > 0
      ? `Your closet already makes ${numberWord(outfitCount)} ${outfitCount === 1 ? 'outfit' : 'outfits'}.`
      : 'Your closet is ready to be counted.';

  return (
    <View className="mx-gutter mt-3 rounded-md bg-tray p-3.5">
      <Text variant="eyebrow">The reveal</Text>
      <Text variant="body" className="mt-1.5">
        {counted}
      </Text>
      <Text variant="note" className="mt-1">
        You never got the moment where Cinch shows you. It takes ten seconds.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="See the reveal"
        onPress={onOpen}
        style={{ minHeight: MIN_TAP_TARGET }}
        className="mt-3 items-center justify-center rounded-md bg-accent px-4 active:opacity-70">
        <Text variant="label" style={{ color: theme.canvas }}>
          See the reveal
        </Text>
      </Pressable>
    </View>
  );
}
