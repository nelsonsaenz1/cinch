/**
 * Licensed catalogue lookup — the replacement for pulling images off the open web.
 *
 * WHY THIS FILE EXISTS.
 *
 * `provider.ts` finds garment images by asking a model with a web-search plugin
 * and then resolving og:image from whatever page it cites. That works, and it
 * is why the app ships. What it does not do is acquire any RIGHT to the picture
 * it returns: a retailer's product photograph is their copyright, and finding
 * it via search grants nothing. Every merchant feed in this file, by contrast,
 * arrives with a publisher agreement attached — the image is supplied BY the
 * merchant FOR use by publishers, which is the licence the web path never had.
 *
 * So this implements the same `GarmentImageProvider` seam that provider.ts's
 * own header anticipated ("the seam a dedicated image-search API slots into
 * later"), and index.ts does not change.
 *
 * WHICH PROVIDERS ARE REAL TODAY, AND WHY ONLY ONE.
 *
 *   Datafeedr   LIVE. Aggregates Rakuten, Awin, CJ, Impact, ShareASale,
 *               Pepperjam and ~35 more into one schema. Crucially its docs are
 *               explicit that data access does NOT require your own merchant
 *               approvals: "You can make Requests to the Datafeedr API without
 *               affiliate IDs" — approvals only gate COMMISSION, not catalogue.
 *               That is the only reason a pre-launch app can use any of this.
 *
 *   Sovrn       BLOCKED, not by us. Their onboarding requires the Commerce
 *               JavaScript installed on a live site AND real click traffic
 *               BEFORE they will review the account. A pre-launch iOS app
 *               cannot satisfy that ordering. Adapter is stubbed so it can be
 *               switched on the day approval lands.
 *
 *   Amazon      BLOCKED, and twice over. The Creators API needs an approved
 *               Associates account (3 qualifying sales in 180 days) and then
 *               10 qualifying sales in the trailing 30 days on an ONGOING
 *               basis, with access revoked after 30 days without sales.
 *               Separately its terms forbid caching images at all — a link may
 *               be stored 24 hours, the bytes never. Cinch wants a garment
 *               picture that persists in a closet for years, so even once
 *               eligible, Amazon can only ever be a live pass-through for a
 *               shopping surface, not a source of closet imagery. Encoded here
 *               so nobody later "optimises" it into the import path.
 *
 * THE COST MODEL, WHICH IS THE POINT.
 *
 * Datafeedr meters REQUESTS, not products: one request returning 100 rows costs
 * the same as one returning 1, and the Starter plan is 10,000/month with a hard
 * cutoff and no overage. So the two levers are (a) always ask for 100 and cache
 * every row, and (b) key the cache globally rather than per user, because
 * "black Reformation midi" is a query many people make and one request should
 * answer all of them. See the migration's header for the full argument.
 *
 * The third lever is that this path deletes an LLM call. The web provider spends
 * a vision model plus a web-search plugin per lookup; a feed query spends one
 * HTTP request against a fixed monthly bundle. On any real volume that is the
 * dominant saving, and it is worth more than the per-request accounting.
 */


// ---------------------------------------------------------------------------
// Wire types.
//
// VERIFIED AGAINST LIVE RESPONSES on 2026-08-11, not transcribed from the docs.
// Three separate `POST /search` calls, one of them a full 100-row batch, with
// every field counted. The percentages below are that measurement, and they are
// the reason several fields the docs imply are dependable are typed optional or
// are absent from this type entirely:
//
//   PRESENT ON EVERY ROW (100/100)  id, name, merchant, merchant_id, source,
//     source_id, network, network_id, currency, price, finalprice, url,
//     direct_url, image, instock, onsale, salediscount, seller_party, ref_url
//   MOSTLY PRESENT  brand 96%, category 97%, color 97%, size 96%, sku 96%
//   SPARSE  alternativeimageurl1 43%, saleprice 44%, mpn 47%, gender 68%
//   TOO SPARSE TO BUILD ON  availability 26%, ean 22%, barcode 23%, gtin 1%
//
// FOUR CORRECTIONS TO WHAT THIS FILE ORIGINALLY DECLARED, each of which would
// have failed silently rather than loudly:
//
//   1. There is no `_id`. The identifier is `id` (a number). Nothing read it,
//      so this was a lie the compiler could not catch.
//   2. There is no `thumbnail`. Ever, on any row. `thumbnailUrl` was therefore
//      hardcoded to null in all cases. The real second image is
//      `alternativeimageurl1`, on 43% of rows.
//   3. There is no `upc`. A query on `upc` does not error — it returns zero
//      rows, which the cache would then store as an authoritative negative and
//      never re-ask. That is the exact expensive bug the cache design warns
//      about, arrived at from the opposite direction. See `LookupMode`.
//   4. There IS a stock field, contrary to the directive that commissioned
//      this. `instock` is an integer on 100% of rows. `availability` is a
//      string on 26% of them and spells itself three different ways in one
//      batch ("in-stock", "in_stock", "in stock"), so it is unusable and is
//      typed here only to stop somebody reaching for it.
//
// Prices are INTEGERS IN MINOR UNITS, confirmed: `finalprice: 1428` is $14.28.
// Parsing them as dollars makes every price in the app wrong by 100× and
// nothing throws.
// ---------------------------------------------------------------------------

