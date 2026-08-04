import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  describeWeights,
  meanFeatures,
  updateAffinities,
  updateWeights,
  type FeatureVector,
  type OutfitCandidate,
} from '@/lib/styling';
import { getUserId, supabase } from '@/lib/supabase';

import type { StyleProfile } from './queries';

export type ReactionSource = 'today' | 'chat' | 'shuffle' | 'onboarding_quiz';

/**
 * Record a like or dislike and fold it into the learned model.
 *
 * The learning maths runs on the client rather than in a database function for
 * one reason that matters: the very same code has to run when the app is
 * offline. Outfit generation works with no network, so reacting must too —
 * otherwise the offline experience silently stops learning, and the user's
 * taste profile develops holes wherever they happened to be on a plane.
 *
 * The write is a single RPC so the reaction row and the updated model land
 * atomically. Consistency risk here is asymmetric: a model updated without its
 * reaction recorded can never be reconstructed, because the reaction log is the
 * only evidence the update happened.
 */
export function useReactToOutfit() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      candidate,
      shownAlongside,
      liked,
      profile,
      outfitId,
      reason,
      source = 'today',
    }: {
      candidate: OutfitCandidate;
      /** Every candidate that was on screen, including this one. */
      shownAlongside: OutfitCandidate[];
      liked: boolean;
      profile: StyleProfile;
      outfitId?: string | null;
      reason?: string;
      source?: ReactionSource;
    }) => {
      const userId = await getUserId();
      if (!userId) throw new Error('Not signed in.');

      const baseline: FeatureVector = meanFeatures(
        shownAlongside.length ? shownAlongside : [candidate],
      );

      const weights = updateWeights(profile.weights, candidate.features, baseline, liked);
      const affinities = updateAffinities(profile.affinities, candidate.items, liked);
      const summary = describeWeights(weights);

      const { error } = await supabase.rpc('apply_outfit_reaction', {
        p_item_ids: candidate.items.map((g) => g.id),
        p_reaction: liked ? 1 : -1,
        p_features: candidate.features,
        p_baseline: baseline,
        p_weights: weights,
        p_affinities: affinities,
        p_summary: summary,
        p_outfit_id: outfitId ?? undefined,
        p_reason: reason,
        p_source: source,
      });

      if (error) throw error;
      return { weights, affinities, summary };
    },

    onSuccess: (next) => {
      // Write straight into the cache so the next generation on this screen
      // already reflects the reaction. Waiting for a refetch would let the user
      // dislike an outfit and immediately be shown its twin.
      qc.setQueryData<StyleProfile>(['style-profile'], (prev) =>
        prev
          ? { ...prev, ...next, feedbackCount: prev.feedbackCount + 1 }
          : { ...next, feedbackCount: 1 },
      );
      void qc.invalidateQueries({ queryKey: ['style-profile'] });
    },
  });
}

/**
 * Persist a generated outfit and mark it worn.
 *
 * "Wear It" is the strongest positive signal the app receives — far stronger
 * than a tap on a heart — so it trains the model as a like in addition to
 * incrementing the wear counts.
 */
export function useWearOutfit() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      candidate,
      context,
      reasoning,
    }: {
      candidate: OutfitCandidate;
      context: unknown;
      reasoning: string;
    }) => {
      const userId = await getUserId();
      if (!userId) throw new Error('Not signed in.');

      const { data: outfit, error: outfitError } = await supabase
        .from('outfits')
        .insert({
          user_id: userId,
          generated_by: 'ai',
          reasoning,
          context_snapshot: context as never,
        })
        .select('id')
        .single();

      if (outfitError) throw outfitError;

      const { error: itemsError } = await supabase.from('outfit_items').insert(
        candidate.items.map((g, i) => ({
          outfit_id: outfit.id,
          item_id: g.id,
          user_id: userId,
          role: 'base',
          position: i,
        })),
      );
      if (itemsError) throw itemsError;

      const { error: wearError } = await supabase.rpc('log_outfit_wear', {
        p_outfit_id: outfit.id,
      });
      if (wearError) throw wearError;

      return outfit.id;
    },

    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wardrobe'] });
      void qc.invalidateQueries({ queryKey: ['closet'] });
    },
  });
}
