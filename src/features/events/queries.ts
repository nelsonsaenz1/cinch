import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { PostgrestError } from '@supabase/supabase-js';

import { getUserId, supabase } from '@/lib/supabase';
import type { EventOutfitPostRow, SocialProfileRow } from '@/features/social/db-rows';
import { dateKey } from '@/lib/date';
import { useDebouncedValue } from '@/lib/use-debounced-value';

import {
  toEvent,
  toEventMember,
  toEventSummary,
  type EventDetail,
  type EventMember,
  type EventSummary,
  type EventWithMembersRow,
} from './types';

// ---------------------------------------------------------------------------
// Reaching the social tables
// ---------------------------------------------------------------------------

/**
 * Formerly a fluent-builder shim while `src/types/database.ts` predated the
 * social migrations; the regen has landed, so this is the typed builder again.
 * Each query still asserts its row type at the boundary (the generated view
 * types are all-nullable, the hand-written seam types are the honest shapes).
 */
type SocialResult = { data: unknown; error: PostgrestError | null };
type SocialQuery = PromiseLike<SocialResult> & {
  select(columns?: string): SocialQuery;
  insert(values: Record<string, unknown>): SocialQuery;
  update(values: Record<string, unknown>): SocialQuery;
  delete(): SocialQuery;
  eq(column: string, value: unknown): SocialQuery;
  in(column: string, values: readonly unknown[]): SocialQuery;
  is(column: string, value: null): SocialQuery;
  gte(column: string, value: unknown): SocialQuery;
  or(filters: string): SocialQuery;
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): SocialQuery;
  limit(count: number): SocialQuery;
  maybeSingle(): SocialQuery;
  single(): SocialQuery;
};

type SocialTable =
  | 'events'
  | 'event_members'
  | 'event_outfit_posts'
  | 'social_profiles';

/**
 * `supabase.from` for the social tables, narrowed to the slice this feature
 * chains. The typed client's `from` has separate table and view overloads, so
 * a union spanning both ('events' is a table, 'social_profiles' a view) matches
 * neither — hence the one indirection.
 */
export function socialFrom(table: SocialTable): SocialQuery {
  const from = supabase.from.bind(supabase) as (relation: SocialTable) => unknown;
  return from(table) as SocialQuery;
}

// ---------------------------------------------------------------------------
// The upcoming-events fetch (one wire shape, two hooks)
// ---------------------------------------------------------------------------

/**
 * Every upcoming event the caller can see, as summaries.
 *
 * One fetch feeds both `useMyEvents` and `useEventInvites` (below) through
 * react-query's `select`, so the Plan tab's two strips never race two copies
 * of the same request. Three requests total, regardless of list size:
 *
 *   1. events + embedded roster slices (RLS decides visibility);
 *   2. one `social_profiles` batch for every face in every avatar cluster;
 *   3. the caller's own `event_outfit_posts`, for the LOOK SET / NEEDS A
 *      LOOK chip. This reads the TABLE under RLS — it does not import the
 *      event-outfits module, which keeps the build plan's module graph acyclic.
 */
async function fetchUpcomingEvents(): Promise<EventSummary[]> {
  const userId = await getUserId();
  if (!userId) return [];

  // Date-only bound, local calendar: an occasion tonight is upcoming all day,
  // and a multi-day trip that started yesterday is still on until it ends.
  const today = dateKey(new Date());

  // `starts_at.is.null` is the third arm because a dateless occasion has no
  // date to compare and would otherwise be filtered out of the only list it
  // appears in — an occasion the host created and then could not find. It
  // cannot be in the past either, so "upcoming" is the honest bucket for it.
  //
  // Sorted soonest first with the dateless ones LAST. Ascending order puts
  // NULLs last in Postgres anyway; `nullsFirst: false` is spelled out because
  // this is a product decision, not a default worth inheriting — a list that
  // opened with every undated occasion would bury the thing happening
  // tonight, and the day someone flips this sort to descending, the default
  // would quietly do exactly that.
  const { data, error } = await socialFrom('events')
    .select('*, event_members(user_id, role, state)')
    .is('canceled_at', null)
    .or(`starts_at.gte.${today},ends_at.gte.${today},starts_at.is.null`)
    .order('starts_at', { ascending: true, nullsFirst: false });
  if (error) throw error;

  const rows = (data ?? []) as EventWithMembersRow[];
  if (rows.length === 0) return [];

  // Identity for the avatar clusters, one batch for the whole list. Self is
  // excluded because `social_profiles` won't return it anyway.
  const memberIds = [
    ...new Set(
      rows.flatMap((r) => r.event_members.map((m) => m.user_id)).filter((id) => id !== userId),
    ),
  ];
  const profiles = new Map<string, SocialProfileRow>();
  if (memberIds.length > 0) {
    const { data: profileData, error: profileError } = await socialFrom('social_profiles')
      .select('user_id, username, display_name, avatar_url')
      .in('user_id', memberIds);
    if (profileError) throw profileError;
    for (const p of (profileData ?? []) as SocialProfileRow[]) profiles.set(p.user_id, p);
  }

  // Which of these events the caller has shared a look into. Degrades instead
  // of throwing: the status chip is enrichment, and the list must not go down
  // with it (the posts table lands in a later migration than events).
  const myPostedEventIds = new Set<string>();
  try {
    const { data: postData, error: postError } = await socialFrom('event_outfit_posts')
      .select('event_id')
      .eq('user_id', userId)
      .in('event_id', rows.map((r) => r.id));
    if (postError) throw postError;
    for (const p of (postData ?? []) as Pick<EventOutfitPostRow, 'event_id'>[]) {
      myPostedEventIds.add(p.event_id);
    }
  } catch (err) {
    console.warn('[events] could not read own posts for the look chip', err);
  }

  return rows.map((row) => toEventSummary(row, userId, { profiles, myPostedEventIds }));
}

