import { useWindowDimensions, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { leading } from '@/theme/font-metrics';
import { MAX_DISPLAY_SCALE, MAX_TEXT_SCALE } from '@/theme/type-scale';

export type StatRowProps = {
  pieces: number;
  /** Undefined while the outfits query is in flight — rendered as an em dash, never a zero the data didn't say. */
  outfits: number | undefined;
  unworn: number;
  /** Undefined while the follower query is in flight — same em-dash rule. */
  followers: number | undefined;
  /**
   * Let the figures and their labels grow their own line boxes with Dynamic
   * Type — CI-03's "stats must become readable" at accessibility sizes.
   *
   * OPT-IN, AND DEFAULT OFF ON PURPOSE. At scale 1 the two paths are identical
   * to the pixel, so this changes nothing for anybody at a standard setting.
   * Above it they differ, and the callers that do not pass it — C-01's masthead
   * on a closet with pieces in it — are outside this packet's scope and must
   * not move. See the note on `LINE_BOX` for what is actually wrong there.
   */
  growWithType?: boolean;
};

/**
 * The line boxes the two lines need, and the defect they exist to close.
 *
 * `plate` and `colophon` carry NUMERIC line heights — the serif figure's from
 * the font metrics, the label's hand-written at 12 below. React Native scales
 * `fontSize` with Dynamic Type and leaves an explicit `lineHeight` exactly
 * where it found it, so at accessibility sizes a 34pt glyph is drawn inside a
 * 26pt box and the figure is sliced off at both ends. `trim` compounds it: its
 * negative margins are computed for the variant's own 24px and subtract the
 * same amount from a box that is now much taller.
 *
 * That defect is not new and is not confined to this component — it is the same
 * one the first-ten chooser was corrected for, and it is live wherever a
 * variant's numeric leading meets a large setting. What is new is that CI-03
 * refuses it on the zero-piece closet, so `growWithType` closes it there.
 */
const LINE_BOX = {
  /** `plate` → `text-plate`, the 24pt Instrument Serif figure. */
  figure: leading('instrument', 24, 1.08),
  /** The label's own hand-set box, below. */
  label: 12,
} as const;

/** One column: serif 24pt figure over a 9pt tracked uppercase label. */
function Stat({
  figure,
  label,
  accent = false,
  grow = false,
}: {
  figure: number | undefined;
  label: string;
  accent?: boolean;
  /** See `growWithType`. */
  grow?: boolean;
}) {
  const { fontScale } = useWindowDimensions();
  // Capped per role, matching the ceilings `Text` applies to each variant: the
  // serif figure is display type at 1.4, the tracked label is text at 1.8.
  // Capping a box with a different number than the glyph inside it would
  // reintroduce the overflow from the other side.
  const figureBox = Math.round(LINE_BOX.figure * Math.min(fontScale, MAX_DISPLAY_SCALE));
  const labelBox = Math.round(LINE_BOX.label * Math.min(fontScale, MAX_TEXT_SCALE));
  // Above the standard range a tracked word in a quarter of the measure needs
  // the second line more than it needs to stay on one.
  const labelLines = grow && fontScale > 1.35 ? 2 : 1;

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
          label, the way the atlas draws it at line-height 1.

          Under `grow`, `trim` comes OFF rather than being recomputed: its
          margins are a fixed table keyed by variant, and the right answer at a
          scaled size is a scaled line box, not a scaled subtraction from an
          unscaled one. The figure sits a hair looser over its label at
          accessibility sizes, and it is legible. */}
      <Text
        variant="plate"
        trim={!grow}
        className={accent ? 'text-accent' : ''}
        style={grow ? { lineHeight: figureBox } : undefined}>
        {figure ?? '—'}
      </Text>
      <Text
        variant="colophon"
        numberOfLines={labelLines}
        style={{
          fontSize: 9,
          letterSpacing: 1.2,
          lineHeight: grow ? labelBox : 12,
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
export function StatRow({
  pieces,
  outfits,
  unworn,
  followers,
  growWithType = false,
}: StatRowProps) {
  return (
    // `items-start` only under `grow`, so a two-line label under one column
    // cannot stretch the other three into matching it. The default path keeps
    // the stretch it has always had — at one line per label the two are
    // indistinguishable, and this component has callers outside this packet.
    <View
      className={`flex-row border-b border-t border-rule py-[12px] ${growWithType ? 'items-start' : ''}`}>
      <Stat figure={pieces} label="Pieces" grow={growWithType} />
      <Stat figure={outfits} label="Outfits" grow={growWithType} />
      <Stat figure={unworn} label="Unworn" accent grow={growWithType} />
      <Stat figure={followers} label="Friends" grow={growWithType} />
    </View>
  );
}
