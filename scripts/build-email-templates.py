#!/usr/bin/env python3
"""
Generate every Supabase auth email template in Cinch's branding.

WHY A GENERATOR AND NOT FOURTEEN HAND-WRITTEN FILES

Supabase sends thirteen different auth emails. Three (magic link, confirm
signup, change email) are hand-styled files in docs/email-templates/; the ten
here were still the stock Supabase default — which is a bare sans-serif page
with a blue link and no mention of Cinch at all. Any one of them going out
undermines the others: a user who gets a beautiful sign-in email and then a
naked "Your identity has been linked" learns that the first one was the
exception.

Hand-writing eleven more would guarantee drift. The masthead, the rule, the
tracked eyebrow and the colophon are the same in all of them, so they are
written once here and the templates differ only in their words.

Table layout and inline styles throughout: the only thing that survives Outlook
and Gmail. No web fonts — Instrument Serif cannot load in an email client, so
the wordmark falls back to a Georgia stack, which is the closest available
shape.

Run:  python3 scripts/build-email-templates.py          # write files
      python3 scripts/build-email-templates.py --push   # write and upload
"""
import json
import os
import subprocess
import sys
import urllib.request

OUT = os.path.join(os.path.dirname(__file__), '..', 'docs', 'email-templates', 'generated')
PROJECT = 'dugizuswuebrmcmvinmi'

INK, CANVAS, TRAY = '#1C1A16', '#FBFAF6', '#F2F0EA'
MUTED, FAINT, RULE = '#6B665C', '#8A857A', '#E3DFD5'
ACCENT, WARM, CRITICAL = '#6E2B2B', '#B08A76', '#8A2E28'
SERIF = "Georgia,'Times New Roman',serif"
SANS = "Arial,Helvetica,sans-serif"


