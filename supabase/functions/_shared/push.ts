/**
 * The Expo push service, and the one thing it is allowed to tell us.
 *
 * Cinch does not talk to APNs. It talks to `exp.host`, which holds the `.p8`
 * the founder uploaded to Expo and forwards on our behalf — which is the whole
 * reason no credential appears anywhere in this directory. The only secret this
 * module needs is the one it never sees: an `ExpoPushToken[…]` is a public
 * handle to a device, not an authenticator.
 *
 * ── WHAT A TICKET IS AND IS NOT ────────────────────────────────────────────
 *
 * Expo answers a send with one *ticket* per message. A ticket says "accepted
 * for delivery", never "delivered". Delivery is reported by a *receipt*,
 * fetched minutes later against the ticket id, and this build does not fetch
 * them: doing it properly means a second scheduled job, a table of ticket ids
 * and a retention policy for it, and none of that can be tested until a device
 * exists to receive anything at all. So the honest statement of what this
 * module knows is:
 *
 *   accepted   Expo took the message. It may still never arrive.
 *   error      Expo refused the message outright. It definitely did not arrive.
 *   throw      the request itself failed. Nothing was submitted.
 *
 * The caller distinguishes the third from the second, because only the third
 * means the ledger booked a message that was never even attempted. See the
 * comment on `push_release_claims` in 20260810110100.
 *
 * ── DEAD TOKENS ────────────────────────────────────────────────────────────
 *
 * `DeviceNotRegistered` is evidence — the app was deleted, or the token was
 * reissued — and the row is deleted on the strength of it. Nothing here prunes
 * tokens for being *old*: `push_tokens.last_seen_at` looks like it invites a
 * ninety-day sweep, and a stale timestamp is a guess about a device, not a fact
 * about one. Somebody back from a long trip should not have to discover that
 * their notifications quietly ended. The standing refusal — printed or dropped,
 * never estimated — applies to devices too.
 */

/** Expo's documented ceiling for one call to the send endpoint. */
const MAX_MESSAGES_PER_REQUEST = 100;

const EXPO_SEND_URL = 'https://exp.host/--/api/v2/push/send';

/** Long enough for a full chunk, short enough that a cron worker is not held. */
const REQUEST_TIMEOUT_MS = 20_000;

/**
 * One retry, and only for the failures a retry can fix — a 429 or a 5xx from
 * Expo's own edge. A second attempt at a rejected payload just doubles the
 * latency of a failure that was already decided.
 */
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const RETRY_DELAY_MS = 800;

/** Exactly the fields Cinch sends. Expo accepts many more; none are wanted. */
export type PushMessage = {
  /** The `ExpoPushToken[…]` from `push_tokens.token`. */
  to: string;
  title: string;
  body: string;
  /** Read by the client's tap handler. Never carries user-generated text. */
  data: Record<string, string>;
};

/** A claim from `push_sends`, carried alongside so a failure can be attributed. */
export type PushEnvelope = PushMessage & {
  userId: string;
  dedupeKey: string;
};

export type PushOutcome = {
  /** Tickets Expo accepted. Not a delivery count; see the docblock. */
  accepted: number;
  /** Tickets Expo refused, for any reason. */
  refused: number;
  /** Tokens with no device behind them any more. Delete these rows. */
  unregistered: string[];
  /**
   * Claims whose entire request failed before Expo saw it. These, and only
   * these, are safe to unbook: nothing was submitted, so a later sweep trying
   * again cannot produce a second arrival.
   */
  unattempted: { userId: string; dedupeKey: string }[];
  /** Stable, loggable reasons. Never surfaced to a user — nobody is waiting. */
  errors: string[];
};

type ExpoTicket = {
  status?: string;
  id?: string;
  message?: string;
  details?: { error?: string };
};

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** One POST, with the single retry the retryable statuses earn. */
async function postChunk(messages: PushMessage[]): Promise<ExpoTicket[]> {
  let lastError = 'unknown';

  for (let attempt = 0; attempt < 2; attempt++) {
    let response: Response;
    try {
      response = await fetch(EXPO_SEND_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(messages),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }
      break;
    }

    if (!response.ok) {
      lastError = `Expo answered ${response.status}`;
      if (attempt === 0 && RETRYABLE_STATUS.has(response.status)) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }
      break;
    }

    let payload: { data?: ExpoTicket[]; errors?: { message?: string }[] };
    try {
      payload = await response.json();
    } catch {
      lastError = 'Expo answered with something that was not JSON';
      break;
    }

    // A top-level `errors` array means the whole request was rejected — a
    // malformed body, most often — and no ticket exists for anything in it.
    if (!Array.isArray(payload.data)) {
      lastError = payload.errors?.[0]?.message ?? 'Expo returned no tickets';
      break;
    }

    return payload.data;
  }

  throw new Error(lastError);
}

/**
 * Send everything, in chunks, and report what is known afterwards.
 *
 * Never throws: a channel's sweep failing wholesale is a thing to log and move
 * on from, not a thing to take the other four channels down with. Every failure
 * reaches the caller as data.
 */
export async function sendExpoPush(envelopes: PushEnvelope[]): Promise<PushOutcome> {
  const outcome: PushOutcome = {
    accepted: 0,
    refused: 0,
    unregistered: [],
    unattempted: [],
    errors: [],
  };

  for (const batch of chunk(envelopes, MAX_MESSAGES_PER_REQUEST)) {
    let tickets: ExpoTicket[];
    try {
      tickets = await postChunk(
        batch.map((e) => ({ to: e.to, title: e.title, body: e.body, data: e.data })),
      );
    } catch (err) {
      outcome.errors.push(err instanceof Error ? err.message : String(err));
      // The whole chunk went nowhere, so every claim in it is unbookable.
      // Duplicates across chunks are impossible: one envelope is in one chunk.
      for (const e of batch) {
        outcome.unattempted.push({ userId: e.userId, dedupeKey: e.dedupeKey });
      }
      continue;
    }

    // Expo returns tickets positionally. A response of a different length is
    // Expo behaving in a way this code has no reading of, so the extra
    // envelopes are counted as refused rather than guessed at.
    tickets.forEach((ticket, i) => {
      const envelope = batch[i];
      if (ticket?.status === 'ok') {
        outcome.accepted += 1;
        return;
      }

      outcome.refused += 1;
      const reason = ticket?.details?.error ?? ticket?.message ?? 'unknown';
      if (reason === 'DeviceNotRegistered' && envelope) {
        outcome.unregistered.push(envelope.to);
      } else {
        outcome.errors.push(reason);
      }
    });

    if (tickets.length < batch.length) {
      outcome.refused += batch.length - tickets.length;
      outcome.errors.push(
        `Expo returned ${tickets.length} tickets for ${batch.length} messages`,
      );
    }
  }

  return outcome;
}
