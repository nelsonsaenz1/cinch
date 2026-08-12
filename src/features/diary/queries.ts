import { useQuery } from '@tanstack/react-query';

import { closetUserId } from '@/features/closet/session';
import { supabase } from '@/lib/supabase';

import { fromIsoDate, toIsoDate } from '@/features/plan/trip';

import { weatherFromSnapshot } from './entry';
import type { DiaryEntry, DiaryPiece } from './types';

/** The key every diary write invalidates. */
export const DIARY_KEY = ['diary'] as const;

/** WD-03's planned rows. Invalidated by `usePlanOutfit`, which owns the writes. */
export const PLANNED_DAYS_KEY = ['diary', 'planned-days'] as const;

/** One row of the embedded `outfit_items`, as PostgREST hands it back. */
type EmbeddedPiece = { item_id: string; position: number | null };

/** The eight columns a garment contributes to the diary. */
type PieceRow = {
  id: string;
  subcategory: string | null;
  category: string;
  colors: unknown;
  brand: string | null;
  wear_count: number;
  purchase_price: number | null;
  listing_path: string | null;
  plate_path: string | null;
  cutout_path: string | null;
  thumb_path: string | null;
};

/**
 * The first named colour, defensively.
 *
 * `colors` is `jsonb` written by an Edge Function whose output contract lives
 * in another file and has drifted before — `useCloset` validates it with zod
 * for exactly that reason. The diary needs one string out of it, so it reads
 * the one string and treats anything else as "no colour named", which is a
 * state the tagger produces legitimately anyway.
 */
function firstColorName(raw: unknown): string | null {
  if (!Array.isArray(raw)) return null;
  const first = raw[0] as { name?: unknown } | undefined;
  return typeof first?.name === 'string' && first.name.trim() ? first.name : null;
}

function toPiece(row: PieceRow): DiaryPiece {
  return {
    id: row.id,
    kind: row.subcategory,
    category: row.category,
    colorName: firstColorName(row.colors),
    brand: row.brand,
    wearCount: row.wear_count,
    purchasePrice: row.purchase_price,
    // The same preference order the closet and item screens resolve in: the
    // retailer's shot the user confirmed, then the plate render, then the
    // cutout, then the thumbnail.
    imagePaths: [row.listing_path, row.plate_path, row.cutout_path, row.thumb_path],
  };
}

/**
 * The whole record, newest first.
 *
 * ── Two reads, and why not one or three ───────────────────────────────────
 *
 * The wears come back with their garments EMBEDDED (`outfit_items(item_id,
 * position)`) — the same shape `use-worn-outfits.ts` has shipped for months.
 * The reverse embed is the one that does not work here: `outfit_items` carries
 * two foreign keys to `outfits` and two more to `items`, so PostgREST refuses
 * an `items(...)` embed as ambiguous (see the account in `co-wear.ts`).
 *
 * That leaves the garments themselves, and they are read WHOLE rather than by
 * id. Two reasons, both load-bearing:
 *
 *   * `useCloset` cannot be reused for them. It filters `is_archived`, and a
 *     coat that has since gone into storage was still worn in March — dropping
 *     it would quietly rewrite the record rather than merely thin it.
 *   * An `.in('id', [...])` over a year of wears is several hundred uuids in a
 *     query string. Reading the user's own items under RLS is one bounded
 *     request with no URL to overflow.
 *
 * The join is done here rather than on the server because it is a `Map`
 * lookup, and a database object to own it would be a migration for a `Map`.
 */
