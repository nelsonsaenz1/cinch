import { useQuery } from '@tanstack/react-query';

import type { SocialProfileRow } from '@/features/social/db-rows';
import { getUserId, supabase } from '@/lib/supabase';

import { circlesDb, rowsOf } from './client';
import type { CircleMemberRow, CircleRow } from './db-rows';
import type { CircleInvitationEntry, CircleMemberEntry, CircleSummary } from './types';

/**
 * The reads for private groups.
 *
 * ── WHAT THE SERVER HAS ALREADY DECIDED ───────────────────────────────────
 *
 * No predicate below says anything about friendship, blocks or membership, and
 * none should. `circles` is filtered by `can_see_circle` (owner, invitee,
 * joined member, or somebody who declined and can still change their mind) and
 * `circle_members` by "your own row always, everyone else's only once you are
 * joined". A block, a removal or a deletion empties the affected rows on the
 * next fetch with no cache surgery here.
 *
 * ── THE ROSTER IS LEGITIMATELY ALMOST EMPTY ───────────────────────────────
 *
 * An invitee reads exactly one membership row: their own. That is PC-04's
 * promise — "You will see who else is in it after you accept. Nothing of yours
 * is shared until then." — and it is a correct answer, not a failed one.
 * Nothing here treats a one-row roster as an error, and nothing here can tell
 * a component that rows were withheld, because there is no such fact to tell.
 *
 * ── WHICH IS WHY THE COUNT IS AN RPC ──────────────────────────────────────
 *
 * PC-04 draws "4 members · private" directly above that sentence, and the
 * roster policy cannot serve it: there is nothing for an invitee to count.
 * `circle_member_count` is the only thing that can, and it is a scalar rather
 * than a view precisely because a view is joinable back to the membership
 * table and names people. It counts `joined` only, so it never discloses that
 * other invitations are pending; it returns 0 when the caller may not see the
 * group, which is the same answer an id that was never created returns, so it
 * is not an existence oracle; and 0 is unreachable through the visible path,
 * because a group always has at least its owner joined. A 0 therefore means
 * "not for you" and can never be confused with an empty group.
 */

/** Every group the caller is in. */
export const CIRCLES_KEY = ['circles'] as const;
/** Invitations waiting for the caller. */
export const CIRCLE_INVITATIONS_KEY = ['circle-invitations'] as const;
/** One group's summary. */
export const circleKey = (circleId: string | null) => ['circle', circleId] as const;
/** One group's roster. */
export const circleMembersKey = (circleId: string | null) => ['circle-members', circleId] as const;

/** Everything `circles` has that a client reads. */
const CIRCLE_COLUMNS = 'id, owner_id, name, created_at, updated_at';
/** The membership row, whole: five of the seven columns carry meaning here. */
const MEMBER_COLUMNS = 'circle_id, user_id, role, state, invited_by, created_at, updated_at';

/**
 * How many are in a group, per the RPC.
 *
 * Never throws for a group that cannot be seen — the function answers 0 for
 * that case by design — so a failure here is a real one and is left to the
 * caller's error boundary.
 */
async function memberCount(circleId: string): Promise<number> {
  const { data, error } = await circlesDb().rpc('circle_member_count', { p_circle: circleId });
  if (error) throw new Error(error.message);
  return typeof data === 'number' ? data : 0;
}

/**
 * Names for a set of user ids, via `social_profiles`.
 *
 * Silently partial, and the gaps are the design. `social_profiles` names
 * people the caller is already related to — a mutual friend, either half of a
 * follow, a public account, an event co-member — and it screens blocked pairs.
 * A group co-member who is the OWNER's mutual friend but a stranger to the
 * reader is named by none of those branches and resolves to no name.
 *
 * `public_profiles` is deliberately not used as a fallback here, even though
 * `useSentRequests` pairs the two: that view does not screen blocked pairs,
 * and `20260810150100` exists precisely to keep a blocked person from
 * appearing in a roster. A nameless row is the honest answer; a name borrowed
 * from a public surface would undo a fix.
 */
