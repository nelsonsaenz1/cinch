import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { track } from '@/lib/posthog';
import { getUserId } from '@/lib/supabase';

import {
  CIRCLE_EVENTS,
  circleCreatedProps,
  circleDeletedProps,
  circleInvitationAnsweredProps,
  circleInviteSentProps,
  circleMemberReInvitedProps,
  circleMembershipEndedProps,
  circleRenamedProps,
} from './analytics';
import { circlesDb, type CirclePostgrestError } from './client';
import type { CircleRow } from './db-rows';
import {
  CIRCLE_INVITATIONS_KEY,
  CIRCLES_KEY,
  circleKey,
  circleMembersKey,
} from './queries';
import type {
  CircleInvitationEntry,
  CircleMemberEntry,
  CircleMemberState,
  CircleSummary,
} from './types';

/**
 * Every verb a private group has.
 *
 * ── LEAVING IS AN UPDATE, AND SO IS BEING REMOVED ─────────────────────────
 *
 * There is no DELETE grant on `circle_members` and no delete policy, so
 * nothing in this file can erase a membership row. `left` IS the record of
 * leaving and `removed` IS the record of ejection, and the distinction is the
 * whole reason the state enum has five members rather than four: somebody who
 * walked out must not appear to have been thrown out. Deleting the `circles`
 * row is the owner's only delete, and it takes every membership row with it by
 * cascade — pending invitations included, which is PC-08's promise.
 *
 * ── THE OWNER'S MEMBERSHIP ROW IS NOT WRITTEN HERE ────────────────────────
 *
 * `handle_new_circle` writes it, as a definer, in the same transaction as the
 * insert. Writing it from the client would fail its own RLS policy — which
 * admits only `invited`/`member` rows — and correctly so: the owner row is not
 * a thing anyone is allowed to write by hand. `useCreateCircle` inserts one
 * row and one row only.
 *
 * ── INVITATIONS GO ONE AT A TIME ──────────────────────────────────────────
 *
 * A row-level BEFORE trigger cannot see the other rows of its own multi-row
 * INSERT, so an array insert of three people into a group with one seat left
 * would be counted three times against eleven and admitted three times. The
 * migration states that limit and says explicitly that it is unreachable
 * because the client invites one person at a time. This file is where that
 * claim is kept true, and `client.ts` types `insert` to take a single row so
 * it cannot be broken by accident.
 *
 * ── OPTIMISM, IN THE `useSetClosetVisibility` SHAPE ───────────────────────
 *
 * Snapshot in `onMutate`, roll back in `onError`, invalidate in `onSettled`.
 * These are membership controls: an Accept that waits for the network before
 * anything moves reads as a tap that did not land, and a Leave that lingers
 * reads as a room you cannot get out of.
 *
 * ── ERRORS ARE THROWN WHOLE ───────────────────────────────────────────────
 *
 * Every failure below re-throws the PostgREST error object rather than a
 * message, because the SQLSTATE and the hint are what `errors.ts` classifies
 * on. Wrapping one in `new Error(error.message)` would turn a full group into
 * an unknown failure at the exact moment the interface has something useful to
 * say.
 */

/** What a rollback needs: the three lists a group write can touch. */
interface CircleSnapshot {
  circles?: CircleSummary[];
  invitations?: CircleInvitationEntry[];
  members?: CircleMemberEntry[];
  memberCircleId?: string;
}

function snapshotLists(qc: QueryClient): CircleSnapshot {
  return {
    circles: qc.getQueryData<CircleSummary[]>(CIRCLES_KEY),
    invitations: qc.getQueryData<CircleInvitationEntry[]>(CIRCLE_INVITATIONS_KEY),
  };
}

function restore(qc: QueryClient, snapshot: CircleSnapshot | undefined): void {
  if (!snapshot) return;
  if (snapshot.circles) qc.setQueryData(CIRCLES_KEY, snapshot.circles);
  if (snapshot.invitations) qc.setQueryData(CIRCLE_INVITATIONS_KEY, snapshot.invitations);
  if (snapshot.members && snapshot.memberCircleId) {
    qc.setQueryData(circleMembersKey(snapshot.memberCircleId), snapshot.members);
  }
}

/**
 * Everything a membership change can invalidate.
 *
 * All four, every time, rather than a per-verb list. A state change moves a
 * group between "mine" and "an invitation" and changes the count on both, and
 * a verb that invalidated three of the four would leave one screen showing
 * yesterday for as long as it stayed mounted.
 */
function invalidateAll(qc: QueryClient, circleId: string): void {
  void qc.invalidateQueries({ queryKey: CIRCLES_KEY });
  void qc.invalidateQueries({ queryKey: CIRCLE_INVITATIONS_KEY });
  void qc.invalidateQueries({ queryKey: circleKey(circleId) });
  void qc.invalidateQueries({ queryKey: circleMembersKey(circleId) });
}

