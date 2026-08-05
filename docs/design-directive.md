# Cinch — Design Directive

**You are designing an iOS app called Cinch.** This document is the complete brief: what the product is, the exact design system to use, every screen and every state it can be in, and the format the deliverable must take. Follow the tokens literally — they are the values already compiled into the app, so anything you invent will have to be thrown away.

---

## 1. What Cinch is

Cinch is **a personal stylist for the clothes you already own**. You photograph your wardrobe once; every morning it builds outfits from your real garments, using the weather where you are, what is on your calendar, and what it has learned you actually wear.

It does **not** sell clothes and does **not** show you clothes you do not own. That constraint is the product.

### The competitive moat, and therefore the design's job

Cinch computes things its competitors (Whering, Indyx, Acloset) do not: cost-per-wear per garment, OKLCH colour-harmony scoring, and a local deterministic styling engine that ranks the entire wardrobe in ~10ms. **The design exists to make that computation visible.** Every outfit prints a colophon — date · city · feels-like · the palette in the engine's own colour names · $/wear — because no competitor can print that line.

### The identity: "The Plate"

The app is **a printed lookbook that regenerates every morning.** Not a dashboard, not a social feed. Each outfit is a numbered *plate*: a flat-lay of garments on warm paper stock, a cap-trimmed didone title, a 1px rule, and the colophon beneath.

The reference points are fashion print — magazine mastheads, lookbook plates, garment care labels — executed with iOS-native materials. Layout influences to draw on for *structure* (not for style): Instagram's tight square grids, Pinterest's board covers, X's clean dividers and dense information, Facebook's card sections.

### Tone

Confident, plain-spoken, never cute. The app tells the truth about what it knows: it says "3 more reactions and Cinch will start recognising your taste" rather than implying a rich model after two taps. Microcopy is sentence case, no exclamation marks, no emoji anywhere in the UI.

---

## 2. Design system — use these exact values

### 2.1 Colour

Light mode is the primary design target. Every screen must also work in dark mode.

**Surfaces**
| Token | Light | Dark | Use |
|---|---|---|---|
| `canvas` | `#FBF8F5` | `#061B24` | Page background |
| `surface` | `#FFFFFF` | `#0A2633` | Raised cards, sheets |
| `tray` | `#F5F0E8` | `#123243` | The flat-lay bed and tiles. **Must stay neutral-warm — it sits behind garment photos and must never tint them.** |
| `sand` | `#EDE7DB` | `#1B4254` | A tile that must sit back from the tray without a border |

**Type**
| Token | Light | Dark |
|---|---|---|
| `ink` | `#0A2633` | `#FBF8F5` |
| `muted` | `#6B665C` | `#93A5AF` |
| `hairline` | `#EDE7DB` | `#1B4254` |
| `rule` | `rgba(10,38,51,0.18)` | `rgba(251,248,245,0.20)` |

`ink` is a deep slate-navy, not black. Against warm paper a neutral black reads slightly green; the navy keeps the page from going cold and still clears 15:1 on canvas.

**Accent**
| Token | Light | Hover/Pressed | Dark |
|---|---|---|---|
| `accent` | `#2A6F97` | `#1E5A7D` | `#7FB3D3` |
| `accent-light` | `#E8F1F7` | — | — |
| `accent-warm` | `#C4976C` | `#B08558` | `#D6AE88` |

**Semantic** — used sparingly, never decoratively.
`positive #1A8754` · `warning #D4850A` · `critical #C0392B`

**Garment neutrals** — the wardrobe's own colours, used for illustrated clothing and nothing else. These are content, not chrome, and are the one place the palette above does not govern.

`navy #1f2a44` · `cream #efe6d2` · `camel #b58f5f` · `burgundy #5e2233` · `charcoal #36393d`

**Two colour rules that are not negotiable:**
1. **The accent is spent, not sprayed.** At most one accent-filled element per screen — the primary action. Everything else is ink, muted, or rule. A second accent element means one of them is not primary.
2. **The accent never goes on chrome.** Tab bars, navigation icons, and toolbars are monochrome ink/muted. Colour belongs to content.

**The complete palette is above. There are no other colours.**

The system these tokens derive from carries five more that Cinch deliberately does **not** use. They are listed so you recognise them as excluded rather than missing, and do not reintroduce them:

| Source token | Value | Why it is not here |
|---|---|---|
| `accent-teal` | `#2E7D7D` | A third hue. Two accents are already one more than most screens need. |
| `text-secondary` / `text-tertiary` | `rgba(0,0,0,0.80)` / `rgba(0,0,0,0.70)` | Cinch has one step down from ink — `muted`. Three tiers of grey text is a hierarchy nobody can perceive. |
| `border` / `border-strong` | `rgba(0,0,0,0.08)` / `rgba(0,0,0,0.15)` | Replaced by `hairline` (a whisper between list rows) and `rule` (the structural lookbook line). The distinction is editorial, not weight-based. |
| status backgrounds | `#E8F5EE` `#FFF3E0` `#FDECEA` | Tinted alert panels belong to a dashboard. Cinch states a problem in words on paper. |

If a design seems to need a colour that is not in the tables above, the answer is type, weight, or space — not a new hue.

### 2.2 Typography

Two families. React Native does not synthesise weights for custom fonts, so each weight is its own family.

- **Bodoni Moda** (didone serif) — display sizes only. **Never below 24px**; its hairlines break up.
- **Archivo** (condensed grotesque, true tabular figures) — everything else. Reads like a garment care label.

| Token | Family | Size | Line height | Tracking | Use |
|---|---|---|---|---|---|
| `wordmark` | Bodoni | 64 | 98 | −0.95 | The Cinch wordmark |
| `display` | Bodoni | 40 | 61 | −0.55 | Screen titles ("Today", "My Closet") |
| `title` | Bodoni | 28 | 43 | −0.33 | Section headings, empty-state titles |
| `plate` | Bodoni | 24 | 37 | −0.26 | Outfit names |
| `figure` | Archivo | 28 | 32 | −0.40 | Big numbers (stat tiles) |
| `heading` | Archivo | 20 | 25 | −0.45 | Card headings |
| `body` | Archivo | 17 | 26 | −0.43 | Body copy |
| `callout` | Archivo | 16 | 24 | −0.31 | Secondary body, reasoning text |
| `label` | Archivo | 13 | 18 | −0.08 | Captions, tile labels, detail lines |
| `caption` | Archivo | 11 | 14 | +0.06 | Fine print |
| `eyebrow` | Archivo | 11 | 14 | +1.10 | UPPERCASE tracked section markers |
| `colophon` | Archivo | 10 | 14 | +0.90 | UPPERCASE tracked data lines, tabular figures |

`eyebrow` and `colophon` are **uppercase**. Never set a proper noun or a garment name in them — "navy overcoat" becomes "NAVY OVERCO…". Use `label` for anything with a real name in it.

Titles are **cap-trimmed**: the line box collapses to cap height so a didone title optically aligns with the rule beneath it.

### 2.3 Spacing, radii, layout

**Spacing:** `hair 1` · `rhythm 8` (vertical baseline unit) · `bezel 12` · `gutter 20` (page margin — the measure) · `bare 24` · `section 28` (between plates) · `tap 44` (minimum touch target)

**Radii:** `xs 2` · `sm 4` · `DEFAULT 8` · `md 12` (buttons, fields, chips) · `lg 16` · `plate 20` (outfit plate, item card, tiles) · `sheet 38` (half sheets) · `full 9999` — **glass chrome only, never content**

**Concentric corners:** an inner radius equals the outer radius minus the inset between them. A 20px plate with 12px padding has an 8px inner radius. Mismatched curvature is one of the quiet tells of a non-native app.

**Grid:** one page margin of 20. The closet board is 3 columns: tile = ⌊(screenWidth − 40 − 20) / 3⌋, with 10px gaps.

### 2.4 Motion

| Preset | Duration | Damping | Use |
|---|---|---|---|
| `smooth` | 500ms | 1.0 | Default — plates, sheets, screen content |
| `snappy` | 450ms | 0.85 | Buttons, chips, selection |
| `bouncy` | 500ms | 0.7 | **Exactly once per screen.** The final garment landing in a flat-lay. Nothing else. |
| `interactive` | 150ms | 0.86 | Gesture release, drag snap-back |

Opacity and colour use ease-out-quint `cubic-bezier(0.22, 1, 0.36, 1)`, never a spring — a spring on opacity reads as a rendering glitch; this reads as print settling onto paper.

Stagger is 60ms. Everything must have a reduced-motion path that simply shows the end state.

### 2.5 Texture

One static desaturated fractal-noise grain at **2.5% opacity** over the whole canvas. Enough for the paper to read as stock, never enough to see as a texture.

