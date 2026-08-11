import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { leading } from '@/theme/font-metrics';

export type ItemStatsProps = {
  wears: number;
  /** Pre-formatted, e.g. "$9.10" — or null when it cannot honestly be computed. */
  costPerWear: string | null;
  /** Pre-formatted, e.g. "6d" or "Never". */
  sinceLast: string;
  /** When true, the middle cell reads as the full price not a per-wear figure. */
  neverWorn?: boolean;
};

/**
 * The 34px serif figure.
 *
 * `statFigure` IS the right variant — Instrument Serif, tabular, ink — but its
 * size token (`figure`) is 28px and the atlas band is 34px. The size is
 * overridden by inline `style` rather than a second `text-*` class because
 * NativeWind gives no guaranteed precedence between two size utilities on one
 * element: `variant="statFigure" className="text-[34px]"` is a coin toss
 * between 28 and 34 at render time. This is the same hazard the retired
 * `StatBox` documented, and the same fix.
 *
 * The lineHeight comes from `leading()`, not from the atlas's `line-height:1`.
 * A browser at line-height 1 simply overflows its box; CoreText instead
 * compresses the line and takes the space off the TOP, slicing the ascenders
 * of a face whose own line box is 1.30. So the band is taller than the HTML —
 * 45px of line where the design draws 34 — and that is the honest trade: the
 * alternative is a serif with its caps shaved flat. (`capTrim` would recover
 * the measure, but it collapses to the CAP height, which is tighter than the
 * atlas rather than looser, and the band's rules would then sit closer to the
 * figures than the design draws them.)
 */
const FIGURE_SIZE = 34;
const FIGURE_STYLE = { fontSize: FIGURE_SIZE, lineHeight: leading('instrument', FIGURE_SIZE, 1) };

/**
 * 9px, not the shared 10px `colophon` size.
 *
 * The atlas sets these three band labels one step smaller than every other
 * colophon in the app, so the override is LOCAL rather than a change to the
 * shared token — exactly the precedent the old `StatBox` set for the same
 * reason. Tracking drops with it (1.2px against colophon's 1.4px): RN maps
 * `letterSpacing` to absolute points, so tracking tuned at 10px is too open
 * at 9.
 */
const LABEL_STYLE = {
  fontSize: 9,
  lineHeight: leading('helvetica', 9, 1.3),
  letterSpacing: 1.2,
  // `alignItems` on the column centres a single line; this centres the SECOND
  // one. "Cost per wear" is the longest of the three labels in the narrowest
  // proportion of the band, so it is the one that wraps first at large Dynamic
  // Type — and a wrapped label whose tail sits left under a centred figure is
  // the crowding §2 exists to prevent, reintroduced by the fix for it.
  textAlign: 'center' as const,
};

/**
 * One cell. `weight` is the atlas's flex ratio — the three figures have very
 * different widths ("38" against "$9.10") and equal thirds would leave the
 * price crowded while the wear count floated in air.
 *
 * The cell is one accessibility node, not two: read separately, VoiceOver
 * announces a bare "38" and then, after a swipe, "wears" — a figure and its
 * unit split across two gestures. `accessible` collapses them into the phrase
 * a person would actually say.
 */
function Cell({
  figure,
  label,
  weight,
  a11yLabel,
}: {
  figure: string;
  label: string;
  weight: number;
  a11yLabel: string;
}) {
  return (
    // `alignItems: 'center'`, per §2.2 of the Refacing: both lines centre in an
    // equal-width figure-over-label column. The per-column `weight` below is
    // untouched — the widths exist so "$9.10" is not crowded by "38", and
    // centring inside them is what the correction asks for, not equal thirds.
    <View
      style={{ flex: weight, alignItems: 'center' }}
      accessible
      accessibilityRole="text"
      accessibilityLabel={a11yLabel}>
      <Text variant="statFigure" style={[FIGURE_STYLE, { textAlign: 'center' }]}>
        {figure}
      </Text>
      <Text variant="colophon" className="mt-1" style={LABEL_STYLE}>
        {label}
      </Text>
    </View>
  );
}

/**
 * The three-figure band — I-01's rule-bounded row of wears, cost per wear and
 * days since.
 *
 * This replaces the 2×2 stat grid. "Paid" moved up into the subtitle line,
 * which is the right home for it: a purchase price is a fact about the
 * transaction, not a reading of how the garment is living. What is left is the
 * three figures the atlas describes as "the figures a person actually reads
 * out loud", and three of them fit on one line without a frame.
 *
 * The band is bounded by two rules rather than boxed, so it reads as a ruled
 * band of a page and not as a card sitting on one — the surrounding sections
 * are already plates, and a fourth container here would make the page a stack
 * of boxes.
 *
 * LAYOUT CONTRACT: this component carries its own `mx-gutter`. It expects a
 * full-bleed parent (a scroll container with NO horizontal padding), which the
 * rebuilt page needs anyway for the co-wear rail to bleed off the right edge.
 *
 * Purely presentational: every figure arrives pre-formatted. Currency
 * formatting, the days-since arithmetic and the "can this even be computed"
 * question all belong to the caller, which is the only layer that knows the
 * user's locale and what the item actually is.
 */
export function ItemStats({ wears, costPerWear, sinceLast, neverWorn = false }: ItemStatsProps) {
  // A per-wear figure on the day something arrives is arithmetically true and
  // reads like an accusation — the price divided by one wear is just the price,
  // dressed up as a judgement. So the label changes rather than the figure:
  // the caller passes the full price through `costPerWear` when `neverWorn`,
  // and this cell stops calling it a rate. Carried forward from the page's
  // previous stat grid, where the same argument was already settled.
  const middleLabel = neverWorn ? 'Not worn yet' : 'Cost per wear';
  // An em dash, not "$0.00" or "N/A": the figure is unknown, and a dash is how
  // a printed table says so.
  const middleFigure = costPerWear ?? '—';

  return (
    <View className="mx-gutter flex-row border-y border-rule py-[14px]">
      <Cell
        figure={String(wears)}
        label="Wears"
        weight={1}
        a11yLabel={`${wears} ${wears === 1 ? 'wear' : 'wears'}`}
      />
      <Cell
        figure={middleFigure}
        label={middleLabel}
        weight={1.4}
        a11yLabel={
          costPerWear === null
            ? 'Cost per wear, not known yet'
            : neverWorn
              ? `${costPerWear}, not worn yet`
              : `${costPerWear} per wear`
        }
      />
      <Cell
        figure={sinceLast}
        label="Since last"
        weight={1.1}
        a11yLabel={`Since last worn, ${sinceLast}`}
      />
    </View>
  );
}
