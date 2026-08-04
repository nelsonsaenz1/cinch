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
 * Weight is expressed as a font FAMILY, never as `font-semibold`.
 *
 * React Native does not synthesise weights for custom fonts. Applying
 * `fontWeight` to a loaded family is silently ignored and you get the regular
 * cut back — which reads as "the design just isn't landing" rather than as a
 * bug, so it is worth stating plainly here.
 *
 * Never hand-write a `lineHeight` on top of these. The sizes carry line heights
 * computed from the real font metrics; a tighter override clips the tops of the
 * glyphs. See src/theme/font-metrics.js.
 */
const variants: Record<Variant, string> = {
  // Bodoni Moda. Display only — never below the 24px `plate` size.
  wordmark: 'font-display text-wordmark text-ink dark:text-ink-dark',
  display: 'font-display text-display text-ink dark:text-ink-dark',
  // Deliberately `font-title`, not `font-display`: a coarser optical master —
  // at 28px and below the display cut's hairlines drop under a device pixel.
  title: 'font-title text-title text-ink dark:text-ink-dark',
  plate: 'font-title text-plate text-ink dark:text-ink-dark',

  // Archivo.
  heading: 'font-semibold text-heading text-ink dark:text-ink-dark',
  body: 'font-body text-body text-ink dark:text-ink-dark',
  callout: 'font-body text-callout text-ink dark:text-ink-dark',
  label: 'font-medium text-label text-muted dark:text-muted-dark',
  caption: 'font-medium text-caption text-muted dark:text-muted-dark',
  // The tracked-out grotesque eyebrow — THE MORNING EDIT, PLATE Nº 2.
  eyebrow: 'font-medium text-eyebrow uppercase text-muted dark:text-muted-dark',
  // The data line under a plate. Set in the engine's own vocabulary.
  colophon: 'font-medium text-colophon uppercase text-muted dark:text-muted-dark',
  stat: 'font-mono text-body text-ink dark:text-ink-dark',
};

/**
 * The cap-trim table for the didone variants.
 *
 * A 64px Bodoni sits inside a 98px line box (the font's own metrics demand it —
 * shrinking the box is the clipping bug). Untrimmed, a rule placed 12px below
 * the text *looks* 35px below it, and the lookbook's tight plate grammar is
 * impossible. `trim` collapses the box to the cap height with negative margins,
 * leaving the glyph box intact. Opt in per use; flowing body text never wants it.
 */
const TRIMS: Partial<Record<Variant, { marginTop: number; marginBottom: number }>> = {
  wordmark: capTrim('bodoni', 64, leading('bodoni', 64, 1.05)),
  display: capTrim('bodoni', 40, leading('bodoni', 40, 1.05)),
  title: capTrim('bodoni', 28, leading('bodoni', 28, 1.1)),
  plate: capTrim('bodoni', 24, leading('bodoni', 24, 1.1)),
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
