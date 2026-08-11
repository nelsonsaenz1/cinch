import { View } from 'react-native';

/**
 * The 1px line, in the app's two weights.
 *
 * `rule` (default) is the printed line that carries the page's structure —
 * card borders, section rules, the ruled footer of a plate. `hairline` is the
 * quieter one, for dividers between rows of a list.
 *
 * The weight is a prop rather than a second component because the app had
 * already grown three spellings of the quiet one — `h-px bg-hairline`,
 * `h-hair bg-hairline`, and this file — and the fix is one component that can
 * say both, not a fourth spelling.
 */
export function Rule({
  className = '',
  tone = 'rule',
}: {
  className?: string;
  tone?: 'rule' | 'hairline';
}) {
  return (
    <View
      className={`h-hair w-full ${
        tone === 'hairline' ? 'bg-hairline' : 'bg-rule'
      } ${className}`}
    />
  );
}
