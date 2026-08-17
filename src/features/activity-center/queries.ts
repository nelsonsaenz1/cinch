import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { SocialProfileRow } from '@/features/social/db-rows';
import { getUserId, supabase } from '@/lib/supabase';

import { activityDb, rowsOf } from './client';
import type { ActivityEventRow } from './db-rows';
import { describeActivity, type ActivityLine } from './sentence';
import {
  isActivityEventType,
  NO_ACTOR,
  type ActivityActor,
  type ActivityEvent,
  type ActivityPayload,
} from './types';

/**
 * The Activity Center's reads.
 *
 * ── WHAT THE SERVER HAS ALREADY DECIDED ───────────────────────────────────
 *
 * No predicate below says anything about who the recipient is, and none should.
 * `activity_events` is filtered by `recipient_id = auth.uid() and dismissed_at
 * is null`, so "your inbox" is not a clause this file writes — it is the only
 * thing the table can return. There is deliberately no `.eq('recipient_id', …)`
 * anywhere here: adding one would read as the security boundary and would be a
 * decoration in front of the real one, and the day somebody removed it as
 * redundant nobody would know whether it had been.
 *
 * There is also no window. §7's thirty days is enforced by the purge job, not
 * by a filter, so a client cannot disagree with it and cannot be made to show
 * more by editing a number here.
 *
 * ── ONE READ AND ONE HYDRATION, NEVER A PER-ROW FETCH ─────────────────────
 *
 * The rows carry `actor_id`; the names those ids stand for come from
 * `social_profiles` in one batched read. That hydration is allowed to come back
 * partial and routinely does — group co-members are mutual friends of the
 * OWNER, not of each other, so a reader legitimately cannot name everyone in
 * their own group's arrivals — and `sentence.ts` has a true fallback for every
 * unresolved id.
 *
 * ── NOTHING HERE IS PERSISTED TO DISK ─────────────────────────────────────
 *
 * The keys are absent from `PERSISTED_KEYS` in `lib/query-client.ts` on
 * purpose, matching `features/activity/queries.ts`. An inbox rehydrated from
 * yesterday's SQLite blob would show an invitation that has since been
 * withdrawn with its Accept button still live, which is the one failure this
 * surface promises cannot happen. AC-07's "showing your last saved activity" is
 * served by the in-memory cache from earlier in the same session, which is a
 * smaller promise and the true one.
 */

/** The whole live inbox, newest first. */
export const ACTIVITY_EVENTS_KEY = ['activity-events'] as const;
/** The dot. A boolean, from the RPC. */
export const ACTIVITY_UNSEEN_KEY = ['activity-unseen'] as const;
/** One event, for a deep link that arrived without the list. */
export const activityEventKey = (id: string | null) => ['activity-event', id] as const;

/**
 * Every column except `recipient_id`.
 *
 * It is always the caller — the policy guarantees it — so selecting it would be
 * asking the server to confirm who you are, and it would put one more
 * identifier in a cache that an analytics call site could reach.
 */
const EVENT_COLUMNS =
  'id, event_type, actor_id, subject_type, subject_id, circle_id, payload, created_at, seen_at, dismissed_at, revoked_at';

// ---------------------------------------------------------------------------
// The wire boundary
// ---------------------------------------------------------------------------

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Narrow the bounded half of `payload`, and discard the rest.
 *
 * The schema puts exactly two keys in here and both are short strings. Anything
 * else on the object is dropped rather than carried: a payload that grew a
 * field on the server should not start flowing through this client until
 * somebody has decided what it means, and an unbounded passthrough is how a
 * denormalisation quietly becomes a data pipe.
 */
function toPayload(raw: unknown): ActivityPayload {
  if (typeof raw !== 'object' || raw === null) return {};
  const record = raw as Record<string, unknown>;
  return {
    circle_name: str(record.circle_name),
    reaction: str(record.reaction),
  };
}

/**
 * One row, or nothing.
 *
 * A row whose `event_type` this build does not know is DROPPED. It is a row
 * from a newer server, and there is no sentence for it — rendering a blank line
 * in an inbox reads as data loss, which is worse than the row not being there.
 */
