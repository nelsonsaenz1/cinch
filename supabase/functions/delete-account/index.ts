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
 * Everything else is handled by `on delete cascade` on the auth.users FK, which
 * every table in the schema carries. That is deliberate: enumerating tables here
 * means a table added later is silently missed, and "we forgot to delete one
 * table" is a data-protection incident rather than a bug.
 */

const BUCKET = 'garments';
/** Supabase Storage caps `list` at 100 by default; ask for the maximum. */
const PAGE = 1000;

/** Every object under a prefix, recursing into per-item folders. */
async function listAllPaths(
  storage: SupabaseClient<Database>['storage'],
  prefix: string,
): Promise<string[]> {
  const out: string[] = [];
  const queue = [prefix];

  while (queue.length) {
    const dir = queue.shift()!;
    let offset = 0;

    for (;;) {
      const { data, error } = await storage
        .from(BUCKET)
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
      const userId = (ctx.userClaims as { sub?: string } | undefined)?.sub;

      if (!userId) return Response.json({ error: 'Not signed in.' }, { status: 401 });

      // ── 1. Storage ────────────────────────────────────────────────────────
      let removed = 0;
      try {
        const paths = await listAllPaths(admin.storage, userId);
        // Remove in chunks; a large closet can exceed what one call accepts.
        for (let i = 0; i < paths.length; i += 100) {
          const chunk = paths.slice(i, i + 100);
          const { error } = await admin.storage.from(BUCKET).remove(chunk);
          if (error) throw error;
          removed += chunk.length;
        }
      } catch (err) {
        // Deliberately fatal. Reporting success while the user's photographs
        // are still sitting in the bucket would be a false claim about their
        // data, and they would have no way to discover it or try again.
        return Response.json(
          {
            error: 'Could not delete your photos. Nothing has been removed — please try again.',
            detail: err instanceof Error ? err.message : String(err),
          },
          { status: 500 },
        );
      }

      // ── 2. The auth user. Cascades to every table. ────────────────────────
      const { error: deleteError } = await admin.auth.admin.deleteUser(userId);

      if (deleteError) {
        return Response.json(
          { error: 'Could not delete your account.', detail: deleteError.message },
          { status: 500 },
        );
      }

      return Response.json({ ok: true, objectsRemoved: removed });
    },
  ),
};
