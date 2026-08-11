# Directive — wire Datafeedr into `garment-search`

**Written 2026-08-11. For the engineer implementing catalogue lookup.**
**Project:** Supabase `dugizuswuebrmcmvinmi` · function `garment-search` · plan: Datafeedr Starter, paid

---

## 0 · What this replaces, and why it is not a refactor

`garment-search` currently finds a garment's picture by asking a model with a web-search
plugin and resolving `og:image` from whatever page it cites. It works. What it does not
do is acquire any **right** to the photograph it returns — a retailer's product image is
their copyright, and finding it via search grants nothing.

Every image in a Datafeedr feed arrives the other way round: supplied *by* the merchant
*for* use by publishers. That is the licence the web path never had.

So the goal is not "add a second source". It is **to make the licensed path primary and
the web path a fallback that can be switched off entirely**, without `index.ts` changing.

Two files are already committed and are the starting point, not a proposal:

- `supabase/functions/garment-search/catalog.ts` — the provider, written against the
  existing `GarmentImageProvider` interface
- `supabase/migrations/20260811150000_catalog_cache.sql` — cache, quota ledger,
  `claim_catalog_request()`, `sweep_catalog_cache()`

Read both before writing anything. Their header comments carry the reasoning and are not
decoration.

---

## 1 · Verify the wire format before you build on it

**Do this first.** The field names in `catalog.ts` came from Datafeedr's published API
docs but were never byte-verified against a live response — the research pass could not
reach the members area.

Run one `POST https://api.datafeedr.com/search` with your real `aid`/`akey` and a query
you know returns rows. Diff the actual JSON against the `DatafeedrProduct` type in
`catalog.ts`. Fix the type, not the caller.

Three things to confirm specifically, because each has a silent failure mode:

- **`finalprice` and `price` are integers in minor units.** `12999` is $129.99. If you
  parse them as floats or assume dollars, every price in the app is wrong by 100× and
  nothing throws.
- **`url` contains a literal `@@@`** placeholder. Confirm it is present and confirm the
  exact token — a link shipped with `@@@` unreplaced is broken, not merely unmonetised.
- **There is no stock or availability field.** Confirm this. If it turns out one exists,
  say so, because it changes what we can honestly show for a size-level sellout.

---

## 2 · The wiring

`index.ts` today constructs `openRouterWebProvider(...)`. Replace that single expression
with the composition — nothing else in `index.ts` should need to change, and if it does,
that is a signal the seam was wrong and worth raising rather than working around.

```ts
firstLicensed(
  [datafeedrProvider({ accessId, accessKey, affiliateIds, claimRequest, cacheGet, cachePut })],
  openRouterWebProvider(existingOpts),
  allowUnlicensed,      // env-driven, see §5
)
```

The four injected functions are yours to write:

**`claimRequest(exact)`** calls `claim_catalog_request(p_provider, p_exact)` via the
service-role client and returns its boolean. Do not reimplement the quota logic in TypeScript.
It is in SQL specifically so two concurrent lookups cannot both believe they took the
last request of the month.

**`cacheGet(key)`** reads `catalog_lookups`. Return semantics are load-bearing and easy
to get wrong:

| DB state | Return | Meaning |
|---|---|---|
| no row, or `expires_at < now()` | `undefined` | ask the provider |
| row with `products` | `CatalogProduct[]` | serve from cache |
| row with `products IS NULL` | `null` | **cached miss — do not ask again** |

Conflating the last two is the single most expensive bug available here: it turns every
unfindable garment back into a paid request on every retry, and obscure items are exactly
the ones people re-describe. Increment `hits` on every cache read — it is the only honest
measure of whether this is earning its keep.

**`cachePut(...)`** upserts on `cache_key`, setting `expires_at = now() + ttlHours`.
Respect the CHECK constraints rather than working around them.

**`affiliateIds`** — see §3.

---

## 3 · Affiliate IDs, and why substitution happens at render

`affiliateIds` maps Datafeedr `source_id` → your publisher ID **for that network**. Not
merchant ID. Networks are counted per-country instance (Rakuten US and Rakuten UK are
different `source_id`s), so build the map from a live `POST /networks` call rather than
guessing integers.

What you have today:

