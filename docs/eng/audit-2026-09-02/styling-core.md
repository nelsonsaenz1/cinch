# Styling core — deep correctness audit

**Date:** 2026-09-02 · **Scope:** `src/lib/styling/*`, `src/lib/color/*`, `src/features/styling/*`,
`src/features/closet/{outfit-count,co-wear,closet-spec,gap-feed,gap-feed-spec}.ts`,
`src/features/today/*`, `supabase/functions/generate-outfits` + `_shared`,
`scripts/styling-smoke.ts`, `tests/*{styling,outfit,score,color,repeat}*`.
**Method:** read + `npm test` (3762 pass / 0 fail / 1 skip) + `npm run smoke:styling` + ad-hoc
esbuild probes in the session scratchpad + read-only queries against the live database.
**Nothing under `src/`, `supabase/`, `tests/` or `scripts/` was modified.**

---

## Verdict in one paragraph

The engine is in better shape than its size suggests: it is pure, deterministic given its inputs,
free of RNG, free of NaN on every path I could reach, and it does **not** regenerate per render.
The server function is a re-ranker only, so there is no second generator to diverge. What is wrong
is concentrated in three places, and all three are the *same* kind of fault — a stated invariant
that a later change broke without any test noticing, because the tests only cover the closets the
design documents talk about:

1. `possibleCores` still gates on shoes after `countOutfits` stopped gating (2026-09-01). **12 of 25
   live closets have no shoes**; for every one of them The Repeat believes the closet can build
   **zero** cores while the Reveal tells the same user a number in the hundreds.
2. A knit can anchor an outfit core only above ~6 "warmth units", i.e. only below **24.6 °C**. Above
   that the generator silently drops every knit-anchored core while `countOutfits` keeps counting
   them, and in the limit (knits are the only tops) it returns **zero outfits with no fallback**,
   under a `nothingWorksReason` docblock that asserts this cannot happen.
3. `toGarment` trusts the `pattern_scale` column without cross-checking `pattern`. **Four live,
   `verified` rows** are `pattern='solid', pattern_scale='small'`, and they make the outfit card
   print *"solid as the focal point"* and score the outfit **higher** for it.

Plus one performance defect with a 15–20× lever on it (`topBy` recomputes the sort key on every
comparison), which matters most on the Plan tab that already froze once for this reason.

---

## Findings, ranked

| # | Severity | Where | One line |
|---|---|---|---|
| 1 | **High** | `src/features/styling/repeat.ts:58` | `possibleCores` returns `[]` for a shoeless closet; `countOutfits` returns 6. 12/25 live closets affected. |
| 2 | **High** | `src/lib/styling/generate.ts:96,139` | Above 24.6 °C knits cannot anchor a core; the count never learns. Worst case: zero outfits, no fallback. |
| 3 | **High** | `src/lib/styling/garment.ts:119` | `pattern_scale` column overrides a solid `pattern`; 4 live rows print "solid as the focal point" and gain score. |
| 4 | Medium | `src/features/styling/repeat.ts:41` | A layered wear (top **and** knit) can never match a `possibleCores` key, so it never counts as a repeat. |
| 5 | Medium | `src/lib/styling/generate.ts:69` | `topBy` recomputes `scoreOutfit` on every sort comparison — 178,522 calls where 10,000 suffice. |
| 6 | Medium | `src/features/styling/queries.ts:114` | `useWardrobe` has no `ORDER BY`; row order is the generator's only tiebreak, so Today can churn after any item write. |
| 7 | Medium | `src/features/styling/favorite-ranking.ts:5` | `favorExactCores` matches on the **full** item set, not the core — the bonus almost never fires. |
| 8 | Low | `src/features/styling/outfit-names.ts:128` | Tests for `'monochromatic'`; the label is `'monochrome'`. Dead branch — monochrome outfits are named "colour". |
| 9 | Low | `src/lib/styling/generate.ts:221` | On a very cold day dress cores are dropped silently while separates survive; the pool fallback does not fire. |
| 10 | Low | `src/lib/styling/features.ts:356` | `colorSeason as Season` is an unvalidated cast; a wrong string silently disables the whole season-palette term. |
| 11 | Info | `src/features/styling/mutations.ts:180` | **A9 confirmed with a nuance:** 43 reactions, 0 `style_feedback`, no reader of either table — but reactions *do* reach ranking indirectly through `style_profiles`. |
| 12 | Info | `src/features/styling/queries.ts:114` | Nothing excludes an item that is out on loan. Latent only: `borrow_requests` is empty today. |

---

## 1 — High · `possibleCores` and `countOutfits` disagree for every shoeless closet

