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
    <View className="flex-1 items-center justify-center px-10" accessibilityRole="summary">
      <View className="mb-6 h-20 w-20 items-center justify-center rounded-full bg-tray dark:bg-tray-dark">
        <SymbolView
          name={symbol}
          size={34}
          tintColor={tone === 'blocked' ? theme.warning : theme.muted}
          resizeMode="scaleAspectFit"
        />
      </View>

      <Text variant="title" className="text-center">
        {title}
      </Text>

      <Text variant="body" className="mt-3 text-center text-muted dark:text-muted-dark">
        {body}
      </Text>

      {actionTitle && onAction ? (
        <Button title={actionTitle} onPress={onAction} haptic className="mt-8 self-stretch" />
      ) : null}
    </View>
  );
}
