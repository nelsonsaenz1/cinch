import type { PostgrestError } from '@supabase/supabase-js';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { getUserId, supabase } from '@/lib/supabase';

import { deleteAvatarObject, prepareAvatar, uploadAvatar } from './avatar';
import { normaliseHandle } from './handle';

/**
 * The one write behind the edit-profile form.
 *
 * Everything the form can change lands in a single `profiles` row, so it is a
 * single mutation rather than four — a save that half-applies would leave the
 * user staring at a form that disagrees with the page behind it. The avatar
 * is the one part that cannot join the transaction (Storage and Postgres do
 * not share one), so it is ordered to fail safely: upload first, then write
 * the row, then delete the object the row no longer points at. A failure
 * anywhere leaves an orphaned FILE, never a profile pointing at nothing.
 */

/** `profiles_bio_length` (20260807110000). */
export const BIO_MAX = 280;

/** Not a constraint — `display_name` is unbounded text. A name is a name. */
export const NAME_MAX = 60;

/** Does this look like a PostgrestError? Narrow enough for the code switch. */
function pgCode(error: unknown): string | null {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as PostgrestError).code);
  }
  return null;
}

/**
 * The sentence to show under a failed save.
 *
 * A raw Postgres constraint name is not an explanation. These three are the
 * only ways a well-formed save can be refused, and each one is the user's to
 * fix — so each gets a sentence that names the field and the fix.
 */
export function saveProfileDenialCopy(error: unknown): string | null {
  const code = pgCode(error);
  if (code === '23505') return 'That handle is already taken. Try another.';
  if (code === '23514') {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('bio')) return `Your bio is longer than ${BIO_MAX} characters.`;
    return 'That handle has a character in it that handles cannot have.';
  }
  return null;
}

export type ProfileEdits = {
  displayName: string;
  /** Without the `@`. Empty string clears the claim. */
  username: string;
  bio: string;
  /**
   * What to do with the photograph:
   * - `undefined` — leave it alone (the common save).
   * - `{ uri, width, height }` — a freshly picked local image to prepare and
   *   upload. The dimensions come from the picker; the resize needs them to
   *   know which edge is the long one.
   * - `null` — remove the photograph and fall back to the monogram.
   */
  avatar?: { uri: string; width: number; height: number } | null;
  /** The URL currently stored, so a replaced object can be cleaned up. */
  currentAvatarUrl: string | null;
};

export function useSaveProfile() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (edits: ProfileEdits): Promise<void> => {
      const userId = await getUserId();
      if (!userId) throw new Error('Not signed in.');

      // 1. The photograph, if it changed. Before the row write: an upload
      //    that fails must not leave the name saved and the face not.
      let avatarUrl = edits.currentAvatarUrl;
      if (edits.avatar === null) {
        avatarUrl = null;
      } else if (edits.avatar) {
        const prepared = await prepareAvatar(
          edits.avatar.uri,
          edits.avatar.width,
          edits.avatar.height,
        );
        avatarUrl = await uploadAvatar(prepared, userId);
      }

      // 2. The row. Empty fields are stored as NULL, not '': the column means
      //    "she has not written one", and a zero-length string would make
      //    every `?? fallback` in the app render an empty line instead.
      const handle = normaliseHandle(edits.username);
      const { error } = await supabase.from('profiles').upsert(
        {
          user_id: userId,
          display_name: edits.displayName.trim() || null,
          username: handle || null,
          bio: edits.bio.trim() || null,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );

      if (error) {
        // The upload already happened. Nothing points at it, so take it back
        // out rather than leaving a stray face in a public bucket.
        if (edits.avatar && avatarUrl !== edits.currentAvatarUrl) {
          await deleteAvatarObject(avatarUrl, userId).catch(() => {});
        }
        throw error;
      }

      // 3. The object the row no longer points at. Best effort — the profile
      //    is already correct, and a leftover file is invisible to everyone.
      if (avatarUrl !== edits.currentAvatarUrl) {
        await deleteAvatarObject(edits.currentAvatarUrl, userId).catch(() => {});
      }
    },
    onSuccess: () => {
      // Every surface that renders a name, a handle or a face. `closet-identity`
      // is the closet masthead, `profile-header` the account modal's, and
      // `my-profile` the form's own source of truth.
      void qc.invalidateQueries({ queryKey: ['my-profile'] });
      void qc.invalidateQueries({ queryKey: ['closet-identity'] });
      void qc.invalidateQueries({ queryKey: ['profile-header'] });
    },
  });
}