def shell(title, eyebrow, headline, body, action_html, footer, preheader):
    """One page. `action_html` is the button, the code block, or nothing."""
    return f"""<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>{title}</title>
  </head>
  <body style="margin:0; padding:0; background-color:{TRAY}; color:{INK};">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0;">{preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{TRAY}" style="background-color:{TRAY};">
      <tr>
        <td align="center" style="padding-top:40px; padding-bottom:40px; padding-left:16px; padding-right:16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="{CANVAS}" style="max-width:520px; background-color:{CANVAS}; border-top:1px solid {RULE}; border-bottom:1px solid {RULE}; border-left:1px solid {RULE}; border-right:1px solid {RULE}; border-radius:20px;">
            <tr>
              <td style="padding-top:40px; padding-bottom:36px; padding-left:36px; padding-right:36px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr><td style="font-family:{SERIF}; font-size:44px; line-height:48px; color:{INK};">Cinch</td></tr>
                  <tr><td height="1" bgcolor="{RULE}" style="background-color:{RULE}; font-size:0; line-height:0; padding-top:18px;">&nbsp;</td></tr>
                  <tr><td style="padding-top:12px; font-family:{SANS}; font-size:11px; line-height:16px; letter-spacing:1.6px; color:{MUTED}; text-transform:uppercase;">{eyebrow}</td></tr>
                  <tr><td style="padding-top:26px; font-family:{SERIF}; font-size:30px; line-height:35px; color:{INK};">{headline}</td></tr>
                  <tr><td style="padding-top:10px; padding-bottom:28px; font-family:{SANS}; font-size:16px; line-height:26px; color:{MUTED};">{body}</td></tr>
                </table>
                {action_html}
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr><td height="1" bgcolor="{RULE}" style="background-color:{RULE}; font-size:0; line-height:0; padding-top:28px;">&nbsp;</td></tr>
                  <tr><td style="padding-top:16px; font-family:{SANS}; font-size:13px; line-height:20px; color:{MUTED};">{footer}</td></tr>
                  <tr><td style="padding-top:18px; font-family:{SANS}; font-size:11px; line-height:17px; letter-spacing:1.2px; color:{FAINT}; text-transform:uppercase;">Cinch &middot; Outfits from clothes you already own</td></tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""


def button(label):
    """Bulletproof button. The td carries the colour so Outlook renders it."""
    return f"""<table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td bgcolor="{INK}" style="background-color:{INK}; border-radius:12px;">
                      <a href="{{{{ .ConfirmationURL }}}}" style="display:inline-block; padding-top:15px; padding-bottom:15px; padding-left:26px; padding-right:26px; font-family:{SANS}; font-size:15px; line-height:15px; font-weight:bold; color:{CANVAS}; text-decoration:none;">{label}</a>
                    </td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr><td style="padding-top:26px; font-family:{SANS}; font-size:13px; line-height:20px; color:{MUTED};">If the button does not work, copy this address into your browser:<br><span style="color:{ACCENT}; word-break:break-all;">{{{{ .ConfirmationURL }}}}</span></td></tr>
                </table>"""


def code_block():
    """A one-time code, set like a ticket number rather than a link."""
    return f"""<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center" bgcolor="{TRAY}" style="background-color:{TRAY}; border-radius:12px; padding-top:22px; padding-bottom:22px; font-family:{SERIF}; font-size:34px; line-height:38px; letter-spacing:8px; color:{INK};">{{{{ .Token }}}}</td>
                  </tr>
                </table>"""


# Points at the support page, not "reply to this email" — the sending address
# is a one-way SMTP identity, and inviting a worried user to reply into a void
# on exactly the security notices is worse than no invitation at all.
NOT_YOU = ('<strong style="color:%s;">Did not do this?</strong> Your closet is safe and nothing has '
           'changed on your account. Visit '
           '<a href="https://cinch-nelsonsaenz1-3579s-projects.vercel.app/support" '
           'style="color:%s;">our support page</a> and we will look into it.' % (CRITICAL, MUTED))

# name -> (supabase key stem, subject, eyebrow, headline, body, action, footer, preheader)
TEMPLATES = {
    'invite': (
        'invite', 'You are invited to Cinch', 'An invitation',
        'Someone saved you a seat.',
        'You have been invited to Cinch — a stylist for the clothes you already own. '
        'Accept below and start with one photo of your wardrobe.',
        button('Accept the invitation'),
        'Not expecting this? Ignore it. The invitation expires on its own and no account is created.',
        'You have been invited to Cinch. The link expires shortly.',
    ),
    'recovery': (
        'recovery', 'Reset your Cinch password', 'Account security',
        'Reset your password.',
        'Tap below to choose a new password. The link works once, and only on the device that asked for it.',
        button('Choose a new password'),
        'Did not ask for this? Ignore it — your password is unchanged and the link is useless without your device.',
        'Reset your Cinch password. This link works once.',
    ),
    'reauthentication': (
        'reauthentication', 'Your Cinch confirmation code', 'Account security',
        'Confirm it is you.',
        'Enter this code in Cinch to confirm a sensitive change to your account. '
        'It expires shortly and can only be used once.',
        code_block(),
        'Cinch will never ask you for this code by phone, message, or email reply. '
        'If someone is asking you for it, they are not us.',
        'Your Cinch confirmation code. Expires shortly.',
    ),
    'email_changed_notification': (
        'email_changed_notification', 'Your Cinch email address was changed', 'Account security',
        'Your email address changed.',
        'The email address on your Cinch account was changed. Sign-in links will now arrive at the new address.',
        '', NOT_YOU,
        'The email address on your Cinch account was changed.',
    ),
    'password_changed_notification': (
        'password_changed_notification', 'Your Cinch password was changed', 'Account security',
        'Your password changed.',
        'The password on your Cinch account was just changed.',
        '', NOT_YOU,
        'The password on your Cinch account was changed.',
    ),
    'phone_changed_notification': (
        'phone_changed_notification', 'Your Cinch phone number was changed', 'Account security',
        'Your phone number changed.',
        'The phone number on your Cinch account was just changed.',
        '', NOT_YOU,
        'The phone number on your Cinch account was changed.',
    ),
    'identity_linked_notification': (
        'identity_linked_notification', 'A new sign-in method was added to Cinch', 'Account security',
        'A new way to sign in.',
        'A sign-in method — Apple, or an email address — was linked to your Cinch account. '
        'You can now use it to get in.',
        '', NOT_YOU,
        'A new sign-in method was linked to your Cinch account.',
    ),
    'identity_unlinked_notification': (
        'identity_unlinked_notification', 'A sign-in method was removed from Cinch', 'Account security',
        'A sign-in method was removed.',
        'A sign-in method was unlinked from your Cinch account and can no longer be used to get in. '
        'Make sure you still have at least one that works.',
        '', NOT_YOU,
        'A sign-in method was removed from your Cinch account.',
    ),
    'mfa_factor_enrolled_notification': (
        'mfa_factor_enrolled_notification', 'Two-factor authentication is on for Cinch', 'Account security',
        'Two-factor is on.',
        'A second authentication factor was added to your Cinch account. '
        'You will be asked for it the next time you sign in.',
        '', NOT_YOU,
        'Two-factor authentication was enabled on your Cinch account.',
    ),
    'mfa_factor_unenrolled_notification': (
        'mfa_factor_unenrolled_notification', 'Two-factor authentication is off for Cinch', 'Account security',
        'Two-factor is off.',
        'A second authentication factor was removed from your Cinch account. '
        'Your account is now protected by your sign-in method alone.',
        '', NOT_YOU,
        'Two-factor authentication was removed from your Cinch account.',
    ),
}


def main():
    os.makedirs(OUT, exist_ok=True)
    # Remove generated files that no longer correspond to a template — a
    # renamed entry otherwise leaves a stale file that looks live.
    expected = {f'{name}.html' for name in TEMPLATES}
    for f in os.listdir(OUT):
        if f not in expected:
            os.remove(os.path.join(OUT, f))
    payload = {}
    for name, (key, subject, eyebrow, headline, body, action, footer, pre) in TEMPLATES.items():
        html = shell(subject, eyebrow, headline, body, action, footer, pre)
        with open(os.path.join(OUT, f'{name}.html'), 'w') as fh:
            fh.write(html)
        payload[f'mailer_subjects_{key}'] = subject
        payload[f'mailer_templates_{key}_content'] = html
        print(f'  {name:<38} {len(html):>5} chars')

    if '--push' not in sys.argv:
        print('\nWrote files only. Re-run with --push to upload.')
        return

    token = subprocess.run(
        ['security', 'find-generic-password', '-s', 'Supabase CLI', '-w'],
        capture_output=True, text=True, check=True).stdout.strip()
    req = urllib.request.Request(
        f'https://api.supabase.com/v1/projects/{PROJECT}/config/auth',
        data=json.dumps(payload).encode(), method='PATCH',
        headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json',
                 'User-Agent': 'curl/8.7.1'})
    try:
        with urllib.request.urlopen(req) as r:
            print(f'\nPATCH {r.status} — {len(TEMPLATES)} templates uploaded')
    except urllib.error.HTTPError as e:
        print(f'\nPATCH FAILED {e.code}: {e.read().decode()[:400]}')
        sys.exit(1)


if __name__ == '__main__':
    main()
