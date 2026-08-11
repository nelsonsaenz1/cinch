import { withSupabase } from 'npm:@supabase/server@^1';

import type { SupabaseClient } from 'npm:@supabase/supabase-js@^2';

import { BoundsError } from '../_shared/input-bounds.ts';

import {
  sendSenderCopy,
  sendSupportMail,
  type SupportAttachment,
  type SupportMessage,
} from './mail.ts';

/**
 * support-mail — HS-04's "Write to us", and HS-05's confirmation.
 *
 * One POST, one email, and a row in `support_sends` that says only that a send
 * happened. Atlas 40's rule is "mail, not a ticket system: no tiers, no ticket
 * numbers, no bot", and the schema enforces it — `support_sends` has columns for
 * the user, the time and the topic, and deliberately none for the message.
 * The words exist in the request, in the outbound mail, and nowhere else. They
 * are not logged here, and there is no code path that writes them to a table.
 *
 * ── WHAT THE THROTTLE IS FOR ───────────────────────────────────────────────
 *
 * An authenticated endpoint attached to a mailbox is a way to flood that
 * mailbox. The limits below are set where a person with a genuine problem never
 * meets them — three messages in an hour is already a bad morning — and where a
 * script gets nowhere. `support_sends` has RLS on with zero policies and an
 * explicit revoke, so only the service role inside this function can read the
 * counter; a client that could read it could plan around it.
 *
 * The booking is written BEFORE the send and deleted if the send does not
 * happen, which is the same trade `send-push` makes with its claims, inverted:
 * there, an unsent message must not be booked twice; here, a message that never
 * left must not cost the user one of their three.
 *
 * Counting and booking are ONE statement (`claim_support_send`, audit item 27).
 * They used to be two, and the comment that stood here called the gap between
 * them "a benign race for a throttle whose job is to stop a loop, not to be
 * exact". That was exactly backwards. A loop is concurrency: nobody floods a
 * mailbox by sending three messages and waiting, they open fifty connections at
 * once — the one case a read-then-write check cannot see. Measured against the
 * old shape, twelve simultaneous requests against a limit of three let eleven
 * through.
 *
 * ── NO FALSE SUCCESS ───────────────────────────────────────────────────────
 *
 * `{ ok: true }` is returned only when Resend accepted the message. With
 * `RESEND_API_KEY` unset — which is the state of the project today — this
 * endpoint answers 503 with a sentence, and the booking is released. HS-04 says
 * a person reads these; answering "sent" for a message nobody received would
 * make that a lie in the one place the app is promising to be reachable.
 *
 * ── THE SHAPE, WHICH THE HELP SCREEN IS WRITTEN AGAINST ────────────────────
 *
 *   POST { topic, body, query?, articleId?, diagnostics,
 *          attachment?: { filename, mimeType, base64 } }
 *   200  { ok: true, copySentTo?: string }
 *   4xx/5xx { error: string }   — a sentence, shown to the user as it arrives
 *
 * `copySentTo` is the address the sender's copy went to, and it is absent when
 * no copy went out. HS-05's "a copy is in your mail" is printed from that field
 * and from nothing else, so the screen cannot claim a copy that did not happen.
 *
 * The one exception to the `{ error }` shape is 401, which can come from the
 * platform's `verify_jwt` gate or from `withSupabase`'s own credential check
 * before this file runs; both answer `{ code, message }`. A 401 here always
 * means the session is gone, so the client should treat it as "signed out"
 * rather than looking for a sentence to print.
 */

/** Bounds. Generous against a person writing in; fatal to a loop. */
const LIMITS = {
  topicChars: 64,
  bodyChars: 4_000,
  queryChars: 200,
  articleIdChars: 120,
  diagnosticKeys: 24,
  diagnosticKeyChars: 40,
  diagnosticValueChars: 200,
  filenameChars: 120,
  /**
   * Unit H caps the attachment at 1.5 MB of base64 client-side. This is 1.6 MiB
   * — a little above it on purpose, because "1.5 MB" and "1.5 MiB" are not the
   * same number and a screenshot landing in the 48 KB between them would be
   * rejected by a rule the client believed it had honoured.
   */
  attachmentBase64Chars: 1_677_722,
  /** The whole body: one attachment, the message, and JSON's own overhead. */
  bodyBytes: 2 * 1024 * 1024,
} as const;

