import { SymbolView } from 'expo-symbols';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * One question in the index — the row HS-01 draws three of, three times.
 *
 * Not `SettingsRow`, deliberately, and the difference is the whole reason this
 * file exists: a settings row is a single line with a value beside it, and a
 * question is a sentence that wraps. `SettingsRow` sets its label in a
 * `flex-row` with no `flex-1` on the text, so "What happens when I lend
 * something?" would be squeezed to one line against the chevron. Here the
 * question takes the width and the chevron holds its column.
 *
 * The rule between rows is `hairline` (ink at 9%), which is the atlas's own
 * `rgba(28,26,22,.09)` exactly — the `rule` = .12 correction in the build
 * contract is about BORDERS, and this is a list divider, the quieter of the two
 * tokens by design. Drawn on the row rather than between rows so a group needs
 * no separator machinery: the last row simply does not draw one.
 */
export function HelpArticleRow({
  question,
  onPress,
  last = false,
}: {
  question: string;
  onPress: () => void;
  /** The final row of a group draws no rule under itself. */
  last?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={question}
      onPress={onPress}
      style={{ minHeight: MIN_TAP_TARGET }}
      className={`flex-row items-center gap-3.5 py-2.5 active:opacity-60 ${
        last ? '' : 'border-b border-hairline'
      }`}>
      <Text variant="body" className="flex-1">
        {question}
      </Text>
      {/* `faint`, matching every other pointing chevron in the app
          (`components/ui/settings-row.tsx:57`). The atlas draws #C4C0B6, which
          is a shade lighter again; the contrast correction that moves TEXT off
          `faint` leaves decorative strokes where they are, and one chevron
          colour across the app beats a 3% match to one screen. */}
      <SymbolView
        name="chevron.right"
        size={13}
        tintColor={theme.faint}
        resizeMode="scaleAspectFit"
      />
    </Pressable>
  );
}

/**
 * A group of questions under its eyebrow — the shape repeated three times on
 * HS-01 and once, unlabelled, under HS-03's "People also ask".
 */
export function HelpArticleList({
  questions,
  onSelect,
}: {
  questions: readonly { id: string; question: string }[];
  onSelect: (id: string) => void;
}) {
  return (
    <View>
      {questions.map((q, i) => (
        <HelpArticleRow
          key={q.id}
          question={q.question}
          last={i === questions.length - 1}
          onPress={() => onSelect(q.id)}
        />
      ))}
    </View>
  );
}