- **Awin** — `AWIN_PUBLISHER_ID` is already in Edge Function secrets.
- **Rakuten** — **blocked, and this is a real dependency.** Rakuten's `@@@` takes the
  11-character mixed-case *tracking ID*, not the SID. The SID is `4736950`; the tracking
  ID does not exist yet because it only appears inside a generated deep link, which needs
  at least one approved partnership. Two partnerships are pending (Urban Outfitters US,
  Free People). When one is approved, generate any link, read the `id=` parameter, check
  it is 11 characters and mixed case, and add it. **If it is 4–8 digits you have grabbed
  the SID and every Rakuten link will resolve to an error page rather than failing
  loudly.**
- **Everything else** — no ID. That is fine and is the reason we can ship now.

**Substitute `@@@` at render time, never at ingest.** An ID can change, and rows already
in the cache must not carry a stale one baked in. `catalog.ts` already does this; keep it
that way if you touch `normalise()`.

A missing ID is **not an error**. The row falls back to `direct_url`, which is a working,
non-affiliate link — the app is fully functional and earns nothing from that merchant
until approval lands. Monetisation is a revenue problem, not a product-blocking one, and
the `monetised` boolean on `CatalogProduct` exists so the UI can tell the difference if it
ever needs to.

**Read the reference implementation before writing the substitution yourself.** Datafeedr
ships a `Datafeedr API` WordPress plugin whose entire job is "select your affiliate
networks, merchants, enter your affiliate IDs". It is GPL and its source is downloadable
from the WordPress.org repository. None of it runs here — it is PHP for WooCommerce — but
it is the *authoritative* implementation of `@@@` substitution, `source_id` handling, and
the two special cases the docs gloss over: **Zanox** and **Partnerize** need a
per-merchant `zmid` / `camref` fetched at runtime from `/zanox_merchant` and
`/partnerize_campaign` rather than a static ID. If we ever take products from either
network, that lookup is required and the docs describe it in one line. Half an hour
reading their PHP is cheaper than discovering it from broken links in production.

---

## 4 · Close the provenance gap while you are in here

`docs/app-store-listing.md` records this and it is still open: a garment added through
Describe or a pasted link keeps the retailer's photograph as its `image_path` but stores
**no** `listing_source_url` and **no** `listing_source_label`. The insert in
`garment-search/index.ts` (`importImage`) names only `user_id`, `status` and
`description`, and the client's `source` field is accepted and dropped.

So `src/app/item/[id].tsx:873-875` prints its "Listing photo · ⟨retailer⟩" colophon for a
piece matched from the user's own photo, and prints **nothing at all** for an imported
one — which is the case where the credit matters most.

Fix it in this pass. You now have `merchant`, `sourceHost` and `linkUrl` on every
`CatalogProduct`, so the data exists and it is a plumbing change. Attribution is also the
thing most likely to be asked about if anyone ever questions image use, so it is worth
more than its size.

---

## 5 · The kill switch

Add one env flag, read once at startup:

```
GARMENT_SEARCH_ALLOW_UNLICENSED   default "true" for now
```

`false` removes the web provider from the chain entirely — licensed feeds or nothing. The
whole point of `firstLicensed` taking this as an argument rather than hardcoding the chain
is that flipping it must be a deploy, not a refactor.

Ship `true`. Move to `false` once you have measured feed coverage against real user
descriptions and can say what fraction of lookups the feeds actually answer. Do not guess
at that number — instrument it.

---

## 6 · Cost, which is the whole design

The Starter plan is **10,000 requests/month, hard cutoff at the limit, no overage
billing**. That is ~333/day. Three things keep it viable, all already in the committed
code — do not undo them:

**Always request 100.** Datafeedr bills per request regardless of rows returned. Asking
for six tiles and getting six throws away 94 rows you already paid for. `BATCH_SIZE = 100`
is not a tuning knob.

**Key the cache globally, not per user.** "Black Reformation midi dress" is a shared
query, not a personal one. One request answers it for everyone who asks again. A per-user
cache would be a rounding error.

**Cache misses too**, with a shorter TTL than hits — a miss is likelier to become a hit
than a hit is to become wrong.

Also worth knowing: the API is **POST-only with credentials in the body**, so no CDN or
HTTP caching layer can help you. Our own cache is the only one there is.

Add a monitor on `catalog_quota.used / limit_total`. Alarm at 80%. There is no overage
grace — the API simply starts returning error 301 and stays there until the cycle rolls.
Populate `limit_total` from `POST /status`, which also gives `bill_day`; a null
`limit_total` must be treated as *"do not throttle"*, never as *"unlimited"*.

**Never retry a 301.** It is terminal for the billing cycle. A retry loop there burns
latency and hides the outage.

---

## 7 · Hard constraints

