/**
 * WHICH VERB EACH PICKED PERSON NEEDS — INSERT, OR UPDATE.
 *
 * `circle_members` has a primary key on (circle_id, user_id) and there is no
 * DELETE grant on the table, so a membership row is created ONCE and thereafter
 * only ever changes state. That makes "invite" two different writes wearing one
 * word:
 *
 *   · somebody with no row      → INSERT  (`useInviteMembers`)
 *   · somebody with a row       → UPDATE  (`useReInviteMember`)
 *
 * ── THE DEFECT THIS EXISTS TO PREVENT ───────────────────────────────────────
 *
 * Sending everybody down the INSERT path makes asking somebody back raise
 * `23505` — a unique violation — every single time, forever. `classifyCircleError`
 * reads 23505 as `stale`, and `circleFailureIsSilent` says a stale view is the
 * interface's problem: refetch and say nothing. So the owner taps the button,
 * something spins, the roster redraws unchanged, and NOTHING IS EVER SAID. The
 * schema's whole re-invite path — the thing that makes one mis-tapped Remove
 * undoable rather than a permanent exclusion from a twelve-seat group — is
 * unreachable, and unreachable silently.
 *
 * That classification is not wrong; it is right for the case it was written
 * for. 23505 genuinely IS a stale view WHEN THE CLIENT PICKED THE RIGHT VERB —
 * it then means another device wrote the row between this screen's read and its
 * write, which is a race, and refetching is exactly the remedy. Routing here is
 * what makes the silence honest, so this module and that branch of the
 * classifier hold each other up.
 *
 * ── AND WHY NOTHING NEW HAD TO BE EXPOSED TO BUILD IT ───────────────────────
 *
 * `circleInviteRows` already omits everybody holding a seat, so every row a
 * picker draws is either a stranger to the group or somebody whose row reads
 * `removed`, `left` or `declined`. `useCircleMembers` already returns the
 * roster in every state. The state is therefore in hand at the call site, and
 * this function reads it rather than inferring it from anything.
 *
 * Pure, and in the data lane rather than in the screen, for the usual reason:
 * the branch that matters is the one that is hard to reach by hand, and a
 * routing decision made inline in a component is a routing decision no test
 * ever sees.
 */

import { holdsCircleSeat, type CircleSeatRow } from './eligibility';

/** The two writes, and the people each one is for. */
export interface CircleInviteRouting {
  /** No membership row yet — INSERT, via `useInviteMembers`. */
  invite: string[];
  /** A row in `removed`, `left` or `declined` — UPDATE, via `useReInviteMember`. */
  reinvite: string[];
}

export interface CircleInviteRoutingInput {
  /** The ids ticked in the picker, in the order they were ticked. */
  selectedIds: readonly string[];
  /** The group's roster as it stands, every state included. */
  members: readonly CircleSeatRow[];
}

/**
 * Split a selection into the two writes it actually needs.
 *
 * Order within each list is the order they were ticked, so a partial failure is
 * reproducible rather than depending on map iteration.
 *
 * A SEAT-HOLDER IS DROPPED ENTIRELY rather than routed to either verb. They are
 * already `invited` or `joined`: the INSERT would be a unique violation and the
 * UPDATE would re-invite somebody who is currently in the group, which for a
 * `joined` member would quietly throw them out of it. `circleInviteRows` does
 * not offer them, so reaching this function means the roster moved underneath
 * the selection — and dropping them lets the writes that ARE still valid
 * proceed, with the refetch afterwards showing the truth.
 *
 * Duplicates are collapsed. A double-ticked id would otherwise be written
 * twice, and the second write is the one that raises.
 */
export function routeCircleInvites(input: CircleInviteRoutingInput): CircleInviteRouting {
  const state = new Map(input.members.map((member) => [member.userId, member.state]));

  const invite: string[] = [];
  const reinvite: string[] = [];
  const seen = new Set<string>();

  for (const userId of input.selectedIds) {
    if (seen.has(userId)) continue;
    seen.add(userId);

    const prior = state.get(userId);
    if (prior === undefined) {
      invite.push(userId);
      continue;
    }
    // Currently in the group, or currently asked. Neither write is correct.
    if (holdsCircleSeat(prior)) continue;
    reinvite.push(userId);
  }

  return { invite, reinvite };
}