**`src/features/styling/repeat.ts:58-75`** (against **`src/features/closet/outfit-count.ts:127`**)

```ts
// repeat.ts:66-74
for (const t of tops) {
  for (const b of bottoms) {
    for (const s of shoes) cores.push([t.id, b.id, s.id].sort());   // ← no shoes ⇒ no cores
  }
}
for (const d of dresses) {
  for (const s of shoes) cores.push([d.id, s.id].sort());
}
```

Its own docblock (`repeat.ts:54-56`) states the invariant:

> "Built the same way `countOutfits` computes its arithmetic … so `possibleCores(w).length` and
> `countOutfits(tallyOf(w))` never diverge. Tested directly."

`countOutfits` changed on 2026-09-01 — shoes multiply rather than gate, `× Math.max(t.shoes, 1)`
(`outfit-count.ts:127`). `possibleCores` was not changed with it.

**Failing input** (probe, scratchpad `probe.ts`):

| closet | `countOutfits` | `possibleCores.length` |
|---|---|---|
| 2 tops, 3 bottoms, **0 shoes** | **6** | **0** |
| 2 dresses, **0 shoes** | **2** | **0** |
| 2 tops, 3 bottoms, 2 shoes | 12 | 12 ✅ |

**Expected:** equal, per the docblock. **Actual:** 6 vs 0, 2 vs 0.

**Consequence.** `exhaustionProgress` (`repeat.ts:115-136`) returns `{ total: 0, wornCount: 0,
exhausted: false }` for those closets, so The Repeat's exhausted state is unreachable and its
"total" is a number no other surface agrees with. Today reads `exhaustion.exhausted`
(`src/app/(tabs)/index.tsx:1945`).

**Why the suite is green.** `tests/repeat.test.ts:63-70` enumerates six cases —
`[3,2,1,2] [4,2,0,2] [3,3,0,2] [3,2,0,2] [3,2,1,3] [0,0,0,0]`. Every non-empty case has ≥2 shoes.
The one closet shape the 2026-09-01 change was *for* is the one shape the test does not have.

**Live impact.**

```sql
-- 25 closets total
shoeless = 12,  shoeless_above_the_ten_piece_floor = 6
```

**Fix.** One line: hoist the shoe loop so a shoeless closet yields the unshod core.

---

## 2 — High · Above 24.6 °C a knit cannot anchor a core, and nothing downstream knows

**`src/lib/styling/generate.ts:94-98`, `:138-140`, `:179`**

```ts
const target = ctx.weather ? targetWarmth(ctx.weather.feelsLikeC, ctx.weather.windKph) : 8;
const allowsMidLayer = target >= 6;                                   // :98
...
const knitsMayAnchor = allowsMidLayer && !pinnedSlots.has('base_top') && !pinnedSlots.has('mid_layer');
const coreTops = knitsMayAnchor ? [...tops, ...midsAsTops] : tops;    // :140
...
if (!cores.length) return [];                                          // :179  — no fallback
```

`targetWarmth(T, 0) = 4 + (30 − T)·0.37`, so `allowsMidLayer` is false for **T > 24.6 °C**.
Meanwhile `kindOfSlot` counts `mid_layer` as a top **unconditionally**
(`outfit-count.ts:89-106`), and so does `canGenerate` (`queries.ts:148-156`).

`outfit-count.ts:85-88` names this exact hazard:

> "Counting them as tops here and refusing them as cores there is precisely the divergence the
> Reveal forbids, so the two must change together."

The file argues (`:40-46`) that weather may narrow *what is offered* without changing *what is
counted*. That argument holds for **layers**. It does not hold for a **core**: a knit-anchored core
is a whole outfit, not a layer, and dropping it removes reachable outfits from the count's own
denominator.

### 2a — the total case: zero outfits, no fallback

**Failing input** (scratchpad `probe2.ts`): 5 jumpers + 3 trousers + 2 shoes = 10 pieces.

```
canGenerate = true   countOutfits = 30   pieces = 10 (meets TODAY_ACTIVATION_FLOOR)
  weather = null      generated = 3
  weather = hot 32C   generated = 0        ← targetWarmth(32,5) = 3.26 < 6
  weather = cold -5C  generated = 3
```

**Expected:** 3 outfits (or a truthful refusal naming the heat). **Actual:** `generateOutfits`
returns `[]` at `generate.ts:179` and Today falls into `NothingWorks`
(`src/app/(tabs)/index.tsx:1966`) with the generic last-resort sentence from
`nothingWorksReason` (`index.tsx:633-652`):

> "Cinch couldn't build an outfit that holds together from what's in your closet right now. One more
> layer, or a pair of shoes, usually fixes it."

