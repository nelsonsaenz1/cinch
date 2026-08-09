# The Superwall document — build spec and copy deck

Everything needed to build **MB-01 … MB-05** in Superwall's editor. This is the one part of
atlas 27 that cannot be authored from a terminal: `create_paywall` takes a name, an identifier and
a product list, there is no `update_paywall`, and the document itself lives at
`user-content.superwalleditor.com`. So this file is the handoff.

MB-06 is **not** here. The success screen is drawn by the app (`src/app/membership-thanks.tsx`),
because only the app knows which task the user was interrupted from.

---

## 0. The state of the dashboard, read 2026-08-09

| | |
|---|---|
| Organisation | 26053 |
| Project | **28319** — Cinch |
| Application | **52618** — iOS, `com.nelsonsaenz.cinch`, ASC app 6798479578 |
| Paywall | **253377** — "Cinch Membership", identifier `cinch-membership-v2` |
| Status | `active`, **`published_at: null`** |

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

| Campaign | Placements | Audience |
|---|---|---|
| 100436 "Limits & trial" | `open_stylist`, `add_garment_over_limit`, `generate_outfit_over_limit`, `trial_expired`, `event_hosting_over_limit` | no active entitlements → paywall 253377 at 100% |
| 100596 "Packing access" | `packing_access` | no active entitlements → paywall 253377 at 100% |

Two gaps, both real:

1. **`repeat_upsell` has no campaign.** The Repeat's "See plans" therefore does nothing. An
   unmatched placement proceeds silently — nothing is given away, the moment is simply undesigned.
2. **`packing_access` now targets the wrong people.** Its audience is
   `size(device.activeEntitlements) == 0`, which was right while packing was "any paying plan".
   Packing became **Pro-only** on 2026-08-09, so a **Standard** subscriber who opens Packing has
   an active entitlement, does not match the audience, and gets no paywall at all — while the
   app's own gate correctly keeps them locked. The result is a dead "See membership" button.
   **Fix:** change audience 169159's entitlement rule from `no_active_entitlements` to an
   entitlement condition on identifier `pro` not being active. Nothing is given away in the
   meantime — `usePackingAccess` fails closed and reports `unavailable` for a tap that produced
   nothing — but the sale is lost, and Standard is the tier most likely to buy Pro.

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

1. Build the layout above; bind `{{context}}` and hide-when-empty.
2. Confirm all four products resolve real prices in the editor's preview.
3. Check the close control in every state, including the loading skeleton.
4. **Publish.** `published_at` must stop being null.
5. Fix audience 169159 on campaign 100596 (§0) so Standard subscribers see the Pro offer.
6. Create a campaign for `repeat_upsell`, or accept that The Repeat's "See plans" does nothing.
7. Run the app against it on a simulator and watch `use-gate.ts` report `granted` / `declined`
   rather than `unavailable`. `unavailable` means the document still is not reaching anybody.

The project has `figma_import` and `editor_ai_chat` enabled, which are the two fastest routes
through step 1.
