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
};

/**
 * The workhorse of tag editing. The review deck needs a correction to take one
 * tap, so tags are always chips — never a picker, never a dropdown, never a
 * form field.
 */
export function Chip({ label, selected = false, onPress, count, accessibilityHint }: ChipProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={{ selected }}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      // Visual height stays compact; the touch target is padded out to 44pt.
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      style={{ minHeight: MIN_TAP_TARGET - 12 }}
      className={[
        'flex-row items-center justify-center rounded-chip border px-3.5 active:opacity-60',
        selected
          ? 'border-accent bg-accent dark:border-accent-dark dark:bg-accent-dark'
          : 'border-hairline bg-transparent dark:border-hairline-dark',
      ].join(' ')}>
      {/* Inline style, not a className: `variant="label"` already carries
          `text-muted`, and NativeWind gives no guaranteed precedence between
          two `text-*` utilities on one element — so a `text-canvas` class here
          lost and the selected chip read muted-on-accent. */}
      <Text variant="label" style={{ color: selected ? theme.canvas : theme.ink }}>
        {label}
      </Text>
      {count !== undefined ? (
        <Text
          variant="stat"
          className="ml-1.5 text-label"
          style={{ color: selected ? `${theme.canvas}B3` : theme.muted }}>
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}
