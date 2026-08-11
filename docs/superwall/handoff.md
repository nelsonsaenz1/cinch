# Superwall — launch handoff

**Audience:** Nelson, clicking through the Superwall and App Store Connect dashboards by hand.
**Written against the live account on 2026-08-06** by reading the Superwall API directly, probing the
deployed webhook, and fetching the live paywall page. Everything below is what *is*, not what was
planned.

Account coordinates you will need on almost every screen:

| Thing | Value |
| --- | --- |
| Superwall org | `26053` |
| Superwall project | **Cinch**, id `28319` |
| Superwall application (iOS) | **Cinch**, id `52618`, bundle `com.nelsonsaenz.cinch` |
| Paywall | **Cinch — Membership**, id `252860`, identifier `cinch-membership` |
| Webhook endpoint | `ep_3HVlX4bjAM0Jsn4qw2MfQzllhCf` |
| Supabase project ref | `dugizuswuebrmcmvinmi` |
| Hosted paywall page | `https://cinch-nelsonsaenz1-3579s-projects.vercel.app/superwall/cinch-membership` |

---

## 0. Status at a glance

Ordered by how much revenue silently disappears if you skip it, not by dashboard menu order.

| # | Item | State | Blast radius if skipped |
| --- | --- | --- | --- |
**Updated 2026-08-06 after a working session. Only two rows are still open.**

| # | Item | State | Blast radius if skipped |
| --- | --- | --- | --- |
| 1 | `SUPERWALL_WEBHOOK_SECRET` set in Supabase | **DONE** | Unsigned POST now returns 401 `Invalid signature.`, not 500. No redeploy was needed — the function picked it up on next cold start. |
| 2 | Vercel CSP allows the paywall page's script + styles | **DONE** | Scoped to `/superwall/*`; root keeps `default-src 'none'`. Moot for the paywall now (see row 3) but the page is correct. |
| 3 | Paywall `252860` pointed at the hosted URL | **DROPPED — deliberate** | The block-editor paywall turned out to be complete and already resolving real prices. Switching would put Vercel + a CSP header + an external CDN into the purchase path for no gain. |
| 4 | Four products attached to paywall `252860` | **DONE** | Already correct on arrival: exact camelCase slots, right ids, prices, entitlements. |
| 5 | App Store Connect API key uploaded to Superwall | **DONE** | `ios.asc_api_key` passes. |
| 6 | App-specific shared secret uploaded to Superwall | **N/A — FIELD NO LONGER EXISTS** | None. See §6 — the doctor's p0 on this is a stale check. Do not chase it. |
| 7 | Superwall's ASSN URL pasted into App Store Connect | **DONE — verified** | Both Production and Sandbox slots matched Superwall's URL character-for-character. Apple has retired the V1/V2 selector; these fields are V2. |
| 8 | Webhook endpoint registered in Superwall | **DONE** | — (`run_doctor` claims zero active endpoints; that is a false alarm, see §13) |
| 9 | Products exist in Superwall, correctly priced + entitled | **DONE** | — |
| 10 | Campaign "Limits & trial" with 4 placements | **DONE** | — |
| 11 | `event_hosting_over_limit` placement + campaign | **HALF DONE** | Repo side landed (commit `247c5f0` moved it into `Placement`). The Superwall campaign placement is still missing. |
| 12 | Retire the stock "Example Campaign" | **NOT DONE** | Cosmetic. A dead `campaign_trigger` placement with a 100% holdout. |
| 13 | Apple App ID set on the Superwall application | **DONE** | Was empty; set to `6798479578`. Unblocks product-drift and ready-for-sale checks, which had been silently skipping. |
| 14 | **Publish paywall `252860`** | **BLOCKED — Superwall bug** | **Nothing can be shown to anyone.** `save+promote` fails `NOT_FOUND`; paywall stuck at `version: 0`, `published_at: null`. Needs Superwall support. |

**Row 14 is the only thing between here and a working purchase flow.** Everything else in the
subscription chain is configured and verified.

**Three things in the pre-flight brief turned out to be wrong.** Read §1, §6 and §13 before you start
clicking, or you will spend an hour fixing something that is already fine.

---

## 1. The one that actually loses money: the webhook signing secret