1. **Do not remove `admitSource`.** A licensed feed is not a reason to skip the source
   policy. A merchant we refuse on the open web is a merchant we refuse here, or the
   policy meant nothing. `catalog.ts` already applies it; keep the `declined[]` contract
   intact so the UI can still show the honest line.
2. **Do not raise the Amazon TTL ceiling.** The migration has a CHECK pinning Amazon rows
   to 24 hours because that is Associates policy — *"you may store a link... for up to 24
   hours"* — not a performance choice. It is in the schema so it cannot be quietly widened
   in application code. Amazon is not wired up and should not be: its terms forbid caching
   images at all, which is incompatible with a garment picture that lives in a closet for
   years.
3. **Do not rehost feed images without checking the terms first.** Datafeedr's own
   WooCommerce plugin downloads and rehosts by default, which suggests it is contemplated,
   but the rights sit upstream with the merchant. Hotlink until somebody has read
   `members.datafeedr.com/terms` and written down what it says. If you need a decision,
   escalate rather than assume.
4. **Do not bypass `claim_catalog_request`.** Every metered call goes through it,
   including any new lookup mode you add.
5. **Do not paginate past 10,000.** `max_total` caps what any single query can reach via
   `offset`. Shard by merchant or brand instead; do not wait for error 303 to tell you.
6. **Do not invent a confidence score.** Feeds carry no model judgement.
   `rankConfidence()` is a shallow decay over provider rank and is deliberately modest.
   A confident-looking number for a row nobody judged is dishonest in exactly the way
   `provider.ts` warns about.

---

## 8 · Before you trust coverage

Every worked example in Datafeedr's documentation is outdoor gear. Fashion coverage is
plausible — the schema has `size`, `color`, `gender` and `brand` as first-class fields,
and `exclude_duplicates` exists precisely to collapse apparel's size/colour variant
explosion — but it is unproven for the brands Cinch cares about.

Run the real brand list through `merchant_search` and `search` in an afternoon. James
Perse, Reformation, and twenty others off actual user descriptions. If contemporary DTC
coverage is thin, that is worth knowing inside the 30-day money-back window rather than
after.

Two known gaps to plan around either way: `category` is a raw merchant-supplied string
with no normalised taxonomy, so expect to build your own mapping; and the absence of a
stock field means we may show a piece that is sold out in the user's size.

---

## 9 · When a feed row disappears

**This is the gap the plugin list exposed and the rest of this directive did not cover.**

Datafeedr's own recommended stack includes a third-party plugin, *DX Delete Attached
Media*, whose stated job is to "automatically delete images associated with products which
are no longer available". That plugin exists because their reference architecture
downloads and rehosts merchant images, and feed rows **go away** — merchants drop
products, programmes end, whole merchants leave a network. The plugin is WordPress and
irrelevant to us; the problem it solves is not.

For Cinch this is sharper than it is for a storefront, because our images are not
decoration on a page that can 404. A listing photo becomes the picture of a garment
somebody *owns*, and it sits in their closet for years. So:

- **A disappeared feed row must not blank an existing garment's photograph.** Whatever we
  have already attached stays attached. The user's closet is not a cache and must never be
  invalidated by an upstream deletion.
- **But the link may now be dead**, and a tap that lands on a 404 is worse than no link.
  Treat `linkUrl` as expiring independently of the image: re-validate lazily on tap, and
  fall back to hiding the link rather than showing a broken one.
- **`listing_source_label` survives regardless.** The credit is a statement about where
  the picture came from, which stays true after the listing is gone.
- If we ever move from hotlinking to rehosting (see §7.3, still unresolved), this becomes
  a real retention question rather than a link one — a rehosted image outliving its feed
  row is exactly the state the merchant's licence is least likely to cover.

Decide the lazy-revalidation behaviour explicitly and write it down. Do not let it default
to whatever the first implementation happens to do.

## 10 · Done means

- One live `POST /search` diffed against `DatafeedrProduct`, type corrected if needed.
- `firstLicensed` composed in `index.ts`, web provider demoted to fallback.
- `cacheGet` returning three distinct states, verified by a test that a cached miss
  does **not** produce a second provider call.
- Quota claimed through SQL, monitor alarming at 80%.
- `listing_source_url` and `listing_source_label` populated on import, colophon rendering
  for imported garments.
- `GARMENT_SEARCH_ALLOW_UNLICENSED` present and defaulting true.
- Coverage measured against real descriptions, with a number.

Report the coverage number and the cache hit rate after a week of real traffic. Those two
figures decide whether the flag can go to `false`, which is the actual finish line —
everything else here is in service of being able to turn the unlicensed path off.
