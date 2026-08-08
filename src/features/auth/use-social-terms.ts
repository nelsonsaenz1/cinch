import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PostgrestError } from '@supabase/supabase-js';

import { getUserId, supabase } from '@/lib/supabase';

/**
 * The social terms agreement — App Store Guideline 1.2 (user-generated content).
 *
 * Apple requires an agreement, accepted before a user can post, in which the
 * developer states there is no tolerance for objectionable content or abusive
 * users. A passive "by continuing you agree" line on a sign-in screen does not
 * satisfy it: there is no affirmative act and nothing stored to point at.
 *
 * This hook is the client half, and it is the half that can be bypassed. The
 * authoritative half is in the database — every social INSERT runs through
 * `assert_social_terms()` (migration 20260808101000), which raises
 * `social_terms_required` for anyone who has not accepted. That placement is
 * deliberate: social writes never touch an Edge Function, so a gate anywhere
 * else would be advisory. The sheet exists so people meet the terms as a
 * sentence rather than as a failed post.
 *
 * Deliberately mirrors `use-consent.ts` (AI processing, Guideline 5.1.2(i)) —
 * same shape, same version-and-timestamp columns, same re-prompt-on-bump
 * behaviour. Two patterns for "a versioned permission" would be two things to
 * keep in sync.
 *
 * Bump `CURRENT_SOCIAL_TERMS_VERSION` and `current_social_terms_version()` in
 * SQL together — they must match — whenever the terms change materially. That
 * asks every existing user again.
 */
export const CURRENT_SOCIAL_TERMS_VERSION = 1;

/** Raised by the DB gate. Matched rather than parsed — the message is a contract. */
const TERMS_REQUIRED = 'social_terms_required';

export function useSocialTerms() {
  return useQuery({
    queryKey: ['social-terms'],
    queryFn: async (): Promise<{ accepted: boolean; version: number | null }> => {
      const userId = await getUserId();
      if (!userId) return { accepted: false, version: null };

      const { data, error } = await supabase
        .from('profiles')
        .select('social_terms_version')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      const version = data?.social_terms_version ?? null;
      return {
        accepted: version !== null && version >= CURRENT_SOCIAL_TERMS_VERSION,
        version,
      };
    },
  });
}

export function useAcceptSocialTerms() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const userId = await getUserId();
      if (!userId) throw new Error('Not signed in.');

      const { error } = await supabase
        .from('profiles')
        .update({
          social_terms_version: CURRENT_SOCIAL_TERMS_VERSION,
          social_terms_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['social-terms'] });
    },
  });
}

/**
 * Did this write bounce off the terms gate?
 *
 * Callers use this to raise the sheet instead of showing an error — the user
 * has not done anything wrong, they have just arrived at a social surface
 * without passing the agreement first. There is no withdrawal hook to match
 * `useRevokeAiConsent`: withdrawing consent to be bound by terms of service is
 * not a thing you can do while continuing to post under them. Someone who
 * wants out deletes their account, which already cascades their social content.
 */
export function isSocialTermsError(error: unknown): boolean {
  // The sentinel message, not the SQLSTATE: 42501 is also what every ordinary
  // RLS refusal returns, and "you are not a member of this event" must not
  // raise a terms sheet.
  const pg = error as PostgrestError | null;
  return Boolean(pg?.message?.includes(TERMS_REQUIRED));
}

/**
 * Did this write bounce off the content filter (migration 20260808100000)?
 *
 * The message deliberately does not name the matched term — telling the user
 * which word failed turns every rejection into a free lookup against the
 * denylist. It also does not apologise or joke, per the stylist voice rules on
 * error copy: say what happened, then get out of the way.
 */
export function isBlockedTextError(error: unknown): boolean {
  const pg = error as PostgrestError | null;
  return Boolean(pg?.code === '23514' && pg.message?.includes('not allowed here'));
}

/** One place to turn either gate into a sentence a person can read. */
export function moderationMessage(error: unknown): string | null {
  if (isBlockedTextError(error)) {
    return 'That wording is not allowed here. Edit it and try again.';
  }
  if (isSocialTermsError(error)) {
    return 'Agree to the community terms before posting.';
  }
  return null;
}
