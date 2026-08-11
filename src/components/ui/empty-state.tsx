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
/**
 * Re-exported so the sentence above is true at the import site, not just in
 * prose: anyone reaching here for the empty branch finds the error branch in
 * the same place. Two separate agents independently imported `ErrorState`
 * from this module on the strength of that comment, which is a fair reading —
 * the fix is to make the reading correct rather than to keep being surprised
 * by it. `error-state.tsx` remains the definition; `@/components/ui` is the
 * canonical barrel.
 */
export { ErrorState } from './error-state';
export type { ErrorStateProps } from './error-state';

/**
 * The third member of the states kit, for the same reason: a *hero* empty —
 * the closet's "An empty rail", Today's "I can't style what I can't see" — is
 * a centred composition with an illustration in it, which is exactly what the
 * docblock above rules out for this component. Those two screens keep their
 * own frames. What they should not each invent is the ghosted garment backdrop
 * behind the affordance, so it lives here as one component with the
 * accessibility and contrast rules baked in.
 *
 * `GhostedRail` renders absolutely and hides itself from touch and VoiceOver;
 * `GHOSTED_RAIL_HEIGHT` is the line below which body copy must stay.
 */
export { GHOSTED_RAIL_HEIGHT, GhostedRail } from './ghosted-rail';

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

      <Text variant="body" className="mt-4 text-muted">
        {body}
      </Text>

      {actionTitle && onAction ? (
        <Button
          title={actionTitle}
          onPress={onAction}
          haptic
          // Ink, not oxblood: every atlas sets the empty state's way forward
          // as an ink fill (Plan's "Add clothes", Closet's "Add pieces") and
          // keeps the accent for the screen's one true commitment. A
          // section-level empty is quieter still — a secondary outline, so it
          // never competes with whatever the page is really for.
          variant={compact ? 'secondary' : 'ink'}
          className={compact ? 'mt-6 self-start px-6' : 'mt-8 self-stretch'}
        />
      ) : null}
    </View>
  );
}
