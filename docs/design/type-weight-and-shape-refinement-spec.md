# Type weight, stat-number alignment & shape — refinement spec

**Written 2026-08-11.** Not a new atlas — every page this touches already has
one. This is a design-QA pass across pages that are already built, correcting
three things the founder flagged by eye against the shipped app:

1. Small text (captions, labels, button labels) reads bolder than a print
   lookbook should. Header-weight text is fine as-is — the complaint is
   specifically at caption/label/button size.
2. Stat figures (Outfits, Pieces, Followers, Wears, etc.) sit left-aligned in
   their column instead of centered.
3. Several flat, rules-only surfaces could use more shape — more of the
   rounded-plate/card language the rest of the app already speaks.

Where this doc and a page's own atlas disagree on a *drawn* value (an atlas
states a literal weight or radius), the atlas wins — flag the conflict rather
than silently overriding it. Where the atlas is silent (most captions and
stat rows are, per the note below), this doc is the tiebreaker.

---

## 1 · Small text is heavier than it should be

### The token, and why it happened

`src/components/ui/text.tsx` maps each `<Text variant>` to a font family.
Instrument Serif (headers, titles, plates) ships one weight, so it's not in
play here. Helvetica Neue does carry real distinct cuts, and the app defines:

```
body:     HelveticaNeue          — regular
medium:   HelveticaNeue-Medium   — the only "heavier" cut the face has
semibold: HelveticaNeue-Medium   — same file as `medium`; there is no true 600
```

`label` (13px) and `caption` (11px) — the two variants that back most small
UI text — are both set in `font-medium`. That was the right call for what
they were *built* for: tracked labels and buttons, the things an atlas draws
at `font-weight:500`. It is the wrong call for running secondary prose at the
same size — a caption or a byline set in medium reads as bold grey shouting
something that was meant to be murmured. `text.tsx` already says as much in
its own comment above the `note`/`noteSmall` variants, which exist specifically
as the regular-weight escape hatch:

```
note:       font-body text-label text-muted    — secondary prose, 13px, regular
noteSmall:  font-body text-caption text-muted   — secondary prose, 11px, regular
```

**The escape hatch exists but adoption is partial.** `label`/`caption` appear
at **485 call sites** across `src/`; `note`/`noteSmall` at **114**. Not every
one of those 485 is wrong — a genuine tracked eyebrow or a data colophon is
supposed to carry weight — but the ratio says most of the app's plain
secondary text never got moved to the regular-weight variant that was built
to hold it.

### Buttons specifically

`src/components/ui/button.tsx` sets every button's label at
`variant="body"` (17px) with `className="font-semibold"` — three separate
call sites (the sand cross-fade label, the loading-state label, the resting
label), all HelveticaNeue-Medium. There is no regular-weight button label
anywhere in the app today.

### What to do

**A. Buttons.** Decide, per variant, whether the label should carry weight at
all. Recommendation: keep `font-semibold` on `primary`/`ink`/`critical` (a
filled button's label doing real work benefits from the extra presence at
17px) and drop to `font-body` (regular) on `secondary`/`ghost`/`inverse` —
the outlined and text-only variants, which read as UI chrome, not a call to
action, and currently look identically weighted to the primary button next
to them. Confirm the exact per-variant cut against the founder's eye before
committing; this is a judgment call the spec can't make from a token file
alone.

**B. Everything set in `label` or `caption` that is prose, not a UI label.**
Audit call sites for wording that reads as a sentence or a caption under an
image — "Cost per wear", "Last worn Tuesday", helper text under a form
field, empty-state body copy — and move it to `note`/`noteSmall`. Leave
`label`/`caption` on things that are genuinely labels: chip text
(`chip.tsx:163`), form field labels, badge text.

**C. Tracked eyebrows and colophons stay as they are.** `eyebrow` and
`colophon` (`section-header.tsx`, `screen-header.tsx`, the closet/item stat
labels) are uppercase and letter-spaced; medium weight is standard practice
there and keeps them legible at 9–11px with tracking applied. Not part of
this pass.

**D. Do not add a new weight token.** Helvetica Neue has exactly two cuts
available to this app (`body`, `medium`); resist the temptation to reach for
`font-bold` or a numeric `fontWeight` — RN will synthesize a weight the face
doesn't have, and `text.tsx`'s own header comment already warns against it
("do not lean on `fontWeight`; name the family").

---