/** Paint a membership row's new state, and hand back what was there. */
async function optimisticMemberState(
  qc: QueryClient,
  circleId: string,
  userId: string,
  state: CircleMemberState,
): Promise<CircleSnapshot> {
  await qc.cancelQueries({ queryKey: circleMembersKey(circleId) });
  const members = qc.getQueryData<CircleMemberEntry[]>(circleMembersKey(circleId));
  if (members) {
    qc.setQueryData(
      circleMembersKey(circleId),
      members.map((member) =>
        member.userId === userId
          ? // A row that stops being `joined` stops having a joined date. The
            // read path derives it the same way, so an optimistic row that
            // kept the old one would flicker back on the next fetch.
            { ...member, state, joinedAt: state === 'joined' ? member.joinedAt : null }
          : member,
      ),
    );
  }
  return { members, memberCircleId: circleId };
}

function throwIf(error: CirclePostgrestError | null): void {
  // The object, not its message: `errors.ts` classifies on `code` and `hint`.
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Making one, naming it, ending it
// ---------------------------------------------------------------------------

/**
 * Create a group.
 *
 * ONE INSERT, into `circles`. The owner's membership row arrives by trigger.
 *
 * NOTHING IS PAINTED OPTIMISTICALLY, and that is the deliberate exception to
 * the shape the rest of this file follows. A group's id is the server's to
 * mint, and a provisional row in the list is a row that cannot be opened —
 * worse than a row that appears a beat later, because the tap that opens it
 * fails. (Minting the uuid on the device was considered and refused:
 * `fallbackUuid` is `Math.random` by its own admission, which is the right
 * rigour for a filename in one person's own storage and the wrong rigour for a
 * primary key eleven other people's rows point at.) The snapshot, the rollback
 * and the invalidation are all still here — they are the shape; the painting
 * is what varies.
 */
export function useCreateCircle() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ name }: { name: string }): Promise<CircleSummary> => {
      const userId = await getUserId();
      if (!userId) throw new Error('Not signed in.');

      const { data, error } = await circlesDb()
        .from('circles')
        .insert({ owner_id: userId, name })
        .select('id, owner_id, name, created_at, updated_at')
        .single();

      throwIf(error);
      const row = data as CircleRow;
      return {
        id: row.id,
        name: row.name,
        ownerId: row.owner_id,
        // The trigger has already written the owner in, so one is the truth
        // rather than a guess — and the next fetch asks the RPC anyway.
        memberCount: 1,
        isOwner: true,
      };
    },

    onMutate: async () => {
      await qc.cancelQueries({ queryKey: CIRCLES_KEY });
      return snapshotLists(qc);
    },
    onError: (_error, _vars, context) => restore(qc, context),
    onSuccess: () => {
      track(CIRCLE_EVENTS.created, circleCreatedProps());
    },
    onSettled: (created) => {
      void qc.invalidateQueries({ queryKey: CIRCLES_KEY });
      if (created) void qc.invalidateQueries({ queryKey: circleKey(created.id) });
    },
  });
}

/** Rename a group. Owner only — the UPDATE policy refuses everyone else's row silently. */
export function useRenameCircle() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ circleId, name }: { circleId: string; name: string }) => {
      const { error } = await circlesDb().from('circles').update({ name }).eq('id', circleId);
      throwIf(error);
    },

    onMutate: async ({ circleId, name }) => {
      await qc.cancelQueries({ queryKey: CIRCLES_KEY });
      await qc.cancelQueries({ queryKey: circleKey(circleId) });
      const snapshot = snapshotLists(qc);

      if (snapshot.circles) {
        qc.setQueryData(
          CIRCLES_KEY,
          snapshot.circles.map((circle) => (circle.id === circleId ? { ...circle, name } : circle)),
        );
      }
      const one = qc.getQueryData<CircleSummary | null>(circleKey(circleId));
      if (one) qc.setQueryData(circleKey(circleId), { ...one, name });

      return snapshot;
    },
    onError: (_error, { circleId }, context) => {
      restore(qc, context);
      void qc.invalidateQueries({ queryKey: circleKey(circleId) });
    },
    onSuccess: () => {
      track(CIRCLE_EVENTS.renamed, circleRenamedProps());
    },
    onSettled: (_data, _error, { circleId }) => invalidateAll(qc, circleId),
  });
}

/**
 * Delete a group. The owner's only delete, and the only one in this feature.
 *
 * Every membership row goes with it by cascade, pending invitations included —
 * which is what PC-08 promises, and it is the schema's cascade rather than
 * anything this file does.
 */
