import { Pressable, View } from 'react-native';

import { WarmBand } from '@/components/circles/room-parts';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Text } from '@/components/ui/text';
import {
  ACCEPT_REFUSED_FULL,
  ALONE,
  FULL,
  GROUP_GONE,
  NO_GROUPS,
  OFFLINE,
} from '@/features/circles/copy';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

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
 *
 * ── WHO OWNS THE GUTTER ─────────────────────────────────────────────────────
 *
 * Two of these wrap a HOUSE state (`EmptyState`, `ErrorState`) and those two
 * carry `px-gutter` themselves, so `NoGroupsState` and `GroupsOfflineState`
 * must be rendered from a container that does NOT pad — every frame in the
 * atlas sets one 20pt page margin, and the shipped screens were nesting the
 * kit's gutter inside their own and drawing the empty and offline copy at 40.
 * `SCREEN_STATE_OWNS_GUTTER` is the flag the screens branch their
 * `contentContainerClassName` on.
 *
 * Everything else here — the liveness state, the boundary notices — is this
 * lane's own composition and carries no margin at all, so it sits on whatever
 * gutter the screen already established.
 */

/**
 * The states that bring their own page margin, for a screen deciding whether
 * to pad its scroller. Exported as data rather than left to each screen's memory:
 * the failure it prevents is invisible until two screens are compared.
 */
export const SCREEN_STATE_OWNS_GUTTER = ['no_groups', 'offline'] as const;

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
    <View>
      {/*
        AUDIT 100 #28. This used to be `flex-1 justify-center` — the
        explanation dead-centred in whatever height the screen happened to
        have, with the button pinned to the very foot below it. On a
        Pro-sized phone with a short "No groups yet." body, that reads as a
        wall of empty canvas: the reader lands on a nearly blank page. The
        block now sits where a reader's eye already is, right under the
        masthead, and the button follows immediately after it rather than
        anchoring to the bottom safe area. `compact` drops `EmptyState`'s own
        flex-centring; the action stays this screen's own so it can keep the
        primary/oxblood treatment `EmptyState`'s ink default would not give it.
      */}
      <EmptyState symbol={NO_GROUPS.symbol} title={NO_GROUPS.title} body={NO_GROUPS.body} compact />

      <View className="px-gutter">
        {/*
          `primary`, not `EmptyState`'s ink default. The house rule is one
          oxblood commitment per screen and empty-state ways forward are
          normally ink so they do not spend it — but this screen has exactly one
          action on it and PC-01 draws that action in the accent. There is
          nothing here for the oxblood to compete with.
        */}
        <Button
          title={NO_GROUPS.action}
          variant="primary"
          onPress={onCreate}
          haptic
          accessibilityLabel={NO_GROUPS.action}
          className="mt-2 self-stretch"
        />
        {/* Centred under the button, where the frame sets it: it is a caption
            on the act, not a paragraph of the page. */}
        <Text variant="note" className="mt-3.5 text-center">
          {NO_GROUPS.footnote}
        </Text>
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
 * So it is the kit's parts without the kit's grammar: the same serif step, the
 * same `muted` body — and no glyph, because every glyph in the states kit means
 * absence.
 *
 * ── AND IT NO LONGER CARRIES THE BUTTON ─────────────────────────────────────
 *
 * It used to. In redesign 27 the room's invite control is pinned to the foot of
 * the screen for every state that has one, so an `alone` group whose action sat
 * mid-page would be the one composition where the same act appeared somewhere
 * else. `ALONE.action` is still the label — "Invite a friend" is not
 * `OVERVIEW.invite`'s "Invite someone", because this state is asking for THE
 * first person — the room screen just chooses between the two words. The band
 * is what this component is now: the sentence, on the warm ground, above the
 * table it is talking about.
 */
