import { postResendEmail } from '../build-export/mail.ts';

import type { Alert, Report } from './thresholds.ts';

/**
 * The alert, as an email.
 *
 * WHY EMAIL AND NOT SOMETHING BETTER
 *
 * Because it is the only channel that exists. Push needs a store build and the
 * `aps-environment` entitlement; there is no Slack workspace and no pager. Mail
 * already works: `build-export/mail.ts` posts to Resend and this reuses that
 * function verbatim rather than opening a second path to the same provider.
 *
 * That reuse also inherits its refusal behaviour, which is the right one here:
 * an unset RESEND_API_KEY logs and returns `not_configured` rather than
 * throwing. An alerting system that crashes when it cannot alert has turned one
 * problem into two.
 *
 * WHAT NEVER GOES IN ONE OF THESE
 *
 * No credentials, no key prefixes, no user words, no provider response bodies.
 * The report is quota levels and counters — facts about the system — and the
 * whole reason `thresholds.ts` writes its own `detail` strings rather than
 * forwarding an error message is that a forwarded message eventually contains
 * the request that caused it.
 */

const OPS_FALLBACK = 'hello@mail.cinchstyle.com';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function alertMail(alerts: Alert[], report: Report): Promise<string> {
  const to = Deno.env.get('OPS_ALERT_EMAIL') ?? OPS_FALLBACK;
  const critical = alerts.some((a) => a.severity === 'critical');

  // The subject is the alert. Somebody reading this on a phone should know
  // whether to open it without opening it.
  const subject =
    alerts.length === 1
      ? `${critical ? '[critical]' : '[warning]'} Cinch commerce: ${alerts[0].title}`
      : `${critical ? '[critical]' : '[warning]'} Cinch commerce: ${alerts.length} alerts`;

  const q = report.quota;
  const facts = [
    q ? `quota        ${q.used}/${q.limit} used, ${q.remaining} left, resets ${q.cycle_end}` : null,
    `cache        ${report.cache.rows} rows, ${report.cache.live} live, coverage ${
      report.cache.coverage === null ? 'n/a' : `${Math.round(report.cache.coverage * 100)}%`
    }`,
    `merchants    ${report.merchants.allowlisted} allowlisted, ${report.monetisation.joined_programmes} joined programmes`,
    `links        ${report.counters.links_direct?.value ?? 0} direct, ${
      report.counters.links_paid?.value ?? 0
    } paid`,
    `provider     datafeedr ${report.provider.datafeedr_configured ? 'configured' : 'NOT CONFIGURED'}`,
  ].filter((line): line is string => line !== null);

  const text = [
    ...alerts.map((a) => `${a.severity.toUpperCase()}: ${a.title}\n\n${a.detail}`),
    '',
    '— where things stand —',
    ...facts,
    '',
    `Report generated ${report.at}.`,
  ].join('\n');

  const html = `<div style="font:15px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1C1A16">
${alerts
  .map(
    (a) => `<p style="margin:0 0 4px"><strong style="color:${
      a.severity === 'critical' ? '#6E2B2B' : '#1C1A16'
    }">${escapeHtml(a.title)}</strong></p>
<p style="margin:0 0 18px;color:#6B6656">${escapeHtml(a.detail)}</p>`,
  )
  .join('\n')}
<p style="margin:0 0 4px;color:#6B6656">Where things stand</p>
<pre style="margin:0;font:13px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;color:#1C1A16">${escapeHtml(
    facts.join('\n'),
  )}</pre>
<p style="margin:18px 0 0;color:#6B6656;font-size:13px">Report generated ${escapeHtml(report.at)}.</p>
</div>`;

  const outcome = await postResendEmail({
    from: 'Cinch <hello@mail.cinchstyle.com>',
    to: [to],
    subject,
    text,
    html,
  });

  // The status is included because an alert that could not be delivered is
  // itself the most urgent thing in the system, and 'send_failed' on its own
  // does not tell anybody which of the three likely causes it is.
  if (outcome.sent) return 'sent';
  return [outcome.reason, outcome.status, outcome.errorName].filter(Boolean).join(':');
}
