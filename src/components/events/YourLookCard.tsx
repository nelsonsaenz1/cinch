import { View, useWindowDimensions } from 'react-native';

import { LookPlate, type ResolveImage } from '@/components/look/look-plate';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { lookActionsStacked, lookTextMaxLines } from '@/features/events/detail-layout';
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
  const { fontScale } = useWindowDimensions();
  // Two large-type decisions, both in `detail-layout.ts` so they are callable:
  // how many lines the look's own words may take, and whether the two actions
  // still fit on one row.
  const maxLines = lookTextMaxLines(fontScale);
  const stacked = lookActionsStacked(fontScale);

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
          {/* Two lines, not one. A caption the wearer typed is the look's
              name, and at AX3 a one-line clamp turns it into an ellipsis on a
              card whose whole job is to show what they chose. The same
              sentence is why the clamp lifts entirely at the accessibility
              sizes, where two lines is the new one line. */}
          <Text variant="plate" numberOfLines={maxLines} className="mt-3">
            {lookName(leading.garments, leading.caption)}
          </Text>
          <Text variant="label" numberOfLines={maxLines} className="mt-1">
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
        // Side by side while two labels fit one measure; stacked above the
        // app's one stacking threshold, where each gets the full width and
        // wraps inside its own pill instead of past it. Swap still precedes
        // share — the order is the hierarchy, and type size does not change it.
        <View className={`mt-4 gap-2 ${stacked ? '' : 'flex-row'}`}>
          {leading ? (
            <Button
              title="Swap a piece"
              variant="secondary"
              haptic
              onPress={onSwap}
              className={stacked ? '' : 'flex-1'}
            />
          ) : null}
          <Button
            title={leading ? 'Share another' : 'Share with group'}
            variant="secondary"
            haptic
            onPress={onShare}
            className={stacked ? '' : 'flex-1'}
          />
        </View>
      ) : null}
    </View>
  );
}