export function toActivityEvent(row: ActivityEventRow): ActivityEvent | null {
  if (!isActivityEventType(row.event_type)) return null;
  if (!row.id || !row.created_at || !row.subject_id) return null;

  return {
    id: row.id,
    type: row.event_type,
    actorId: row.actor_id ?? null,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    circleId: row.circle_id ?? null,
    payload: toPayload(row.payload),
    occurredAt: row.created_at,
    seenAt: row.seen_at ?? null,
    revokedAt: row.revoked_at ?? null,
  };
}

// ---------------------------------------------------------------------------
// The feed
// ---------------------------------------------------------------------------

export function useActivityEvents() {
  return useQuery({
    queryKey: ACTIVITY_EVENTS_KEY,
    queryFn: async (): Promise<ActivityEvent[]> => {
      const userId = await getUserId();
      if (!userId) return [];

      const { data, error } = await activityDb()
        .from('activity_events')
        .select(EVENT_COLUMNS)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);

      return rowsOf<ActivityEventRow>(data).flatMap((row) => {
        const event = toActivityEvent(row);
        return event ? [event] : [];
      });
    },
  });
}

/**
 * One event, by id — the deep-link path.
 *
 * `maybeSingle`, so a link to a row that has been purged, cleared or dismissed
 * resolves to `null` rather than throwing. The detail screens turn that null
 * into AC-05 rather than into an error, which is the "never a dead end" rule:
 * from the reader's side, an invitation that was withdrawn and an invitation
 * whose notice they cleared last week are the same fact — there is nothing left
 * to accept — and inventing two screens for it would be inventing a distinction
 * the reader does not have.
 */
export function useActivityEvent(id: string | null) {
  return useQuery({
    queryKey: activityEventKey(id),
    enabled: Boolean(id),
    queryFn: async (): Promise<ActivityEvent | null> => {
      if (!id) return null; // `enabled` already guards; this narrows the type

      const { data, error } = await activityDb()
        .from('activity_events')
        .select(EVENT_COLUMNS)
        .eq('id', id)
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data) return null;
      return toActivityEvent(data as ActivityEventRow);
    },
  });
}

// ---------------------------------------------------------------------------
// Hydration — one batch, whatever the row count
// ---------------------------------------------------------------------------

/**
 * Names and faces for a set of actor ids, via `social_profiles`.
 *
 * SILENTLY PARTIAL, AND THE GAPS ARE THE DESIGN. `social_profiles` names people
 * the caller is already related to — a mutual friend, either half of a follow, a
 * public account, an event co-member, a fellow JOINED group member — and it
 * screens blocked pairs. Everyone else resolves to no name.
 *
 * `public_profiles` is deliberately not used as a fallback, even though
 * `useSentRequests` pairs the two: that view does not screen blocked pairs, and
 * `20260810150100` exists precisely to keep a blocked person from appearing in a
 * list. A nameless row is the honest answer; a name borrowed from a public
 * surface would undo a fix.
 */
async function hydrateActors(ids: readonly string[]): Promise<Map<string, ActivityActor>> {
  const actors = new Map<string, ActivityActor>();
  if (ids.length === 0) return actors;

  const { data, error } = await supabase
    .from('social_profiles')
    .select('user_id, username, display_name, avatar_url, bio')
    .in('user_id', [...ids]);

  // A failed hydration is NOT a failed page. The inbox itself succeeded, and a
  // row whose name could not be resolved still says something true — "A Cinch
  // member invited you to the circle Sunday Roasts" is worse copy and much
  // better than an error screen claiming nothing arrived.
  if (error) return actors;

  // Through `unknown` while the generated types predate the view's `bio`
  // column; the next regen makes the widening a no-op, not a lie.
  for (const row of (data ?? []) as unknown as SocialProfileRow[]) {
    actors.set(row.user_id, {
      name: row.display_name ?? row.username ?? null,
      avatarUrl: row.avatar_url ?? null,
    });
  }
  return actors;
}

