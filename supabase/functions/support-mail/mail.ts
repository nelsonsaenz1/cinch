/**
 * The mail half of atlas 40's "Write to us".
 *
 * ── MAIL, NOT A TICKET SYSTEM ──────────────────────────────────────────────
 *
 * The message goes to the inbox and lives in the inbox. `support_sends`
 * (20260810120200) records only that a send happened, never what it said, and
 * this module is the only place the words exist between the phone and
 * hello@mail.cinchstyle.com. Nothing here writes the body anywhere — not to a
 * log line, not to a column, not into an error string.
 *
 * ── THE TRANSPORT, AND THE SECRET THAT IS NOT SET ──────────────────────────
 *
 * Cinch's sign-in mail already leaves from this address through Resend, but
 * that is Supabase Auth's SMTP configuration (docs/email-templates/README.md):
 * the key lives with the auth server and an Edge Function cannot reach it.
 * `supabase secrets list` shows no mail credential of any kind. So this is
 * written against `RESEND_API_KEY`, which the founder must create as a second
 * key scoped to **Sending access** and set with `supabase secrets set`.
 *
 * Until it is set, `sendSupportMail` returns `not_configured` and the endpoint
 * answers with a real error. It never answers `{ ok: true }` for a message that
 * did not go anywhere — HS-04 tells the user a person reads this, and a false
 * success is the one outcome that makes that a lie.
 */

const RESEND_URL = 'https://api.resend.com/emails';
const FROM = 'Cinch <hello@mail.cinchstyle.com>';
const SUPPORT_INBOX = 'hello@mail.cinchstyle.com';

const TIMEOUT_MS = 15_000;

export type MailOutcome =
  | { sent: true }
  | { sent: false; reason: 'not_configured' | 'send_failed' };

export type SupportAttachment = {
  filename: string;
  mimeType: string;
  /** Base64 with no data-URI prefix, already validated by index.ts. */
  base64: string;
};

export type SupportMessage = {
  topic: string;
  body: string;
  query?: string;
  articleId?: string;
  diagnostics: Record<string, string>;
  attachment?: SupportAttachment;
  handle: string | null;
  email: string | null;
  userId: string;
};

/**
 * The four chips HS-04 draws, turned into words for the subject line.
 *
 * Deliberately a lookup with a fall-through rather than a validator. The
 * vocabulary lives in the app and ships on the App Store's schedule — the same
 * reasoning `_shared/input-bounds.ts` gives for the styling brief — so a fifth
 * chip added next release must arrive in the inbox reading as itself, not be
 * rejected by a server that has not been redeployed.
 */
const TOPIC_LABELS: Record<string, string> = {
  broken: 'Something is broken',
  question: 'A question',
  billing: 'Billing',
  idea: 'An idea',
};

function topicLabel(topic: string): string {
  return TOPIC_LABELS[topic] ?? topic;
}

/** Resend takes the base64 string directly; nothing here re-encodes it. */
function resendAttachments(attachment?: SupportAttachment) {
  if (!attachment) return {};
  return {
    attachments: [
      {
        filename: attachment.filename,
        content: attachment.base64,
        content_type: attachment.mimeType,
      },
    ],
  };
}

/**
 * Anything that could start a new header line, removed.
 *
 * The topic reaches the `Subject:` header. It comes from a chip the app draws,
 * but the server does not validate against the app's vocabulary (the same
 * reasoning `_shared/input-bounds.ts` gives for the brief: the vocabularies ship
 * on the App Store's schedule), so it is treated as free text and folded onto
 * one line before it goes anywhere near a header.
 */
