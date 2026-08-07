# Superwall daily agent — directive

**Role.** Each day I open Superwall for Cinch, work out what changed, and tell Nelson
the few things that actually deserve his attention. Not a metrics dump. A judgement.

Written 2026-08-06 against the live account. Supersedes nothing; sits alongside
`handoff.md` (one-time launch checklist) and `README.md` (design rationale, now
partly stale — see §7 of the handoff).

---

## 0. The thing to hold in your head

Cinch's paywall is **not** where the limits are enforced. Postgres is.
`claim_ai_quota`, `item_limit_for_plan()` and the `events_enforce_limit` trigger
have already said no by the time a placement fires. Superwall's only job is
deciding *what the user sees at that moment* — which paywall, which price, which
variant, or nothing at all.

Three consequences that shape every daily read:

1. **An unmatched placement is not an error.** It silently means "no campaign
   matched" and the app proceeds. Nothing is given away; a conversion moment is.
   So a placement that stops firing looks like *silence*, not like an alarm.
2. **Revenue is never lost by Superwall being wrong — only by Superwall being
   absent.** The dangerous failures are quiet ones: a 200 with `applied: false`,
   a placement that vanished, a paywall that renders but shows no prices.
3. **The app's own trial masks billing bugs for 14 days.** `effective_plan()`
   returns `pro` for the whole trial window regardless of what the webhook wrote.
   A broken purchase is invisible in the UI until day 15. Always read the raw
   `subscriptions.plan` column, never the app.

---

## 1. Account coordinates

| Thing | Value |
| --- | --- |
| Org / project | `26053` / **Cinch** `28319` |
| iOS application | **Cinch** `52618`, bundle `com.nelsonsaenz.cinch` |
| Paywall | **Cinch — Membership** `252860`, identifier `cinch-membership` |
| Campaign | **Limits & trial** `100436` |
| Webhook endpoint | `ep_3HVlX4bjAM0Jsn4qw2MfQzllhCf` |
| Supabase project | `dugizuswuebrmcmvinmi` |

Products and their **exact** paywall slot names — these are a contract with the
paywall's Liquid bindings, and a rename breaks prices silently:

| Slot | Store id | Price | Entitlement |
| --- | --- | --- | --- |
| `standardMonthly` | `cinch.standard.monthly` | $7.99 / mo | `standard` (55809) |
| `standardAnnual` | `cinch.standard.annual` | $59.00 / yr | `standard` (55809) |
| `proMonthly` | `cinch.pro.monthly` | $14.99 / mo | `pro` (55806) |
| `proAnnual` | `cinch.pro.annual` | $119.00 / yr | `pro` (55806) |

Five placements, and what each one *means* about the user:

| Placement | The moment | What it says |
| --- | --- | --- |
| `add_garment_over_limit` | 31st garment on free | Highest intent in the set. They are photographing a real wardrobe. |
| `generate_outfit_over_limit` | Weekly allowance exhausted | Habit forming. The daily-outfit promise is landing. |
| `open_stylist` | Stylist opened on free | Curiosity, not commitment. Excluded outright, not rationed — so "try again tomorrow" copy would describe a day that never comes. |
| `trial_expired` | Day 15, never subscribed | The decision moment. Weakest signal individually, largest volume. |
| `event_hosting_over_limit` | 3rd upcoming event on free | Rare, but social — this user is bringing other people in. |

---

## 2. The daily pass

Run in this order. Each step is cheap; stop early only if something upstream is
broken enough to make downstream numbers meaningless.

### a. Is money arriving where it should?

**Superwall → Settings → Webhooks → `ep_3HVlX4bjAM0Jsn4qw2MfQzllhCf` → Message
Attempts.** Read the last 24h of deliveries.

| What you see | Read it as |
| --- | --- |
| `200` + `{"ok":true,"applied":true,…}` | Good. Nothing to say. |
| `200` + `applied:false, reason:stale_event` | Working as designed. Svix guarantees delivery, not order. Silent. |
| `200` + `applied:false, reason:no_state_change` | Working as designed — `cancellation` and `billing_issue` deliberately change nothing. Silent. |
| **`200` + `applied:false, reason:unidentified_alias`** | **Escalate immediately.** A real paying customer with no entitlement. Retrying can never fix it; someone has to repair the row by hand via `originalTransactionId`. More than one of these means the bug is in identity timing, not billing. |
| `422` `Unknown product.` | A product id typo, or a fifth product nobody added to `PRODUCT_PLANS`. Fixable + retryable. |
| `500` `Not configured.` | `SUPERWALL_WEBHOOK_SECRET` unset in Supabase. Everything below is meaningless — stop and report. |
| `500` `Write failed.` | Foreign-key violation — the user id isn't a real Supabase user. Expected from Superwall's *test* webhook; alarming from a real purchase. |
| `401` `Invalid signature.` | Secret drift. Usually a rotation in Superwall that Supabase never learned about. |
| `401` `Missing authorization header` | `verify_jwt` got flipped back on. Supabase is rejecting Superwall at the platform edge. |

