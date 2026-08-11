# The merchant allowlist

*How `supabase/functions/_shared/merchants.ts` was built, and how to rebuild it.*

## What it is

82 apparel retailers. `gap-shop-match` will name no other shop.

## Why a list at all

Datafeedr aggregates 44,027 merchants with no shared taxonomy and no quality
floor. Sorted by catalogue size it is Walmart's twenty-odd department feeds,
Wayfair, Barnes & Noble, Etsy, Zoro, AliExpress and SHEIN — and a gap suggestion
drawn from that pool returns their inventory, because that *is* most of the
inventory.

No query fixes it. The merchant-authored `category` field was tried first and
does not survive contact with the data: Wayfair files furniture under "Shoes"
and a dressmaker's mannequin under "Dresses". See
`docs/decisions/2026-08-11-gap-shop-junk-results.md`.

So the shops are chosen instead. Cinch shows at most three merchants for a gap
somebody actually has; which three is a product decision, and it belongs in the
repository where it can be read and argued with.

## Where it does and does not apply

| Path | Allowlist | Why |
| --- | --- | --- |
| `gap-shop-match` | **yes** | "Suggest what I am missing" — we choose the shops |
| `garment-search` | **no** | "Find me this specific garment I own" — the user named it, and a narrow set would just fail to find it. Measured coverage 93%. |

The allowlist is part of the catalogue cache key, so the two paths cannot share
a cached row and leak into each other.

## Membership is not monetisation

Being on this list earns a merchant nothing and costs them nothing. It is not a
joined programme, not a commission agreement, and the list is not ordered by
what anything pays. `commerce_joined_programmes` is the only place money is
recorded, and it is consulted *after* ranking, purely to label a link truthfully.
Several shops here will never be joined at all.

## How it was built

1. **Hand-write the retailers.** Real apparel shops, chosen for the wardrobe
   Cinch is for — department stores, direct-to-consumer, tailoring, outerwear,
   footwear, a few luxury resale. Roughly 140 names.
2. **Intersect with what is reachable.** A merchant counts only if it is:
   - on one of the seven networks in `US_SOURCE_IDS` (Impact US 335, CJ US 3,
     Rakuten US 4, Awin US 310, Ascend US 7, Partnerize US 812, AvantLink US
     126), **and**
   - carrying `product_count > 0`.
3. **Keep the highest-count entry per name.** A merchant often appears on
   several networks; one of them usually has the catalogue and the rest are
   coupon-only feeds with zero products.

Step 2 removed 30 names. Uniqlo, L.L.Bean, Vans, Reiss, Kate Spade,
Abercrombie, DSW and others are all *in* Datafeedr — but only via networks we do
not query, or as coupon feeds with no products. A name in the roster is not a
reachable merchant, and this is the trap the first attempt at this list fell
into: a lookup by name alone "matched" 111 of 144, of which 70 had an empty
catalogue.

## Rebuilding it

The roster comes from Datafeedr's `POST /merchants`. Note that `source_id` in
the request body is **ignored** — the endpoint returns all 44,027 rows whatever
you send, so filter client-side on `source_id` and `product_count`.

```
POST https://api.datafeedr.com/merchants
{ "aid": "...", "akey": "...", "limit": 2000 }
```

Fields used: `merchant_id`, `name`, `source_id`, `source`, `product_count`.

This costs metered requests — the same 10,000/month pool as everything else in
`catalog_quota` — so rebuild deliberately, not on a schedule.

## When to change it

- **A shop stops carrying products.** `commerce_health`'s `coverage` figure
  falls; the `coverage_degraded` alert fires below 50% on a sample of 50+.
- **A programme is approved.** Add it to `commerce_joined_programmes` so its
  links become legitimately `paid`. That is a separate table and a separate
  decision — approval does not add a shop here, and being here does not imply
  approval.
- **A shop is wrong for the product.** This is a taste decision and needs no
  measurement to justify. Remove it.

Changing the list changes the cache key, so existing cached rows for the old set
are simply never read again and expire on their own. No purge is needed.
