import { createClient } from 'npm:@supabase/supabase-js@^2';

import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2';

import type { Database } from '../_shared/database.types.ts';
import { BoundsError, readBoundedJson } from '../_shared/input-bounds.ts';
import { sendExpoPush, type PushEnvelope } from '../_shared/push.ts';

import { CLAIM_FUNCTION, isPushChannel, type PushChannel } from './channels.ts';
import {
  borrowPayload,
  eventReminderPayload,
  friendActivityPayload,
  morningEditPayload,
  votesCommentsPayload,
  type Payload,
} from './copy.ts';

/**
 * send-push — the half of atlas 37 that makes its descriptions true.
 *
 * `pg_cron` posts here once per channel per tick (20260810110200). Each call
 * does four things and nothing else:
 *
 *   1. asks the channel's claim function who is owed a message, which BOOKS
 *      those messages in `push_sends` in the same statement;
 *   2. looks up the devices for whoever was claimed;
 *   3. composes a payload per claim and hands the lot to Expo;
 *   4. tidies up — dead tokens deleted, claims that were never attempted
 *      released.
 *
 * All the judgement lives in the SQL and in `copy.ts`. This file is plumbing,
 * and it is written to be boring on purpose: it is the piece that will be read
 * at seven in the morning by somebody who has just been asked why a person got
 * two notifications.
 *
 * ── AUTHENTICATION ─────────────────────────────────────────────────────────
 *
 * Like `superwall-webhook`, and for the same reason: the caller is not a person
 * and has no Supabase session. It is `pg_net`, carrying a shared secret out of
 * Vault in `x-cinch-cron`. `verify_jwt` is therefore off for this function
 * (supabase/config.toml) and the header is the whole gate — which is why an
 * unset `PUSH_CRON_SECRET` refuses every request rather than degrading into
 * "accept anything". An open endpoint here would not leak anybody's data, but
 * it would let a stranger burn the morning edit at three in the afternoon: the
 * ledger would record the send as made and the real one would never arrive.
 *
 * ── NO CREDENTIAL IS HANDLED HERE ──────────────────────────────────────────
 *
 * The APNs `.p8` lives in Expo's dashboard, uploaded by the founder. This
 * function holds a public device handle and posts it to `exp.host`. The two
 * secrets it does read — the service-role key and the cron secret — come from
 * the environment the platform injects, exactly as the sibling functions read
 * theirs, and neither is logged.
 *
 * ── WHAT CANNOT BE TESTED YET ──────────────────────────────────────────────
 *
 * Nothing below has ever delivered a notification, because nothing can until a
 * store build exists: `expo-notifications` is not in the binary, the
 * `aps-environment` entitlement is not on the app, and `push_tokens` is
 * therefore empty. Every claim function will return zero rows and this endpoint
 * will answer `{ ok: true, claimed: 0 }` for as long as that is true. Contract
 * §6.4: arrival is not verifiable without a device, and anything said about it
 * before then is a claim, not a verification.
 */