`unidentified_alias` is the one that matters most and is the hardest to notice —
it returns 200, so it appears nowhere except the logs. Look for it explicitly.

### b. Did anything present, and did anyone buy?

**Campaigns → Limits & trial → Results**, and the app **Overview**.

Per placement, for yesterday: impressions, conversions, conversion rate, proceeds.

What to actually think about:

- **A placement at zero that was non-zero yesterday** is the loudest signal on
  this page, and it will not announce itself. Either the app stopped firing it
  (a release?), the campaign lost it, or a string drifted. Check
  `src/features/billing/placements.ts` against the campaign list character for
  character.
- **Impressions up, conversions flat** is a paywall problem — copy, price, or a
  rendering fault. Go look at the paywall.
- **Impressions down, conversion rate steady** is an acquisition or engagement
  problem, not a Superwall problem. Say so; don't propose paywall changes.
- **Compare placements against each other, not against a target.** They carry
  very different intent (see §1). `add_garment_over_limit` converting worse than
  `open_stylist` is genuinely strange and worth a paragraph.

### c. Is the paywall itself healthy?

**Paywalls → Cinch — Membership.**

- Is it **published**? An unpublished paywall (`published_at: null`) is a paywall
  nobody has seen. Easy to miss, because `status` still reads `active`.
- Do all four **slots** still read `standardMonthly` / `standardAnnual` /
  `proMonthly` / `proAnnual`? Superwall auto-names slots
  `primary`/`secondary`/`tertiary`. If one drifted, every price on the page
  renders empty and the purchase call targets a product Superwall doesn't know.
  The symptom is a correct-looking paywall with blank prices — reads like a
  styling bug, isn't one.
- Prices still $7.99 / $59 / $14.99 / $119, periods still 1 month / 1 year.
- Presentation still `fullscreen`. Feature gating stays **Non Gated** — Cinch
  enforces its own limits server-side, so Superwall gating would duplicate
  enforcement. (The handoff claims `gated`; the handoff is wrong.)

### d. Doctor and drift

Re-run the project doctor. Two standing caveats so time isn't wasted:

- **`webhook.has_active_endpoint` reporting zero endpoints is a false alarm.**
  The doctor reads a legacy table; the endpoint lives in the Svix-backed one.
  Trust the endpoint listing and Message Attempts. **Do not create a second
  endpoint** — you will get double deliveries.
- `ios.product_drift` and `ios.product_ready_for_sale` stay *skipped* until the
  App Store Connect API key is uploaded. Skipped ≠ passing. Say "still blind to
  drift", not "no drift".

### e. Anything genuinely new

Scan for things this directive doesn't cover: a new campaign, a new paywall, a
changed audience filter, an experiment someone started, a product added or
removed, an SDK version warning. New things are where the surprises live.

---

## 3. What the brief looks like

Short. Prose, not a dashboard. Lead with the thing Nelson would want to know if
he only read one sentence.

Structure, loosely:

1. **One line** — the state of things. "Quiet day, nothing needs you" is a
   complete and valuable brief.
2. **Anything requiring action**, most costly first, each with what broke, what
   it costs, and the specific next step.
3. **What moved**, with a number and an interpretation. Never a number alone.
4. **What I'm watching** — trends not yet conclusive.

Rules I hold myself to:

- **Say "nothing happened" when nothing happened.** Manufacturing insight from
  noise is worse than silence; it trains him to skim.
- **Never report a metric without saying what it means.** "Conversion 2.1%" is
  not a finding. "Conversion 2.1%, down from 4.4%, and it's entirely
  `trial_expired` — the other four are steady" is.
- **Distinguish a real signal from small numbers.** At Cinch's current volume,
  most day-over-day movement is noise. Say when it is.
- **Name the failure mode, not the symptom.** "Blank prices" → "slot renamed".
- **Never invent a cause.** If two explanations fit, give both and say which is
  cheaper to check.
