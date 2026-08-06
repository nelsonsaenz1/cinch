import { withSupabase } from 'npm:@supabase/server@^1';

import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2';

import type { Database } from '../_shared/database.types.ts';

/**
 * delete-account — permanent, immediate, in-app account deletion.
 *
 * App Store Guideline 5.1.1(v): an app that lets you create an account must let
 * you delete it from inside the app. A support email, a web form, or a "we will
 * process this within 30 days" message do not satisfy it. This is one of the
 * most common rejections for apps with sign-in, and it is entirely avoidable.
 *
 * Order is load-bearing. Storage is cleared BEFORE the auth user, because every
 * table cascades from `auth.users` — delete the user first and the rows naming
 * the objects are gone, leaving orphaned photographs of someone's clothes in a
 * bucket with no record that they exist. The path prefix would still be
 * derivable, but nothing would ever walk it again.
 *
 * BOTH buckets, not just `garments`. `avatars` (20260807110000) is PUBLIC and
 * keyed `{user_id}/{ms}.jpg`, so an avatar left behind is not merely an orphan
 * — it is a photograph of the user's face still served from a URL that needs no
 * authentication, belonging to an account that no longer exists. The client
 * deletes the object it replaces (features/profile/avatar.ts), but that is a
 * best-effort path that leaves spares behind by design, and it never runs at
 * all when the account itself goes. This function is the only thing that walks
 * the folder, so it has to walk both.
 *
 * Everything else is handled by `on delete cascade` on the auth.users FK, which
 * every table in the schema carries. That is deliberate: enumerating tables here
 * means a table added later is silently missed, and "we forgot to delete one
 * table" is a data-protection incident rather than a bug.
 *
 * ── Why this is resumable rather than transactional ────────────────────────
 *
 * Storage and auth are two systems and no transaction spans them, so a failure
 * between them is not preventable — only survivable. The previous version tried
 * to present the operation as all-or-nothing and had to lie to do it: a storage
 * chunk failing part-way returned "Nothing has been removed", which stopped
 * being true the instant the first chunk succeeded.
 *
 * So: mark the profile as mid-deletion first, then do the destructive work in
 * an order where every step is safe to repeat, and report exactly what happened.
 * Deleting an object that is already gone is a no-op, and the listing pass only
 * sees what still exists — so a retry finishes the job rather than restarting
 * it, and the response never claims a rollback that did not occur.
 */

/**
 * Every bucket this user owns objects in, in the order they are cleared.
 *
 * `garments` first because it is the large one and the one the warning copy
 * names; a partial run that stops after it has still removed the bulk of what
 * the user asked to be rid of. The order is otherwise arbitrary — each bucket
 * is cleared independently and each is safe to repeat.
 */
const BUCKETS = ['garments', 'avatars'] as const;

type Bucket = (typeof BUCKETS)[number];

/** Supabase Storage caps `list` at 100 by default; ask for the maximum. */
const PAGE = 1000;
/** `remove` takes a batch; a large closet exceeds what one call accepts. */
const REMOVE_CHUNK = 100;

/**
 * Every object under a prefix, recursing into per-item folders.
 *
 * The recursion is what `garments` needs — its objects are keyed
 * {user}/{item}/{file}. `avatars` is flat ({user}/{ms}.jpg), so the walk
 * terminates after one level there; the same function serves both rather than
 * two that drift.
 */
async function listAllPaths(
  storage: SupabaseClient<Database>['storage'],
  bucket: Bucket,
  prefix: string,
): Promise<string[]> {
  const out: string[] = [];
  const queue = [prefix];

  while (queue.length) {
    const dir = queue.shift()!;
    let offset = 0;

    for (;;) {
      const { data, error } = await storage
        .from(bucket)
        .list(dir, { limit: PAGE, offset });

      if (error) throw error;
      if (!data?.length) break;

      for (const entry of data) {
        const full = `${dir}/${entry.name}`;
        // Storage has no real directories. An entry with no `id` is a synthetic
        // folder produced by the path prefix, so it has to be walked rather
        // than deleted.
        if (entry.id === null) queue.push(full);
        else out.push(full);
      }

      if (data.length < PAGE) break;
      offset += PAGE;
    }
  }

  return out;
}

