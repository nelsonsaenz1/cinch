# Directive — build and publish the Cinch membership paywall

**For: the Superwall agent. This document is self-contained — you do not need the Cinch repo.**

You are building one paywall document in Superwall's web editor and fixing two campaign
problems. When you are done, Cinch has a working purchase page for the first time.

---

## 0. Why this is urgent

The paywall `cinch-membership-v2` (id **253377**) exists, is marked `active`, has all four
products attached — and **has never been published** (`published_at: null`).

An unpublished document does not fail quietly. Its WKWebView never commits a frame, so what the
user gets is a full-screen sheet of flat grey with no close control and no back gesture. The only
way out is to force-quit the app. Every paywall trigger in Cinch currently does this.

So: the app today has no purchase page, and reaching for one costs the user their session.
**Publishing is the deliverable.** A beautiful unpublished document is worth exactly nothing.

---

## 1. Where you are working

| | |
|---|---|
| Organisation | 26053 |
| Project | **28319** — Cinch |
| Application | **52618** — iOS, `com.nelsonsaenz.cinch`, ASC app 6798479578 |
| Paywall | **253377** — "Cinch Membership", identifier `cinch-membership-v2` |
| Campaigns | **100436** "Limits & trial", **100596** "Packing access" |

The project has `figma_import` and `editor_ai_chat` enabled — both are fast routes through the
layout work.

**What the Superwall MCP can and cannot do.** It *can* read paywalls and campaigns, and it *can*
edit audiences (`update_audience`). It **cannot** author or edit paywall content: `create_paywall`
takes only a name, identifier and product list, and there is no `update_paywall`. The layout and
copy must be built in the web editor by hand. Do not waste time looking for an API for it.

---

## 2. The products — read prices from StoreKit, never type them

All four are already attached to paywall 253377. These figures are for your verification only.

| Reference name | Identifier | Price | Entitlement |
|---|---|---|---|
| `proAnnual` | `cinch.pro.annual` | $119.00 / year | `pro` (55806) |
| `proMonthly` | `cinch.pro.monthly` | $14.99 / month | `pro` |
| `standardAnnual` | `cinch.standard.annual` | $59.00 / year | `standard` (55809) |
| `standardMonthly` | `cinch.standard.monthly` | $7.99 / month | `standard` |

The yearly-equivalent monthlies the layout shows are $119 ÷ 12 = **$9.92** and $59 ÷ 12 = **$4.92**.
**Compute them from the live StoreKit price, do not hardcode them.** A price typed into a layout
is wrong in every country but one.

**If the yearly equivalent cannot be computed, that column disappears rather than showing a
guess.** This is a rule, not a preference.

---

## 3. Design constraints — these are settled, do not relitigate

The palette is locked and the app is **light-only**:

| Role | Hex |
|---|---|
| Canvas (page ground) | `#FBFAF6` |
| Ink (headline and body) | `#1C1A16` |
| Muted (secondary type) | `#6B665C` |
| Accent / oxblood (the one action) | `#6E2B2B` |
| Accent warm | `#B08A76` |
| Sand (card grounds, selected states) | `#EAE5DB` |
| Hairline | `#E4DFD4` |

Type: **Instrument Serif** for the headline only. System sans for everything else.

Five refusals, each already argued and settled:

1. **Never use `#8A8578` for text.** It measures ~3.5:1 on canvas and fails WCAG AA. Six design
   waves have reintroduced it and it has been refused six times.
2. **One oxblood action per screen.** Exactly one control is `#6E2B2B`. Selected states are
   sand or ink, never accent.
3. **No countdown timers, no crossed-out prices, no "limited time", no "you're missing out."**
   The design brief says this itself. It survives contact with a conversion argument.
4. **No confetti, anywhere.**
5. **A close control must exist and be reachable in every state**, including the loading
   skeleton. The app cannot reach around a modal it does not own.

---

## 4. The layout

One scroll, canvas ground, hard-left type. No modal chrome, no hero image, no comparison table.
About 500pt tall on an iPhone 15.

```
┌─────────────────────────────────────────┐
│  ✕                                      │  close, top-left, 44pt target
│                                         │
│  {{context}}                            │  sand card, ~16pt padding, ink ~16pt.
│                                         │  HIDDEN ENTIRELY when context is empty.
│  Dressed well,                          │  Instrument Serif, ~40pt, two lines,
│  every day.                             │  tight leading
│                                         │
│  A stylist that answers in your own      │  three benefit lines, ink ~17pt,
│  closet, whenever you ask.               │  ~14pt gaps. No bullets. No icons.
│  A thousand pieces, and unlimited        │
│  outfits generated every morning.        │
│  Events you host, friends' closets you   │
│  can borrow from, and packing for        │
│  the trip.                               │
│                                         │
│  ┌───────────────┐ ┌───────────────┐    │
│  │ Pro           │ │ Standard      │    │  equal width, side by side
│  │ Everything    │ │               │    │  PRO IS PRESELECTED:
│  │ $14.99/mo ·   │ │ $7.99/mo ·    │    │    sand ground + 1pt ink border
│  │ $119/yr       │ │ $59/yr        │    │  Standard:
│  │ $9.92         │ │ $4.92         │    │    canvas ground + hairline border
│  │ /mo billed    │ │ /mo billed    │    │  big number: serif ~28pt
│  │ yearly        │ │ yearly        │    │  footnote: muted ~13pt
│  └───────────────┘ └───────────────┘    │
│                                         │
│  Standard covers the closet, the daily   │  muted ~15pt
│  outfits and the stylist. Pro adds       │
│  packing, and takes every ceiling off.   │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │      Start Pro — $119/yr            ││  THE one oxblood action.
│  └─────────────────────────────────────┘│  full width, 52pt tall, canvas label
│                                         │
│  Renews yearly. Cancel any time in       │  muted ~13pt, centred
│  Settings.                               │
│                                         │
│  Restore · Terms · Privacy               │  muted ~13pt, centred, all tappable
└─────────────────────────────────────────┘
```

