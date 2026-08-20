import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { getUserId, supabase } from '@/lib/supabase';

import {
  engineOccasionsFor,
  type StyleProfileGate,
} from './lifestyle';

/**
 * The lifestyle profile's one server fact, read and written.
 *
 * `tour-queries.ts` is the template, held to deliberately: a server column
 * rather than a device flag (the offer is "once, ever, on any device"),
 * `staleTime: Infinity` because the app's own mutations are the only thing
 * that changes the answer, `retry: 1` because this read sits inside the
 * sign-in handoff's held beat, and an error resolving to `unavailable`,
 * which never shows the questionnaire — replaying onboarding at a six-month
 * user because the network blinked is worse than a new user meeting the
 * stock options.
 */

export const LIFESTYLE_KEY = ['lifestyle-profile'] as const;

const EMPTY: string[] = [];

type LifestyleRow =
  | { signedIn: false }
  | {
      signedIn: true;
      promptedAt: string | null;
      lifeStage: string | null;
      occasions: string[];
    };

async function readLifestyle(signal: AbortSignal): Promise<LifestyleRow> {
  const userId = await getUserId();
  if (!userId) return { signedIn: false };

  const { data, error } = await supabase
    .from('profiles')
    .select('style_profile_prompted_at, life_stage, dress_occasions')
    .eq('user_id', userId)
    .abortSignal(signal)
    .maybeSingle();

  if (error) throw error;
  // No row yet is not an error: an account with no profile row has
  // demonstrably never been asked.
  return {
    signedIn: true,
    promptedAt: data?.style_profile_prompted_at ?? null,
    lifeStage: data?.life_stage ?? null,
    occasions: data?.dress_occasions ?? [],
  };
}

export type Lifestyle = {
  gate: StyleProfileGate;
  lifeStage: string | null;
  /** The tapped occasion keys, in selection order. Empty until answered. */
  occasions: string[];
  /** The engine's occasion tags those keys reach — for `StyleContext`. */
  engineOccasions: string[];
};

export function useLifestyle(): Lifestyle {
  const query = useQuery({
    queryKey: LIFESTYLE_KEY,
    queryFn: ({ signal }) => readLifestyle(signal),
    staleTime: Infinity,
    retry: 1,
  });

  const gate: StyleProfileGate = query.isPending
    ? { status: 'loading' }
    : query.isError || !query.data || !query.data.signedIn
      ? { status: 'unavailable' }
      : {
          status: 'ready',
          promptedAt: query.data.promptedAt,
          lifeStage: query.data.lifeStage,
          occasions: query.data.occasions,
        };

  const ready = gate.status === 'ready';
  // `gate.occasions` is the query's own array, so its identity is stable
  // between renders; EMPTY keeps the not-ready branch equally stable. The
  // memo matters because `StyleContext` re-mints its `now` whenever any
  // input's identity changes — a fresh array here would rebuild the context
  // every frame.
  const occasions = ready ? gate.occasions : EMPTY;
  const engineOccasions = useMemo(() => engineOccasionsFor(occasions), [occasions]);
  return {
    gate,
    lifeStage: ready ? gate.lifeStage : null,
    occasions,
    engineOccasions,
  };
}

/**
 * Save the answers. Also stamps the prompt mark, so an account that answered
 * can never be re-offered by a gate that only saw half the write.
 *
 * The cache is set before the round trip and never rolled back — the
 * `useMarkToured` trade exactly: the alternative to a write that quietly
 * fails is a person who cannot leave the questionnaire, and the cost is one
 * more offer on the next cold start.
 */
export function useSaveLifestyle() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (vars: { lifeStage: string | null; occasions: string[] }) => {
      const userId = await getUserId();
      if (!userId) return;
      const { error } = await supabase
        .from('profiles')
        .update({
          life_stage: vars.lifeStage,
          dress_occasions: vars.occasions,
          style_profile_prompted_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
      if (error) throw error;
    },
    onMutate: (vars) => {
      const next: LifestyleRow = {
        signedIn: true,
        promptedAt: new Date().toISOString(),
        lifeStage: vars.lifeStage,
        occasions: vars.occasions,
      };
      qc.setQueryData<LifestyleRow>(LIFESTYLE_KEY, next);
    },
  });
}

/** Close the offer without answers — the Skip path. */
export function useMarkStyleProfilePrompted() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const userId = await getUserId();
      if (!userId) return;
      const { error } = await supabase
        .from('profiles')
        .update({ style_profile_prompted_at: new Date().toISOString() })
        .eq('user_id', userId);
      if (error) throw error;
    },
    onMutate: () => {
      const prior = qc.getQueryData<LifestyleRow>(LIFESTYLE_KEY);
      const next: LifestyleRow = {
        signedIn: true,
        promptedAt: new Date().toISOString(),
        lifeStage: prior && 'lifeStage' in prior ? prior.lifeStage : null,
        occasions: prior && 'occasions' in prior ? prior.occasions : [],
      };
      qc.setQueryData<LifestyleRow>(LIFESTYLE_KEY, next);
    },
  });
}
