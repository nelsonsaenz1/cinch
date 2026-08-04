import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption' | 'stat';

/**
 * Weight is expressed as a font FAMILY, never as `font-semibold`.
 *
 * React Native does not synthesise weights for custom fonts. Applying
 * `fontWeight` to a loaded family is silently ignored and you get the regular
 * cut back — which reads as "the design just isn't landing" rather than as a
 * bug, so it is worth stating plainly here.
 */
const variants: Record<Variant, string> = {
  // Bodoni Moda. Large sizes only — its hairlines break up below ~28px.
  display: 'font-display text-display text-ink dark:text-ink-dark',
  title: 'font-display text-title text-ink dark:text-ink-dark',
  heading: 'font-semibold text-heading text-ink dark:text-ink-dark',
  body: 'font-body text-body text-ink dark:text-ink-dark',
  label: 'font-medium text-label text-muted dark:text-muted-dark',
  caption: 'font-medium text-caption uppercase tracking-wide text-muted dark:text-muted-dark',
  stat: 'font-mono text-body text-ink dark:text-ink-dark',
};

export type TextProps = RNTextProps & {
  variant?: Variant;
  className?: string;
};

export function Text({ variant = 'body', className = '', style, ...rest }: TextProps) {
  const isDisplay = variant === 'display' || variant === 'title';

  return (
    <RNText
      // Dynamic Type: content scales with the user's system setting, but is
      // capped so a very large setting cannot destroy the grid layout.
      maxFontSizeMultiplier={isDisplay ? 1.4 : 1.8}
      className={`${variants[variant]} ${className}`}
      style={[
        // Tabular figures stop wear counts, temperatures and prices from
        // jittering as digits change. Archivo ships them; this turns them on.
        variant === 'stat' ? { fontVariant: ['tabular-nums'] } : null,
        style,
      ]}
      {...rest}
    />
  );
}
