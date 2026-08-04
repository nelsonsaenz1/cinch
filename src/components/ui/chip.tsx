import { Pressable } from 'react-native';

import { Text } from '@/components/ui/text';
import { MIN_TAP_TARGET } from '@/theme/tokens';

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
      <Text
        variant="label"
        className={selected ? 'text-canvas dark:text-canvas' : 'text-ink dark:text-ink-dark'}>
        {label}
      </Text>
      {count !== undefined ? (
        <Text
          variant="stat"
          className={`ml-1.5 text-label ${
            selected ? 'text-canvas/70 dark:text-canvas/70' : 'text-muted dark:text-muted-dark'
          }`}>
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}
