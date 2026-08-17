# Redesign reference manifest

Twelve HTML bundles, twelve PNG sheets, exact 1:1 pairing by name. Nothing in
this drop is unpaired and nothing is ambiguous — every reference maps to a named
app surface. The open questions are about *scope and sequencing*, not about
which file depicts what.

Ingested 2026-08-08 from the repo root into `design-refs/html/` and
`design-refs/png/`. Source zips left in place at the root.

## The pairing

| # | HTML bundle | PNG sheet | App surface | Route / file | State of the code |
|---|---|---|---|---|---|
| 1 | `Closet State Atlas` | `Closet State Atlas.png` | My Closet | `src/app/(tabs)/closet.tsx` | **Built to an EARLIER cut of this same atlas** — see Re-cuts below |
| 2 | `Today State Atlas` | `Today State Atlas.png` | Today / The Morning Edit | `src/app/(tabs)/index.tsx` | **Built to an earlier design** (`docs/design/today-atlas/`, a different document) |
| 3 | `Look Board State Atlas` | `Look Board State Atlas.png` | Event look board + voting | `src/app/event/[id]/outfits.tsx` | Built to a written spec, **no atlas** |
| 4 | `Share a Look State Atlas` | `Share a Look State Atlas.png` | Post a look to an event | `src/app/event/[id]/post.tsx` | Built to a written spec, **no atlas** |
| 5 | `Event Detail State Atlas` | `Event Detail State Atlas.png` | Event detail, three viewer roles | `src/app/event/[id]/index.tsx` | Built; atlas provenance unclear |
| 6 | `Event Comments State Atlas` | `Event Comments State Atlas.png` | Event comment thread | `src/app/event/[id]/comments.tsx` | Built to a written spec, **no atlas** |
| 7 | `Invite Friends State Atlas` | `Invite Friends State Atlas.png` | Invite sheet on an event | `src/app/event/[id]/invite.tsx` | Built to a written spec, **no atlas** |
| 8 | `The Ten State Atlas` | `The Ten State Atlas.png` | **Directive 1** — guided capture | *no route yet* | **Not built** |
| 9 | `The Reveal State Atlas` | `The Reveal State Atlas.png` | **Directive 2** — tenth piece, first real outfit | *no route yet* | **Not built** |
| 10 | `The Gap Feed State Atlas` | `The Gap Feed State Atlas.png` | **Directive 3** — locked computed suggestions | *no route yet* | **Not built** |
| 11 | `The Wall State Atlas` | `The Wall State Atlas.png` | **Directive 4** — the eleventh piece | *no route yet* | **Not built** |
| 12 | `The Repeat State Atlas` | `The Repeat State Atlas.png` | **Directive 5** — the repeated outfit | *no route yet* | **Not built** |

Rows 8–12 are the five free-tier directives commissioned on 2026-08-08 and
recorded in the Google Doc "Cinch — The Ten: Design Directives". They are the
reason this drop exists; rows 1–7 arrived with them.

## References that could not be confidently assigned

**None.** Every bundle names its surface in its own eyebrow line
(`Cinch · Closet screen · build reference`), and every PNG matches a bundle by
exact filename.

## App surfaces with no reference in this drop

These are covered by earlier atlases already archived under `docs/design/` or in
`Design zips:pngs/`, and are **out of scope** unless you say otherwise:

Welcome / sign-in / code / name · Capture · Describe · Review deck · Stylist ·
Plan · Explore · Profile & settings · Storage · Privacy · Borrowing ·
Friends index · Friend closet · Item detail · New occasion · Match & confirm ·
Share card · Paywall · AI consent · Queue · Lately

One genuine gap worth naming: **the paywall**. Four of the five new directives
end in an upgrade prompt, and the Superwall paywall copy still tells the old
thirty-item story. No reference in this drop covers it.

## Re-cuts (rows 1–2)

The Closet atlas in this drop is **not** the one the current closet was built
from. Diffed against `docs/design/closet-atlas/`, the empty state has been
rewritten: the old "Add your closet" scrim over dashed placeholders is replaced
by an **example closet** — real garment photography behind a fading scrim, a
`AN EXAMPLE CLOSET` pill, and "Photograph six pieces and yours looks like this."
That is a deliberate revision in the same direction as the free-tier work: show
the product working before asking for labour.

Today is a fresh standalone atlas; the screen was built from the older combined
`Cinch.dc.html`. Delta unknown until read.

Neither is a rebuild from zero. Both are **diff-and-reconcile** jobs.

---

## Addendum — the four launch features, retrieved 2026-08-17

The manifest above documents the 8 August drop. The four features shipped or
completed since then are recorded here. All four now have a local HTML export, a
local PNG export and an acceptance record, which they did not before: Daily
Social and Private Circles existed only as `*-ATLAS-SOURCE.md` pointers at a
live claude.ai project, on the stated principle that "source of truth is the
LIVE atlas, not a local export". That principle is fine until the project is
unreachable, so the exports are now pinned here as well.

