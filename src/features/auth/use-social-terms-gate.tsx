import { useCallback, useState } from 'react';

import { SocialTermsSheet } from '@/components/social/social-terms-sheet';

import { isSocialTermsError, useAcceptSocialTerms } from './use-social-terms';

/**
 * The terms gate as one moving part, for every social write in the app.
 *
 * `assert_social_terms()` (migration 20260808101000) raises
 * `social_terms_required` on INSERT to events, event_members,
 * event_outfit_posts, event_outfit_votes, event_comments, borrow_requests and
 * follows. That refusal is not a failure the user can act on — it means they
 * have reached a social surface without passing the agreement — so every one
 * of those call sites has to raise the sheet instead of printing an error.
 *
 * Written as a hook rather than copied into seven screens because those screens
 * report failure seven different ways: an inline line under a list, an
 * `Alert.alert`, a per-row `'failed'` state. The only part they share is the
 * decision — *is this the gate, and if so what do I retry?* — so that is the
 * only part that lives here. Everything else stays where it was.
 *
 * ── Using it ──────────────────────────────────────────────────────────────
 *
 *   const terms = useSocialTermsGate();
 *   ...
 *   follow.mutate(vars, {
 *     onError: (error) => {
 *       if (terms.intercept(error, () => sendRequest(profile))) return;
 *       Alert.alert('Could not send that request', …);   // unchanged
 *     },
 *   });
 *   ...
 *   {terms.sheet}
 *
 * `intercept` returns true when it has taken responsibility for the error, so
 * the guard clause above is the whole integration. The retry closure is what
 * runs after the user agrees — it should be the same call that just failed,
 * because the answer to "before you post" is that they still want to post.
 */
export function useSocialTermsGate() {
  const accept = useAcceptSocialTerms();

  /**
   * The action waiting on an answer, or null when the sheet is closed.
   *
   * Held in a single-field object rather than as a bare function: `useState`
   * treats a function argument as a lazy initialiser, so `setRetry(fn)` would
   * call `fn` instead of storing it — a mistake that would fire the write
   * again the moment it failed.
   */
  const [pending, setPending] = useState<{ retry: () => void; dismiss?: () => void } | null>(null);

  const intercept = useCallback(
    (error: unknown, retry: () => void, dismiss?: () => void): boolean => {
      if (!isSocialTermsError(error)) return false;
      setPending({ retry, dismiss });
      return true;
    },
    [],
  );

  const onAccept = useCallback(() => {
    accept.mutate(undefined, {
      onSuccess: () => {
        // Clear before retrying: the retry can fail again for an unrelated
        // reason, and the sheet must not still be over the screen when it does.
        const again = pending?.retry;
        setPending(null);
        again?.();
      },
    });
  }, [accept, pending]);

  const onDecline = useCallback(() => {
    // `dismiss` is how a caller clears whatever it left on screen when the
    // write failed — a mutation's own error state, a spinner, a 'failed' row.
    // Declining is a real answer, and it should leave no wreckage behind.
    pending?.dismiss?.();
    setPending(null);
  }, [pending]);

  /**
   * The sheet as an ELEMENT, not a component.
   *
   * Returning `() => <SocialTermsSheet …/>` from a hook mints a new component
   * *type* on every render, and React unmounts and remounts anything whose type
   * changed. For a `Modal` that lands mid-dismiss, which left the screen showing
   * an empty white page sheet with the app still alive underneath it. An element
   * keeps the type fixed and only its props move, so the modal animates out once
   * and the screen behind it survives.
   */
  const sheet = (
    <SocialTermsSheet
      visible={pending !== null}
      busy={accept.isPending}
      onAccept={onAccept}
      onDecline={onDecline}
    />
  );

  return {
    /** Call first in `onError`. True means the sheet is up and the caller is done. */
    intercept,
    /** True while the sheet is showing — for suppressing an inline error line. */
    blocked: pending !== null,
    /** Render once, anywhere in the screen: `{terms.sheet}`. */
    sheet,
  };
}
