import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/tokens';

export type NoticeProps = {
  message: string;
  /** `critical` is a failure; `neutral` (default) is a quiet confirmation or status line. */
  tone?: 'neutral' | 'critical';
  /** A ghost control at the trailing edge — "Undo", "Retry". Omit for a bare line. */
  action?: {
    label: string;
    onPress: () => void;
    loading?: boolean;
    accessibilityHint?: string;
  };
  numberOfLines?: number;
  className?: string;
};

/**
 * The inline caption + `accessibilityLiveRegion="polite"` feedback line —
 * Today's refresh failure, Plan's save failure, and review's undo offer each
 * hand-typed this. `accessibilityLiveRegion` is what makes VoiceOver announce
 * it, since these lines appear after the control that triggered them has
 * already moved on.
 *
 * Deliberately not the review deck's failure banner (a warning-tinted
 * `rounded-plate` pill in `label`, not this grammar) or the reaction bar's
 * tap-anywhere retry (the action is embedded in the message text itself,
 * with no separate control) — both are different shapes and stay hand-built.
 */
export function Notice({ message, tone = 'neutral', action, numberOfLines, className = '' }: NoticeProps) {
  const theme = useTheme();

  return (
    <View
      accessibilityLiveRegion="polite"
      className={`flex-row items-center justify-between gap-3 ${className}`}>
      <Text
        variant="caption"
        numberOfLines={numberOfLines}
        className="flex-1"
        style={tone === 'critical' ? { color: theme.critical } : undefined}>
        {message}
      </Text>
      {action ? (
        <Button
          title={action.label}
          variant="ghost"
          loading={action.loading}
          onPress={action.onPress}
          accessibilityHint={action.accessibilityHint}
        />
      ) : null}
    </View>
  );
}