export default {
  fetch: withSupabase(
    { auth: 'user' },
    async (req: Request, ctx): Promise<Response> => {
      if (req.method !== 'POST') {
        return Response.json({ error: 'Method not allowed.' }, { status: 405 });
      }

      const admin = ctx.supabaseAdmin as unknown as SupabaseClient<Database>;
      // `UserClaims` is the normalized view: the JWT's `sub` is exposed as `id`.
      // There is no `.sub` on it — reading one yields `undefined` and 401s every
      // authenticated caller. Keep this untyped-cast-free so the compiler checks it.
      const userId = ctx.userClaims?.id;

      if (!userId) return Response.json({ error: 'Not signed in.' }, { status: 401 });

      // ── 1. Declare the intent, before anything is destroyed ───────────────
      //
      // This is the only point in the function where "nothing has been deleted"
      // is a true sentence, so it is the only place that says it. A retry keeps
      // the original timestamp: the column records when the user asked, and
      // overwriting it would erase how long an interrupted deletion has been
      // outstanding.
      const { data: existing, error: readError } = await admin
        .from('profiles')
        .select('deletion_requested_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (readError) {
        return Response.json(
          {
            error: 'Could not start deleting your account. Nothing has been deleted — please try again.',
          },
          { status: 500 },
        );
      }

      if (!existing?.deletion_requested_at) {
        const { error: markError } = await admin
          .from('profiles')
          .update({ deletion_requested_at: new Date().toISOString() })
          .eq('user_id', userId);

        if (markError) {
          return Response.json(
            {
              error: 'Could not start deleting your account. Nothing has been deleted — please try again.',
              detail: 'mark_failed',
            },
            { status: 500 },
          );
        }
      }

      const resumed = Boolean(existing?.deletion_requested_at);

      // ── 2. Storage, bucket by bucket. Idempotent: the listing only returns
      //       what still exists, so a retry picks up where the last attempt
      //       stopped — within a bucket and across them. ───────────────────
      //
      // `removed` stays a single running total across both buckets because it
      // is what the response has always meant ("objects gone") and what the
      // warning copy promises ("every photo you uploaded" — a face is a photo
      // the user uploaded too). `removedByBucket` is additive detail for
      // whoever is reading a failed run; nothing client-side depends on it.
      let removed = 0;
      const removedByBucket: Record<Bucket, number> = { garments: 0, avatars: 0 };

      for (const bucket of BUCKETS) {
        try {
          const paths = await listAllPaths(admin.storage, bucket, userId);
          for (let i = 0; i < paths.length; i += REMOVE_CHUNK) {
            const chunk = paths.slice(i, i + REMOVE_CHUNK);
            const { error } = await admin.storage.from(bucket).remove(chunk);
            if (error) throw error;
            removed += chunk.length;
            removedByBucket[bucket] += chunk.length;
          }
        } catch (err) {
          // No rollback claim. Objects removed before this point are gone and
          // cannot come back, and saying otherwise would leave the user believing
          // their photographs still exist. What is recoverable is the operation:
          // the account is still there and running this again resumes it.
          //
          // The same sentence covers a failure in either bucket, and it is true
          // in both: an avatar is one of the photographs being deleted. Naming
          // the bucket in prose would mean explaining Storage layout to someone
          // who is trying to leave, so it goes in `failedBucket` and the log
          // line instead — where the person debugging it will look.
          console.error(
            `delete-account: clearing bucket "${bucket}" failed after ${removed} object(s)`,
            err,
          );
          return Response.json(
            {
              error:
                'Deleting your photos stopped part-way. Some have already been permanently deleted and your account still exists. Please try again — deletion continues from where it stopped.',
              detail: 'delete_failed',
              failedBucket: bucket,
              objectsRemoved: removed,
              removedByBucket,
              accountDeleted: false,
              resumable: true,
              resumed,
            },
            { status: 500 },
          );
        }
      }

      // ── 3. The auth user. Cascades to every table. ────────────────────────
      const { error: deleteError } = await admin.auth.admin.deleteUser(userId);

      if (deleteError) {
        // The photographs are gone and the account is not. Stating both is the
        // whole point: this is the case the old code was silent about, and a
        // user told only "could not delete your account" would reasonably
        // assume their wardrobe survived.
        return Response.json(
          {
            error:
              'Your photos have been permanently deleted, but your account could not be removed. Please try again — this will finish the deletion.',
            objectsRemoved: removed,
            removedByBucket,
            accountDeleted: false,
            resumable: true,
            resumed,
          },
          { status: 500 },
        );
      }

      // The profile row, including the marker set above, went with the cascade.
      return Response.json({
        ok: true,
        objectsRemoved: removed,
        removedByBucket,
        accountDeleted: true,
        resumed,
      });
    },
  ),
};
