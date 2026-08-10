import { createClient } from 'npm:@supabase/supabase-js@^2';
import { strToU8, zipSync } from 'npm:fflate@^0.8.2';

import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2';

import type { Database } from '../_shared/database.types.ts';
import { BoundsError, readBoundedJson } from '../_shared/input-bounds.ts';
import { claimItemJob, completeItemJob } from '../_shared/job-claim.ts';
import { redactUrls } from '../_shared/openrouter.ts';

import { ARCHIVE_TTL_SECONDS, assembleArchive } from './assemble.ts';
import { sendExportReadyMail } from './mail.ts';

/**
 * build-export — turns a `data_exports` row into a zip in the `exports` bucket.
 *
 * `request_data_export()` (20260810120000) creates a `pending` row and returns
 * its id. That is all the client can do: the table has no insert policy and no
 * update policy, so the row's journey from `pending` to `ready` happens here,
 * with the service role, or it does not happen at all.
 *
 * ── IT IS CALLED TWICE ON PURPOSE ──────────────────────────────────────────
 *
 * The app invokes it the moment a request is made, because a user watching a
 * spinner should not wait for a cron tick. A sweep invokes it again as a safety
 * net, because an app that is killed mid-invocation would otherwise leave a row
 * pending forever and the person would be told to wait for something nobody is
 * building. Both callers can arrive on the same row at the same second, so
 * every path below is written to be safe to repeat:
 *
 *   - the claim is the `command_log` row from `_shared/job-claim.ts`, whose
 *     primary key makes the second insert lose on a unique violation rather
 *     than on anything this code decides;
 *   - the object path is derived from the export id, and the upload upserts, so
 *     a re-run overwrites its own output rather than accumulating archives;
 *   - the status transition is guarded on `status = 'pending'`, so the second
 *     writer changes nothing.
 *
 * An invocation killed by the platform (timeout, deploy) leaves the row pending
 * and the claim held. The claim is a lease, not a lock — after five minutes the
 * next sweep takes it over and finishes the job. That is the whole reason the
 * lease exists and it is why nothing here needs a transaction across storage
 * and Postgres, which is not a thing that can be had.
 *
 * ── WHY THIS FUNCTION DOES ITS OWN AUTHENTICATION ──────────────────────────
 *
 * Every sibling uses `withSupabase({ auth: 'user' })`, which is right when the
 * caller is always a person. This one has a second caller with no session: the
 * sweep. So the token is verified explicitly — `verify_jwt` still guards the
 * platform edge, and `auth.getUser()` is what turns the token into a user id.
 * The user is taken from that and from nowhere else; `exportId` in the body is
 * only ever used as a filter *alongside* the JWT's user, never instead of it.
 *
 * The sweep presents `x-cinch-export-sweep` matching EXPORT_SWEEP_SECRET, the
 * same shape as send-push's `x-cinch-cron`, and fails closed when unset. It is
 * a second gate rather than the only one because a project's anon key is also a
 * JWT that satisfies `verify_jwt`: without the header, anybody holding the
 * publishable key could start a full sweep.
 *
 * ── FRIENDS' CLOSETS ARE NOT IN HERE ───────────────────────────────────────
 *
 * See the header of assemble.ts. Every query is scoped to one user, and the two
 * places another person appears at all — friend handles in account.json, and
 * occasions the user was invited to in plans.csv — are named there.
 */