That advice is wrong twice: this closet has shoes and it is *all* layers. And the function's own
docblock (`index.tsx:625-628`) asserts the case is impossible —

> "`generateOutfits` only ever returns nothing when there is no valid core to build from … or — on a
> genuinely cold day — no layer warm enough to wear over one."

There is a third way, and it is a **hot** day.

Live check: `knits_only_tops_above_floor = 0` today, so 2a is **latent, not currently biting**.

### 2b — the partial case, which *is* biting

Any closet with knits loses `mids × bottoms × max(shoes,1)` cores above 24.6 °C while every
free-tier surface keeps quoting the larger number. **13 of 25 live closets have knits.** Measured
against live tallies:

| pieces | base tops | knits | bottoms | dresses | shoes | counted | reachable > 24.6 °C | lost |
|---|---|---|---|---|---|---|---|---|
| 108 | 53 | 11 | 38 | 4 | 0 | 2436 | 2018 | **418** |
| 10 | 3 | 2 | 1 | 0 | 1 | **5** | **3** | **2 (40 %)** |
| 18 | 9 | 1 | 5 | 0 | 3 | 150 | 135 | 15 |

**Two explanations fit, and they differ in the fix.** Either (i) `allowsMidLayer` is the wrong gate
for an *anchor* and should be split from the gate for a *layer* — a linen-blend cardigan worn alone
at 26 °C is ordinary; or (ii) the gate is right and `kindOfSlot`/`countOutfits` are over-counting
knits year-round. **What discriminates them:** whether the Reveal's number is meant to be a
*durable fact about the wardrobe* (the docblock at `outfit-count.ts:40-46` says it is, explicitly,
and that settles it in favour of (i)) or a *forecast-conditional offer*. Under (i) the fix is to let
knits anchor whenever `target >= 3`, i.e. always, and keep `allowsMidLayer` for Stage C only.

---

## 3 — High · `pattern_scale` overrides a solid `pattern`, and four live rows do exactly that

**`src/lib/styling/garment.ts:119-120`**

```ts
const patternScale =
  (extended.pattern_scale as PatternScale | null) ?? inferPatternScale(item.pattern, text);
```

`??` only falls through on `null`. When the column holds a scale the `pattern` text is never
consulted, so `pattern='solid', pattern_scale='small'` survives — whereas the fallback
`inferPatternScale` would correctly return `'none'` (`garment.ts:88`, `SOLID` regex).

`supabase/functions/_shared/tag-validate.ts:245-250` *does* reject the contradiction, but only on
the tagging path. Four production rows are past it:

```sql
select id, category, subcategory, pattern, pattern_scale, status from items
where pattern_scale <> 'none' and pattern ~* '^(solid|plain|none)$';
--  outerwear/coat          solid  small  verified
--  top/poncho              solid  small  verified
--  bottom/skirt            solid  small  verified
--  bag/crossbody bag       solid  small  verified
```

All four are `status='verified'` and `is_archived=false` — i.e. live in someone's generator pool.

**Failing input** (scratchpad `probe4.ts`) — white shirt + that navy skirt + brown shoe:

```
patternRule([solid-small skirt, shirt])  -> { value: 1, note: "solid as the focal point" }
explain(outfit)                          -> "Complementary palette — solid as the focal point."
pattern feature: 0.76 (correct) vs 1.00 (actual)   score: 0.8028 vs 0.8234
```

**Expected:** `patternScale === 'none'`, feature 0.76, no note. **Actual:** the outfit card tells the
user a plain navy skirt is her outfit's print focal point, and the outfit is ranked ~0.02 higher for
it. With two such pieces `patternRule` drops to **0.36** (`features.ts:322`) — a large penalty for
two solids.

Secondary, same line: **`features.ts:316`** interpolates `patterned[0]!.pattern` with no null guard,
so if `pattern` were ever `null` beside a non-`none` scale the card would read literally *"null as
the focal point"*. Not reachable from today's data, but one edit away.

**Fix.** Cross-check in `toGarment`: `SOLID.test(pattern) ? 'none' : (column ?? inferred)`. A
one-off `update items set pattern_scale='none' where …` cleans the four rows.

---

## 4 — Medium · A layered wear can never be recognised as a repeat

**`src/features/styling/repeat.ts:41-44`**

```ts
export function coreIdsOf(itemIds, wardrobe) {
  const kindById = new Map(wardrobe.map((g) => [g.id, kindOfSlot(g.slot)]));
  return [...itemIds].filter((id) => kindById.get(id) != null).sort();
}
```

