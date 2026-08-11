/**
 * The shops Cinch is willing to name.
 *
 * WHY AN ALLOWLIST, AND WHY ONLY ON THE SUGGESTION PATH
 *
 * Datafeedr aggregates 44,027 merchants with no shared taxonomy and no quality
 * floor. Sorted by size, the catalogue is Walmart's twenty-odd department feeds,
 * Wayfair, Etsy, AliExpress and SHEIN — and a gap suggestion drawn from that
 * pool returns, measured on 2026-08-11: a wooden coat STAND for "coat", a
 * necklace display bust for "necklace", zipper pulls for "handbag", and a
 * cymbal stand for "hat". The merchant-authored `category` field does not save
 * it either: Wayfair files furniture under "Shoes" and a dressmaker's mannequin
 * under "Dresses".
 *
 * No query fixes that, because the problem is not the query. So the shops are
 * chosen instead. Cinch shows at most three merchants for a gap somebody
 * actually has; which three is a product decision, and it belongs in the
 * repository where it can be read and argued with rather than emerging from
 * whatever a feed aggregator happened to rank first.
 *
 * THIS APPLIES TO `gap-shop-match` ONLY.
 *
 * `garment-search` — where somebody types the name of a garment they already
 * own, to get a picture of it — deliberately keeps the full catalogue. There the
 * user has named the thing and a narrow merchant set would just fail to find it;
 * measured coverage on that path is 93% and an allowlist would cut it. The two
 * paths ask different questions: "find me this specific garment" tolerates an
 * obscure merchant, "suggest what I am missing" does not.
 *
 * MEMBERSHIP IS NOT MONETISATION
 *
 * Being on this list earns a merchant nothing and costs them nothing. It is not
 * a joined programme, not a commission agreement, and not sorted by what
 * anything pays — `commerce_joined_programmes` is the only place money is
 * recorded, and it is consulted after ranking, purely to label a link
 * truthfully. Several shops here will never be joined at all.
 *
 * HOW IT WAS BUILT
 *
 * A hand-written list of real apparel retailers, intersected with what is
 * actually reachable: present on one of the seven US networks in
 * `US_SOURCE_IDS`, and carrying more than zero products. 30 names were dropped
 * by that intersection — Uniqlo, L.L.Bean, Vans, Reiss and others are in
 * Datafeedr but only through networks we do not query or as coupon-only feeds
 * with no catalogue. `docs/commerce/merchant-allowlist.md` records the method
 * so the list can be regenerated rather than guessed at.
 */

/**
 * WHO OWNS THIS LIST, AND WHEN IT GOES STALE
 *
 * Catalogue membership drifts and does so silently. A merchant leaves a
 * network, a programme is retired, a feed empties — and none of it errors. The
 * suggestion row simply gets thinner, which is indistinguishable from a rare
 * garment.
 *
 * So the list carries an expiry. `commerce-health` reports `review_overdue`
 * against `REVIEW_BY` and alerts on it, which means the review is enforced by
 * the same machinery as the quota rather than by anyone remembering. Bumping
 * the date without re-running the check in `docs/commerce/merchant-allowlist.md`
 * is possible and is the one thing that would make this ceremonial.
 *
 * Quarterly, because that is roughly the cadence at which affiliate networks
 * reshuffle their rosters, and because a shorter cycle spends metered requests
 * on a question that rarely changes its answer.
 */
export const ALLOWLIST_OWNER = 'founder';

/** When this list was last checked against the live catalogue. */
export const ALLOWLIST_REVIEWED_ON = '2026-08-11';

/** After this, `commerce-health` starts saying so. */
export const ALLOWLIST_REVIEW_BY = '2026-11-11';

export type AllowedMerchant = {
  /** Datafeedr `merchant_id`. Stable per merchant per network. */
  id: number;
  /** The merchant's own name, for reading this file — never used for matching. */
  name: string;
  /** Which network carries it, for the same reason. */
  source: string;
};

