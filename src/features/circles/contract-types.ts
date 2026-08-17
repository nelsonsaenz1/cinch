/**
 * WORKER B'S INTERFACE, DECLARED LOCALLY SO THIS LANE COMPILES ON ITS OWN.
 *
 * ── AT INTEGRATION, REPLACE THE ENTIRE BODY OF THIS FILE WITH ───────────────
 *
 *     export * from './types';
 *
 * — and nothing else. Every declaration below is a transcription of the
 * interface Worker B fixed for `src/features/circles/types.ts`, name for name
 * and field for field, so the swap is one line and no importer changes. If a
 * name here has drifted from B's file, B's file wins: this one is a stand-in
 * for a module that does not exist in this worktree, not a second opinion
 * about what the module should say.
 *
 * IMPORTERS TO RE-POINT (all of them import from `./contract-types` or
 * `@/features/circles/contract-types`, so the swap above covers them, but they
 * are named here so the integrator can grep rather than guess):
 *
 *   · src/features/circles/states.ts
 *   · src/features/circles/copy.ts
 *   · src/components/circles/group-row.tsx
 *   · src/components/circles/member-row.tsx
 *   · src/components/circles/picker-row.tsx
 *   · src/components/circles/invitation-card.tsx
 *   · src/components/circles/state-screens.tsx
 *   · tests/private-circles-states.test.ts
 *   · tests/private-circles-copy.test.ts
 *
 * ── WHY `circle` HERE AND `group` IN EVERY STRING ───────────────────────────
 *
 * The vocabulary contract (docs/design/private-circles-preparation.md §0), and
 * it is binding: **identifiers say circle, strings say group.** "Private
 * Circles" is the internal programme label the schema follows; `group` is a
 * reserved word in Postgres, so `circles` / `circle_members` sidestep the whole
 * neighbourhood. Nothing in this file is a string a customer reads, which is
 * why `circle` is allowed to appear in it at all.
 *
 * The app's existing "your circle" copy means the MUTUAL-FRIEND GRAPH on five
 * shipped surfaces and is untouched by this packet. Nothing here references it,
 * renames it or echoes it.
 *
 * This module is PURE — no React, no react-native, no supabase — because
 * `states.ts` and `copy.ts` both import it and both are exercised by the node
 * runner, which cannot parse React Native's Flow source.
 */

/**
 * Two roles and no third. The owner is a member from birth
 * (`handle_new_circle`), so there is no "creator who is not in the room".
 */
export type CircleMemberRole = 'owner' | 'member';

/**
 * Five states, and `left` is the whole reason this is not the events enum.
 *
 * `event_members` has four: nobody leaves an event, they decline it. A group is
 * durable and people leave, and `removed` reads as ejection to everyone looking
 * at the roster — so someone who walked out must not appear to have been thrown
 * out. The distinction is drawn in the schema
 * (`20260818000000_private_circles.sql`, departure 2) and this lane is where it
 * becomes two different sentences.
 */
export type CircleMemberState = 'invited' | 'joined' | 'declined' | 'removed' | 'left';

/**
 * Twelve, counting `invited` together with `joined`.
 *
 * The owner occupies one of the twelve — `handle_new_circle` puts them there in
 * the same transaction that creates the group — so the eleventh invitation is
 * the last one that fits. The cap counts outstanding invitations as well as
 * members because the alternative refuses the twelfth person at the moment they
 * tap Accept, which is a race whose loser cannot understand it and could not
 * have avoided it. `enforce_circle_size` guards INSERT and UPDATE both.
 */
export const CIRCLE_MAX_MEMBERS = 12;

/** One group in the reader's own list. */
export interface CircleSummary {
  id: string;
  name: string;
  ownerId: string;
  /**
   * `joined` only — `circle_member_count(uuid)`, which is a scalar and
   * deliberately not a view. A count discloses how many and never who, which is
   * exactly the line PC-04 draws for somebody who has not accepted yet.
   */
  memberCount: number;
  isOwner: boolean;
}

/** One row of a roster the reader is entitled to see — i.e. one they joined. */
export interface CircleMemberEntry {
  userId: string;
  displayName: string | null;
  role: CircleMemberRole;
  state: CircleMemberState;
  joinedAt: string | null;
}

/**
 * An invitation, as it reaches the person who has to answer it.
 *
 * Note what is NOT on it: a roster. The invitee is not `joined`, so the
 * membership policy hands them exactly their own row, and `memberCount` is the
 * scalar RPC. "You will see who else is in it after you accept" is a promise
 * this shape keeps by construction rather than by the client remembering to.
 */
export interface CircleInvitationEntry {
  circleId: string;
  name: string;
  inviterId: string;
  inviterName: string | null;
  memberCount: number;
  invitedAt: string;
}

/**
 * Why a person cannot be invited, or `null` when they can.
 *
 * Two reasons and no third, and the absence of the third is the design: there
 * is no `blocked`. A block severs both follow edges permanently
 * (`on_block_sever_graph`), so a blocked pair simply stop being mutual friends
 * and the row says `not_mutual` — which is true, sufficient, and discloses
 * nothing about whether a block exists. PC-10 draws exactly these two.
 */
export type InviteIneligibility = 'group_full' | 'not_mutual' | null;
