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
 */
export const CURRENT_CONSENT_VERSION = 1;

export function useAiConsent() {
  return useQuery({
    queryKey: ['ai-consent'],
    queryFn: async (): Promise<{ granted: boolean; version: number | null }> => {
      const userId = await getUserId();
      if (!userId) return { granted: false, version: null };

      const { data, error } = await supabase
        .from('profiles')
        .select('ai_consent_version')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      const version = data?.ai_consent_version ?? null;
      return {
        granted: version !== null && version >= CURRENT_CONSENT_VERSION,
        version,
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
        })
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ai-consent'] });
    },
  });
}
