import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'label' | 'caption' | 'stat';

const variants: Record<Variant, string> = {
  // Editorial serif, set tight. Headers only — never body copy.
  display: 'font-display text-display text-ink dark:text-ink-dark',
  title: 'font-display text-title text-ink dark:text-ink-dark',
  heading: 'font-body text-heading font-semibold text-ink dark:text-ink-dark',
  body: 'font-body text-body text-ink dark:text-ink-dark',
  label: 'font-body text-label font-medium text-muted dark:text-muted-dark',
  caption: 'font-body text-caption uppercase tracking-wide text-muted dark:text-muted-dark',
  // Tabular numerals so wear counts and prices don't jitter as digits change.
  stat: 'font-mono text-body text-ink dark:text-ink-dark',
};

export type TextProps = RNTextProps & {
  variant?: Variant;
  className?: string;
};

export function Text({ variant = 'body', className = '', ...rest }: TextProps) {
  return (
    <RNText
      // Dynamic Type: content scales with the user's system setting, but is
      // capped so a very large setting cannot destroy the grid layout.
      maxFontSizeMultiplier={variant === 'display' || variant === 'title' ? 1.4 : 1.8}
      className={`${variants[variant]} ${className}`}
      {...rest}
    />
  );
}
