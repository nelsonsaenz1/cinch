# Gap Feed shipped junk shop suggestions for fifteen minutes

**Date:** 2026-08-11
**Surface:** `gap-shop-match` — the Gap Feed's "where to buy" row (C-01) and a
friend's closet item (C-04)
**Severity:** No data exposed, no money moved. A trust failure in the one
surface whose entire claim is that Cinch is not a shop.

---

## What happened

`gap-shop-match` was repointed from the empty Awin feed tables to the licensed
Datafeedr catalogue so the commerce surfaces could function. The first version
built its query from the slot's own word — `coat` for outerwear, `hat` for
headwear — against 924 million products.

It was deployed and live. Measured against the live catalogue in that state:

| Slot | Query | What came back |
| --- | --- | --- |
| outerwear | `coat` | a wooden coat **stand** from Wayfair |
| headwear | `hat` | a cymbal stand, a car-seat hat holder, a hat **hook rack** |
| jewelry | `necklace` | a necklace **display bust**, beading cord |
| bag | `handbag` | zipper pulls, handbag **belt buckles** |
| — | — | products from Walmart's automotive and books feeds |

## Exposure window

**About fifteen minutes**, between deploy and the follow-up verification in the
same session. The endpoint requires a signed-in user and returns at most three
products; there is no evidence anyone saw it, and no evidence anyone did not.

## Cause

Three compounding, in order of how much each mattered.

**1. `name LIKE` is AND-across-words, not a phrase match, and knows nothing
about what a product IS.** `black dress` matches "Black Label **Dress Pants**".
`cream dress` matches "Ice Cream Dress". `black coat` matches "Black **Coated**
Skinny Jean". Every one of those satisfies the query exactly.

**2. The merchant `category` field does not survive contact with the data.**
The first fix added `category LIKE apparel`, which helped and was not enough,
because the field is merchant-authored free text with no shared taxonomy:
Wayfair files furniture under "Shoes" and a dressmaker's mannequin under
"Dresses". A filter that admits a coat stand is not a filter.

**3. The catalogue's shape was never looked at.** Sorted by size, Datafeedr is
Walmart's twenty-odd department feeds, Wayfair, Etsy, AliExpress and SHEIN. Any
query drawn from that pool without choosing the shops first returns their
inventory, because that is most of the inventory.

### The cause behind the causes

**Nothing in `gap-shop-match` could be run without deploying it.** It imported
`npm:@supabase/server`, so no test could load it. The rules were verified by
reading them.

And the verification that was done graded the wrong thing: it counted junk
**merchants** and reported "9 of 98", when grading the actual **products** — what
a user sees — showed a majority wrong in seven of nine slots. The weaker
instrument flattered the result and the result was reported before it was
checked against the rows.

## Fix

Shipped in `4430cbb`, with the structural fix in `bff2ab1`.

- **`_shared/merchants.ts`** — 82 real apparel retailers, hand-listed then
  intersected with what is reachable on our seven US networks with a non-empty
  catalogue. Applied in the query, so the hundred rows a metered request buys
  are a hundred rows from shops we would name. **Suggestion path only**;
  `garment-search`, where the user has named a specific garment, keeps the full
  catalogue and its 93% coverage. The allowlist is part of the cache key so the
  two paths cannot share a row.
- **`gap-shop-match/relevance.ts`** — asks one question per row: is the noun in
  this title the thing being sold, or a word about something else. Whole-word
  matching (`coat`, not `coated`), head-noun position (`scarf print` is a
  pattern, `shoe polish` is a tin), and refusal when the title names a different
  garment (`dress pant`, `scarf top`). Runs **before** ranking — ranking junk
  only decides which junk goes first.
- **`gap-shop-match/policy.ts`** — every decision moved out of `index.ts` into a
  module with no Deno and no npm imports, so it can be tested. `index.ts` is now
  plumbing.
- **`tests/slot-relevance.test.ts`** — 2,558 real recorded catalogue rows across
  nine slots and three colours, pinning how many survive the filter per cell,
  and reading `policy.ts` as text to fail if it marks a slot verified that the
  fixture does not cover.
- **`tests/gap-shop-policy.test.ts`** — the seven directive conditions, both
  callers.

## The new rule

> **A broad slot-only query fails closed.**
>
> A slot on its own is not a shopping query. When the closet supplies no colour
> and no brand, `gap-shop-match` returns an empty list and spends no metered
> request. Measured: `coat` gives 5/5 junk merchants; `black coat` gives 0/15.

This is safe because C-01 already says what to do with nothing: *"if no merchant
matches, the row is absent entirely."* An empty answer is a shape the surface
knows how to render.

Enforced in `policy.ts` (`refusal: 'no_qualifier'`) and asserted in
`tests/gap-shop-policy.test.ts` — including that no catalogue request is made.

## The second new rule

> **A slot ships only if a recorded fixture says it may.**

`SLOT_QUERY[slot].verified` is not an opinion anybody can type. The fixture test
reads the table and fails if it claims a slot the recorded rows do not cover.
Turning a slot on is a measurement.

## What was left honest rather than fixed

`footwear` is verified but rarely fills three merchants — the colour+"shoes"
phrasing collides with sizing text ("Boys", "Kids") across the allowlist. Its
rows are correct; there are just often one or two. That is recorded in the test
rather than hidden, because three is the cap, not the requirement.

## What to take from it

1. **Grade the thing the user sees.** Merchant names were a proxy for product
   quality and a bad one.
2. **If it cannot be run, it will ship wrong.** The import that made the module
   untestable was the root cause, not the query.
3. **Report the measurement, then check it.** The "9 of 98" figure was accurate
   about what it measured and wrong about what it implied.
