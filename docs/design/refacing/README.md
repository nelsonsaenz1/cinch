# Handoff: Cinch — The Refacing (Reference Boards + AC Atlas)

## Overview
First tranche of "The Refacing" (master design directive, 2026-08-11): the four §4.1 reference boards that settle the app-wide arguments (button weight cut, stat-column centring, surface/radius resolution, the shared door plate), plus the complete new **AC atlas** — the Add Clothes entry chooser, states AC-01…AC-05. Remaining tranches (Today, Closet amendments, first-run spine) follow in later drops.

## About the Design Files
`Refacing Atlas.dc.html` and the PNGs in `renderings/` are **design references created in HTML** — they show intended look and copy, they are not production code. Recreate them in the Cinch codebase (`cinch-main`) using its existing patterns, components, and theme. **`tailwind.config.js` and `src/theme/tokens.ts` are read-only** — every value below must resolve to a token that already exists; if one doesn't (see Open Items), stop and flag, do not invent.

PNG and HTML come from the same run and cannot disagree (per §4.3 practice). Blue monospace blocks in the boards are build annotations, not app surface.

## Fidelity
**High-fidelity.** Colors, type sizes, weights, radii, and spacing are exact and drawn from the directive's constitution. Copy is set verbatim except where marked `[CLAIM: …]` — those strings MUST be resolved against the named contract file in the repo before shipping; never ship the placeholder or a plausible guess.

