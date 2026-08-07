import type { ReactNode } from 'react';
import { View, type ViewProps } from 'react-native';

export type CardProps = ViewProps & {
  children: ReactNode;
  /**
   * Inner padding. `none` is the list-row container — its own rows carry
   * their padding, and the card clips them to the radius instead.
   */
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  /**
   * Border weight. `rule` is the default card edge; `hairline` is the
   * quieter one a few surfaces use; `none` is the plain filled card with no
   * ring at all.
   */
  border?: 'rule' | 'hairline' | 'none';
  /** Ground fill. `surface` (white) is the default card; `none` stays transparent over canvas. */
  fill?: 'surface' | 'none';
  className?: string;
};

const PADDING: Record<NonNullable<CardProps['padding']>, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-3.5',
  lg: 'p-4',
  xl: 'p-5',
};

const BORDER: Record<NonNullable<CardProps['border']>, string> = {
  rule: 'border border-rule',
  hairline: 'border border-hairline',
  none: '',
};

/**
 * The surface-white, hairline-bordered, `rounded-plate` card — ~35 call
 * sites hand-typed this in four padding widths and two border weights. A
 * no-padding card is always the list-row container, so `overflow-hidden`
 * follows from `padding="none"` rather than being its own prop: every
 * existing no-padding card already clipped its rows to the radius, and every
 * padded one never needed to.
 */
export function Card({
  children,
  padding = 'none',
  border = 'rule',
  fill = 'surface',
  className = '',
  ...rest
}: CardProps) {
  return (
    <View
      className={`rounded-plate ${padding === 'none' ? 'overflow-hidden' : ''} ${BORDER[border]} ${
        fill === 'surface' ? 'bg-surface' : ''
      } ${PADDING[padding]} ${className}`}
      {...rest}>
      {children}
    </View>
  );
}
