/**
 * EVERY STATE THE PRIVATE-GROUPS FLOW CAN BE IN, AS ONE PURE FUNCTION.
 *
 * Nine, and six of them are emptiness, waiting or failure — which is where a
 * unit like this is actually judged. A screen that resolves its own state
 * inline resolves it slightly differently from the analytics call beside it,
 * and the state that gets under-tested is always one of the six.
 *
 * No React, no react-native, no supabase — the whole point. The node runner
 * exercises the real function rather than a description of it, the same split
 * `daily-social/states.ts` made and for the same reason.
 *
 * ── THE LIVENESS RULE, WHICH IS THE ONE THAT IS EASY TO GET WRONG ───────────
 *
 * "Two to twelve people" is a LIVENESS PROPERTY, NOT AN INVARIANT. A group
 * necessarily begins with one member — its owner — because
 * `handle_new_circle` inserts that row in the same transaction that creates
 * the group, and the schema deliberately enforces no floor: a minimum of two
 * would make creation impossible, and enforced on departure it would trap the
 * second-to-last person in a room they want to leave.
 *
 * So `alone` is a legal, expected, first-thirty-seconds state. It is **not an
 * error and not an empty state**: there is a group, it is real, it is on
 * screen, and the only thing missing is somebody else in it. Drawing it as an
 * empty state would tell the person who just successfully created a group that
 * they have nothing — and drawing it as an error would tell them they broke it.
 *
 * ── WHY `full` IS OWNER-ONLY ────────────────────────────────────────────────
 *
 * The cap is only ever a fact ABOUT INVITING, and only the owner invites (the
 * INSERT policy has one path and no self-join door). A member in a twelve-seat
 * group is in a perfectly ordinary group and must not be shown a wall. So
 * `joined` is resolved before the seat check, deliberately, and `full` is
 * unreachable for a non-owner.
 *
 * ── WHY THE ROSTER IS A FUNCTION OF THE STATE ───────────────────────────────
 *
 * `showsRoster` is here rather than at the call site because it is the atlas's
 * strictest privacy promise — "You will see who else is in it after you accept"
 * — and because the schema keeps it: the membership select policy is `your own
 * row, always; everyone else's only if you are joined`, NOT `can_see_circle`.
 * A screen that decided this for itself would eventually decide it wrongly on
 * one branch, and the branch it got wrong would be the invitation.
 */

import { CIRCLE_MAX_MEMBERS } from './contract-types';

// ---------------------------------------------------------------------------
// The union
// ---------------------------------------------------------------------------

/**
 * The nine, tagged. A discriminated union rather than a bare string union
 * because six of them carry a number the drawing needs — the seat count, the
 * member count, how many invitations are waiting — and a caller that had to
 * re-derive those from the input beside the state is a caller that can derive
 * them from a DIFFERENT input than the one the state was resolved from.
 */
export type CircleState =
  /** Nothing has answered yet. Never an empty state; see the header. */
  | { kind: 'loading' }
  /** The read failed, or the device is offline — PC-09. Never dressed as empty. */
  | { kind: 'offline' }
  /** No groups, and nothing waiting to be answered — PC-01. */
  | { kind: 'no_groups' }
  /**
   * An invitation is waiting on an answer — PC-04. Reached two ways: the
   * reader has opened the invitation, or they have no groups and this is all
   * there is. Either way the roster is hidden until they accept.
   */
  | { kind: 'invited'; invitationCount: number }
  /** Groups to list — PC-06. `invitationCount` may be zero. */
  | { kind: 'groups'; groupCount: number; invitationCount: number }
  /**
   * A group you own with nobody else in it yet, and no invitation outstanding.
   * The liveness state. Legal, expected, and it asks for one person.
   */
  | { kind: 'alone'; seatsFree: number }
  /** A group you own with room in it — PC-06 / PC-07. */
  | { kind: 'owned'; memberCount: number; pendingCount: number; seatsFree: number }
  /** A group you own with every seat taken — PC-10. Owner-only; see the header. */
  | { kind: 'full'; memberCount: number; pendingCount: number }
  /** A group you are in and do not own — PC-06. */
  | { kind: 'joined'; memberCount: number };

