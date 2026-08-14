# The free-tier contract

The frozen shared layer for the five free-tier directives — The Ten, The Reveal,
The Gap Feed, The Wall, The Repeat. Written at Phase 0 from the twelve atlases
in `design-refs/`, and **read-only to every implementation agent**.

The five atlases are not five independent designs. They are five renderings of
one number, and The Ten says so outright:

> Every number on these screens — 14, 16, 18, 12 — comes from the same routine
> that Directives 2, 3, 4 and 5 read. If it cannot be computed for this user, it
> does not appear.

That routine is what this document specifies. Nothing else in this wave is
genuinely shared; the components are per-unit.

---

## 1 · The counting function

### What it counts

**Distinct outfit cores.** A core is either:

- a top, a bottom and a pair of shoes, or
- a dress and a pair of shoes.

For a tally of `T` tops, `B` bottoms, `D` dresses and `S` pairs of shoes:

```
cores = T × B × S  +  D × S
```

The canonical ten — 3 tops, 2 bottoms, 1 dress, 2 shoes, 1 coat, 1 bag — gives
`3×2×2 + 1×2 = 14`.

**Outerwear, mid-layers, bags and accessories are never counted.** The Gap Feed
states the rule: *"Layers and bags dress an outfit; they don't create one. Never
ranked as a gain."*

### Why cores, and not the engine's candidates

`generateOutfits()` in `src/lib/styling/generate.ts` is pure, local and runs in
milliseconds, so evaluating a hypothetical closet is genuinely cheap — that part
of the atlas's ambition is affordable. But its output must **not** be counted
directly, for three reasons found at Phase 0:

1. **It would double-count layers.** Stage C pushes both `[...base]` and
   `[...base, outer]` into the pool (`generate.ts:135`). Counting candidates
   would let a single coat manufacture outfits, which the Gap Feed forbids.
2. **It would make the number weather-dependent.** `wantsOuterwear` and
   `allowsMidLayer` are derived from `ctx.weather`. A closet that "makes
   fourteen outfits" would quietly make a different number on a cold day. The
   app prints this figure as a durable fact about a wardrobe; it cannot move
   with the forecast. Counting cores sidesteps this entirely, because weather
   only ever affects layers.
3. **It truncates.** `BEAM_CORE 48 / BEAM_SHOD 64 / BEAM_FINAL 40`, and
   `selectDiverse` returns at most `count`. The generator is built to shortlist,
   not to enumerate.

### The "suggestible outfits" clause

The Reveal requires:

> Combinations the engine would refuse are not counted. The number on the reveal
> and the number of plates the user can actually reach must never diverge.

**There is no refusal predicate in the codebase.** `score.ts` ranks candidates;
it never rejects one. So today the clause is satisfied by construction: every
core is reachable, and cores = suggestible.

This is the one place the atlases contradict themselves — the prose says
"post-filter" while every worked example in all five documents is plain
arithmetic (`3×2×2 + 1×2`, `3×2×3 + 1×3`, `4×2×2 + 1×2`). The arithmetic wins,
because it is what the design actually computes and because a score floor would
make the headline number drift after any change to weights or affinities, with
no cause the user could see.

**If a score floor is ever introduced, this function is the single place that
has to learn about it.** Do not scatter the knowledge.

### The API

One module, `src/features/closet/outfit-count.ts`, exporting pure functions over
a tally — never over the network, never inside a component.

```ts
/** Counted garments only. Outerwear, bags and accessories are absent by design. */
export type Tally = { tops: number; bottoms: number; dresses: number; shoes: number };

/** The headline number. */
export function countOutfits(t: Tally): number;

/** A tally from the user's real closet, bucketed by the styling engine's slots. */
export function tallyOf(wardrobe: Garment[]): Tally;

/** What one more piece of `kind` would produce, and the gain over today. */
export function gainFrom(t: Tally, kind: CountedSlot): { total: number; gain: number };

/** Every kind ranked by gain, descending. Ties keep declaration order. */
export function rankGaps(t: Tally): Array<{ kind: CountedSlot; total: number; gain: number }>;
```