type DatafeedrProduct = {
  /** Not `_id`. Numeric on every row observed. */
  id: number;
  name: string;
  brand?: string;
  merchant: string;
  merchant_id: number;
  /** Network name, e.g. "Rakuten US". `source_id` is its numeric id. */
  source: string;
  /**
   * The NETWORK id, not the merchant id — and it is per country, so Rakuten US
   * (4) and Rakuten Australia (48) are different values. This is the key
   * `affiliateIds` is indexed by, because a publisher id is issued per network
   * instance and not per merchant.
   */
  source_id: number;
  currency: string;
  /** Regular price, minor units. */
  price: number;
  /** Lower of sale and regular, minor units. Use THIS for display. */
  finalprice: number;
  saleprice?: number;
  onsale?: 0 | 1;
  /**
   * Affiliate URL containing a literal `@@@` placeholder for our publisher id.
   * Confirmed present with the placeholder on 100/100 rows.
   */
  url: string;
  /**
   * Untracked merchant URL. Earns nothing, and is present on 100/100 rows,
   * which is what makes shipping before any approval possible at all.
   */
  direct_url: string;
  /**
   * Do NOT use. Same as `url` but with a SECOND placeholder, `sid=###`, for a
   * per-click sub-id. That is the user-level tracking `commerce-directive.md`
   * §6 refusal 7 forbids, so this field is named here only so that a later
   * reader knows it was seen and rejected rather than missed.
   */
  ref_url?: string;
  /** An impression pixel, also carrying `@@@`. Never requested — we do not
   *  fire tracking pixels for products a user did not ask to see. */
  impressionurl?: string;
  image?: string;
  /** The real second image. There is no `thumbnail` field. 43% of rows. */
  alternativeimageurl1?: string;
  /** Merchant-supplied free text with no normalised taxonomy. Expect to map it
   *  yourself; it is not Google's product taxonomy. */
  category?: string;
  color?: string;
  size?: string;
  gender?: string;
  /** 1 or 0, on every row. The only trustworthy stock signal. */
  instock?: 0 | 1;
  /**
   * Present on 26% of rows and inconsistently spelled across merchants in a
   * single batch. Typed to document that it is unusable, never read.
   */
  availability?: string;
  /** Manufacturer part number, 47%. The closest thing to a stable identifier. */
  mpn?: string;
  sku?: string;
  /** 22%. Real, but far too sparse to hang an exact-lookup mode on. */
  ean?: string;
};

type DatafeedrSearchResponse = {
  products?: DatafeedrProduct[];
  found_count?: number;
  result_count?: number;
  length?: number;
  /** Echoed on every search, so quota can be reconciled without spending a
   *  separate `/status` request. `max_requests` is the plan's monthly cap. */
  status?: {
    request_count?: number;
    max_requests?: number;
    max_length?: number;
    bill_day?: number;
  };
  error?: number;
  message?: string;
};

/** Our own normalised row. Providers converge on this before anything caches. */
export type CatalogProduct = {
  title: string;
  brand: string | null;
  merchant: string;
  /** Host only, e.g. "reformation.com" — matches GarmentCandidate.source. */
  sourceHost: string;
  imageUrl: string;
  thumbnailUrl: string | null;
  /** Where to send a tap. Affiliate link when we have an id, direct otherwise. */
  linkUrl: string;
  /** True when linkUrl earns commission. False is fine and must stay visible. */
  monetised: boolean;
  /** Minor units, as the feed gives them. Never a float. */
  priceMinor: number;
  currency: string;
  /**
   * `mpn` or `ean`, whichever the merchant supplied, else null. NOT a UPC —
   * there is no UPC field. Present on roughly half of rows, so it is a hint for
   * de-duplication and never a key.
   */
  identifier: string | null;
  /** Datafeedr's own row id. Stable enough to use as a React key. */
  externalId: string;
  /** Datafeedr's own merchant id — NOT the id the network uses in `awinmid`. */
  merchantId: string;
  /** The network instance, per country. See `DatafeedrProduct.source_id`. */
  sourceId: number;
  /** The merchant's plain URL. Earns nothing, and works without any approval. */
  directUrl: string;
  colour: string | null;
  /**
   * The merchant's own free-text category. 97% of rows, no normalised taxonomy
   * — it is Walmart's word for the department, not Google's product taxonomy.
   *
   * Carried so family grouping has a second, independent signal for product
   * class when the title alone is ambiguous. It is a HINT and never a key: the
   * handoff's §11 is explicit that implementation may not assume a listing has
   * "an image, an alternate image, a colour name, a gender, or a clean product
   * title", and category is the same kind of optional.
   */
  category: string | null;
  /**
   * 68% of rows, per the field census above. Far too sparse to filter on, and
   * it is exactly the axis `WEAK_TERMS` drops from the query — so it is carried
   * for DISPLAY and for tie-breaking only, never as a retrieval constraint.
   */
  gender: string | null;
};

