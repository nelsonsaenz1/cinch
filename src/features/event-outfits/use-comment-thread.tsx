import { useCallback, useRef, useState } from 'react';

import type { ThreadComment } from '@/components/event-outfits/CommentRow';
import { useSocialTermsGate } from '@/features/auth/use-social-terms-gate';
import { withReplyPrefix } from '@/features/event-outfits/comment-thread';
import { useAddComment } from '@/features/event-outfits/mutations';
import { useEventComments } from '@/features/event-outfits/queries';

/**
 * One thread's read + optimistic-write state, shared by the standalone
 * `comments.tsx` route and the Look Board's `CommentsSheet` (L-03) so the
 * "keeps its text where it was written, with a retry on the row" rule (EC-02
 * / contract §3) is written once, not twice.
 *
 * Optimistic rows are held in LOCAL state, never patched into the query
 * cache — the same split `VotePill` documents (this codebase's rule is
 * invalidate, don't patch): a pending row is reconciled away the moment
 * `useAddComment`'s `onSuccess` invalidates and the real row arrives; a
 * failed one stays exactly as typed until retried or deleted.
 */
export function useCommentThread(eventId: string | null, postId: string | null) {
  const comments = useEventComments(eventId, postId);
  const addComment = useAddComment();
  const terms = useSocialTermsGate();

  const [pending, setPending] = useState<ThreadComment[]>([]);
  const [replyTo, setReplyTo] = useState<{ userId: string; firstName: string } | null>(null);
  const seq = useRef(0);

  // A NAMED function expression, so the retry path can call it.
  //
  // `terms.intercept` needs a "do it again once they've accepted" thunk, and the
  // thing to do again is this. Written as `post` — the const — that thunk closed
  // over a binding that is still in its temporal dead zone while the callback is
  // being built. It happened to work, because the thunk only ever runs later, but
  // the React compiler cannot prove that and said so. A function expression's own
  // name is in scope and initialised inside its body, which makes the recursion
  // legal rather than merely lucky.
  const post = useCallback(
    function post(clientId: string, body: string) {
      if (!eventId) return;
      addComment.mutate(
        { eventId, postId, body },
        {
          onSuccess: () => setPending((p) => p.filter((c) => c.id !== clientId)),
          onError: (error) => {
            if (
              terms.intercept(error, () => post(clientId, body), () =>
                setPending((p) => p.filter((c) => c.id !== clientId)),
              )
            ) {
              return;
            }
            setPending((p) =>
              p.map((c) => (c.id === clientId ? { ...c, pending: false, failed: true } : c)),
            );
          },
        },
      );
    },
    [eventId, postId, addComment, terms],
  );

  const send = useCallback(
    (rawBody: string) => {
      const trimmed = rawBody.trim();
      if (!trimmed || !eventId) return;
      const body = withReplyPrefix(trimmed, replyTo?.firstName ?? null);
      const clientId = `pending-${++seq.current}`;
      const optimistic: ThreadComment = {
        id: clientId,
        eventId,
        postId: postId ?? null,
        userId: '__me__',
        body,
        reported: false,
        hidden: false,
        createdAt: new Date(),
        pending: true,
      };
      setPending((p) => [...p, optimistic]);
      setReplyTo(null);
      post(clientId, body);
    },
    [eventId, postId, replyTo, post],
  );

  const retry = useCallback(
    (comment: ThreadComment) => {
      setPending((p) => p.map((c) => (c.id === comment.id ? { ...c, pending: true, failed: false } : c)));
      post(comment.id, comment.body);
    },
    [post],
  );

  /**
   * Audit 94's "Edit" on a failed row.
   *
   * The edit is applied to the KEPT row and sent from there. It is deliberately
   * not routed through `send`, which would mint a new client id and a new
   * optimistic row: the words a user is looking at have to be the words that go,
   * or the guarantee this whole path exists to make ("nothing is silently lost")
   * is only true by coincidence.
   *
   * An emptied edit is a no-op rather than a send of nothing — and it does NOT
   * delete the row, because a user who has just cleared a field has not asked
   * for their words to be thrown away. Delete is its own control beside this one.
   */
  const editAndRetry = useCallback(
    (comment: ThreadComment, rawBody: string) => {
      const body = rawBody.trim();
      if (!body) return;
      setPending((p) =>
        p.map((c) => (c.id === comment.id ? { ...c, body, pending: true, failed: false } : c)),
      );
      post(comment.id, body);
    },
    [post],
  );

  const deletePending = useCallback((comment: ThreadComment) => {
    setPending((p) => p.filter((c) => c.id !== comment.id));
  }, []);

  const rows: ThreadComment[] = [...(comments.data ?? []), ...pending];

  return {
    comments,
    rows,
    send,
    retry,
    editAndRetry,
    deletePending,
    replyTo,
    setReplyTo,
    /** Render once per thread instance: `{thread.termsSheet}`. */
    termsSheet: terms.sheet,
  };
}
