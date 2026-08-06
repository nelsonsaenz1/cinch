import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * How long a guess may outlive its tap.
 *
 * The happy path never reaches this — the guess is dropped the render after
 * `picked` moves. This is the floor under the unhappy one: the vote mutation
 * invalidates without awaiting the refetch, so there is no callback that says
 * "refused", and a guess with no expiry would leave the pill asserting a pick
 * the server declined. Long enough for a slow round trip, short enough that
 * it resolves while the refusal alert is still on screen.
 */
const GUESS_TTL = 2500;

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
 * - On the caller's own look the pill is a plain tally: you cannot vote for
 *   yourself (the DB refuses with 22023 anyway), and rendering a dead button
 *   would read as a broken one.
 *
 * ── Optimistic, but only in the UI ─────────────────────────────────────────
 * The pill answers the tap before the network does: `guess` holds the state
 * the tap asked for and the label flips to it immediately, while `pending`
 * keeps its dim as the "still working" signal. What it deliberately does NOT
 * do is write to the query cache. This codebase's rule is invalidate, don't
 * patch — an `onMutate`/rollback pair would put a second, divergent copy of
 * the truth in the cache and make the vote mutation own a rollback path it
 * does not have. TanStack documents this exact split and calls it the UI-only
 * variant: local state, reconciled the moment the real `picked` prop lands.
 * The tally is left alone while the guess is outstanding — the count is other
 * people's data and this component is only entitled to guess about its own.
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

  // The tapped-but-unsettled state. `from` records what `picked` said at the
  // moment of the tap, which is what makes the guess expire *during render*
  // with no synchronising effect: once `picked` has moved off `from`, the
  // props have caught up and the guess is simply no longer consulted.
  const [guess, setGuess] = useState<{ want: boolean; from: boolean } | null>(null);
  const expiry = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (expiry.current && clearTimeout(expiry.current)), []);

  const shown = guess && guess.from === picked ? guess.want : picked;

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
      accessibilityLabel={shown ? `Picked, ${tally}. Take your pick back` : `Pick this look, ${tally}`}
      accessibilityState={{ selected: shown, disabled: pending, busy: pending }}
      disabled={pending}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => {});
        setGuess({ want: !picked, from: picked });
        if (expiry.current) clearTimeout(expiry.current);
        expiry.current = setTimeout(() => setGuess(null), GUESS_TTL);
        onToggle();
      }}
      style={{ minHeight: MIN_TAP_TARGET - 8 }}
      className={[
        'flex-row items-center justify-center gap-1.5 rounded-md px-3.5 active:opacity-70',
        shown ? 'bg-ink' : 'border border-rule',
        // The dim IS the working signal — it used to sit under a spinner that
        // had replaced the label, so a tap on "Pick" showed nothing readable
        // as "picked" until the round trip settled.
        pending ? 'opacity-40' : '',
      ].join(' ')}>
      <Text
        variant="label"
        className="font-medium"
        style={{ color: shown ? theme.canvas : theme.ink }}>
        {shown ? 'Picked' : 'Pick'}
      </Text>
      {votes > 0 ? (
        // Canvas at 70% on the ink fill — the tally is subordinate to the
        // verb beside it. Written as an alpha suffix on the token rather
        // than a hand-typed rgba, the way `chip.tsx` prints its count.
        <Text variant="label" style={{ color: shown ? `${theme.canvas}B3` : theme.muted }}>
          {votes}
        </Text>
      ) : null}
    </Pressable>
  );
}
