import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Text } from '@/components/ui/text';

export type SectionHeaderProps = {
  /** The tracked eyebrow label. */
  title: string;
  /**
   * A right-aligned companion on the same baseline — a count, a `n of m`
   * colophon, a `Blocked` state. Renders `flex-row items-baseline
   * justify-between` when present; a bare `eyebrow` otherwise.
   */
  trailing?: ReactNode;
  /**
   * The vertical rhythm around the header. Deliberately NOT a fixed default:
   * the app shipped with ≥8 different margin dialects around this exact
   * pattern (no margin, `mb-2.5 mt-6`, `mb-3 mt-7`, …) and collapsing them to
   * one rhythm here would be a visible layout change at every call site.
   * Each caller passes the margin it already had.
   */
  className?: string;
};

/**
 * The eyebrow-over-content section heading — 59 call sites hand-rolled this,
 * every one a bare `<Text variant="eyebrow">` (occasionally paired with a
 * trailing count) wrapped in whatever margin the screen invented locally.
 * This names the shape without renormalising the rhythm; see `className`.
 */
export function SectionHeader({ title, trailing, className = '' }: SectionHeaderProps) {
  if (trailing) {
    return (
      <View className={`flex-row items-baseline justify-between ${className}`}>
        <Text variant="eyebrow">{title}</Text>
        {trailing}
      </View>
    );
  }

  return (
    <Text variant="eyebrow" className={className}>
      {title}
    </Text>
  );
}
