import { SymbolView } from 'expo-symbols';
import { useWindowDimensions, View } from 'react-native';

import { PressableSurface } from '@/components/ui/pressable-surface';
import { Text } from '@/components/ui/text';
import { REACTION_HINT, REACTION_LABELS, reactionAccessibilityLabel } from '@/features/daily-social/copy';
import { DAILY_REACTIONS, type DailyReaction } from '@/features/daily-social/types';
import { useTheme } from '@/theme/tokens';

import {
  DAILY_REACTION_GAP,
  dailyReactionsStacked,
  dailyReactionVisual,
} from './reaction-spec';

export type ReactionRowProps = {
  /** The reader's own reaction to this look, or null. Never anybody else's. */
  reaction: DailyReaction | null;
  /**
   * Pressing the chosen one again passes `null` — the press is reversible, and
   * the hint says so. `(outfit_id, reactor_id)` is a primary key, so this is an
   * update or a delete and never a second row.
   */
  onReact: (reaction: DailyReaction | null) => void;
  /** Named in each control's label so five cards do not all say "Sharp". */
  lookName: string | null;
};

/**
 * THE THREE REACTIONS — DS-06.
 *
 * Presentational. It takes the reader's current reaction and hands back the
 * next one; it does not know what a mutation is, and it never reads or writes.
 *
 * ── What is deliberately absent ─────────────────────────────────────────────
 *
 * **No count, no tally, no avatars, no "2 friends reacted".** There is nothing
 * to aggregate — `daily_social_reactions` has no count column and no aggregate
 * view, and RLS shows a reactor only their own row. A number here would be a
 * number the app cannot get, which is worse than one it should not show.
 *
 * **No fourth control, no overflow, no picker, no emoji tray.** The set is
 * three, fixed, and the row is built by mapping `DAILY_REACTIONS` so a fourth
 * cannot be added here without adding it to the wire type first.
 *
 * **No free-text field.** The unit ships none anywhere; a reaction is one of
 * three words, which is what keeps UGC moderation out of this surface
 * entirely.
 *
 * ── Accessibility ───────────────────────────────────────────────────────────
 *
 * Every control is a labelled button with a hint, at ≥44 pt (the floor comes
 * from `PressableSurface`, which is the reason it was used instead of a bare
 * `Pressable`). At AX sizes the three stack rather than shrink — nothing is
 * capped, truncated or scaled down, and the labels wrap inside a control that
 * is allowed to grow.
 */
export function ReactionRow({ reaction, onReact, lookName }: ReactionRowProps) {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const stacked = dailyReactionsStacked(fontScale);

  return (
    <View
      style={{
        flexDirection: stacked ? 'column' : 'row',
        gap: DAILY_REACTION_GAP,
        // `stretch` when stacked so each control keeps the full measure to wrap
        // its label in; `flex-start` never, which would shrink-wrap them to the
        // word and put a 44 pt floor around a 30 pt target.
        alignItems: 'stretch',
      }}>
      {DAILY_REACTIONS.map((kind) => {
        const selected = reaction === kind;
        const visual = dailyReactionVisual(selected);

        return (
          <PressableSurface
            key={kind}
            accessibilityRole="button"
            accessibilityLabel={reactionAccessibilityLabel(kind, lookName)}
            accessibilityHint={REACTION_HINT}
            accessibilityState={visual.accessibilityState}
            onPress={() => onReact(selected ? null : kind)}
            haptic="selection"
            className={`rounded-md px-3 ${visual.ground}`}
            // `flex: 1` across, none when stacked — a stacked control that also
            // flexed would divide the page's height between three pills.
            style={stacked ? { minHeight: visual.minHeight } : { flex: 1, minHeight: visual.minHeight }}
            // The arrangement has to be a style rather than a className: the
            // compression rides an Animated.View, and NativeWind's interop is
            // not registered for Reanimated's wrappers. See PressableSurface.
            contentStyle={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              paddingVertical: 8,
            }}>
            {visual.tick ? (
              <SymbolView
                name="checkmark"
                size={12}
                tintColor={theme.canvas}
                resizeMode="scaleAspectFit"
              />
            ) : null}
            <Text
              variant="label"
              // Colour is set here rather than by a `text-*` class because the
              // chosen pill's label is `canvas` on ink and the resting one's is
              // `ink` on paper — two size utilities or two colour utilities on
              // one element have no precedence in NativeWind, which is the
              // coin-toss `text.tsx` documents at L103-110.
              style={{ color: selected ? theme.canvas : theme.ink }}
              // No `numberOfLines`. At AX-XXXL "Noted" is allowed to wrap and
              // the control is allowed to grow; a clamp here is how a reaction
              // loses its own name at the setting that needs it most.
              className="text-center">
              {REACTION_LABELS[kind]}
            </Text>
          </PressableSurface>
        );
      })}
    </View>
  );
}
