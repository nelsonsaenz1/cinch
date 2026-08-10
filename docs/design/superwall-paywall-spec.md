# The Superwall document — build spec and copy deck

Everything needed to build **MB-01 … MB-05** in Superwall's editor. This is the one part of
atlas 27 that cannot be authored from a terminal: `create_paywall` takes a name, an identifier and
a product list, there is no `update_paywall`, and the document itself lives at
`user-content.superwalleditor.com`. So this file is the handoff.

MB-06 is **not** here. The success screen is drawn by the app (`src/app/membership-thanks.tsx`),
because only the app knows which task the user was interrupted from.

---

## 0. The state of the dashboard, re-read live 2026-08-10 15:25 UTC

| | |
|---|---|
| Organisation | 26053 |
| Project | **28319** — Cinch |
| Application | **52618** — iOS, `com.nelsonsaenz.cinch`, ASC app 6798479578 |
| Paywall | **254200** — "Cinch Membership v3", identifier `cinch-membership-v3-e738-2026-08-09` |
| Status | `active`, **`published_at: null`**, `feature_gating: non_gated` |

> **The paywall id changed on 2026-08-09 and this document said the wrong one until
> 2026-08-10.** It read **253377** / `cinch-membership-v2`. That paywall still exists,
> is still named "Cinch Membership", and is the `source_template` 254200 was created
> from — so it looks like the live document and is not. **No campaign points at it.**
> Publishing 253377 would flip `published_at`, look entirely successful, and reach
> nobody. Build and publish 254200. The full warning, and the two other decoy drafts,
> are in `docs/design/paywall-publish-runbook.md`.

**`published_at` is null, and that is the whole problem.** The document has never been published,
so every placement in the app currently resolves to a WKWebView that never commits a frame — a
full-screen sheet of flat grey with no close control, escapable only by force-quitting. That is
why `src/features/billing/use-gate.ts` carries an 8-second presentation timeout and a 12-second
silent-render timeout; those exist to survive this exact condition, not as general paranoia.

Publishing this document is the single highest-value action left on revenue.

### Products, with their real prices

All four are already attached to the paywall.

| Reference name | Identifier | Price | Entitlement |
|---|---|---|---|
| `proAnnual` | `cinch.pro.annual` | **$119.00 / year** | `pro` (55806) |
| `proMonthly` | `cinch.pro.monthly` | **$14.99 / month** | `pro` |
| `standardAnnual` | `cinch.standard.annual` | **$59.00 / year** | `standard` (55809) |
| `standardMonthly` | `cinch.standard.monthly` | **$7.99 / month** | `standard` |

The atlas's figures are all correct against these, including the yearly-equivalent monthlies:
$119 ÷ 12 = **$9.92**, $59 ÷ 12 = **$4.92**. Read every one of them from StoreKit anyway — the
atlas's own rule is that nothing is hardcoded, and a price typed into a layout is a price that is
wrong in every country but one.

### Campaigns

**Four now, not two.** All four resolve to paywall **254200** at 100%, and all four carry the
same audience rule — `["pro"].all(identifier, !device.activeEntitlements.contains(identifier))`,
i.e. free, lapsed *or* Standard.

| Campaign | Placements | Audience |
|---|---|---|
| 100436 "Limits & trial" | `open_stylist`, `add_garment_over_limit`, `generate_outfit_over_limit`, `trial_expired`, `event_hosting_over_limit` | audience 168899 → paywall 254200 at 100% |
| 100596 "Packing access" | `packing_access` | audience 169159 → paywall 254200 at 100% |
| 100973 "Repeat upsell" | `repeat_upsell` | audience 169783 → paywall 254200 at 100% |
| **101136 "Reveal complete"** | `reveal_complete` | audience 170046 → paywall 254200 at 100% |

101136 is new (created 2026-08-10) and is unlike the other three: **no server has refused
anything** when it fires. It is founder decision D2 — the dismissible offer immediately after The
Reveal (`docs/design/positioning-contract.md` §5). Its `{{context}}` line interpolates the user's
own computed outfit count and that number may never be typed into the dashboard as a constant
(positioning-contract §3).

Two gaps, both real when written, both now closed:

1. ~~**`repeat_upsell` has no campaign.**~~ **FIXED 2026-08-09** — campaign 100973 above. The
   Repeat's "See plans" now resolves. `contextLineFor()` deliberately returns `null` for this
   placement, so the page renders in its MB-01 default with no line above the headline; do not
   add one in the dashboard.
