import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

import { occasionInterruptCopy } from './occasion-copy';

/**
 * THE OCCASION INTERRUPT — T-02.
 *
 * Tray, radius 12, above the look it competes with, one action. It costs about
 * 96 pt, which the plate gives back by composing at four pieces on one row
 * rather than six — "the plate is designed to work at three to six pieces, and
 * this is that mechanism doing its job rather than a special case".
 *
 * The interrupt takes the frame's single oxblood while it is on screen, and the
 * plate's wear action falls back to ink (`accent={false}`): one dominant action,
 * one accent, still.
 */
export function OccasionInterrupt({
  occasion,
  now,
  onDress,
}: {
  occasion: {
    title: string;
    venueName?: string | null;
    startsAt: Date | null;
    memberCount: number;
    occasion?: string | null;
  };
  /** "Now", for the eyebrow. Fixed by the fixture routes; live otherwise. */
  now?: Date;
  onDress: () => void;
}) {
  const theme = useTheme();
  const copy = occasionInterruptCopy(occasion, now ?? new Date());

  return (
    <View className="mx-gutter mt-3 rounded-md bg-tray p-3.5">
      <Text variant="eyebrow">{copy.eyebrow}</Text>
      <Text variant="body" className="mt-1.5" numberOfLines={3}>
        {copy.line}
      </Text>
      <Text variant="note" className="mt-1">
        {copy.going ? `${copy.going} ` : ''}
        {copy.body}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.action}
        onPress={onDress}
        style={{ minHeight: MIN_TAP_TARGET }}
        className="mt-3 items-center justify-center rounded-md bg-accent px-4 active:opacity-70">
        <Text variant="label" style={{ color: theme.canvas }}>
          {copy.action}
        </Text>
      </Pressable>
    </View>
  );
}
