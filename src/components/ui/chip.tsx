import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { Pressable } from 'react-native';

import { Text } from '@/components/ui/text';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

export type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Renders a count suffix in tabular numerals, e.g. filter result counts. */
  count?: number;
  accessibilityHint?: string;
  /**
   * `outline` (default) is the interactive chip: a hairline ring that fills
   * with the accent when selected. `fill` is the READ-ONLY descriptive tag the
   * approved closet frame draws — a sand ground with no ring at all.
   *
   * Scoped deliberately rather than made the global style: the category filter
   * needs the outlined/filled pair to carry its selected state, and a filled
   * resting chip would leave it nothing to change into. Radius stays 12 in
   * both tones — the frame's 999 capsule is a recorded deviation, and one
   * radius grammar beats a 2px match to a mock that broke its own scale.
   */
  tone?: 'outline' | 'fill';
  /**
   * What the selected outline chip fills with. `accent` is the app-wide
   * default; the Closet State Atlas draws its category row's active chip in
   * ink (C-01), so the closet passes `ink`. Additive — no existing call site
   * changes meaning.
   */
  selectedGround?: 'accent' | 'ink';
};

/**
 * The workhorse of tag editing. The review deck needs a correction to take one
 * tap, so tags are always chips — never a picker, never a dropdown, never a
 * form field.
 */
export function Chip({
  label,
  selected = false,
  onPress,
  count,
  accessibilityHint,
  tone = 'outline',
  selectedGround = 'accent',
}: ChipProps) {
  const theme = useTheme();
  const filled = tone === 'fill';
  const inkGround = selectedGround === 'ink';

  // The selection tick every other control in the app gives a tap. Best-effort:
  // haptics no-op in Low Power Mode, and a failure must never eat the press.
  const press = useCallback(() => {
    if (!onPress) return;
    void Haptics.selectionAsync().catch(() => {});
    onPress();
  }, [onPress]);

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected }}
      accessibilityHint={accessibilityHint}
      onPress={onPress ? press : undefined}
      // Visual height stays compact; the touch target is padded out to 44pt.
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      style={{ minHeight: MIN_TAP_TARGET - 12 }}
      className={[
        'flex-row items-center justify-center rounded-chip px-3.5',
        onPress ? 'active:opacity-60' : '',
        filled
          ? 'bg-sand dark:bg-sand-dark'
          : selected
            ? inkGround
              ? 'border border-ink bg-ink dark:border-ink-dark dark:bg-ink-dark'
              : 'border border-accent bg-accent dark:border-accent-dark dark:bg-accent-dark'
            : 'border border-hairline bg-transparent dark:border-hairline-dark',
      ].join(' ')}>
      {/* Inline style, not a className: `variant="label"` already carries
          `text-muted`, and NativeWind gives no guaranteed precedence between
          two `text-*` utilities on one element — so a `text-canvas` class here
          lost and the selected chip read muted-on-accent. */}
      <Text variant="label" style={{ color: selected ? theme.canvas : theme.ink }}>
        {label}
      </Text>
      {/* `statSmall`, not `stat` + a `text-label` override: two size utilities
          on one element have no defined precedence in NativeWind — the same
          hazard as the colours above. The variant names the size once. */}
      {count !== undefined ? (
        <Text
          variant="statSmall"
          className="ml-1.5"
          style={{ color: selected ? `${theme.canvas}B3` : theme.muted }}>
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}
