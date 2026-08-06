import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * The pick control on one posted look: tally + cast/retract in one pill.
 *
 * Grammar rules this component enforces by construction:
 * - Picks render in INK, never the accent — accent is reserved for the one
 *   primary CTA per screen, and a vote is participation, not the page's call
 *   to action (design-direction §11).
 * - There is no down state of any kind. The only verbs are "pick", "move"
 *   (handled upstream — casting on another look moves the one pick), and
 *   "take it back".
 * - On the caller's own look the pill is a plain tally: she cannot vote for
 *   herself (the DB refuses with 22023 anyway), and rendering a dead button
 *   would read as a broken one.
 */
export function VotePill({
  votes,
  picked,
  mine,
  locked,
  pending,
  onToggle,
}: {
  votes: number;
  /** The caller's one movable pick is on this look. */
  picked: boolean;
  /** The caller posted this look — tally only, no control. */
  mine: boolean;
  /** Board locked (event started): tallies stay, controls go. */
  locked: boolean;
  pending: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  const tally = votes === 1 ? '1 pick' : `${votes} picks`;

  if (mine || locked) {
    return (
      <View className="flex-row items-center" style={{ minHeight: MIN_TAP_TARGET - 12 }}>
        <Text variant="colophon">{tally}</Text>
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={picked ? `Picked, ${tally}. Take your pick back` : `Pick this look, ${tally}`}
      accessibilityState={{ selected: picked, disabled: pending, busy: pending }}
      disabled={pending}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => {});
        onToggle();
      }}
      style={{ minHeight: MIN_TAP_TARGET - 8 }}
      className={[
        'flex-row items-center justify-center gap-1.5 rounded-md px-3.5 active:opacity-70',
        picked ? 'bg-ink' : 'border border-rule',
        pending ? 'opacity-40' : '',
      ].join(' ')}>
      {pending ? (
        <ActivityIndicator size="small" color={picked ? theme.canvas : theme.muted} />
      ) : (
        <>
          <Text
            variant="label"
            className="font-medium"
            style={{ color: picked ? theme.canvas : theme.ink }}>
            {picked ? 'Picked' : 'Pick'}
          </Text>
          {votes > 0 ? (
            // Canvas at 70% on the ink fill — the tally is subordinate to the
            // verb beside it. Written as an alpha suffix on the token rather
            // than a hand-typed rgba, the way `chip.tsx` prints its count.
            <Text variant="label" style={{ color: picked ? `${theme.canvas}B3` : theme.muted }}>
              {votes}
            </Text>
          ) : null}
        </>
      )}
    </Pressable>
  );
}