`mid_layer` maps to **tops** for counting (a jumper worn as the top layer is a
top). `outerwear` does not. This distinction already exists in the engine's
`Slot` union — do not invent a parallel one.

### Numbers this must reproduce

Every figure printed in the five atlases, as a test table:

| Closet | Expected | Source |
|---|---|---|
| 3T 2B 1D 2S | 14 | The Reveal R-02 |
| 4T 2B 0D 2S | 16 | The Reveal R-04; the adaptive acceptance mix (§2a) |
| 3T 3B 0D 2S | 18 | — (was The Ten T-04) |
| 3T 2B 0D 2S | 12 | — (was The Ten T-04, "keep the slot open") |
| 3T 2B 1D 3S | 21 | The Gap Feed, The Wall |
| 3T 3B 1D 2S | 20 | The Gap Feed |
| 4T 2B 1D 2S | 18 | The Gap Feed |
| 3T 2B 2D 2S | 16 | The Gap Feed |
| 10T 1B 0D 1S | 10 | — |
| 8T 1B 0D 1S | 8 | The Gap Feed G-05 ("3 outfits") — **see below** |
| 10T 0B 0D 0S | 0 | The Reveal R-05 |

**One atlas number does not reproduce and is a known delta.** G-05 describes
"Eight tops, one pair of shoes, one skirt" and quotes 3 outfits, then 6 after a
second bottom. `8×1×1 = 8`, not 3; `8×2×1 = 16`, not 6. The prose ("every outfit
you have runs through that skirt", "it doubles everything") is right in shape and
wrong in arithmetic — it reads as illustrative copy rather than a computed
figure. **Build the state; compute the numbers.** Do not hardcode 3 and 6 to
match the picture. Flagged to the founder.

### Where the number may appear

Only where it can be computed for that user. Never as a marketing constant, and
never recomputed independently by a screen. Four surfaces quote it — The Reveal,
The Gap Feed, The Wall, The Repeat — and The Ten's adaptive card derives one
hypothetical from it (§2a).

---

## 2 · The slot model — SUPERSEDED 2026-08-14

> **This section is retained as historical design evidence and is no longer
> implemented.** It records what the Wave 3 Hallway atlas authoritatively drew
> and what shipped until the adaptive correction below. The atlas itself
> (`docs/design/wave-3-final/Wave 3 - Design · First-Run Hallway.dc.html`) is
> unmodified and remains the authority for everything it draws EXCEPT the named
> slot template and T-04. Read §2a for what the code now does.

The ten are named before anything is photographed: **3 tops, 2 bottoms, 1 dress,
2 shoes, 1 outerwear, 1 bag.** Two of those slots — outerwear and bag — are
*not counted* but *are required*, which is not a contradiction: they finish an
outfit without creating one, and The Ten's ninth state says so ("Cinch can't
style you until the bag is in — every outfit it builds finishes with one").

Rules that bind every unit:

- **Order is a suggestion.** Any slot can be tapped directly at any time. The
  foregrounded slot is a recommendation, never a gate.
- **Every slot can be declined**, and declining *redirects* the slot rather than
  dropping it. The redirect options carry their computed counts (T-04), from
  `countOutfits`, not from a table.
- **Progress is a count, never a percentage or a bar.** "Four of ten."
- **Nothing is ever lost.** No copy in any of these five surfaces may imply a
  photograph, wear record or cost figure will be deleted. Storing is reversible
  and says so on the screen where it happens.
- **Exactly one oxblood action per screen.**

---

## 2a · The slot model — adaptive (approved 2026-08-14)

### Why the named template was withdrawn

It failed a real tester. He photographed three tops, a hoodie, two pairs of
trousers, two pairs of shoes, a watch and one more piece — a good starter closet
by any measure, **sixteen** computed cores — and the grid spent the whole flow
telling him he was wrong about his own wardrobe, because it had decided in
advance that he owned a dress and a bag. Two further defects fell out of the
same root cause:

1. `plannedTally` counted a **plan**, not a closet, so the flow could quote
   fourteen outfits over ten positions nobody had filled.
2. Hydration matched garments to named positions and silently **dropped**
   anything the template had no slot for — his watch did not come back.

### What replaced it

**Ten generic positions.** A slot is an index and a garment id. It carries no
category, and never should have: what a piece *is* has always been the
classifier's answer, and a position that carries its own opinion can only
disagree with the tagger.

- **Empty tiles read "Add a piece."** Never a category word. A tile saying
  "Dress" to somebody who owns none is the same failure the atlas already
  forbids for placeholder imagery.
- **Classification stays automatic**, and readiness reads the classifier's
  output — never the grid position a photograph was taken from.
- **Decline / substitute / "keep the slot open" are removed**, with T-04. A
  generic cell was not asking for anything, so there is nothing to decline and
  nothing to spend a decline on.
- **Hydration places every category**, accessories and headwear included, in
  wardrobe order, up to ten — nothing dropped, nothing coerced.

### Starter readiness — all four conditions

Implemented in `src/features/onboarding/starter-readiness.ts`:

1. at least **ten** real uploaded garments;
2. at least **one footwear**;
3. **a top and a bottom, or a dress** (`mid_layer` is a top, per §1);
4. `countOutfits(real tally)` **≥ 4**.

Condition 4 is the only editorial number here and it is what makes the other
three insufficient: a closet can satisfy shape and still make one outfit, and
one outfit is not a week.

Accessories, watches, bags, coats and headwear **count toward the ten** and
**never** enter the outfit arithmetic — §1's rule, unchanged.

This is deliberately **not** `canGenerate`. That predicate is the engine's floor
(eight pieces plus a shape) and the whole app agrees on it; widening it would
change what Today, the Reveal and the stylist are allowed to show. Starter
readiness is a stricter, narrower claim scoped to The Ten.

### Acceptance fixtures

Held in `tests/starter-readiness.test.ts`:

| Closet | Cores | Verdict |
|---|---|---|
| 3 base tops + 1 mid_layer + 2 bottoms + 2 footwear + 1 watch + 1 coat | 16 | **READY** — no dress, no bag |
| Dress-led: 3 dresses + 2 footwear + 5 uncounted | 6 | **READY** — no top, no bottom |
| 10 watches | 0 | not ready |
| 10 tops | 0 | not ready |
| 10 tops/bottoms, no footwear | 0 | not ready |
| 1T 1B 1S + 7 coats | 1 | not ready — shape alone is not enough |

### States the correction adds

- **T-07 · repair.** Ten filed and not ready shows an honest card over a **live**
  grid — never the stop sheet, never a reveal it has not earned. Every tile
  opens `/item/[id]`, where a mis-read garment is re-read, renamed or replaced.
  Fixture: `/dev-w3-g1-t-07-repair`.
- **A settling guard.** Readiness is withheld while any ingest job is in flight,
  so a verdict is never taken on a garment Cinch has not read yet.
- **One adaptive card** replaces the per-slot reasoning. It names the single
  most useful next piece from the classified mix, and **may not quote a
  projection that has not moved** — an empty closet is invited ("Start with
  whatever's nearest"), not directed at a piece that would gain nothing.

Rules carried forward unchanged from §2: order is a suggestion; progress is a
count, never a bar; nothing is ever lost; exactly one oxblood action per screen.

---

## 3 · Colour reconciliation

Every literal in the twelve atlases already has a token. No new colour is
introduced by this wave, and `tailwind.config.js` and `src/theme/tokens.ts` stay
**read-only**.

| Atlas literal | Token | Note |
|---|---|---|
| `#FBFAF6` | `canvas` | |
| `#FFFFFF` | `surface` | |
| `#F0ECE3` | `tray` | |
| `#E7E2D6` | `sand` (`#EAE5DB`) | **Consolidated.** The atlas's slot-tile ground is 3 steps off `sand`; one token, not two. |
| `#1C1A16` | `ink` | |
| `#6B665C` | `muted` | |
| `#8A8578` | `faint` | decorative only — see refusals |
| `rgba(28,26,22,.12)` | `rule` | |
| `rgba(28,26,22,.25)` and `.28` | `rule-strong` (`.28`) | **Consolidated.** Outlined buttons use `.25`, dashed empty slots `.28`. One border token. |
| `#6E2B2B` | `accent` | |
| `#F7EDE8` | `blush` | |
| `rgba(176,138,118,.45)` | `blush-rule` | |
| `#100F0D` | — | camera well only; use `ink`, the 3-step delta is invisible under a photo |
| `#EFEBE1` | — | the design document's own page ground, not an app surface. Never ship it. |

---

## 4 · Standing refusals for this wave

These override the atlas where they conflict. They are not preferences.

1. **`faint` is not body text.** `#8A8578` on canvas is ~3.5:1 and fails AA. The
   atlases set 11px slot labels in it (T-01 `Top`, `Bottom`, `Dress`…). Ship
   those in **`muted`**. `faint` is for decorative marks and dark grounds only.
   This is the fourth time this refusal has been applied; it is settled.
2. **No `className` on `Animated.*`.** NativeWind's interop is registered for the
   RN primitives, so the class is silently dropped. Use `style={}`.
3. **No margin-top on a trimmed serif `Text`.** `mt-*` cancels against the trim
   to roughly zero. Put `mb-*` on the preceding sibling instead.
4. **No stacked `text-*` colours on one element.** Two colour utilities resolve
   by key order in `tailwind.config.js`, not by intent. Set the exception via
   `style`.
5. **No new native modules.** This wave ships no `expo-blur`, no
   `expo-notifications`. The Repeat's P-04 lock-screen state is a **design, not
   a shipping surface** — the atlas says so itself. Build P-01 through P-03 and
   P-05; leave P-04 unbuilt and note it.

---

## 5 · What changes outside the app

Both are one-line changes and both must land together or the UI will promise a
limit the database does not enforce:

- `src/features/billing/plans.ts:49` — `items: 30` → `10`.
- `item_limit_for_plan()` in `supabase/migrations/20260805160000_membership_tiers.sql`
  — `when 'free' then 30` → `10`, via a new migration.

**Grandfathering needs no code.** `items_enforce_limit` is a `before insert`
trigger, so rows already above the new limit are untouched and only new inserts
refuse. Confirmed at `20260805160000_membership_tiers.sql:284`.

The refusal already raises `closet_limit_reached` with `errcode
check_violation`. The Wall's W-02 is the designed screen for that error; today
it surfaces as a generic failure.

---

## 6 · Where wear history comes from

The Repeat quotes dates ("you wore this on Tuesday") and The Wall orders the
swap sheet least-worn first. Both must read what was **worn**, and there is a
table that looks right and is not.

- **`outfits.worn_at`** (timestamptz, null until logged), joined through
  `outfit_items` — this is the wear log. Use it.
- **`items.wear_count`** — the per-garment count the closet and item detail
  already quote. Prefer it over recomputing so two screens cannot disagree.
- **`outfit_calendar` is NOT a wear log.** Its column is `planned_date` and the
  schema calls it "planned outfits by date (week planner, packing)". It records
  what someone intended to wear. Reading a plan as a wear manufactures a claim
  about the user's history, which is the dishonesty these atlases exist to
  avoid. An unmarked day produces no claim at all.

## 7 · Unit boundaries

| Unit | Surfaces | Owns |
|---|---|---|
| **A** | The Ten, The Reveal | the slot model, guided capture, the substitution sheet, the three-beat reveal |
| **B** | The Gap Feed, The Wall | gap ranking, the locked treatment, the limit, the swap/store flow |
| **C** | The Repeat | the repeat mark inside the existing plate, the exhausted state |

All three consume `outfit-count.ts` and must not reimplement any part of it.
Unit C touches the existing Today plate and colophon, so it is the only unit
permitted to edit `src/components/today/**`.