/** A sentence a person can read, plus a stable code for whoever is debugging. */
function fail(message: string, code: string, status: number): Response {
  return Response.json({ error: message, code }, { status });
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** How many rows one sweep will take on. Bounded so a backlog cannot outrun the clock. */
const SWEEP_LIMIT = 25;

/** Seven days, as the contract and the app's copy both say. */
const ARCHIVE_TTL_MS = ARCHIVE_TTL_SECONDS * 1000;

/** The private bucket the archives live in. Service role writes; signed URLs redeem. */
const EXPORT_BUCKET = 'exports';

/**
 * What a user is told when assembly did not finish.
 *
 * This lands in `data_exports.error`, which PD-05 prints verbatim, so it is a
 * sentence and not a stack trace. The technical cause goes to the function log
 * with its URLs stripped — the same rule `_shared/openrouter.ts` keeps, and for
 * the same reason: the cause can quote a signed URL to somebody's photograph.
 */
const FAILURE_SENTENCE =
  'We could not finish putting your export together. Nothing in your closet has changed. Please ask for it again and we will try afresh.';

type ExportRow = {
  id: string;
  user_id: string;
  requested_at: string;
  status: string;
  object_path: string | null;
  expires_at: string | null;
  bytes: number | null;
};

type Outcome = {
  id: string;
  status: 'ready' | 'failed' | 'skipped';
  bytes?: number;
  mailed?: boolean;
  reason?: string;
};

export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method !== 'POST') {
      return fail('Method not allowed.', 'method_not_allowed', 405);
    }

    const admin = createClient<Database>(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    ) as SupabaseClient<Database>;

    // `data_exports` postdates the last `gen:types` run, so the typed client
    // does not know the table. Casting the client for those queries keeps the
    // cast in one named place instead of on every call, and it disappears the
    // next time types are generated against a database with the migration on.
    const db = admin as unknown as SupabaseClient;

    // ── 1. Who is calling ───────────────────────────────────────────────────
    const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    let userId: string | null = null;

    if (bearer) {
      const { data } = await admin.auth.getUser(bearer);
      userId = data?.user?.id ?? null;
    }

    let sweeping = false;
    if (!userId) {
      const secret = Deno.env.get('EXPORT_SWEEP_SECRET');
      const presented = req.headers.get('x-cinch-export-sweep') ?? '';
      if (!secret) {
        console.error('EXPORT_SWEEP_SECRET is unset; refusing every sweep.');
        return fail('You need to be signed in to do that.', 'unauthorized', 401);
      }
      if (!constantTimeEqual(presented, secret)) {
        return fail('You need to be signed in to do that.', 'unauthorized', 401);
      }
      sweeping = true;
    }

    // ── 2. What is being asked ──────────────────────────────────────────────
    let action = 'build';
    let exportId: string | null = null;

    try {
      // `functions.invoke` with no body sends none at all, which is the normal
      // "just build whatever of mine is pending" call. Anything that IS sent is
      // parsed strictly and through the shared bound.
      const body = req.body ? ((await readBoundedJson(req)) as Record<string, unknown> | null) : {};
      const raw = body ?? {};

      if (raw.action !== undefined && raw.action !== null) {
        if (raw.action !== 'build' && raw.action !== 'link') {
          throw new BoundsError('action must be "build" or "link".');
        }
        action = raw.action;
      }

      if (raw.exportId !== undefined && raw.exportId !== null) {
        if (typeof raw.exportId !== 'string' || !UUID.test(raw.exportId)) {
          throw new BoundsError('exportId must be a uuid.');
        }
        exportId = raw.exportId;
      }
    } catch (err) {
      if (err instanceof BoundsError) return fail(err.message, 'invalid_request', 400);
      throw err;
    }

    // ── 3. A fresh download link for an export that is already built ────────
    //
    // The `exports` bucket has no policies, so a signed-in client cannot mint
    // its own signed URL — deliberately, because a policy wide enough to let it
    // would be a policy wide enough to walk the bucket. The app holds
    // `object_path` from its own row and asks here for the link.
    if (action === 'link') {
      if (!userId) return fail('You need to be signed in to do that.', 'unauthorized', 401);
      if (!exportId) return fail('Which export? None was named.', 'invalid_request', 400);

      const { data, error } = await db
        .from('data_exports')
        .select('id, user_id, status, object_path, expires_at, bytes')
        .eq('id', exportId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error(`build-export: could not read the export row — ${redactUrls(error.message)}`);
        return fail('We could not look that export up just now.', 'lookup_failed', 500);
      }

      const row = data as ExportRow | null;
      if (!row) return fail('We could not find that export.', 'not_found', 404);
      if (row.status !== 'ready' || !row.object_path) {
        return fail('That export is not ready to download yet.', 'not_ready', 409);
      }

      const remainingMs = row.expires_at ? new Date(row.expires_at).getTime() - Date.now() : 0;
      if (remainingMs <= 0) {
        return fail(
          'That export has expired. Ask for a new one and we will build it again.',
          'expired',
          410,
        );
      }

      const { data: signed, error: signError } = await db.storage
        .from(EXPORT_BUCKET)
        .createSignedUrl(row.object_path, Math.max(60, Math.floor(remainingMs / 1000)));

      if (signError || !signed?.signedUrl) {
        console.error('build-export: could not sign a download link for a ready export.');
        return fail('We could not make a download link just now.', 'sign_failed', 500);
      }

      return Response.json({
        ok: true,
        url: signed.signedUrl,
        expiresAt: row.expires_at,
        bytes: row.bytes,
      });
    }

    // ── 4. Build whatever is pending ────────────────────────────────────────
    let query = db
      .from('data_exports')
      .select('id, user_id, requested_at, status, object_path, expires_at, bytes')
      .eq('status', 'pending')
      .order('requested_at', { ascending: true })
      .limit(SWEEP_LIMIT);

    // Never from the body alone. A caller with a session only ever sees their
    // own rows; `exportId` narrows that set, it does not widen it.
    if (userId) query = query.eq('user_id', userId);
    if (exportId) query = query.eq('id', exportId);

    const { data: pendingRows, error: listError } = await query;

    if (listError) {
      console.error(`build-export: could not list pending rows — ${redactUrls(listError.message)}`);
      return fail('We could not check on your export just now.', 'lookup_failed', 500);
    }

    const rows = (pendingRows ?? []) as ExportRow[];
    const outcomes: Outcome[] = [];

    for (const row of rows) {
      outcomes.push(await buildOne(admin, db, row));
    }

    const counted = (status: Outcome['status']) =>
      outcomes.filter((o) => o.status === status).length;

    console.log(
      `build-export: mode ${sweeping ? 'sweep' : 'user'}, pending ${rows.length}, ` +
        `ready ${counted('ready')}, failed ${counted('failed')}, skipped ${counted('skipped')}`,
    );

    return Response.json({
      ok: true,
      mode: sweeping ? 'sweep' : 'user',
      pending: rows.length,
      ready: counted('ready'),
      failed: counted('failed'),
      skipped: counted('skipped'),
      exports: outcomes,
    });
  },
};

