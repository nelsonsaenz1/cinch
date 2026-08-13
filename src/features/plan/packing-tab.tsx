import { useQueryClient } from '@tanstack/react-query';
import { View } from 'react-native';

import { ExampleTrip } from '@/components/plan/plan-examples';
import { Button, ErrorState, ListSkeleton, Text } from '@/components/ui';
import { PL_C3_GATE } from '@/features/examples/example-copy';

import { PackingTrip } from './packing-trip';
import { daysBetween, type Trip } from './trip';
import { TripQuestionnaire } from './trip-questionnaire';
import { usePackingAccess, type UnlockState } from './use-packing-access';
import { STALL_DEADLINE_MS, useStalled } from './use-stalled';
import { useLastPackedTrip, useStartTrip, type SavedTrip } from './use-trips';

/**
 * Packing, end to end: the gate, the questions, the trip.
 *
 * WHAT THIS REPLACED. Packing used to open on a text field, and — for anyone
 * whose closet was below the styling threshold — on a full-screen empty state
 * whose only action pushed `/capture`. So the first thing a new user saw on the
 * Packing tab was the camera, which is the founder's complaint in one sentence:
 * the screen asked for work before it offered any thinking. The camera entry
 * point is gone from packing entirely (the Week mode keeps it, where "add
 * clothes" is genuinely the next step), and what opens instead is four
 * questions.
 */

/** The fields K-01's history line actually reads — not a full `SavedTrip`. */
type LastTripSummary = Pick<SavedTrip, 'destination' | 'startsOn' | 'endsOn' | 'pieceCount' | 'lookCount'>;

const GATE_BULLETS = [
 'Four questions, then destination weather for your actual dates.',
 'A look for every day part — not a pile of clothes.',
 'Repeats counted, so the bag stays small.',
];

/**
 * Spelled out, matching the atlas ("four days in Lisbon", "eleven pieces and
 * nine looks") and `packing-math.ts`'s own private `word()` table — that
 * module is Phase 1's and read-only here, so this is a second, small copy
 * rather than an edit to a shared file. Filed as a primitive request
 * (`.redesign/primitive-requests/q.md`) since two identical tables in one
 * repo is exactly the kind of drift the shared layer exists to prevent.
 */
const NUMBER_WORDS = [
 'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen',
 'nineteen', 'twenty',
];
const numberWord = (n: number): string => NUMBER_WORDS[n] ?? String(n);

/**
 * K-01's history line — "Your last trip — four days in Lisbon — came out at
 * eleven pieces and nine looks." Renders nothing if either count is somehow
 * unset (defensive: `useLastPackedTrip` already filters to trips with
 * `saved_at`, which in practice always carries both counts together).
 */
function LastTripLine({ trip }: { trip: LastTripSummary }) {
  if (trip.pieceCount == null || trip.lookCount == null) return null;
  const days = daysBetween(trip.startsOn, trip.endsOn);

  return (
    <View className="rounded-md bg-tray px-3.5 py-3">
      <Text variant="body">
        Your last trip — {numberWord(days)} {days === 1 ? 'day' : 'days'} in {trip.destination.name} — came
        out at {numberWord(trip.pieceCount)} pieces and {numberWord(trip.lookCount)} looks.
      </Text>
    </View>
  );
}

/**
 * K-01 — the gate a free user sees, showing exactly the thing it is gating
 * (docs/design/membership-packing-contract.md §2.4). Composed straight on the
 * page rather than inside a card — the atlas draws no plate here, just the
 * headline, the paragraph, the three bullets and (when there is one) the
 * user's own history.
 *
 * Presentational and exported so the dev route can drive both the "history"
 * and "first trip" states without a network round trip — the same split
 * `dev-comments.tsx` uses for `CommentRow`.
 *
 * ── PL-C3 — THE PAYOFF BEFORE THE GATE, AND NO PRICE ON IT ────────────────
 *
 * Two changes, and the second is the load-bearing one.
 *
 * The example trip now sits above the action: "the example shows the payoff
 * before the gate, in that order". A gate that names a tier without showing
 * what is behind it is asking for a decision on no information.
 *
 * And the PRICE IS GONE. This used to print "$14.99/mo · $119/yr" from
 * `PLANS.pro`'s hint fields — figures verified against the Superwall products,
 * but hints all the same, formatted in no particular locale and read from a
 * constant rather than from StoreKit. The correction's rule is flat: "Packing
 * gate names the tier only. No price, period, trial or renewal sentence —
 * those resolve from StoreKit on the membership sheet." Which is also the
 * safer arrangement: a stale number on a gate is a promise the purchase sheet
 * then breaks, and App Review reads the same screen.
 */
