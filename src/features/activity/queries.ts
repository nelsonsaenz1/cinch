import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useMemo } from 'react';

import { garmentNoun } from '@/features/social-graph/borrowing';
import { profileName, socialDb, type SocialProfile } from '@/features/social-graph/types';
import { getUserId, supabase } from '@/lib/supabase';

import { describeActivity, type ActivityLine } from './sentence';
import { hasUnseen } from './retention';
import {
  isActivityKind,
  NO_SUBJECTS,
  type ActivityFeedRow,
  type ActivitySubjects,
} from './types';

/**
 * The Activity page's reads.
 *
 * One RPC and three batched hydrations, never a per-row fetch: `activity_feed()`
 * hands back seven kinds of row with ids on them, and the names those ids stand
 * for come from `social_profiles`, the caller's own `items`, and `events`. All
 * three hydrations are allowed to come back partial — a block or a revoked
 * invitation between the feed read and the hydration takes the name away, never
 * the row, and the sentence has a true fallback for each.
 *
 * Nothing here is persisted to disk: the keys are absent from
 * `PERSISTED_KEYS` in lib/query-client.ts on purpose. An inbox rehydrated from
 * yesterday's SQLite blob would show a request that has since been answered
 * with its buttons still live.
 */

export const activityFeedKey = ['activity-feed'] as const;
export const activitySeenKey = ['activity-seen-at'] as const;

// ---------------------------------------------------------------------------
// The feed.
// ---------------------------------------------------------------------------

/** Untyped shape of one RPC row before it is narrowed. */
type RawRow = Record<string, unknown>;

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Narrow one RPC row, or drop it.
 *
 * The generated `activity_feed` return type declares every column
 * non-nullable — a `returns table` carries no nullability — and five of the
 * nine are null on most rows, so the honest shape is asserted here rather than
 * trusted from the file. A row missing `kind`, `subject_key` or `occurred_at`
 * has no identity and no place on a dated page; it is dropped, not rendered
 * blank.
 */
function toFeedRow(raw: RawRow): ActivityFeedRow | null {
  const kind = raw.kind;
  const subjectKey = str(raw.subject_key);
  const occurredAt = str(raw.occurred_at);
  if (!isActivityKind(kind) || !subjectKey || !occurredAt) return null;

  const tally = typeof raw.tally === 'number' && Number.isFinite(raw.tally) ? raw.tally : null;

  return {
    kind,
    subjectKey,
    actorId: str(raw.actor_id),
    occurredAt,
    itemId: str(raw.item_id),
    outfitId: str(raw.outfit_id),
    eventId: str(raw.event_id),
    postId: str(raw.post_id),
    tally,
  };
}

/**
 * Thirty days of activity, newest first.
 *
 * The bound is the function's, not this hook's — `activity_feed()` enforces it
 * in SQL so the page cannot accidentally grow a history — and there is no
 * pagination on purpose. "The list ends at thirty days; older answers live on
 * the object itself."
 */