---

## 3. Hard rules — violating these makes it not-Cinch

1. Never Bodoni below 24px.
2. Accent only on the primary action; never on chrome.
3. Capsules (`rounded-full`) on glass chrome only. Content uses 12/20.
4. `bouncy` exactly once per screen.
5. **No centred hero text.** Everything is set hard-left on the gutter. Centred title + centred body + centred button is the single most recognisable AI-slop layout.
6. **No icon-in-a-circle empty states.** Empty states are hard-left editorial: small glyph, didone title, body, action.
7. No emoji, no exclamation marks, no gradients, no drop shadows except the garment contact shadow (ink at 8%, 8px radius, 4px Y).
8. Never claim something happened before it did — a save that is in flight says so.

---

## 4. The screens

Structure: **three native tabs** (Today · Closet · Plan) on an iOS 26 Liquid Glass tab bar, monochrome, minimising on scroll down. Stylist and Profile are deliberately **not** tabs — a chat tab is the generic-AI tell. They open from the Today masthead.

### 4.1 Welcome / Sign-in — the cover

The first screen and the app's visual thesis.

- Wordmark "Cinch" (Bodoni 64), rule beneath
- Eyebrow: `Nº 01 — THE MORNING EDIT`
- One line of body: "A personal stylist for the clothes you already own."
- **The hero plate**: a flat-lay of five garments — navy overcoat, cream crew knit, camel trousers, burgundy scarf, charcoal derbies — as paper-cutout vector art on a tray, garments landing one at a time (coat, knit, trousers, shoes, scarf last with the one bouncy moment)
- A legend line set exactly like an outfit colophon: `PLATE 01 · NAVY / CAMEL / CREAM / BURGUNDY / CHARCOAL`
- Two actions: "Continue with Apple" (black, Apple-required styling), "Continue with email" (outline)
- Fine print: "By continuing you agree to our Terms and Privacy Policy"

States: idle · email entry (single field, keyboard up) · link sent ("Check your email") · error (expired link, rate-limited)

### 4.2 Today — the home tab, the activation moment

**Masthead:** date as tracked eyebrow (`TUESDAY · 4 AUG 2026`) with two muted icon buttons right (stylist bubble, profile avatar); "Today" in Bodoni 40, cap-trimmed; rule.

**Weather strip:** feels-like temperature, conditions, city, and today's first calendar event. Includes a "connect calendar" affordance when permission has not been granted.

**Note field:** an inline text input — "What's on today?" — with a small bubble glyph. This is the multi-event differentiator ("dinner at 7 then drinks after") and must not require a permission grant.

**The plates** (2–3 per day). Each plate, top to bottom:
1. Eyebrow: `PLATE 01 — dinner at 7`, with a right-aligned status when relevant (a spinner + "Styling" while the model works, or a bolt-slash + "Offline")
2. **The flat-lay**: garments on a tray, rounded 20, each garment flex-weighted by how much of the look it occupies so a coat anchors and a belt does not compete. Height 236.
3. Outfit name in Bodoni 24, cap-trimmed
4. Rule
5. **Colophon, two lines** — line 1: `4 AUG 2026 · BROOKLYN · FEELS 17°`; line 2: `NAVY / CREAM / CAMEL / CHARCOAL · $19.31 / WEAR`
6. One line of reasoning in callout/muted
7. Optional swap note in a bordered box
8. Reaction bar (like/dislike with reason) + "Wear it" button

Long-pressing a plate exports it as a 1080×1920 share card.

**States:** loading · **empty/under-10-pieces** (shows the same hero plate as the cover, then "Your first outfit is close", body, "Add clothes") · no-outfit-possible ("Nothing quite works today") · offline (engine outfits with a bolt-slash marker) · model-enhancing.

**Learning line** below the plates: "3 more reactions and Cinch will start recognising your taste." or "Learning from 12 reactions — it thinks you prefer structured over soft."

### 4.3 My Closet — the board

Set as a board, not a list.

