import { View } from 'react-native';

import { Text } from '@/components/ui/text';

export type StatRowProps = {
  pieces: number;
  /** Undefined while the outfits query is in flight — rendered as an em dash, never a zero the data didn't say. */
  outfits: number | undefined;
  unworn: number;
  /** Undefined while the follower query is in flight — same em-dash rule. */
  followers: number | undefined;
};

/** One column: serif 24pt figure over a 9pt tracked uppercase label. */
function Stat({
  figure,
  label,
  accent = false,
}: {
  figure: number | undefined;
  label: string;
  accent?: boolean;
}) {
  return (
    // One sentence per column for VoiceOver — "11, unworn" reads as a fact,
    // where a bare figure followed later by a bare label reads as noise.
    // `items-center`, per §2.2 of the Refacing: in an equal-width
    // figure-over-label column BOTH lines centre. Left-aligning them made each
    // column's ragged right edge read as a gap between columns, which is the
    // crowding the per-column widths were built to prevent.
    <View
      className="flex-1 items-center"
      accessible
      accessibilityLabel={figure === undefined ? `${label} loading` : `${figure} ${label}`}>
      {/* `plate` is the 24pt serif; `trim` collapses Instrument Serif's tall
          1.30 line box to the cap height so the figure sits tight over its
          label, the way the atlas draws it at line-height 1. */}
      <Text variant="plate" trim className={accent ? 'text-accent' : ''}>
        {figure ?? '—'}
      </Text>
      <Text
        variant="colophon"
        numberOfLines={1}
        style={{
          fontSize: 9,
          letterSpacing: 1.2,
          lineHeight: 12,
          marginTop: 5,
          textAlign: 'center',
        }}>
        {label}
      </Text>
    </View>
  );
}

/**
 * The C-01 stat row — a profile's follower strip, except every number is one
 * Cinch computed. Four equal columns between hairline-weight rules, 12pt of
 * vertical padding.
 *
 * `unworn` is the only figure set in the accent, because it's the one worth
 * acting on. The caller owns visibility (the empty state suppresses the whole
 * row rather than showing four zeroes).
 */
export function StatRow({ pieces, outfits, unworn, followers }: StatRowProps) {
  return (
    <View className="flex-row border-b border-t border-rule py-[12px]">
      <Stat figure={pieces} label="Pieces" />
      <Stat figure={outfits} label="Outfits" />
      <Stat figure={unworn} label="Unworn" accent />
      <Stat figure={followers} label="Followers" />
    </View>
  );
}