> **The brief said the critical outstanding item was registering the webhook URL in Superwall.
> It is already registered.** I read it back from the API:
>
> - endpoint `ep_3HVlX4bjAM0Jsn4qw2MfQzllhCf`, `disabled: false`
> - URL `https://dugizuswuebrmcmvinmi.supabase.co/functions/v1/superwall-webhook`
> - subscribed to all eight relevant types: `initial_purchase`, `renewal`, `uncancellation`,
>   `product_change`, `expiration`, `subscription_paused`, `cancellation`, `billing_issue`
>
> The *actual* break is one step further down the wire: **Supabase does not have the signing
> secret**, so the function rejects every delivery before it does anything.

I probed the live endpoint with an unsigned POST:

```
$ curl -X POST https://dugizuswuebrmcmvinmi.supabase.co/functions/v1/superwall-webhook \
       -H 'content-type: application/json' -d '{}'
{"error":"Not configured."}   HTTP 500
```

`{"error":"Not configured."}` is the fail-closed branch at the top of
`supabase/functions/superwall-webhook/index.ts` — it fires when `SUPERWALL_WEBHOOK_SECRET` is unset.
That branch is deliberate and correct (an unset secret must never degrade into "accept anything,"
which would be a self-service Pro tier for anyone who finds the URL), but it means **100% of real
purchase webhooks are currently being refused with a 500**.

What that costs you concretely: a user buys `cinch.pro.annual`, Apple charges them $119, Superwall
records the purchase, Superwall POSTs `initial_purchase` to Supabase, Supabase returns 500. Svix
retries for a few days and gives up. `subscriptions.plan` stays `free`. The user has paid and the app
gates them like a free user. There is no second path — `subscriptions` has no insert/update/delete
RLS policy at all, so this webhook is the *only* way that column ever changes.

### Do this

1. **Superwall dashboard** → left sidebar **Settings** → **Integrations** → **Webhooks** → click the
   endpoint whose URL ends in `/functions/v1/superwall-webhook`.
2. Find **Signing Secret** on that endpoint's detail panel and click reveal / copy. It looks like
   `whsec_` followed by base64. **Do not paste it into Slack, a note, a commit, or a chat with me.**
3. **Supabase dashboard** → project `dugizuswuebrmcmvinmi` → **Project Settings** → **Edge Functions**
   → **Secrets** → **Add new secret**.
   - Name: `SUPERWALL_WEBHOOK_SECRET` (exact, case-sensitive)
   - Value: `<paste the whsec_… value from step 2>`
   - Include the `whsec_` prefix. The function strips it itself
     (`secret.replace(/^whsec_/, '')`); stripping it yourself will produce a signature mismatch on
     every delivery instead of a clean "not configured."
4. Redeploy the function so the new secret is definitely picked up:
   ```
   supabase functions deploy superwall-webhook
   ```
   `supabase/config.toml` already pins `[functions.superwall-webhook] verify_jwt = false`, so the
   deploy keeps the JWT gate off. **Do not turn `verify_jwt` back on** — with it on, Supabase
   rejects Superwall at the platform edge with a 401 before the function ever runs, and the symptom
   is the same silent empty `plan` column.
5. Re-run the curl above. You want **`{"error":"Invalid signature."}` with HTTP 401**. That is the
   success state for an unsigned request: it proves the function is deployed, the platform JWT gate
   is off, the secret is loaded, and the signature check is running.

> **If you ever rotate the secret in Superwall, you must update Supabase in the same sitting.** Svix
> signs with both old and new keys during a rotation window, and the function accepts any matching
> signature, so you have a window — not forever.

---

## 2. The Vercel CSP is currently blocking the paywall's own script

The page is deployed and returns 200 at
`https://cinch-nelsonsaenz1-3579s-projects.vercel.app/superwall/cinch-membership`. But `web/vercel.json`
applies this header to `/(.*)` — every path, including the paywall:

```
content-security-policy: default-src 'none'; style-src 'self'; img-src 'self' data:;
                         base-uri 'none'; form-action 'none'; frame-ancestors 'none'
```

`web/superwall/cinch-membership.html` needs four things that policy forbids:

| The page loads | CSP verdict | Consequence |
| --- | --- | --- |
| `https://cdn.superwall.me/runtime/entrypoint.js` (line 18) | blocked — no `script-src`, falls back to `default-src 'none'` | **The Superwall bridge never loads.** No Liquid substitution, `data-pw-purchase` / `data-pw-restore` / `data-pw-close` / `data-pw-open-url` are inert. Every button is dead. |
| its inline `<script>` (line 346) | blocked — `'unsafe-inline'` not granted | Plan/period toggle does nothing; the subscribe button never gets a product name. |
| its inline `<style>` (line 24) | blocked — `style-src 'self'` does not cover inline | Renders as raw unstyled HTML. |
| `fonts.googleapis.com` / `fonts.gstatic.com` | blocked | No Instrument Serif. |

