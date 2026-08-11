# The flat-container list — audit items 44 & 45

**Written 2026-08-11.** This is the artefact
`type-weight-and-shape-refinement-spec.md` §3 asks for before any radius class
is added:

> This spec doesn't have a verified list of them; that's the first thing to
> build before drawing anything.

and its acceptance criterion:

> A short written list of "flat containers that should gain shape" exists before
> any radius classes are added — not a blind find-and-replace.

**No radius was added.** The list is the deliverable, and what it found argues
against drawing rather than for it.

---

## The result, first

The spec's §3 premise is that "several flat, rules-only surfaces could use more
shape". **After verification, essentially none exist.** One candidate survived,
and it is a judgment call the spec does not settle — recorded below, not acted
on.

The app already speaks the radius language consistently. That is a finding
worth having: it means the "everything looks flat" impression, if it persists,
is not coming from missing radii and the next place to look is elsewhere.

## How the list was built, and why the first pass was wrong

The naive search — a `className` carrying a background colour and no
`rounded-*` — returned **79 hits across 49 files**. That number is worthless,
and the reason it is worthless is the useful part of this document:

| Why it was a false positive | Example |
| --- | --- |
| Radius set through `style`, not a class | `plate-thumb.tsx:63` — `style={{ borderRadius: radius }}` |
| Radius set through a **named style constant** | `message-bubble.tsx:218` — `style={USER_BUBBLE}`, and `USER_BUBBLE` carries it |
| Clipped by a parent with `overflow-hidden` + a radius | `match-sheet.tsx:463` and `:840`, `FriendItemSheet.tsx:103` |
| Not a raw `<View>` at all — a `Card`, which is `rounded-plate` | `profile.tsx:346`, `preferences-view.tsx:126` |
| The fill inside a rounded track, not a container | `insight-card.tsx:53` — the progress bar's ink fill |
| Full-bleed page ground or edge-anchored bar, where a radius would be wrong | every `absolute inset-x-0 bottom-0 … bg-canvas` action bar; `flex-1 bg-ink` |
| `dev-*` screens — development scaffolding, not shipped UI | 24 of the 79 |

Filtering those left **13**. Checking all 13 by hand left **1**.

So: a search on class strings alone cannot answer this question in this
codebase, because radius is legitimately expressed four different ways. Anyone
re-running this must read the whole JSX element and its parent, not the
`className`.

## The one surviving candidate

**`src/components/ingest/garment-search-sheet.tsx:397`** — the product-image
well inside "What Cinch found".

```tsx
<Card fill="none" className="mt-3">
  <View className="aspect-[4/5] w-full bg-tray">
```

It is a raw `<View>` with a tray ground and no radius, and its parent `Card`
does not clip it (`Card` only sets `overflow-hidden` when `padding="none"`, and
this one is padded). So its corners really are square, inset inside a
`rounded-plate` card.

**Not changed, deliberately.** Whether an inset image well should be square or
`rounded-md` is a visual judgment the spec does not make, and §3's own guidance
cuts both ways: the default for a newly-rounded container is `rounded-md`, but
the two flat bands it names are flat *on purpose* and it warns against "fixing"
them by mistake. An image well behind a product shot on white is plausibly the
same kind of deliberate. One element is also not worth spending a founder
decision on in isolation — it should be folded into whichever atlas covers this
sheet when Wave 3 reaches it.

## Confirmed flat on purpose — do not "fix"

Restated from §3 so a future sweep does not undo them:

- **`item-stats.tsx`** — the three-figure band, bounded by two straight rules,
  "so it reads as a ruled band of a page and not as a card". The component says
  so itself.
- **`stat-row.tsx`** — the closet's four-column strip, same reasoning: a
  follower strip, not a card.

## Also out of scope, and why

- **Full-bleed grounds** (`flex-1 bg-ink` in capture, reveal, the Tour
  chrome) — these are the page, not a container on it.
- **Edge-anchored action bars** (`absolute inset-x-0 bottom-0 border-t …`, and
  `GarmentCard.tsx:313`'s pinned footer tray, which is edge-anchored without
  being `absolute`). A radius on a surface flush to the screen edge shows the
  page through the corner.
- **`dev-*` screens.** Scaffolding. If they ever become shipped surfaces they
  come back into scope.

## Re-running this

The detector used is not committed as a script because its value was in being
read and corrected, not in being re-run blind. If it is rebuilt, the four
false-positive classes in the table above are the acceptance test: a detector
that reports `message-bubble.tsx:218` or `profile.tsx:346` is wrong.
