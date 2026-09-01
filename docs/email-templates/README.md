# Cinch email

Two different systems send mail, and it matters which is which.

| File | Sent by | Where it goes |
|---|---|---|
| `magic-link.html` | Supabase Auth | Dashboard → Authentication → Email Templates → **Magic Link** *and* **Confirm signup** |
| `change-email.html` | Supabase Auth | Dashboard → Authentication → Email Templates → **Change Email Address** |
| `newsletter.html` | Resend | Resend → Broadcasts → new broadcast → Code editor |

Supabase renders its own templates and hands the finished message to whatever
SMTP you configure. Resend is the **transport** for those, not the author — you
will not find the sign-in email in Resend's template library, and you should not
try to move it there.

The merge-tag syntax differs between the two and is not interchangeable:
Supabase uses `{{ .ConfirmationURL }}`, Resend uses `{{{RESEND_UNSUBSCRIBE_URL}}}`.

---

## Wiring Resend into Supabase

Do this in the dashboard yourself — it involves pasting an API key, which
should not travel through a chat log or a committed file.

1. **Resend → Domains → Add Domain.** Use a subdomain you will not send
   marketing from later, e.g. `mail.cinch.app`. Add the DKIM, SPF and DMARC
   records it gives you. Wait for all three to go green; sending before that is
   how you land in spam permanently.
2. **Resend → API Keys → Create**, scope **Sending access** only.
3. **Supabase → Project Settings → Authentication → SMTP Settings → Enable
   custom SMTP:**

   | Field | Value |
   |---|---|
   | Host | `smtp.resend.com` |
   | Port | `465` |
   | Username | `resend` |
   | Password | your Resend API key |
   | Sender email | `hello@mail.cinch.app` (must be on the verified domain) |
   | Sender name | `Cinch` |

4. **Supabase → Authentication → Rate Limits → Emails sent per hour.** It is
   **2** today, which is the built-in provider's cap. Custom SMTP starts you at
   30. Raise it to something that matches real signup volume — a few hundred —
   once the domain is warm.
5. Only *after* step 3 does the template editor unlock. Free-tier projects
   created after 3 June 2026 cannot customise auth templates on Supabase's own
   mailer, and this project was created 3 August 2026.

## Subject lines

| Template | Subject |
|---|---|
| Magic Link / Confirm signup | Your Cinch sign-in link |
| Change Email Address | Confirm your new Cinch address |
| Broadcast | write a fresh one every send |

## Rules that are not style preferences

- **Table layout and inline styles.** Not old-fashioned — the only thing that
  survives Outlook and Gmail. No `<style>` block, no flexbox, no web fonts.
- **Instrument Serif will not load in an email client.** Every template falls
  back to a Georgia stack, which is the closest available shape to the wordmark.
- **Never swap `{{ .ConfirmationURL }}` for `{{ .SiteURL }}` or
  `{{ .RedirectTo }}`.** ConfirmationURL goes to Supabase first so the one-time
  token is actually verified, then redirects to `cinch://auth-callback` with the
  PKCE code. A direct RedirectTo link signs people in without verifying the
  address at all.
- **Rewrite the preheader every send.** It is the grey line next to the subject
  in the inbox and it decides the open.
- **`{{{RESEND_UNSUBSCRIBE_URL}}}` is not optional** in a broadcast. Resend
  refuses to send without it and CAN-SPAM requires it.

## Previewing

These are static files. Open them directly:

```bash
open docs/email-templates/newsletter.html
```

The merge tags render as literal text in a browser, which is expected — both
Supabase and Resend have their own preview with test data.

---

## QA mailbox deliverability — `cinchstyle.com` has no MX (structural, 2026-08-31)

**Root cause.** The apex domain `cinchstyle.com` — the domain behind every
`sim-test@cinchstyle.com` / `sim-test+alias@cinchstyle.com` QA account — carries
**no MX record**. Verified independently 2026-08-31:

```
$ dig @1.1.1.1 MX cinchstyle.com +short
(empty)
$ dig @1.1.1.1 A cinchstyle.com +short
216.150.1.193
216.150.16.193
```

A record present, MX absent. There is nowhere for inbound SMTP to `cinchstyle.com`
to go — not a propagation lag, not a Resend outage, not a per-message fluke.
**Every** message to any `@cinchstyle.com` address is structurally undeliverable,
and this has been true since before the CMO briefings started flagging it
(`docs/marketing/cmo-briefings/2026-08-25.md`, `2026-08-26.md`, `2026-08-28.md`:
Resend showing `sim-test@cinchstyle.com` first delayed, then bouncing, worsening
night over night — consistent with SES/Resend retrying against a domain that
will never accept the message and eventually giving up).

**The "immediate" plus-alias was an illusion.** On 2026-08-31, Resend showed
`sim-test@cinchstyle.com` and `sim-test+j00@cinchstyle.com` as `delivery_delayed`,
while `sim-test+ja@cinchstyle.com` showed `sent`. `sent` means Resend accepted
the message *for delivery* — it is not `delivered`. Since MX resolution fails
for the whole domain, `sent` was never going to become `delivered`; the alias
just hadn't been retried into `delivery_delayed` yet at read time. There is no
alias-specific behavior here — it is a race against the same dead MX lookup.

**QA rule.** Never wait on mailbox delivery for a `@cinchstyle.com` test
account, aliased or not. The account still authenticates fine — Resend accepts
and logs the send regardless of downstream deliverability. Read the OTP straight
from Resend's sent-mail record (Resend MCP `list-emails` / `get-email`, or the
dashboard), keyed on the exact recipient address used for that signup. This is
the flow already proven in `docs/ops/strike-evidence-20260901.md` §3b
(`sim-test+jNN@cinchstyle.com`, OTP read from Resend) and referenced in
`docs/app-store/handoff.md`. It is unaffected by this defect and remains the
correct QA path — do not switch to waiting on an inbox.

**Founder-level remediation options** (not executed here — DNS/production
config is out of scope for this fix):
1. Add an MX record (and, if support replies matter, inbound routing) for
   `cinchstyle.com` itself — the pattern `docs/ops/inbound-email-directive.md`
   already lays out for the `mail.cinchstyle.com` subdomain, extended to the
   apex.
2. Move QA/sim-test accounts to a domain that already accepts mail, so
   inbox-based testing becomes possible again without touching the primary
   marketing domain.

**Docs-vs-code sender-domain drift (separate, noted here for visibility).**
This README's wiring instructions (above) say to verify a subdomain like
`mail.cinch.app` and send from `hello@mail.cinch.app`. The deployed code sends
from a different domain: `supabase/functions/support-mail/mail.ts:28-29` sets
`FROM = 'Cinch <hello@mail.cinchstyle.com>'` and `SUPPORT_INBOX =
'hello@mail.cinchstyle.com'`; `supabase/functions/build-export/mail.ts:30` and
`supabase/functions/commerce-health/mail.ts:90` do the same. Whether this is
intentional (docs stale) or accidental (code drifted) is a founder call — flagged
here, not changed. It is a distinct issue from the apex-domain MX gap above:
`mail.cinchstyle.com` sends today, and its *inbound* gap is already tracked
separately in `docs/ops/inbound-email-directive.md`.
