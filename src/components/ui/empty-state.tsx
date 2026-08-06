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
  /**
   * For an empty section inside an already-drawn container — a card with a
   * heading above it. Drops the `flex-1` centring, which needs a flex parent
   * and collapses to nothing without one. This is the landing place for the
   * hand-rolled 11px empties scattered through the social screens; the copy
   * belongs on the same 17px body scale as every other empty in the app.
   */
  compact?: boolean;
};

/**
 * Set like everything else: hard-left on the gutter, one serif
 * line, body, action. The old version was the centred-circle-badge pattern —
 * a named AI-slop tell the design brief exists to escape. The symbol stays,
 * but as a small glyph above the title, not an illustration pretending to be
 * content.
 *
 * An empty state makes a claim about the data: there is nothing here. Only
 * render it once you know that is true. A query that is still loading gets a
 * skeleton and a query that failed gets `ErrorState` — reaching for this one
 * on an `isError` branch is how "No one is blocked." came to be shown to
 * someone whose blocks were merely unreadable.
 */
export function EmptyState({
  symbol,
  title,
  body,
  actionTitle,
  onAction,
  tone = 'neutral',
  compact = false,
}: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View
      className={compact ? 'px-gutter py-6' : 'flex-1 justify-center px-gutter'}
      accessibilityRole="summary">
      <SymbolView
        name={symbol}
        size={22}
        tintColor={tone === 'blocked' ? theme.warning : theme.muted}
        resizeMode="scaleAspectFit"
      />

      <View style={{ marginTop: 16 }}>
        <Text variant={compact ? 'plate' : 'title'} trim>
          {title}
        </Text>
      </View>

      <Text variant="body" className="mt-4 text-muted dark:text-muted-dark">
        {body}
      </Text>

      {actionTitle && onAction ? (
        <Button
          title={actionTitle}
          onPress={onAction}
          haptic
          // A section-level empty must not spend the screen's one oxblood
          // action; the primary belongs to whatever the page is really for.
          variant={compact ? 'secondary' : 'primary'}
          className={compact ? 'mt-6 self-start px-6' : 'mt-8 self-stretch'}
        />
      ) : null}
    </View>
  );
}