`kindOfSlot` maps **both** `base_top` and `mid_layer` to `'tops'`, so an outfit worn as *shirt +
cardigan + trousers + shoes* reduces to a **four-id** key. Every key `possibleCores` can produce has
exactly **three** ids (one top, one bottom, one shoe) — the two can never match.

**Failing input** (scratchpad `probe.ts`), wardrobe = 1 top, 1 knit, 1 bottom, 1 shoe, one real wear
of all four:

```
coreIdsOf(top+mid+bottom+shoe) = [ i73, i74, i75, i76 ]        (4 ids)
possibleCores keys             = [ 'i73·i75·i76', 'i74·i75·i76' ]  (3 ids each)
exhaustionProgress             = { total: 2, wornCount: 0, exhausted: false, since: null }
```

**Expected:** `wornCount: 1` (the wear *is* one of this closet's cores, plus a cardigan).
**Actual:** `0`. `wearsOfCore` returns `[]` for the same reason, so `repeatRegisterFor` reports
`{kind:'none'}` and the P-01/P-02 repeat marks never appear for anyone who layers. Since the
generator layers a knit onto every base-top core below 24.6 °C (`generate.ts:223-225`), that is most
cool-weather outfits.

---

## 5 — Medium · `topBy` recomputes the sort key on every comparison

**`src/lib/styling/generate.ts:69-70`**

```ts
const topBy = <T,>(arr: T[], n: number, key: (t: T) => number): T[] =>
  [...arr].sort((a, b) => key(b) - key(a)).slice(0, n);
```

`key` is `coreScore`, which is a full `scoreOutfit` (`generate.ts:64-67`). The comparator therefore
runs `scoreOutfit` **twice per comparison**, i.e. ~2·log₂(n) times per element instead of once.

**Measured** (scratchpad `probe3.ts`, varied colours so the sort actually does work):

| cores | `key()` calls, current | with decorate-sort-undecorate | waste |
|---|---|---|---|
| 100 | 1,066 | 100 | 10.7× |
| 1,600 | 29,354 | 1,600 | 18.3× |
| 4,489 | 86,556 | 4,489 | 19.3× |
| **10,000** | **178,522** | **10,000** | **17.9×** |

Wall clock, `generateOutfits` end to end (Node, Apple silicon — a phone's JS thread is several times
slower):

```
 18 items    30.4 ms      120 items    32.4 ms
 60 items    24.5 ms      200 items    36.2 ms
                          400 items   103.7 ms
270 items, 100×100 tops×bottoms, varied colours:  186.2 ms
```

No path is worse than O(n²) in closet size — cores are `tops × bottoms`, Stage B and C are bounded
by `BEAM_CORE`/`BEAM_SHOD`, and the accessory attach was already moved behind `selectDiverse`
(`generate.ts:283-285`). The cost is the constant factor above.

**Why it matters here specifically.** `src/features/plan/packing.ts:127` calls `generateOutfits`
**once per look** in the trip schedule (and again at `:217`, `:331`, `:343`). A 7-day trip with
three day-parts is 21 passes — ~4 s of blocked JS at the 186 ms figure. That is the shape of the
2026-08-20 Plan-tab freeze the `addAccessories` docblock already describes; the accessory fix
removed one factor, this one is still there.

**Fix.** Three lines: `arr.map(t => ({t, k: key(t)})).sort((a,b) => b.k - a.k).slice(0,n).map(x=>x.t)`.
Stability is preserved (V8's sort is stable), so ordering is unchanged.

---

## 6 — Medium · Nothing orders the wardrobe, and row order is the generator's only tiebreak

**`src/features/styling/queries.ts:114-120`**

```ts
const { data, error } = await supabase
  .from('items').select('*')
  .eq('user_id', userId).eq('is_archived', false)
  .in('status', ['tagged', 'needs_review', 'verified']);   // ← no .order()
```

The generator itself is **fully deterministic** — no `Math.random`, no `Date.now` inside the pass,
`now` is threaded in (`types.ts:105`), and `Array.prototype.sort` is stable — so ties break on
**input order**, which here is unspecified PostgreSQL heap order.

**Failing input** (scratchpad `probe2.ts`), a 6-item closet whose garments tie exactly:

```
original order :  i19+i21+i23 | i20+i22+i24 | i19+i21+i24
reversed order :  i20+i22+i24 | i19+i21+i23 | i20+i22+i23
identical      :  false        (same order twice → identical: true)
```

**Expected:** the same three outfits regardless of row order. **Actual:** the ranking permutes and
the third card is a different outfit.

**Answering "does Today change on every render?" — no.** `useStyleContext` memoises `context` on
stable deps (`use-style-context.ts:299-327`, `now` deliberately excluded from its own dep list) and
`useOutfits` memoises the shortlist (`use-outfits.ts:138-150`). Generation is once per input change,
not per render, and outfit **names** are hashed off item ids plus a day key
(`outfit-names.ts:139`), so they are stable within a day.

**But it can change across refetches.** Logging a wear updates `items.wear_count` / `last_worn_at`,
which rewrites the heap tuple and moves the row; the next `['wardrobe']` fetch can return a
different order.

**Two explanations fit an observed shortlist churn after a wear:** (a) genuinely different scores —
`freshnessRule` (`features.ts:378-409`) legitimately re-ranks the pieces just worn; or (b) tie
flips from heap reordering. **What discriminates them:** add `.order('id')` to the query; if churn
persists it is (a), which is correct behaviour, and if it stops it was (b).

---

## 7 — Medium · `favorExactCores` matches the full item set, not the core

**`src/features/styling/favorite-ranking.ts:5-24`**

```ts
function core(ids: readonly string[]): string { return [...ids].sort().join('.'); }
...
favorites.has(core(candidate.items.map((item) => item.id)))   // ALL items, incl. accessories
```

The function is named for cores and documented as "a bounded exact-core preference", but it compares
every id — coat, bag, watch included. `favoriteItemIds` comes from stored `outfit_items`
(`use-favorite-outfits.ts:55`); candidates come from the generator *after* `addAccessories`
(`generate.ts:283`). The two sets agree only if the accessory attach reproduces the saved outfit
exactly.

**Failing input** (scratchpad `probe2.ts`), favouriting candidate #3 = `i19,i21,i24`:

```
boost with full set  i19,i21,i24  → promoted to #1   ✅
boost with core only i19,i21      → i19,i21,i23 stays #1 (no match)   ❌
```

**Expected (per the name/docstring):** the core `i19,i21` boosts every candidate built on it.
**Actual:** nothing. Reduce both sides through `coreIdsOf` (which already exists, `repeat.ts:41`) or
rename the function to what it does.

---

## 8 — Low · Dead branch: `'monochromatic'` vs `'monochrome'`

**`src/features/styling/outfit-names.ts:128`**

```ts
else if (harmony.includes('monochromatic') || harmony.includes('analogous')) tags.add('tonal');
```

`HarmonyLabel` is `'monochrome'` (`src/lib/color/harmony.ts:31`). `'monochrome'.includes('monochromatic') === false`.
A purely monochrome outfit therefore falls through every branch to `tags.add('colour')`
(`outfit-names.ts:130`) and is named from the colour-story shelf instead of the tonal one
("Color in Context" rather than "One Color Story"). Cosmetic; one character.

---

## 9 — Low · Dress cores vanish on a very cold day; the pool fallback does not cover it

**`src/lib/styling/generate.ts:209-236`**

```ts
const canLayerMid = !hasDress && !hasMid;                         // :215
if (!wantsOuterwear && !mustLayerOuter && midSatisfied) layered.push(base);   // :221
if (allowsMidLayer && canLayerMid && !mustLayerOuter) { ... }     // :223
if (allowsOuterwear) { for (const outer of outers) { ... } }      // :226
...
const pool = layered.length ? layered : rankedShod;                // :236
```

When `wantsOuterwear` (target ≥ 9, ~−3 °C) and the closet has **no outerwear**, a dress core reaches
none of the three branches: unlayered is refused, `canLayerMid` is false because it *is* a dress,
and `outers` is empty. The fallback at `:236` only fires when **every** core fails, so as long as
separates survive the dresses are dropped silently.

**Failing input** (scratchpad `probe2.ts`) — 1 shirt, 1 trouser, 1 knit, 1 dress, 1 shoe:

```
weather = null      generated = 4   withDress = 1
weather = cold -5C  generated = 1   withDress = 0
```

Arguably correct styling (a dress alone at −5 °C), but it is a rule expressed by omission rather
than by a refusal the user can read. The Reveal's count still includes the dress.

---

## 10 — Low · Unvalidated `Season` cast silently disables the palette term

**`src/lib/styling/features.ts:352-358`**

```ts
const fits = dominant.map((c) => seasonFit(c.oklch, colorSeason as Season));
```

`seasonFit` returns `1` for an unrecognised season (`seasons.ts:138`), so a `colorSeason` of
`'Autumn'`, `'autumn'` or any legacy spelling makes `paletteFit === 1` and the whole 45 % personal-
palette term becomes a constant. No error, no log, no visible difference.

**Probe:** `seasonFit({L:0.5,C:0.2,h:40}, 'not_a_season') === 1`.

Related, cosmetic: `seasonFit` returns `NaN` if the hue is `NaN` (`warmth()` = `Math.cos(NaN)`).
Not reachable — `parseHex`/`oklabToOklch` cannot produce a NaN hue, and `oklabToOklch:103` pins
`h = 0` below `C < 1e-6`.

---

## 11 — Info · Reactions and feedback: A9 confirmed, with one nuance worth stating

**Confirmed, live:**

```sql
outfit_reactions = 43     style_feedback = 0
style_profiles   = 50     profiles_with_feedback_count > 0 = 8
```

Every reference to either table in `src/`:

- `src/features/styling/mutations.ts:77` — `select id` inside `retractOutfitReaction`, purely to
  find the row to delete.
- `src/features/styling/mutations.ts:94` — the `delete`.
- `src/features/closet/mutations.ts:130` — `TODO(OUT-22)` for `style_feedback`. Never written,
  hence 0 rows.

Nothing selects `outfit_reactions` for ranking. Nothing selects `style_feedback` at all.

**The nuance the ledger line understates.** A reaction is not inert: `apply_outfit_reaction`
(`mutations.ts:180`) writes `style_profiles.weights` and `.affinities`, and `useStyleProfile`
(`queries.ts:64`) reads those straight into `generateOutfits`
(`use-outfits.ts:141-144`). So the *learned aggregate* reaches ranking; the *per-outfit event* does
not. That is exactly the gap: the model can learn "you like neutrals" but can never learn "not this
outfit". A disliked outfit with an excellent palette comes straight back tomorrow, and 35 of the 43
reactions belong to accounts whose `feedback_count` is 0, meaning the profile write was refused or
never landed.

One more artefact of the current path: `DEFAULT_WEIGHTS.affinity = 0` (`score.ts:64`) but
`updateWeights` clamps to `WEIGHT_MIN = 0.05` (`score.ts:238`), so the **first** reaction of any kind
lifts `affinity` off zero regardless of what the user actually expressed.

### The smallest correct wiring

The schema already carries everything needed — `outfit_reactions(user_id, item_ids uuid[],
reaction smallint, source, created_at)` with `outfit_reactions_user_created_idx (user_id,
created_at desc)`. **No migration.**

**One read**, a sibling of `useWornOutfits`:

```ts
// src/features/styling/use-outfit-reactions.ts
export function useOutfitReactions() {
  return useQuery({
    queryKey: ['outfit-reactions'],
    queryFn: async () => {
      const userId = await getUserId();
      if (!userId) return [];
      const { data, error } = await supabase
        .from('outfit_reactions')
        .select('item_ids, reaction, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(200);                       // uses outfit_reactions_user_created_idx
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });
}
```

**One pure function**, keyed on the *core* signature so a bag does not defeat the match — reusing
`coreIdsOf`, the same reduction The Repeat matches on:

```ts
// src/features/styling/reaction-ranking.ts   (pure; testable in the node suite)
const REACTION_DELTA = 0.06;   // 2× FAVORITE_BONUS: an explicit "no" outranks an implicit "yes"
const HALF_LIFE_DAYS = 45;     // taste moves; a refusal from March should not be permanent

export function applyReactionMemory(
  candidates: readonly OutfitCandidate[],
  reactions: readonly { item_ids: string[]; reaction: number; created_at: string }[],
  wardrobe: readonly Garment[],
  now: number,
): OutfitCandidate[] {
  const byCore = new Map<string, number>();
  for (const r of reactions) {
    const key = coreKey(coreIdsOf(r.item_ids, wardrobe));
    if (!key) continue;
    const ageDays = (now - Date.parse(r.created_at)) / 86_400_000;
    const decay = Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
    // Newest-first input ⇒ exponential smoothing toward the latest opinion,
    // the same idiom updateAffinities already uses (score.ts:262).
    byCore.set(key, (byCore.get(key) ?? 0) * 0.5 + r.reaction * decay);
  }
  return candidates
    .map((c, index) => {
      const signal = byCore.get(coreKey(coreIdsOf(c.items.map((g) => g.id), wardrobe))) ?? 0;
      return { c, index, adjusted: c.score + Math.max(-1, Math.min(1, signal)) * REACTION_DELTA };
    })
    .sort((a, b) => b.adjusted - a.adjusted || a.index - b.index)   // stable, like favorExactCores
    .map(({ c }) => c);
}
```

**One call site**, composed with the favourite bonus in `use-outfits.ts:146`:

```ts
return applyReactionMemory(
  favorExactCores(generated, (favorites.data ?? []).map((o) => o.itemIds)),
  reactions.data ?? [], wardrobe, context.now,
);
```

Four properties that make this the *smallest correct* version rather than the smallest one:

- **Bounded.** `±0.06` on a 0..1 score. A disliked outfit is demoted, never removed — consistent
  with `outfit-count.ts:52-59`'s rule that the engine has no refusal predicate, so the Reveal's
  count stays honest.
- **Ranking-time, not learning-time.** It leaves `updateWeights`/`updateAffinities` untouched, so
  the two mechanisms cannot double-count.
- **Retraction-safe.** `retractOutfitReaction` deletes the row, so the penalty disappears with it —
  which is the whole point of that delete (`mutations.ts:46-55`) and is currently unobservable.
- **Core-keyed, so it survives an accessory swap** — and it is the same key The Repeat uses, so
  fixing finding #4 fixes both at once.

---

## 12 — Info · No exclusion for items on loan

`useWardrobe` (`queries.ts:114-120`) filters `is_archived` and `status`. `excludeItemIds` exists
(`generate.ts:46`, `:87`) and is used by exactly one caller — `packing.ts:336`, for a week's already-
planned pieces. Nothing joins `borrow_requests`, so an approved loan leaves the garment in the
generator's pool and Today can suggest a jacket that is at a friend's house.

Latent only: `select count(*) from borrow_requests` = **0**. Worth wiring before the borrow feature
ships, and the hook already exists.

---

## What is correct, and worth not re-litigating

Recorded so a future pass does not re-audit it.

**Generator vs count, everywhere shoes and knits are not involved** — verified exhaustively
(scratchpad `probe.ts`), `count: 9999, diversity: 0, includeAccessories: false`:

| closet | `countOutfits` | generated |
|---|---|---|
| 0 items | 0 | 0 |
| 1 top | 0 | 0 |
| 1 top, 0 bottoms, 2 shoes | 0 | 0 |
| 2 dresses, 0 shoes | 2 | 2 |
| 2 dresses, 3 shoes | 6 | 6 |
| 2 tops × 3 bottoms, 0 shoes | 6 | 6 |
| 2 tops × 3 bottoms, 2 shoes | 12 | 12 |
| 2 tops × 3 bottoms + 2 dresses + 2 shoes | 16 | 16 |
| two garments sharing one id | 2 | 2 |

The `(tops × bottoms + dresses) × max(shoes, 1)` rule from ledger A6 holds exactly, in both
directions, for every one of these.

**Degraded / untagged items.** `toGarment` (`garment.ts:134-140`) uses midpoints, not zeros —
`formality 3`, `warmth 2` — and an unresolvable colour is *dropped* rather than defaulted
(`families.ts:353-354`), which is the right call: a wrong colour pairs things that clash. A
`pending_tag` item never reaches the pool at all (`queries.ts:120`). An unknown `category` degrades
to `slot: 'accessory'` (`garment.ts:63-64`), which keeps it out of every core. 22 live items have no
colours; they score through `analyzePalette`'s `dominant.length < 2` branch (`harmony.ts:184-193`)
at a neutral 0.6.

**Colour maths.** `hueDistance` is correct across the wrap despite the odd `Math.abs` placement:
`hueDistance(350,10) = hueDistance(10,350) = 20`, `hueDistance(0,180) = 180`. Family bands tile the
full circle including the 335→375 wrap (h ∈ [0,15) → pink, [15,40) → red), so `hueFamily`'s
`return 'red'` fallback is unreachable. Achromatic input is handled: `#000` → `{L:0,C:0,h:0}`,
`#fff` → `{L:1,C:3.7e-8,h:0}`, both `neutral`, and `oklabToOklch:103` pins the hue below `C < 1e-6`
rather than letting `atan2` jitter.

**No NaN or Infinity on any reachable path.** Every probe:

```
normalizedWeights([])        = []                    formalityRule([], 3)        = { value: 0.5 }
formalityRule([accessory],3) = { value: 0.5 }        freshnessRule([], now)      = { value: 0.6 }
paletteRule([])              = { value: 0.6 }        analyzePalette([])          = score 0.6
scoreOutfit([])              = 0.6234                all-zero weights            = 0.5
analyzePalette(all weights 0) = cohesion 0.6 (weightSum guard, harmony.ts:214)
```

Every average is guarded: `harmony.ts:214`, `score.ts:190`, `score.ts:133`, `score.ts:308`,
`features.ts:81`, `:212`, `:231`, `:282`, `:315`, `:340`, `:353`, `:380`, `garment.ts:154`.

**Determinism.** No `Math.random` anywhere in `src/lib/styling` or `src/lib/color`. `now` is passed
in, not read (`types.ts:104-105`). `selectDiverse`'s MMR loop (`generate.ts:418-432`) breaks ties on
strict `>`, so the lowest index wins. Given a fixed input array the pass is bit-identical run to run
(verified). The only nondeterminism is finding #6.

**The enhancement gate is real.** `shouldEnhanceWithAi` (`should-enhance.ts:133`) is pure, memoised
(`use-outfits.ts:164-167`), and an ordinary morning makes **no** model call. The merge is
prose-only — the model can never reorder or replace a visible card
(`use-outfits.ts:258-292`), and `acceptEnhancedName` rejects any name outside the curated library
(`outfit-names.ts:164-174`). `enhancementStatus` correctly reports an unanswered query as
`'enhancing'` rather than `'offline'`.

**Server vs client — question 6, answered.** Both exist; they do different jobs and **cannot**
diverge on generation. `supabase/functions/generate-outfits/index.ts:24-28` says so outright ("this
function does not generate outfits"), and the code bears it out: it consumes a client-supplied
shortlist, and `:256-267` drops any `candidateId` not in the map and any `name` outside the
candidate's own `nameOptions`. There is no second beam search, no second scorer, and no shared
scoring code between `src/lib/styling` and `supabase/functions/_shared`. The client is authoritative
for *which clothes*; the server is authoritative for *which words*, within a whitelist.

**Weather / occasion filters — question 4, answered.** Neither `today-spec.ts` nor `occasionRule`
can filter anything out: `occasionRule` (`features.ts:191-244`) is a pure scorer with a floor of
0.4 and no veto, `seasonRule` is explicitly "a preference, never a filter" (`features.ts:349-350`),
and `no_plans` maps to `engine: null` → the neutral 0.7 (`today-spec.ts:82`). The only way to reach
zero is via the generator's own layering gates, which is findings #2 and #9. The pool fallback
(`generate.ts:236`) is correctly ordered — it prefers layered candidates and falls back to `rankedShod`
— it just does not fire per-core.

**Dates and timezones.** `dateKey` (`src/lib/date.ts:18-23`) reads `getFullYear`/`getMonth`/
`getDate`, so a plain date is the user's local calendar date and never a UTC shift. `describeDate`
(`repeat.ts:202`) and `daysBetween` (`repeat.ts:215-218`) both normalise through local midnight;
`daysUntilIso` (`today-spec.ts:178-184`) does the same. `ordinalDay` handles 11/12/13 correctly
(`repeat.ts:174`). `freshnessRule` uses elapsed *hours* over a day constant (`features.ts:393`),
which is correct for "how long since I wore this" and deliberately not a calendar-day count.
`compareIsoTimestamps` (`date.ts:49-52`) avoids the `localeCompare` fractional-second trap. **I found
no off-by-one here.**

---

## Reproducing

```bash
npm test                 # 3762 pass, 0 fail, 1 skip (fingerprint control, env-gated)
npm run smoke:styling
```

Probes live in the session scratchpad and are built the way `scripts/run-tests.mjs` builds tests:

```bash
npx esbuild <probe>.ts --bundle --platform=node --format=esm \
  --outfile=node_modules/.cache/probe.mjs --tsconfig=tsconfig.json && node node_modules/.cache/probe.mjs
```

- `probe.ts` — generator vs `countOutfits` across the edge closets; `possibleCores` divergence; layered-core mismatch
- `probe2.ts` — the hot-day zero; cold-day dress drop; NaN sweep; determinism under reordering; `favorExactCores`; wall-clock scaling
- `probe3.ts` — `topBy` key-recomputation count
- `probe4.ts` — the live `pattern='solid'` rows; hue wraparound; achromatic pairs; the `monochromatic` typo

Note `@/features/styling/queries` cannot be imported into a probe — it pulls react-query and
Supabase, and esbuild cannot parse React Native's Flow source. Same constraint `thresholds.ts:11-26`
documents. Inline the predicate instead.

---

## Suggested order of work

1. **#1** — one line in `possibleCores`, plus the `[3,2,1,0]` case in `tests/repeat.test.ts:63`. Half the live accounts.
2. **#3** — one line in `toGarment`, plus a four-row data fix. User-visible wrong words today.
3. **#2** — decide the anchor-vs-layer question (see the discriminator above), then split the gate.
4. **#5** — three lines in `topBy`. Biggest single win on the Plan tab.
5. **#4**, **#6**, **#7** — each one line, each fixing a stated-but-untrue invariant.
6. **#11** — the reaction wiring, once #4's `coreIdsOf` reduction is trusted.
