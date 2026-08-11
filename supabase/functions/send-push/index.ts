import { createClient } from 'npm:@supabase/supabase-js@^2';

import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2';

import type { Database } from '../_shared/database.types.ts';
import { BoundsError, readBoundedJson } from '../_shared/input-bounds.ts';
import { fetchExpoReceipts, sendExpoPush, type PushEnvelope } from '../_shared/push.ts';

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

    // Two shapes, told apart by the body. `{"channel": …}` is a send sweep;
    // `{"mode":"receipts"}` is the collector added by audit item 25. The
    // receipts pass is NOT a sixth channel on purpose: `push_sends.channel` has
    // a CHECK constraint that three separate lists are pinned to, and a pseudo
    // channel that can never have a ledger row would break that pin for the
    // sake of one dispatch.
    let channel: PushChannel | null = null;
    let receiptsMode = false;
    try {
      const body = (await readBoundedJson(req)) as {
        channel?: unknown;
        mode?: unknown;
      } | null;

      if (body?.mode === 'receipts') {
        receiptsMode = true;
      } else if (isPushChannel(body?.channel)) {
        channel = body.channel;
      } else {
        throw new BoundsError(
          'Send one of the five push channels, or mode "receipts".',
        );
      }
    } catch (err) {
      if (err instanceof BoundsError) return fail('invalid_request', err.message, 400);
      throw err;
    }

    const admin = createClient<Database>(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    ) as SupabaseClient<Database>;

    if (receiptsMode) return await collectReceipts(admin);
    // Narrowed by the parse above: exactly one of the two branches was taken.
    const sendChannel: PushChannel = channel!;

    // `.bind(admin)` is load-bearing, and its absence cost a live debugging
    // session. `admin.rpc` is a METHOD: lifted off the client it loses `this`,
    // and supabase-js dereferences `this.url` on the first line — so the call
    // throws a TypeError before it ever reaches Postgres. The throw escapes the
    // handler, so the platform answers a bare 500 "Internal Server Error"
    // rather than this function's own JSON, which is exactly the shape that
    // makes it look like a boot failure or a bad secret instead of a one-word
    // bug. The claim functions were fine the whole time.
    const rpc = admin.rpc.bind(admin) as unknown as UntypedRpc;

    // ── 1. Claim. The insert inside this function IS the send decision. ────
    const claimed = await rpc(CLAIM_FUNCTION[sendChannel]);
    if (claimed.error) {
      // 500 so the failure is visible in the function logs. Nothing was
      // claimed, so nothing needs releasing and the next tick simply retries.
      console.error(`${sendChannel}: claim failed — ${claimed.error.message}`);
      return fail('claim_failed', 'Could not work out who was due.', 500);
    }

    const claims = (claimed.data ?? []) as AnyClaim[];
    if (!claims.length) return Response.json({ ok: true, channel: sendChannel, claimed: 0, sent: 0 });

    // ── 2. Devices. One person, possibly several. ─────────────────────────
    const userIds = [...new Set(claims.map((c) => c.user_id))];
    const { data: tokens, error: tokenError } = await admin
      .from('push_tokens')
      .select('user_id, token')
      .in('user_id', userIds);

    if (tokenError) {
      // The claims are booked and cannot be honoured, so give every one of
      // them back. Leaving them would silently cost each reader the message.
      console.error(`${sendChannel}: could not read tokens — ${tokenError.message}`);
      await releaseClaims(rpc, sendChannel, claims);
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
      const payload = compose(sendChannel, claim);
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

    if (deviceless.length) await releaseClaims(rpc, sendChannel, deviceless);

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
      if (error) console.error(`${sendChannel}: could not delete dead tokens — ${error.message}`);
    }

    if (outcome.unattempted.length) {
      await releaseClaims(rpc, sendChannel, outcome.unattempted);
    }

    // Park the accepted tickets for the receipts pass (audit 25). `accepted` is
    // still not a delivery — this is the row that will eventually say whether it
    // was. `upsert` rather than `insert` because a ticket id is Expo's and this
    // must not fail a whole sweep on the day Expo repeats one.
    if (outcome.tickets.length) {
      const { error } = await admin.from('push_receipts').upsert(
        outcome.tickets.map((t) => ({
          ticket_id: t.id,
          token: t.token,
          channel: sendChannel,
        })),
        { onConflict: 'ticket_id' },
      );
      // Logged, not thrown. Losing the follow-up costs a dead token living
      // longer; failing here would cost the messages that were just sent.
      if (error) console.error(`${sendChannel}: could not park tickets — ${error.message}`);
    }

    // One line per sweep, countable. No tokens, no names, no bodies — a log is
    // not a place to put what a notification said.
    console.log(
      `${sendChannel}: claimed ${claims.length}, messages ${envelopes.length}, ` +
        `accepted ${outcome.accepted}, refused ${outcome.refused}, ` +
        `unregistered ${outcome.unregistered.length}, released ${
          outcome.unattempted.length + deviceless.length
        }`,
    );
    for (const reason of [...new Set(outcome.errors)]) {
      console.warn(`${sendChannel}: Expo said ${reason}`);
    }

    return Response.json({
      ok: true,
      channel: sendChannel,
      claimed: claims.length,
      sent: outcome.accepted,
      refused: outcome.refused,
      unregistered: outcome.unregistered.length,
      released: outcome.unattempted.length + deviceless.length,
    });
  },
};