export type CircleStateKind = CircleState['kind'];

/** Every kind, in the order the atlas walks them. */
export const CIRCLE_STATES: readonly CircleStateKind[] = [
  'loading',
  'offline',
  'no_groups',
  'invited',
  'groups',
  'alone',
  'owned',
  'full',
  'joined',
];

// ---------------------------------------------------------------------------
// The input
// ---------------------------------------------------------------------------

/**
 * The one group in view.
 *
 * Present when the reader has opened a group, or when a row is being drawn for
 * one. Absent when the question is about the list as a whole.
 */
export interface CircleFocus {
  /**
   * `joined` members, including the owner — `circle_member_count(uuid)`.
   * Never counts invitations: telling an invitee that three other people are
   * "in" a group none of them has agreed to join yet discloses the existence
   * of pending invitations to somebody outside the roster.
   */
  memberCount: number;
  /**
   * Seats held by invitations nobody has answered. Visible to the owner only —
   * they are `joined`, so the roster policy hands them every row in every
   * state, and this is a client-side filter over data they already hold.
   */
  pendingCount: number;
  /** The reader owns this group. */
  isOwner: boolean;
  /**
   * The reader has been invited and has not answered. Outranks everything
   * below it, because until they answer there is no roster to have an opinion
   * about.
   */
  awaitingAnswer?: boolean;
}

export interface CircleStateInput {
  /** The read has not answered yet. Defaults false. */
  loading?: boolean;
  /** The read failed, or the device is offline. */
  failed: boolean;
  /** Groups the reader is `joined` to. */
  groupCount: number;
  /** Invitations awaiting the reader's answer. */
  invitationCount: number;
  /** The group in view, when there is one. */
  group?: CircleFocus;
}

/**
 * A count, defended.
 *
 * A query that has not answered yet hands back `undefined`, and `undefined > 0`
 * is false rather than a crash — which would silently resolve a still-loading
 * screen to `no_groups` and tell somebody with three groups that they have
 * none. Non-finite and negative both floor to zero for the same reason: this
 * function's answers are sentences shown to a person, and it must not have an
 * undefined branch.
 */