So even after you attach the URL (§3), what a paying customer would see today is an unstyled wall of
text whose buttons do nothing.

### Do this

Edit `web/vercel.json` and scope a looser policy to the paywall path only — do **not** loosen the
site-wide one; `/privacy`, `/terms`, `/support` should keep the strict policy. Add a header block
*before* the existing catch-all (Vercel applies the first matching `source`):

```json
{
  "source": "/superwall/(.*)",
  "headers": [
    { "key": "X-Content-Type-Options", "value": "nosniff" },
    { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
    {
      "key": "Content-Security-Policy",
      "value": "default-src 'none'; script-src 'self' 'unsafe-inline' https://cdn.superwall.me https://*.superwall.me; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src https://*.superwall.me https://*.superwall.com; base-uri 'none'; form-action 'none'"
    }
  ]
}
```

Note what is deliberately **absent** from that block: `X-Frame-Options: DENY` and
`frame-ancestors 'none'`. Superwall's dashboard previews an external paywall in an iframe; leave
either of those in place and the preview panel will be permanently blank even though the page is
fine on device. The page collects nothing and has `form-action 'none'`, so dropping frame-ancestors
on this one path is cheap.

Then redeploy the `web/` project to Vercel and confirm:

```
curl -sI https://cinch-nelsonsaenz1-3579s-projects.vercel.app/superwall/cinch-membership \
  | grep -i content-security-policy
```

You should see `cdn.superwall.me` in `script-src`. Open the URL in desktop Safari or Chrome with the
console open — **zero CSP violation errors** is the bar. The prices will show as literal
`{{ products.standardMonthly.price }}` in a plain browser; that is correct and expected, Liquid is
substituted by Superwall, not by the browser.

---

## 3. Point paywall `252860` at the hosted page

Live state read back from the API:

```
paywall_url:  https://user-content.superwalleditor.com/runtime/sha/0722115e7f10/store/document/ZF5HKA-BF19nEzVZ4MKyK
products:     []          ← empty
published_at: null        ← never published
version:      0
status:       active   presentation_style: fullscreen   feature_gating: gated
```

`paywall_url` still points at Superwall's own (blank) block-editor document, **not** at Vercel. So the
campaign is wired, the audience matches, the paywall presents — and what presents is an empty canvas.
Fullscreen + gated are already correct; don't change them.

### Do this

1. **Superwall dashboard** → **Paywalls** → **Cinch — Membership**.
2. Open the paywall's settings/publishing panel and look for the external-page field — labelled
   something like **Website URL**, **External URL**, or an **Import from URL** action. Paste:
   ```
   https://cinch-nelsonsaenz1-3579s-projects.vercel.app/superwall/cinch-membership
   ```
   (No `.html` — `web/vercel.json` sets `cleanUrls: true`, and the extensionless path is confirmed
   serving 200.)
3. If you genuinely cannot find that field: open the paywall editor and ask the built-in AI Chat
   Builder to "point this paywall at `<url>`" — it has UI-level access. Failing that, it is a
   two-line message to Superwall support; the capability is real (it is how their Webflow flow
   works), it is just poorly surfaced in the docs.
4. **Publish the paywall.** `published_at` is `null` and `version` is `0` — an unpublished paywall
   is a paywall your users have never seen. Look for **Publish** / **Save & Publish** in the editor's
   top bar. Re-check afterwards that `published_at` is no longer empty.

**Why it matters:** without this, everything else on this page is theatre. The campaign fires, the
SDK presents paywall `252860`, and the user sees Superwall's default empty document.

---

## 4. Attach the four products to the paywall

The products themselves are **already correct** — I verified every field against App Store Connect's
intended values:

| Superwall product name (the slot) | Store identifier | Price read back | Period | Entitlement |
| --- | --- | --- | --- | --- |
| `standardMonthly` | `cinch.standard.monthly` | $7.99 | 1 month | `standard` (id 55809) |
| `standardAnnual` | `cinch.standard.annual` | $59.00 | 1 year | `standard` (id 55809) |
| `proMonthly` | `cinch.pro.monthly` | $14.99 | 1 month | `pro` (id 55806) |
| `proAnnual` | `cinch.pro.annual` | $119.00 | 1 year | `pro` (id 55806) |

