import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Rule } from '@/components/ui/rule';
import { Text } from '@/components/ui/text';
import {
  ACCEPT_REFUSED_FULL,
  ALONE,
  FULL,
  NO_GROUPS,
  OFFLINE,
} from '@/features/circles/copy';

/**
 * THE STATES WITH NO ROWS IN THEM — PC-01, PC-09, PC-10, and the liveness one.
 *
 * Every one is presentational: props in, no query, no navigation, no mutation,
 * and no state of its own. That last part is load-bearing rather than tidy — a
 * component here that owned a `useState` would give the surface a reason to
 * remount it, and a remounted list starts at the top.
 *
 * ── NOTHING HERE IS A FIXED HEIGHT ──────────────────────────────────────────
 *
 * No heights, no `numberOfLines`, no capped containers. The compositions grow
 * and the page scrolls, which is the only answer the accessibility contract
 * permits for AX-XXXL.
 */

// ---------------------------------------------------------------------------
// PC-01 · No groups yet
// ---------------------------------------------------------------------------

/**
 * The kit's `EmptyState`, unchanged, plus the footnote the frame prints under
 * it.
 *
 * `EmptyState` is exactly right here and is reused rather than redrawn, so this
 * screen inherits the claims discipline it holds: an empty state describes the
 * data, and only renders once you KNOW there is nothing. That is why the
 * resolver puts `loading` and `offline` ahead of `no_groups` — reaching for
 * this component on a pending or failed read is how "No one is blocked." came
 * to be shown to somebody whose blocks were merely unreadable.
 *
 * The footnote is the sentence that makes the whole feature legible, and it is
 * true by construction rather than by promise: `circles`' select policy is
 * `can_see_circle(id)`, so a non-member's query returns nothing at all. There
 * is no listing to search and no existence oracle to search it with.
 */
export function NoGroupsState({ onCreate }: { onCreate: () => void }) {
  return (
    <View className="flex-1">
      <EmptyState
        symbol={NO_GROUPS.symbol}
        title={NO_GROUPS.title}
        body={NO_GROUPS.body}
        actionTitle={NO_GROUPS.action}
        onAction={onCreate}
      />
      <View className="px-gutter pb-8">
        <Text variant="note">{NO_GROUPS.footnote}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// The liveness state · a group with only its owner in it
// ---------------------------------------------------------------------------

/**
 * NOT AN EMPTY STATE, AND THAT IS THE WHOLE POINT.
 *
 * This lane owes a justification for every composition it does not take from
 * the kit, and this is the first of two.
 *
 * `EmptyState` was the obvious reach and is wrong here on its own terms. Its
 * docblock says it "makes a claim about the data: there is nothing here", and
 * it draws that claim with a glyph of absence, a serif headline and a
 * corrective action. A group with one member is not missing anything. It was
 * created seconds ago, it exists, it is on screen, and its owner is in it —
 * `handle_new_circle` put them there in the same transaction. The schema
 * enforces no floor of two precisely because a minimum would make creation
 * impossible, so this state is not a degenerate case, it is the FIRST case.
 *
 * Rendering it through `EmptyState` would put a symbol of absence in front of
 * somebody who has just succeeded, and they would go looking for what they had
 * done wrong.
 *
 * So it is the kit's parts without the kit's grammar: the same gutter, the same
 * serif step, the same `muted` body, the same ink action — and no glyph,
 * because every glyph in the states kit means absence.
 */
export function AloneState({ onInvite }: { onInvite: () => void }) {
  return (
    <View className="flex-1 justify-center px-gutter" accessibilityRole="summary">
      <Text variant="title" trim>
        {ALONE.title}
      </Text>
      <Text variant="body" className="mt-4 text-muted">
        {ALONE.body}
      </Text>
      <Button
        title={ALONE.action}
        onPress={onInvite}
        haptic
        variant="ink"
        className="mt-8 self-stretch"
        accessibilityLabel={ALONE.action}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// PC-09 · Offline
// ---------------------------------------------------------------------------

/**
 * `ErrorState`, unchanged, so this screen inherits the one thing that matters:
 * an error state refuses to describe the data. "Nothing changed" is a claim
 * about the WRITE side — nobody joined, nobody left, nothing was canceled —
 * and it is the sentence an empty state would have got wrong.
 *
 * `onRetry` is required rather than optional. Without it the screen is a dead
 * end, and the state the reader is in is the one where trying again is the
 * whole remedy. `ErrorState` also carries `accessibilityRole="alert"`, so a
 * failure that appears after a wait is announced rather than merely findable by
 * swiping to it.
 *
 * No `kicker` here, unlike Daily Social's offline screen: the headline's first
 * word already says it, and a caps lead-in above it would be the same
 * announcement twice.
 */
export function GroupsOfflineState({
  onRetry,
  retrying = false,
}: {
  onRetry: () => void;
  retrying?: boolean;
}) {
  return (
    <ErrorState
      title={OFFLINE.title}
      body={OFFLINE.body}
      retryTitle={OFFLINE.action}
      onRetry={onRetry}
      retrying={retrying}
    />
  );
}

// ---------------------------------------------------------------------------
// PC-10 · Full, and the seat that was gone by the time you answered
// ---------------------------------------------------------------------------

/**
 * A BOUNDARY, NOT AN ABSENCE — the second composition this lane owes an
 * argument for.
 *
 * Both states below are the same shape and neither is an empty state or an
 * error. A full group has twelve people in it; drawing a symbol of absence over
 * a list that is full of people would be false in the most literal way
 * available. And nothing failed — the read worked, the write was refused, and
 * `ErrorState`'s "Cinch couldn't read this just now" would be a lie about which
 * half went wrong.
 *
 * So: a rule, a serif line and a sentence. No glyph, no action, no retry —
 * there is nothing to try again. The remedy, when there is one, is named in the
 * sentence itself ("Remove someone before inviting another") and lives on the
 * manage surface where it can actually be done.
 *
 * `summary` rather than `alert`: this is a fact about the group that is simply
 * true, not an event that arrived.
 */
function BoundaryNotice({ title, body }: { title: string; body: string }) {
  return (
    <View className="px-gutter py-6" accessibilityRole="summary">
      <Rule />
      <Text variant="plate" trim className="mt-5">
        {title}
      </Text>
      <Text variant="body" className="mt-3 text-muted">
        {body}
      </Text>
    </View>
  );
}

/**
 * PC-10 · the cap, stated where the owner can act on it.
 *
 * Drawn at the top of the invite picker rather than at the moment an invitation
 * is refused, which is the whole reason the seat count includes outstanding
 * invitations: counting only members would push this sentence onto the twelfth
 * person to tap Accept, who cannot see the cause and could not have avoided it.
 */
export function GroupFullNotice() {
  return <BoundaryNotice title={FULL.title} body={FULL.body} />;
}

/**
 * The invitation that outlived its seat.
 *
 * Reachable, and only recently: `enforce_circle_size` now guards UPDATE as well
 * as INSERT, so somebody who declined, watched the owner refill their seat and
 * then came back to accept is refused. Before that guard the group could
 * quietly overrun twelve, so this state is the price of the cap actually being
 * a cap.
 *
 * It names nobody — who took the seat is a roster fact and this reader is not
 * on the roster — and it does not throw the invitation away, because the schema
 * does not: the row is still `invited` or `declined`, `can_see_circle` admits
 * both, and accepting later is one tap if a seat comes back.
 */
export function AcceptRefusedNotice() {
  return (
    <BoundaryNotice title={ACCEPT_REFUSED_FULL.title} body={ACCEPT_REFUSED_FULL.body} />
  );
}