## Design Tokens (all pre-existing — names as in the directive §1.1)
- canvas `#FBFAF6` · surface `#FFFFFF` · tray `#F0ECE3` · sand `#EAE5DB`
- ink `#1C1A16` · muted `#6B665C` · faint `#8A8578` (decorative only — **never text**)
- rule `rgba(28,26,22,.12)` · hairline `rgba(28,26,22,.09)` · rule-strong `rgba(28,26,22,.28)`
- accent `#6E2B2B` (one action per screen) · blush `#F7EDE8` · blush-rule `rgba(176,138,118,.45)`
- Shadow (the one recipe): `0 5px 11px rgba(28,26,22,.16)` — warm ink, never pure black
- Radii: xs 2 · sm 4 · 8 · md 12 · lg 16 · plate 20 · sheet 38 · full = circles only
- Spacing: 1 · 8 · 12 · 20 · 24 · 28 · tap min 44. Design width 393pt.
- Type: Instrument Serif (display/titles/figures, one weight) + Helvetica Neue (regular + Medium ONLY — `font-semibold` resolves to Medium; never emit a numeric weight the face doesn't carry). Scale: colophon 10/1.4 · caption/eyebrow 11/0.1‖1.6 · label 13 · callout 16 · body 17 · heading 20/−0.2 · title/figure 28/−0.15 · display 40/−0.3.

## Boards

### Reference A — Button sheet (`ref-a-button-sheet.png`)
The §1.2 weight law: **filled** variants (`primary`, `ink`, `critical`) keep Medium 17; **outlined/text** variants (`secondary`, `ghost`, `inverse`) drop to regular 17. All labelled controls radius md 12 (no capsules — known violations to fix as pages are redrawn: stylist chat input, sign-in email input + "Continue with email", closet category chips). Height 52, tap ≥ 44. Shadow on primary only.

### Reference B — Stat-column sheet (`ref-b-stat-column-sheet.png`)
§2.2: in every equal-width figure-over-label strip, **both lines centre in the column**. Figures Instrument Serif 28/−0.15; labels 11/1.6 tracked uppercase Medium (LABEL). Item-detail band keeps per-column flex weights 1 / 1.4 / 1.3. Widest honest values must clear without wrapping ("$9.10", "1,204", "6 days"). Unworn is the only coloured figure (accent). The closet stat row and item-detail band are **documented flat bands** — rules top/bottom, radius 0, do not "fix" them. No bars, no percentages, anywhere.

### Reference C — Surface sheet (`ref-c-surface-sheet.png`)
Every container on every page resolves to exactly one of: documented flat band / md 12 / plate 20 / sheet 38. Inner radii computed concentrically (outer − inset), never eyeballed. No in-between radius.

### Reference D — Door plate (`ref-d-door-plate.png`)
Shared component for AC-01 and T-00. Surface plate r 20 + contact shadow; glyph tile 56×56 sand r md 12 (SF Symbol via SymbolView — SVGs in the HTML are placeholders); name Instrument Serif 20/−0.2; one descriptive line 13 regular (PROSE) in muted; whole plate is the tap target. Doors are never oxblood.

### AC atlas — Add Clothes entry chooser (`ac-atlas-01-05.png`)
New page, prefix **AC** (registered §4.2). Nav: "Add clothes" serif 28 left, "Cancel" ghost regular 17 right — never glass chrome. **Zero oxblood on AC-01** — the four doors are peers.

- **AC-01 default** — four door plates stacked, gap 12, page gutter 20: Camera "True colour, one piece at a time." · Photo Library "The pictures you already have." · Describe it "No photo to hand — say what it is." · Talk it in "Your whole closet, four minutes." Door lines are PROSE (regular).
- **AC-02 fifth slot, reserved** — dashed rule-strong r 20 empty slot, 96px. The "Lookup" door and its destination are deliberately **not designed** — open question for the founder (barcode/tag scan vs retailer catalogue search). Ship AC-01 as four doors until answered.
- **AC-03 camera denied** — the condition rides the door, stated before the tap: tray r 8 inline block inside the plate; "Open Settings" in accent is this page's one oxblood action. Sentence "Your photos stay put either way" = `[CLAIM: privacy-invite-help-contract.md]`.
- **AC-04 consent declined** — chooser fully drawn; consent sheet (r 38, scrim ink@40%) fires over it on first tap of a processing door. Title serif 28 "Before Cinch looks at your photos"; body = `[CLAIM: processing-consent sentence, privacy-invite-help-contract.md]`. Buttons: "Allow" primary Medium 17 (the one oxblood) · "Not now" ghost regular 17 (never "Decline"). Decline must not imply photo loss.
- **AC-05 at the ceiling** — chooser renders undimmed; every door tap routes to paywall MB-01. Gate order: capacity before consent, both before any picker. Tray notice md 12; copy = `[CLAIM: gate wording vs membership-packing-contract.md; ceiling 10 active / 30 stored per §1.8]`.

## Interactions & Behavior
- AC-01 door taps: Camera → live capture (existing Capture C-01 flow) · Photo Library → system picker into the same queue · Describe it → garment-search sheet (Describe D-01) · Talk it in → Walkthrough WK-01.
- AC-04 sheet: standard sheet presentation (durations fast 140 / base 220 / slow 380; existing spring vocabulary — no new motion annotated on this page). Dismiss = "Not now" or scrim tap; chooser state preserved.
- AC-05: no per-door disable states — plates stay interactive; the paywall carries the message.
- Every state has a dev route (refusal 14): suggest `/dev/ac/01`…`/dev/ac/05`.

## State Management
- Chooser needs: camera-permission status (denied → AC-03 inline condition), processing-consent status (unset → AC-04 sheet on processing-door tap), active-piece count vs ceiling (at ceiling → AC-05 routing). All read-only here; no state mutated by the chooser itself except consent acceptance.

## Assets
No raster assets. Instrument Serif via Google Fonts (already the app's display face). Glyphs are SF Symbols at the §1.4 role sizes; the inline SVGs are placeholders only.

## Open Items (returned to the founder / to resolve in-repo)
1. **Lookup** (AC-02): definition + destination undefined — do not build.
2. **`critical` button fill token**: §1.1 names none; resolve against `src/theme/tokens.ts` (drawn dimmed pending).
3. All `[CLAIM]` strings above: resolve verbatim against the named contract files.

## Files
- `Refacing Atlas.dc.html` — the atlas source (all boards, annotated)
- `renderings/ref-a-button-sheet.png` · `ref-b-stat-column-sheet.png` · `ref-c-surface-sheet.png` · `ref-d-door-plate.png` · `ac-atlas-01-05.png`