## 2 · Stat numbers aren't centered in their column

Two shipped components put a figure over a label in an equal-width column
and neither centers either line — both default to the flex-column's natural
left alignment:

**`src/components/closet/stat-row.tsx`** — the closet header's four-column
strip (Pieces / Outfits / Unworn / Followers). Each `Stat` is a
`className="flex-1"` column with a serif figure and a colophon label, no
`alignItems` or `textAlign` set.

**`src/components/item/item-stats.tsx`** — item detail's three-figure band
(Wears / Cost per wear / Since last worn). Each `Cell` is a
`style={{ flex: weight }}` column, same gap: no centering on either line.

### Fix

Add `alignItems: 'center'` to the column container (`Stat`'s `View`,
`Cell`'s `View`) and `textAlign: 'center'` to both the figure and the label
`<Text>`. Confirm against each page's underlying rule/band width that a
2–3 digit figure plus its label still clears the column without wrapping —
`item-stats.tsx` already documents per-column flex weights (`1` vs `1.4`)
specifically because "$9.10" is wider than "38"; centering shouldn't be
allowed to reintroduce that crowding.

**Audit for the same pattern elsewhere** before treating this as done — any
other equal-width stat strip in the app (profile stats, friend's-closet
stats, the share-card collage's printed figures) built the same way inherits
the same left-alignment default and should get the identical fix. This spec
names the two confirmed instances; a full sweep may find more.

---

## 3 · More shape

The radius scale already exists and is deliberate
(`tailwind.config.js`):

```
xs: 2px    sm: 4px    DEFAULT: 8px    md: 12px    lg: 16px
plate: 20px   sheet: 38px   full: 9999px (circles & glass chrome ONLY)
```

and carries a hard rule: `full` never goes on a labelled, wider-than-tall
control — that's a capsule, and the design explicitly rejects the
consumer-app capsule look. Labelled controls are `md` (12px), full stop.

This section is **not** a request to touch that scale. It's a prompt to
audit for surfaces that use *no* radius at all — flat, rules-only bands that
could take some of the shape the rest of the app already has:

- **`item-stats.tsx`**'s three-figure band is bounded by two straight
  `border-y` rules, deliberately drawn flat "so it reads as a ruled band of
  a page and not as a card" (the component's own comment). Leave this one —
  it's a documented choice, not an oversight.
- **`stat-row.tsx`**'s four-column strip is the same pattern, same reasoning
  (a "follower strip," not a card).
- Beyond those two — which read as intentionally flat and are called out
  above so they're not "fixed" by mistake — look for containers that are
  neither a `plate`/`sheet` card nor a documented flat band: raw `<View>`s
  with a background color and no `rounded-*` class at all. Those are the
  actual candidates for "a little more shape." This spec doesn't have a
  verified list of them; that's the first thing to build before drawing
  anything, the same way `reframe-atlas-status.md` audited atlas coverage
  before Wave 1 started.

**Recommendation for that audit:** default new or newly-rounded containers to
`rounded-md` (12px) unless they're plate-scale content (use `rounded-plate`,
20px) or a sheet (`rounded-sheet`, 38px). Don't invent a fifth size to split
the difference — the whole point of a concentric scale is that everything on
screen resolves to one of a small number of curves.

---

## 4 · Out of scope

- Colour, spacing, motion — untouched by this pass.
- Any page still gated on a missing atlas (the Walkthrough / Procession /
  silhouette library — see `silhouette-directives.md`) or a new page with no
  atlas at all (the capture-entry chooser — see
  `capture-entry-spec.md`). Both get their type and shape from this spec once
  built, but building them is separate work.
- Anything an atlas draws explicitly at a stated weight or radius. This spec
  governs the pages and elements where the atlas is silent — which, per the
  485-vs-114 call-site count above, is most of the small text in the app.

## 5 · Acceptance

- [ ] Button label weight decided per variant (A) and applied everywhere
      `button.tsx` sets a label — not per screen.
- [ ] `label`/`caption` call sites carrying prose (not literal labels) moved
      to `note`/`noteSmall`.
- [ ] `stat-row.tsx` and `item-stats.tsx` centered; a sweep confirms no other
      stat strip was missed.
- [ ] A short written list of "flat containers that should gain shape" exists
      before any radius classes are added — not a blind find-and-replace.
- [ ] Nothing drawn explicitly by an atlas was changed without flagging the
      conflict first.
