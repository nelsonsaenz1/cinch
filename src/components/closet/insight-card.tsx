import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/tokens';

export type InsightCardProps = {
  /** Pieces worn this year — the caller computes "this year" (wearCount > 0 and lastWornAt within the current year). */
  worn: number;
  /** All pieces. The caller hides the card entirely when the closet is empty. */
  total: number;
  /** Pieces never worn at all — drives the footer's nudge. */
  unworn: number;
};

/**
 * The worn-this-year card — C-01's one editorial aside. Tray ground, an ink
 * progress bar (spec §7's own recipe — ink fill over ink-at-10% track — not
 * the shared `ProgressTrack`, which means "task in flight" in accent), and a
 * footer that either nudges toward the unworn pieces or, when there are none,
 * says so warmly.
 */
export function InsightCard({ worn, total, unworn }: InsightCardProps) {
  const theme = useTheme();
  const pct = total > 0 ? Math.round((Math.min(worn, total) / total) * 100) : 0;

  const footer =
    unworn === 0
      ? 'Every piece has earned its place this year.'
      : unworn === 1
        ? '1 piece has never left the rail. Worth a look before you buy anything else.'
        : `${unworn} pieces have never left the rail. Worth a look before you buy anything else.`;

  return (
    <View
      accessible
      accessibilityLabel={`${worn} of ${total} pieces worn this year, ${pct} percent. ${footer}`}
      className="rounded-[14px] bg-tray dark:bg-tray-dark"
      style={{ paddingVertical: 13, paddingHorizontal: 14 }}>
      <View className="flex-row items-baseline justify-between gap-2.5">
        {/* 13/600: `label` is 13pt and font-medium resolves to
            HelveticaNeue-Medium — the face the design's "600" maps to. */}
        <Text variant="label" numberOfLines={1} className="shrink text-ink dark:text-ink-dark">
          {`${worn} of ${total} pieces worn this year`}
        </Text>
        <Text variant="caption">{`${pct}%`}</Text>
      </View>

      {/* The bar. Track is ink at 10% (token + alpha suffix, not a new hex) so
          it reads as a groove in the tray rather than a second colour. */}
      <View
        className="mt-[9px] h-[6px] overflow-hidden rounded-[3px]"
        style={{ backgroundColor: `${theme.ink}1A` }}>
        <View className="h-full bg-ink dark:bg-ink-dark" style={{ width: `${pct}%` }} />
      </View>

      {/* 12pt sits between `label` and `caption`; set inline on the caption
          variant rather than minting a fourth small size for one sentence. */}
      <Text variant="caption" className="mt-2" style={{ fontSize: 12, lineHeight: 17 }}>
        {footer}
      </Text>
    </View>
  );
}
