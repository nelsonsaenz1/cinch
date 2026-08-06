import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  eventCommentsKey,
  eventPostsKey,
  myVoteKey,
} from '@/features/event-outfits/queries';
import { getUserId, supabase } from '@/lib/supabase';

/** Untyped client for tables the generated types don't know yet — see queries.ts. */
const social = supabase as unknown as SupabaseClient;

/**
 * The stable errcodes the social triggers raise, mapped to the stylist's
 * voice. These are contracts from architecture.md §6, not guesses:
 *
 *   54000  — rate-limit triggers ("slow down", never a scold)
 *   22023  — a semantic refusal (self-vote, invalid transition)
 *   42501  — not a member / not allowed
 *   23505  — a uniqueness race (one vote per event; one post per outfit)
 */
const code = (error: unknown): string | undefined =>
  (error as { code?: string } | null)?.code;

export function socialErrorMessage(error: unknown): string {
  switch (code(error)) {
    case '54000':
      return 'You’re moving fast — take a breath and try again in a bit.';
    case '22023':
      return 'That one’s yours to wear, not to pick — your friends do the voting.';
    case '42501':
      return 'Join the event first.';
    case '23505':
      return 'That look is already on the board.';
    default:
      return 'That didn’t go through. Check your connection and try again.';
  }
}

/**
 * Pin a look: publish one of MY existing outfits onto my board for this
 * event. `user_id` is sent explicitly because the composite FK
 * `(outfit_id, user_id) -> outfits(id, user_id)` is what proves the outfit is
 * mine — the insert fails for anyone else's outfit at the schema, not the UI.
 *
 * The 1–3 options cap is presentation (the screen stops offering the CTA);
 * the once-per-event uniqueness is schema (`event_posts_once`, 23505).
 */
export function usePostOutfit() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      outfitId,
      caption,
    }: {
      eventId: string;
      outfitId: string;
      caption: string | null;
    }) => {
      const me = await getUserId();
      if (!me) throw new Error('Not signed in.');

      const { error } = await social.from('event_outfit_posts').insert({
        event_id: eventId,
        user_id: me,
        outfit_id: outfitId,
        caption: caption?.trim() ? caption.trim() : null,
      });
      if (error) throw error;
    },
    onSuccess: (_data, { eventId }) => {
      void qc.invalidateQueries({ queryKey: eventPostsKey(eventId) });
    },
  });
}

/**
 * Retire a look from the board. RLS allows the owner or the host; votes and
 * per-look comments cascade with it, so all three caches are refetched.
 */
export function useDeletePost() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ postId }: { eventId: string; postId: string }) => {
      const { error } = await social.from('event_outfit_posts').delete().eq('id', postId);
      if (error) throw error;
    },
    onSuccess: (_data, { eventId }) => {
      void qc.invalidateQueries({ queryKey: eventPostsKey(eventId) });
      void qc.invalidateQueries({ queryKey: myVoteKey(eventId) });
      void qc.invalidateQueries({ queryKey: eventCommentsKey(eventId) });
    },
  });
}

/**
 * Cast (or move) the caller's one pick in this event.
 *
 * There is deliberately no UPDATE policy on votes — changing a pick is
 * delete-then-insert (architecture.md §2, Migration C), which keeps the
 * movable pick costless and auditable. The window between the two statements
 * can lose a race with this user's own second device: the insert then hits
 * `unique(event_id, voter_id)` (23505), and the whole delete+insert is
 * retried exactly once before giving up to a refetch.
 *
 * No optimistic cache writes anywhere in this file: handlers invalidate and
 * the refetch re-reads through RLS — the invalidate-don't-patch rule.
 */
export function useCastVote() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId, postId }: { eventId: string; postId: string }) => {
      const me = await getUserId();
      if (!me) throw new Error('Not signed in.');

      const cast = async () => {
        const del = await social
          .from('event_outfit_votes')
          .delete()
          .eq('event_id', eventId)
          .eq('voter_id', me);
        if (del.error) throw del.error;

        const ins = await social.from('event_outfit_votes').insert({
          post_id: postId,
          // The trigger re-derives event_id from the post and overwrites this;
          // sent anyway so the row is honest even before the trigger runs.
          event_id: eventId,
          voter_id: me,
        });
        if (ins.error) throw ins.error;
      };

      try {
        await cast();
      } catch (error) {
        if (code(error) !== '23505') throw error;
        await cast();
      }
    },
    onSettled: (_data, _error, { eventId }) => {
      void qc.invalidateQueries({ queryKey: eventPostsKey(eventId) });
      void qc.invalidateQueries({ queryKey: myVoteKey(eventId) });
    },
  });
}

/** Take the pick back entirely. Silent to everyone — retraction never notifies. */
export function useRetractVote() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventId }: { eventId: string }) => {
      const me = await getUserId();
      if (!me) throw new Error('Not signed in.');

      const { error } = await social
        .from('event_outfit_votes')
        .delete()
        .eq('event_id', eventId)
        .eq('voter_id', me);
      if (error) throw error;
    },
    onSettled: (_data, _error, { eventId }) => {
      void qc.invalidateQueries({ queryKey: eventPostsKey(eventId) });
      void qc.invalidateQueries({ queryKey: myVoteKey(eventId) });
    },
  });
}

/**
 * A comment — on the event thread (`postId` null) or one look. Compliments
 * ride this same path with a fixed-vocabulary body; the server's rate-limit
 * trigger (30/hour, errcode 54000) is the abuse control, surfaced through
 * `socialErrorMessage`.
 */
export function useAddComment() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      eventId,
      postId,
      body,
    }: {
      eventId: string;
      postId: string | null;
      body: string;
    }) => {
      const me = await getUserId();
      if (!me) throw new Error('Not signed in.');

      const trimmed = body.trim();
      if (!trimmed) throw new Error('Say something first.');

      const { error } = await social.from('event_comments').insert({
        event_id: eventId,
        post_id: postId,
        user_id: me,
        body: trimmed,
      });
      if (error) throw error;
    },
    onSuccess: (_data, { eventId }) => {
      void qc.invalidateQueries({ queryKey: eventCommentsKey(eventId) });
    },
  });
}

/** Author or host removes a comment outright. */
export function useDeleteComment() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ commentId }: { eventId: string; commentId: string }) => {
      const { error } = await social.from('event_comments').delete().eq('id', commentId);
      if (error) throw error;
    },
    onSuccess: (_data, { eventId }) => {
      void qc.invalidateQueries({ queryKey: eventCommentsKey(eventId) });
    },
  });
}

/**
 * The host's moderation switch. The update object carries ONLY `hidden` —
 * the column-level grant means any other column in this payload would fail
 * the whole statement, and that is the schema working as designed: the host
 * hides words, she never rewrites them.
 */
export function useHideComment() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      commentId,
      hidden,
    }: {
      eventId: string;
      commentId: string;
      hidden: boolean;
    }) => {
      const { error } = await social
        .from('event_comments')
        .update({ hidden })
        .eq('id', commentId);
      if (error) throw error;
    },
    onSuccess: (_data, { eventId }) => {
      void qc.invalidateQueries({ queryKey: eventCommentsKey(eventId) });
    },
  });
}