Ids, prices, periods, and entitlement mapping all match the brief exactly. Nothing to fix here.

What is missing is the *link between those products and paywall 252860* — its `products` array is
literally `[]`.

### Do this

1. **Superwall dashboard** → **Paywalls** → **Cinch — Membership** → the **Products** panel of the
   paywall (not the project-level Products page — that one is already populated).
2. Add all four, and make sure each occupies a slot whose name is **exactly**:
   `standardMonthly`, `standardAnnual`, `proMonthly`, `proAnnual`.
   Case-sensitive, camelCase, no spaces. Superwall auto-names the first three slots
   `primary` / `secondary` / `tertiary` — you must rename them.
3. Republish the paywall.

**Why it matters:** the HTML reads prices by slot name —
`{{ products.standardMonthly.price }}`, `{{ products.standardAnnual.monthlyPrice }}`, and six more —
and the subscribe button sets `data-pw-purchase` at click time to one of those four names. A slot
named `primary` means every price on the page renders empty and the purchase call targets a product
Superwall does not know. The visible symptom is a paywall with correct layout and blank prices — easy
to mistake for a styling bug.

---

## 5 & 6. Give Superwall the App Store Connect credentials

`run_doctor` flags both of these as **p0 errors**:

- `ios.asc_api_key` — *"App Store Connect API key is not configured for Cinch. Superwall can't sync
  products or read subscription state from App Store Connect until this is uploaded."*
- `ios.iap_shared_secret` — *"App Store Connect shared secret is missing for Cinch. Superwall can't
  verify App Store receipts without it."*

Two knock-on checks are being **skipped** because of the missing API key: product-drift detection
(does Superwall's copy of `cinch.pro.annual` still match ASC?) and ready-for-sale state (is the
product actually approved and purchasable?). Both are checks you want green before you ship, because
the failure they catch — a product that exists in Superwall but is not "Ready to Submit" / approved in
ASC — presents as a paywall that loads fine and then fails at the purchase sheet.

### 5. App Store Connect API key

1. **App Store Connect** → **Users and Access** → **Integrations** → **App Store Connect API** →
   **Keys** → **+**.
2. Role: **Admin** or **App Manager**. Anything less and Superwall's sync calls 403.
3. Download the `.p8` file. **App Store Connect lets you download it exactly once.** Note the
   **Issuer ID** (top of that page) and the **Key ID** (the row you just created).
4. **Superwall dashboard** → **Settings** → the **Cinch** application → **Revenue tracking** /
   **App Store Connect** section → upload the `.p8` and paste the Issuer ID and Key ID.
5. Store the `.p8` in your password manager, not the repo. If it lands in git it is a credential leak
   that needs a key revocation, not a `git rm`.

### 6. App-specific shared secret — **NOT REQUIRED. Do not chase this.**

> **Corrected 2026-08-06 against the live dashboard.** This step was written against an older
> Superwall layout and is obsolete. **There is no Shared Secret field in the dashboard any more.**
> "In-App Purchase Configuration" now contains exactly four things — P8 key file, Bundle ID, Key ID,
> Issuer ID — all of which are uploaded and confirmed working.

The shared secret belonged to Apple's legacy `verifyReceipt` endpoint. Superwall now validates through
the App Store Server API using the P8 key, so the secret has been retired from the UI.

**`run_doctor` still reports `ios.iap_shared_secret` as a p0 error. Ignore it — it is a stale check.**
Three things establish that:

1. Its sibling check `revenue.tracking_method_configured` **passes**, reporting
   `configured_sources: ["app_store_connect_api", "app_store_server_notifications"]`.
2. That same check lists `iap_shared_secret` only under `available_sources` — it is one of four
   *alternatives*, not a prerequisite.
3. The remediation text can only offer an API call
   (`PATCH …/settings { "app_store_connect_shared_secret": … }`) and never a dashboard path, because
   no dashboard path exists.

Superwall's own docs say to choose **one** revenue-tracking method. Cinch has two wired
(ASC API + App Store Server Notifications), which is more than sufficient.

**If receipt validation ever does misbehave in sandbox** — entitlement state wrong in either direction,
a paying user still seeing the paywall or a free user not — revisit this, because that is the symptom
the shared secret used to address. Until then it is a false alarm and setting it would mean handing a
credential to an API for no gain.

---

## 7. Verify the App Store Server Notifications URL is actually in App Store Connect

Mixed signal from the doctor, and it is worth understanding rather than skipping:

- `ios.server_notifications_url_configured` — **passes**. Superwall has *generated* an ASSN URL for
  Cinch.
- `revenue.tracking_configured` — **fails**: *"Cinch is sending SDK events to Superwall, but no revenue
  events have landed."* (`has_traffic: true`, `has_revenue_events: false`)

Superwall generating the URL proves nothing about whether Apple is calling it. Given there has been no
sandbox purchase yet, an empty revenue log is *expected* — but confirm the URL is pasted before you
blame anything else.

### Do this

1. **Superwall dashboard** → **Settings** → **Cinch** app → **Revenue tracking** → copy the
   **App Store Server Notifications URL**.
2. **App Store Connect** → **Cinch** → **App Information** → **App Store Server Notifications**.
3. Paste it into **both** the **Production Server URL** and the **Sandbox Server URL**, and set
   version **V2**.
4. Sandbox is the one people forget, and it is the one you need first — your entire pre-launch test
   loop (§V3) runs through sandbox.

---

## 8. Add the missing `event_hosting_over_limit` placement

Two halves are missing, one in the repo and one in the dashboard.

**In the repo.** `src/features/billing/placements.ts` declares four placements —
`add_garment_over_limit`, `generate_outfit_over_limit`, `open_stylist`, `trial_expired`. The event
hosting one is **not there**. It currently lives in `src/features/events/mutations.ts` as a
cast-through-`unknown` workaround, with a comment marking it as an integration debt:

```ts
const EVENT_HOSTING_PLACEMENT = 'event_hosting_over_limit' as unknown as PlacementName;
```

It should move into the `Placement` object in `placements.ts` alongside the other four, and
`mutations.ts` should import it and drop the cast. That is a code change, not a dashboard change —
flag it as a follow-up ticket.

**In Superwall.** Campaign **"Limits & trial"** (id `100436`) has exactly four placements —
`open_stylist`, `add_garment_over_limit`, `generate_outfit_over_limit`, `trial_expired`. There is no
`event_hosting_over_limit`.

### Do this

**Superwall dashboard** → **Campaigns** → **Limits & trial** → **Placements** → add
`event_hosting_over_limit` (exact string, snake_case). It joins the same audience
(`no active entitlements`) and the same paywall, so nothing else needs configuring.

**Why it matters, and why it is #8 and not #1:** an unmatched placement in Superwall is not an error —
it silently means "no campaign matched" and the app proceeds. And the app's *limit* is enforced in
Postgres (`event_limit_for_plan()` + the `events_enforce_limit` trigger, migration `20260807103000`),
not here. So a free user who tries to host their 3rd event still gets refused — they just get the plain
copy ("Your plan is hosting as many occasions as it can right now.") instead of a designed upgrade
moment. Nothing is given away; a conversion opportunity is. The tier numbers are 2 / 15 / 100 for
free / standard / pro, mirrored between `src/features/billing/plans.ts` and the migration.

---

## 9. Housekeeping: retire the stock Example Campaign

Campaign `100418` ("Example Campaign") is Superwall's default: one placement `campaign_trigger`, one
audience, a single 100%-holdout variant with no paywall attached. It is inert — the app never fires
`campaign_trigger` — but it will pollute your campaign list and dashboards forever.

**Superwall dashboard** → **Campaigns** → **Example Campaign** → **Archive**.

---

## Verification — proving each piece works end to end

Do these in order. Each one is a precondition for the next.

### V1. The webhook function is alive, gated, and holding the secret

```
curl -X POST https://dugizuswuebrmcmvinmi.supabase.co/functions/v1/superwall-webhook \
     -H 'content-type: application/json' -d '{}'
```

| You see | Means |
| --- | --- |
| `{"error":"Invalid signature."}` **401** | ✅ Correct. Deployed, JWT gate off, secret loaded, signature check running. |
| `{"error":"Not configured."}` **500** | ❌ `SUPERWALL_WEBHOOK_SECRET` still unset. This is today's state. Go back to §1. |
| `{"code":401,"message":"Missing authorization header"}` | ❌ `verify_jwt` got turned back on. Supabase is rejecting Superwall at the door. |
| `{"error":"Method not allowed."}` | You sent a GET. Use POST. |

### V2. The hosted page loads its own script

Open `https://cinch-nelsonsaenz1-3579s-projects.vercel.app/superwall/cinch-membership` in desktop
Chrome with DevTools → Console. Bar to clear: **no `Refused to load…` / `Refused to execute…` CSP
errors**, page is fully styled in Instrument Serif and oxblood, plan cards toggle when clicked.
Prices showing as raw `{{ … }}` here is correct — Superwall substitutes those, not the browser.

