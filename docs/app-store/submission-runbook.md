# Submission runbook — what is left, and who does it

Written 2026-08-10. Everything here is either blocked on a credential I do not
have, or is a decision already made and waiting to be executed.

The scope changed when voice intake was confirmed for v1. **Build 24 is not the
submission build** — it was cut with `CINCH_VOICE_INTAKE` unset, so it has no
microphone entitlement and cannot run the feature the privacy policy describes.

---

## A. Blocked on you — three credentials

### A1. Inbound email for hello@mail.cinchstyle.com  *(do this before the site redeploys)*

The legal pages, the support page and the app's help composer now all point at
`hello@mail.cinchstyle.com`. **Mail sent there currently goes nowhere.**

Done already: Resend receiving is enabled on the domain (it was disabled).

Left to do, at Cloudflare — the DNS is on `molly.ns.cloudflare.com` /
`micah.ns.cloudflare.com` and I have no token for it:

| Type | Name | Value | Priority | Proxy |
|---|---|---|---|---|
| MX | `mail` | `inbound-smtp.us-east-1.amazonaws.com` | 10 | DNS only |

Then forwarding. Resend inbound delivers to a webhook, not to another mailbox,
so "redirect to nelsonsaenz1@yahoo.com" needs a small forwarder: a Vercel
function subscribed to Resend's `email.received` event that re-sends the message
on to the Yahoo address. It is perhaps thirty lines and it belongs next to
`web/api/waitlist.js`. **I have not written it** — say the word and I will.

Until the MX and the forwarder both exist, do not treat the support address as
live. A dead support contact on a published privacy policy is worse than the
Yahoo address it replaced.

### A2. OpenRouter API key — for the vision eval you asked for

The eval is written and ready; it could not run. The key lives only in Supabase
edge-function secrets, which cannot be read back, and it is not in the
environment, any `.env`, or the keychain. The agent stopped rather than expose
or invent anything, which was right.

To unblock, put it somewhere a shell can read without printing it — e.g. add
`export OPENROUTER_API_KEY=...` to your `~/.zshenv` — and tell me. I will not
ask you to paste it into this conversation and will never echo it.

What the eval will then do: run the **exact** production prompt and schema from
`_shared/tag-schema.ts` against the 9 garment photos in `assets/garments/`,
comparing `qwen/qwen3-vl-235b-a22b-instruct` with two frontier vision models,
graded attribute by attribute against what is actually in each picture, plus
latency and cost per 1000 tagged items against the ceilings in `_shared/plans.ts`.

Nine images is a smoke test, not a benchmark. It will catch a model that is
badly wrong. It will not resolve a close call.

### A3. App Store Connect

I have no ASC credentials in this session — no API key on disk, no fastlane
setup — so every step below is yours or the other agent's.

---

## B. The voice decision changed the critical path

Confirmed for v1, which means all four of these before submission:

1. **Deploy the `parse-closet` fix.** Commit `0c6e37b`. The live copy still
   crashes on every successful parse — it read `result.value` where
   `completeStructured` returns `result.parsed`, so the model working was the
   failure case. The repo copy typechecks under the same `deno check`
   invocation CI uses; so do the other twelve functions.
2. **Cut a build with `CINCH_VOICE_INTAKE=1`.** This writes
   `NSMicrophoneUsageDescription` and is a native change — it cannot ride an
   OTA. Build 24 does not have it.
3. **Walk the intake flow on the simulator.** Record → transcribe → parse →
   review → commit. None of it has been watched end to end since the crash was
   introduced, and the crash means the parse step has certainly never worked.
4. **Answer the App Privacy questionnaire for audio.** The policy already
   describes the recording and its 24-hour deletion; the questionnaire has to
   agree.

Also worth knowing before it bites: voice intake and photo tagging share the
same `tagging` quota bucket, and one walkthrough can return up to 120 garments
against a free tier of 60 a month. A chatty free user can spend their whole
month's tagging allowance in a single session and then find they cannot tag a
photo. That is a product decision, not a bug — `parse-closet/index.ts:158-166`
argues deliberately for not cutting the list off mid-parse.

---

## C. In App Store Connect

1. Attach the four subscriptions to the version (directive `db0f5d8`). Until
   this is done the paywall shows "Invalid Products" no matter how it looks in
   the editor. Confirm the prices match: Standard $7.99 / $59, Pro $14.99 /
   $119 — the review notes and `terms.html` now both quote them.
2. App-Specific Shared Secret.
3. Paste `docs/app-store/app-review-notes.md` (the block between the fences)
   into App Review Information → Notes. **Leave the demo-account username and
   password fields empty** — Cinch has no password, and a credential that
   cannot work is its own rejection. The notes send the reviewer to Sign in
   with Apple instead.
4. Screenshots, age rating, App Privacy answers.
5. Redeploy `web/` so the privacy and terms edits go live. The pages in the
   repo and the pages on cinchstyle.com currently differ.

---

## D. Verified clean, so you do not have to re-check

- Legal pages live and 200: `/`, `/privacy`, `/terms`, `/support`.
- Paywall 254200 satisfies 3.1.2 — Terms and Privacy both open
  `cinchstyle.com`, Restore wired to `restore`, buy wired to
  `purchase by-selected`, four products, monthly and annual.
- Account deletion is real, in-app, two taps, and deletes storage buckets
  before the auth user.
- Report and Block exist on comments, posted outfits and profiles; comments
  auto-hide after several distinct reports. `terms.html` now publishes that
  policy, which 1.2 asks for.
- **Zero `dev-*` routes ship.** The 205 design fixtures live in
  `src/dev-fixtures/`, outside the directory Expo Router registers, so the
  bundler never reaches them — 22,592 lines that used to be compiled into the
  production app are not in it. Previously this was a runtime mitigation only
  (`_layout.tsx:162` bounces any `dev-`-prefixed segment in release builds); that
  guard is kept as defence in depth and to catch a fixture reintroduced by
  accident, but it is now unreachable rather than load-bearing.
  `tests/dev-route-exclusion.test.ts` fails if any fixture returns to the router
  at any depth, and `node scripts/dev-fixtures.mjs on` mounts them for design
  review without them ever entering a build.
- No external purchase path, no ATT/IDFA, no unused permission.
- All sixteen edge functions typecheck.
- 1,842 tests: 1,841 pass, 1 skip (the fingerprint control, which is opt-in
  because it costs an `npm ci` per revision — see `tests/fingerprint-gate.test.ts`).

## E. Known and deliberately not fixed

- `garment-search` has no retry on a transient 429/5xx, unlike every sibling AI
  function. It is the most expensive call in the app, and a blip costs the user
  two quota units and a manual retry.
- Length limits on model prose (`reply`, `reasoning`, `headline`) are prompt
  instructions only — not `maxLength` in the schema, not sliced in code.
  `tag-schema.ts` is the only one that truncates. A model ignoring the
  instruction reaches the UI untouched.
- `ai_config.timeout_ms` and `ai_calls.attempts` are columns nothing reads or
  writes. The "swap without a deploy" lever they imply does not exist.
- The Exa web-search leg of `garment_search` sits outside the
  `data_collection: 'deny'` routing restriction, and Exa's terms claim a licence
  over query input. `garment-search/provider.ts:311-336` says so in its own
  comments. The privacy policy discloses it. It remains a real exposure.