Tapping a card changes the selection; it does not purchase. The CTA label rebuilds from the
selected plan and its real price —选 Standard and it reads "Start Standard — $59/yr"; select a
monthly option and the period changes.

---

## 5. Copy deck — verbatim

| Slot | String |
|---|---|
| Eyebrow (when no context) | `Cinch membership` |
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

### Two lines you may be tempted to "restore" — do not

If you are given an older design reference, it will show two strings that are **false about this
app**. They were corrected deliberately.

- It says **"Unlimited garments and unlimited outfits."** Pro's real ceiling is **1000 items**.
  "Unlimited" is a claim the app refuses to honour at 1001 — a support ticket and an App Review
  exposure on subscription claims. Ship "A thousand pieces". Unlimited *outfits* is true and stays.
- It says **"Pro adds the stylist, events and packing."** Standard **has** the stylist (30
  messages a month) and hosts 15 events. Only packing is Pro. Ship the summary line above.

---

## 6. The context line (the block above the headline)

This is the only part of the page that changes between the six ways in, and **the app writes it,
not you.**

Cinch calls `registerPlacement` with `params: { context, trigger }`. You need:

- a text element bound to **`{{context}}`**;
- the whole block **hidden when `context` is empty** — that is the default state;
- on the Standard card, a disclaimer line reading **`Doesn't include packing.`**, shown **only
  when `trigger == "packing_access"`**. For every other trigger, no disclaimer — because Standard
  includes the stylist and event hosting.

**Do not retype the six context strings into the editor.** They are versioned in the app's source
(`src/features/billing/context-lines.ts`) and a copy in a dashboard is a copy that drifts. Bind
the variable and let the client supply it.

For your reference, so you can preview realistically, the app sends strings of this shape:

> You asked what to wear to the rehearsal dinner. The stylist has an answer — it's part of Standard.

> Ten pieces is where the free closet stops — and ten is enough to dress a fortnight. You have ten, and a coat in the camera roll.

> Four days in Lisbon. Pro packs the bag — day by day, from the closet you already own.

---

## 7. The other states

**Loading.** The two plan cards are **skeletons until real prices arrive** — never placeholder
numbers, never a price that changes under the user's finger. Eyebrow: `Checking prices with the
App Store`.

**Purchasing.** The sheet **blocks the page** rather than dimming the button in place:
`Confirming with the App Store` / `Don't close Cinch. This usually takes a few seconds.`

**Store unavailable.** The CTA **goes inert rather than disappearing**, so the page keeps its
shape. Restore stays live and becomes the emphasised action.

| Slot | String |
|---|---|
| Heading | `Prices aren't loading` |
| Body | `The App Store isn't answering right now. This is on our side of the wire, not yours — nothing has been charged and nothing is lost.` |
| Action | `Try again` |
| Note | `Already a member on another device? Restore below — that works even when prices don't.` |
| Inert CTA | `Start Pro` / `Unavailable until the store responds.` |

**There is no success screen here.** The app draws its own after a purchase, because only the app
knows which task the user was interrupted from. Do not build one.

---

## 8. The two campaign fixes

### 8.1 `packing_access` targets the wrong people — fix this

Campaign **100596**, audience **169159**. Its entitlement rule is `no_active_entitlements`, which
was correct while packing was available to any paying plan.

**Packing became Pro-only on 2026-08-09.** A **Standard** subscriber who opens Packing now has an
active entitlement, matches no audience, and sees no paywall — while the app's own gate correctly
keeps them locked. The result is a dead "See membership" button for the tier most likely to
upgrade.

Change the rule so it matches users **without an active `pro` entitlement**. Use
`update_audience` with an `entitlement_conditions` rule on identifier `pro`. Verify the resulting
CEL expression before saving, and confirm a Pro subscriber still matches nothing.

Nothing is being given away in the meantime — the app fails closed independently, and so does the
server — but the sale is being lost.

### 8.2 `repeat_upsell` has no campaign

The Repeat's "See plans" button registers placement `repeat_upsell`, which matches nothing, so the
tap does nothing. Either create a campaign for it pointing at 253377 with the same audience shape,
or report back that it was left undesigned. Do not leave it silently broken.

**Never rename a placement.** Placement names are a contract with `src/features/billing/placements.ts`.
A rename does not throw — it silently means "no campaign matched" and the action proceeds
unpaywalled. It is closer to a column rename than a refactor.

---

## 9. Done means

1. Layout built; `{{context}}` bound and hiding when empty; the Standard disclaimer branching on
   `trigger`.
2. All four products resolving **real** StoreKit prices in preview, with the yearly equivalents
   computed and the column dropping when they cannot be.
3. Close control present and reachable in every state, skeleton included.
4. **Published.** `published_at` is no longer null.
5. Audience 169159 fixed (§8.1).
6. `repeat_upsell` either campaigned or explicitly reported as undesigned.

Then report back with: the published version, what you changed on each campaign, any string you
could not place, and anything in this directive you had to deviate from and why.

If something here is impossible in the editor, **say so rather than approximating it.** An honest
gap is worth more than a paywall that looks right and claims something untrue.
