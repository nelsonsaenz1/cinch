# Explore feed — partner clothing matched to the closet

Status: **founder-ordered 2026-08-30 ("build it anyway"); design frozen, build next**

## The order, and the conflict it acknowledges

The founder wants Explore to work like an Instagram-style explore surface:
the social features visibly doored (find a friend, friends' closets, daily
looks), plus **a feed of partner clothing similar to what the person already
owns**. This was surfaced as a conflict with standing commitments — the
review notes and privacy policy promise "no shopping unless the person
explicitly asks", and `shoppable` consent defaults off — and the founder
reaffirmed. The resolution that keeps every promise literally true:

**The feed renders only for accounts with `shoppable: on`** (the existing
Privacy & data toggle). For everyone else Explore shows the social doors
plus one honest invitation card explaining what the feed is and routing to
the toggle. Turning it on IS the explicit ask; the feed is the standing
form of it. The review notes and privacy policy gain a sentence saying
exactly that, in the same commit.

## Shape

1. **Doors row** (all users): Find people (`/people-search`), Friends'
   closets (`/friends`), Daily looks (scroll target), Circles (existing
   sheet). Small tiles, existing grammar — the features made "actively
   visible" per the order.
2. **"Similar to your closet" feed** (shoppable-on only):
   - Client derives up to 8 deterministic queries from owned pieces
     (colour + subcategory, the garment-lexicon vocabulary), most-worn
     first — the "similar to what they have" seed.
   - Each query goes through the EXISTING `garment-search` browse path
     (licensed Datafeedr catalogue; server-side `catalog_cache` already
     dedupes and bounds spend; quota already metered per plan).
   - Grid of product cards: image, name, merchant, price; paid-link
     labelling follows the `commerce_joined_programmes` ledger exactly as
     gap-shop links do (CICYBELL is the only paid merchant today).
   - Tapping opens the merchant page — the existing outbound-link path,
     no cart, no checkout, unchanged.
3. **Analytics**: `explore_feed_shown` / `explore_feed_opened_product` —
   counts and a merchant-count only, never queries or closet contents.

## Rules carried over unchanged

- No commission signal may influence ranking (commerce-directive §0).
- The feed never renders for shoppable-off users — not greyed, absent.
- No new vendor, no new data recipient: Datafeedr + the affiliate networks
  already disclosed on cinchstyle.com/privacy.
- Closet photographs never leave the device for this feature; queries are
  derived WORDS (colour + kind), the same class Datafeedr already receives.

## Build order

1. `src/features/explore/feed-queries.ts` — pure query derivation + tests.
2. Server: confirm `garment-search` browse mode accepts the query shape at
   feed volume within existing quotas (no new function unless forced).
3. `src/components/explore/shop-feed.tsx` + doors row; wire into
   `(tabs)/explore.tsx` behind `useShoppable()`.
4. Privacy copy + review-notes sentence, same commit.
5. Tests: consent gating (off = absent), deterministic queries, no
   closet content in analytics.
