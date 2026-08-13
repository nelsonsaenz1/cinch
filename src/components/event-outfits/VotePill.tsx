import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
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
 * Past this long still `pending`, the pill dims — Look Board State Atlas
 * "02 · The Vote pill": "Still in flight past 2s. Only then does it dim — a
 * spinner on a one-tap vote is theatre." Everything before this is drawn
 * already-settled: the optimistic fill happens on touch-up, not after a
 * delay, so the two-second floor is purely about when an unusually slow
 * round trip is allowed to start looking unusual.
 */
const DIM_AFTER = 2000;

/**
 * The pick control on one posted look: tally + cast/retract/error in one
 * pill. Six states (atlas "02 · The Vote pill"): rest, pressed, picked
 * (optimistic), picked-still-in-flight (dimmed past 2s), refused ("Try
 * again"), and closed.
 *
 * Grammar this component enforces by construction:
 * - Picks render in INK, never the accent — accent is reserved for the one
 *   primary CTA per screen, and a vote is participation, not the page's call
 *   to action (design-direction §11).
 * - There is no down state of any kind. Downvotes do not exist (contract
 *   §3) — the only verbs are "vote", "move" (handled upstream — casting on
 *   another look moves the one pick) and "take it back".
 * - On the caller's own look the pill is a plain tally: you cannot vote for
 *   yourself (the DB refuses with 22023 anyway), and rendering a dead button
 *   would read as a broken one.
 *
 * ── Optimistic, but only in the UI ─────────────────────────────────────────
 * The pill answers the tap before the network does: `guess` holds the state
 * the tap asked for and the label flips to it immediately, while `pending`
 * (past `DIM_AFTER`) is the "still working" signal. What it deliberately does
 * NOT do is write to the query cache — this codebase's rule is invalidate,
 * don't patch, and the tally is left alone while the guess is outstanding:
 * the count is other people's data and this component is only entitled to
 * guess about its own.
 */
export function VotePill({
  votes,
  picked,
  mine,
  locked,
  pending,
  failed,
  onToggle,
  onRetry,
}: {
  votes: number;
  /** The caller's one movable pick is on this look. */
  picked: boolean;
  /** The caller posted this look — tally only, no control. */
  mine: boolean;
  /** Board locked (event started): tallies stay, controls go. */
  locked: boolean;
  pending: boolean;
  /** The last cast/move on THIS look was refused — "Try again". */
  failed?: boolean;
  onToggle: () => void;
  /** Required when `failed` — retries the same move. */
  onRetry?: () => void;
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

  // The two-second floor before a still-pending pill dims.
  //
  // `overdue` says only "the timer has fired since this flight began". Whether
  // that shows is DERIVED — `dim` below — because a pill that is no longer
  // pending is never dimmed regardless of what the timer did. Clearing it with
  // a `setDim(false)` inside the effect instead was a synchronous set during an
  // effect: it worked, and it cost every settled vote an extra render pass for
  // a value the render could already work out for itself.
  const [overdue, setOverdue] = useState(false);
  const dimTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!pending) return;
    dimTimer.current = setTimeout(() => setOverdue(true), DIM_AFTER);
    return () => {
      if (dimTimer.current) clearTimeout(dimTimer.current);
      // In cleanup, not in the body: this runs when the flight ends, so the
      // next one starts from undimmed rather than inheriting this one's state.
      setOverdue(false);
    };
  }, [pending]);

  const dim = pending && overdue;

  const shown = guess && guess.from === picked ? guess.want : picked;

  if (mine) {
    // "Zero is quiet" (contract §3) applies here too — the tally-only pill on
    // your own look must not become the one place "0 picks" still prints.
    return votes > 0 ? (
      <View className="flex-row items-center" style={{ minHeight: MIN_TAP_TARGET - 12 }}>
        <Text variant="colophon">{tally}</Text>
      </View>
    ) : (
      <View style={{ minHeight: MIN_TAP_TARGET - 12 }} />
    );
  }

  // Locked and not mine: "Voting closed" — atlas L-06, "after the occasion
  // starts. Inert, not hidden — the counts stay readable." A pill shape, so
  // the row doesn't jump when it stops being a button, but no press handler:
  // the tally itself moves to the voter line below the card.
  if (locked) {
    return (
      <View
        style={{ minHeight: MIN_TAP_TARGET - 8 }}
        className="flex-row items-center justify-center rounded-md border border-hairline px-3.5">
        {/* `muted`, not the atlas's literal `#8A8578` (== `faint`) — hard rule
            #3 is that `faint` is never body/label text (~3.5:1, fails AA).
            `Button`'s disabled `filled` tone is the one place this app
            accepts a sub-AA disabled label, and only because WCAG exempts
            disabled controls outright; this is a plain inert pill with no
            such exemption on file, so it takes the AA-clean step instead. */}
        <Text variant="label" style={{ color: theme.muted }}>
          Voting closed
        </Text>
      </View>
    );
  }

  if (failed) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Your pick didn’t go through — try again"
        onPress={onRetry}
        // Inline: the atlas's refused ring is `critical` at 45%, which has no
        // token of its own — `theme.critical` is opaque and `rule` is the
        // wrong hue for a refusal.
        style={{ minHeight: MIN_TAP_TARGET - 8, borderColor: `${theme.critical}73` }}
        className="flex-row items-center justify-center gap-1.5 rounded-md border px-3.5 active:opacity-70">
        <Text variant="label" style={{ color: theme.critical }}>
          Try again
        </Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={shown ? `Picked, ${tally}. Take your pick back` : `Vote for this look, ${tally}`}
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
        // The dim IS the working signal, and only past the two-second floor —
        // it used to sit under a spinner that had replaced the label, so a
        // tap on "Vote" showed nothing readable as "picked" until the round
        // trip settled.
        dim ? 'opacity-40' : '',
      ].join(' ')}>
      {shown ? (
        <SymbolView
          name="checkmark"
          size={12}
          tintColor={theme.canvas}
          resizeMode="scaleAspectFit"
        />
      ) : null}
      <Text
        variant="label"
        style={{ color: shown ? theme.canvas : theme.ink }}>
        {shown ? 'Picked' : 'Vote'}
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

/**
 * "Add yours" — the one-look board's pill (L-06): "A vote against nothing is
 * not a vote, and a lone crowned card is not a favourite." Replaces the Vote
 * pill entirely rather than disabling it, on every card, whoever posted it.
 */
export function AddYoursPill({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add your own look to the board"
      onPress={onPress}
      style={{ minHeight: MIN_TAP_TARGET - 8 }}
      className="flex-row items-center justify-center rounded-md border border-rule px-3.5 active:opacity-70">
      <Text variant="label" style={{ color: theme.ink }}>
        Add yours
      </Text>
    </Pressable>
  );
}