export function useActivityActors(events: readonly ActivityEvent[] | undefined) {
  // Keyed on the ids actually referenced, not on the event array: a refetch
  // that returns the same people must not re-run the query, and a genuinely new
  // actor must.
  const signature = useMemo(() => {
    const ids = new Set<string>();
    for (const event of events ?? []) if (event.actorId) ids.add(event.actorId);
    return [...ids].sort().join(',');
  }, [events]);

  return useQuery({
    queryKey: ['activity-actors', signature],
    enabled: signature.length > 0,
    queryFn: () => hydrateActors(signature ? signature.split(',') : []),
  });
}

// ---------------------------------------------------------------------------
// The screen's read model
// ---------------------------------------------------------------------------

export interface ActivityCenterModel {
  lines: ActivityLine[];
  /**
   * Actor id → photograph, for the person-marked rows.
   *
   * Separate from the line rather than on it, because the same actor appears on
   * many rows and a URL copied onto each of them is a URL that has to be kept
   * in step on each of them. Absent, or null, means initials — which is the
   * honest rendering for somebody the reader is not related to.
   */
  faces: Map<string, string | null>;
  /** True when the read failed but a previous one is still in hand — AC-07. */
  hasCached: boolean;
  isLoading: boolean;
  isError: boolean;
  isRefetching: boolean;
  /** The failure itself, for `classifyActivityError`. Never rendered. */
  error: unknown;
  /** When the data currently on screen was last successfully fetched. */
  updatedAt: number;
  refetch: () => void;
}

/**
 * The inbox, resolved into sentences.
 *
 * `isLoading` covers the events only. The actor hydration is deliberately not
 * part of it: names arriving a beat after the rows is a row that fills in, and
 * holding the whole page on one name lookup would show skeletons over data
 * already in hand. Every sentence has a true fallback for an unresolved actor.
 */
export function useActivityCenter(now: Date = new Date()): ActivityCenterModel {
  const events = useActivityEvents();
  const actors = useActivityActors(events.data);

  const rows = events.data;
  const resolved = actors.data;

  // `now.getTime()` rather than `now`: a caller that constructs `new Date()` in
  // render passes a new object every time, and the memo would never hit.
  const stamp = now.getTime();

  const lines = useMemo(() => {
    const at = new Date(stamp);
    return (rows ?? []).map((event) =>
      describeActivity(event, (event.actorId ? resolved?.get(event.actorId) : null) ?? NO_ACTOR, at),
    );
  }, [rows, resolved, stamp]);

  const faces = useMemo(
    () => new Map([...(resolved ?? [])].map(([id, actor]) => [id, actor.avatarUrl])),
    [resolved],
  );

  return {
    lines,
    faces,
    hasCached: events.isError && (rows?.length ?? 0) > 0,
    isLoading: events.isLoading,
    isError: events.isError,
    isRefetching: events.isRefetching,
    error: events.error,
    updatedAt: events.dataUpdatedAt,
    refetch: () => void events.refetch(),
  };
}

// ---------------------------------------------------------------------------
// The dot. Not a count.
// ---------------------------------------------------------------------------

/**
 * Is there a dot on the Daily Social header?
 *
 * **For the integrator.** This is the hook `ActivityEntryButton` keys off. It
 * returns a boolean and nothing else — no count, no list — because §12's rule is
 * that the entry glyph carries presence and never quantity, and a hook that
 * returned a number would be a number waiting to be rendered. The server side
 * agrees: `activity_has_unseen()` is `exists (…)`, which cannot be decomposed
 * into a count even by a caller who wanted one.
 *
 * Errors resolve to `false`: a failed read is not news, and a dot that appeared
 * because the network was down would send the reader to a page that cannot show
 * them anything.
 */
export function useHasUnseenActivity(): boolean {
  const query = useQuery({
    queryKey: ACTIVITY_UNSEEN_KEY,
    queryFn: async (): Promise<boolean> => {
      const userId = await getUserId();
      if (!userId) return false;

      const { data, error } = await activityDb().rpc('activity_has_unseen');
      if (error) throw new Error(error.message);
      return data === true;
    },
  });

  return query.isSuccess && query.data === true;
}
