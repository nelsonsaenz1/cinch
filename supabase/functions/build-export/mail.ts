/**
 * "Your export is ready", by mail.
 *
 * ── THE TRANSPORT, AND WHY THIS NEEDS A SECRET NOBODY HAS SET YET ──────────
 *
 * Cinch does already send mail from `hello@mail.cinchstyle.com` through Resend,
 * but that is Supabase Auth's SMTP configuration — Resend is the *transport* for
 * the sign-in code, not something this code can reach.
 * `docs/email-templates/README.md` spells the wiring out: the API key was pasted
 * into Project Settings → Authentication → SMTP, where the auth server holds it
 * and nothing else can read it. `supabase secrets list` confirms it: an Edge
 * Function here has OPENROUTER_API_KEY, PUSH_CRON_SECRET, SUPERWALL_WEBHOOK_
 * SECRET and the platform's own, and no mail credential at all.
 *
 * So this module is written against `RESEND_API_KEY` and refuses politely when
 * it is unset. The founder must create a second Resend key with **Sending
 * access** only and set it with `supabase secrets set RESEND_API_KEY=…`. Until
 * then every send here is a no-op that says so in the logs.
 *
 * ── AND WHY A MISSING KEY MUST NOT FAIL AN EXPORT ──────────────────────────
 *
 * The archive is the thing the user asked for and it is already in the bucket by
 * the time this runs. Marking the row `failed` because a courtesy email could
 * not go out would cost them their one export for the day over a notification.
 * `sendExportReadyMail` therefore reports rather than throws, and the caller
 * writes `ready` either way — the app's export page shows the same download.
 */

const RESEND_URL = 'https://api.resend.com/emails';
const FROM = 'Cinch <hello@mail.cinchstyle.com>';

/** Provider text is never surfaced to a user, so a short timeout is enough. */
const TIMEOUT_MS = 15_000;

export type MailOutcome =
  | { sent: true }
  | {
      sent: false;
      reason: 'not_configured' | 'no_address' | 'send_failed';
      /** Resend's HTTP status when there was one. Carried because
       *  'send_failed' alone is not actionable: a 403 is a key that lacks
       *  permission for the domain, a 422 is a malformed address, and a 429 is
       *  a rate limit that will pass on its own. Absent when the request never
       *  completed. */
      status?: number;
      /** Resend's `name` field only — 'validation_error', 'missing_api_key'.
       *  The rest of the error body is deliberately dropped: it quotes the
       *  request back, and the request carries a signed URL to somebody's
       *  archive. A class name names the fault without reproducing the fault. */
      errorName?: string;
    };

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Bytes as the app prints them, so the mail and the page agree. */
export function humanBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * One POST to Resend. Returns whether it was accepted and nothing else.
 *
 * The key is read here and never logged, never returned, and never written to
 * the `data_exports.error` column — the same rule `_shared/openrouter.ts` keeps
 * for provider text, for the same reason.
 */
export async function postResendEmail(payload: Record<string, unknown>): Promise<MailOutcome> {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) {
    console.warn('RESEND_API_KEY is unset; no mail was sent.');
    return { sent: false, reason: 'not_configured' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      // Status and error CLASS only. A provider error body quotes the request
      // back, and the request carries a signed URL to somebody's archive.
      let errorName: string | undefined;
      try {
        const body = (await response.json()) as { name?: unknown };
        if (typeof body?.name === 'string') errorName = body.name.slice(0, 60);
      } catch {
        // A non-JSON error body is nothing we can safely quote.
      }
      console.error(
        `Resend refused the message with HTTP ${response.status}${errorName ? ` (${errorName})` : ''}.`,
      );
      return { sent: false, reason: 'send_failed', status: response.status, errorName };
    }

    return { sent: true };
  } catch (err) {
    console.error(
      `Resend could not be reached: ${err instanceof Error ? err.name : 'unknown error'}`,
    );
    return { sent: false, reason: 'send_failed' };
  } finally {
    clearTimeout(timer);
  }
}

export async function sendExportReadyMail(opts: {
  to: string | null;
  downloadUrl: string;
  expiresAt: string;
  bytes: number;
  pieces: number;
}): Promise<MailOutcome> {
  if (!opts.to) {
    console.warn('build-export: the account has no email address; no mail was sent.');
    return { sent: false, reason: 'no_address' };
  }

  const expiry = new Date(opts.expiresAt).toUTCString();
  const size = humanBytes(opts.bytes);

  const text = [
    'Your Cinch export is ready.',
    '',
    `Download it here: ${opts.downloadUrl}`,
    '',
    `It is a ${size} zip holding closet.csv, wears.csv, plans.csv, account.json and`,
    'photos.html — an index of links to every one of your photographs at full size.',
    '',
    `The link, and the links inside photos.html, stop working on ${expiry}.`,
    'Save anything you want to keep before then. You can ask for a new export at any time.',
    '',
    '— Cinch',
  ].join('\n');

  const html = `<div style="font:16px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#211F1A">
<p>Your Cinch export is ready.</p>
<p><a href="${escapeHtml(opts.downloadUrl)}" style="color:#211F1A">Download it here</a></p>
<p>It is a ${escapeHtml(size)} zip holding <code>closet.csv</code>, <code>wears.csv</code>,
<code>plans.csv</code>, <code>account.json</code> and <code>photos.html</code> — an index of links
to every one of your ${opts.pieces === 1 ? 'photograph' : 'photographs'} at full size.</p>
<p style="color:#6B6656">The link, and the links inside <code>photos.html</code>, stop working on
${escapeHtml(expiry)}. Save anything you want to keep before then. You can ask for a new export at
any time.</p>
<p>— Cinch</p>
</div>`;

  return await postResendEmail({
    from: FROM,
    to: [opts.to],
    subject: 'Your Cinch export is ready',
    text,
    html,
  });
}