export function AloneState() {
  return (
    <View accessibilityRole="summary">
      <WarmBand>
        <Text variant="plate" trim>
          {ALONE.title}
        </Text>
        <Text variant="body" className="mt-3 text-muted">
          {ALONE.body}
        </Text>
      </WarmBand>
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
function BoundaryNotice({
  title,
  body,
  action,
  tone = 'tray',
}: {
  title: string;
  body: string;
  /**
   * The remedy, when the state has one and it lives somewhere else.
   *
   * A text control rather than a filled button, and never the page's accent
   * fill: these states sit above whatever the screen is really for, and a
   * second oxblood slab here would argue with it. Its own 44pt floor and
   * `hitSlop`, because it is a navigation out of the state and a graze off the
   * sentence above it would be a page change nobody asked for.
   */
  action?: { label: string; onPress: () => void };
  /** `tray` for a boundary, `blush` for an offer. See `WarmBand`. */
  tone?: 'blush' | 'tray';
}) {
  const theme = useTheme();
  return (
    <View className="mt-6" accessibilityRole="summary">
      {/*
        A BAND, WHERE THIS USED TO BE A RULE AND A SERIF LINE.

        The shipped composition was a hairline with a headline under it, which
        on a page made of hairlines and headlines was invisible — the one state
        that has to interrupt the reader looked like the next section. The
        redesign gives it the recessed ground and lets the page's own margin do
        the separating.

        The ARGUMENT for the shape is unchanged and is the reason it is still
        not `EmptyState` or `ErrorState`. A full group has twelve people in it,
        so a glyph of absence over it would be false in the most literal way
        available; and nothing failed, so "Cinch couldn't read this just now"
        would be a lie about which half went wrong. `summary` rather than
        `alert`: this is a fact about the room that is simply true, not an event
        that arrived.
      */}
      <WarmBand tone={tone}>
        <Text variant="plate" trim>
          {title}
        </Text>
        <Text variant="body" className="mt-3 text-muted">
          {body}
        </Text>
        {action ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={action.onPress}
            hitSlop={8}
            style={{ minHeight: MIN_TAP_TARGET }}
            className="mt-1 justify-center self-start active:opacity-60">
            <Text variant="label" style={{ color: theme.accent }}>
              {action.label}
            </Text>
          </Pressable>
        ) : null}
      </WarmBand>
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
 *
 * `onManage` is optional because the notice also appears on the group's own
 * screen, where the manage surface is already one control away and a second
 * door to it would be two links to one room.
 */
export function GroupFullNotice({ onManage }: { onManage?: () => void } = {}) {
  return (
    <BoundaryNotice
      title={FULL.title}
      body={FULL.body}
      action={onManage ? { label: FULL.action, onPress: onManage } : undefined}
    />
  );
}

/**
 * PC-09b · the group that is not there any more.
 *
 * A READ THAT SUCCEEDED AND CAME BACK WITH NOTHING. Not `ErrorState` — nothing
 * failed, and "Cinch couldn't read this just now" would send somebody to pull
 * to refresh a group that is never coming back. Not `EmptyState` either: the
 * claim is about one row's absence, not about a collection being empty.
 *
 * So it is the boundary shape, with the way out attached, because this state's
 * whole content is that there is nowhere further in.
 */
export function GroupGoneNotice({ onBack }: { onBack: () => void }) {
  return (
    <BoundaryNotice
      title={GROUP_GONE.title}
      body={GROUP_GONE.body}
      action={{ label: GROUP_GONE.action, onPress: onBack }}
    />
  );
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
    // Blush, unlike the other two boundaries: this one sits directly under the
    // invitation band it belongs to, and it is not telling the reader the door
    // is closed — it is telling them the invitation is still theirs. A tray
    // ground beneath a blush band would read as the offer being withdrawn.
    <BoundaryNotice
      tone="blush"
      title={ACCEPT_REFUSED_FULL.title}
      body={ACCEPT_REFUSED_FULL.body}
    />
  );
}