/**
 * Ask Expo what became of the tickets it accepted earlier. Audit item 25.
 *
 * A ticket only ever meant "Expo took the message". This is the half that finds
 * out whether it landed — and, far more valuably, whether the device is still
 * there. `DeviceNotRegistered` reaches the TICKET when Expo already knows the
 * token is dead; when Apple is the one who knows, it comes back here. Without
 * this pass those rows were immortal, and every sweep for the rest of the app's
 * life paid to push to a phone that had been wiped.
 *
 * Deleting the row is the whole action. Nothing is written down about a
 * delivery: `push_sends` already records that a message was sent, and a second
 * ledger recording that it arrived would be a lot of rows to answer a question
 * nobody asks. What matters is the token, and the token is either evidence-dead
 * or left alone.
 */
async function collectReceipts(admin: SupabaseClient<Database>): Promise<Response> {
  const rpc = admin.rpc.bind(admin) as unknown as UntypedRpc;

  const claimed = await rpc('push_claim_receipts', { p_limit: 1000 });
  if (claimed.error) {
    console.error(`receipts: claim failed — ${claimed.error.message}`);
    return fail('claim_failed', 'Could not work out which receipts were due.', 500);
  }

  const asked = ((claimed.data ?? []) as { ticket_id: string; token: string }[]).map((r) => ({
    id: r.ticket_id,
    token: r.token,
  }));
  if (!asked.length) return Response.json({ ok: true, mode: 'receipts', asked: 0 });

  const { verdict, errors } = await fetchExpoReceipts(asked);

  // Anything Expo answered for is finished with, however it answered. Only
  // `pending` stays, and `push_claim_receipts` will not offer it again for ten
  // minutes — or ever, once it has been asked six times or aged out.
  const resolved = [...verdict.delivered, ...verdict.failed.map((f) => f.ticketId)];
  if (resolved.length) {
    const { error } = await admin.from('push_receipts').delete().in('ticket_id', resolved);
    if (error) console.error(`receipts: could not clear resolved tickets — ${error.message}`);
  }

  // The point of the whole exercise.
  if (verdict.unregistered.length) {
    const dead = [...new Set(verdict.unregistered)];
    const { error } = await admin.from('push_tokens').delete().in('token', dead);
    if (error) console.error(`receipts: could not delete dead tokens — ${error.message}`);
  }

  console.log(
    `receipts: asked ${asked.length}, delivered ${verdict.delivered.length}, ` +
      `failed ${verdict.failed.length}, unregistered ${verdict.unregistered.length}, ` +
      `pending ${verdict.pending.length}`,
  );
  // Deduplicated, because a batch of a thousand messages that hit one bad
  // credential produces a thousand identical lines otherwise.
  for (const reason of [...new Set(verdict.failed.map((f) => f.reason))]) {
    console.warn(`receipts: Expo said ${reason}`);
  }
  for (const reason of [...new Set(errors)]) {
    console.warn(`receipts: could not reach Expo — ${reason}`);
  }

  return Response.json({
    ok: true,
    mode: 'receipts',
    asked: asked.length,
    delivered: verdict.delivered.length,
    failed: verdict.failed.length,
    unregistered: verdict.unregistered.length,
    pending: verdict.pending.length,
  });
}

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
