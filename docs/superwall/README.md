# Cinch — Membership paywall (self-hosted, not built in the Superwall editor)

This directory contains a production-ready, hand-authored HTML paywall for
`cinch-membership` (paywall id `252860`, project **Cinch**, `fullscreen`,
`gated`). It was built to avoid hand-building the paywall in Superwall's
visual block editor, using a documented (but under-advertised) Superwall
feature called **External Paywall Creation**: a paywall can be *any* webpage
you host yourself, as long as it loads Superwall's bridge script
(`Paywall.js`) and marks its interactive elements with `data-pw-*`
attributes. Superwall's own web-based Liquid templating (`{{ products.* }}`,
`{{ params.* }}`) still runs inside that page, so pricing stays live even
though the layout is fully yours.

Docs cited throughout: [External Paywall Creation](https://superwall.com/docs/advanced-paywall-creation),
[Variables](https://superwall.com/docs/dashboard/dashboard-creating-paywalls/paywall-editor-variables),
[Variable Reference](https://superwall.com/docs/variable-reference),
[Adding Products](https://superwall.com/docs/dashboard/products),
[How to Build Multi-Tiered Paywalls](https://superwall.com/blog/how-to-build-multi-tiered-paywalls).

## What's in this file

`cinch-membership.html` implements the full design-handoff brief
(`Cinch Paywall.dc.html` + the design directive) as one self-contained page:

- Instrument Serif (Google Fonts) for the headline, plan names, and prices;
  system Helvetica Neue for everything else — exactly the two-typeface rule
  in the directive.
- All color tokens from the directive as CSS custom properties: `canvas
  #FBFAF6`, `ink #1C1A16`, `muted #6B665C`, `faint #8A8578`, `accent
  (oxblood) #6E2B2B` / `accent-hover #8A3A35` / `accent-light #F1E7E4`,
  `accent-warm #B08A76`, `rule rgba(28,26,22,0.12)`, `hairline
  rgba(28,26,22,0.09)`. One oxblood element on the page: the subscribe
  button. Selected plan card uses `accent-light` fill + oxblood hairline, not
  oxblood fill — as specified.
- Dismiss affordance, "the data behind every outfit" section (cost-per-wear,
  colour harmony, what you actually wear), plan picker (Standard preselected,
  monthly/annual toggle), one subscribe button, Restore Purchases, Terms/
  Privacy links, and the full auto-renewal legal line — every "required
  element" in the directive.
- No urgency, no countdowns, no crossed-out prices, no "free trial" wording
  on the button — matches the "Do not" list.
- Real Terms/Privacy URLs pulled from the app itself (`src/app/(auth)/sign-in.tsx`,
  `src/app/profile.tsx`): `.../privacy` and `.../terms` on the existing Vercel
  deployment — not placeholders.

Prices are never hard-coded. They're read from four named Superwall
products via Liquid (`{{ products.standardMonthly.price }}`, etc.), rendered
once into a hidden data block, and swapped into view by plain JS as the user
toggles plan/period. Paywall.js does its Liquid substitution once per page
load, not reactively — so the visible price/period/note/CTA-label spans are
never themselves `{{ }}` tokens; they're populated from that hidden block.
This is the one non-obvious wrinkle of building a stateful, multi-product
picker as a custom page instead of in Superwall's block editor, where the
editor's own state variables handle it for you.

## What is, and isn't, avoidable via API

| Task | API/CLI possible? | What we found |
| --- | --- | --- |
| Author the paywall's HTML/CSS/copy | **Yes — fully avoided the dashboard editor.** | This file. Any static host works; nothing about the layout goes through Superwall's UI. |
| Wire product prices into the page live | **Yes.** | Liquid `{{ products.<name>.price }}` etc. runs inside custom pages too, confirmed by Superwall's docs example: "Custom products use the same template variables... across your paywall implementation." |
| Wire purchase/restore/dismiss/links | **Yes.** | `data-pw-purchase`, `data-pw-restore`, `data-pw-close`, `data-pw-open-url` — see contract below. |
| Per-placement copy (4 subheads) | **Partially — needs one small app-side change**, still zero dashboard work. | Superwall has no built-in "which placement/event fired" variable for paywall templates (confirmed against the Variable Reference — only `user.*`, `device.*`, and *custom* `params.*` exist). The page reads `{{ params.subhead }}`; you supply it per call site. See "Per-placement subheads" below. |
| Create the products themselves (StoreKit link, name, price, period) | **No — dashboard only**, as far as the docs describe. | No public REST/CLI endpoint is documented for product creation outside the dashboard or the authenticated Superwall MCP (see below). |
| Point paywall id `252860` at this URL instead of the block editor | **Unconfirmed / likely dashboard-only, one-time.** | Superwall's docs describe *how* an external page talks to the SDK in detail, but never show the exact dashboard field where you paste the URL. See "The one manual step" below. |
| Everything above, driven by an agent instead of clicking through the UI | **Exists, but requires an authenticated login — not attempted here.** | The [Superwall MCP](https://superwall.com/docs/dashboard/guides/superwall-mcp) (`https://superwall-mcp.superwall.com/mcp`) can create projects, apps, products, paywalls "from templates or scratch", and campaigns. Its own docs say it "does not directly control the live paywall editor canvas" for visual design — for actual layout you're pointed back to the AI Chat Builder or "Editor MCP" (live-editor-attached). Since it authenticates via a browser login equivalent to signing into the dashboard, and this task's constraints rule out logging into any dashboard, it was **not used**. It's a legitimate option if you (the human) want to run it yourself later. |

**Bottom line:** everything about paywall *content* — layout, styling, copy,
pricing, the four button/link behaviors — is now code, versioned in this
repo, editable without opening a browser. The only thing that stayed
dashboard-only, and could not be confirmed to have an API/CLI path even in
principle, is (a) creating the four StoreKit-backed product records and
(b) telling paywall `252860` to render this URL instead of its (currently
blank) block-editor canvas.

## The one manual step: attach the URL

1. Host `cinch-membership.html` somewhere with a stable HTTPS URL. Simplest:
   commit it as-is and let it ride on Cinch's existing Vercel project (e.g.
   `https://cinch-nelsonsaenz1-3579s-projects.vercel.app/superwall/cinch-membership.html`
   via a static route), or push it to Superwall's suggested Webflow flow if
   you'd rather manage it there. Nothing in the file assumes a particular
   host — it has zero relative asset paths.
2. In the Superwall dashboard, open **Cinch → Paywalls → Cinch — Membership**
   (`cinch-membership`, draft). Superwall's docs confirm that once a page
   with `data-pw-*` tags is reachable, "the dashboard instantly recognizes
   the data tags on your website" and exposes them as editable fields — but
   the docs never show the literal UI control (a "Website URL" field, an
   import action, or similar) that establishes the connection in the first
   place. Look for it under the paywall's settings/publishing panel, or ask
   Superwall's own AI Chat Builder inside the editor to "point this paywall
   at `<your URL>`" — that assistant has UI-level access this document
   research doesn't. If nothing surfaces, this is worth a two-line message
   to Superwall support; the capability is real (it's how their own
   Webflow-based flow works), the discoverability from docs alone is the gap.
3. Leave presentation style **Fullscreen** and feature gating **Gated** —
   both already set per the brief, and this page assumes gating (dismiss =
   no access).

Nothing else in the dashboard needs to change. Do **not** apply a template —
the directive is explicit that Superwall's stock templates aren't in the
brand, and this page already supersedes that step.

## Products: four names, not three

Superwall auto-names the first three products you add to a paywall
`primary`/`secondary`/`tertiary`, but — per [Adding Products](https://superwall.com/docs/dashboard/products) —
"you're free to name them anything else." This page needs **four**
(Standard × monthly/annual, Pro × monthly/annual), so in the dashboard's
product picker for this paywall, add and name them exactly:

| Product name (must match exactly) | Plan | Period | Placeholder price (§3 of the design directive) |
| --- | --- | --- | --- |
| `standardMonthly` | Standard | Monthly | $7.99 |
| `standardAnnual` | Standard | Annual | $59 (≈ $4.92/mo via `monthlyPrice`) |
| `proMonthly` | Pro | Monthly | $14.99 |
| `proAnnual` | Pro | Annual | $119 (≈ $9.92/mo via `monthlyPrice`) |

The page's `data-pw-purchase` attribute on the single subscribe button is
set by JS at click-time to whichever of those four names matches the
currently selected card + toggle (e.g. `standardMonthly`). Superwall's docs
only give worked examples of `data-pw-purchase="primary|secondary|tertiary"`
literally; they don't show a custom-named product used as that value. This
is the one other spot the public docs leave ambiguous — if a custom name
turns out not to be accepted there, the fallback is to name the four
products `primary`/`secondary`/`tertiary`/`quaternary`-style and adjust
`productNameFor()` in the `<script>` block accordingly; nothing else in the
page needs to change.

As the directive notes, real App Store Connect products are blocked on the
Paid Apps Agreement — these four can be created as placeholders now with the
prices above and swapped for the live StoreKit identifiers later without
touching this file, since it only ever reads product data by name.

## Per-placement subheads

The directive requires one paywall that reads correctly from all four
placements (`open_stylist`, `add_garment_over_limit`,
`generate_outfit_over_limit`, `trial_expired`), with distinct copy for each,
pulled verbatim from the design handoff's `subheads` map:

```
open_stylist:                "The stylist only ever works from your real wardrobe. A membership keeps it open."
add_garment_over_limit:      "You've photographed 30 garments. A membership opens Cinch to every piece you own."
generate_outfit_over_limit:  "You're using Cinch every morning. A membership keeps a fresh outfit coming each day."
trial_expired:                "Your 14 days of full access are up. Here's what keeping Cinch costs — no second trial, no games."
```

Superwall has no built-in "which placement fired" variable — the correct,
documented mechanism is a custom **param**, passed at the moment the app
registers the placement (`{{ params.subhead }}` in the page, already wired).
This is a small, optional app-side change — **not applied to the repo by
this task**, since it touches billing code outside this directory's scope —
shown here so it's mechanical to do:

`src/features/billing/use-gate.ts` — extend `Gate.present` to accept params:

```ts
export type Gate = {
  present: (
    placement: PlacementName,
    params?: Record<string, string>,
    onGranted?: () => void | Promise<void>,
  ) => Promise<void>;
};

// inside useSuperwallGate():
const present = useCallback(
  async (placement, params, onGranted) => {
    await registerPlacement({ placement, params, feature() { void onGranted?.(); } });
  },
  [registerPlacement],
);
```

Then at each of the three action call sites (wherever `gate.present(Placement.OpenStylist, …)`,
`gate.present(Placement.AddGarmentOverLimit, …)`, and
`gate.present(Placement.GenerateOutfitOverLimit, …)` currently get called),
pass the matching subhead from the table above as
`{ subhead: '…' }`. `src/features/billing/use-trial-expired.ts` needs the
same for `Placement.TrialExpired`.

Until that change ships, the page shows the neutral fallback baked into the
`{{ params.subhead | default: "…" }}` Liquid tag — the same "You've had full
access to Cinch…" copy used in the design handoff's `neutral` state — so the
paywall is correct, just not placement-tuned, from the moment the URL is
attached.

## The bridge contract this page implements

From [External Paywall Creation](https://superwall.com/docs/advanced-paywall-creation):

- `<script async src="https://cdn.superwall.me/runtime/entrypoint.js"></script>`
  in `<head>` — required, `async` must stay.
- `data-pw-purchase="<productName>"` — initiates purchase of that product.
- `data-pw-restore` — restores prior purchases.
- `data-pw-close` — dismisses the paywall (this paywall is gated, so a
  dismiss here means the gated action does not happen — matches the
  directive).
- `data-pw-open-url="<https url>"` — opens a link; plain `href` doesn't fire
  reliably inside the paywall's webview, so Terms/Privacy use this attribute
  instead of relying on the anchor tag alone.
- Liquid `{{ }}` for text — `products.<name>.price`, `.period`,
  `.monthlyPrice` (used for the annual per-month note), and `params.<name>`
  for the subhead.

Not used here: `data-pw-var` (remote text editing from the dashboard) and
`data-pw-custom` (delegate-routed custom actions) — nothing on this paywall
needs either, and adding them would just be more dashboard-editable surface
area, which cuts against the goal of keeping this page authoritative.

## If the URL-attach step turns out not to exist for this project/plan

In case step 2 above genuinely has no equivalent in this account (some
capabilities are plan-gated and undocumented publicly), the full manual
dashboard build is mechanically specified by this same file: every color,
font, spacing value, and copy string in `cinch-membership.html` and this
README is already the complete spec — build it in the block editor
component-for-component in this order: dismiss → eyebrow → headline →
subhead → "data behind every outfit" (3 rows) → "Choose a plan" eyebrow →
period toggle → Standard card → Pro card → subscribe button → bill line →
restore/terms/privacy row → legal paragraph. No new design decisions are
required; it's a transcription exercise from this file.
