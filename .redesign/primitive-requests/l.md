# Primitive requests — Unit L, The memo (K-04, K-05, K-06)

Things the shared, read-only layers (`src/features/plan/packing.ts`,
`packing-math.ts`, `trip.ts`, `use-trips.ts`, `use-packing-access.ts`,
`src/features/context/**`, `src/theme/**`, `src/components/ui/**`) don't
currently provide, what I needed them for, and what I did instead without
touching them.

## 1. `packing.ts` has no per-look recompute — "Swap a day" re-runs the whole trip

**Need:** K-05's "Swap a day" is specified as re-running *one day's* looks
with that day's current pieces excluded. `buildPackingList` is monolithic —
one call in, one whole `PackingResult` out — and the reuse-affinity table
(`REUSE_BOOST`, the running `Affinities` accumulator) that makes the bag
converge on a small set of pieces is entirely internal to it. There is no
`swapLook(result, dayIndex, exclude)` or any way to re-run a single look
against the affinities already accumulated by the looks before it.

**What I did instead:** on "Swap a day", I add the tapped day's current item
ids to a session-only `excludedItemIds` set and re-run `buildPackingList`
against the *whole* trip with those ids filtered out of the wardrobe pool
(`packing-trip.tsx`, `handleSwapDay`). This satisfies the letter of "that
day's current pieces excluded" but not the spirit of "one day" — because the
affinity table rebuilds from scratch, a neighbouring day can legitimately pick
different pieces too, since the search that made day 2 lean on the linen
blouse no longer has that same blouse available if day 2 itself was the one
swapped, and the pieces day 3 preferred can shift as a result. I did not see
a way to isolate one look's re-generation without either duplicating
`REUSE_BOOST` and the affinity bookkeeping outside `packing.ts` (real drift
risk — packing and everywhere-else scoring are already a deliberately
different regime, see the file's own docblock) or asking to add a new
primitive to a file I'm not allowed to touch this wave.

**If picked up later:** `packing.ts` growing a `swapLook(result: PackingResult,
dayIndex: number, wardrobe: Garment[], ...) => PackingResult` that reuses the
already-built affinity table up to that point and only re-searches the one
day would make this exact and would let `packing-trip.tsx` delete
`excludedItemIds` entirely.

## 2. No membership-unconfirmed signal reaches outside `use-packing-access.ts`

**Need:** K-06's Failure 3 ("Membership can't be confirmed") has to fail
open at the point the memo is being read, not just at the K-01 gate — which
already blocks with a retry rather than proceeding, so a state that's
supposed to fail open still needed a signal *inside* my screen. `usePlan()`
(`src/features/billing/use-plan.ts`) reads the subscription row via
`useQuery` but its returned `PlanState` has no `error`/`isError` field at
all — a failed read silently resolves `plan` to `'free'`, which is a
different (fail-*closed*) shape than what K-06 asks for, and there's nothing
public to distinguish "confirmed free" from "couldn't confirm, defaulted to
free."

**What I did instead:** rather than edit `use-plan.ts` (under
`src/features/billing/**`, forbidden this wave), I read the query cache
directly — `useQueryClient().getQueryCache().findAll({ queryKey:
['subscription'] })` and checked `.state.status === 'error'`
(`packing-trip.tsx`). This works because `usePlan()`'s `queryKey` happens to
be `['subscription', userId]`, so a prefix match on `['subscription']` finds
it — but it is a coupling to an implementation detail (the exact key shape)
that `use-plan.ts` could change without knowing anything outside it depends
on it.

**If picked up later:** `usePlan()` returning `error: boolean` (or a
`PlanState['confirmed']` flag, `true` only when the row was actually read)
would let any caller ask the honest question directly, and would also let
`use-packing-access.ts`'s own gate consider failing open the same way K-06
now asks the memo screen to.

## Nothing else was blocked

`packing.ts`'s `PackingResult` (`looks`/`items`/`unfilled`) and
`packing-math.ts`'s `lookSchedule`/`repeatLabel`/`looksFor` covered every
other need this wave has — the bag, the day-by-day, the shortfall sentence,
all read straight off them with no re-derivation. `weather.ts`'s
`fetchForecastRange`/`fetchSeasonalNormals`/`hasForecastFor` are exactly the
K-04/K-06 · Failure 1 primitives the contract describes them as, used as
given.
