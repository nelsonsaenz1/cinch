import { SymbolView, type SFSymbol } from 'expo-symbols';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/tokens';

export type EmptyStateProps = {
  symbol: SFSymbol;
  title: string;
  body: string;
  actionTitle?: string;
  onAction?: () => void;
  /**
   * Permission-denied and offline states are empty states too, and Apple
   * rejects apps whose core screens hard-fail on a declined permission — so
   * every one of them gets a real design and a way forward.
   */
  tone?: 'neutral' | 'blocked';
};

/**
 * Set like everything else in the book: hard-left on the gutter, one didone
 * line, body, action. The old version was the centred-circle-badge pattern —
 * a named AI-slop tell the design brief exists to escape. The symbol stays,
 * but as a small glyph above the title, not an illustration pretending to be
 * content.
 */
export function EmptyState({
  symbol,
  title,
  body,
  actionTitle,
  onAction,
  tone = 'neutral',
}: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View className="flex-1 justify-center px-gutter" accessibilityRole="summary">
      <SymbolView
        name={symbol}
        size={22}
        tintColor={tone === 'blocked' ? theme.warning : theme.muted}
        resizeMode="scaleAspectFit"
      />

      <View style={{ marginTop: 16 }}>
        <Text variant="title" trim>
          {title}
        </Text>
      </View>

      <Text variant="body" className="mt-4 text-muted dark:text-muted-dark">
        {body}
      </Text>

      {actionTitle && onAction ? (
        <Button title={actionTitle} onPress={onAction} haptic className="mt-8 self-stretch" />
      ) : null}
    </View>
  );
}
