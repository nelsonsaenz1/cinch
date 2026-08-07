# Directive: get Cinch's subscription products into a valid state in App Store Connect

**For:** the App Store Connect agent
**App:** Cinch, bundle `com.nelsonsaenz.cinch`
**Written:** 2026-08-06, by the Superwall agent

## Why you're getting this

Superwall shows this on every publish of the Cinch — Membership paywall:

> "One or more products are not in a valid state. Please fix the state of the
> products in App Store Connect. You will not be able to purchase these products
> until the state is fixed."

Superwall currently has **no App Store Connect API key**, so it cannot verify
product state — but the warning is very likely also true: these products were
created recently and have probably never been taken to **Ready to Submit**.
Your job is to make the warning false, and to prep the two credentials that let
Superwall see that it's false.

## The four products — canonical facts, do not deviate

All four are **auto-renewable subscriptions** and must live in **one
subscription group** (all four in the same group — this is what makes
Standard↔Pro and monthly↔annual switches upgrades/crossgrades instead of
parallel purchases).

| Product ID | Price (USD) | Duration |
| --- | --- | --- |
| `cinch.standard.monthly` | $7.99 | 1 month |
| `cinch.standard.annual` | $59.00 | 1 year |
| `cinch.pro.monthly` | $14.99 | 1 month |
| `cinch.pro.annual` | $119.00 | 1 year |

Group ranking: **Pro above Standard** (Pro is the higher service level; monthly
and annual of the same tier sit at the same level). This makes Standard→Pro an
upgrade (immediate) and Pro→Standard a downgrade (at renewal), which is the
behaviour we want.

**Hard constraints — things you must NOT do:**

1. **Do not rename, delete, or re-create any product ID.** The IDs above are a
   contract with the Superwall paywall slots and with the `PRODUCT_PLANS` map in
   the deployed `superwall-webhook` Edge Function. A changed ID silently breaks
   entitlement writes.
2. **Do not add an introductory offer, free trial, or promotional offer to any
   of them.** Cinch's 14-day trial is granted server-side
   (`subscriptions.trial_ends_at`), deliberately not via StoreKit. A StoreKit
   trial on top of it would double-grant and desync the webhook's expectations.
3. **Do not change prices.** If a price is missing, set it to the value in the
   table; if it differs, flag it to Nelson rather than "fixing" it.

## What to do

### 1. Diagnose

For each of the four products, record its current status. The states you might
see, and what each means here:

- **Missing Metadata** — the usual culprit for Superwall's warning. Something
  required is absent; ASC lists what, per product, at the top of the product
  page.
- **Ready to Submit** — the target state pre-launch. Sandbox purchasing works
  from here.
- **Waiting for Review / In Review / Approved** — fine, nothing to do.
- **Developer Action Needed / Rejected** — read the resolution notes and report
  back before acting.

Also record: does the subscription group itself have a localized display name?
Are all four in the *same* group? Is the group ranking Pro-above-Standard?

### 2. Fix — the standard Missing Metadata checklist

Work through each product until nothing is listed as missing. For
auto-renewable subscriptions, "valid" generally requires **all** of:

1. **A localized display name and description** for the product, in the app's
   primary locale (en-US). Suggested copy, matching the app's voice — plain,
   no exclamation marks:
   - `cinch.standard.monthly` / `cinch.standard.annual`: name **"Standard"**;
     description "150 garments, a fresh outfit every day, and 30 stylist
     messages a month."
   - `cinch.pro.monthly` / `cinch.pro.annual`: name **"Pro"**; description
     "Unlimited garments, unlimited outfits, and the stylist whenever you
     want it."
   (Annual variants may need a distinct display name if ASC complains about
   duplicates within the group — use "Standard (Annual)" / "Pro (Annual)".)
2. **A localized subscription group display name** (shown on the manage-
   subscriptions sheet). Use **"Cinch Membership"**.
3. **A price in every territory** — set the USD base price from the table and
   let ASC generate territory pricing.
4. **The App Store review screenshot** for each product. This is a real
   gate: without it the product sits in Missing Metadata forever. It needs to
   be an image of the paywall/purchase UI at required device size (1290×2796
   works). Nelson has the paywall render — ask him for it, or use any
   legible screenshot of the membership screen; it can be replaced before
   app review.
5. **Review notes** — optional; skip.

Then the two account-level gates that invalidate *every* product regardless of
metadata — check both:

6. **Paid Applications agreement** — Business (or Agreements, Tax, and
   Banking) → the Paid Apps agreement must be **Active**, with banking and tax
   forms complete. If this is missing, it alone explains Superwall's warning,
   and no per-product fix will clear it.
7. **The app itself must have at least one version** the subscriptions can
   ride with. First-time auto-renewable subscriptions are submitted for review
   **attached to an app version**. Pre-launch, "Ready to Submit" is sufficient
   for Superwall and for sandbox — do not submit anything for review; just get
   the products out of Missing Metadata.

### 3. Prep the two credentials (hand to Nelson, do not paste anywhere else)

These are what lets Superwall actually *see* the fixed state (and stop showing
the warning from ignorance):

1. **App Store Connect API key** — Users and Access → Integrations → App Store
   Connect API → Keys → new key with **App Manager** role. Note the Key ID and
   Issuer ID; the `.p8` downloads exactly once — it goes to Nelson directly,
   never into a repo, ticket, or chat log.
2. **App-specific shared secret** — Users and Access → Integrations →
   App-Specific Shared Secrets → Cinch → generate/copy — to Nelson directly.

Nelson uploads both into Superwall (Settings → Cinch app → Revenue tracking /
In-App Purchase Configuration). While he's in ASC: App Information → App Store
Server Notifications → paste Superwall's ASSN URL into **both Production and
Sandbox**, version **V2** (he has the URL from the Superwall dashboard).

## Done means

Report back, per product: previous state → current state, plus the group name,
group ranking, and Paid Apps agreement status. The finish line is **all four
products in "Ready to Submit" (or beyond), one group, Pro ranked above
Standard, agreement Active** — at which point Superwall's publish warning
should stop being true, and once Nelson uploads the API key, stop appearing.
