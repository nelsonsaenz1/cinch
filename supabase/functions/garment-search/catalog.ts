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

import type {
  GarmentCandidate,
  GarmentImageProvider,
  ListingCandidate,
  MatchInput,
  MatchResult,
  ProviderInput,
  ProviderResult,
} from './provider.ts';
import { admitSource, type Declined } from './policy.ts';

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
};

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
  cachePut: (
    key: string,
    mode: LookupMode,
    query: string,
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
 * Normalisation is what makes the cache global rather than per-user.
 *
 * Two people describing the same dress must collide, so we lowercase, collapse
 * whitespace, strip punctuation that carries no meaning in a product name, and
 * sort nothing — word order is signal in fulltext search. Deliberately NOT
 * stemming: Datafeedr stems server-side, and doing it twice loses "=exact".
 */
function normaliseQuery(raw: string): string {
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
function buildQuery(mode: LookupMode, value: string, brand?: string | null): string[] {
  // Applied to every mode. Locale first because it is the filter that changes
  // the answer most; `instock = 1` because a garment the user cannot buy is a
  // dead tile, and it is the only stock signal present on every row.
  const base = [
    `source_id IN ${US_SOURCE_IDS.join(',')}`,
    'currency = USD',
    'instock = 1',
    'image !EMPTY',
  ];

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
  brand?: string | null,
): Promise<CatalogProduct[] | null> {
  const exact = mode !== 'keyword';
  if (!(await opts.claimRequest(exact))) return null;

  const body = {
    aid: opts.accessId,
    akey: opts.accessKey,
    query: buildQuery(mode, value, brand),
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
    // consumes the whole batch. Measured: 462 raw rows collapse to 146.
    exclude_duplicates: 'merchant_id name|image',
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
  brand?: string | null,
): Promise<CatalogProduct[]> {
  const key = await cacheKey('datafeedr', mode, value, brand);

  const cached = await opts.cacheGet(key);
  // `null` is a cached MISS and is authoritative — returning [] here without
  // re-querying is the entire point of negative caching.
  if (cached !== undefined) return cached ?? [];

  const fetched = await fetchBatch(opts, mode, value, brand);
  if (fetched === null) return []; // refused or failed: cache nothing
  await opts.cachePut(
    key,
    mode,
    value,
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
async function admitRows(
  rows: CatalogProduct[],
  limit: number,
): Promise<{ admitted: CatalogProduct[]; declined: Declined[] }> {
  const admitted: CatalogProduct[] = [];
  const declined: Declined[] = [];

  for (const row of rows) {
    if (admitted.length >= limit) break;

    let url: URL;
    try {
      url = new URL(row.linkUrl);
    } catch {
      continue; // not a URL we can judge, so not one we can offer
    }

    const reason = await admitSource(url);
    if (reason) {
      if (!declined.some((d) => d.source === row.sourceHost)) {
        declined.push({ source: row.sourceHost, reason });
      }
      continue;
    }
    admitted.push(row);
  }

  return { admitted, declined };
}

function toCandidate(p: CatalogProduct, confidence: number): GarmentCandidate {
  return {
    imageUrl: p.imageUrl,
    title: p.brand && !p.title.toLowerCase().startsWith(p.brand.toLowerCase())
      ? `${p.brand} ${p.title}`.slice(0, 200)
      : p.title,
    source: p.sourceHost,
    confidence,
  };
}

/**
 * Feeds have no model confidence, so we synthesise one from rank.
 *
 * This is deliberately a shallow decay rather than a real score: the ordering
 * already came from the provider's relevance, and inventing a confident-looking
 * number for a row we did not judge would be dishonest in exactly the way the
 * existing provider's comments warn about.
 */
function rankConfidence(index: number, total: number): number {
  if (total <= 1) return 0.8;
  return Number((0.85 - (index / total) * 0.35).toFixed(3));
}

export function datafeedrProvider(opts: DatafeedrOpts): GarmentImageProvider {
  return {
    id: 'datafeedr',

    async search(input: ProviderInput): Promise<ProviderResult> {
      const started = Date.now();
      const rows = await lookup(opts, 'keyword', input.description);
      const { admitted, declined } = await admitRows(rows, input.maxCandidates);

      const capped = admitted;
      return {
        candidates: capped.map((p, i) => toCandidate(p, rankConfidence(i, capped.length))),
        declined,
        // A feed lookup spends no tokens. Null rather than 0 so cost reporting
        // can tell "this provider has no token cost" from "we failed to read it".
        promptTokens: null,
        completionTokens: null,
        costUsd: null,
        latencyMs: Date.now() - started,
      };
    },

    /**
     * `match` is the photograph path, and a feed cannot do the hard half of it.
     *
     * Identifying a brand from a photo is a vision problem; a product feed only
     * answers "given these words, what is for sale". So this returns no brands
     * and leaves that to the model path, then uses the descriptor to find
     * listings. Returning an empty brand list is the honest answer — padding it
     * with guesses derived from feed titles would be inventing evidence.
     */
    async match(input: MatchInput): Promise<MatchResult> {
      const started = Date.now();
      // The brand goes to the `brand` FIELD rather than being concatenated into
      // the descriptor — see `buildQuery`. Concatenating it is what produced a
      // Zadig & Voltaire dress in answer to "Reformation".
      const rows = await lookup(opts, 'keyword', input.descriptor, input.brand);
      const { admitted, declined } = await admitRows(rows, input.maxCandidates);

      const capped = admitted;
      const candidates: ListingCandidate[] = capped.map((p, i) => ({
        ...toCandidate(p, rankConfidence(i, capped.length)),
        pageUrl: p.linkUrl,
      }));

      return {
        brands: [],
        candidates,
        declined,
        promptTokens: null,
        completionTokens: null,
        costUsd: null,
        latencyMs: Date.now() - started,
      };
    },
  };
}

/**
 * Try licensed sources first, fall back to the model path, and never the other
 * way round.
 *
 * The ordering is a legal statement, not a performance one. The web provider is
 * last because it is the only one whose images arrive without a licence, so it
 * should answer only what the licensed feeds could not. When `allowUnlicensed`
 * is false it is not consulted at all — which is the configuration to ship once
 * feed coverage is good enough, and the reason this wrapper exists rather than
 * a hardcoded chain.
 */
export function firstLicensed(
  providers: GarmentImageProvider[],
  fallback: GarmentImageProvider | null,
  allowUnlicensed: boolean,
): GarmentImageProvider {
  const chain = [...providers, ...(allowUnlicensed && fallback ? [fallback] : [])];

  return {
    id: chain.map((p) => p.id).join('>'),

    async search(input) {
      let last: ProviderResult | null = null;
      for (const p of chain) {
        const result = await p.search(input);
        last = result;
        if (result.candidates.length) return result;
      }
      return (
        last ?? {
          candidates: [],
          declined: [],
          promptTokens: null,
          completionTokens: null,
          costUsd: null,
          latencyMs: 0,
        }
      );
    },

    async match(input) {
      let last: MatchResult | null = null;
      for (const p of chain) {
        const result = await p.match(input);
        last = result;
        // Brands without candidates is still a useful answer — the model path
        // can name the brand even when no feed carries the piece — so this
        // stops on either, not on candidates alone.
        if (result.candidates.length || result.brands.length) return result;
      }
      return (
        last ?? {
          brands: [],
          candidates: [],
          declined: [],
          promptTokens: null,
          completionTokens: null,
          costUsd: null,
          latencyMs: 0,
        }
      );
    },
  };
}
