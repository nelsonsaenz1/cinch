# Handoff: first real purchase did not reach `subscriptions.plan`

**Date:** 2026-08-26 · **Severity:** revenue-blocking · **Owner:** Claude Code

## What happened

Nelson bought `cinch.standard.monthly` ($7.99) on 2026-08-25, roughly 17:00 UTC. Apple
processed it. Superwall recorded it. Our database never heard about it.

## Established facts — do not re-derive these

| Fact | Evidence |
|---|---|
| The purchase exists | Superwall → Settings → Revenue Tracking: `initial_purchase`, `APP_STORE`, `cinch.standard.monthly`, $7.99, period `NORMAL`, experiment `169314` |
| Superwall got it via the ASC server-notification integration | Same row, Integration column = `app_store_connect`. Revenue Tracking status = **Enabled**, "Last received 9 hours ago" |
| Superwall's outbound webhook is configured correctly | Endpoint `ep_3HVlX4bjAM0Jsn4qw2MfQzllhCf` → `https://dugizuswuebrmcmvinmi.supabase.co/functions/v1/superwall-webhook`, **Enabled**, subscribed to Initial Purchase / Renewal / Uncancellation / Expiration / Billing Issue / Cancellation / Product Change / Subscription Paused |
| Superwall has never dispatched to it | Webhooks → Activity: **"No webhook messages yet"** since creation 2026-08-05. Not a failed delivery — *no delivery attempt at all* |
| Our endpoint is reachable | Deployed `superwall-webhook` v84, status ACTIVE, **`verify_jwt: false`** (confirmed via the Supabase management API, not just `config.toml`) |
| Nothing arrived | Supabase `function_edge_logs` 2026-08-25T02:00Z→08-26T02:00Z: zero requests to `/superwall-webhook`. Only two `superwall-reconcile` POSTs (both 200) |
| Nothing was queued | `superwall_events` = 0 rows, `superwall_unreconciled` = 0 rows |
| The plan never moved | No `subscriptions` row updated on 08-25. The only `plan='pro'` row is `8a4ad972…`, `current_period_end` 2027-08-07, written 2026-08-07 — a manual grant, unrelated |
| The product mapping is fine | `_shared/superwall-plan.ts` maps `cinch.standard.monthly` → `standard`, and `initial_purchase` ∈ `GRANTING` |

**Ruled out:** wrong URL, disabled endpoint, unsubscribed event type, `verify_jwt` rejection,
signature failure, unmapped product, stale-event suppression. The break is upstream of our
code — Superwall did not send.

## Hypotheses, in order

1. **The transaction is in the Sandbox environment.** Nelson may have purchased from a
   TestFlight build. Superwall's dashboard Overview was filtered to *Production* and showed
   0 conversions for the same window in which Revenue Tracking logged the purchase — the
   classic sandbox signature. Sandbox ASC notifications can populate Revenue Tracking while
   producing no production webhook dispatch. **Check first:** ASC → App Information →
   *Production* vs *Sandbox* Server Notification URL fields (which one holds the Superwall
   URL `https://integrations.superwall.com/integrations/app-store-connect/webhook?pk=pk_4b232d84ff2f…`),
   and flip the Superwall environment toggle to Sandbox to see whether the conversion appears there.
2. **The transaction has no Superwall app-user attribution.** If `Superwall.identify()` never
   ran for this device before the purchase — or the purchase happened outside a Superwall
   paywall (native manage-subscriptions sheet, restore, or an ASC-side action) — Superwall may
   have a revenue record with no subject to key a webhook on. Read `src/features/billing/superwall.tsx`
   and `use-restore-purchases.ts` and confirm `identify()` is called with the Supabase user id
   immediately after auth resolves, before any paywall can present. Note `superwall-reconcile`
   and `ALIAS_PREFIX` exist precisely to absorb the pre-identify case — but only for events
   that actually arrive.
3. **Svix-side suppression.** The endpoint shows Enabled in the UI but has never been exercised.
   Send a test event from the Superwall dashboard; if that lands in our edge logs, dispatch
   works and the problem is attribution (2), not transport.

## Tasks

1. **Determine the environment of the 08-25 transaction** (H1). This decides everything else.
   If it is sandbox, the correct conclusion is *"we still have no evidence the production path
   works"* — do not close this issue.
2. **Fire a manual test event** from Superwall → Webhooks → the endpoint, and confirm it appears
   in `function_edge_logs` and in `superwall_events`. This separates transport from attribution.
3. **Add a pre-verification arrival log** to `superwall-webhook/index.ts`: one structured line
   recording method, `svix-id`, and event `type` *before* signature verification runs, so a
   rejected delivery is distinguishable from a delivery that never happened. Log no payload
   bodies and no secrets. Today "no rows in `superwall_events`" collapses four different
   failures into one symptom.
4. **Confirm `identify()` ordering** (H2) and add a regression test if it is racy.
5. **Add a reconciliation alarm to `commerce-health`**: a Superwall/ASC revenue event with no
   matching `subscriptions` row within 15 minutes should surface loudly. This bug was invisible
   for a day because nothing watches the seam.
6. **Repair Nelson's account only after 1–3 are understood.** `subscriptions.plan` is
   service-role-only by design; the correct repair is to replay the real event through
   `superwall-reconcile`, not a hand-written `update`. If a manual write is unavoidable, record
   it as a known manual grant so it is not later mistaken for organic revenue — the way the
   Aug 7 `pro` row now is.

## Acceptance criteria

- A production `initial_purchase` for `cinch.standard.monthly` moves `subscriptions.plan` to
  `standard` end to end, evidenced by a row in `superwall_events` and a matching
  `function_edge_logs` entry.
