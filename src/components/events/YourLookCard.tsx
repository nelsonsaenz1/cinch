import { View } from 'react-native';

import { LookPlate, type ResolveImage } from '@/components/look/look-plate';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { lookDescriptor, lookName, pickCountLine } from '@/features/events/look-copy';
import type { Garment } from '@/lib/styling';
import { useTheme } from '@/theme/tokens';

/** The 96pt "card thumb" size event-social-contract.md §1 names for the
 *  composed look — the same object at a size that fits this card. */
const THUMB = 96;

export interface YourLookLeading {
  garments: readonly Garment[];
  caption: string | null;
  votes: number;
}

/**
 * YOUR LOOK — Event Detail State Atlas E-06.
 *
 * The one blush card on the page (event-social-contract.md §2 — "it appears
 * once per page"), its eyebrow the page's one spend of the accent. Three
 * states, one surface:
 *
 *   - nothing shared: one sentence, one action ("Share with group").
 *   - shared, not locked: the plate, the name, the descriptor, the pick
 *     count (only when it is greater than zero — "0 picks" is the cruellest
 *     string in the app), two actions ("Swap a piece" / "Share another").
 *   - locked (the evening started, or the occasion canceled): the same
 *     plate and text as a RECORD — the buttons leave rather than sit there
 *     dimmed, because there is nothing left to change.
 *
 * Consumes `LookPlate` for the composed object rather than re-drawing it —
 * "one object, four sizes, no re-composition anywhere" (event-social-
 * contract.md §1).
 */
export function YourLookCard({
  leading,
  resolveImage,
  locked,
  onSwap,
  onShare,
}: {
  /** The viewer's pick-leading look, or null when they have shared nothing. */
  leading: YourLookLeading | null;
  resolveImage: ResolveImage;
  /** Board locked — the card is a record, not a control. */
  locked: boolean;
  onSwap: () => void;
  onShare: () => void;
}) {
  const theme = useTheme();

  return (
    <View
      className="rounded-plate p-4"
      style={{ backgroundColor: theme.blush, borderColor: theme.blushRule, borderWidth: 1 }}>
      <Text variant="colophon" style={{ color: theme.accent }}>
        Your look
      </Text>

      {leading ? (
        <>
          <View className="mt-3">
            <LookPlate pieces={leading.garments} width={THUMB} resolveImage={resolveImage} />
          </View>
          <Text variant="plate" numberOfLines={1} className="mt-3">
            {lookName(leading.garments, leading.caption)}
          </Text>
          <Text variant="label" numberOfLines={1} className="mt-1">
            {lookDescriptor(leading.garments)}
          </Text>
          {pickCountLine(leading.votes) ? (
            <Text variant="colophon" className="mt-2">
              {pickCountLine(leading.votes)}
            </Text>
          ) : null}
        </>
      ) : (
        // E-06's empty state: one sentence, no second headline above it — the
        // atlas prints nothing between the eyebrow and this line.
        <Text variant="body" className="mt-3" style={{ color: theme.muted }}>
          Nothing shared yet — pick a look from your closet and let the table weigh in.
        </Text>
      )}

      {!locked ? (
        <View className="mt-4 flex-row gap-2">
          {leading ? (
            <Button title="Swap a piece" variant="secondary" haptic onPress={onSwap} className="flex-1" />
          ) : null}
          <Button
            title={leading ? 'Share another' : 'Share with group'}
            variant="secondary"
            haptic
            onPress={onShare}
            className="flex-1"
          />
        </View>
      ) : null}
    </View>
  );
}