/**
 * Which affiliate network family a Datafeedr `source_id` belongs to.
 *
 * Only the two Cinch holds a publisher id for are named; everything else
 * returns null and can therefore never be treated as monetisable, which is the
 * conservative direction. Country instances collapse to one family because a
 * publisher id is issued per account, not per territory.
 */
export function networkFamily(sourceId: number): 'awin' | 'rakuten' | null {
  if (sourceId === 310 || sourceId === 10) return 'awin';
  if (sourceId === 4 || sourceId === 48) return 'rakuten';
  return null;
}

// ---------------------------------------------------------------------------

const DATAFEEDR_URL = 'https://api.datafeedr.com/search';

/**
 * United States network instances, by `source_id`, ordered by catalogue size.
 *
 * Datafeedr aggregates 305 network instances across every country it covers,
 * and a query without this filter returns NZD, AUD, GBP and EUR rows — measured,
 * not hypothesised: the first result for "reformation midi dress" unfiltered was
 * a New Zealand dollar listing. Cinch is a US app, so a garment priced in NZD is
 * simply wrong on screen, and a link to a NZ storefront cannot be bought from.
 *
 * Read from Datafeedr's own `/networks` on 2026-08-11 rather than guessed:
 *   335 Impact US · 3 CJ US · 4 Rakuten US · 310 Awin US · 7 Ascend US
 *   812 Partnerize US · 126 AvantLink US
 * Coupon/deal instances are deliberately excluded — they carry offers, not
 * garments. Tradedoubler, Webgains and GoAffPro US are excluded as too small to
 * pay for their share of a 100-row batch.
 */
const US_SOURCE_IDS = [335, 3, 4, 310, 7, 812, 126] as const;

/**
 * Always 100. The plan meters requests, so asking for six tiles and getting six
 * rows costs exactly what asking for 100 costs, and throws away 94 rows we have
 * already paid for. The extra rows go straight into the cache.
 */
const BATCH_SIZE = 100;

/** Feeds refresh daily at best, so a day is the shortest honest TTL. */
const HIT_TTL_HOURS = 24 * 7;
/**
 * Misses expire sooner than hits. A garment that is unfindable today may be
 * listed tomorrow, whereas a garment found today is rarely wrong tomorrow — so
 * the asymmetry runs this way round, not the other.
 */
const MISS_TTL_HOURS = 24;

const REQUEST_TIMEOUT_MS = 20_000;

export type DatafeedrOpts = {
  accessId: string;
  accessKey: string;
  /**
   * Publisher ids per Datafeedr `source_id`, used to replace the `@@@` token in
   * `url` at RENDER time rather than ingest time — an id can change, and rows
   * already cached should not carry a stale one baked in.
   *
   * A missing entry is not an error. It means that merchant's link is not
   * monetisable by us yet, and the row falls back to `direct_url`. That is the
   * whole reason we can ship before approvals land.
   */
  affiliateIds: Record<number, string>;
  /** Injected so the cache and quota ledger stay testable. */
  claimRequest: (exact: boolean) => Promise<boolean>;
  cacheGet: (key: string) => Promise<CatalogProduct[] | null | undefined>;
  /**
   * `terms` is the sanitised, order-free vocabulary subset — NEVER the words
   * the user typed. See `RETAINED_TERMS`.
   */
  cachePut: (
    key: string,
    mode: LookupMode,
    terms: string[],
    products: CatalogProduct[] | null,
    ttlHours: number,
  ) => Promise<void>;
};

/**
 * `barcode` is deliberately absent, and this is a measurement rather than a
 * preference.
 *
 * There is no `upc` field in the feed. `ean` appears on 22% of rows, `barcode`
 * on 23%, `gtin` on 1% — and Datafeedr's query language is AND-only, so
 * covering them would take three separate requests to answer one scan, at three
 * times the price, to reach at best a quarter of the catalogue.
 *
 * Worse, a query naming a field that does not exist returns **zero rows with a
 * 200 and no error**. So a barcode mode would have looked like it worked, cached
 * every scan as an authoritative negative under the negative-caching rule, and
 * never asked again. The cache would have been faithfully remembering an answer
 * it never got. `catalog_lookups.mode` still permits the value so that a future
 * provider with real barcode support needs no migration.
 */
export type LookupMode = 'keyword' | 'url';