/** A stable code and a sentence a person can read. Never provider text. */
function fail(code: string, message: string, status: number): Response {
  return Response.json({ error: code, message }, { status });
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * The generated database types predate migrations 20260810110000-110200, so
 * `rpc()` does not know these function names yet. Casting the call rather than
 * the client keeps every other query on this page fully typed; the row shapes
 * below are asserted at the point of use and the cast disappears the next time
 * `npm run gen:types` is run against a database with the migrations applied.
 */
type RpcResult<T> = { data: T | null; error: { message: string } | null };
type UntypedRpc = (fn: string, args?: Record<string, unknown>) => PromiseLike<RpcResult<unknown>>;

type MorningEditClaim = { user_id: string; dedupe_key: string };
type FriendActivityClaim = MorningEditClaim & {
  follow_backs: number;
  new_pieces: number;
  lead_name: string | null;
  people: number;
};
type BorrowClaim = MorningEditClaim & {
  kind: string;
  actor_name: string | null;
  item_label: string | null;
};
type EventReminderClaim = MorningEditClaim & { event_title: string | null };
type VotesClaim = MorningEditClaim & { votes: number; comments: number };

type AnyClaim = MorningEditClaim & Record<string, unknown>;

/**
 * One claim becomes one sentence.
 *
 * The dedupe key is doing double duty for two channels, and that is not an
 * accident of implementation — it is the only identifier the ledger has. Event
 * reminders key on the event id, so the key IS the event; votes key on
 * `<post>:<hour>`, so the key's first segment is the look. Anything the payload
 * needs to name, the key already carries.
 */
function compose(channel: PushChannel, claim: AnyClaim): Payload {
  switch (channel) {
    case 'morning_edit':
      return morningEditPayload();

    case 'friend_activity': {
      const c = claim as FriendActivityClaim;
      return friendActivityPayload({
        followBacks: c.follow_backs ?? 0,
        newPieces: c.new_pieces ?? 0,
        leadName: c.lead_name,
      });
    }

    case 'borrow_requests': {
      const c = claim as BorrowClaim;
      return borrowPayload({
        kind: c.kind,
        actorName: c.actor_name,
        itemLabel: c.item_label,
      });
    }

    case 'event_reminders': {
      const c = claim as EventReminderClaim;
      return eventReminderPayload({ eventTitle: c.event_title, eventId: c.dedupe_key });
    }

    case 'votes_comments': {
      const c = claim as VotesClaim;
      return votesCommentsPayload({
        votes: c.votes ?? 0,
        comments: c.comments ?? 0,
        postId: c.dedupe_key.split(':')[0] ?? '',
      });
    }
  }
}

export default {
  async fetch(req: Request): Promise<Response> {
    if (req.method !== 'POST') {
      return fail('method_not_allowed', 'Method not allowed.', 405);
    }

    const cronSecret = Deno.env.get('PUSH_CRON_SECRET');
    if (!cronSecret) {
      console.error('PUSH_CRON_SECRET is unset; refusing every sweep.');
      return fail('not_configured', 'Push sending is not configured.', 500);
    }

    const presented = req.headers.get('x-cinch-cron') ?? '';
    if (!constantTimeEqual(presented, cronSecret)) {
      console.warn('Rejected a send-push sweep: bad or missing x-cinch-cron.');
      return fail('unauthorized', 'Not authorised.', 401);
    }

    let channel: PushChannel;
    try {
      const body = await readBoundedJson(req);
      const raw = (body as { channel?: unknown } | null)?.channel;
      if (!isPushChannel(raw)) {
        throw new BoundsError('channel must be one of the five push channels.');
      }
      channel = raw;
    } catch (err) {
      if (err instanceof BoundsError) return fail('invalid_request', err.message, 400);
      throw err;
    }

    const admin = createClient<Database>(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    ) as SupabaseClient<Database>;

    const rpc = admin.rpc as unknown as UntypedRpc;

    // ── 1. Claim. The insert inside this function IS the send decision. ────
    const claimed = await rpc(CLAIM_FUNCTION[channel]);
    if (claimed.error) {
      // 500 so the failure is visible in the function logs. Nothing was
      // claimed, so nothing needs releasing and the next tick simply retries.
      console.error(`${channel}: claim failed — ${claimed.error.message}`);
      return fail('claim_failed', 'Could not work out who was due.', 500);
    }

    const claims = (claimed.data ?? []) as AnyClaim[];
    if (!claims.length) return Response.json({ ok: true, channel, claimed: 0, sent: 0 });

    // ── 2. Devices. One person, possibly several. ─────────────────────────
    const userIds = [...new Set(claims.map((c) => c.user_id))];
    const { data: tokens, error: tokenError } = await admin
      .from('push_tokens')
      .select('user_id, token')
      .in('user_id', userIds);

    if (tokenError) {
      // The claims are booked and cannot be honoured, so give every one of
      // them back. Leaving them would silently cost each reader the message.
      console.error(`${channel}: could not read tokens — ${tokenError.message}`);
      await releaseClaims(rpc, channel, claims);
      return fail('tokens_unavailable', 'Could not read the devices.', 500);
    }

    const byUser = new Map<string, string[]>();
    for (const row of tokens ?? []) {
      const list = byUser.get(row.user_id) ?? [];
      list.push(row.token);
      byUser.set(row.user_id, list);
    }

    // ── 3. Compose, one envelope per claim per device. ────────────────────
    const envelopes: PushEnvelope[] = [];
    const deviceless: AnyClaim[] = [];

    for (const claim of claims) {
      const devices = byUser.get(claim.user_id) ?? [];
      if (!devices.length) {
        // The claim function required at least one token, so this is the
        // narrow race where the last device was deleted in between. Nothing
        // was attempted, so the booking goes back.
        deviceless.push(claim);
        continue;
      }
      const payload = compose(channel, claim);
      for (const token of devices) {
        envelopes.push({
          to: token,
          title: payload.title,
          body: payload.body,
          data: payload.data,
          userId: claim.user_id,
          dedupeKey: claim.dedupe_key,
        });
      }
    }

    if (deviceless.length) await releaseClaims(rpc, channel, deviceless);

    // ── 4. Send, then tidy. ───────────────────────────────────────────────
    //
    // Everything due goes out in this one invocation, chunked a hundred at a
    // time. That is the right shape now and will not be forever: at some
    // thousands of devices a sweep would outrun the platform's wall clock, and
    // the failure mode is worth naming because it is silent — the claims are
    // already booked, a killed invocation releases nothing, and those readers
    // simply do not hear from us that hour. The fix when it comes is a bounded
    // claim plus more frequent ticks, not a longer timeout.
    const outcome = await sendExpoPush(envelopes);

    if (outcome.unregistered.length) {
      const dead = [...new Set(outcome.unregistered)];
      const { error } = await admin.from('push_tokens').delete().in('token', dead);
      if (error) console.error(`${channel}: could not delete dead tokens — ${error.message}`);
    }

    if (outcome.unattempted.length) {
      await releaseClaims(rpc, channel, outcome.unattempted);
    }

    // One line per sweep, countable. No tokens, no names, no bodies — a log is
    // not a place to put what a notification said.
    console.log(
      `${channel}: claimed ${claims.length}, messages ${envelopes.length}, ` +
        `accepted ${outcome.accepted}, refused ${outcome.refused}, ` +
        `unregistered ${outcome.unregistered.length}, released ${
          outcome.unattempted.length + deviceless.length
        }`,
    );
    for (const reason of [...new Set(outcome.errors)]) {
      console.warn(`${channel}: Expo said ${reason}`);
    }

    return Response.json({
      ok: true,
      channel,
      claimed: claims.length,
      sent: outcome.accepted,
      refused: outcome.refused,
      unregistered: outcome.unregistered.length,
      released: outcome.unattempted.length + deviceless.length,
    });
  },
};

/**
 * Give back bookings for messages that were never attempted.
 *
 * Never called for a message Expo took and then failed to place. The trade is
 * written out on `push_release_claims` in 20260810110100: this channel would
 * rather very occasionally lose a notification than occasionally send two.
 */
async function releaseClaims(
  rpc: UntypedRpc,
  channel: PushChannel,
  claims: { user_id?: string; userId?: string; dedupe_key?: string; dedupeKey?: string }[],
): Promise<void> {
  const userIds = claims.map((c) => c.user_id ?? c.userId ?? '');
  const keys = claims.map((c) => c.dedupe_key ?? c.dedupeKey ?? '');
  if (!userIds.length) return;

  const { error } = await rpc('push_release_claims', {
    p_channel: channel,
    p_user_ids: userIds,
    p_keys: keys,
  });

  // Logged, not thrown. A booking that could not be released costs one missed
  // notification; failing the whole sweep over it would cost the rest of them.
  if (error) console.error(`${channel}: could not release claims — ${error.message}`);
}