/**
 * One row, start to finish.
 *
 * Never throws: a failure here is recorded on the row as a sentence and the
 * loop moves on, because one person's export falling over is not a reason for
 * the next person's to go unbuilt.
 */
async function buildOne(
  admin: SupabaseClient<Database>,
  db: SupabaseClient,
  row: ExportRow,
): Promise<Outcome> {
  // ── Claim. The unique violation on `command_log.op_id` is what makes two
  //    simultaneous invocations pick one winner. ──────────────────────────────
  let claim;
  try {
    claim = await claimItemJob(admin, row.id, row.user_id, 'data_export');
  } catch (err) {
    console.error(
      `build-export: could not claim ${row.id} — ${redactUrls(err instanceof Error ? err.message : 'unknown')}`,
    );
    return { id: row.id, status: 'skipped', reason: 'claim_failed' };
  }

  if (!claim.claimed) return { id: row.id, status: 'skipped', reason: claim.reason };

  try {
    // Re-read under the claim. The row we listed may have been finished by the
    // invocation that raced us and released between our list and our claim.
    const { data: fresh, error: freshError } = await db
      .from('data_exports')
      .select('id, user_id, requested_at, status, object_path, expires_at, bytes')
      .eq('id', row.id)
      .maybeSingle();

    if (freshError) throw new Error(`data_exports: ${freshError.message}`);
    const current = fresh as ExportRow | null;

    if (!current || current.status !== 'pending') {
      await completeItemJob(admin, row.id);
      return { id: row.id, status: 'skipped', reason: 'already_settled' };
    }

    const expiresAt = new Date(Date.now() + ARCHIVE_TTL_MS).toISOString();
    const objectPath = `${current.user_id}/${current.id}.zip`;

    // ── Assemble ──────────────────────────────────────────────────────────
    const { files, summary } = await assembleArchive(
      db,
      current.user_id,
      current.id,
      current.requested_at,
      expiresAt,
    );

    const zipped = zipSync(
      Object.fromEntries(Object.entries(files).map(([name, text]) => [name, strToU8(text)])),
      { level: 6 },
    );

    // ── Store. `upsert` because a re-run must overwrite its own output. ────
    const archive = new Blob([zipped], { type: 'application/zip' });
    const bytes = archive.size;

    const { error: uploadError } = await db.storage
      .from(EXPORT_BUCKET)
      .upload(objectPath, archive, { contentType: 'application/zip', upsert: true });

    if (uploadError) throw new Error(`storage: ${uploadError.message}`);

    // ── Mark ready. Guarded on `pending`, so the loser of a race writes
    //    nothing and the row keeps the winner's numbers. `bytes` is measured
    //    off the object that was actually stored, never estimated. ──────────
    const { error: updateError } = await db
      .from('data_exports')
      .update({
        status: 'ready',
        ready_at: new Date().toISOString(),
        bytes,
        object_path: objectPath,
        expires_at: expiresAt,
        error: null,
      })
      .eq('id', current.id)
      .eq('status', 'pending');

    if (updateError) throw new Error(`data_exports: ${updateError.message}`);

    await completeItemJob(admin, row.id);

    // ── Mail, which must not be able to un-ready a ready export. ───────────
    let mailed = false;
    try {
      const { data: signed } = await db.storage
        .from(EXPORT_BUCKET)
        .createSignedUrl(objectPath, ARCHIVE_TTL_SECONDS);
      const { data: authUser } = await admin.auth.admin.getUserById(current.user_id);

      if (signed?.signedUrl) {
        const outcome = await sendExportReadyMail({
          to: authUser?.user?.email ?? null,
          downloadUrl: signed.signedUrl,
          expiresAt,
          bytes,
          pieces: summary.photos,
        });
        mailed = outcome.sent;
      }
    } catch (err) {
      console.error(
        `build-export: the ready email for ${row.id} did not go out — ${
          redactUrls(err instanceof Error ? err.message : 'unknown')
        }`,
      );
    }

    console.log(
      `build-export: ${row.id} ready — ${bytes} bytes, ${summary.items} pieces, ` +
        `${summary.wears} wears, ${summary.plans} plans, ${summary.photos} photo links, ` +
        `mail ${mailed ? 'sent' : 'not sent'}`,
    );

    return { id: row.id, status: 'ready', bytes, mailed };
  } catch (err) {
    // The cause is logged with URLs stripped; the row gets a sentence.
    console.error(
      `build-export: ${row.id} failed — ${
        redactUrls(err instanceof Error ? err.message : 'unknown error')
      }`,
    );

    const { error: markError } = await db
      .from('data_exports')
      .update({ status: 'failed', error: FAILURE_SENTENCE })
      .eq('id', row.id)
      .eq('status', 'pending');

    if (markError) {
      console.error(`build-export: could not even mark ${row.id} failed.`);
    }

    // The claim is completed rather than released. `failed` is terminal in this
    // table — there is no transition back to `pending` — so releasing would
    // only invite every future sweep to re-claim a row it can no longer change.
    await completeItemJob(admin, row.id);

    return { id: row.id, status: 'failed', reason: 'assembly_failed' };
  }
}
