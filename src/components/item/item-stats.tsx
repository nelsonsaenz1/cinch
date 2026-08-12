import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { leading } from '@/theme/font-metrics';

export type ItemStatsProps = {
  wears: number;
  /**
   * Pre-formatted, e.g. "$9.10" — or null when it cannot honestly be computed.
   *
   * NULL REMOVES THE CELL. It does not blank it, dash it, or print zero. See
   * the note on `cells` below.
   */
  costPerWear: string | null;
  /**
   * Pre-formatted, e.g. "6d" — or null when the piece has never been worn or
   * carries no readable date. Null removes the cell, for the same reason.
   */
  sinceLast: string | null;
  /** When true, the middle cell reads as the full price not a per-wear figure. */
  neverWorn?: boolean;
  /**
   * IT-01 / AX — the band's largest-Dynamic-Type composition.
   *
   * "Three centred cells cannot hold three 19 pt labels side by side, so the
   * band changes composition: label left, figure right, one ruled row each,
   * still in the display face."
   *
   * The composition changes; NOTHING SHRINKS. `adjustsFontSizeToFit` is dropped
   * in this mode for exactly that reason — a full-width row has room for the
   * whole figure, so scaling it down would be shrinking type the frame said to
   * grow. Set by the caller off the real `fontScale`, never guessed here.
   */
  stacked?: boolean;
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
 * The atlas sets these band labels one step smaller than every other colophon
 * in the app, so the override is LOCAL rather than a change to the shared
 * token — exactly the precedent the old `StatBox` set for the same reason.
 * Tracking drops with it (1.2px against colophon's 1.4px): RN maps
 * `letterSpacing` to absolute points, so tracking tuned at 10px is too open
 * at 9.
 */
const LABEL_STYLE = {
  fontSize: 9,
  lineHeight: leading('helvetica', 9, 1.3),
  letterSpacing: 1.2,
  // `alignItems` on the column centres a single line; this centres the SECOND
  // one. "A wear" is the shortest of the labels but sits in the widest cell,
  // and "Last worn" is the one that wraps first at large Dynamic Type — a
  // wrapped label whose tail sits left under a centred figure is the crowding
  // §2 exists to prevent, reintroduced by the fix for it.
  textAlign: 'center' as const,
};

/**
 * The cost cell is 1.35× its neighbours, per IT-01.
 *
 * Not decoration: "$14.19" and a four-figure equivalent both have to centre
 * without the rules moving, and equal thirds leave the price crowded while the
 * wear count floats in air. The ratio is the atlas's own number.
 */
const COST_WEIGHT = 1.35;

/**
 * One cell. `weight` is the atlas's flex ratio.
 *
 * The cell is one accessibility node, not two: read separately, VoiceOver
 * announces a bare "38" and then, after a swipe, "wears" — a figure and its
 * unit split across two gestures. `accessible` collapses them into the phrase
 * a person would actually say, and §9 asks for label-then-figure per cell in
 * visual order.
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
    // equal-width figure-over-label column. The per-column `weight` is what
    // keeps "$9.10" from being crowded by "38".
    <View
      style={{ flex: weight, alignItems: 'center' }}
      accessible
      accessibilityRole="text"
      accessibilityLabel={a11yLabel}>
      {/* One line, and shrink to hold it rather than wrap or clip.
          At the largest Dynamic Type "$1,295.00" wrapped mid-number into
          "$1,295.0" over "0" — which reads as two different figures and pushed
          this cell's label out of line with its neighbours. Truncating instead
          would be worse: half a price is a plausible price, and nothing on
          screen would say it was cut. Shrinking keeps the whole number honest,
          and 0.7 is the floor at which 34px is still comfortably larger than
          the 9px label under it. */}
      <Text
        variant="statFigure"
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        style={[FIGURE_STYLE, { textAlign: 'center' }]}>
        {figure}
      </Text>
      <Text variant="colophon" className="mt-1" style={LABEL_STYLE}>
        {label}
      </Text>
    </View>
  );
}