/**
 * What may be attached.
 *
 * HS-04's attach row is for a screenshot of the thing that went wrong, so this
 * is an image allow-list plus PDF, and not "whatever the client encoded". The
 * endpoint is an authenticated way to put a file into a mailbox somebody opens,
 * which is precisely the shape that should not forward an arbitrary binary.
 */
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

/** Base64 after whitespace is stripped. Nothing else may appear. */
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

// Three in an hour, ten in a day — enforced by `claim_support_send`, which is
// where the numbers now live (audit 27). They are deliberately NOT restated
// here: two copies of a limit is one copy that will be wrong, and this file
// cannot enforce it anyway. The sentences below are what remains, because copy
// belongs with the copy.

/**
 * Throttle copy, shown to the user verbatim.
 *
 * Written as something a person says, not as a limit being enforced, and it
 * never implies the earlier messages were lost — because they were not, and the
 * first thing somebody sending a fourth message is worried about is whether the
 * first three arrived.
 */
const HOUR_SENTENCE =
  'You have sent us a few messages in the last hour. We have every one of them — give it an hour before writing again.';
const DAY_SENTENCE =
  'You have written to us a lot today. We have all of it and someone will come back to you — try again tomorrow if you need to add more.';

function fail(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

/**
 * The body, with this endpoint's own ceiling rather than the shared one.
 *
 * `_shared/input-bounds.ts` caps a request at 64 KB, and says why in its own
 * first paragraph: "the string a caller sends becomes part of a prompt we pay
 * for by the token". None of that is true here. Nothing in this function
 * reaches a model, nothing is billed per character, and HS-04's attach row puts
 * up to 1.5 MB of base64 in the body by agreement with the client. Raising the
 * shared constant to fit a support screenshot would raise the ceiling on every
 * AI endpoint that has it for cost reasons, which is why this reads the body
 * itself and keeps `BoundsError` for the shared rejection discipline.
 *
 * Counted in bytes, because the thing being bounded here really is transfer
 * size rather than a prompt.
 */
async function readBoundedBody(req: Request): Promise<Record<string, unknown>> {
  let raw: Uint8Array;
  try {
    raw = new Uint8Array(await req.arrayBuffer());
  } catch {
    throw new BoundsError('Could not read the request body.');
  }

  if (raw.byteLength > LIMITS.bodyBytes) {
    throw new BoundsError(
      `That message is too large to send (${raw.byteLength} bytes, limit ${LIMITS.bodyBytes}).`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    throw new BoundsError('Expected a JSON body.');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new BoundsError('Expected a JSON body.');
  }

  return parsed as Record<string, unknown>;
}

function requiredString(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string') throw new BoundsError(`${field} must be a string.`);
  const trimmed = value.trim();
  if (!trimmed) throw new BoundsError(`${field} is required.`);
  if (trimmed.length > max) {
    throw new BoundsError(`${field} is too long (${trimmed.length} characters, limit ${max}).`);
  }
  return trimmed;
}

function optionalString(value: unknown, field: string, max: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new BoundsError(`${field} must be a string.`);
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > max) {
    throw new BoundsError(`${field} is too long (${trimmed.length} characters, limit ${max}).`);
  }
  return trimmed;
}

/**
 * `diagnostics` is a flat string map rather than a fixed shape.
 *
 * Unit H sends what HS-04 draws — app version, build, device, OS, plan — and a
 * server that pinned those five keys would 400 every older build the day a
 * sixth was added. Bounding the count and the lengths is what this needs to do;
 * the mail renders whatever arrives as `key: value` lines. Numbers and booleans
 * are coerced so the client does not have to stringify by hand.
 */
function parseDiagnostics(value: unknown): Record<string, string> {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new BoundsError('diagnostics must be an object.');
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length > LIMITS.diagnosticKeys) {
    throw new BoundsError(
      `diagnostics has too many entries (${entries.length}, limit ${LIMITS.diagnosticKeys}).`,
    );
  }

  const out: Record<string, string> = {};
  for (const [key, raw] of entries) {
    if (key.length > LIMITS.diagnosticKeyChars) {
      throw new BoundsError(`diagnostics has a key that is too long (limit ${LIMITS.diagnosticKeyChars}).`);
    }
    if (raw === undefined || raw === null) continue;
    if (typeof raw !== 'string' && typeof raw !== 'number' && typeof raw !== 'boolean') {
      throw new BoundsError(`diagnostics.${key} must be a string, number or boolean.`);
    }
    const text = String(raw);
    if (text.length > LIMITS.diagnosticValueChars) {
      throw new BoundsError(
        `diagnostics.${key} is too long (${text.length} characters, limit ${LIMITS.diagnosticValueChars}).`,
      );
    }
    out[key] = text;
  }

  return out;
}

