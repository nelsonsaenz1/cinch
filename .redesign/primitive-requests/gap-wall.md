# Primitive requests — Unit B (Gap Feed / Wall)

No new token, no new hex, no shared-layer edit was needed. Nothing here is a
request to change `src/theme/**`, `tailwind.config.js`,
`src/features/closet/outfit-count.ts` or `src/lib/styling/**` — those stayed
read-only for the whole build. This file records two computed-numbers
decisions instead, so they don't read as bugs later.

## "A second pair of shoes" — computed as the literal ordinal, not copied verbatim

The atlas's own copy (top-of-doc quote, G-01, G-03, G-04, W-01, W-02, W-03,
and the shared `tests/outfit-count.test.ts` comment — five independent
sources) calls the free tier's eleventh-piece shoe suggestion "a second pair
of shoes", even where the canonical ten already owns two pairs. Every other
kind's label in the same atlas is the literal `owned + 1` ordinal ("a third
bottom" for 2→3, "a fourth top" for 3→4) — checked against `gapLabel()`'s
tests in `tests/gap-feed.test.ts`. Only shoes breaks that pattern.

Built `gapLabel()` (`src/features/closet/gap-feed.ts`) to compute the literal
ordinal for every kind including shoes, so a closet that already owns two
pairs is offered "a third pair of shoes" — never a hardcoded "second" that
undercounts what it owns. This is the same discipline the contract already
applies to G-05's 3→6 vs 8→16 delta: build the state, compute the number,
don't copy the atlas's prose when the arithmetic disagrees with it.

## G-05's "one gap dominates" is a genuine, provable TIE

`cores = tops × bottoms × shoes` (dresses = 0 in the atlas's own eight-tops
fixture). With `bottoms = shoes = 1`, gaining either one doubles `tops` —
`gainFrom(bottoms).gain === gainFrom(shoes).gain` for EVERY value of `tops`,
not just the atlas's chosen 8. This isn't an approximation; it's algebra
(`T×S = T×B` when `B = S`). `tests/gap-feed.test.ts` — `'dominantGaps reports
a genuine tie rather than picking a winner for the user'` — pins this down.

`dominantGaps()` reports both tied leaders rather than picking one; the
screen features whichever `rankGaps`' own declared tiebreak (`COUNTED_KINDS`
= shoes, bottoms, tops, dresses) puts first — shoes, for this fixture, not
the atlas's illustrated "a second bottom". `swapAdvice()` follows the same
computed leader, so the G-05 swap suggestion and the featured card never
disagree with each other, even though the featured card differs from the
atlas's specific illustration. Flagged rather than silently "fixed" to match
the picture, per the contract's own instruction for the 3→6/8→16 delta.

## Not requested, but worth a note for the founder

`rankSwapCandidates` (`src/features/closet/swap.ts`) supports storing a piece
`outfit-count.ts` never counts at all (a coat, a bag, an accessory) at zero
cost to the outfit total — `items_enforce_limit` counts every row regardless
of kind, so storing a coat frees a real closet slot for nothing. The Wall's
own rules table already says "layers and bags dress an outfit; they don't
create one" — this is that rule applied to the swap picker, not a new one.
