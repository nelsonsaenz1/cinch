import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import {
  explain,
  generateOutfits,
  suggestSwap,
  type Garment,
  type OutfitCandidate,
  type StyleContext,
} from '@/lib/styling';
import { supabase } from '@/lib/supabase';

import type { StyleProfile } from './queries';
import { shouldEnhanceWithAi } from './should-enhance';

/** How many candidates go up for re-ranking. */
const SHORTLIST = 12;

/**
 * `'local'` is the ordinary morning, and it is not a degraded state.
 *
 * Before the enhancement gate, "no model output" could only mean the call had
 * failed, so the merge reported `'offline'` for it. Now the common case is that
 * no call was made at all — there was no question worth asking — and calling
 * that offline would be reporting a network problem where there is none.
 */
export type StylingStatus = 'ai' | 'enhancing' | 'local' | 'offline' | 'consent_required';

export type StyledOutfit = {
  candidate: OutfitCandidate;
  name: string;
  reasoning: string;
  swapNote: string | null;
  /** Whether the words came from the model or from the local scorer. */
  source: 'ai' | 'engine';
};

const candidateId = (c: OutfitCandidate) => c.items.map((g) => g.id).join('.');

/**
 * Local-first outfits.
 *
 * Never a silent mock. The caller surfaces the offline state in the UI, but the
 * outfits themselves are entirely real — chosen by the same scorer that would
 * have produced the shortlist for the model. Only the prose differs, and it is
 * honest prose derived from the actual scoring notes rather than invented.
 */
function fromEngine(
  candidates: OutfitCandidate[],
  wardrobe: Garment[],
  ctx: StyleContext,
): StyledOutfit[] {
  return candidates.map((candidate) => {
    const swap = suggestSwap(candidate.items, wardrobe, ctx.events);
    return {
      candidate,
      name: candidate.notes.weather ?? 'From your closet',
      reasoning: explain(candidate),
      swapNote: swap
        ? `Swap in your ${swap.item.colors[0]?.name ?? ''} ${swap.item.subcategory ?? 'layer'} for ${swap.forEvent.title.toLowerCase()}.`.replace(
            /\s+/g,
            ' ',
          )
        : null,
      source: 'engine' as const,
    };
  });
}

/**
 * Today's outfits, in two stages that are deliberately NOT awaited together.
 *
 *   1. The beam search runs locally over the whole closet, synchronously, in
 *      about ten milliseconds. Its results are returned on the very first
 *      render. This works offline, costs nothing, and is why outfit generation
 *      can stay unmetered on the free tier.
 *
 *   2. A background request sends the top dozen to the model, which re-ranks on
 *      taste and writes the reasoning. When it lands — fifteen to twenty
 *      seconds later — its names and prose replace the engine's.
 *
 * Running these inside one query function was the obvious first shape and the
 * wrong one: it made the screen wait twenty seconds to show outfits that were
 * already computed. Splitting them is the entire reason the architecture is
 * local-first, so the split has to exist here and not just in the diagram.
 */