export function useDeleteCircle() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ circleId }: { circleId: string }) => {
      const { error } = await circlesDb().from('circles').delete().eq('id', circleId);
      throwIf(error);
    },

    onMutate: async ({ circleId }) => {
      await qc.cancelQueries({ queryKey: CIRCLES_KEY });
      const snapshot = snapshotLists(qc);
      if (snapshot.circles) {
        qc.setQueryData(
          CIRCLES_KEY,
          snapshot.circles.filter((circle) => circle.id !== circleId),
        );
      }
      return snapshot;
    },
    onError: (_error, _vars, context) => restore(qc, context),
    onSuccess: () => {
      track(CIRCLE_EVENTS.deleted, circleDeletedProps());
    },
    onSettled: (_data, _error, { circleId }) => {
      invalidateAll(qc, circleId);
      // The group is gone; its cached detail is not a thing to refetch.
      qc.removeQueries({ queryKey: circleKey(circleId) });
      qc.removeQueries({ queryKey: circleMembersKey(circleId) });
    },
  });
}

// ---------------------------------------------------------------------------
// Asking people in
// ---------------------------------------------------------------------------

/**
 * Invite mutual friends, one INSERT each.
 *
 * SEQUENTIAL, NOT PARALLEL, and not an array insert. See the header: the seat
 * cap is enforced by a row-level trigger that cannot see its own statement's
 * other rows, and one-at-a-time is what makes the twelfth invitation meet a
 * refusal instead of a seat.
 *
 * The first failure stops the run and is thrown whole, so the group is not
 * half-invited by a picker that carried on past a full house. The invitations
 * that already landed stay landed — they are real, the server accepted them —
 * and `onSettled` refetches so the roster shows exactly who is in and who is
 * not. That is the honest end state; rolling them back would need a DELETE
 * this feature does not have.
 */
export function useInviteMembers() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      circleId,
      userIds,
    }: {
      circleId: string;
      userIds: readonly string[];
    }): Promise<{ invited: number }> => {
      const me = await getUserId();
      if (!me) throw new Error('Not signed in.');

      let invited = 0;
      for (const userId of userIds) {
        const { error } = await circlesDb()
          .from('circle_members')
          .insert({ circle_id: circleId, user_id: userId, invited_by: me });

        if (error) {
          // Thrown whole, and only after the successes are counted, so a
          // caller can tell "nobody was invited" from "the fourth was refused".
          throw Object.assign(error, { invited });
        }
        invited += 1;
        track(CIRCLE_EVENTS.inviteSent, circleInviteSentProps());
      }
      return { invited };
    },

    onMutate: async ({ circleId }) => {
      await qc.cancelQueries({ queryKey: circleMembersKey(circleId) });
      const members = qc.getQueryData<CircleMemberEntry[]>(circleMembersKey(circleId));
      // Deliberately not painted. An invitee's row carries a name this client
      // may not be able to resolve, and a roster row that appears without one
      // and then acquires one is a worse first impression than a row that
      // arrives complete a moment later.
      return { members, memberCircleId: circleId } satisfies CircleSnapshot;
    },
    onError: (_error, _vars, context) => restore(qc, context),
    onSettled: (_data, _error, { circleId }) => invalidateAll(qc, circleId),
  });
}

/**
 * Ask somebody back — `removed`, `left` or `declined` → `invited`.
 *
 * Without this the primary key is a trap: a re-invitation cannot INSERT over a
 * row that already exists, so one mis-tapped Remove would exclude somebody
 * from a twelve-seat group permanently. The trigger re-checks mutual
 * friendship and the seat cap at this moment rather than trusting whenever the
 * row was first written, so this can be refused for either reason, and both
 * arrive as the codes `errors.ts` already classifies.
 */
export function useReInviteMember() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ circleId, userId }: { circleId: string; userId: string }) => {
      const { error } = await circlesDb()
        .from('circle_members')
        .update({ state: 'invited' })
        .eq('circle_id', circleId)
        .eq('user_id', userId);

      throwIf(error);
    },

    onMutate: ({ circleId, userId }) => optimisticMemberState(qc, circleId, userId, 'invited'),
    onError: (_error, _vars, context) => restore(qc, context),
    onSuccess: () => {
      track(CIRCLE_EVENTS.memberReInvited, circleMemberReInvitedProps());
    },
    onSettled: (_data, _error, { circleId }) => invalidateAll(qc, circleId),
  });
}

// ---------------------------------------------------------------------------
// Answering, and leaving
// ---------------------------------------------------------------------------