/** Both list hooks read one cache entry; mutations invalidate this one key. */
const UPCOMING_KEY = ['my-events'] as const;

// Module-level so the projections are referentially stable across renders —
// an inline arrow would defeat react-query's select memoisation.
const pickMine = (events: EventSummary[]) =>
  events.filter((e) => e.isHost || e.myState === 'joined');
const pickInvites = (events: EventSummary[]) => events.filter((e) => e.myState === 'invited');

/** Upcoming events the caller is hosting or has joined, soonest first. */
export function useMyEvents(): UseQueryResult<EventSummary[]> {
  return useQuery({
    queryKey: UPCOMING_KEY,
    queryFn: fetchUpcomingEvents,
    select: pickMine,
  });
}

/** Open invitations — events where the caller is still deciding. */
export function useEventInvites(): UseQueryResult<EventSummary[]> {
  return useQuery({
    queryKey: UPCOMING_KEY,
    queryFn: fetchUpcomingEvents,
    select: pickInvites,
  });
}

// ---------------------------------------------------------------------------
// Detail + roster
// ---------------------------------------------------------------------------

/** One event, with the caller's own standing derived. Null when the id no
 *  longer resolves — deleted, or visibility lost (removed, blocked). */
export function useEvent(eventId: string | null): UseQueryResult<EventDetail | null> {
  return useQuery({
    queryKey: ['event', eventId],
    enabled: Boolean(eventId),
    queryFn: async (): Promise<EventDetail | null> => {
      const userId = await getUserId();
      if (!userId || !eventId) return null;

      const { data, error } = await socialFrom('events')
        .select('*, event_members(user_id, role, state)')
        .eq('id', eventId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      return toEvent(data as EventWithMembersRow, userId);
    },
  });
}

/**
 * The roster, identities hydrated from `social_profiles`.
 *
 * Only `joined` and `invited` rows are asked for. `declined` is deliberately
 * absent from the wire, not filtered in the UI: the product rule is that a
 * decline is silent and shows only as absence, and the surest way to never
 * render one is to never hold one.
 */
export function useEventMembers(eventId: string): UseQueryResult<EventMember[]> {
  return useQuery({
    queryKey: ['event-members', eventId],
    enabled: Boolean(eventId),
    queryFn: async (): Promise<EventMember[]> => {
      const { data, error } = await socialFrom('event_members')
        .select('user_id, role, state')
        .eq('event_id', eventId)
        .in('state', ['joined', 'invited'])
        .order('created_at', { ascending: true });
      if (error) throw error;

      const rows = (data ?? []) as {
        user_id: string;
        role: EventMember['role'];
        state: EventMember['state'];
      }[];
      if (rows.length === 0) return [];

      const userId = await getUserId();
      const otherIds = rows.map((r) => r.user_id).filter((id) => id !== userId);
      const profiles = new Map<string, SocialProfileRow>();
      if (otherIds.length > 0) {
        const { data: profileData, error: profileError } = await socialFrom('social_profiles')
          .select('user_id, username, display_name, avatar_url')
          .in('user_id', otherIds);
        if (profileError) throw profileError;
        for (const p of (profileData ?? []) as SocialProfileRow[]) profiles.set(p.user_id, p);
      }

      const members = rows.map((r) => toEventMember(r, profiles.get(r.user_id) ?? null));
      // Host leads, then joined, then still-deciding — the order the screen
      // reads them in, decided here so every consumer agrees.
      const rank = (m: EventMember) => (m.role === 'host' ? 0 : m.state === 'joined' ? 1 : 2);
      members.sort((a, b) => rank(a) - rank(b));
      return members;
    },
  });
}

// ---------------------------------------------------------------------------
// Invite search
// ---------------------------------------------------------------------------

/**
 * People the host can put on the list, searched by name or username over
 * `social_profiles` — which already scopes results to people the caller is
 * legitimately related to (friends, follows, co-members) and screens blocks.
 * The view is the authority; this hook adds nothing but the typeahead.
 */
export function useInviteCandidates(search: string): UseQueryResult<SocialProfileRow[]> {
  // PostgREST's `or` filter is a little language of commas and parens, so a
  // query containing them would be parsed as syntax, not text. Stripping is
  // enough — nobody's username contains a paren, and a search is best-effort.
  const q = search.trim().replace(/[,()%]/g, '');
  // Debounce the query, not the render: the field updates every keystroke,
  // the Supabase round trip waits for typing to pause.
  const debouncedQ = useDebouncedValue(q, 200);

  return useQuery({
    queryKey: ['invite-candidates', debouncedQ],
    enabled: debouncedQ.length >= 2,
    staleTime: 60_000,
    queryFn: async (): Promise<SocialProfileRow[]> => {
      const { data, error } = await socialFrom('social_profiles')
        .select('user_id, username, display_name, avatar_url')
        .or(`username.ilike.%${debouncedQ}%,display_name.ilike.%${debouncedQ}%`)
        .limit(20);
      if (error) throw error;
      return (data ?? []) as SocialProfileRow[];
    },
  });
}