/**
 * The one optional attachment.
 *
 * `{ filename, mimeType, base64 }` on the same POST body, no data-URI prefix —
 * the shape Unit H proposed, accepted as proposed. The filename is reduced to a
 * leaf name: it is going into a mail header and then onto somebody's disk, and
 * a path separator in it is either a mistake or an attempt.
 */
function parseAttachment(value: unknown): SupportAttachment | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new BoundsError('attachment must be an object.');
  }

  const raw = value as Record<string, unknown>;

  const mimeType = requiredString(raw.mimeType, 'attachment.mimeType', 100).toLowerCase();
  if (!ALLOWED_MIME.has(mimeType)) {
    throw new BoundsError('You can attach a picture or a PDF.');
  }

  if (typeof raw.base64 !== 'string') {
    throw new BoundsError('attachment.base64 must be a string.');
  }

  // Newlines are what most base64 encoders emit and what most decoders ignore,
  // so they are stripped rather than rejected. A `data:` prefix is rejected by
  // name: it is the one wrong-but-plausible thing a client sends here, and
  // "attachment.base64 must be base64" would not tell anybody what to fix.
  const base64 = raw.base64.replace(/\s+/g, '');
  if (base64.startsWith('data:')) {
    throw new BoundsError('attachment.base64 must be base64 on its own, with no data: prefix.');
  }
  if (!base64) throw new BoundsError('attachment.base64 is required.');
  if (base64.length > LIMITS.attachmentBase64Chars) {
    throw new BoundsError('That attachment is too large. Please send a picture under about 1.5 MB.');
  }
  if (!BASE64.test(base64)) throw new BoundsError('attachment.base64 must be base64.');

  const filenameRaw = optionalString(raw.filename, 'attachment.filename', LIMITS.filenameChars);
  const filename = (filenameRaw ?? '')
    .split(/[\\/]/)
    .pop()!
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim();

  return {
    filename: filename || 'attachment',
    mimeType,
    base64,
  };
}