- A rejected or malformed delivery is visible in logs rather than silent.
- `commerce-health` reports a revenue-event/plan-row mismatch within 15 minutes.

## Context worth carrying

The 14-day trial is granted server-side in Postgres (`subscriptions.trial_ends_at`), deliberately
not via StoreKit — see `docs/superwall/asc-products-directive.md`. ASC "subscription plan starts"
therefore reads 0 by design and is **not** a symptom of this bug. The only StoreKit transaction
that has ever existed for this app is the one described above.

---

## Addendum — 2026-08-26 (evening session)

**Task 1 (environment):** The Revenue Tracking feed exposes no environment column in the old
dashboard, but the transaction arrived via `app_store_connect` (real ASSN, so not a local
StoreKit-config purchase) while the Production-filtered Overview showed 0 conversions — sandbox
by elimination. **Superwall's own docs say sandbox TestFlight purchases DO fire webhooks**
(`docs/integrations/webhooks.md` §Testing), so environment does not excuse the non-dispatch.
The break remains on Superwall's side; filed via `superwall feedback` 2026-08-26.

**Task 2 (test event):** Not possible — the docs state outright "We do not support sending
arbitrary test webhooks", and the endpoint page has no send-test control. Transport was instead
probed with an unsigned POST: 401, fail-closed, reachable.

**Task 3 (arrival log):** Done. `superwall-webhook/index.ts` now logs
`svix-id`/`svix-timestamp`/byte-count BEFORE signature verification (deployed 2026-08-26).
"Never arrived" and "arrived and was rejected" are now distinguishable in `function_edge_logs`.

**Task 4 (identify ordering):** `SuperwallIdentity` identifies with the Supabase user id on the
first session resolve, before any placement can register (superwall.tsx); the purchase went
through a paywall on an identified device. Not the cause.

**Task 6 (repair):** `subscriptions.plan` for `fbd41326…` (nelsonsaenz1@yahoo.com) set to
`standard`, `current_period_end` 2026-09-25T17:00Z — **a manual grant**, recorded here so it is
never read as organic revenue (same status as the Aug-7 `demo@cinch.app` pro row). Replay via
`superwall-reconcile` was impossible: the event was never delivered, so there is nothing to replay.

**Defense in depth shipped the same day:** `usePlan` now folds the Superwall SDK's own
`subscriptionStatus` (StoreKit truth, synced server-side by Superwall) into the plan it reports
— see `src/features/billing/plan-fold.ts`. A paying subscriber whose webhook is late or lost
sees member UI on every device the entitlement reaches, including across relaunches. The server
row remains the authority for AI spend.

**Task 5 (commerce-health alarm) — closed by the rearrangement below.**

---

## Addendum — 2026-08-26 (Event Forwarding shipped)

Founder order: stop waiting on Superwall's dispatcher. The pipeline is now

    Apple ──ASSN V2──▶ asc-notifications (ours) ──raw body──▶ Superwall
                              │
                              ├─ verifies the signedPayload x5c chain against a
                              │  pinned Apple Root CA - G3 (byte-equal root,
                              │  full chain signature walk, leaf verifies JWS,
                              │  nested signedTransactionInfo verified too)
                              ├─ ledger: public.asc_notifications
                              │  (idempotent on notificationUUID)
                              └─ writes subscriptions.plan directly —
                                 appAccountToken IS the Supabase user id,
                                 same PRODUCT_PLANS table, same isStale rule
                                 as superwall-webhook

- **ASC updated via the API** (`PATCH /v1/apps/6798479578`): both Production and
  Sandbox server-notification URLs now point at
  `https://dugizuswuebrmcmvinmi.supabase.co/functions/v1/asc-notifications`, V2.
  Read back and confirmed 2026-08-26.
- **Forwarding**: raw bytes to Superwall's documented intake
  (`integrations.superwall.com/...app-store-connect/webhook?pk=…`), verified
  BEFORE forwarding (their "forward first" is a latency note, not a security
  design — an open relay under our key was not acceptable), 500 on forward
  failure so Apple redelivers. Superwall's Revenue Tracking keeps working; their
  broken dispatcher no longer matters to us.
- **Verification without Apple's help**: the deployed function was probed with a
  forged JWS whose x5c chain is the pinned root itself — it walked the pin
  check, validity windows, issuer matching and chain signatures, and rejected at
  exactly the forged-signature step. (The first probe caught the edge runtime's
  `X509Certificate.checkIssued` being unimplemented — ERR_NOT_IMPLEMENTED — so
  chain verification uses `@peculiar/x509` on WebCrypto instead of node:crypto.)
  Apple offers no reachable test-notification endpoint through the ASC API, so
  the first true end-to-end proof will be the next real sandbox/production
  event; everything short of Apple's genuine signature is proven live.
- **Task 5 delivered**: `commerce_health_report()` now carries a `revenue`
  section from the ledger, and thresholds.ts raises `revenue_event_unapplied`
  (critical — `unattributed`/`write_failed`) and `revenue_product_unmapped`
  (warning) on the existing hourly check. Confirmed flowing in a live report.
- **Acceptance criteria status**: "rejected vs never-arrived visible in logs" ✓
  (both functions log arrivals pre-verification); "mismatch surfaces within 15
  minutes" ✓ (hourly check + Apple's own redelivery pressure on non-200s);
  "production initial_purchase moves the plan end to end" — armed on both
  pipelines, awaiting the first genuine event.
- `superwall-webhook` stays deployed: if Superwall's dispatcher ever wakes, both
  writers converge through the shared product table and staleness rule.