2. ~~**`packing_access` now targets the wrong people.**~~ **FIXED 2026-08-09.** Its audience was
   `size(device.activeEntitlements) == 0`, which was right while packing was "any paying plan".
   Packing became **Pro-only**, so a **Standard** subscriber matched nothing and got a dead
   "See membership" button. Audience 169159 now carries an `entitlement_conditions` rule on
   `pro` / `inactive`, which Superwall compiles to
   `["pro"].all(identifier, !device.activeEntitlements.contains(identifier))` — free, lapsed and
   Standard all match; Pro does not. (A trialing account never registers the placement, because
   `usePackingAccess` folds the trial into Pro.)

3. ~~**Campaign 100436 has the same shape.**~~ **FIXED 2026-08-09, client first.** Audience
   168899 had the same rule, so a **Standard** subscriber who hit the 150-item ceiling, the
   daily outfit ceiling, the monthly stylist ceiling or the 15-event hosting ceiling matched
   nothing and was never offered Pro. It could not be widened on its own: `context-lines.ts`
   keyed its line on the PLACEMENT alone, so a Standard user at 150 garments would have read
   "Ten pieces is where the free closet stops. You have ten." `contextLineFor` now takes the
   caller's plan — `use-gate.ts` reads it from `usePlan()` so no call site had to learn about
   billing — and four paid-tier lines were added that quote `PLANS` rather than frozen numbers.
   The audience was widened only after that shipped.

---

## 1. The page

One scroll, canvas ground, hard-left type. No modal chrome, no hero image, no plan-comparison
table. The whole document is about 500pt tall on an iPhone 15.

**Tokens** — the palette is locked and light-only:

| Role | Hex |
|---|---|
| Canvas (page ground) | `#FBFAF6` |
| Ink (all body and headline type) | `#1C1A16` |
| Muted (secondary type) | `#6B665C` |
| Accent / oxblood (the one action) | `#6E2B2B` |
| Accent warm | `#B08A76` |
| Sand (card grounds, selected states) | `#EAE5DB` |
| Hairline | `#E4DFD4` |

**Never use `#8A8578`** for text. It measures about 3.5:1 on canvas and fails WCAG AA. Six
consecutive design waves have reintroduced it and it has been refused six times.

**Type** — Instrument Serif for the headline, the system sans for everything else.

### Structure, top to bottom

```
┌─────────────────────────────────────────┐
│  ✕                                      │   close, top-left, 44pt target
│                                         │
│  {{context}}                            │   MB-02/03 — see §3. Collapses entirely when absent.
│                                         │
│  Dressed well,                          │   Instrument Serif, ~40pt, two lines, tight leading
│  every day.                             │
│                                         │
│  A stylist that answers in your own      │  three benefit lines, ink, ~17pt,
│  closet, whenever you ask.               │  ~14pt gaps, no bullets, no icons
│  A thousand pieces, and unlimited        │
│  outfits generated every morning.        │
│  Events you host, friends' closets you   │
│  can borrow from, and packing for        │
│  the trip.                               │
│                                         │
│  ┌───────────────┐ ┌───────────────┐    │
│  │ Pro           │ │ Standard      │    │   two cards, side by side, equal width
│  │ Everything    │ │               │    │   Pro preselected: sand ground + 1pt ink border
│  │ $14.99/mo ·   │ │ $7.99/mo ·    │    │   Standard: canvas ground + hairline border
│  │ $119/yr       │ │ $59/yr        │    │
│  │ $9.92         │ │ $4.92         │    │   the big number: serif, ~28pt
│  │ /mo billed    │ │ /mo billed    │    │   muted, ~13pt
│  │ yearly        │ │ yearly        │    │
│  └───────────────┘ └───────────────┘    │
│                                         │
│  Standard covers the closet, the daily   │  muted, ~15pt
│  outfits and the stylist. Pro adds       │
│  packing, and takes every ceiling off.   │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │      Start Pro — $119/yr            ││  THE one oxblood action, full width,
│  └─────────────────────────────────────┘│  52pt tall, canvas label
│                                         │
│  Renews yearly. Cancel any time in       │  muted, ~13pt, centred
│  Settings.                               │
│                                         │
│  Restore · Terms · Privacy               │  muted, ~13pt, centred, all three tappable
└─────────────────────────────────────────┘
```

**If the yearly equivalent cannot be computed, the right-hand column of a card disappears rather
than showing a guess.** The atlas is explicit about this and it is the same discipline the app
applies to weather and to cost-per-wear.

The CTA label is built from the selected plan and its real price — selecting Standard changes it
to "Start Standard — $59/yr", and selecting a monthly option changes the period. Tapping a card
changes the selection; it does not purchase.

---

## 2. Copy deck

