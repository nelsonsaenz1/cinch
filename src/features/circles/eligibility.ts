/**
 * Who can be asked into this group, and who cannot — the arithmetic behind
 * PC-03's picker and PC-10's unavailable rows.
 *
 * PURE. No React, no react-native, no Supabase client. This is the one part of
 * the feature that is a calculation rather than a round trip, it is the part
 * that decides whether a control is live under somebody's finger, and it is
 * the part a node test can execute for real — which is why it lives apart from
 * the hooks, the same split `visibility-flags.ts` makes from
 * `use-closet-visibility.ts` and for the same reason.
 *
 * ── THE ARITHMETIC, AND THE OFF-BY-ONE IT IS WRITTEN AROUND ───────────────
 *
 * A seat is held by `invited` OR `joined`, together. Counting only `joined`
 * would let an owner hold any number of outstanding invitations against twelve
 * seats, and the failure would land on the twelfth person to tap Accept — a
 * race whose loser cannot understand it and could not have avoided it.
 * `enforce_circle_size` counts both and refuses at the invitation, and this
 * file counts the same way so the picker refuses in the same place.
 *
 * THE OWNER OCCUPIES ONE OF THE TWELVE. `handle_new_circle` writes their
 * `owner/joined` row in the same transaction that creates the group, so a
 * fresh group has ELEVEN invitations available and not twelve. The preparation
 * document's §5 cases 14-15 count invitations as if the owner sat outside the
 * cap; the atlas is explicit that "a group holds twelve people", so the people
 * are what is counted, and the pgTAP file's assertions 39-40 are the record of
 * that correction. `tests/private-circles-eligibility.test.ts` pins the
 * eleven.
 *
 * `removed`, `declined` and `left` hold NO seat. That is what makes a group
 * recoverable after a mistake without deleting any history — and it is also
 * why somebody with one of those rows is still a candidate here: asking them
 * back is an UPDATE of the row that already exists, not a second INSERT.
 *
 * ── AND PENDING SELECTIONS COUNT TOO ──────────────────────────────────────
 *
 * The picker is a multi-select, and each tick is a seat that will be taken the
 * moment Invite is pressed. Counting only what the server has already stored
 * would let somebody tick fourteen people and meet the cap as five separate
 * server refusals afterwards. So a ticked row consumes a seat here as well.
 */

import { CIRCLE_MAX_MEMBERS, type CircleMemberState, type InviteIneligibility } from './types';

/** The two states that occupy one of the twelve. The whole cap, as data. */
export const CIRCLE_SEAT_STATES: readonly CircleMemberState[] = ['invited', 'joined'];

/** Does this membership state hold a seat? */
export function holdsCircleSeat(state: CircleMemberState): boolean {
  return CIRCLE_SEAT_STATES.includes(state);
}

/** As much of a roster row as the arithmetic needs. */
export interface CircleSeatRow {
  userId: string;
  state: CircleMemberState;
}

/** How many of the twelve are spoken for, server-side. */
export function circleSeatsTaken(members: readonly CircleSeatRow[]): number {
  return members.reduce((total, member) => (holdsCircleSeat(member.state) ? total + 1 : total), 0);
}

/**
 * How many invitations still fit, counting anything already ticked in the
 * picker. Never negative: a group that is somehow over the cap has no seats,
 * not minus one.
 */
export function circleSeatsRemaining(
  members: readonly CircleSeatRow[],
  pendingSelections = 0,
): number {
  return Math.max(0, CIRCLE_MAX_MEMBERS - circleSeatsTaken(members) - pendingSelections);
}

/** One row of the picker, decided. */
export interface CircleInviteRow {
  userId: string;
  /** Null when the row can be chosen. */
  ineligibility: InviteIneligibility;
  /** `ineligibility === null`, named so a component does not have to know that. */
  selectable: boolean;
  /** Already ticked. A ticked row stays selectable so it can be un-ticked. */
  selected: boolean;
}

export interface CircleInviteRowsInput {
  /** Everyone the picker is drawing, in the order it will draw them. */
  candidateIds: readonly string[];
  /** The caller's current mutual friends. Membership of this list is eligibility. */
  mutualFriendIds: readonly string[];
  /** The group's roster as it stands, every state included. */
  members: readonly CircleSeatRow[];
  /** Rows already ticked in this picker session. */
  selectedIds?: readonly string[];
}

/**
 * Decide every picker row.
 *
 * ── WHAT COMES BACK, AND WHAT DOES NOT ────────────────────────────────────
 *
 * One row per candidate WHO DOES NOT ALREADY HOLD A SEAT, in candidate order.
 * Somebody already `invited` or `joined` is not a picker row at all — they are
 * in the group, and offering to invite them again is an offer the primary key
 * would refuse. Somebody `removed`, `left` or `declined` IS a row: asking them
 * back is the path that makes one mis-tapped Remove undoable, and the seat
 * arithmetic treats them exactly as it treats a stranger, because their row
 * holds no seat.
 *
 * ── WHY `not_mutual` WINS OVER `group_full` ───────────────────────────────
 *
 * Both can be true of the same row. The reason shown is the one that is about
 * the person rather than the room: a full group empties, and the row becomes
 * available; a friendship that ended does not come back when a seat does.
 * Saying "Group is full" to somebody who could not be invited into an empty
 * group either would be a promise the next tap breaks.
 *
 * ── AND WHY A TICKED ROW IS ALWAYS SELECTABLE ─────────────────────────────
 *
 * The twelfth tick fills the group; if that made every ticked row inert, the
 * only way out of an over-full selection would be to leave the screen. A
 * ticked row can always be un-ticked. A ticked row whose friendship has since
 * lapsed is still `not_mutual` — that one is not a matter of room.
 */
export function circleInviteRows(input: CircleInviteRowsInput): CircleInviteRow[] {
  const selectedIds = input.selectedIds ?? [];
  const mutual = new Set(input.mutualFriendIds);
  const selected = new Set(selectedIds);
  const seated = new Set(
    input.members.filter((member) => holdsCircleSeat(member.state)).map((member) => member.userId),
  );

  // Deduplicated, seat-holders dropped, order preserved.
  const seen = new Set<string>();
  const rows: string[] = [];
  for (const userId of input.candidateIds) {
    if (seen.has(userId) || seated.has(userId)) continue;
    seen.add(userId);
    rows.push(userId);
  }

  // Only ticks that are actually going to be written count against the cap: a
  // stale selection of somebody who has since been invited by another device
  // is already counted in `seated`, and counting it twice would refuse a seat
  // that exists.
  const pending = rows.filter((userId) => selected.has(userId)).length;
  const remaining = circleSeatsRemaining(input.members, pending);

  return rows.map((userId) => {
    const isSelected = selected.has(userId);
    const ineligibility: InviteIneligibility = !mutual.has(userId)
      ? 'not_mutual'
      : isSelected || remaining > 0
        ? null
        : 'group_full';

    return { userId, ineligibility, selectable: ineligibility === null, selected: isSelected };
  });
}
