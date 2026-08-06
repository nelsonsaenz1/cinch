import { useQuery } from '@tanstack/react-query';

import { getUserId, supabase } from '@/lib/supabase';
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
  /** `@handle`. Nullable until the user claims one — the column exists today,
   *  but the claiming UI arrives with the social wave. */
  username: string | null;
  homeCity: string | null;
  bio: string | null;
  styleTags: string[];
};

/**
 * Identity for the closet masthead. Mirrors the fallback chain Profile's own
 * header uses (src/app/profile.tsx): `display_name` is rarely set because there
 * is no settings UI for it yet, so the Apple Sign In name captured at first
 * login backs it up, then the email's local part, before giving up.
 */
export function useClosetIdentity() {
  return useQuery({
    queryKey: ['closet-identity'],
    queryFn: async (): Promise<ClosetIdentity> => {
      const userId = await getUserId();
      if (!userId) return { name: 'You', username: null, homeCity: null, bio: null, styleTags: [] };

      const [{ data: claimsData }, { data: row }] = await Promise.all([
        supabase.auth.getClaims(),
        supabase
          .from('profiles')
          .select('display_name, username, bio, home_city, style_tags')
          .eq('user_id', userId)
          .maybeSingle(),
      ]);

      const claims = claimsData?.claims;
      const meta = (claims?.user_metadata ?? {}) as { full_name?: string };
      const email = (claims?.email as string | undefined) ?? null;

      const name =
        row?.display_name || meta.full_name || (email ? email.split('@')[0] : null) || 'You';

      return {
        name,
        username: row?.username ?? null,
        homeCity: row?.home_city ?? null,
        bio: row?.bio ?? null,
        styleTags: row?.style_tags ?? [],
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
    queryFn: async (): Promise<number> => {
      const userId = await getUserId();
      if (!userId) return 0;

      const { count, error } = await supabase
        .from('outfits')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);

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
 */
export function mostWornItems(items: Item[], limit: number): Item[] {
  return items
    .filter((i) => i.wearCount > 0)
    .sort((a, b) => b.wearCount - a.wearCount || a.createdAt.localeCompare(b.createdAt))
    .slice(0, limit);
}

/**
 * What a piece is called when it stands alone: "Charcoal wool coat" rather than
 * a bare subcategory. Colour first because that is how people refer to their
 * own clothes; capitalised because it opens a caption.
 */
export function pieceName(item: Item): string {
  const raw = [item.colors[0]?.name, item.subcategory ?? item.category]
    .filter(Boolean)
    .join(' ');
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** "27 wears", with the singular handled once instead of at every call site. */
export function wearsLabel(count: number): string {
  return `${count} ${count === 1 ? 'wear' : 'wears'}`;
}