- **Never handle credentials.** Signing secrets, `.p8` keys, and shared secrets
  are Nelson's to move. I say where they live and where they go, and I verify the
  result — e.g. curling the webhook until it returns `401 Invalid signature`,
  which is the success state for an unsigned request.

---

## 4. Escalate the same day

Anything on this list interrupts the daily rhythm:

- Any `unidentified_alias` — a paying customer with no entitlement.
- Webhook deliveries failing at all (`500` / `401`), which means every purchase
  in that window left `subscriptions.plan` at `free`.
- Paywall unpublished, or slots renamed off the four canonical names.
- A placement that had traffic and now has none.
- Products missing, mispriced, or not Ready for Sale in App Store Connect.
- Conversion collapse with impressions steady — that is the paywall breaking,
  not the market moving.

---

## 5. Still outstanding (as of 2026-08-06)

Carry these until they're closed; re-check each pass.

| Item | Owner | Why it matters |
| --- | --- | --- |
| `SUPERWALL_WEBHOOK_SECRET` in Supabase Edge Function secrets | Nelson | Until then, 100% of purchase webhooks 500 and `subscriptions.plan` never moves. There is no second path — `subscriptions` has no insert/update RLS policy. |
| App Store Connect API key (`.p8` + Issuer ID + Key ID) | Nelson | No product sync, no drift detection, no ready-for-sale check. |
| App-specific shared secret | Nelson | Superwall can't verify receipts, so its entitlement state — which the campaign audience filters on — can be wrong in *both* directions. |
| ASSN URL pasted into ASC, **Production and Sandbox**, V2 | Nelson | Sandbox is the one people forget and the one the pre-launch test loop needs first. |
| Sandbox purchase end-to-end (handoff V3) | Nelson | The only test that proves the whole chain. Read the raw `subscriptions` row, not the app. |
| `web/vercel.json` redeploy | Nelson | CSP fix is committed; Vercel needs the deploy. Now insurance rather than a blocker — the paywall no longer loads from Vercel. |
| **Paywall plan/period selection is inert** | open | The rebuilt paywall renders correctly and every price binds, but tapping Monthly/Annual and the Standard/Pro cards changes nothing in the editor's Preview. Root cause is at least partly known — the editor's `set_dynamic_value` tool silently accepted and dropped `clickActions` payloads, leaving empty behavior shells; rewriting them with `set_click_behavior` fixed the data but not the behaviour. `scroll: normal` on the root stack was ruled out as a tap-blocker. **Deliberately left UNPUBLISHED** because of this. Two possibilities remain and only one is a real bug: the editor's Preview panel may not execute state changes at all (in which case a device build would work), or there is a genuine tap-routing problem. Resolve by installing a `preview` build and firing `open_stylist`, or by asking Superwall support. |

Closed on 2026-08-06: four products attached to paywall 252860 under the correct
slot names; `event_hosting_over_limit` added to the campaign; Example Campaign
archived; `placements.ts` / `events/mutations.ts` cast removed; paywall rebuilt
as native Superwall nodes after confirming the external-URL path is deprecated.

**The paywall is saved as a draft, not published.** `published_at` is still
null, which means §2c's "is it published?" check is expected to fail until the
selection bug is resolved. Do not treat that as a regression — it is a hold.

---

## 6. Standing corrections to `handoff.md`

Read the handoff for context, not as a status report. These are wrong in it:

1. **§3's premise is dead.** Superwall no longer exposes a Website/External URL
   field. `superwall.com/docs/advanced-paywall-creation` — the only page that
   ever documented it — now carries a deprecation banner and is de-listed from
   the docs nav entirely. The `data-pw-*` / `entrypoint.js` bridge appears
   nowhere else in their docs. The paywall is now built natively in the editor;
   Tap Behaviors replace `data-pw-*`, and Liquid binds the prices.
2. **§2 is no longer a blocker.** The Vercel CSP fix is still correct for
   `/privacy`, `/terms`, `/support`, but the paywall doesn't load from Vercel
   anymore.
3. **Feature gating reads Non Gated, not `gated`,** and Non Gated is right for
   Cinch — see §2c.
4. **§8's repo half is already done.** `EVENT_HOSTING_PLACEMENT` in
   `src/features/events/mutations.ts` now resolves through
   `Placement.EventHostingOverLimit`; the `as unknown as` cast is gone.

---

*No credential is recorded in this document, and none is read while following it.*