1. **Masthead**: "My Closet" (Bodoni 40, cap-trimmed), rule, "24 pieces"
2. **Category board**: six **rounded squares in two rows of three** — Everything, Tops, Bottoms, Outerwear, Shoes, Accessories. Each tile is a square split into a 2×2 preview of the pieces inside (top ~⅔) and a caption strip (fixed 46px) carrying the label and the count. Selected tile is named by a 2px ink border and a sand fill — **not** an accent fill, which would out-shout the garments.
3. **The wardrobe grid**: 2-column, garment cutouts on tray, each card showing subcategory and either `$3.41 / wear`, `Never worn`, or `Worn 12×`. A "Needs review" chip on untagged items, and a colour swatch dot.
4. **Stat board**: "WHAT IT IS TELLING YOU" eyebrow, then **three tiles on the same square module as the categories** — Most worn (`41×` / "navy overcoat"), Never worn (`3` / "12% of closet"), Cost / wear (`$3.41` / "average"). These double as the sort control; tapping one sorts the grid.

**States:** loading (skeleton board) · empty · category-empty · needs-review present.

### 4.4 Item detail

Full-bleed garment image on tray (square), name in Bodoni 28, description, then a bordered stat row: Wears · Cost/wear · Paid. Occasion chips. Eventually: edit tags, mark for sale, delete.

### 4.5 Plan — the week

Seven day rows. Each row: the weekday and date, the day's weather, and either a planned outfit (a miniature flat-lay strip with garment names) or an empty affordance. A "Plan the week" action generates a week at once with no piece repeated within two days. Packing mode for a date range.

**States:** loading · empty closet · week planned · partially planned.

### 4.6 Stylist — a sheet, not a tab

Opens from the Today masthead as a form sheet (¾ height, 38px corners, native grabber).

Message thread: user messages right-aligned in a filled bubble, assistant left-aligned plain. Suggested prompts as chips when empty ("What goes with these boots?", "Dinner at 7, drinks after"). Input field pinned at the bottom. When the stylist proposes an outfit, it renders as a small plate inside the thread and tapping it takes you to Today.

**States:** empty (suggested prompts) · thinking · answered-with-outfit · answered-with-text · consent-required · offline.

### 4.7 Capture — adding clothes

Two big actions: "Take photo" and "Choose from library" (multi-select). Then an upload queue list showing each photo's stage — uploading → tagging → done — with a progress bar. Background removal runs on device; failure is non-fatal.

**States:** idle · consent sheet (first run) · uploading · tagging · partial failure · complete.

### 4.8 Review — confirm the AI's tags

A card deck. Each card: the garment, the AI's proposed category/subcategory/colours/occasions as editable chips, and two clear outcomes — **swipe right to confirm, swipe left to skip**. Both must also exist as visible buttons for VoiceOver. A skip writes nothing and the item returns next visit.

**States:** queue · all-caught-up · confirm failed (item returns with a retry banner).

### 4.9 Profile — a modal

Sections: the user's style summary; **AI features** (with a clear consent-withdrawal control that names what stops working and what keeps working); links to Privacy, Terms, Support; Sign out; Delete account (destructive, with a confirmation that never claims a rollback).

### 4.10 The share card — 1080×1920

A fixed print layout, 9:16, exported from a long-press on any plate. Masthead "Cinch" + rule + `THE MORNING EDIT`, the flat-lay, the outfit title, rule, the colophon block, and `CINCH · cinch.app` at the foot. Always the light paper palette regardless of device appearance. This is the artifact that markets the app — treat it as the most important single composition in the product.

---

## 5. What to deliver

Produce a **zip** containing:

```
/tokens.json           all colours, type, spacing, radii, motion as data
/screens/*.html        one self-contained HTML file per screen state
/README.md             a short map of what is in the zip
```

**Requirements for each screen file:**
- Self-contained: inline CSS, no external fonts, no CDN links. Substitute Playfair Display or Didot for Bodoni Moda and any grotesque for Archivo, and say so in the README.
- Sized to **402 × 874 pt** (iPhone 17 Pro logical points). Long screens may exceed the height.
- Use the exact token values from §2. Do not invent colours.
- Include both light and dark for at least: Today (populated), My Closet, and the share card.
- Garment images: use flat vector shapes or neutral placeholders in the wardrobe neutrals — navy `#1f2a44`, cream `#efe6d2`, camel `#b58f5f`, burgundy `#5e2233`, charcoal `#36393d`. Do not use photographs.

**Cover every state named in §4**, not just the happy path. The empty, loading, offline and error states are where an app is actually judged.

**Do not** redesign the identity. Do not propose a different palette, a different typeface pairing, or a bottom sheet where a modal is specified. If something in this brief seems wrong, note it in the README and design it as specified anyway.