export default {
  fetch: withSupabase(
    { auth: 'user' },
    async (req: Request, ctx): Promise<Response> => {
      if (req.method !== 'POST') return fail('Method not allowed.', 405);

      // `UserClaims` normalises the JWT's `sub` to `id`. There is no `.sub` on
      // it — reading one yields undefined and 401s every authenticated caller.
      const userId = ctx.userClaims?.id;
      if (!userId) return fail('You need to be signed in to write to us.', 401);

      const admin = ctx.supabaseAdmin as unknown as SupabaseClient;

      // ── 1. Read the message, bounded ─────────────────────────────────────
      let topic: string;
      let body: string;
      let query: string | undefined;
      let articleId: string | undefined;
      let diagnostics: Record<string, string>;
      let attachment: SupportAttachment | undefined;

      try {
        const raw = await readBoundedBody(req);
        topic = requiredString(raw.topic, 'topic', LIMITS.topicChars);
        body = requiredString(raw.body, 'body', LIMITS.bodyChars);
        query = optionalString(raw.query, 'query', LIMITS.queryChars);
        articleId = optionalString(raw.articleId, 'articleId', LIMITS.articleIdChars);
        diagnostics = parseDiagnostics(raw.diagnostics);
        attachment = parseAttachment(raw.attachment);
      } catch (err) {
        if (err instanceof BoundsError) return fail(err.message, 400);
        throw err;
      }

      // ── 2. Throttle and book, in one statement ───────────────────────────
      //
      // Audit item 27. This was a SELECT count followed by a separate INSERT,
      // and the comment above it called the gap "a benign race". It was not: a
      // loop IS concurrency, and twelve simultaneous requests against a limit
      // of three let ELEVEN through when measured. `claim_support_send` counts
      // and books inside an advisory lock keyed on the user, so requests from
      // one person queue behind each other and each sees the last one's
      // booking. Requests from different people never contend.
      //
      // The limits now live in the function; only the sentences are here. A
      // rule enforced by its caller is the thing that just got fixed.
      const { data: claim, error: claimError } = await admin.rpc('claim_support_send', {
        p_user_id: userId,
        p_topic: topic,
      });

      if (claimError) {
        console.error(`support-mail: could not claim a send — ${claimError.message}`);
        return fail('We could not send that just now. Please try again in a minute.', 500);
      }

      // A set-returning function comes back as an array of one row.
      const claimed = (claim as { booking_id: string | null; refused: string | null }[] | null)?.[0];

      if (claimed?.refused === 'day') return fail(DAY_SENTENCE, 429);
      if (claimed?.refused === 'hour') return fail(HOUR_SENTENCE, 429);

      if (!claimed?.booking_id) {
        // No id and no refusal is a shape this code has no reading of. Refusing
        // is the safe direction: the alternative is sending mail that the
        // throttle has no record of.
        console.error('support-mail: the throttle answered with neither a booking nor a refusal.');
        return fail('We could not send that just now. Please try again in a minute.', 500);
      }

      const bookingId = claimed.booking_id;

      const release = async () => {
        const { error } = await admin.rpc('release_support_send', {
          p_booking_id: bookingId,
          p_user_id: userId,
        });
        if (error) console.error('support-mail: a booking for an unsent message was left behind.');
      };

      // ── 4. Who is writing. From the JWT's user, never from the body. ─────
      const [{ data: profile }, { data: authUser }] = await Promise.all([
        admin.from('profiles').select('username').eq('user_id', userId).maybeSingle(),
        (admin as unknown as { auth: { admin: { getUserById: (id: string) => Promise<{ data: { user: { email?: string } | null } | null }> } } })
          .auth.admin.getUserById(userId),
      ]);

      const message: SupportMessage = {
        topic,
        body,
        query,
        articleId,
        diagnostics,
        attachment,
        handle: (profile as { username?: string | null } | null)?.username ?? null,
        // The reply-to address, and the address the copy goes to. Read from the
        // account behind the JWT, never from the request — the client does not
        // send one, and an address arriving in the body would be both
        // untrustworthy and undisclosed by HS-04's diagnostics panel.
        email: authUser?.user?.email ?? null,
        userId,
      };

      // ── 5. Send ──────────────────────────────────────────────────────────
      const outcome = await sendSupportMail(message);

      if (!outcome.sent) {
        await release();
        if (outcome.reason === 'not_configured') {
          // Honest about the shape of the problem without naming a secret.
          return fail(
            'We cannot send messages from the app just now. Please write to hello@cinchstyle.com and we will pick it up there.',
            503,
          );
        }
        return fail('That did not send. Please try again in a moment.', 502);
      }

      // ── 6. The copy HS-05 promises, which cannot un-send the message. ────
      //
      // `copySentTo` is present only when a copy actually left, and carries the
      // address it went to. HS-05 prints "a copy is in your mail, sent to …"
      // from this field alone — so the sentence cannot survive a copy that
      // failed, and the address on screen is the address that was used rather
      // than one the screen guessed.
      const copy = await sendSenderCopy(message);
      const copySentTo = copy.sent ? message.email : null;

      // Countable, and free of anything the person wrote.
      console.log(
        `support-mail: sent for ${userId}, topic "${topic}", ` +
          `${Object.keys(diagnostics).length} diagnostic field(s), ` +
          `attachment ${attachment ? attachment.mimeType : 'none'}, copy ${
            copy.sent ? 'sent' : 'not sent'
          }`,
      );

      return Response.json({ ok: true, ...(copySentTo ? { copySentTo } : {}) });
    },
  ),
};
