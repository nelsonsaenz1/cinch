import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/tokens';

/**
 * I-04 — "This piece is gone" (Item Detail State Atlas).
 *
 * Reached from a stale link, a shared outfit, or a second device that deleted
 * the piece while this one still had the route. It is not an error and must not
 * be dressed as one: nothing failed, the thing simply is not there any more. So
 * the screen names both plausible causes, says what survived, and offers
 * storage as the first place to look.
 *
 * WHY THE ATLAS COPY IS NOT FOLLOWED VERBATIM. The mock reads "It was deleted
 * on 2 Aug, or moved to storage from another device." We cannot know that date
 * and must not print one. Removal here is a hard delete — the row is gone, no
 * tombstone is written, and there is no deletion timestamp anywhere to read. A
 * date in this sentence would have to be invented, and an invented fact in the
 * one place a person is trying to work out what happened to her own wardrobe is
 * worse than a vaguer true sentence. The atlas's real structure — two plausible
 * causes, then the reassurance — is kept intact; only the fabricated date is
 * dropped. Do not "fix" this back to matching the mock.
 *
 * Not built on `ui/empty-state.tsx`, though this is unmistakably an empty
 * state. That component is hard-left on the gutter with an SF Symbol glyph and
 * takes exactly one action; this frame is a centred column with a dashed
 * garment-shaped ghost and two stacked buttons. Bending EmptyState to cover
 * both would mean three new props that no other caller wants, and its docblock
 * argues its left-set composition on purpose. The dashed ghost instead borrows
 * the app's established ghost-placeholder treatment from
 * `closet/ghost-slot-grid.tsx`: tray fill, dashed `rule` border.
 *
 * COMPOSITION CONTRACT: the screen wraps this in its own
 * `SafeAreaView edges={['top']}`, as every other branch of the item route
 * already does. No inset is read here.
 */

/** Atlas: the ghost stands in for a garment card — 120×150 at 12pt radius. */
const GHOST = { width: 120, height: 150 };

export type ItemMissingProps = {
  onBack: () => void;
  onBackToCloset: () => void;
  onCheckStorage: () => void;
};

export function ItemMissing({ onBack, onBackToCloset, onCheckStorage }: ItemMissingProps) {
  const theme = useTheme();

  return (
    <View className="flex-1 bg-canvas">
      <ScreenHeader title="Item" align="leading" onBack={onBack} />

      {/* Lifted slightly off centre — 60pt of bottom padding — so the column
          sits where the eye lands rather than in the geometric middle of the
          screen. Straight from the frame. */}
      <View
        accessibilityRole="summary"
        className="flex-1 items-center justify-center"
        style={{ paddingHorizontal: 34, paddingBottom: 60 }}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="rounded-md bg-tray"
          style={{
            width: GHOST.width,
            height: GHOST.height,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: theme.rule,
          }}
        />

        <Text variant="title" trim className="text-center" style={{ marginTop: 26 }}>
          This piece is gone
        </Text>

        {/* Tone as an inline style, never a second `text-*` class: `callout`
            already carries `text-ink`, and NativeWind gives no guaranteed
            precedence between two colour utilities on one element. The 280pt
            measure is the atlas's — three short lines, not a full-width block. */}
        <Text
          variant="callout"
          className="mt-3 text-center"
          style={{ color: theme.muted, maxWidth: 280 }}>
          It was deleted, or moved to storage from another device. Outfits that used it still show
          it as a past wear.
        </Text>

        {/* Ink, not oxblood — the way out of an empty state is an ink fill
            app-wide, and the screen's accent stays unspent. `Button`'s 44pt
            floor is exactly the atlas's height, so neither is overridden. */}
        <View className="w-full gap-2.5" style={{ marginTop: 26, maxWidth: 260 }}>
          <Button
            title="Back to closet"
            variant="ink"
            accessibilityLabel="Back to closet"
            accessibilityHint="Returns to your closet grid."
            onPress={onBackToCloset}
          />
          <Button
            title="Check storage"
            variant="secondary"
            accessibilityLabel="Check storage"
            accessibilityHint="Shows the pieces you have moved out of rotation."
            onPress={onCheckStorage}
          />
        </View>
      </View>
    </View>
  );
}
