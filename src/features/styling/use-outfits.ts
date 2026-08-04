import { useQuery } from '@tanstack/react-query';

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

/** How many candidates go up for re-ranking. */
const SHORTLIST = 12;

export type StylingStatus = 'ai' | 'offline' | 'consent_required';

export type StyledOutfit = {
  candidate: OutfitCandidate;
  name: string;
  reasoning: string;
  swapNote: string | null;
  /** Whether the words came from the model or from the local scorer. */
  source: 'ai' | 'engine';
};

export type OutfitsResult = {
  outfits: StyledOutfit[];
  /** Everything the engine shortlisted — the learner's comparison baseline. */
  shortlist: OutfitCandidate[];
  status: StylingStatus;
};

const candidateId = (c: OutfitCandidate) => c.items.map((g) => g.id).join('.');

/**
 * Local-first fallback.
 *
 * Never a silent mock. The caller surfaces `status: 'offline'` in the UI, but
 * the outfits themselves are entirely real — chosen by the same scorer that
 * would have produced the shortlist for the model. Only the prose is different,
 * and it is honest prose derived from the actual scoring notes rather than
 * invented.
 */
function fromEngine(candidates: OutfitCandidate[], wardrobe: Garment[], ctx: StyleContext): StyledOutfit[] {
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
 * Today's outfits.
 *
 * Two stages, and the split is the whole architecture:
 *
 *   1. The beam search runs locally over the entire closet and ranks every
 *      valid combination. This is fast, free, deterministic, and works with no
 *      network — which is what lets outfit generation stay available on the
 *      free tier instead of being metered.
 *
 *   2. The top dozen go to the model, which re-ranks on taste and writes the
 *      reasoning. Because it sees a shortlist rather than a closet, the prompt
 *      is a few hundred tokens instead of tens of thousands.
 *
 * If stage 2 fails for any reason, stage 1's results stand.
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
  return useQuery({
    // `now` is deliberately excluded from the key — it changes every render and
    // would make this uncacheable. The date is what actually matters.
    queryKey: [
      'outfits',
      wardrobe.length,
      context.weather?.feelsLikeC,
      context.events.map((e) => e.id).join(','),
      context.note,
      profile.feedbackCount,
      count,
    ],
    enabled: enabled && wardrobe.length > 0,
    staleTime: 15 * 60_000,
    queryFn: async (): Promise<OutfitsResult> => {
      const shortlist = generateOutfits(wardrobe, context, {
        weights: profile.weights,
        affinities: profile.affinities,
        count: SHORTLIST,
        diversity: 0.45,
      });

      if (!shortlist.length) return { outfits: [], shortlist, status: 'offline' };

      const top = shortlist.slice(0, count);

      try {
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

        if (data?.error === 'ai_consent_required') {
          return { outfits: fromEngine(top, wardrobe, context), shortlist, status: 'consent_required' };
        }
        if (!data?.ok || !Array.isArray(data.picks)) {
          return { outfits: fromEngine(top, wardrobe, context), shortlist, status: 'offline' };
        }

        const byId = new Map(shortlist.map((c) => [candidateId(c), c]));
        const outfits: StyledOutfit[] = [];

        for (const pick of data.picks as {
          candidateId: string;
          name: string;
          reasoning: string;
          swapNote: string | null;
        }[]) {
          const candidate = byId.get(pick.candidateId);
          if (!candidate) continue; // already filtered server-side; belt and braces
          outfits.push({
            candidate,
            name: pick.name,
            reasoning: pick.reasoning,
            swapNote: pick.swapNote,
            source: 'ai',
          });
        }

        return outfits.length
          ? { outfits, shortlist, status: 'ai' }
          : { outfits: fromEngine(top, wardrobe, context), shortlist, status: 'offline' };
      } catch {
        // Network down, function cold, rate limited — all the same to the user,
        // and all still produce real outfits.
        return { outfits: fromEngine(top, wardrobe, context), shortlist, status: 'offline' };
      }
    },
  });
}
