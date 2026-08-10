# Handoff — what is done, and what is yours

Written 2026-08-10, end of session. Against the ten-item list.

---

## Done and verified

**1 · The silent return.** `begin()` returned with no visible change when there
was no session — tap Start, grant the microphone, nothing. Fixed with a fifth
V-13 cause, `signed_out`, with its own line and its own Sign in action. Also
fixed beside it: "Try again" on the silent and unparsed screens routed to The
Ten. Try again means another take, not another app.

**3 · The second door.** `Talk instead` on The Ten, below the fold, text-only.
Voice was reachable only by deep link before this. Text rather than a button
because that screen already has its one oxblood action.

**5 · The web redeploy.** Live on cinchstyle.com and checked by fetching it:
governing-law placeholder gone (0 occurrences), the billing section is up
(auto-renewing terms, cancellation route, refund route), PostHog and Superwall
and Resend now disclosed as processors, the microphone self-contradiction
resolved, and all three legal pages carry `hello@mail.cinchstyle.com`.

**10 · The lost spans.** `intake_sessions.unconsumed text[]`, applied and
deployed. `parse-closet` writes it on both fresh-parse paths and reads it back
on resume, so V-05's "things I didn't catch" survives a cold start. It used to
answer `[]` on every resume and quietly lose the record.

**Beyond the list**, because they were found on the way: `parse-closet` ran on
the model this repo's own bake-off calls "too slow" and timed out on a
350-character transcript — now on `deepseek-v4-flash`; a missing `.select()`
meant every freshly-parsed card had `id: undefined`; and two bare `catch {}`
blocks that made a permanently broken integration look like a transient blip.

---

## Partly done — the rest is yours

**4 · The build.** Build 26 was kicked off at the end of the session with the
current code. **Do not submit it** — item 2 below is unfinished, so the voice
flow in that binary has never been watched past V-01.

**6 · Inbound email.** `web/api/inbound.js` is written: verifies Resend's
webhook signature with `node:crypto` (no new dependency — `web/` has no
package.json and no build step), forwards to your inbox, and sets `reply_to` to
the original sender so hitting reply answers the person. Three things I cannot
do:

1. **Cloudflare DNS** on `cinchstyle.com`, and I have no token:
   `MX  mail  inbound-smtp.us-east-1.amazonaws.com  priority 10  DNS only`
2. **Resend → Webhooks** → endpoint `https://cinchstyle.com/api/inbound`,
   event `email.received`. Copy the signing secret.
3. **Vercel env**: `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`,
   `SUPPORT_FORWARD_TO`.

Until 1 and 2 exist, `hello@mail.cinchstyle.com` accepts mail and drops it —
and it is now the published contact on all three legal pages. **This is the
most urgent item on this page.**

---

## Not done — blocked on something I do not have

**2 · Walk V-02 → V-13.** Only V-01 and the microphone prompt are verified. I
can drive every screen, but I cannot speak into the simulator and this machine
has no audio loopback, so the recording path itself has to be walked by a
person. The server path is separately proven — see the scratch script below.

**7 · Attach the IAPs + the App-Specific Shared Secret.** No App Store Connect
credentials in this session: no API key on disk, no fastlane. Directive
`db0f5d8`. Until this lands the paywall shows "Invalid Products" regardless of
how it looks in the editor. Confirm the prices match what the review notes and
`terms.html` now both quote: Standard $7.99 / $59, Pro $14.99 / $119.

**8 · The ASC metadata pass.** Paste the fenced block from
`docs/app-store/app-review-notes.md` into App Review Information → Notes, and
**leave the demo-account username and password empty** — Cinch has no password,
and a credential that cannot work is its own rejection. Then screenshots, age
rating, and the App Privacy questionnaire. The audio answers must match whatever
binary you actually ship.

**9 · The vision-model eval.** Written and ready; it could not run. The
OpenRouter key exists only in Supabase edge-function secrets, which cannot be
read back. Put it somewhere a shell can read without printing it — e.g.
`export OPENROUTER_API_KEY=...` in `~/.zshenv` — and say so. It then runs the
exact production prompt against the nine garment photos in `assets/garments/`
versus two frontier vision models, graded attribute by attribute.

---

## How to re-run the voice pipeline yourself

The end-to-end proof lives in the session scratchpad and is worth keeping:

1. `say -v Samantha -o walk.aiff "…"` then
   `afconvert -f m4af -d aac walk.aiff walk.m4a`
2. Sign in as `sim-test@cinchstyle.com` via the OTP endpoint; read the code from
   the Resend sent-mail log.
3. Create an `intake_sessions` row, upload to `intake-audio/{userId}/{sessionId}.m4a`,
   then call `transcribe-intake` and `parse-closet`.

Last run: nine garments, every receipt line a verbatim span of the transcript,
the spoken self-correction ("my blue, no sorry, my green quilted jacket")
resolved to green, and "three white t-shirts" collapsed to one row with
quantity 3.

---

## Standing decisions made this session

- **Voice ships in v1.** `CINCH_VOICE_INTAKE=1` in the production EAS profile.
  Reversing it is a one-line change if the calendar gets tighter than the
  feature is worth.
- **Governing law: clause removed** rather than a jurisdiction named.
- **Affiliate links: yes, via the Gap Feed only.** Spec is
  `docs/design/commerce-directive.md`. §0 is the load-bearing rule — commission
  may never touch ranking, and a test must assert no import edge.
- **Listing photos ship as-is** with the risk documented; Awin applied for.
- Four published sentences become false on the first shipped affiliate link.
  They are catalogued in the commerce directive and change in that same commit.

## Known and deliberately unfixed

- `garment-search` has no retry on a transient 429/5xx, unlike every sibling AI
  function — and it is the most expensive call in the app.
- Model prose length limits are prompt instructions, not schema constraints,
  everywhere except `tag-schema.ts`.
- `ai_config.timeout_ms` and `ai_calls.attempts` are columns nothing reads.
- Voice intake and photo tagging share one `tagging` quota bucket; a chatty free
  user can spend a month's allowance in one walkthrough.
