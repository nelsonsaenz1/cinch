import { useQuery } from '@tanstack/react-query';

import { closetDigest } from '@/features/stylist/intent';
import type { Garment, WeatherContext } from '@/lib/styling';
import { supabase } from '@/lib/supabase';

import { companionOf, dayPartOf, vibeOf, type DayPartKey, type Trip } from './trip';

/**
 * The destination brief — the only part of packing that costs a model call.
 *
 * WHAT THE MODEL IS FOR, AND WHAT IT IS NOT FOR. It is asked what a place is
 * like in a given month — how warm, how dressed-up, what people there actually
 * wear — and then asked to point at garments the user owns. It is never asked
 * to invent a garment: it receives a list of ids with plain names attached and
 * returns ids, and the server drops anything not on the list it sent. Same
 * guarantee the stylist and the outfit re-ranker make, for the same reason —
 * an app that only styles real clothes cannot afford one screen that doesn't.
 *
 * There is no new vendor behind this and no new key. `packing-brief` calls the
 * same OpenRouter credential and the same `ai_config` row every other AI
 * workload uses; "research the destination" is the model's own knowledge of a
 * place, stated plainly and hedged where it should be, not a live web lookup.
 *
 * THE BRIEF IS AN ASSISTANT, NEVER A WALL. Whatever this returns — a brief, a
 * failure, a not-yet-deployed 404 — the closet is rendered underneath it and
 * stays browsable. That is a product rule, enforced by composition in
 * `packing-trip.tsx`: the brief is a section, not a gate.
 */

/**
 * What comes back. Mirrors `packing-brief/schema.ts` on the server.
 *
 * SHAPED LIKE THE FIELD GUIDE'S PLATE, not like a travel report. The guide sets
 * a serif line, a spec line of `·`-separated fragments reading as a caption
 * under a photograph, and one confident observation in the stylist's voice — so
 * that is what the model is asked for. A bulleted list of tips would be a
 * different app's screen.
 */
export type PackingBrief = {
  /** One serif line: the place, the season, the shape of it. */
  headline: string;
  /** Two to four short fragments — "26° warm · smart-casual · linen and leather". */
  spec: string[];
  /** One paragraph, plainly stated, in the stylist's voice. */
  observation: string;
  /** The honest sentence: what the trip wants that this closet does not have. */
  gaps: string | null;
  /** One entry per day-part asked for, in the order they were asked. */
  parts: { part: DayPartKey; note: string; itemIds: string[] }[];
};

/**
 * How many garments travel up.
 *
 * The model has to see real pieces to point at them, so this is not a digest —
 * it is an inventory, and an inventory of a 1000-garment pro closet is both a
 * bill and a haystack. Capped, and capped per slot rather than by recency, so a
 * closet with 300 tops and 4 pairs of shoes still sends the shoes.
 */
const MAX_GARMENTS = 120;
const MAX_PER_SLOT = 20;

type WireGarment = {
  id: string;
  name: string;
  color: string;
  slot: string;
  formality: number;
  warmth: number;
};

/**
 * The closet as the model sees it: names, not photographs; ids, not rows.
 *
 * Ordered within each slot by how much the person actually wears the piece.
 * When something has to be dropped it should be the jacket worn once in 2019,
 * not the coat they live in.
 */
export function wireGarments(wardrobe: Garment[]): WireGarment[] {
  const bySlot = new Map<string, Garment[]>();
  for (const g of wardrobe) {
    const list = bySlot.get(g.slot);
    if (list) list.push(g);
    else bySlot.set(g.slot, [g]);
  }

  const picked: Garment[] = [];
  for (const list of bySlot.values()) {
    picked.push(
      ...[...list].sort((a, b) => b.wearCount - a.wearCount).slice(0, MAX_PER_SLOT),
    );
  }

  return picked.slice(0, MAX_GARMENTS).map((g) => ({
    id: g.id,
    name: g.subcategory ?? g.category,
    color: g.colors[0]?.name ?? '',
    slot: g.slot,
    formality: g.formality,
    warmth: g.warmth,
  }));
}

/**
 * The forecast in three numbers.
 *
 * Real weather beats a model's memory of a month, so when Open-Meteo answered
 * for the destination its answer goes up and the prompt is told to prefer it.
 * When it did not, this is simply absent and the model says what it knows about
 * the season — which is the honest version of the same sentence.
 */
