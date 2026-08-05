import { View } from 'react-native';

/**
 * The 1px structural rule. `hairline` is for quiet row dividers; this is the
 * printed line that carries the page's structure.
 */
export function Rule({ className = '' }: { className?: string }) {
  return <View className={`h-hair w-full bg-rule dark:bg-rule-dark ${className}`} />;
}
