import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getUserId, supabase } from '@/lib/supabase';

/**
 * AI processing consent — App Store Guideline 5.1.2(i), in force since
 * 13 November 2025.
 *
 * Apps must clearly disclose that personal data is shared with a third-party AI
 * and obtain explicit in-app permission *before* doing so. A privacy-policy link
 * is explicitly not sufficient.
 *
 * This hook is the client half. The authoritative half is in the Edge Function,
 * which refuses to call any model without a current consent record — because a
 * client-side gate is trivially bypassed and the rule is about what actually
 * leaves the device.
 *
 * Bump `CURRENT_CONSENT_VERSION` (and `current_ai_consent_version()` in SQL,
 * they must match) whenever the processor or the data categories change. That
 * forces every existing user to re-consent.
 *
 * v2 is the 2026-08 rewrite of the disclosure: it names the AI partner,
 * states the no-retention/no-training claim and the face-recognition claim in
 * so many words, and introduces local mode as a real alternative. The text
 * changed materially, so consent given to v1 does not cover it.
 */
export const CURRENT_CONSENT_VERSION = 2;

export function useAiConsent() {
  return useQuery({
    queryKey: ['ai-consent'],
    queryFn: async (): Promise<{
      granted: boolean;
      version: number | null;
      /** When the current consent was recorded — "On since", "Consent recorded". */
      grantedAt: string | null;
      /** When consent was last withdrawn — Settings' honest "Off since <date>". */
      revokedAt: string | null;
    }> => {
      const userId = await getUserId();
      if (!userId) return { granted: false, version: null, grantedAt: null, revokedAt: null };

      const { data, error } = await supabase
        .from('profiles')
        .select('ai_consent_version, ai_consent_at, ai_consent_revoked_at')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      const version = data?.ai_consent_version ?? null;
      return {
        granted: version !== null && version >= CURRENT_CONSENT_VERSION,
        version,
        grantedAt: data?.ai_consent_at ?? null,
        revokedAt: data?.ai_consent_revoked_at ?? null,
      };
    },
  });
}

export function useGrantAiConsent() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const userId = await getUserId();
      if (!userId) throw new Error('Not signed in.');

      const { error } = await supabase
        .from('profiles')
        .update({
          ai_consent_version: CURRENT_CONSENT_VERSION,
          ai_consent_at: new Date().toISOString(),
          // A fresh grant supersedes any earlier withdrawal: "Off since" must
          // never be shown alongside a live consent.
          ai_consent_revoked_at: null,
        })
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ai-consent'] });
    },
  });
}

/**
 * Withdrawal. The disclosure sheet promises this in so many words, so it has to
 * exist and it has to actually stop data leaving the device.
 *
 * Nulling `ai_consent_version` is what does the work: all three Edge Functions
 * (`tag-item`, `generate-outfits`, `stylist-chat`) start by reading that column
 * and refuse with `ai_consent_required` when it is null or below
 * `current_ai_consent_version()`. So revocation is enforced where it matters —
 * server-side, on every call — and not merely hidden in the UI.
 *
 * `ai_consent_at` is cleared alongside it rather than kept as history. The
 * record's only purpose is proving a *current* permission; a stale timestamp
 * with no version attached would just be a date we can no longer interpret.
 * `ai_consent_revoked_at` is set instead: it exists so Settings can honestly
 * say "Off since <date>" (design frame A-06). It is state-change history, not
 * a consent record — nothing server-side reads it as permission for anything.
 *
 * Re-granting is deliberately NOT offered as a one-tap undo anywhere. It goes
 * back through `ConsentSheet`, which writes a fresh version and timestamp via
 * `useGrantAiConsent` — consent that was withdrawn has to be given again in
 * full, with the disclosure in front of the user, or it is not consent.
 */
export function useRevokeAiConsent() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const userId = await getUserId();
      if (!userId) throw new Error('Not signed in.');

      const { error } = await supabase
        .from('profiles')
        .update({
          ai_consent_version: null,
          ai_consent_at: null,
          ai_consent_revoked_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ai-consent'] });

      // Remove rather than invalidate. These two hold model output that was
      // produced under the consent just withdrawn; invalidating would leave it
      // on screen until a refetch that is now guaranteed to be refused. The
      // outfit list falls straight back to the local engine's own prose.
      qc.removeQueries({ queryKey: ['outfit-rerank'] });
      qc.removeQueries({ queryKey: ['chat-history'] });
    },
  });
}