/**
 * How aggressively Datafeedr collapses a merchant's own variant rows, and the
 * one query parameter whose right value depends on what the caller is FOR.
 *
 * Datafeedr's `exclude_duplicates` takes fields separated by spaces (all must
 * match to count as a duplicate) or by `|` (any may match). Feeds carry one row
 * per size AND per colourway, so a single shirt can consume a whole 100-row
 * batch — which is why this was set at all.
 *
 * `'variants'`  `merchant_id name|image` — the original. A duplicate is any row
 *     from the same merchant sharing a name OR an image. It collapses sizes,
 *     which is the point, but it ALSO collapses colourways whenever a merchant
 *     titles every colour identically ("Crew Neck Jersey Tee") and distinguishes
 *     them only by the `color` column. Correct for `gap-shop-match`, which wants
 *     one representative row per garment to suggest.
 *
 * `'colourways'`  `merchant_id name image` — a duplicate must share the merchant
 *     AND the name AND the image. Sizes still collapse (same name, same photo);
 *     colourways survive (same name, DIFFERENT photo). Required by the family
 *     contract, where the colourways are the thing the user is choosing between
 *     and collapsing them is not an optimisation but data loss.
 *
 * It is part of the cache key for the same reason `category` and the merchant
 * constraint are: it changes the result set, so two lookups differing only by
 * it must not collide on one row. Without that, `gap-shop-match` would serve
 * `garment-search` a set with the colourways already thrown away.
 */
export type DuplicateMode = 'variants' | 'colourways';

const DUPLICATE_RULE: Record<DuplicateMode, string> = {
  variants: 'merchant_id name|image',
  colourways: 'merchant_id name image',
};

/**
 * Whether a row the user cannot buy today is still an answer.
 *
 * `'in-stock-only'` adds `instock = 1`. It is right for `gap-shop-match`, whose
 * rows become a suggestion to go and buy something: a sold-out listing there is
 * a dead tile and a small betrayal.
 *
 * `'any'` drops the filter, and it is right for the matcher, where it is not a
 * refinement but a correctness fix. The accepted handoff says so in as many
 * words (§11): implementation must not assume *"that stock or availability
 * matters. It is never shown; a garment the user owns is owned regardless."*
 * The person is not shopping — they are looking for a photograph of a shirt
 * that is already in their wardrobe, and the shirts most likely to be missing
 * from a live feed are exactly the ones somebody has owned long enough to have
 * stopped being able to buy. Filtering those out means the app cannot find the
 * garments its user is most likely to have.
 *
 * A caller must ask for `'any'` explicitly. The shared default stays strict, so
 * nothing that sells anything can quietly inherit a shopping surface full of
 * things nobody can buy.
 */
export type Availability = 'in-stock-only' | 'any';

/**
 * One step of the relaxation ladder.
 *
 * `brand` is per-rung and OPTIONAL — undefined means "whatever the query's own
 * brand was", null means "this rung asks without a brand at all". That last
 * case exists for one reason, and it is a real failure rather than a nicety:
 * the parser's brand heuristic reads a leading unrecognised word as a maker,
 * and a wrong maker in `brand =` empties every rung, so the search returns
 * nothing while the garment sits in the catalogue. A final brandless rung is
 * the bounded recovery. See `ladderFor`.
 */
export type LadderRung = { value: string; brand?: string | null };

/**
 * Everything a lookup can be narrowed by, as one object.
 *
 * Was six positional parameters and had become unreadable at the call sites —
 * `searchCatalogue(opts, 'keyword', value, null, null, undefined, 'colourways')`
 * is a line nobody can check against its signature. Every field is optional and
 * every default is the conservative one, so an omitted field cannot widen what
 * a caller sees.
 */
export type CatalogueQuery = {
  /** Goes to the `brand` COLUMN, never into the free-text match. */
  brand?: string | null;
  category?: string | null;
  /** A curated merchant set. `garment-search` deliberately passes none. */
  merchantIds?: readonly number[];
  duplicates?: DuplicateMode;
  availability?: Availability;
  /** Replaces the built-in ladder. Truncated to `MAX_ATTEMPTS` regardless. */
  rungs?: readonly LadderRung[];
};

/**
 * Normalisation is what makes the cache global rather than per-user.
 *
 * Two people describing the same dress must collide, so we lowercase, collapse
 * whitespace, strip punctuation that carries no meaning in a product name, and
 * sort nothing — word order is signal in fulltext search. Deliberately NOT
 * stemming: Datafeedr stems server-side, and doing it twice loses "=exact".
 */
