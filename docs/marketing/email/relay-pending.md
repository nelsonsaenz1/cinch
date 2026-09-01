# Apple Private Email Relay — RESOLVED 2026-09-01 23:39Z

**Registration done and delivery PROVEN the same night.** Both domains
(`mail.cinchstyle.com`, `cinchstyle.com`) were registered in the Developer
portal at ~23:26Z (via Nelson's signed-in Chrome session). A post-registration
seed to a relay address DELIVERED at 23:30Z, and all 13 owed Dispatch copies
were redelivered (personalized one-offs) at 23:39Z — Zainab's spot-checked
`delivered`. All 14 contacts are back in their main segments.

**One residue:** Apple's dashboard shows a red SPF indicator on both domains
because neither `cinchstyle.com` nor `mail.cinchstyle.com` carries its own
SPF TXT (Resend's SPF lives on the `send.` subdomains; delivery passes on
DKIM). Adding `v=spf1 include:amazonses.com ~all` as TXT on both names in
Cloudflare would clear it — the agent was permission-blocked from editing DNS,
so this one line is Nelson's if he wants the indicator green.

---

## Original incident record (2026-09-01 23:14Z)

**Discovered 2026-09-01 23:14Z by A17's seed test.** Two seed sends to
`@privaterelay.appleid.com` addresses (one active-cohort, one no-closet) both
came back `bounced`: Apple's Private Email Relay refuses mail from
`mail.cinchstyle.com` because the domain is not registered for Sign in with
Apple email communication. **No Sign-in-with-Apple user can receive any Cinch
email until this is fixed — 14 of 37 real accounts.**

**The fix (Nelson only, ~5 minutes):** Apple Developer portal →
Certificates, Identifiers & Profiles → Services → *Sign in with Apple for
Email Communication* → register the domain `mail.cinchstyle.com` (and
`cinchstyle.com` while there). SPF/DKIM already pass via Resend/SES, which is
what Apple checks. Then re-add the addresses below to their segments and send
them Dispatch No. 01 (a fresh broadcast or one-off sends — the originals were
already sent to the deliverable cohort on 2026-09-01).

Removed from segments 2026-09-01 so the send would not bounce 43% of the list:

## Active closet (94ebb650-…)
- 6f72rnpfj7@privaterelay.appleid.com (Zainab — signed up 09-01 22:42Z with 10 items; got no seed, hers bounced)
- 6fcm9sz87c@privaterelay.appleid.com (Zoloo — crossed 0→4 items on 09-01)
- p5868shsrs@privaterelay.appleid.com (Olivia)
- v75yd49c9j@privaterelay.appleid.com
- wjy4c2ntnd@privaterelay.appleid.com (Houda)
- y6z5k7vhgb@privaterelay.appleid.com (Brookie)

## No closet yet (2ecfd8fc-…)
- 4jwddtsvkt@privaterelay.appleid.com (Zoe)
- 7kpm45ch2j@privaterelay.appleid.com (Madison)
- d9fvr4g8zc@privaterelay.appleid.com (Cortney)
- jfy7gv85hc@privaterelay.appleid.com
- nrp5rfvcrn@privaterelay.appleid.com (Ashlyn)
- s8tty2bfwz@privaterelay.appleid.com (Shintaro)
- t5p8cw987n@privaterelay.appleid.com
- yg4ktpnkwb@privaterelay.appleid.com (Allison)

Note for the daily-welcome task: do not attempt welcome sends to
`@privaterelay.appleid.com` addresses until this file says the registration
is done — each attempt is a reputation-damaging bounce.
