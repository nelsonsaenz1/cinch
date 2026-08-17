/**
 * The private groups unit's shared vocabulary — the one module every other
 * part of the unit binds to.
 *
 * ── IDENTIFIERS SAY CIRCLE, STRINGS SAY GROUP ─────────────────────────────
 *
 * That is the whole vocabulary contract, and it is testable in exactly this
 * form. `Private Circles` is the internal programme label, so the schema, the
 * files and the identifiers follow it (and `group` is a RESERVED word in
 * Postgres besides — 20260818000000:1-13 argues the case). Every string a
 * customer reads says **group** or **private group**, and there is not one such
 * string in this file, in `errors.ts`, or anywhere else in this data layer.
 * The copy module owns the words; this layer owns the classification.
 *
 * ── WHY THESE SHAPES AND NOT THE ROWS ─────────────────────────────────────
 *
 * Nothing here has a runtime dependency: no React, no react-native, no
 * Supabase client. The presentational layer and the node test suite both
 * import it, and a shared interface that drags a native module into a test
 * runner is not shared. The wire shapes live in `db-rows.ts` and are mapped
 * here at the read boundary, the `closet/queries.ts` pattern.
 */

/**
 * Two roles, and the second is every role that is not the first.
 *
 * There is no moderator, no co-owner and no transfer. `circles.owner_id` is
 * the authority and the UPDATE policy's `with check` refuses to let it move,
 * so a second owner is not a thing the database can be talked into.
 */
export type CircleMemberRole = 'owner' | 'member';

/**
 * Five states, and `left` is why this is not `EventMemberState`.
 *
 * Nobody leaves an event — they decline it. A group is durable, people walk
 * out of it, and `removed` reads as ejection to everyone looking at the
 * roster: somebody who left must not appear to have been thrown out. There is
 * no DELETE grant on `circle_members`, so these five are the complete set of
 * things that can be true of a person and a group, forever.
 */
export type CircleMemberState = 'invited' | 'joined' | 'declined' | 'removed' | 'left';

/**
 * Twelve people, and the owner is one of them.
 *
 * `enforce_circle_size` counts `invited` TOGETHER WITH `joined`, and the owner
 * is `joined` from the group's first instant (`handle_new_circle`), so a fresh
 * group has ELEVEN invitations available and not twelve. `eligibility.ts` is
 * where that arithmetic lives; this is the number it lives on, and
 * `tests/private-circles-eligibility.test.ts` reads the same 12 back out of
 * the migration so the two cannot drift.
 */
export const CIRCLE_MAX_MEMBERS = 12;

/** One group as a list row: what it is called, who runs it, how many are in it. */
export interface CircleSummary {
  id: string;
  name: string;
  ownerId: string;
  /**
   * `joined` members only, from the `circle_member_count` RPC — never a count
   * of rows. An invitee can read exactly one membership row (their own), so
   * there is nothing client-side for them to count, and PC-04 draws this
   * number directly above "You will see who else is in it after you accept."
   */
  memberCount: number;
  isOwner: boolean;
}

/**
 * One row of the roster.
 *
 * `displayName` is nullable and that is not defensive: `social_profiles` names
 * only people the caller is already related to, and a co-member who is the
 * owner's mutual friend but a stranger to the reader resolves to no name. The
 * alternative — falling back to `public_profiles` — was not taken, because
 * that view does not screen blocked pairs and `20260810150100` exists
 * precisely to keep a blocked person out of a roster.
 */
export interface CircleMemberEntry {
  userId: string;
  displayName: string | null;
  role: CircleMemberRole;
  state: CircleMemberState;
  /**
   * When they entered `joined`, and null in every other state.
   *
   * There is no `joined_at` column. `updated_at` is exact for this purpose
   * anyway: every legal transition OUT of `joined` leaves the row in some
   * other state, so a row that currently reads `joined` was last written at
   * the moment it became `joined` — including a re-invitation that was
   * accepted again.
   */
  joinedAt: string | null;
}

/** One invitation waiting for the caller: PC-04's frame, in data. */
export interface CircleInvitationEntry {
  circleId: string;
  name: string;
  inviterId: string;
  inviterName: string | null;
  memberCount: number;
  /**
   * When this invitation was made — `updated_at`, not `created_at`. An
   * asking-again is an UPDATE of the row that already exists (the primary key
   * refuses a second INSERT), so `created_at` is the first invitation and the
   * one on screen is the latest.
   */
  invitedAt: string;
}

/**
 * Why a picker row cannot be chosen, or null when it can.
 *
 * Two reasons and no third. There is deliberately no `blocked`: a block
 * severs both follow edges permanently, so a blocked pair simply stop being
 * mutual friends and land in `not_mutual` — which is what lets PC-10 say "No
 * longer a mutual friend" without disclosing that a block exists.
 */
export type InviteIneligibility = 'group_full' | 'not_mutual' | null;