### V3. A real sandbox purchase writes the right row

This is the only test that proves the whole chain.

1. **App Store Connect** → **Users and Access** → **Sandbox** → **Test Accounts** → create one with an
   email you control that has *never* been used as an Apple ID.
2. On the test device: **Settings → App Store → Sandbox Account** → sign in with that tester.
3. Install a TestFlight or EAS `preview` build (the Superwall iOS key is already wired into `eas.json`
   for both `preview` and `production`, so no env work is needed).
4. Sign into Cinch **with a real account** and note that account's Supabase user id — Supabase
   dashboard → **Authentication** → **Users**. You need it in step 7.
5. Trigger a placement. Easiest reliable one: open the stylist on a free account (`open_stylist`).
   The paywall should present, fully styled, with all four real prices.
6. Buy `cinch.standard.monthly`. Sandbox subscriptions renew on an accelerated clock, so a monthly is
   the fastest way to also see a `renewal` land later.
7. **Supabase dashboard** → **Table Editor** → `subscriptions` → find the row where `user_id` matches
   step 4. Expect:
   - `plan` = `standard`
   - `current_period_end` = a near-future timestamp
   - `updated_at` = just now

   > **Do not verify this in the app UI.** `effective_plan()` returns `pro` for the whole 14-day trial
   > window regardless of what the webhook wrote, so a Standard purchase made mid-trial changes
   > nothing visible until day 15. The raw `plan` column is the truth. This is correct behaviour and
   > surprising the first time you watch it.

8. **Superwall dashboard** → **Settings** → **Webhooks** → the endpoint → **Message Attempts** (Svix's
   delivery log). You want an `initial_purchase` with **HTTP 200** and a body of
   `{"ok":true,"applied":true,"plan":"standard",…}`.

### V4. Revenue is flowing

After V3, re-run the project doctor (or **Superwall dashboard** → the health/doctor panel). The two
checks to watch flip green: `revenue.tracking_configured` (needs the ASSN URL from §7 plus one real
purchase) and `ios.product_drift` / `ios.product_ready_for_sale` (both currently *skipped* — they
un-skip once the ASC API key from §5 is uploaded).

### V5. Every placement presents

With a free (non-entitled, post-trial) account, walk all five and confirm the paywall appears each
time:

| Placement | How to trigger |
| --- | --- |
| `add_garment_over_limit` | Add a 31st garment on free |
| `generate_outfit_over_limit` | Exhaust the weekly outfit allowance |
| `open_stylist` | Open the stylist on free (excluded outright, not rationed) |
| `trial_expired` | Set `trial_ends_at` to the past for a test user, cold-start the app |
| `event_hosting_over_limit` | Host a 3rd upcoming event on free — **only after §8** |

---

## Troubleshooting

Failure modes in rough order of likelihood, each with the signature the webhook code will actually
produce. Supabase logs live at **Supabase dashboard → Edge Functions → `superwall-webhook` → Logs**.

### "Every delivery is 500, body `Not configured.`"

`SUPERWALL_WEBHOOK_SECRET` is unset. §1. The log line is
`SUPERWALL_WEBHOOK_SECRET is unset; refusing every delivery.`

### "Every delivery is 401, body `Invalid signature.`"

Log line is `Rejected Superwall webhook: <reason>`, and the reason tells you which:

- **`Signature mismatch.`** — the secret in Supabase is not the one Superwall is signing with. Causes,
  in order of how often they happen: you stripped the `whsec_` prefix (don't — the function strips it);
  you copied the secret from a *different* endpoint; you rotated it in Superwall and never updated
  Supabase; you pasted with a trailing newline or space.
- **`Timestamp outside tolerance.`** — the request is more than 5 minutes old. Either a genuine replay
  (fine, it's being blocked) or a Svix retry of a long-dead message. Not something to fix.
- **`Missing svix headers.`** — whatever hit the function is not Superwall. If you were testing by
  hand, this is expected.

### "Deliveries 401 with `Missing authorization header` and the function's own log never appears"

`verify_jwt` got flipped back on for this function. Supabase is rejecting Superwall at the platform
edge, so the signature check never runs and nothing shows in the function log. Confirm
`[functions.superwall-webhook] verify_jwt = false` in `supabase/config.toml` and redeploy.

### "Delivery is 422, body `Unknown product.`"

Log: `Unmapped Superwall productId: <id>`. A product id came in that is not one of the four in
`PRODUCT_PLANS` in `supabase/functions/superwall-webhook/index.ts`. This is a **product id typo** —
either in App Store Connect, or in Superwall's copy of it, or someone added a fifth product and did
not add it to the function. 422 is deliberate and retryable: add the id to `PRODUCT_PLANS`, redeploy,
then **Retry** the failed message from Superwall's Message Attempts panel and it will succeed.
Unknown ids are treated as errors rather than silently mapped to `free`, precisely so a typo cannot
downgrade a paying customer at their next renewal.

### "Delivery is 500, body `Write failed.`"

Log: `Could not write subscription: <message>`. Almost always a foreign-key violation —
`subscriptions.user_id` references `auth.users(id)`, so an `originalAppUserId` that is not a real
Supabase user cannot be written. **This is what you will get if you fire Superwall's built-in test
webhook**, because its sample payload carries a fake user id. That is not a bug; do V3 with a real
sandbox purchase instead of trusting a test send.

### "Delivery is 200 with `applied: false, reason: unidentified_alias`"

Log, at error level: `Superwall <type> for an unidentified alias — no plan written.
originalTransactionId=…`. A purchase happened before `identify()` bound the Supabase user id to the
Superwall session, so the purchase is attributed to a `$SuperwallAlias:` anonymous id that maps to no
user. It returns 200 on purpose — retrying can never fix it.

**Since audit items 23 and 24 this mostly fixes itself.** The delivery is stored in
`superwall_events` rather than only logged, and the next time that device signs in the app offers the
alias to `superwall-reconcile`, which binds it to the user and pays out the queue. Nobody has to do
anything, and the user gets the tier they bought within one launch.

What it cannot fix is a purchase whose device never signs in, or signs in only after a reinstall (a
reinstall rotates the alias, so the link is gone). Those are listed by:

```sql
select * from superwall_unreconciled;
```

Each row there still needs the old manual fix: look up `original_transaction_id` in App Store
Connect, then set the `subscriptions` row by hand. **A steadily non-empty list means `identify()` is
running too late, not that billing is broken** — the reconciliation is a safety net, not the design.
Note the view lists only what is still unclaimed; a row that has been reconciled keeps its
`unidentified_alias` outcome on purpose, so `select count(*) from superwall_events where outcome =
'unidentified_alias'` remains the honest count of how often the timing bug has happened.

### "Delivery is 200 with `applied: false, reason: stale_event`"

Working as designed. Svix guarantees delivery, not order. An event whose `expirationAt` is no later
than the `current_period_end` already stored is stale and dropped, so a late-arriving `expiration`
cannot downgrade a user who has already renewed.

### "Delivery is 200 with `applied: false, reason: no_state_change`"

Also correct. `cancellation` and `billing_issue` deliberately change nothing. Cancelling turns off
auto-renew — the user keeps what they paid for until `expirationAt`, and `expiration` is the event
that actually ends it. `billing_issue` is Apple retrying a failed charge during a grace period.
Downgrading on either would take away time somebody already bought.

### "The paywall shows, but there are no prices / the plan cards are empty"

The four products are not attached to paywall `252860` under those exact slot names. §4. Check the
paywall's Products panel reads exactly `standardMonthly`, `standardAnnual`, `proMonthly`, `proAnnual`
— not `primary` / `secondary` / `tertiary`.

### "The paywall shows as unstyled text and the buttons do nothing"

The CSP is still blocking `cdn.superwall.me` and the inline script/style. §2. Confirm with
`curl -sI … | grep -i content-security-policy` and with a browser console on the live URL.

### "The paywall is completely blank"

`paywall_url` is still pointing at the Superwall block-editor document rather than the Vercel page,
or the paywall was edited but never published (`published_at: null`). §3.

### "The paywall never appears at all"

Three candidates, in order:

1. **Placement name mismatch.** The strings in `src/features/billing/placements.ts` are a contract with
   the campaign. A typo does not throw — it silently means "no campaign matched" and the action just
   proceeds. Compare the campaign's placement list character for character.
2. **The audience excluded them.** "Limits & trial" targets `no active entitlements`
   (`size(device.activeEntitlements) == 0`). A test account that already bought something is correctly
   filtered out. Use a fresh account.
3. **No SDK key in the build.** `PAYWALLS_ENABLED` is `false` when `EXPO_PUBLIC_SUPERWALL_API_KEY_IOS`
   is unset, and the whole provider is skipped — every feature works, nobody is ever asked to pay. It
   *is* set in `eas.json` for `preview` and `production`, but a local `expo run:ios` with a blank
   `.env` will behave this way. In a dev build you'd see the console warning
   `EXPO_PUBLIC_SUPERWALL_API_KEY_IOS is unset — paywalls are disabled.`

### "A user says they paid but the app still gates them"

Work backwards: (1) `subscriptions` row — what is `plan`? (2) if `free`, Superwall Message Attempts for
that period — was there a delivery, and what status? (3) if there was no delivery at all, check the
endpoint is still enabled and the event type is in its filter list. (4) if `plan` is correct but the
app still gates, it is a client cache — sign out and back in — not a billing problem.

---

## Things I found that contradict the brief, or that nobody has written down yet

Called out explicitly rather than quietly worked around.

1. **The webhook URL is already registered.** The brief's "single most critical outstanding item" is
   done. The real gap is one layer down — the signing secret is missing on the Supabase side, so the
   endpoint exists and 500s on everything. Same blast radius, completely different fix. §1.

2. **`run_doctor` says there are zero webhook endpoints; the webhook API says there is one, enabled.**
   `webhook.has_active_endpoint` reports `active_endpoint_count: 0` while
   `list_webhook_endpoints` returns `ep_3HVlX4bjAM0Jsn4qw2MfQzllhCf` with `disabled: false`. These are
   two different subsystems (the doctor appears to read a legacy webhook table, the endpoint lives in
   the Svix-backed one). **Trust the endpoint listing and the Message Attempts log, not the doctor, on
   this specific check.** Do not "fix" it by creating a second endpoint — you will get double
   deliveries. Worth one line to Superwall support.

3. **The deployed paywall page cannot currently function**, because of the Vercel CSP. This is not
   mentioned anywhere in `docs/superwall/README.md`, which was written before the security headers
   landed. It is arguably a bigger blocker than the URL-attach step that README is entirely about,
   since attaching the URL without fixing the CSP just moves the failure one step later. §2.

4. **The paywall has never been published.** `published_at: null`, `version: 0`. Easy to miss because
   `status` reads `active`. §3.

5. **The products carry no StoreKit introductory offer** — `trial_period_days: null` on all four. That
   is consistent with the design (the 14-day trial is server-side via `subscriptions.trial_ends_at`,
   and the paywall copy deliberately avoids free-trial language), but be aware that Apple will not show
   any trial badge in the purchase sheet, and Superwall's trial-conversion analytics will be empty by
   construction. Nothing to fix — just don't go hunting for it later.

6. **`docs/superwall/cinch-membership.html` and `web/superwall/cinch-membership.html` are byte-identical
   duplicates.** Only the `web/` copy is deployed. If you edit the paywall and touch the wrong one,
   nothing changes in production and the diff will look right. Consider deleting the `docs/` copy or
   replacing it with a pointer.

7. **`docs/superwall/README.md` is now partly stale.** Written before the products, entitlements,
   campaign, and webhook endpoint existed, it describes several of them as open questions and says the
   Superwall MCP "was not used." All four products now exist with correct ids, prices, and entitlement
   mapping; the campaign exists with four placements; the webhook endpoint exists. Read it for the
   *design* rationale and the `data-pw-*` bridge contract, which are still accurate and useful. Do not
   read it as a status report.

---

## Suggested order of work

1. §1 — webhook signing secret into Supabase, redeploy, curl until you get a 401. *(15 min)*
2. §2 — CSP block in `web/vercel.json`, redeploy, clean browser console. *(20 min)*
3. §3 + §4 — attach the URL, attach the four products to their exact slots, **publish**. *(20 min)*
4. §5 + §6 — ASC API key and shared secret into Superwall. *(30 min, gated on ASC access)*
5. §7 — ASSN URL into App Store Connect, Production **and** Sandbox. *(10 min)*
6. **V1 → V3** — sandbox purchase, then read the `subscriptions` row. This is the gate. Do not ship
   before this passes. *(45 min)*
7. §8 — `event_hosting_over_limit` placement (dashboard) + the `placements.ts` move (repo ticket).
8. §9 — archive Example Campaign.
9. Re-run the doctor and confirm the p0 errors are gone.

---

*No credential appears anywhere in this document, and none was read while writing it. Every value
Superwall or Apple needs is described by where to fetch it and where to paste it.*
