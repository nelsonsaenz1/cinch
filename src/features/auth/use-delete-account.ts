import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

/**
 * Permanent account deletion — App Store Guideline 5.1.1(v).
 *
 * The destructive work happens in the `delete-account` Edge Function, which
 * needs admin privileges to remove the auth user. The client's job is to ask
 * clearly, then clear every trace of the old session locally so the app cannot
 * come back up holding a cache belonging to an account that no longer exists.
 */
export function useDeleteAccount() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('delete-account', {
        method: 'POST',
      });

      if (error) {
        // `functions.invoke` throws a bare "non-2xx status code" for any
        // failure and hangs the real response off `context`. The function
        // answers a part-way failure with `detail`, `failedBucket`,
        // `objectsRemoved` and `resumable` — the facts a person deleting
        // their account needs, and the ones the screen used to discard.
        throw new Error(await describeDeleteFailure(error));
      }
      if (data?.error) throw new Error(describeDeleteBody(data));
      return data as { ok: boolean; objectsRemoved: number };
    },

    onSuccess: async () => {
      // The user row is gone, so the refresh token is already void — signOut
      // here is about clearing local storage, and it must not be allowed to
      // fail loudly and strand the user inside a dead session.
      await supabase.auth.signOut().catch(() => undefined);

      // Remove rather than invalidate. Invalidating would refetch against a
      // deleted account; removing guarantees no stale closet survives into the
      // next sign-in on this device.
      qc.removeQueries();
    },
  });
}

type DeleteFailureBody = {
  error?: string;
  detail?: string;
  failedBucket?: string;
  objectsRemoved?: number;
  resumable?: boolean;
};

/** The function's structured failure, as one sentence a person can act on. */
function describeDeleteBody(body: DeleteFailureBody | null | undefined): string {
  if (!body) return 'Deletion could not be completed.';
  const removed =
    typeof body.objectsRemoved === 'number' && body.objectsRemoved > 0
      ? ` ${body.objectsRemoved} of your files were already removed.`
      : '';
  const where = body.failedBucket ? ` (stopped at ${body.failedBucket})` : '';
  switch (body.detail) {
    case 'delete_failed':
      return `Some of your files could not be removed${where}.${removed}`;
    case 'mark_failed':
      return `Your account could not be marked for deletion.${removed}`;
    default:
      return `Deletion stopped part-way${where}.${removed}`;
  }
}

async function describeDeleteFailure(error: unknown): Promise<string> {
  const response = (error as { context?: unknown })?.context;
  if (response instanceof Response) {
    try {
      return describeDeleteBody((await response.clone().json()) as DeleteFailureBody);
    } catch {
      // Not JSON — fall through to the generic sentence.
    }
  }
  return 'Deletion could not be completed — Cinch could not reach the server.';
}