function summariseForecast(forecasts: WeatherContext[] | undefined) {
  if (!forecasts?.length) return undefined;
  return {
    lowC: Math.round(Math.min(...forecasts.map((f) => f.lowC))),
    highC: Math.round(Math.max(...forecasts.map((f) => f.highC))),
    rainDays: forecasts.filter((f) => f.precipitationChance >= 0.4).length,
  };
}

/** A failure the screen can say something true about. */
export class PackingBriefError extends Error {
  constructor(
    message: string,
    readonly kind: 'offline' | 'consent' | 'unavailable' | 'quota',
  ) {
    super(message);
    this.name = 'PackingBriefError';
  }
}

export function usePackingBrief({
  trip,
  wardrobe,
  styleSummary,
  forecasts,
}: {
  trip: Trip | null;
  wardrobe: Garment[];
  styleSummary: string[];
  /** The destination forecast, when it resolved. */
  forecasts: WeatherContext[] | undefined;
}) {
  const garments = trip ? wireGarments(wardrobe) : [];

  return useQuery({
    // Keyed on the answers, not on the object: re-running the same trip after a
    // "start again" that landed in the same place should be a cache hit, and
    // this is a paid model call.
    queryKey: [
      'packing-brief',
      trip?.destination.name,
      trip?.destination.country,
      trip?.days,
      trip?.vibe,
      trip?.companions,
      trip?.parts.join('-'),
      garments.length,
    ],
    enabled: Boolean(trip) && garments.length > 0,
    // A brief for a trip does not go stale while the trip is being packed.
    staleTime: 60 * 60_000,
    // One retry, not the app-wide three. The two failures that actually happen
    // here are "not deployed yet" (404, permanent) and a slow model (worth one
    // more go); three attempts against a 404 is thirty seconds of a spinner
    // before the screen admits anything.
    retry: 1,
    queryFn: async (): Promise<PackingBrief> => {
      const t = trip!;

      const { data, error } = await supabase.functions.invoke('packing-brief', {
        body: {
          trip: {
            destination: t.destination.name,
            country: t.destination.country,
            days: t.days,
            companions: t.companions,
            companionsLabel: companionOf(t.companions).label,
            vibe: t.vibe,
            vibeLabel: vibeOf(t.vibe).label,
            parts: t.parts,
            partLabels: t.parts.map((p) => dayPartOf(p).title),
            // The month is what decides the packing, and it is a fact about the
            // calendar rather than about the user — no timestamp, no location.
            month: new Date().toLocaleDateString('en-US', { month: 'long' }),
          },
          digest: closetDigest(wardrobe),
          styleSummary,
          forecast: summariseForecast(forecasts),
          garments,
        },
      });

      if (error) {
        // `functions.invoke` does NOT put a non-2xx body on `data` — it returns
        // a FunctionsHttpError with the original Response hanging off
        // `context`, which is the same trap `billing/use-gate.ts` documents at
        // length. So the status is read from there, never from `data.error`.
        //
        // Two statuses are worth naming. 404 is what a fresh merge looks like
        // before `supabase functions deploy packing-brief` has run, and must
        // not read as "your trip is broken". 403 is the AI-consent refusal,
        // which is a setting the user can change rather than a failure.
        const status = (error as { context?: Response }).context?.status;
        if (status === 404) {
          throw new PackingBriefError('packing-brief is not deployed yet.', 'unavailable');
        }
        if (status === 403) {
          throw new PackingBriefError('AI processing has not been agreed to.', 'consent');
        }
        // The brief spends the stylist's allowance (see the Edge Function's
        // docblock), so a heavy month of stylist conversation can exhaust it.
        // Telling that person "check your connection" would send them to debug
        // their wifi over a limit that resets.
        if (status === 402 || status === 429) {
          throw new PackingBriefError('The styling allowance is spent.', 'quota');
        }
        throw new PackingBriefError(error.message, 'offline');
      }

      if (!data?.ok) {
        throw new PackingBriefError(String(data?.error ?? 'The brief did not come back.'), 'offline');
      }

      return data.brief as PackingBrief;
    },
  });
}
