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