async function fetchNames(ids: readonly string[]): Promise<Map<string, string | null>> {
  const names = new Map<string, string | null>();
  if (ids.length === 0) return names;

  const { data, error } = await supabase
    .from('social_profiles')
    .select('user_id, username, display_name, avatar_url, bio')
    .in('user_id', [...ids]);

  if (error) throw error;
  // Through `unknown` while the generated types predate the view's `bio`
  // column; the next regen makes the widening a no-op, not a lie.
  for (const row of (data ?? []) as unknown as SocialProfileRow[]) {
    names.set(row.user_id, row.display_name ?? row.username ?? null);
  }
  return names;
}

/** The caller's own membership row in every group they have one in. */
async function fetchOwnMemberships(userId: string): Promise<CircleMemberRow[]> {
  const { data, error } = await circlesDb()
    .from('circle_members')
    .select(MEMBER_COLUMNS)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
  return rowsOf<CircleMemberRow>(data);
}

/** Every group the caller may see at all — RLS decides which those are. */
async function fetchVisibleCircles(): Promise<Map<string, CircleRow>> {
  const { data, error } = await circlesDb()
    .from('circles')
    .select(CIRCLE_COLUMNS)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return new Map(rowsOf<CircleRow>(data).map((row) => [row.id, row]));
}

/**
 * The caller's groups: the ones they are actually IN.
 *
 * `joined` and nothing else, which covers the owner without a special case —
 * `handle_new_circle` writes them `owner/joined` in the same transaction that
 * creates the group, and the transition trigger refuses to let them leave it.
 * A group the caller has only been invited to is an invitation, not a group,
 * and belongs to `useCircleInvitations`; a group they declined, left or were
 * removed from is neither, and `can_see_circle` stops showing the last two
 * entirely.
 */
export function useCircles() {
  return useQuery({
    queryKey: CIRCLES_KEY,
    queryFn: async (): Promise<CircleSummary[]> => {
      const userId = await getUserId();
      if (!userId) return [];

      const [memberships, circles] = await Promise.all([
        fetchOwnMemberships(userId),
        fetchVisibleCircles(),
      ]);

      const mine = memberships.flatMap((row) => {
        if (row.state !== 'joined') return [];
        const circle = circles.get(row.circle_id);
        // A membership row whose group is not in the visible set is a race
        // with a deletion, not a state worth drawing.
        return circle ? [circle] : [];
      });

      const counts = await Promise.all(mine.map((circle) => memberCount(circle.id)));

      return mine.map((circle, index) => ({
        id: circle.id,
        name: circle.name,
        ownerId: circle.owner_id,
        memberCount: counts[index] ?? 0,
        isOwner: circle.owner_id === userId,
      }));
    },
  });
}

/**
 * One group's summary, for its own screen.
 *
 * `null` means the group is gone or was never the caller's to see — deleted,
 * or a membership that ended — and those are the same answer on purpose. A
 * client that could tell "deleted" from "you were removed" would be telling
 * somebody something the roster policy took care to stop saying.
 */
export function useCircle(circleId: string | null) {
  return useQuery({
    queryKey: circleKey(circleId),
    enabled: Boolean(circleId),
    queryFn: async (): Promise<CircleSummary | null> => {
      if (!circleId) return null; // `enabled` already guards; this narrows the type
      const userId = await getUserId();
      if (!userId) return null;

      const { data, error } = await circlesDb()
        .from('circles')
        .select(CIRCLE_COLUMNS)
        .eq('id', circleId)
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data) return null;

      const circle = data as CircleRow;
      return {
        id: circle.id,
        name: circle.name,
        ownerId: circle.owner_id,
        memberCount: await memberCount(circle.id),
        isOwner: circle.owner_id === userId,
      };
    },
  });
}

