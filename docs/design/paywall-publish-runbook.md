# Publishing the Cinch paywall — runbook

The one revenue blocker, reduced to the smallest set of actions that can still
only be done by a person. Everything automatable has been done; what is left is
listed here in order.

**State as of 2026-08-10 14:02 UTC**, read live from the dashboard rather than
from notes:

| | |
|---|---|
| Paywall | **253377** — "Cinch Membership", `cinch-membership-v2` |
| Status | `draft` · `published_at: null` · `version: 0` |
| Products attached | 4/4, all `READY_TO_SUBMIT` in App Store Connect |
| Entitlements | 4/4 products linked |
| Campaigns | 3, all with placements |
| Webhook → Supabase | **active** (`ep_3HVlX4bjAM0Jsn4qw2MfQzllhCf`, not disabled) |

**The document has never been published. That is the whole of why Cinch cannot
take money.** Every placement resolves to a WebView that never commits a frame,
which is what `src/features/billing/use-gate.ts` spends two timeouts defending
against.

---

## Why an agent cannot do this part

Checked exhaustively against the Superwall MCP surface, not assumed:

- `create_paywall`, `duplicate_paywall`, `get_paywall`, `list_paywalls`,
  `archive_paywall`, `unarchive_paywall` — **no `update_paywall`.**
- **No publish tool of any kind.** Nothing can move a paywall out of `draft`.
- `update_product` accepts `name`, `entitlements`, `metadata` — not content.
- Templates are other companies' published designs. Creating from one yields
  their layout, still in draft, still uneditable from here.

The document itself lives in a web editor backed by
`user-content.superwalleditor.com`. There is no API behind it. So the document
was authored here instead, in the form the editor imports.

---

## Step 1 — the document

`docs/design/superwall-paywall.html` is the paywall, built to the atlas: MB-01
default, MB-04 loading/purchasing, MB-05 store unavailable. Self-contained, no
external fonts, no build step.

MB-06 is deliberately absent — the success screen is native
(`src/app/membership-thanks.tsx`), because only the app knows which task the
user was interrupted from.

Paste or import it into paywall 253377. The project has **`figma_import` and
`editor_ai_chat` enabled**; the AI chat accepts pasted HTML and is the fastest
route in.

## Step 2 — bind the controls

The HTML carries comments marking every binding. In the editor:

| Control | Binds to |
|---|---|
| Close (top-left) | dismiss |
| CTA | purchase the **selected** product |
| Plan cards | change selection only — never purchase |
| Restore | restore purchases |
| Terms | `https://cinchstyle.com/terms` |
| Privacy | `https://cinchstyle.com/privacy` |

Prices come from the four attached products and are formatted in the device
locale — never hardcode one. The `{{context}}` block must **collapse entirely
when empty**; that empty state is MB-01 and it is what most users see.

## Step 3 — publish

`published_at` must stop being null. This is the action that turns revenue on.

## Step 4 — verify from the app

Run the app and watch `use-gate.ts`. It should report `granted` or `declined`.
**`unavailable` means the document still is not reaching anybody** — that is the
same condition as today and the single most useful signal in the whole flow.

---

## Two things a person must also do, both credentials

**The App-Specific Shared Secret is missing** (doctor `ios.iap_shared_secret`,
p0). App Store Connect → Users and Access → Integrations → App-Specific Shared
Secrets, then paste it into Superwall's application settings. Superwall cannot
verify StoreKit receipts without it. Revenue tracking is otherwise configured
via the ASC API key and Server Notifications, both of which pass.

**Confirm the Server Notifications URL is pasted in App Store Connect** → App
Information → Server Notifications, for **both Production and Sandbox**.
Superwall has generated the URL; the doctor cannot see whether ASC has it.

---

## Findings that are NOT problems

Recorded so nobody spends an afternoon on them.

**"No active webhook destinations" is a false alarm.** The doctor checks at
application scope; the endpoint exists at project scope, is not disabled, points
at `…/functions/v1/superwall-webhook`, and filters the eight billing events that
matter. Verified directly.

**"No revenue events have landed" is a symptom, not a cause.** Nothing has ever
been purchased, because the paywall has never rendered. It will clear itself
with the first sandbox purchase.

**The four `product_drift` errors are a vocabulary mismatch, not drift.**
Superwall records `month`/`year`; App Store Connect reports
`ONE_MONTH`/`ONE_YEAR`. Same periods, two spellings, compared as strings. Worth
re-checking after the first real render, but nothing is misconfigured — and note
`update_product` cannot set a period anyway, so a re-import from ASC is the only
lever if it ever turns out to be real.