/** Accept an invitation. Only the invitee can write `joined` — never the owner. */
export function useAcceptInvitation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ circleId }: { circleId: string }) => {
      const me = await getUserId();
      if (!me) throw new Error('Not signed in.');

      const { error } = await circlesDb()
        .from('circle_members')
        .update({ state: 'joined' })
        .eq('circle_id', circleId)
        .eq('user_id', me);

      throwIf(error);
    },

    onMutate: async ({ circleId }) => {
      await qc.cancelQueries({ queryKey: CIRCLE_INVITATIONS_KEY });
      const snapshot = snapshotLists(qc);
      if (snapshot.invitations) {
        qc.setQueryData(
          CIRCLE_INVITATIONS_KEY,
          snapshot.invitations.filter((invitation) => invitation.circleId !== circleId),
        );
      }
      return snapshot;
    },
    onError: (_error, _vars, context) => restore(qc, context),
    onSuccess: () => {
      track(CIRCLE_EVENTS.invitationAnswered, circleInvitationAnsweredProps('accepted'));
    },
    onSettled: (_data, _error, { circleId }) => invalidateAll(qc, circleId),
  });
}

/**
 * Decline an invitation.
 *
 * Not final, and the schema is what makes that true: `can_see_circle` keeps a
 * declined row's group visible so decline-then-accept works, which is PC-04's
 * "You can be invited again later" holding without the owner having to do
 * anything.
 */
export function useDeclineInvitation() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ circleId }: { circleId: string }) => {
      const me = await getUserId();
      if (!me) throw new Error('Not signed in.');

      const { error } = await circlesDb()
        .from('circle_members')
        .update({ state: 'declined' })
        .eq('circle_id', circleId)
        .eq('user_id', me);

      throwIf(error);
    },

    onMutate: async ({ circleId }) => {
      await qc.cancelQueries({ queryKey: CIRCLE_INVITATIONS_KEY });
      const snapshot = snapshotLists(qc);
      if (snapshot.invitations) {
        qc.setQueryData(
          CIRCLE_INVITATIONS_KEY,
          snapshot.invitations.filter((invitation) => invitation.circleId !== circleId),
        );
      }
      return snapshot;
    },
    onError: (_error, _vars, context) => restore(qc, context),
    onSuccess: () => {
      track(CIRCLE_EVENTS.invitationAnswered, circleInvitationAnsweredProps('declined'));
    },
    onSettled: (_data, _error, { circleId }) => invalidateAll(qc, circleId),
  });
}

/**
 * Leave a group — the caller's own row to `left`.
 *
 * `left`, never a delete and never `removed`. The owner cannot use this: the
 * transition trigger refuses `owner → left` with 22023, because the design
 * record leaves owner departure unresolved and the conservative default is
 * that the owner deletes the group or it dissolves. The interface should not
 * offer the control; if it does, the refusal classifies as `stale` and the
 * screen redraws with the truth.
 */
export function useLeaveCircle() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ circleId }: { circleId: string }) => {
      const me = await getUserId();
      if (!me) throw new Error('Not signed in.');

      const { error } = await circlesDb()
        .from('circle_members')
        .update({ state: 'left' })
        .eq('circle_id', circleId)
        .eq('user_id', me);

      throwIf(error);
    },

    onMutate: async ({ circleId }) => {
      await qc.cancelQueries({ queryKey: CIRCLES_KEY });
      const snapshot = snapshotLists(qc);
      if (snapshot.circles) {
        qc.setQueryData(
          CIRCLES_KEY,
          snapshot.circles.filter((circle) => circle.id !== circleId),
        );
      }
      return snapshot;
    },
    onError: (_error, _vars, context) => restore(qc, context),
    onSuccess: () => {
      track(CIRCLE_EVENTS.membershipEnded, circleMembershipEndedProps('left'));
    },
    onSettled: (_data, _error, { circleId }) => {
      invalidateAll(qc, circleId);
      // `can_see_circle` excludes `left`, so both of these now answer nothing.
      qc.removeQueries({ queryKey: circleKey(circleId) });
      qc.removeQueries({ queryKey: circleMembersKey(circleId) });
    },
  });
}

/**
 * Remove somebody — the owner's verb, and `removed` is the only state it may
 * write.
 *
 * Not `left`: an ejection dressed as a departure is a lie told to everyone
 * reading the roster. The person removed is told they were removed and never
 * who removed them (PC-07), which is a property of the copy and of the fact
 * that nothing in the row records a remover.
 */
export function useRemoveMember() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ circleId, userId }: { circleId: string; userId: string }) => {
      const { error } = await circlesDb()
        .from('circle_members')
        .update({ state: 'removed' })
        .eq('circle_id', circleId)
        .eq('user_id', userId);

      throwIf(error);
    },

    onMutate: ({ circleId, userId }) => optimisticMemberState(qc, circleId, userId, 'removed'),
    onError: (_error, _vars, context) => restore(qc, context),
    onSuccess: () => {
      track(CIRCLE_EVENTS.membershipEnded, circleMembershipEndedProps('removed'));
    },
    onSettled: (_data, _error, { circleId }) => invalidateAll(qc, circleId),
  });
}
