import { useQuery } from '@tanstack/react-query';

import {
  DEFAULT_WEIGHTS,
  EMPTY_AFFINITIES,
  FEATURE_KEYS,
  toGarment,
  type Affinities,
  type Garment,
  type StyleWeights,
} from '@/lib/styling';
import { getUserId, supabase } from '@/lib/supabase';

export type StyleProfile = {
  weights: StyleWeights;
  affinities: Affinities;
  feedbackCount: number;
  summary: string[];
};

/**
 * Merge stored weights over the defaults rather than replacing them.
 *
 * This is what lets a new scoring feature ship without a data migration: rows
 * written before the feature existed simply have no entry for it and inherit
 * its prior. Replacing wholesale would silently drop the new feature to zero
 * for every existing user.
 */
function mergeWeights(stored: unknown): StyleWeights {
  const out = { ...DEFAULT_WEIGHTS };
  if (stored && typeof stored === 'object') {
    for (const key of FEATURE_KEYS) {
      const v = (stored as Record<string, unknown>)[key];
      if (typeof v === 'number' && Number.isFinite(v)) out[key] = v;
    }
  }
  return out;
}

function mergeAffinities(stored: unknown): Affinities {
  const base: Affinities = {
    colorPairs: { ...EMPTY_AFFINITIES.colorPairs },
    slotPairs: { ...EMPTY_AFFINITIES.slotPairs },
    items: { ...EMPTY_AFFINITIES.items },
    brands: { ...EMPTY_AFFINITIES.brands },
  };
  if (!stored || typeof stored !== 'object') return base;

  const s = stored as Record<string, unknown>;
  for (const key of ['colorPairs', 'slotPairs', 'items', 'brands'] as const) {
    const table = s[key];
    if (table && typeof table === 'object') {
      for (const [k, v] of Object.entries(table as Record<string, unknown>)) {
        if (typeof v === 'number' && Number.isFinite(v)) base[key][k] = v;
      }
    }
  }
  return base;
}

/** The learned model. Falls back to priors for a user who has never reacted. */
export function useStyleProfile() {
  return useQuery({
    queryKey: ['style-profile'],
    queryFn: async (): Promise<StyleProfile> => {
      const userId = await getUserId();
      if (!userId) {
        return {
          weights: DEFAULT_WEIGHTS,
          affinities: EMPTY_AFFINITIES,
          feedbackCount: 0,
          summary: [],
        };
      }

      const { data, error } = await supabase
        .from('style_profiles')
        .select('weights, affinities, feedback_count, summary')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      return {
        weights: mergeWeights(data?.weights),
        affinities: mergeAffinities(data?.affinities),
        feedbackCount: data?.feedback_count ?? 0,
        summary: data?.summary ?? [],
      };
    },
    // The model changes only when the user reacts, and that path invalidates
    // this key directly.
    staleTime: 5 * 60_000,
  });
}

/**
 * The wardrobe as scoring inputs.
 *
 * Kept separate from `useCloset` on purpose. The closet grid wants display
 * shapes and pagination; the engine wants every wearable item at once, because
 * a beam search over a partial closet silently produces worse outfits with no
 * indication anything is missing.
 */
export function useWardrobe() {
  return useQuery({
    queryKey: ['wardrobe'],
    queryFn: async (): Promise<Garment[]> => {
      const userId = await getUserId();
      if (!userId) return [];

      const { data, error } = await supabase
        .from('items')
        .select('*')
        .eq('user_id', userId)
        .eq('is_archived', false)
        // Items still uploading have no tags worth scoring.
        .in('status', ['tagged', 'needs_review', 'verified']);

      if (error) throw error;
      return (data ?? []).map(toGarment);
    },
    staleTime: 60_000,
  });
}

/** Enough of a closet to generate something worth showing. */
export const MIN_CLOSET_FOR_OUTFITS = 8;

export function canGenerate(wardrobe: Garment[]): boolean {
  const hasCore =
    (wardrobe.some((g) => g.slot === 'base_top') && wardrobe.some((g) => g.slot === 'bottom')) ||
    wardrobe.some((g) => g.slot === 'dress');
  return hasCore && wardrobe.length >= MIN_CLOSET_FOR_OUTFITS;
}