export function useActivityFeed() {
  return useQuery({
    queryKey: activityFeedKey,
    queryFn: async (): Promise<ActivityFeedRow[]> => {
      const userId = await getUserId();
      if (!userId) return [];

      // The generated `Args: never` signature cannot be satisfied by any call,
      // so the client is cast rather than the method — pulling `rpc` off the
      // object detaches its `this` and the builder throws before the network.
      // Same narrowing, and the same reasoning, as `isHandleFree` in
      // features/profile/queries.ts.
      const client = supabase as unknown as {
        rpc(fn: string): PromiseLike<{ data: unknown; error: { message: string } | null }>;
      };

      const { data, error } = await client.rpc('activity_feed');
      if (error) throw new Error(error.message);

      return (Array.isArray(data) ? (data as RawRow[]) : []).flatMap((raw) => {
        const row = toFeedRow(raw);
        return row ? [row] : [];
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Hydration — three batches, whatever the row count.
// ---------------------------------------------------------------------------

interface Hydrated {
  profiles: Map<string, SocialProfile>;
  garments: Map<string, string>;
  events: Map<string, { title: string; startsAt: string | null }>;
}

const EMPTY_HYDRATION: Hydrated = {
  profiles: new Map(),
  garments: new Map(),
  events: new Map(),
};

async function hydrate(rows: readonly ActivityFeedRow[]): Promise<Hydrated> {
  const actorIds = [...new Set(rows.flatMap((r) => (r.actorId ? [r.actorId] : [])))];
  const itemIds = [...new Set(rows.flatMap((r) => (r.itemId ? [r.itemId] : [])))];
  const eventIds = [...new Set(rows.flatMap((r) => (r.eventId ? [r.eventId] : [])))];

  const [profileRes, itemRes, eventRes] = await Promise.all([
    actorIds.length
      ? socialDb
          .from('social_profiles')
          .select('user_id, username, display_name, avatar_url, bio')
          .in('user_id', actorIds)
      : Promise.resolve({ data: [], error: null }),
    // The caller's OWN items: every item id on this page is a garment of hers
    // (a borrow of hers, a compliment on hers), so this reads `items` under her
    // own RLS and needs no projection.
    itemIds.length
      ? supabase.from('items').select('id, category, subcategory').in('id', itemIds)
      : Promise.resolve({ data: [], error: null }),
    eventIds.length
      ? supabase.from('events').select('id, title, starts_at').in('id', eventIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  // A failed hydration is NOT a failed page. The feed itself succeeded, and a
  // row whose name could not be resolved still says something true — "A Cinch
  // member asked to borrow the piece" is worse copy and better than an error
  // screen claiming nothing arrived.
  const profiles = new Map<string, SocialProfile>();
  for (const raw of profileRes.error ? [] : (profileRes.data ?? [])) {
    const row = raw as {
      user_id: string | null;
      username: string | null;
      display_name: string | null;
      avatar_url: string | null;
      bio: string | null;
    };
    if (!row.user_id) continue;
    profiles.set(row.user_id, {
      userId: row.user_id,
      username: row.username,
      displayName: row.display_name,
      avatarUrl: row.avatar_url,
      bio: row.bio,
    });
  }

  const garments = new Map<string, string>();
  for (const raw of itemRes.error ? [] : (itemRes.data ?? [])) {
    const row = raw as { id: string; category: string; subcategory: string | null };
    garments.set(row.id, garmentNoun(row));
  }

  const events = new Map<string, { title: string; startsAt: string | null }>();
  for (const raw of eventRes.error ? [] : (eventRes.data ?? [])) {
    const row = raw as { id: string; title: string; starts_at: string | null };
    events.set(row.id, { title: row.title, startsAt: row.starts_at });
  }

  return { profiles, garments, events };
}

export function useActivityHydration(rows: readonly ActivityFeedRow[] | undefined) {
  // Keyed on the ids actually referenced, not on the row array: a refetch that
  // returns the same people, garments and occasions must not re-run three
  // queries, and a genuinely new actor must.
  const signature = useMemo(() => {
    const ids = new Set<string>();
    for (const row of rows ?? []) {
      if (row.actorId) ids.add(`p${row.actorId}`);
      if (row.itemId) ids.add(`i${row.itemId}`);
      if (row.eventId) ids.add(`e${row.eventId}`);
    }
    return [...ids].sort().join(',');
  }, [rows]);

  return useQuery({
    queryKey: ['activity-subjects', signature],
    enabled: (rows?.length ?? 0) > 0,
    queryFn: () => hydrate(rows ?? []),
  });
}

// ---------------------------------------------------------------------------
// The page's read model.
// ---------------------------------------------------------------------------

export interface ActivityModel {
  lines: ActivityLine[];
  /** Actor id → avatar URL, for the person-marked rows. Absent means initials. */
  faces: Map<string, string | null>;
  isLoading: boolean;
  isError: boolean;
  isRefetching: boolean;
  refetch: () => void;
}

/**
 * The feed, resolved into sentences.
 *
 * `isLoading` covers the feed only. The hydration is deliberately not part of
 * it: names arriving a beat after the rows is a row that fills in, and holding
 * the whole page on three name lookups would show skeletons for data already in
 * hand. The sentence has a true fallback for every unresolved id.
 */
export function useActivity(now: Date = new Date()): ActivityModel {
  const feed = useActivityFeed();
  const subjects = useActivityHydration(feed.data);

  const rows = feed.data;
  const resolved = subjects.data ?? EMPTY_HYDRATION;

  // `now.getTime()` rather than `now`: a caller that constructs `new Date()` in
  // render passes a new object every time, and the memo would never hit.
  const stamp = now.getTime();

  const lines = useMemo(() => {
    const at = new Date(stamp);
    return (rows ?? []).map((row) => {
      const profile = row.actorId ? resolved.profiles.get(row.actorId) : undefined;
      const event = row.eventId ? resolved.events.get(row.eventId) : undefined;
      const subject: ActivitySubjects = {
        ...NO_SUBJECTS,
        actorName: profile ? profileName(profile) : null,
        garment: row.itemId ? (resolved.garments.get(row.itemId) ?? null) : null,
        eventTitle: event?.title ?? null,
        eventStartsAt: event?.startsAt ?? null,
      };
      return describeActivity(row, subject, at);
    });
  }, [rows, resolved, stamp]);

  const faces = useMemo(
    () => new Map([...resolved.profiles].map(([id, p]) => [id, p.avatarUrl])),
    [resolved],
  );

  return {
    lines,
    faces,
    isLoading: feed.isLoading,
    isError: feed.isError,
    isRefetching: feed.isRefetching,
    refetch: () => void feed.refetch(),
  };
}

// ---------------------------------------------------------------------------
// The dot. Not a count.
// ---------------------------------------------------------------------------

/** `profiles.activity_seen_at` — the only thing the dot is made of. */
export function useActivitySeenAt() {
  return useQuery({
    queryKey: activitySeenKey,
    queryFn: async (): Promise<string | null> => {
      const userId = await getUserId();
      if (!userId) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('activity_seen_at')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      return data?.activity_seen_at ?? null;
    },
  });
}

/**
 * Is there a dot on Today?
 *
 * **For the integrator.** This is the hook the Today tab keys off. It returns a
 * boolean and nothing else — no count, no list — because AV's rule is that the
 * tab shows a dot and never a number, and a hook that returned a number would
 * be a number waiting to be rendered.
 *
 * It reads the same `['activity-feed']` cache the page does, so the tab and the
 * page never disagree and the tab costs no extra request once the page has been
 * opened. Errors resolve to `false`: a failed read is not news, and a dot that
 * appears because the network is down would send the reader to a page that
 * cannot show them anything.
 */
export function useHasUnseenActivity(): boolean {
  const feed = useActivityFeed();
  const seen = useActivitySeenAt();

  const newest = feed.data?.[0]?.occurredAt ?? null;
  if (feed.isError || seen.isError) return false;
  return hasUnseen(newest, seen.data);
}

/**
 * Clear the dot.
 *
 * **For the integrator.** Opening the page is the whole gesture — there is no
 * "mark all read" anywhere in this feature, because marking read as a chore is
 * one of the four things this page will not do. `src/app/activity.tsx` calls
 * this on mount; nothing else should need to.
 */
export function useMarkActivitySeen() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const userId = await getUserId();
      if (!userId) return;

      const { error } = await supabase
        .from('profiles')
        .update({ activity_seen_at: new Date().toISOString() })
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: activitySeenKey });
    },
  });
}