/**
 * The roster.
 *
 * Every state comes back, exits included, because the owner's manage screen
 * needs them and a joined member's overview does not have to ask for a
 * different query to get a shorter list. Which states to draw is a
 * presentation decision, so it is left to the presentation.
 *
 * ORDERED OWNER FIRST, THEN BY NAME, and deliberately not by state: sorting by
 * state would decide for the caller which groupings are meaningful, and PC-06
 * and PC-07 group differently. Nameless rows sort last, the same rule
 * `social-graph/queries.ts` applies to every people list in the app.
 */
export function useCircleMembers(circleId: string | null) {
  return useQuery({
    queryKey: circleMembersKey(circleId),
    enabled: Boolean(circleId),
    queryFn: async (): Promise<CircleMemberEntry[]> => {
      if (!circleId) return []; // `enabled` already guards; this narrows the type

      const { data, error } = await circlesDb()
        .from('circle_members')
        .select(MEMBER_COLUMNS)
        .eq('circle_id', circleId);

      if (error) throw new Error(error.message);
      const rows = rowsOf<CircleMemberRow>(data);
      // One row — your own — is what an invitee is supposed to get. Not an
      // error, not an empty state: the invitation frame draws from
      // `useCircleInvitations` and the count RPC, and this list is simply not
      // what that screen is made of.
      if (rows.length === 0) return [];

      const names = await fetchNames([...new Set(rows.map((row) => row.user_id))]);

      return rows
        .map((row) => ({
          userId: row.user_id,
          displayName: names.get(row.user_id) ?? null,
          role: row.role,
          state: row.state,
          // `updated_at` is when the row entered the state it is in now, and
          // every legal move out of `joined` lands somewhere else — so for a
          // row that reads `joined`, this is the moment they joined.
          joinedAt: row.state === 'joined' ? row.updated_at : null,
        }))
        .sort(byOwnerThenName);
    },
  });
}

/** Owner first, then named before nameless, then alphabetical. */
function byOwnerThenName(a: CircleMemberEntry, b: CircleMemberEntry): number {
  if (a.role !== b.role) return a.role === 'owner' ? -1 : 1;
  const an = a.displayName ?? '';
  const bn = b.displayName ?? '';
  if (!an && bn) return 1;
  if (an && !bn) return -1;
  return an.localeCompare(bn);
}

/**
 * Invitations awaiting an answer.
 *
 * `state = 'invited'` and nothing else. A declined row is still visible to the
 * server — `can_see_circle` keeps it so decline-then-accept works — but it is
 * not waiting for anybody, and putting it back in this list would be an
 * invitation that reappears after it was turned down.
 */
export function useCircleInvitations() {
  return useQuery({
    queryKey: CIRCLE_INVITATIONS_KEY,
    queryFn: async (): Promise<CircleInvitationEntry[]> => {
      const userId = await getUserId();
      if (!userId) return [];

      const memberships = await fetchOwnMemberships(userId);
      const invited = memberships.filter((row) => row.state === 'invited');
      if (invited.length === 0) return [];

      const circles = await fetchVisibleCircles();

      const pending = invited.flatMap((row) => {
        const circle = circles.get(row.circle_id);
        return circle ? [{ row, circle }] : [];
      });

      const [counts, names] = await Promise.all([
        Promise.all(pending.map(({ circle }) => memberCount(circle.id))),
        // `invited_by` is always the owner — the insert policy forces it — so
        // the owner id is both the fallback and the same person.
        fetchNames([...new Set(pending.map(({ row, circle }) => row.invited_by ?? circle.owner_id))]),
      ]);

      return pending.map(({ row, circle }, index) => {
        const inviterId = row.invited_by ?? circle.owner_id;
        return {
          circleId: circle.id,
          name: circle.name,
          inviterId,
          inviterName: names.get(inviterId) ?? null,
          memberCount: counts[index] ?? 0,
          // The latest invitation, not the first: asking again is an UPDATE of
          // the row that already exists.
          invitedAt: row.updated_at,
        };
      });
    },
  });
}