function oneLine(text: string): string {
  return text.replace(/[\r\n]+/g, ' ').trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function postResendEmail(payload: Record<string, unknown>): Promise<MailOutcome> {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) {
    console.warn('RESEND_API_KEY is unset; support mail cannot be sent.');
    return { sent: false, reason: 'not_configured' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      // Status only. The provider quotes the request back on an error, and the
      // request is somebody's private message.
      console.error(`Resend refused a support message with HTTP ${response.status}.`);
      return { sent: false, reason: 'send_failed' };
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

function diagnosticLines(diagnostics: Record<string, string>): string[] {
  return Object.entries(diagnostics).map(([key, value]) => `${key}: ${value}`);
}

/** The message itself, to the inbox a person actually reads. */
export async function sendSupportMail(message: SupportMessage): Promise<MailOutcome> {
  const topic = oneLine(topicLabel(message.topic));

  const context: string[] = [];
  if (message.articleId) context.push(`Reading: ${oneLine(message.articleId)}`);
  if (message.query) context.push(`Searched for: ${oneLine(message.query)}`);
  if (message.attachment) context.push(`Attached: ${oneLine(message.attachment.filename)}`);

  // `Handle` and `Email` are read from the caller's JWT by index.ts, never from
  // the request body. `Reported by the app` below is what the client said about
  // itself, which is useful and is not the same thing — so the two are labelled
  // apart rather than merged into one list of equally trusted facts.
  const who = [
    `Handle: ${message.handle ?? '—'}`,
    `Email: ${message.email ?? '—'}`,
    `User: ${message.userId}`,
  ];

  const text = [
    message.body,
    '',
    '—',
    `Topic: ${topic}`,
    ...context,
    '',
    ...who,
    '',
    'Reported by the app',
    ...diagnosticLines(message.diagnostics),
  ].join('\n');

  const html = `<div style="font:16px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#211F1A">
<p style="white-space:pre-wrap">${escapeHtml(message.body)}</p>
<hr style="border:none;border-top:1px solid rgba(33,31,26,0.12);margin:24px 0">
<p style="color:#6B6656;font-size:14px;white-space:pre-wrap">${
    escapeHtml(
      [
        `Topic: ${topic}`,
        ...context,
        '',
        ...who,
        '',
        'Reported by the app',
        ...diagnosticLines(message.diagnostics),
      ].join('\n'),
    )
  }</p>
</div>`;

  return await postResendEmail({
    from: FROM,
    to: [SUPPORT_INBOX],
    // Replying in the mail client reaches the person who wrote in, which is the
    // whole promise of "mail, not a ticket system". The address comes from the
    // caller's JWT — the client never sends one, so there is nothing here that
    // could point a reply at somebody who did not write in. Omitted entirely
    // when the account somehow has no address, rather than defaulting to the
    // inbox itself and making every reply look like it reached the sender.
    ...(message.email ? { reply_to: [message.email] } : {}),
    subject: `Cinch help — ${topic}`,
    text,
    html,
    ...resendAttachments(message.attachment),
  });
}

/**
 * The copy HS-05 promises: "a copy is in your mail".
 *
 * Sent after the message itself and reported separately, because the copy
 * failing is not the send failing — the person who needed to receive it already
 * has. The response carries `copySent` so the app can soften that line rather
 * than assert something that did not happen.
 */
export async function sendSenderCopy(message: SupportMessage): Promise<MailOutcome> {
  if (!message.email) return { sent: false, reason: 'send_failed' };

  const topic = oneLine(topicLabel(message.topic));

  const text = [
    'This is your copy of the message you just sent us. A person reads these; you',
    'will hear back at this address.',
    '',
    '—',
    '',
    message.body,
    '',
    '—',
    `Topic: ${topic}`,
    '',
    '— Cinch',
  ].join('\n');

  const html = `<div style="font:16px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#211F1A">
<p>This is your copy of the message you just sent us. A person reads these; you will hear back at this address.</p>
<hr style="border:none;border-top:1px solid rgba(33,31,26,0.12);margin:24px 0">
<p style="white-space:pre-wrap">${escapeHtml(message.body)}</p>
<p style="color:#6B6656;font-size:14px">Topic: ${escapeHtml(topic)}</p>
<p>— Cinch</p>
</div>`;

  return await postResendEmail({
    from: FROM,
    to: [message.email],
    reply_to: [SUPPORT_INBOX],
    subject: 'Your message to Cinch',
    text,
    html,
    // The attachment rides along. A "copy" that quietly left the screenshot
    // behind would be a copy of something the user did not send.
    ...resendAttachments(message.attachment),
  });
}
