import { useQuery } from '@tanstack/react-query';

import { closetSession, closetUserId } from '@/features/closet/session';
import { compareIsoTimestamps } from '@/lib/date';
import { supabase } from '@/lib/supabase';
import { costPerWear, type Item } from '@/schemas/item';

/**
 * The profile-as-closet data layer — everything the Closet tab's masthead
 * numbers and identity lines are derived from.
 *
 * A NEW file rather than additions to `queries.ts` on purpose: the social wave
 * has four agents in flight and `queries.ts` is on their shared import list, so
 * this module keeps the closet-profile surface out of their diff entirely.
 * Nothing here is fabricated — every number traces to a real row the user owns.
 */

/** Who the closet belongs to, as the profile row + auth claims know them. */
export type ClosetIdentity = {
  name: string;
  /** `@handle`. Nullable until the user claims one in the edit-profile sheet
   *  (features/profile) — claiming is optional and many accounts predate it. */
  username: string | null;
  homeCity: string | null;
  bio: string | null;
  styleTags: string[];
  /** The profile photograph, as a public URL. Null until one is set — the
   *  monogram is the fallback, not a placeholder face. */
  avatarUrl: string | null;
};

/**
 * Identity for the closet masthead. Mirrors the fallback chain Profile's own
 * header uses (src/app/profile.tsx): `display_name` is settable in the
 * edit-profile sheet but optional, so the Apple Sign In name captured at first
 * login backs it up, then the email's local part, before giving up.
 *
 * Reads the name and email off the LOCAL session rather than `getClaims()`.
 * On Hermes, `getClaims()` degrades to a network `getUser()` on every call and
 * inherits the auth client's hang modes (see features/closet/session.ts) — and
 * verified claims buy nothing here, because the masthead only greets the person
 * this device already believes is signed in. RLS decides what the row query
 * returns regardless.
 */
export function useClosetIdentity() {
  return useQuery({
    queryKey: ['closet-identity'],
    queryFn: async ({ signal }): Promise<ClosetIdentity> => {
      const session = await closetSession();
      const user = session?.user;
      if (!user) {
        return {
          name: 'You',
          username: null,
          homeCity: null,
          bio: null,
          styleTags: [],
          avatarUrl: null,
        };
      }

      const { data: row } = await supabase
        .from('profiles')
        .select('display_name, username, bio, home_city, style_tags, avatar_url')
        .eq('user_id', user.id)
        .abortSignal(signal)
        .maybeSingle();

      const meta = (user.user_metadata ?? {}) as { full_name?: string };
      const email = user.email ?? null;

      const name =
        row?.display_name || meta.full_name || (email ? email.split('@')[0] : null) || 'You';

      return {
        name,
        username: row?.username ?? null,
        homeCity: row?.home_city ?? null,
        bio: row?.bio ?? null,
        styleTags: row?.style_tags ?? [],
        avatarUrl: row?.avatar_url ?? null,
      };
    },
    // The row changes only through settings screens the user is not on while
    // looking at their own closet; pull-to-refresh covers the rest.
    staleTime: 5 * 60_000,
  });
}

/**
 * How many outfits the user has — the OUTFITS masthead numeral.
 *
 * A head-only count, not a row fetch: the number is the entire requirement, and
 * every outfit row carries a context snapshot that would be dead weight here.
 * Counts saved outfits of every source (AI-generated, self-built), because that
 * is what the `outfits` table holds and the stat claims nothing narrower.
 */
export function useOutfitCount() {
  return useQuery({
    queryKey: ['outfit-count'],
    queryFn: async ({ signal }): Promise<number> => {
      const userId = await closetUserId();
      if (!userId) return 0;

      const { count, error } = await supabase
        .from('outfits')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .abortSignal(signal);

      if (error) throw error;
      return count ?? 0;
    },
    // Wearing an outfit invalidates ['closet'], not this key (that mutation
    // predates this screen and is not ours to edit mid-wave), so a short
    // staleness window plus pull-to-refresh is what keeps the numeral honest.
    staleTime: 60_000,
  });
}

/** The masthead's derived numbers, computed over the whole closet. */
export type ClosetStats = {
  pieces: number;
  /** Items with no recorded wear — `items.wear_count` is written transactionally
   *  by `wear_outfit_tx`, so zero genuinely means never worn through the app. */
  unworn: number;
  /** Mean cost-per-wear over items that have BOTH a price and at least one
   *  wear; null when no item qualifies, and the prose line simply goes unsaid. */
  avgCostPerWear: number | null;
};

export function closetStats(items: Item[]): ClosetStats {
  const unworn = items.filter((i) => i.wearCount === 0).length;
  const priced = items
    .map((i) => costPerWear(i))
    .filter((v): v is number => v !== null && Number.isFinite(v));
  const avgCostPerWear = priced.length
    ? priced.reduce((s, v) => s + v, 0) / priced.length
    : null;
  return { pieces: items.length, unworn, avgCostPerWear };
}

/**
 * The most-worn pieces, descending, ties broken oldest-first so the list is
 * stable across refetches. Only items actually worn qualify — a bar chart with
 * zero-length bars is a list of things the section is not about.
 *
 * The tiebreak compares with `compareIsoTimestamps`, not `localeCompare`: two
 * pieces on equal wear counts are exactly the case where the timestamps are
 * likely to differ only by a fraction of a second (one import, one
 * transaction), and that is the pair ICU collation orders backwards. "Oldest
 * first" has to actually mean oldest first or the rail's rank is arbitrary
 * below the top row.
 */
export function mostWornItems(items: Item[], limit: number): Item[] {
  return items
    .filter((i) => i.wearCount > 0)
    .sort((a, b) => b.wearCount - a.wearCount || compareIsoTimestamps(a.createdAt, b.createdAt))
    .slice(0, limit);
}

/**
 * Garment naming moved to `item-name.ts` when the grid and the item-detail
 * screen started needing it too — three surfaces printing three different
 * names for one sweater. Re-exported here so this module's existing importers
 * keep their one import line.
 */
export { pieceName, wearsLabel } from '@/features/closet/item-name';