export function PackingGate({
  lastTrip,
  onUnlock,
  unlockState,
}: {
  lastTrip: LastTripSummary | null;
  onUnlock: () => void;
  unlockState: UnlockState;
}) {
  const unavailable = unlockState === 'unavailable';

  return (
    <View className="px-gutter pt-2">
      <Text variant="title" trim>
        Pack from the closet you already own.
      </Text>

      <Text variant="body" className="mt-4 text-muted">
        Tell Cinch where you’re going and who with. It checks the weather
        there, then builds the bag day by day — wearing the same trousers
        three ways instead of packing three pairs.
      </Text>

      <View className="mt-5 overflow-hidden rounded-plate border border-rule">
        {GATE_BULLETS.map((line, i) => (
          <View
            key={line}
            className={[
 'flex-row gap-2.5 px-4 py-3.5',
              i < GATE_BULLETS.length - 1 ? 'border-b border-hairline' : '',
            ].join(' ')}>
            <Text variant="body">•</Text>
            <Text variant="body" className="flex-1">
              {line}
            </Text>
          </View>
        ))}
      </View>

      {/* A first-time user gets no line at all — never an invented Lisbon. */}
      {lastTrip ? (
        <View className="mt-4">
          <LastTripLine trip={lastTrip} />
        </View>
      ) : null}

      {/*
        THE CTA IS NEVER ALLOWED TO DEAD-END.

        The membership sheet behind this button is not live yet, and a button
        that opens nothing is worse than one that admits it — the user taps,
        judges the app broken, and is right. When `unlock()` comes back having
        shown nobody anything, the action is replaced by one quiet line in the
 page's own grammar. No alert, no toast: this is information, and the
        guide sets information in the surface it belongs to.
      */}
      {/* PL-C3 — what a packed trip looks like, before being asked to pay for
          one. Inert, labelled, and it spends nothing: no destination weather
          call, no closet read, no packing computation. */}
      <View className="mt-6">
        <ExampleTrip />
      </View>

      {/* The tier, and nothing else about it. */}
      <Text variant="body" className="mt-6 text-muted">
        {PL_C3_GATE.line}
      </Text>

      {unavailable ? (
        // `muted`, not `faint`: this line is the only statement of why there
        // is no button, so it is real content, and `faint` on canvas fails
        // AA (see the contrast note in ui/text.tsx). Quiet is the voice, not
        // the contrast.
        <Text variant="body" className="mt-3 text-muted">
          Membership opens soon — Packing unlocks with it.
        </Text>
      ) : (
        // The screen's one oxblood action. It opens the membership sheet,
        // which is where every term — price, period, renewal — is read live
        // from StoreKit and stated in the reader's own currency.
        <Button
          title={PL_C3_GATE.action}
          onPress={onUnlock}
          loading={unlockState === 'opening'}
          haptic
          className="mt-4 self-stretch"
        />
      )}
    </View>
  );
}

/** Reads the real history, then hands off to the presentational gate above. */
function PackingLocked({
  onUnlock,
  unlockState,
}: {
  onUnlock: () => void;
  unlockState: UnlockState;
}) {
  const lastPacked = useLastPackedTrip();
  return <PackingGate lastTrip={lastPacked.data ?? null} onUnlock={onUnlock} unlockState={unlockState} />;
}

/**
 * @param trip The answered questionnaire, held by the Plan screen rather than
 *   here. This component unmounts the moment someone taps Week, and an answered
 *   trip that evaporates because the user glanced at their calendar is five
 *   taps thrown away for nothing.
 */
export function PackingTab({
  active,
  trip,
  onTrip,
}: {
  active: boolean;
  trip: Trip | null;
  onTrip: (trip: Trip | null) => void;
}) {
  const access = usePackingAccess(active);
  const qc = useQueryClient();
  const stalled = useStalled(access.loading, STALL_DEADLINE_MS);
  const startTrip = useStartTrip();

  /**
   * A finished questionnaire is recorded immediately, before anything is
   * packed — so K-06's "your answers are saved" is true after a later
   * timeout, and so K-01's own history line has something to quote next time.
   *
   * The write is fire-and-forget on purpose. Packing proceeds from the
   * answers already in memory either way; a failed insert here costs only the
   * ability to reopen this trip later, which is not worth turning a finished
   * questionnaire into an error screen over.
   */
  const handleComplete = (finished: Trip) => {
    startTrip.mutate(finished, { onError: () => {} });
    onTrip(finished);
  };

  // The entitlement is unknown for one round trip on a cold start. Drawing the
  // lock during it would flash "you have not paid" at a paying subscriber —
  // the one wrong answer that costs a support ticket rather than a second.
  //
  // Bounded, though: a subscription read that never settles must not leave the
  // skeleton running forever (see `use-stalled`). Failing to an error with a
  // retry is also the safe direction — it shows nobody the lock, and it shows
  // nobody the questionnaire.
  if (access.loading) {
    return stalled ? (
      <ErrorState
        compact
        kicker="Couldn’t reach it"
        title="Couldn’t check your membership"
        body="Cinch couldn’t read your membership just now, so it won’t guess. This is a connection problem — nothing about your account has changed."
        onRetry={() => void qc.invalidateQueries({ queryKey: ['subscription'] })}
      />
    ) : (
      <ListSkeleton count={3} avatar={false} />
    );
  }

  if (!access.allowed) {
    return <PackingLocked onUnlock={access.unlock} unlockState={access.unlockState} />;
  }

  if (!trip) return <TripQuestionnaire onComplete={handleComplete} />;

  return <PackingTrip trip={trip} onStartAgain={() => onTrip(null)} />;
}
