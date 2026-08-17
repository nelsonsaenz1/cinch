import { SymbolView, type SFSymbol } from 'expo-symbols';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/tokens';

export type ErrorStateProps = {
  /** One serif line. Say what failed, not what the user did wrong. */
  title?: string;
  /** The honest half: why the screen is blank and what it does *not* mean. */
  body?: string;
  /** Wire this to the query's `refetch`. Without it the screen is a dead end. */
  onRetry?: () => void;
  retryTitle?: string;
  /** True while the retry is in flight — the button takes its own spinner. */
  retrying?: boolean;
  /**
   * For an error inside an already-drawn container — a card with a heading
   * above it, a section of a scroll view. Drops the `flex-1` centring (which
   * needs a flex parent and collapses to nothing without one) and the
   * full-bleed spacing, and quiets the retry to a secondary button so a
   * section-level failure doesn't spend the screen's one oxblood action.
   */
  compact?: boolean;
  symbol?: SFSymbol;
};

/**
 * The state the app did not have.
 *
 * Eleven screens rendered a failed fetch as a successful empty result: a failed
 * closet query said "An empty rail", a failed review queue said "Nothing to
 * review", a failed blocked-users query said "No one is blocked" — which on a
 * moderation surface tells a woman her blocks silently vanished. Those are not
 * ugly states, they are the app asserting something false about her data.
 *
 * So this is `EmptyState`'s sibling, set identically — hard-left on the gutter,
 * small glyph, one serif line, body, action — and the difference is entirely in
 * what it is allowed to claim. An empty state describes the data. This one
 * refuses to: it says only that the read failed, that nothing has changed
 * underneath, and offers the read again. The glyph takes the `warning` tint
 * that `EmptyState`'s `tone="blocked"` already established for the states that
 * are obstructions rather than absences.
 *
 * The defaults are deliberately usable as-is, so adding the branch is a
 * two-line change at every call site and nobody skips it for lack of copy:
 *
 *   if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
 */
export function ErrorState({
  title = 'That didn’t load.',
  body = 'Cinch couldn’t read this just now — which is a connection problem, not a change to your things. Nothing has moved.',
  onRetry,
  retryTitle = 'Try again',
  retrying = false,
  compact = false,
  symbol = 'exclamationmark.triangle',
}: ErrorStateProps) {
  const theme = useTheme();

  return (
    <View
      // `alert` over `summary`: a failure that appears after a wait should be
      // announced, not merely findable by swiping to it.
      accessibilityRole="alert"
      className={compact ? 'px-gutter py-6' : 'flex-1 justify-center px-gutter'}>
      <SymbolView
        name={symbol}
        size={22}
        tintColor={theme.warning}
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

      {onRetry ? (
        <Button
          title={retryTitle}
          onPress={onRetry}
          loading={retrying}
          haptic
          variant={compact ? 'secondary' : 'primary'}
          className={compact ? 'mt-6 self-start px-6' : 'mt-8 self-stretch'}
        />
      ) : null}
    </View>
  );
}
