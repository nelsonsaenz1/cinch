import { createClient } from 'npm:@supabase/supabase-js@^2';

import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2';

import type { Database } from '../_shared/database.types.ts';

/**
 * reap-intake-audio — the 24-hour deletion promise, kept from the right side
 * of the storage API.
 *
 * `transcribe-intake` deletes each recording the moment a transcript exists;
 * this is the backstop for the objects that path never reached — an abandoned
 * walkthrough, a crash between upload and transcription. It used to be a
 * plain SQL delete inside `public.reap_intake_audio()`, and that is exactly
 * what broke: the platform's `storage.protect_delete()` trigger now refuses
 * direct deletes from `storage.objects`, so the cron failed silently on every
 * tick from 2026-08-10 onward while the recordings it existed to remove sat in
 * the bucket. Deletion has to go through the storage API, and the storage API
 * lives in an edge function — hence this one.
 *
 * READING is still SQL's job. `public.stale_intake_audio()` (security definer,
 * cron-only grants) answers "which paths are older than 24 hours" in one
 * indexed query; walking the bucket with `list()` per user folder would spend
 * a request per person who ever recorded to learn the same thing. SQL finds,
 * the API deletes — each side doing the half it is allowed to do.
 *
 * Invoked by cron, never by a person, in the same shape as `sync-feeds`:
 * shared secret in `x-cinch-intake-reap`, fail closed when unset,
 * `verify_jwt = false` because there is no user in this path at all.
 */

/** More than any real hour will produce; enough to drain a two-week backlog in
 *  one tick if it ever comes to that again. */
const MAX_REMOVALS_PER_RUN = 200;

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method !== 'POST') {
      return Response.json({ error: 'method_not_allowed' }, { status: 405 });
    }

    const secret = Deno.env.get('INTAKE_REAP_SECRET');
    if (!secret) {
      console.error('reap-intake-audio: INTAKE_REAP_SECRET is not set — refusing to run');
      return Response.json({ error: 'not_configured' }, { status: 500 });
    }
    if (!constantTimeEqual(req.headers.get('x-cinch-intake-reap') ?? '', secret)) {
      return Response.json({ error: 'forbidden' }, { status: 403 });
    }

    const admin = createClient<Database>(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    ) as SupabaseClient<Database>;

    // `stale_intake_audio` postdates the last `gen:types` run, so the typed
    // client does not know the RPC. The cast disappears the next time types
    // are generated against a database with the migration on.
    const db = admin as unknown as SupabaseClient;
    const { data: stale, error: staleError } = await db.rpc('stale_intake_audio');
    if (staleError) {
      console.error(`reap-intake-audio: stale_intake_audio failed: ${staleError.message}`);
      return Response.json({ error: 'lookup_failed' }, { status: 500 });
    }

    const paths = ((stale ?? []) as string[]).slice(0, MAX_REMOVALS_PER_RUN);
    if (paths.length === 0) {
      return Response.json({ removed: 0 });
    }

    const { data: removed, error: removeError } = await admin.storage
      .from('intake-audio')
      .remove(paths);
    if (removeError) {
      // The objects survive to the next tick — an hour of extra life is the
      // failure mode this job is allowed to have, silence is not.
      console.error(`reap-intake-audio: remove failed: ${removeError.message}`);
      return Response.json({ error: 'remove_failed' }, { status: 500 });
    }

    console.log(`reap-intake-audio: removed ${removed?.length ?? 0} of ${paths.length} stale objects`);
    return Response.json({ removed: removed?.length ?? 0 });
  },
};