export function useOutfits({
  wardrobe,
  context,
  profile,
  count = 3,
  enabled = true,
}: {
  wardrobe: Garment[];
  context: StyleContext;
  profile: StyleProfile;
  count?: number;
  enabled?: boolean;
}) {
  // --- Stage 1: instant, local, synchronous -------------------------------
  const shortlist = useMemo(() => {
    if (!enabled || !wardrobe.length) return [];
    return generateOutfits(wardrobe, context, {
      weights: profile.weights,
      affinities: profile.affinities,
      count: SHORTLIST,
      diversity: 0.45,
    });
  }, [enabled, wardrobe, context, profile.weights, profile.affinities]);

  const base = useMemo(
    () => fromEngine(shortlist.slice(0, count), wardrobe, context),
    [shortlist, count, wardrobe, context],
  );

  // --- Stage 2: background enhancement, when there is a question ----------
  //
  // NOT ON EVERY MORNING. This used to fire on every render that produced a
  // shortlist, which meant an ordinary Tuesday — no note, one event, a clear
  // winner — spent a model call to relabel outfits the scorer had already
  // chosen. `shouldEnhanceWithAi` is the whole gate and it is pure; see that
  // file for why each of the three reasons is a real question.
  const decision = useMemo(
    () => shouldEnhanceWithAi({ context, candidates: shortlist, visible: count }),
    [context, shortlist, count],
  );

  const ai = useQuery({
    // Keyed on the actual candidate set, so an unchanged shortlist is a cache
    // hit even when the wardrobe array identity changes on refetch.
    queryKey: ['outfit-rerank', shortlist.map(candidateId), context.note, count],
    enabled: enabled && shortlist.length > 0 && decision.enhance,
    staleTime: 15 * 60_000,
    // One shot. A failure here costs the user nothing — they already have
    // outfits — and retrying a 20-second call twice is worse than not.
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('generate-outfits', {
        body: {
          count,
          candidates: shortlist.map((c) => ({
            id: candidateId(c),
            score: c.score,
            notes: Object.values(c.notes).filter(Boolean),
            items: c.items.map((g) => ({
              slot: g.slot,
              name: g.subcategory ?? g.category,
              color: g.colors[0]?.name ?? '',
              formality: g.formality,
            })),
          })),
          context: {
            weather: context.weather,
            events: context.events.map((e) => ({
              title: e.title,
              startsAt: `${String(Math.floor(e.startsAt / 60)).padStart(2, '0')}:${String(e.startsAt % 60).padStart(2, '0')}`,
              formality: e.formality,
            })),
            note: context.note,
          },
          styleSummary: profile.summary,
        },
      });

      if (error) throw error;
      return data as {
        ok?: boolean;
        error?: string;
        picks?: { candidateId: string; name: string; reasoning: string; swapNote: string | null }[];
      };
    },
  });

  // --- Merge ---------------------------------------------------------------
  const { outfits, status } = useMemo(() => {
    if (ai.data?.error === 'ai_consent_required') {
      return { outfits: base, status: 'consent_required' as StylingStatus };
    }
    if (ai.isError) return { outfits: base, status: 'offline' as StylingStatus };
    // Nothing was asked, so nothing is missing. The outfits are complete.
    if (!decision.enhance) return { outfits: base, status: 'local' as StylingStatus };
    if (!ai.data?.ok || !ai.data.picks?.length) {
      return {
        outfits: base,
        status: (ai.isFetching ? 'enhancing' : 'offline') as StylingStatus,
      };
    }

    /**
     * PROSE ONLY. The late response may not move a garment.
     *
     * This used to build the visible list FROM the model's picks, in the
     * model's order — so a response landing fifteen seconds after the cards
     * appeared could reorder them, drop one the person was looking at, and
     * promote a candidate they had never seen. That is the thing the plan
     * forbids, and it was happening under somebody's thumb: the swap button
     * and the wear button are on those cards.
     *
     * Now the base list is authoritative. The model's words are matched onto
     * the outfits ALREADY ON SCREEN by candidate id, and anything it returns
     * for a candidate that is not visible is discarded rather than promoted.
     * An enhancement that names nothing visible leaves the screen exactly as
     * it was.
     */
    const words = new Map(ai.data.picks.map((p) => [p.candidateId, p]));
    let enriched = 0;
    const merged: StyledOutfit[] = base.map((outfit) => {
      const pick = words.get(candidateId(outfit.candidate));
      if (!pick) return outfit;
      enriched += 1;
      return {
        ...outfit,
        name: pick.name,
        reasoning: pick.reasoning,
        swapNote: pick.swapNote,
        source: 'ai' as const,
      };
    });

    return enriched
      ? { outfits: merged, status: 'ai' as StylingStatus }
      : { outfits: base, status: 'offline' as StylingStatus };
  }, [ai.data, ai.isError, ai.isFetching, base, decision.enhance]);

  return {
    outfits,
    /** Everything the engine shortlisted — the learner's comparison baseline. */
    shortlist,
    status,
    /** True while the model is still working; outfits are already on screen. */
    isEnhancing: ai.isFetching,
    /**
     * Whether an enhancement was even requested, and why.
     *
     * Exposed for tests and for anything that wants to explain the screen's
     * behaviour honestly. `enhance: false` is the normal morning.
     */
    enhancement: decision,
    refetch: ai.refetch,
    /**
     * The re-rank's failure, when it failed. Exposed for exactly one consumer:
     * Today's pull-to-refresh, which uses it to tell a quota refusal apart
     * from an outage. The silent background degradation stays silent — this
     * hook still never throws and `outfits` is always populated.
     */
    aiError: ai.error,
  };
}
