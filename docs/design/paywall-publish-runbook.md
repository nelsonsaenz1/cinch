# Publishing the Cinch paywall — runbook

The one revenue blocker, reduced to the smallest set of actions that can still
only be done by a person. Everything automatable has been done; what is left is
listed here in order.

## PUBLISH 254200. NOT 253377.

**Read this before anything else on the page.** There are two Cinch membership
paywalls in the dashboard and only one of them is wired to anybody.

| | Publish this | Do NOT publish this |
|---|---|---|
| Id | **254200** | 253377 |
| Name | "Cinch Membership v3" | "Cinch Membership" |
| Identifier | `cinch-membership-v3-e738-2026-08-09` | `cinch-membership-v2` |
| Campaigns pointing at it | **all four** | **none** |
| `feature_gating` | `non_gated` | `gated` |

254200 was created on 2026-08-09 **from 253377 as its `source_template`** and
has been edited since (`updated_at: 2026-08-10T12:58:25Z` against 253377's
`2026-08-06T22:43:55Z`, which has never been touched again). Every one of the
four campaigns' variants targets 254200 at 100%; **nothing targets 253377.**

**Why the wrong id is dangerous, and why it keeps getting typed.** 253377 is the
id in the older documents, it is the *parent* of the live document, and it is
still named "Cinch Membership" — so it reads like the real one. Publishing it
would flip `published_at`, produce a green dashboard and a document that renders
correctly in preview, **and turn on revenue for nobody**, because no audience
resolves to it. The failure is silent in exactly the way the current one is: the
app keeps reporting `unavailable`, and the obvious conclusion — "publishing
didn't work" — is wrong. If you find yourself pointing at 253377, stop; the only
correct reason to open it is to copy content *out* of it.

There is also a third distractor, **253192** "Cinch — Membership (publish
test)", and a fourth, **254512** "New Paywall" — both empty drafts with no
campaign. Ignore both.

---

**State re-read live from the dashboard 2026-08-10 15:25 UTC**, not from notes:

| | |
|---|---|
| Paywall | **254200** — "Cinch Membership v3", `cinch-membership-v3-e738-2026-08-09` |
| Status | `active` · `published_at: null` · `version: 0` · `feature_gating: non_gated` |
| Products attached | 4/4, all `READY_TO_SUBMIT` in App Store Connect |
| Entitlements | 4/4 products linked |
| Campaigns | **4**, all with placements, all pointing at 254200 at 100% |
| Webhook → Supabase | **active** (`ep_3HVlX4bjAM0Jsn4qw2MfQzllhCf`, not disabled) |

The four campaigns, for completeness — the fourth is new:

| Campaign | Placement(s) |
|---|---|
| 100436 "Limits & trial" | `open_stylist`, `add_garment_over_limit`, `generate_outfit_over_limit`, `trial_expired`, `event_hosting_over_limit` |
| 100596 "Packing access" | `packing_access` |
| 100973 "Repeat upsell" | `repeat_upsell` |
| **101136 "Reveal complete"** | `reveal_complete` — created 2026-08-10, founder decision D2 |

**The document has never been published. That is the whole of why Cinch cannot
take money.** Every placement resolves to a WebView that never commits a frame,
which is what `src/features/billing/use-gate.ts` spends two timeouts defending
against.

254200's `non_gated` setting is deliberate and must survive publishing: the
Reveal paywall (D2, `docs/design/positioning-contract.md` §5) has to be
dismissible, and a `gated` document swallows the SDK's feature block on close.
That is the second reason 253377 is the wrong object — it is `gated`.

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

Paste or import it into paywall **254200** — not 253377; see the warning at the
top of this page. The project has **`figma_import` and `editor_ai_chat`
enabled**; the AI chat accepts pasted HTML and is the fastest route in.

254200 already carries whatever was inherited from 253377 plus the edits made on
2026-08-09/10, so check what is there before overwriting it.

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

`published_at` must stop being null **on 254200**. This is the action that turns
revenue on. Confirm the id in the editor's URL before clicking publish;
publishing 253377 instead produces every outward sign of success and changes
nothing for any user.

Leave `feature_gating` on `non_gated`. Publishing must not silently promote it
to `gated`, or the Reveal paywall stops being dismissible.

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