export const ALLOWED_MERCHANTS: readonly AllowedMerchant[] = [
  { id: 159636, name: "Aerie", source: "Rakuten US" },
  { id: 142509, name: "Alo Yoga", source: "Ascend US" },
  { id: 142814, name: "Ann Taylor", source: "Impact US" },
  { id: 65820, name: "Anthropologie", source: "Rakuten US" },
  { id: 161211, name: "Aritzia", source: "Impact US" },
  { id: 159396, name: "ASICS", source: "Rakuten US" },
  { id: 53705, name: "Athleta", source: "Impact US" },
  { id: 42139, name: "Banana Republic", source: "Impact US" },
  { id: 82440, name: "Bealls Florida", source: "Ascend US" },
  { id: 73617, name: "Belk", source: "CJ US" },
  { id: 161190, name: "Beyond Yoga", source: "Awin US" },
  { id: 63122, name: "Bloomingdale's", source: "Rakuten US" },
  { id: 128685, name: "Boden", source: "Impact US" },
  { id: 156187, name: "Bonobos", source: "Impact US" },
  { id: 142522, name: "Brooks Brothers", source: "Ascend US" },
  { id: 116633, name: "Carhartt", source: "Impact US" },
  { id: 73619, name: "Charles Tyrwhitt", source: "CJ US" },
  { id: 141971, name: "Chico's", source: "Impact US" },
  { id: 186075, name: "Coach", source: "Impact US" },
  { id: 142090, name: "Cole Haan", source: "Rakuten US" },
  { id: 94835, name: "Columbia", source: "CJ US" },
  { id: 160344, name: "Cuyana", source: "Impact US" },
  { id: 142547, name: "Dillard's", source: "Ascend US" },
  { id: 73622, name: "Dr. Martens", source: "CJ US" },
  { id: 81276, name: "Eddie Bauer", source: "Impact US" },
  { id: 142548, name: "Equipment", source: "Ascend US" },
  { id: 142544, name: "Everlane", source: "Ascend US" },
  { id: 161562, name: "Faherty", source: "Rakuten US" },
  { id: 1973, name: "Fossil", source: "CJ US" },
  { id: 156122, name: "Free People", source: "Rakuten US" },
  { id: 42944, name: "Gap", source: "Impact US" },
  { id: 138095, name: "Icebreaker", source: "Impact US" },
  { id: 122375, name: "Indochino", source: "Rakuten US" },
  { id: 73625, name: "J.Crew", source: "CJ US" },
  { id: 142167, name: "J.Crew Factory", source: "CJ US" },
  { id: 23371, name: "JCPenney", source: "CJ US" },
  { id: 48346, name: "Johnston & Murphy", source: "Rakuten US" },
  { id: 161697, name: "Johnstons of Elgin", source: "CJ US" },
  { id: 79298, name: "Kohl's", source: "Impact US" },
  { id: 140333, name: "Kotn", source: "Awin US" },
  { id: 159407, name: "L'AGENCE", source: "Rakuten US" },
  { id: 73628, name: "Lands' End", source: "CJ US" },
  { id: 130146, name: "Levi's", source: "Rakuten US" },
  { id: 142839, name: "LOFT", source: "Impact US" },
  { id: 118291, name: "lululemon", source: "Awin US" },
  { id: 117844, name: "Macy's", source: "CJ US" },
  { id: 142184, name: "Madewell", source: "CJ US" },
  { id: 155196, name: "Merrell", source: "Partnerize US" },
  { id: 139419, name: "Michael Kors", source: "CJ US" },
  { id: 22265, name: "Mytheresa", source: "CJ US" },
  { id: 89810, name: "Neiman Marcus", source: "Rakuten US" },
  { id: 161546, name: "NET-A-PORTER", source: "Rakuten US" },
  { id: 110373, name: "New Balance", source: "Impact US" },
  { id: 130141, name: "Nordstrom", source: "Impact US" },
  { id: 130142, name: "Nordstrom Rack", source: "Impact US" },
  { id: 42945, name: "Old Navy", source: "Impact US" },
  { id: 59640, name: "Outerknown", source: "AvantLink US" },
  { id: 123485, name: "Patagonia", source: "Impact US" },
  { id: 161247, name: "Peter Millar", source: "Impact US" },
  { id: 142848, name: "Quince", source: "Impact US" },
  { id: 186177, name: "rag & bone", source: "Impact US" },
  { id: 163613, name: "Ralph Lauren", source: "Impact US" },
  { id: 116692, name: "Reformation", source: "Rakuten US" },
  { id: 39259, name: "REVOLVE", source: "CJ US" },
  { id: 142105, name: "Saks Fifth Avenue", source: "Rakuten US" },
  { id: 75620, name: "Shopbop", source: "Rakuten US" },
  { id: 139761, name: "Smartwool", source: "Impact US" },
  { id: 58633, name: "SSENSE", source: "Partnerize US" },
  { id: 142971, name: "Suitsupply", source: "Awin US" },
  { id: 161200, name: "S\u00e9zane", source: "Awin US" },
  { id: 142594, name: "Talbots", source: "CJ US" },
  { id: 123917, name: "The North Face", source: "Impact US" },
  { id: 160682, name: "Theory", source: "Rakuten US" },
  { id: 54886, name: "Todd Snyder", source: "CJ US" },
  { id: 73780, name: "Tommy Hilfiger", source: "Rakuten US" },
  { id: 142086, name: "Tory Burch", source: "Rakuten US" },
  { id: 101920, name: "Universal Standard", source: "Impact US" },
  { id: 142083, name: "Urban Outfitters", source: "Rakuten US" },
  { id: 142969, name: "Vuori", source: "Awin US" },
  { id: 142011, name: "White House Black Market", source: "Impact US" },
  { id: 185306, name: "Zappos.com", source: "Rakuten US" },
  { id: 186216, name: "Zara", source: "Awin US" },
];

/** The `merchant_id IN …` term, built once. */
export const ALLOWED_MERCHANT_IDS: readonly number[] = ALLOWED_MERCHANTS.map((m) => m.id);