Retrieved through the signed-in browser from the projects named in each source
record, as `design-refs/` folder exports:
`Cinch Daily Social Atlas.zip` (1 740 792 bytes) and
`Private Circles design atlas.zip` (1 665 910 bytes).

| Feature | HTML | PNG | Frames | Acceptance record | Implementation |
|---|---|---|---|---|---|
| **Daily Social** | `Cinch Daily Social Atlas.dc.html` + `DS-*.dc.html` | `png/DS-*/` | 10 (12 PNGs — DS-06 and DS-07 have resting/chosen and off/on) | `DAILY-SOCIAL-ATLAS-SOURCE.md`, founder-accepted, paired to branch contract `73cfabb` | `src/components/daily-social/`, `src/features/daily-social/` |
| **Private Circles** | `Cinch Private Circles Atlas.dc.html` + `PC-*.dc.html` | `png/PC-*/` | 14 | `PRIVATE-CIRCLES-ATLAS-SOURCE.md`, shipped 2026-08-17 at `37b459a` | `src/app/groups/`, `src/components/circles/`, `src/features/circles/` |
| **Activity Center** | `32 Notifications - Activity Atlas.dc.html` | `png/32-notifications/` | 5 (N-01…N-05) | 8 August drop | `src/app/activity.tsx`, `src/features/activity/`, `src/components/activity/` |
| **Outfit Saving** | `35 Saved Plates - Boards Atlas.dc.html` | `png/35-saved-plates/` | 5 (B-01…B-05) | 8 August drop | `src/features/styling/use-favorite-outfits.ts`, `src/components/closet/favorite-outfits-rail.tsx`, `src/app/repeat-outfit.tsx` |

**Pairing verified mechanically, not by eye.** Every one of the 24 `DS-*` and
`PC-*` HTML frames has a matching PNG directory containing at least one export;
unpaired frames: **zero**. The AX variants are present as their own frames
(`DS-02-AX`, `DS-03-AX`, `PC-03-AX`, `PC-06-AX`) rather than folded into their
base frame, so Dynamic Type behaviour is a drawn artifact and not a note.

`ios-frame.jsx` and `support.js` arrived in both exports and are the shared
rendering harness the `.dc.html` frames import. They are kept because the HTML
does not render without them.

---

## Correction to the addendum above — the dedicated AC/OS atlases (2026-08-17, later)

The addendum mapped **Activity Center** to `32 Notifications - Activity Atlas` and
**Outfit Saving** to `35 Saved Plates - Boards Atlas` from the 8 August drop.
That mapping is superseded. Two *dedicated* Claude Design projects exist, both
updated roughly 14 hours before this retrieval, and they are the current design
truth for those features:

| Project | Frames | Contract |
|---|---|---|
| Cinch Activity Center Atlas | `AC-01` … `AC-10` + `Atlas.dc.html` | `ACTIVITY-CENTER-IMPLEMENTATION.md` |
| Outfit Saving Atlas | `OS-01` … `OS-10` | `OUTFIT-SAVING-HANDOFF.md` |

Retrieved as folder exports: `Cinch Activity Center Atlas.zip` (1 550 152 bytes)
and `Outfit Saving Atlas.zip` (4 266 246 bytes). The 8 August sheets are not
wrong, they are older and narrower; they stay in place as the earlier cut.

**Also correcting an earlier claim of mine.** A previous review recorded that
"AC" means *Add Clothes* and not Activity Center. That is true of
`docs/design/refacing/README.md`, where AC-01…AC-05 are the Add Clothes entry
chooser — and false as a general statement, because in this atlas `AC-01`…`AC-10`
are Activity Center. Two documents, two meanings, and the prefix alone does not
disambiguate them.

### Coverage, verified mechanically

44 HTML frames and 44 PNG directories across the four features — DS 10, PC 14,
AC 10, OS 10 — with **zero unpaired frames**.

### Implementation gap — the shipped features are an earlier cut

This is the part that matters for planning, and it is measured rather than
assumed. Both features exist in `main` and ship today, but neither matches its
new atlas:

| Atlas requirement | Shipped state |
|---|---|
| `AC-10` clear-all destructive confirmation | **absent** — no `clear all` / `dismiss all` path in `src/app/activity.tsx`, `src/features/activity/`, or `src/components/activity/` |
| `AC-08` grouped older state | **partial** — `retention.ts` bounds the window at 30 days, but there is no grouped-older presentation |
| `OS-05` create / rename / delete collection | **absent** — no "collection" concept anywhere in `src/features/styling/` or `src/components/closet/`; the nearest shipped primitive is `boards` |
| `OS-08` saved look → Plan with manual fallback | not verified |

So "Activity Center and Outfit Saving are already implemented" — true of the
earlier cut — should not be read as "the atlases are satisfied". Closing the gap
is feature work with its own schema, RLS, pgTAP, tests and screenshot passes, not
a reconciliation task, and it is **not** done here.