export function useDiary() {
  return useQuery({
    queryKey: DIARY_KEY,
    queryFn: async ({ signal }): Promise<DiaryEntry[]> => {
      const userId = await closetUserId();
      // A session that cannot be confirmed is not an empty diary. Resolving to
      // `[]` here would hand a network hiccup straight to "The record starts
      // today" — telling someone with two years of wears that they have none.
      if (!userId) {
        throw new Error("Couldn't confirm your session. Check your connection and try again.");
      }

      const { data: wears, error: wearsError } = await supabase
        .from('outfits')
        .select(
          'id, worn_at, name, occasion, note, saved_at, origin_outfit_id, generated_by, context_snapshot, outfit_items(item_id, position)',
        )
        .eq('user_id', userId)
        .not('worn_at', 'is', null)
        .order('worn_at', { ascending: false })
        .abortSignal(signal);
      if (wearsError) throw wearsError;
      if (!wears || wears.length === 0) return [];

      const { data: items, error: itemsError } = await supabase
        .from('items')
        .select(
          'id, subcategory, category, colors, brand, wear_count, purchase_price, listing_path, plate_path, cutout_path, thumb_path',
        )
        .eq('user_id', userId)
        .abortSignal(signal);
      if (itemsError) throw itemsError;

      const byId = new Map<string, DiaryPiece>();
      for (const row of (items ?? []) as PieceRow[]) byId.set(row.id, toPiece(row));

      return wears
        .filter((row): row is typeof row & { worn_at: string } => row.worn_at != null)
        .map((row) => {
          const embedded = (row.outfit_items ?? []) as unknown as EmbeddedPiece[];
          const pieces = [...embedded]
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
            // A piece deleted outright since the wear leaves a gap rather than
            // an invented garment: the entry still happened, and the pieces
            // that survive are still what it was made of.
            .flatMap((e) => {
              const piece = byId.get(e.item_id);
              return piece ? [piece] : [];
            });

          return {
            id: row.id,
            wornAt: row.worn_at,
            name: row.name,
            occasion: row.occasion,
            note: row.note,
            savedAt: row.saved_at,
            originOutfitId: row.origin_outfit_id,
            source: row.generated_by,
            weather: weatherFromSnapshot(row.context_snapshot),
            pieces,
          } satisfies DiaryEntry;
        });
    },
    // The record changes on exactly three actions — a confirm, a correction,
    // and a note — and all three invalidate this key directly.
    staleTime: 5 * 60_000,
  });
}

/**
 * WD-03 — the days that are planned but have not happened.
 *
 * A separate query rather than more rows out of `useDiary`, on purpose:
 * `useDiary` is the record, `diary/[id].tsx` resolves an entry out of it, and
 * a plan is not an entry — it has no `worn_at`, no wear counts behind it and
 * no correction window. Mixing the two into one array would let a stale link
 * open a plan as a wear.
 *
 * Read forward from today only. A plan for a day that has already passed
 * without a confirm is not news; the atlas draws the plan ABOVE the worn
 * record, which is only true of a future one.
 *
 * The same two-read shape as `useDiary`, and for the same reasons written up
 * there: `outfit_items` carries two foreign keys to `items`, so PostgREST
 * refuses the embed as ambiguous, and `useCloset` cannot stand in because it
 * filters archived pieces.
 */
export function usePlannedDays(days = 7) {
  return useQuery({
    queryKey: [...PLANNED_DAYS_KEY, days],
    staleTime: 60_000,
    queryFn: async ({ signal }): Promise<DiaryEntry[]> => {
      const userId = await closetUserId();
      if (!userId) return [];

      const today = new Date();
      const from = toIsoDate(today);
      const until = toIsoDate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + days));

      const { data: rows, error } = await supabase
        .from('outfit_calendar')
        .select('planned_date, outfit_id, outfits(id, name, outfit_items(item_id, position))')
        .eq('user_id', userId)
        .gte('planned_date', from)
        .lt('planned_date', until)
        .order('planned_date', { ascending: false })
        .abortSignal(signal);
      if (error) throw error;
      if (!rows || rows.length === 0) return [];

      const { data: items, error: itemsError } = await supabase
        .from('items')
        .select(
          'id, subcategory, category, colors, brand, wear_count, purchase_price, listing_path, plate_path, cutout_path, thumb_path',
        )
        .eq('user_id', userId)
        .abortSignal(signal);
      if (itemsError) throw itemsError;

      const byId = new Map<string, DiaryPiece>();
      for (const row of (items ?? []) as PieceRow[]) byId.set(row.id, toPiece(row));

      return rows.flatMap((row) => {
        const outfit = row.outfits as unknown as PlannedOutfit | null;
        if (!outfit) return [];
        const pieces = [...(outfit.outfit_items ?? [])]
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
          .flatMap((e) => {
            const piece = byId.get(e.item_id);
            return piece ? [piece] : [];
          });
        if (pieces.length === 0) return [];

        return [
          {
            id: outfit.id,
            // Local noon, the `fromIsoDate` convention: a calendar day, not an
            // instant, so no timezone can push Saturday's plan onto Friday.
            wornAt: fromIsoDate(row.planned_date).toISOString(),
            planned: true,
            name: outfit.name,
            occasion: null,
            note: null,
            savedAt: null,
            originOutfitId: null,
            source: 'ai',
            weather: null,
            pieces,
          } satisfies DiaryEntry,
        ];
      });
    },
  });
}

type PlannedOutfit = {
  id: string;
  name: string | null;
  outfit_items?: EmbeddedPiece[];
};
