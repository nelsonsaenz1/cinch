import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { capTrim, leading } from '@/theme/font-metrics';

type Variant =
  | 'wordmark'
  | 'display'
  | 'title'
  | 'plate'
  | 'heading'
  | 'body'
  | 'callout'
  | 'label'
  | 'caption'
  | 'eyebrow'
  | 'colophon'
  | 'stat';

/**
 * Weight is a font FAMILY for the serif, and may be a family for Helvetica too.
 *
 * React Native does not synthesise weights for a *bundled* family (Instrument
 * Serif ships one weight, so there is only ever the regular cut). Helvetica Neue
 * is a system face and does honour its distinct cuts by PostScript name, which
 * is why `font-medium`/`font-semibold` resolve to HelveticaNeue-Medium. Either
 * way, do not lean on `fontWeight`; name the family.
 *
 * Never hand-write a `lineHeight` on top of these. The sizes carry line heights
 * computed from the real font metrics; a tighter override clips the tops of the
 * glyphs. See src/theme/font-metrics.js. The app is light-only, so no `dark:`
 * halves here.
 */
const variants: Record<Variant, string> = {
  // Instrument Serif — display only.
  wordmark: 'font-display text-wordmark text-ink',
  display: 'font-display text-display text-ink',
  title: 'font-title text-title text-ink',
  plate: 'font-title text-plate text-ink',

  // Helvetica Neue.
  heading: 'font-semibold text-heading text-ink',
  body: 'font-body text-body text-ink',
  callout: 'font-body text-callout text-ink',
  label: 'font-medium text-label text-muted',
  caption: 'font-medium text-caption text-muted',
  // The tracked-out eyebrow, set in the lighter faint tone — the fashion-
  // magazine signature.
  eyebrow: 'font-medium text-eyebrow uppercase text-faint',
  // The data line under a plate.
  colophon: 'font-medium text-colophon uppercase text-faint',
  // The hero data number — serif, matching the design's stat grids.
  stat: 'font-title text-heading text-ink',
};

/**
 * The cap-trim table for the serif variants.
 *
 * Instrument Serif carries a tall 1.30 line box, so a 64px setting sits inside
 * an 84px box. Untrimmed, a rule placed 12px below the text *looks* far below
 * it, and the lookbook's tight plate grammar is impossible. `trim` collapses
 * the box to the cap height with negative margins, leaving the glyph box intact.
 * Opt in per use; flowing body text never wants it.
 */
const TRIMS: Partial<Record<Variant, { marginTop: number; marginBottom: number }>> = {
  wordmark: capTrim('instrument', 64, leading('instrument', 64, 1.05)),
  display: capTrim('instrument', 40, leading('instrument', 40, 1.05)),
  title: capTrim('instrument', 28, leading('instrument', 28, 1.08)),
  plate: capTrim('instrument', 24, leading('instrument', 24, 1.08)),
};

export type TextProps = RNTextProps & {
  variant?: Variant;
  className?: string;
  /** Collapse the line box to the cap height (single-line display text only). */
  trim?: boolean;
};

export function Text({ variant = 'body', className = '', trim = false, style, ...rest }: TextProps) {
  const isDisplay =
    variant === 'wordmark' || variant === 'display' || variant === 'title' || variant === 'plate';

  return (
    <RNText
      // Dynamic Type: content scales with the user's system setting, but is
      // capped so a very large setting cannot destroy the plate grid.
      maxFontSizeMultiplier={isDisplay ? 1.4 : 1.8}
      className={`${variants[variant]} ${className}`}
      style={[
        // Tabular figures stop wear counts, temperatures and prices from
        // jittering as digits change. Archivo ships them; this turns them on.
        variant === 'stat' || variant === 'colophon' ? { fontVariant: ['tabular-nums'] } : null,
        trim ? TRIMS[variant] : null,
        style,
      ]}
      {...rest}
    />
  );
}