export function normaliseQuery(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // combining marks, escaped so this file stays text
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

/**
 * The brand is part of the key, and omitting it would be a correctness bug
 * rather than a tuning one: `brand = Reformation` plus "midi dress" and a bare
 * "midi dress" are genuinely different result sets, so they must not collide on
 * one cache row. Normalised the same way the query is, so casing cannot fork it.
 */
async function cacheKey(
  provider: string,
  mode: LookupMode,
  query: string,
  brand?: string | null,
): Promise<string> {
  const brandPart = brand ? normaliseQuery(brand) : '';
  const data = new TextEncoder().encode(
    `${provider} ${mode} ${brandPart} ${normaliseQuery(query)}`,
  );
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Datafeedr's query language is an array of `field operator argument` strings,
 * AND-ed together, and it requires at least one positive condition — an
 * all-negative query is rejected with a 400 rather than returning everything.
 *
 * `image !EMPTY` is not a nicety. A feed row with no image is useless to us
 * specifically, and filtering server-side means the 100 rows we paid for are
 * 100 usable rows instead of 60.
 */
function buildQuery(
  mode: LookupMode,
  value: string,
  brand?: string | null,
  category?: string | null,
  merchantIds?: readonly number[],
  availability: Availability = 'in-stock-only',
): string[] {
  // Applied to every mode. Locale first because it is the filter that changes
  // the answer most. `instock = 1` is the only stock signal present on every
  // row — and whether it belongs here at all depends on what the caller is for,
  // which is why it is a parameter and not a constant. See `Availability`.
  const base = [
    `source_id IN ${US_SOURCE_IDS.join(',')}`,
    'currency = USD',
    'image !EMPTY',
  ];
  if (availability === 'in-stock-only') base.push('instock = 1');

  // The merchant's own free-text category. Not a taxonomy and not trustworthy
  // on its own, but it is the only signal that separates a coat from a coat
  // STAND, and a shop suggestion built from a slot alone otherwise reaches into
  // Walmart's automotive feed. Measured, not assumed.
  if (category) base.push(`category LIKE ${category}`);

  // A curated merchant set, when the caller has one. `gap-shop-match` passes
  // `ALLOWED_MERCHANTS`; `garment-search` deliberately passes nothing and keeps
  // the whole catalogue — see `_shared/merchants.ts` for why the two paths
  // differ. Applied server-side so the 100 rows we pay for are 100 rows from
  // shops we would actually name, rather than 100 rows we then throw away.
  if (merchantIds?.length) base.push(`merchant_id IN ${merchantIds.join(',')}`);

  if (mode === 'url') return [...base, `direct_url LIKE ${value}`];

  // A known brand goes in the `brand` field, never into the free-text match.
  //
  // Measured on 2026-08-11, twenty rows each: `brand = Reformation` returned
  // 20/20 actual Reformation garments. The same words as `name LIKE reformation
  // midi dress` returned Zadig & Voltaire's "Reforme" dress and a SHEIN listing
  // that had "Reformation" stuffed into its title alongside eleven other
  // keywords. Feed titles are merchant-authored marketing copy and a brand name
  // inside one is not evidence the garment is that brand; the `brand` column is.
  if (brand) {
    const rest = normaliseQuery(value);
    return rest
      ? [...base, `brand = ${brand}`, `name LIKE ${rest}`]
      : [...base, `brand = ${brand}`];
  }

  return [...base, `name LIKE ${normaliseQuery(value)}`];
}

/**
 * Words a shopper says that a merchant rarely writes in a product title.
 *
 * These are not stopwords in the usual sense — they carry real meaning to a
 * person. They are listed because `name LIKE` is AND across every term, so a
 * single word the merchant happened not to type reduces the entire result set
 * to zero. Gender words are the worst offenders: "James Perse mens white button
 * down" returns NOTHING, while the same phrase without "mens" returns five
 * actual James Perse shirts. The garment exists; the word does not.
 *
 * They are dropped only on the second rung of the ladder below, never on the
 * first — if the merchant DID write "mens", matching it is better.
 */
const WEAK_TERMS: ReadonlySet<string> = new Set([
  'mens', 'men', 'womens', 'women', 'woman', 'man', 'ladies', 'unisex', 'girls', 'boys',
  'my', 'a', 'an', 'the', 'and', 'with', 'for', 'from', 'in', 'of',
  'size', 'new', 'vintage', 'old', 'favourite', 'favorite',
]);

/**
 * The only words this cache is willing to remember.
 *
 * WHY A CACHE ROW MAY NOT HOLD WHAT SOMEBODY TYPED
 *
 * `catalog_lookups` is keyed globally and deliberately not attributed to any
 * user, which is what makes one paid request answer a question for everybody
 * who asks it again. That same property is why the row must not hold free text:
 * an unattributed table is not an anonymous one if the sentence inside it is
 * "my late nan's cardigan" or names a person, a place, or an occasion. People
 * describe clothes by what happened in them.
 *
 * So the row stores the SHA-256 cache key — which is what the lookup actually
 * needs — plus the subset of words below and nothing else. Anything absent from
 * this list is dropped before the write and never reaches Postgres.
 *
 * The retained terms are also SORTED AND DEDUPLICATED, which matters more than
 * it looks: it turns a phrase into a set, so word order is destroyed and the
 * original sentence cannot be reconstructed from the row even in principle.
 * "black wool coat" and "coat, wool, black" both store `{black, coat, wool}`.
 *
 * Kept deliberately small. It exists to answer "what kinds of garment is this
 * cache being asked about" for capacity and coverage work — not to reconstruct
 * queries. Brands are NOT in it: a brand is not private, but keeping brands
 * plus colours plus garment nouns starts to approach the original phrase again,
 * and the coverage question does not need them.
 */
const RETAINED_TERMS: ReadonlySet<string> = new Set([
  // Garment nouns — the ten slots and the words people reach for.
  'shirt', 'blouse', 'top', 'tee', 't-shirt', 'tank', 'sweater', 'jumper',
  'cardigan', 'hoodie', 'sweatshirt', 'knit', 'knitwear', 'polo',
  'trousers', 'pants', 'jeans', 'chino', 'chinos', 'shorts', 'skirt',
  'leggings', 'joggers', 'dress', 'gown', 'jumpsuit', 'romper',
  'coat', 'jacket', 'blazer', 'parka', 'anorak', 'overcoat', 'trench', 'vest',
  'shoes', 'sneakers', 'trainers', 'boots', 'loafers', 'sandals', 'heels',
  'pumps', 'clogs', 'bag', 'handbag', 'tote', 'backpack', 'clutch', 'purse',
  'hat', 'cap', 'beanie', 'scarf', 'belt', 'gloves', 'sunglasses', 'tie',
  'necklace', 'bracelet', 'earrings', 'ring', 'suit', 'shirtdress',
  // Colours.
  'black', 'white', 'grey', 'gray', 'navy', 'blue', 'red', 'green', 'brown',
  'beige', 'cream', 'ivory', 'tan', 'camel', 'olive', 'khaki', 'pink', 'purple',
  'yellow', 'orange', 'burgundy', 'maroon', 'charcoal', 'silver', 'gold',
  // Materials.
  'wool', 'cotton', 'linen', 'silk', 'cashmere', 'denim', 'leather', 'suede',
  'merino', 'corduroy', 'velvet', 'satin', 'tweed', 'nylon', 'fleece',
  // Cut and length — the words that change which garment is meant.
  'midi', 'maxi', 'mini', 'cropped', 'oversized', 'slim', 'straight', 'wide',
  'skinny', 'relaxed', 'tailored', 'pleated', 'quilted', 'striped', 'floral',
  'checked', 'plaid', 'ribbed', 'button', 'down', 'crewneck', 'vneck', 'collar',
  'sleeve', 'sleeveless', 'longsleeve', 'high', 'waisted', 'long', 'short',
]);

/** At most this many terms per row. A bound, not a business rule. */
const MAX_RETAINED_TERMS = 12;

/**
 * The sanitised, order-free record of what a lookup was about.
 *
 * Returns a sorted, deduplicated subset of `RETAINED_TERMS`. A description made
 * entirely of words outside the vocabulary returns an empty array, and that is
 * a correct answer — the row still works, because the cache is keyed on the
 * hash and never on this.
 */
export function retainableTerms(raw: string): string[] {
  const seen = new Set<string>();
  for (const token of normaliseQuery(raw).split(' ')) {
    if (RETAINED_TERMS.has(token)) seen.add(token);
  }
  return [...seen].sort().slice(0, MAX_RETAINED_TERMS);
}

/**
 * Never spend more than this many metered requests answering one description.
 *
 * The ladder only runs when a rung returns nothing, so the common case is one
 * request. Three is the ceiling for the pathological case, and it is a ceiling
 * rather than a target.
 */
const MAX_ATTEMPTS = 3;

/**
 * Progressively looser queries, most faithful first.
 *
 * `name LIKE` is AND, which makes a long natural description brittle in a way
 * that fails silently: the user gets an empty result and concludes the app does
 * not have their garment, when in fact it had five of them and one adjective
 * excluded all five. Relaxing is what turns that into an answer.
 *
 * The ladder never goes below two terms. A one-term query ("shirt") is not a
 * looser version of the question, it is a different and useless one, and
 * answering it would be worse than admitting the miss.
 */
function relaxations(value: string): string[] {
  const terms = normaliseQuery(value).split(' ').filter(Boolean);
  if (terms.length === 0) return [];

  const ladder: string[] = [terms.join(' ')];

  // Rung two: the same request with the words merchants do not write.
  const strong = terms.filter((t) => !WEAK_TERMS.has(t));
  if (strong.length >= 2 && strong.length < terms.length) ladder.push(strong.join(' '));

  // Rung three onward: shed trailing words. Titles lead with the brand and the
  // garment and trail off into colour and cut, so the front of the phrase is
  // where the identifying signal is.
  let rest = strong.length >= 2 ? [...strong] : [...terms];
  while (rest.length > 2 && ladder.length < MAX_ATTEMPTS) {
    rest = rest.slice(0, -1);
    ladder.push(rest.join(' '));
  }

  // Distinct, in order, bounded.
  return [...new Set(ladder)].slice(0, MAX_ATTEMPTS);
}

function hostOf(raw: string): string | null {
  try {
    return new URL(raw).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function normalise(row: DatafeedrProduct, affiliateIds: Record<number, string>): CatalogProduct | null {
  const image = row.image;
  if (!image) return null;

  // The host must come from `direct_url` and nothing else.
  //
  // `url` is the network's redirector — anrdoezrs.net, click.linksynergy.com,
  // pntrs.com — so deriving the host from it would label every garment with the
  // name of an affiliate network the user has never heard of, and would hand
  // `admitSource` a redirector to judge instead of the shop. `direct_url` is on
  // 100% of rows, so there is no case where the fallback was needed anyway.
  const host = hostOf(row.direct_url);
  if (!host) return null;

  const affiliateId = affiliateIds[row.source_id];
  // `@@@` is Datafeedr's literal placeholder, confirmed present on every
  // affiliate URL. A link still carrying it is BROKEN, not merely unmonetised,
  // so it must never reach a client.
  const monetised = Boolean(affiliateId) && row.url.includes('@@@');
  const linkUrl = monetised ? row.url.replaceAll('@@@', affiliateId!) : row.direct_url;
  if (!linkUrl || linkUrl.includes('@@@')) return null;

  return {
    title: row.name.slice(0, 200),
    brand: row.brand?.slice(0, 80) ?? null,
    merchant: row.merchant,
    sourceHost: host,
    imageUrl: image,
    // There is no `thumbnail` field; this is the real second image and it is
    // absent more often than not, which is why the type is nullable.
    thumbnailUrl: row.alternativeimageurl1 ?? null,
    linkUrl,
    monetised,
    priceMinor: row.finalprice ?? row.price,
    currency: row.currency,
    identifier: row.mpn ?? row.ean ?? null,
    externalId: String(row.id),
    merchantId: String(row.merchant_id),
    sourceId: row.source_id,
    directUrl: row.direct_url,
    colour: row.color?.trim().slice(0, 60) ?? null,
    category: row.category?.trim().slice(0, 120) ?? null,
    gender: row.gender?.trim().slice(0, 20) ?? null,
  };
}

/**
 * One metered call. Returns null when the quota gate refused — which is a
 * normal outcome near the end of a billing cycle, not an error, and the caller
 * degrades to "no listing photo" rather than to an unlicensed one.
 */
async function fetchBatch(
  opts: DatafeedrOpts,
  mode: LookupMode,
  value: string,
  brand: string | null | undefined,
  query: CatalogueQuery,
): Promise<CatalogProduct[] | null> {
  const exact = mode !== 'keyword';
  if (!(await opts.claimRequest(exact))) return null;

  const body = {
    aid: opts.accessId,
    akey: opts.accessKey,
    query: buildQuery(mode, value, brand, query.category, query.merchantIds, query.availability),
    // NO `sort`. This field previously read `sort: ['+finalprice']` and that was
    // actively harmful, which only shows up when you look at the rows.
    //
    // Cheapest-first on an open catalogue of 924 million products does not
    // surface a bargain, it surfaces the bottom of the market: the measured top
    // result for "reformation midi dress" was a $14 SHEIN listing whose title
    // had the word "Reformation" stuffed into it. Ascending price is a ranking
    // by how little the garment resembles the one that was asked for.
    //
    // Omitting `sort` gives Datafeedr's own relevance ordering, which is the
    // thing we are actually paying it for. Price belongs in the UI as a fact
    // about a row, not as the axis the answer is chosen along.
    limit: BATCH_SIZE,
    // Feeds carry one row per size and colourway; without this a single dress
    // consumes the whole batch. Measured: 462 raw rows collapse to 146. Which
    // rule applies depends on whether the caller is choosing a garment or
    // choosing between its colours — see `DuplicateMode`.
    exclude_duplicates: DUPLICATE_RULE[query.duplicates ?? 'variants'],
  };

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(DATAFEEDR_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    const json = (await res.json()) as DatafeedrSearchResponse;

    // 301 is "monthly request limit exceeded". It is terminal for the cycle, so
    // it must never be retried — a retry loop here burns nothing but latency
    // and hides the outage.
    if (json.error === 301) return null;
    if (!res.ok || json.error) return null;

    const rows = (json.products ?? [])
      .map((r) => normalise(r, opts.affiliateIds))
      .filter((r): r is CatalogProduct => r !== null);
    return rows;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Cache-then-fetch, in the order that spends least.
 *
 * The `url` mode is permitted deeper into the quota reserve than `keyword`
 * because it answers a question the user has already made specific — they
 * pasted a link — whereas a keyword search is the speculative one. When the
 * tank runs low the speculative lookups are what should stop.
 */
async function lookup(
  opts: DatafeedrOpts,
  mode: LookupMode,
  value: string,
  query: CatalogueQuery,
): Promise<CatalogProduct[]> {
  const { brand, category, merchantIds, duplicates = 'variants', availability, rungs } = query;
  // The category is part of the key for the same reason the brand is: it
  // changes the result set, so two lookups differing only by it must not
  // collide on one cache row.
  // The merchant constraint is part of the key alongside the category, and for
  // a sharper reason: `gap-shop-match` and `garment-search` can ask the same
  // words of the same catalogue and must NOT share a row. One is restricted to
  // 82 shops and the other is not, so a shared row would serve one path the
  // other's answer — the allowlist would silently leak into search results, or
  // worse, search's open results would surface as gap suggestions.
  //
  // The duplicate rule joins them for the sharpest version of the same reason:
  // a `variants` row set has already had its colourways collapsed by Datafeedr,
  // so serving it to a `colourways` caller would hand the family contract a set
  // with the very rows it exists to offer already thrown away — and it would
  // look like a garment that comes in one colour rather than like a bug.
  //
  // Availability is in the key for the sharpest reason of the three: an
  // in-stock-only row set is a STRICT SUBSET of the same query answered with
  // `'any'`. Sharing a row would let `gap-shop-match` serve the matcher a set
  // with every discontinued garment already removed — and those are exactly the
  // garments somebody has owned long enough to be looking for.
  const scope = merchantIds?.length ? `m${merchantIds.length}:${merchantIds.join(',')}` : '';
  const key = await cacheKey(
    'datafeedr',
    mode,
    `d:${duplicates} a:${availability ?? 'in-stock-only'} ${scope} ${category ?? ''} ${value}`,
    brand,
  );

  const cached = await opts.cacheGet(key);
  // `null` is a cached MISS and is authoritative — returning [] here without
  // re-querying is the entire point of negative caching.
  if (cached !== undefined) return cached ?? [];

  // A `url` lookup is an exact identifier and has nothing to relax; only a
  // described garment walks the ladder.
  //
  // `rungs`, when the caller supplies them, REPLACE the built-in ladder rather
  // than adding to it — and they are truncated to the same MAX_ATTEMPTS ceiling
  // whatever the caller believes, because that ceiling is a bill and not a
  // preference. The matcher passes a ladder built from a parsed query, which
  // knows which word is the gender term; `relaxations` can only guess from a
  // word list. Both stay bounded at three metered requests.
  const attempts: LadderRung[] =
    mode === 'url'
      ? [{ value }]
      : rungs?.length
        ? rungs.slice(0, MAX_ATTEMPTS).map((r) => ({ ...r }))
        : relaxations(value).map((v) => ({ value: v }));

  let fetched: CatalogProduct[] | null = null;
  for (const attempt of attempts) {
    // `undefined` means "the query's own brand"; an explicit `null` means this
    // rung deliberately asks without one. The distinction is the whole of the
    // brand-relaxation recovery, so it must not be collapsed with `??`.
    const rungBrand = 'brand' in attempt ? attempt.brand : brand;
    fetched = await fetchBatch(opts, mode, attempt.value, rungBrand, query);
    // A refusal or a transport failure is not evidence of absence, and looser
    // wording will not fix a spent quota — stop rather than burn the ladder.
    if (fetched === null) return [];
    if (fetched.length) break;
  }
  if (fetched === null) return [];

  // Cached under the ORIGINAL key whichever rung answered, so the relaxation is
  // paid for once per phrasing rather than on every retry. A stored miss means
  // "the whole ladder found nothing", which is the only honest negative.
  await opts.cachePut(
    key,
    mode,
    // The vocabulary subset, not `value`. The raw description is used to build
    // the hash and to query the provider, and is then discarded.
    retainableTerms(value),
    fetched.length ? fetched : null,
    fetched.length ? HIT_TTL_HOURS : MISS_TTL_HOURS,
  );
  return fetched;
}

/**
 * Apply the source policy to feed rows, cheapest-first, and stop once enough
 * have been admitted.
 *
 * `admitSource` is ASYNC and fetches robots.txt for each new origin — so running
 * it across all 100 rows of a batch would mean up to 100 sequential network
 * round trips to fill six tiles. Rows are therefore checked in relevance order
 * and the walk stops at `limit`, which in practice touches a handful of hosts
 * and hits policy.ts's own robots cache for the rest.
 *
 * Directive §7.1: a licensed feed is NOT a reason to skip this. A merchant we
 * refuse on the open web is a merchant we refuse here, or the policy meant
 * nothing. The `declined` list stays deduplicated by host so the UI can still
 * render the honest "three shops asked not to be read" line.
 */

/**
 * Search the licensed catalogue. THE shared entry point.
 *
 * Returns normalised rows and nothing else — no ranking beyond the provider's
 * own relevance, no source policy, no notion of what the caller wants them for.
 * Both callers wrap this with their own judgement:
 *
 *   garment-search  adds `admitSource` and the GarmentImageProvider interface,
 *                   because those rows become the picture of a garment somebody
 *                   OWNS and the source policy governs that.
 *   gap-shop-match  adds relevance ranking and merchant capping, because those
 *                   rows become a shop suggestion.
 *
 * Splitting here rather than sharing the provider is deliberate: the two use
 * the same licensed data and want genuinely different things from it, and a
 * single wrapper serving both would have to be told which caller it was
 * serving — which is the shape of a function about to grow a boolean.
 */
export async function searchCatalogue(
  opts: DatafeedrOpts,
  mode: LookupMode,
  value: string,
  query: CatalogueQuery = {},
): Promise<CatalogProduct[]> {
  return await lookup(opts, mode, value, query);
}
