# Directive — design the Cinch paywall

**For:** Claude Design
**Build it in:** Superwall paywall editor → project **Cinch** → paywall **“Cinch — Membership”** (`cinch-membership`, id `252860`, currently draft, fullscreen, gated)
**Date:** 2026-08-05

---

## 1. What Cinch is

**A personal stylist for the clothes you already own.**

You photograph your wardrobe once. Every morning Cinch builds outfits from your
real garments, factoring in the weather where you are, what's on your calendar,
and what it has learned you actually like to wear.

The thing that makes it different: **it only ever styles clothes you own.** It
sells you nothing and never shows a garment you don't have. It is the opposite
of a shopping app — the whole promise is getting more out of what's already in
your closet.

It also *computes* things competitors don't: cost-per-wear per garment, colour
harmony across your wardrobe, and real usage data. That data is the heart of the
product, not fine print.

### The feeling — this is the brief that matters most

> **A beautifully made print magazine or lookbook that regenerates itself every
> morning.** Considered, editorial, quiet, confident.

Not a busy dashboard. Not a social feed. Not a shopping app. Something made with
taste, for someone with taste.

Cinch is **honest to a fault** — it says plainly what it knows and never
oversells. **The paywall must sound like the app.** No urgency countdowns, no
"LIMITED TIME", no fake scarcity, no crossed-out prices, no confetti. A paywall
that shouts would break the one thing the product is trading on.

---

## 2. Design tokens — use these exactly

### Colour

| Token | Hex | Role |
| --- | --- | --- |
| `canvas` | `#FBFAF6` | The page. Warm paper. |
| `surface` | `#FFFFFF` | A card lifted off the page. |
| `tray` | `#F0ECE3` | Recessed well a garment sits in. |
| `ink` | `#1C1A16` | Primary text. Warm near-black, never pure black. |
| `muted` | `#6B665C` | Secondary body text. |
| `faint` | `#8A8578` | Tracked eyebrows, inactive labels. |
| `hairline` | `rgba(28,26,22,0.09)` | Divider between rows — a whisper. |
| `rule` | `rgba(28,26,22,0.12)` | Slightly stronger rule. |
| **`accent`** | **`#6E2B2B`** | **Oxblood. The only call-to-action colour.** |
| `accent.hover` | `#8A3A35` | Pressed state. |
| `accent.light` | `#F1E7E4` | Oxblood tint for a selected row. |
| `accent-warm` | `#B08A76` | Warm clay. Data highlights only — never a CTA. |
| `positive` | `#1A8754` | Sparingly. Never decoration. |
| `critical` | `#8A2E28` | Distinct from oxblood on purpose. |

**The accent rule is a hard rule: one oxblood action per screen.** Oxblood is
*spent*, never sprayed. On this paywall that means exactly one oxblood
element — the subscribe button. Selected plan cards use `accent.light` fill with
an `accent` hairline, not oxblood fill.

There is no dark mode. Every `dark` token is identical to its light value —
this is a paper-coloured app in every appearance.

### Type

Two families, no more.

- **Instrument Serif** — every display role: the headline, section titles, and
  **the big data figures**. One weight, one optical master. There is also a real
  italic cut (`InstrumentSerif_400Regular_Italic`) used for emphasis words, e.g.
  *already own.* — use it the way the app does, on one or two words, never a
  whole line.
- **Helvetica Neue** — body copy, labels, buttons, legal. `HelveticaNeue` for
  body, `HelveticaNeue-Medium` for tracked labels and buttons. There is no true
  600 weight; Medium is the heavy end.

Tracked uppercase eyebrows set in `faint` Helvetica Neue Medium are an
established pattern in the app — use them for section labels.

---

## 3. What the paywall has to do

### Two tiers, two billing periods

| | Free | **Standard** | **Pro** |
| --- | --- | --- | --- |
| Garments | 30 | **150** | Unlimited |
| Outfits | A few each week | A fresh outfit every day | Unlimited |
| Stylist | Not included | 30 messages a month | Unlimited |
| Monthly | — | **$7.99** | **$14.99** |
| Annual | — | **$59** | **$119** |

Annual is roughly two months free. **Standard is the tier most people should
land on — design it as the default selection.**

### The trial, and how to talk about it

Every new user gets **14 days of full access with no purchase required.** It is
granted by the app, not by the App Store — so there is **no StoreKit "free
trial" badge**, and the subscribe button must not say "Start free trial". By the
time this paywall appears, the trial has usually already been spent.

Honest framing, in the app's voice: the trial is over, here is what continuing
costs. Do not manufacture a second trial.

### Required elements

1. A headline that states the promise, not the feature list
2. Plan selection — Standard and Pro, monthly and annual, Standard preselected
3. A short, concrete value list. Use the *computed* things (cost-per-wear,
   colour harmony, what you actually wear) — those are the differentiator
4. One oxblood subscribe button
5. **Restore Purchases** — App Store review rejects paywalls without it
6. Links to Terms and Privacy — also a review requirement
7. A dismiss affordance (this paywall is `gated`; dismissing means the action
   the user attempted does not happen, so the exit must be obvious and calm)

### Legal copy that must appear

Auto-renewing subscription terms: renews automatically unless cancelled at least
24 hours before the period ends, manageable in App Store settings. Set in
`faint`, small, legible. Do not hide it.

---

## 4. Four contexts, one paywall

This paywall is shown from four different moments. **Design v1 so that it reads
correctly from all four** — do not write copy that only makes sense in one.

| Placement | The user just tried to… | Emotional state |
| --- | --- | --- |
| `open_stylist` | Ask the stylist a question | Curious, mid-task |
| `add_garment_over_limit` | Photograph garment #31 | Invested — they're building their closet |
| `generate_outfit_over_limit` | Get another outfit | Engaged, using it daily |
| `trial_expired` | Open the app on day 15 | Neutral, being interrupted |

`add_garment_over_limit` is the strongest moment — someone who has photographed
30 garments has done real work and is the most likely to convert. **If you want
one variant beyond the default, make it that one.** Per-placement variants are
supported later; the campaign is already wired for all four.

---

## 5. Working constraints

- **No products exist yet.** App Store Connect products are blocked on the Paid
  Apps Agreement. Design against the prices in §3 as placeholders; the real
  product objects attach later without a redesign. Do not hard-code prices where
  Superwall can template them.
- **`fullscreen`, `gated`.** Both already set. Gated means the user gets no
  access by dismissing.
- **iOS only.** No Android layout needed.
- **The paywall is currently blank** — no template was applied on purpose.
  Superwall's stock templates are other apps' designs (VPNs, calorie trackers)
  and none of them are within a mile of this brand. Start from the tokens above,
  not from a template.

---

## 6. Do not

- Do not use urgency, countdowns, scarcity, or crossed-out "was $X" pricing
- Do not use more than one oxblood element
- Do not introduce a third typeface or a second accent for CTAs
- Do not use pure black `#000` or pure grey — every neutral here is warm
- Do not say "free trial" on the button (see §3)
- Do not add a dark mode
- Do not put the limit numbers in Superwall copy as authoritative — 30/150/1000
  are enforced server-side and could change; if Superwall supports templating
  them, template them

---

## 7. Reference

Full product brief with all screen descriptions: `docs/design-directive.md` in
the Cinch repo. Tier reasoning and unit economics: `docs/ai-models-and-tiers.md`.
Colour and type tokens in full: `tailwind.config.js`.
