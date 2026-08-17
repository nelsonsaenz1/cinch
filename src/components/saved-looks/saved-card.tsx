import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { View } from 'react-native';

import { PressableSurface } from '@/components/ui/pressable-surface';
import { Text } from '@/components/ui/text';
import {
  NO_IMAGE,
  OFFLINE,
  UNAVAILABLE,
  cardAccessibilityLabel,
} from '@/features/saved-looks/copy';
import type { SavedLook } from '@/features/saved-looks/types';
import { useTheme } from '@/theme/tokens';

/**
 * OS-03's card, and its three variants — image, no image, unavailable.
 *
 * ── THE THREE ARE ONE COMPONENT, DELIBERATELY ──────────────────────────────
 *
 * They differ in one region: the well above the title. Everything below it — the
 * title, the provenance line, the touch target, the spoken label — is identical
 * and has to stay identical, because the three appear side by side in a
 * two-column grid and a card whose text sits at a different height reads as
 * broken rather than as different.
 *
 * ── NO VARIANT HERE IS AN ERROR STATE ──────────────────────────────────────
 *
 * "No image saved" is CONTENT: an event look posted without a photograph never
 * had one, and the card is showing what was kept. "Unavailable" is somebody
 * else's ordinary decision. Neither draws a warning glyph, neither is red, and
 * neither apologises. The one failure variant in this file is "Image not
 * synced", which is OS-09b's offline case and says exactly that — telling
 * somebody "No image saved" when the truth is "we could not fetch it" is
 * telling them a thing was lost.
 *
 * ── AND NO MEANING IS CARRIED BY COLOUR ────────────────────────────────────
 *
 * The unavailable tile is a dashed well with the WORD "Unavailable" in it, and
 * the word is prepended to the spoken label besides. A merely dimmed card would
 * be a card whose only difference is invisible to half the people who need it.
 */

export type SavedCardProps = {
  save: SavedLook;
  /** "4d", "1w" — built by the caller from `savedAt`. */
  savedAgo: string;
  onPress: () => void;
  /**
   * The device believes it has no connection, so a missing image is a sync
   * problem rather than an absence. `No image saved` is permanent and
   * `Image not synced` will resolve itself; the two must not be swapped.
   */
  offline?: boolean;
  /**
   * One column instead of two — OS-10b. The composition changes at
   * `AX_STACK_SCALE`, and the card is TOLD rather than measuring, so the grid
   * and the card can never disagree about which layout they are in.
   */
  stacked?: boolean;
};

export function SavedCard({
  save,
  savedAgo,
  onPress,
  offline = false,
  stacked = false,
}: SavedCardProps) {
  return (
    <PressableSurface
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={cardAccessibilityLabel({
        title: save.title,
        sourceLabel: save.sourceLabel,
        savedAgo,
        availability: save.availability,
      })}
      // `fill`: the well alone is 168pt at two columns and taller stacked, so
      // the 44pt floor is met by geometry. A `minHeight` on a grid cell is dead
      // weight, and `hitSlop` on one would overlap its neighbour.
      fill
      className={stacked ? 'rounded-plate border border-sand bg-surface p-3' : 'flex-1'}
      // The arrangement lives here rather than in `className` — the animated
      // layer is a real layout box between the Pressable and its children, and
      // a `flex-row` class on the outside would arrange one child instead of two.
      contentStyle={
        stacked
          ? { flexDirection: 'row', alignItems: 'center', gap: 14 }
          : { flex: 1, gap: 8 }
      }>
      <Well save={save} offline={offline} stacked={stacked} />

      <View style={stacked ? { flex: 1, gap: 4 } : { gap: 4 }}>
        {/*
          No `numberOfLines` anywhere below. OS-03 draws a deliberately long
          title — "Charcoal wide-leg trouser with the oversized ecru blazer and
          gold hoops" — and §9's rule is that nothing is clipped or truncated at
          any type size. The card grows; the grid row grows with it.
        */}
        <Text variant="label" className={save.availability === 'unavailable' ? 'text-muted' : ''}>
          {save.title?.trim() || 'Untitled look'}
        </Text>
        <Text variant="caption" className="text-muted">
          {save.sourceLabel} · {savedAgo}
        </Text>
      </View>
    </PressableSurface>
  );
}

/**
 * The well. Three things it can be, and the order of the branches is the design:
 * unavailable outranks a missing image, because a card whose source is gone is
 * not a card with a photography problem.
 */
function Well({
  save,
  offline,
  stacked,
}: {
  save: SavedLook;
  offline: boolean;
  stacked: boolean;
}) {
  const theme = useTheme();
  // 3:4 in the grid; a fixed lead in the stacked row, where the text is what
  // grows and an aspect-ratio well would push the title off the screen.
  const shape = stacked ? 'w-[70px] h-[88px]' : 'w-full aspect-[3/4]';

  if (save.availability === 'unavailable') {
    return (
      <View
        className={`${shape} items-center justify-center gap-2 rounded-plate border border-dashed border-sand bg-tray`}>
        <SymbolView name="eye.slash" size={22} tintColor={theme.faint} />
        <Text variant="noteSmall" className="text-muted">
          {UNAVAILABLE.gridTag}
        </Text>
      </View>
    );
  }

  if (!save.imageUrl) {
    return (
      <View
        className={`${shape} items-center justify-center gap-2 rounded-plate border border-sand bg-tray`}>
        <SymbolView name="photo" size={22} tintColor={theme.faint} />
        <Text variant="noteSmall" className="text-muted">
          {offline ? OFFLINE.imageNotSynced : NO_IMAGE}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: save.imageUrl }}
      // `accessible={false}`: the card already speaks one composed sentence, and
      // an image with its own label would make VoiceOver stop twice on one thing.
      accessible={false}
      contentFit="cover"
      transition={0}
      className={`${shape} rounded-plate bg-tray`}
    />
  );
}