function count(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/**
 * How many of the twelve are still free.
 *
 * Counts `invited` together with `joined`, exactly as `circle_seats_taken`
 * does, because a client that counted only members would offer a seat the
 * database is about to refuse. Never negative: a group that has somehow
 * overrun reports zero free rather than a minus sign.
 */
export function seatsFree(memberCount: number, pendingCount: number): number {
  return Math.max(CIRCLE_MAX_MEMBERS - count(memberCount) - count(pendingCount), 0);
}

// ---------------------------------------------------------------------------
// The resolver
// ---------------------------------------------------------------------------

/**
 * Which of the nine the reader is in.
 *
 * Order matters, and every step of it is a refusal:
 *
 *   1. **Loading first.** A screen that has not heard back knows nothing, and
 *      the one thing it must not do is claim there are no groups. `no_groups`
 *      carries a "Create a group" button; drawn over a pending read it invites
 *      somebody to create a second copy of the group they already have.
 *   2. **Failure second.** "Cinch couldn't load your groups. Nothing changed."
 *      A failed read must never be dressed as an empty one — the refusal
 *      `ErrorState` exists for, and the one that made eleven screens tell
 *      people their data had vanished when it was merely unreadable.
 *   3. **A focused group outranks the list**, because the reader is looking at
 *      it. Within the group:
 *      a. **Awaiting an answer first.** Until they accept there is no roster,
 *         no seat count they may see, and no manage surface.
 *      b. **Not the owner next.** The cap is a fact about inviting and only the
 *         owner invites, so a member never meets `full`.
 *      c. **Full before alone and owned**, so an owner at twelve is told the
 *         cause where they can see it rather than at the moment an invitation
 *         is refused.
 *      d. **Alone before owned.** One joined member and nothing outstanding is
 *         the liveness state, not an empty one. An outstanding invitation is
 *         enough to leave it: the owner has already done the thing this state
 *         asks for, and asking again would be the app forgetting.
 *   4. **Then the list.** Nothing at all is `no_groups`; nothing but
 *      invitations is `invited` — PC-01's "No groups yet" over an unanswered
 *      invitation would be true and useless, since the reader's next act is to
 *      answer it, not to create something.
 */
export function resolveCircleState(input: CircleStateInput): CircleState {
  if (input.loading) return { kind: 'loading' };
  if (input.failed) return { kind: 'offline' };

  const group = input.group;
  if (group) {
    const members = count(group.memberCount);
    const pending = count(group.pendingCount);

    if (group.awaitingAnswer) {
      return { kind: 'invited', invitationCount: Math.max(count(input.invitationCount), 1) };
    }
    if (!group.isOwner) return { kind: 'joined', memberCount: members };

    const free = seatsFree(members, pending);
    if (free === 0) return { kind: 'full', memberCount: members, pendingCount: pending };
    if (members <= 1 && pending === 0) return { kind: 'alone', seatsFree: free };
    return { kind: 'owned', memberCount: members, pendingCount: pending, seatsFree: free };
  }

  const groups = count(input.groupCount);
  const invitations = count(input.invitationCount);

  if (groups === 0 && invitations === 0) return { kind: 'no_groups' };
  if (groups === 0) return { kind: 'invited', invitationCount: invitations };
  return { kind: 'groups', groupCount: groups, invitationCount: invitations };
}

// ---------------------------------------------------------------------------
// What each state is allowed to draw
// ---------------------------------------------------------------------------

/**
 * May the roster be on screen?
 *
 * FALSE FOR `invited`, and that is the whole point of the function. PC-04
 * promises "You will see who else is in it after you accept. Nothing of yours
 * is shared until then." The schema keeps it — the membership select policy is
 * `your own row, always; everyone else's only if you are joined`, which is a
 * deliberate departure from `event_members`' `can_see_event` — and this is
 * where the client stops asking for what it would be refused anyway.
 *
 * Also false for the states with no group in view. A list is not a roster.
 */
export function showsRoster(state: CircleState): boolean {
  return state.kind === 'joined' || state.kind === 'owned' || state.kind === 'alone' ||
    state.kind === 'full';
}

/**
 * May the invite affordance be offered?
 *
 * Only to an owner with a seat. A member cannot invite — the INSERT policy has
 * exactly one path and it is `is_circle_owner` — so offering them the control
 * would be drawing a door into a wall. At the cap the control goes away and
 * PC-10's sentence takes its place: the reason is stated, never implied by a
 * greyed-out button.
 */
export function canInvite(state: CircleState): boolean {
  return state.kind === 'alone' || state.kind === 'owned';
}

/**
 * Is this a state whose emptiness is real, rather than a wait or a failure?
 *
 * `no_groups` alone. `loading` knows nothing yet and `offline` knows only that
 * it could not read — neither is entitled to an empty state's claim, and
 * `alone` is not empty at all.
 */
export function isEmpty(state: CircleState): boolean {
  return state.kind === 'no_groups';
}

/**
 * The failure carries no state of its own.
 *
 * Clearing `failed` returns the identical state for identical content, so
 * nothing about having been offline changes what is drawn afterwards. The
 * screens in `components/circles/` hold no state of their own, so the list is
 * never remounted and never keyed on the state — which is the other half of
 * the same promise.
 */
export function stateAfterRecovery(input: CircleStateInput): CircleState {
  return resolveCircleState({ ...input, failed: false, loading: false });
}
