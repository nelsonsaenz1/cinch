# Primitive requests — Unit Q, the packing questionnaire

Things the shared, read-only layers don't currently provide, what I needed
them for, and what I did instead without touching them.

## 1 · `packing-math.ts`'s number-to-words table is private

**Need:** K-01's history line quotes the same spelled-out arithmetic K-03 and
K-05 do — "four days in Lisbon", "eleven pieces and nine looks" — but
`packing-math.ts` (Phase 1, read-only to this unit) keeps its `word()` table
and `WORDS` array module-private; only `looksSentence()` is exported.

**Which state:** K-01, the gate's history line (`useLastPackedTrip()` present).

**What I did instead:** A second, small copy of the same 0–20 word table lives
in `src/features/plan/packing-tab.tsx` (`NUMBER_WORDS` / `numberWord`). It is
five lines and unlikely to drift, but it is still a duplicate of a table that
already exists one file over. If `packing-math.ts` is ever touched again by
whoever owns Phase 1, exporting `word` (or a `spellOut()` alias) would let
this call site — and any future one — import instead of copy.

## 2 · No shared seam for opening the questionnaire pre-answered

**Need:** A faithful K-03 dev state needs the real summary rows and the real
running arithmetic, computed by `useTripQuestionnaire`'s actual state machine
— not a redrawn approximation of what they'd look like. There was no way to
open the hook already partway through a run.

**Which state:** K-03, `dev-packing-questions.tsx`.

**What I did instead:** This one *is* in my territory (`use-trip-questionnaire.ts`),
so I added the seam rather than filing it away: an optional `devSeed` param,
applied only when `__DEV__` is true and the module-level run is still fresh,
so it can never touch a real in-progress trip and does not exist in a shipping
build's behaviour. Noted here anyway since it's exactly the kind of thing a
future unit reading this file would want to know already happened.