/**
 * The ruled figure band — IT-01's row of wears, cost per wear and last worn.
 *
 * ── WHY A CELL CAN BE ABSENT (audit 65, and refusal 2) ────────────────────
 *
 * This band used to print an em dash when a figure could not be computed, on
 * the argument that a dash is how a printed table says "unknown". The atlas
 * settles it the other way, in two places at once. IT-02's annotation is
 * "Cost cell removed, not blanked", its prose is "there is no empty column, no
 * dash and no '— a wear'", and the constitution's refusal is flat: counts and
 * prices are "printed when known or omitted — never estimated, never a dash."
 *
 * So the cells are BUILT rather than laid out: a figure with nothing behind it
 * produces no column, and the band redistributes across whatever is left. Two
 * cells centre exactly as three do, because the widths are flex weights rather
 * than fixed thirds. A band with nothing to say renders nothing at all —
 * including its rules, since a pair of hairlines around empty space is a
 * blanked band by another route.
 *
 * A never-worn piece prints the WORD "Never" in the wear cell rather than 0.
 * IT-02's reason is worth keeping verbatim: "a 0 in a display face would read
 * as a verdict on the garment."
 *
 * LAYOUT CONTRACT: this component carries its own `mx-gutter`. It expects a
 * full-bleed parent (a scroll container with NO horizontal padding), which the
 * page needs anyway for the co-wear rail to bleed off the right edge.
 *
 * Purely presentational: every figure arrives pre-formatted. Currency
 * formatting, the days-since arithmetic and the "can this even be computed"
 * question all belong to the caller, which is the only layer that knows the
 * user's locale and what the item actually is.
 */
/**
 * IT-01 / AX's row: label left, figure right, one hairline under each.
 *
 * The figure keeps the display face and drops to the frame's 26px — the band is
 * three rows tall now rather than one, and 34px stacked three times pushes the
 * two peer actions under it off the screen the frame is trying to keep them on.
 * The label is 18px prose in the regular cut, per the frame.
 */
function StackedRow({
  figure,
  label,
  a11yLabel,
}: {
  figure: string;
  label: string;
  a11yLabel: string;
}) {
  return (
    <View
      className="flex-row items-baseline justify-between border-b border-rule py-3"
      accessible
      accessibilityRole="text"
      accessibilityLabel={a11yLabel}>
      <Text variant="note" style={{ fontSize: 18, lineHeight: 26 }}>
        {label}
      </Text>
      {/* No `adjustsFontSizeToFit` and no `numberOfLines`: a full-width row has
          the space, and the frame's rule is that height is allowed rather than
          type shrunk. */}
      <Text variant="statFigure" style={{ fontSize: 26, lineHeight: leading('instrument', 26, 1) }}>
        {figure}
      </Text>
    </View>
  );
}

export function ItemStats({
  wears,
  costPerWear,
  sinceLast,
  neverWorn = false,
  stacked = false,
}: ItemStatsProps) {
  const worn = wears > 0;

  const cells: { key: string; figure: string; label: string; weight: number; a11y: string }[] = [];

  cells.push(
    worn
      ? {
          key: 'wears',
          figure: String(wears),
          label: 'Wears',
          weight: 1,
          a11y: `${wears} ${wears === 1 ? 'wear' : 'wears'}`,
        }
      : {
          key: 'wears',
          // The word, not the digit — see the block comment above.
          figure: 'Never',
          label: 'Worn so far',
          weight: 1,
          a11y: 'Never worn',
        },
  );

  if (costPerWear !== null) {
    // A per-wear figure on the day something arrives is arithmetically true and
    // reads like an accusation — the price divided by one wear is just the
    // price, dressed up as a judgement. So the label changes rather than the
    // figure: the caller passes the full price through `costPerWear` when
    // `neverWorn`, and this cell stops calling it a rate.
    cells.push({
      key: 'cost',
      figure: costPerWear,
      label: neverWorn ? 'Paid' : 'A wear',
      weight: COST_WEIGHT,
      a11y: neverWorn ? `${costPerWear} paid, not worn yet` : `${costPerWear} per wear`,
    });
  }

  if (sinceLast !== null) {
    cells.push({
      key: 'since',
      figure: sinceLast,
      label: 'Last worn',
      weight: 1.1,
      a11y: `Last worn, ${sinceLast}`,
    });
  }

  if (cells.length === 0) return null;

  // IT-01 / AX. The SAME cells — the band that removes a column at three
  // centred cells removes a row here, so an unknown figure is absent in both
  // compositions and the frames cannot disagree about what is known.
  if (stacked) {
    return (
      <View className="mx-gutter border-t border-rule">
        {cells.map((c) => (
          // Sentence case: the label sits beside its figure at reading size
          // now rather than under it as a tracked colophon, so the uppercase
          // treatment would be shouting a word the frame sets in prose.
          <StackedRow key={c.key} figure={c.figure} label={c.label} a11yLabel={c.a11y} />
        ))}
      </View>
    );
  }

  return (
    <View className="mx-gutter flex-row border-y border-rule py-[14px]">
      {cells.map((c) => (
        <Cell key={c.key} figure={c.figure} label={c.label} weight={c.weight} a11yLabel={c.a11y} />
      ))}
    </View>
  );
}