Every string, verbatim. Four of these differ from the atlas because the atlas describes an app
Cinch is not — see `membership-packing-contract.md` §2 for each correction and its reason.

| Slot | String |
|---|---|
| Eyebrow (no context) | `Cinch membership` |
| Headline | `Dressed well,` / `every day.` |
| Benefit 1 | `A stylist that answers in your own closet, whenever you ask.` |
| Benefit 2 | `A thousand pieces, and unlimited outfits generated every morning.` |
| Benefit 3 | `Events you host, friends' closets you can borrow from, and packing for the trip.` |
| Pro card | `Pro` / `Everything` |
| Standard card | `Standard` |
| Card footnote | `/mo billed yearly` |
| Summary | `Standard covers the closet, the daily outfits and the stylist. Pro adds packing, and takes every ceiling off.` |
| CTA | `Start {plan} — {price}` |
| Under the CTA | `Renews yearly. Cancel any time in Settings.` |
| Footer | `Restore` · `Terms` · `Privacy` |

> **Benefit 2 was "Unlimited garments and unlimited outfits."** Pro is a thousand pieces
> (`PLAN_ITEM_LIMITS.pro`). "Unlimited" is a claim the app refuses to honour at 1001, which is a
> support ticket and an App Review exposure on subscription claims. Unlimited *outfits* is true
> and stays.
>
> **The summary line was "Standard covers the closet and the daily outfits. Pro adds the stylist,
> events and packing."** Standard has the stylist (30 messages a month) and hosts 15 events. Only
> packing is Pro.

**Forbidden on this page, by the atlas's own instruction and ours:** countdown timers,
crossed-out prices, "limited time", "you're missing out", confetti, or any second oxblood control.

---

## 3. The context line (MB-02, MB-03)

The block above the headline. It names the thing the user was just trying to do, and it is the
only part of the page that changes between the six ways in.

**It comes from the app, not from Superwall.** `registerPlacement` is called with
`params: { context, trigger }`, so the document only needs:

- a text element bound to `{{context}}`, in a sand card with ~16pt padding, ink type at ~16pt;
- the whole block hidden when `context` is empty — that is MB-01, the default.

The six strings live in `src/features/billing/context-lines.ts` and are versioned in git. Do not
retype them into the editor; a copy in a dashboard is a copy that drifts.

MB-02 also shows Standard carrying a disclaimer — `Doesn't include packing.` The app sends
`trigger` alongside `context`, so the document shows that disclaimer **only when
`trigger == "packing_access"`**. For the stylist trigger there is no disclaimer at all, because
Standard includes the stylist — the atlas's "Doesn't include the stylist" describes tiers this
app does not sell.

---

## 4. The other three states

**MB-04 — loading, then purchasing.** The two plan cards are **skeletons until real prices
arrive** — never placeholder numbers, never a price that changes under the user's finger. The
eyebrow reads `Checking prices with the App Store`. During the purchase itself the sheet blocks
the page rather than dimming the button in place: `Confirming with the App Store` /
`Don't close Cinch. This usually takes a few seconds.`

**MB-05 — store unavailable.** The CTA goes **inert rather than disappearing**, so the page keeps
its shape. Restore stays live and becomes the emphasised action.

| Slot | String |
|---|---|
| Heading | `Prices aren't loading` |
| Body | `The App Store isn't answering right now. This is on our side of the wire, not yours — nothing has been charged and nothing is lost.` |
| Action | `Try again` |
| Note | `Already a member on another device? Restore below — that works even when prices don't.` |
| Inert CTA | `Start Pro` / `Unavailable until the store responds.` |

**Dismissal.** Whatever else changes, the close control must exist and must be reachable at every
one of these states. The app cannot reach around a modal it does not own, and a paywall with no
way out costs a session rather than a sale.

---

## 5. Publish checklist

1. Confirm you are in paywall **254200**, not 253377 (§0).
2. Build the layout above; bind `{{context}}` and hide-when-empty.
3. Confirm all four products resolve real prices in the editor's preview.
4. Check the close control in every state, including the loading skeleton. It is load-bearing
   for the Reveal placement, which must stay dismissible — keep `feature_gating: non_gated`.
5. **Publish.** `published_at` must stop being null.
6. ~~Fix audience 169159 on campaign 100596~~ — done 2026-08-09.
7. ~~Create a campaign for `repeat_upsell`~~ — done 2026-08-09, campaign 100973.
8. Run the app against it on a simulator and watch `use-gate.ts` report `granted` / `declined`
   rather than `unavailable`. `unavailable` means the document still is not reaching anybody.

The project has `figma_import` and `editor_ai_chat` enabled, which are the two fastest routes
through step 1.
