import type { CatalogueFamilies, CatalogueFamily } from '@/features/catalogue/types';
import { isUsableTitle, representativeColour } from '@/features/catalogue/types';
import type { Garment, Slot } from '@/lib/styling';

/**
 * The Explore shop feed — partner clothing chosen from what the closet
 * already holds. Pure, so the node suite proves the two rules that make the
 * feature honest:
 *
 *   1. The catalogue is asked about only KINDS THE PERSON OWNS, most-owned
 *      first. No closet content leaves the device to do it — a browse slot
 *      is one of nine fixed enum values (`browse-slots.ts`), so "similar to
 *      your closet" is computed here and the wire carries an enum.
 *   2. What renders is bounded and interleaved: a few families per owned
 *      kind, image-bearing exact matches only, round-robin across kinds so
 *      the grid reads as a mix rather than eighteen shirts.
 *
 * Founder order 2026-08-30 ("build it anyway"), design in
 * docs/design/explore-feed-plan.md. One correction to that document, made
 * here where the code settles it: the gate is `show_where_to_buy` (C-03,
 * the person's own "Show where to buy" switch in Privacy & data) — the
 * toggle that already governs every shop surface — not C-05 `shoppable`,
 * which is about friends finding YOUR pieces and was the wrong switch for
 * this by meaning.
 */

// ---------------------------------------------------------------------------
// Which kinds to ask about
// ---------------------------------------------------------------------------

/** The nine browsable slots, mirrored from `_shared/browse-slots.ts`. */
export type ShopFeedSlot =
  | 'top'
  | 'bottom'
  | 'outerwear'
  | 'footwear'
  | 'dress'
  | 'accessory'
  | 'bag'
  | 'headwear';

/**
 * Styling slots collapse onto browse slots: both top layers are "top", and
 * jewelry is unreachable because no styling slot maps to it — the feed can
 * only ever ask about kinds the closet model can hold.
 */
const SLOT_MAP: Record<Slot, ShopFeedSlot> = {
  base_top: 'top',
  mid_layer: 'top',
  bottom: 'bottom',
  dress: 'dress',
  outerwear: 'outerwear',
  footwear: 'footwear',
  bag: 'bag',
  headwear: 'headwear',
  accessory: 'accessory',
};

/** How many kinds one visit asks the catalogue about. */
export const FEED_SLOT_CAP = 4;

/**
 * The kinds this closet earns a feed for, most-owned first.
 *
 * Deterministic: count per mapped slot, order by count descending with the
 * slot name as tiebreak, cap at FEED_SLOT_CAP. An empty closet returns
 * nothing — a feed "similar to what you own" with nothing owned would be a
 * plain shop, which is a different product this deliberately is not.
 */
export function feedSlots(wardrobe: readonly Pick<Garment, 'slot'>[]): ShopFeedSlot[] {
  const counts = new Map<ShopFeedSlot, number>();
  for (const g of wardrobe) {
    const mapped = SLOT_MAP[g.slot];
    if (!mapped) continue;
    counts.set(mapped, (counts.get(mapped) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, FEED_SLOT_CAP)
    .map(([slot]) => slot);
}

// ---------------------------------------------------------------------------
// What renders
// ---------------------------------------------------------------------------

export type ShopFeedCard = {
  /** `slot:familyId` — unique across the merged grid. */
  key: string;
  slot: ShopFeedSlot;
  title: string;
  brand: string | null;
  merchant: string | null;
  imageUrl: string;
  /** The merchant's own product page. Null never reaches a card. */
  pageUrl: string;
};

/** Families kept per slot, before interleaving. */
export const FAMILIES_PER_SLOT = 6;

// ---------------------------------------------------------------------------
// Is this thing even clothing? — the category confidence gate
// ---------------------------------------------------------------------------

/**
 * P0 #16, 2026-09-02: the shelf was showing Walmart wall shelves, phone
 * chargers and seat covers.
 *
 * WHY THAT HAPPENS, precisely. A browse asks the catalogue for one word per
 * kind ("hat", "shoes", "shirt"). The server groups the answer into families
 * and only DROPS one when the query's class and the family's class both exist
 * and disagree (`rankFamilies`). A family's class comes from the head noun of
 * a merchant-written title — so "Rustic Wall Shelf Hat Rack" is classed
 * `headwear`, agrees with a hat browse, and lands on the shelf wearing a
 * picture of a plank.
 *
 * So the client requires POSITIVE EVIDENCE OF CLOTHING before it will print a
 * card, and takes a veto from either of the two merchant-written fields:
 *
 *   1. VETO. The merchant's own category names a non-fashion department, or
 *      the title names an object that is never a garment. Either kills it,
 *      whatever the class says.
 *   2. PROOF. The family's `productClass` — the server's own head-noun
 *      classification — is the very kind this browse asked for; or, when the
 *      title could not be classified at all, the merchant's category says
 *      apparel in so many words.
 *
 * A family that is fashion but the WRONG KIND ("Navy Dress Pant" under a dress
 * browse) fails the proof too. The shelf's promise is "like the kinds of
 * pieces you own"; a bottom filed under dresses breaks the promise more
 * quietly than a hat rack does, not less.
 *
 * WHERE THE WORDS COME FROM. The kinds are `ShopFeedSlot`, which mirrors the
 * server's `GarmentClass` enum (`_shared/garment-lexicon.ts`) — the same enum
 * `productClass` is drawn from. The category words below are apparel
 * department names as merchant feeds actually write them, plus the garment
 * nouns already in `CLASS_NOUNS`; the veto words are the departments and
 * objects the live shelf regression was drawn from. All three lists are
 * mirrored in `supabase/functions/garment-search/fashion-gate.ts` so the
 * server can refuse the same rows at the source, and
 * `tests/explore-shop-feed.test.ts` fails the moment the two copies disagree.
 *
 * The merchant `category` is free text on 97% of rows and NOT a taxonomy
 * (`_shared/catalog.ts`), which is why it is read for evidence rather than
 * trusted as a label.
 */

/**
 * Category words that both prove apparel AND name a kind well enough to print.
 * The value is what a card may show when the merchant's title is unusable —
 * the family's own fashion category label, never an invented product name.
 */
export const FASHION_CATEGORY_LABELS: Record<string, string> = {
  dress: 'Dress',
  dresses: 'Dress',
  gown: 'Dress',
  gowns: 'Dress',
  jumpsuit: 'Jumpsuit',
  jumpsuits: 'Jumpsuit',
  shirt: 'Shirt',
  shirts: 'Shirt',
  't shirt': 'T-shirt',
  tshirt: 'T-shirt',
  tshirts: 'T-shirt',
  blouse: 'Blouse',
  blouses: 'Blouse',
  top: 'Top',
  tops: 'Top',
  sweater: 'Sweater',
  sweaters: 'Sweater',
  sweatshirt: 'Sweatshirt',
  sweatshirts: 'Sweatshirt',
  hoodie: 'Hoodie',
  hoodies: 'Hoodie',
  cardigan: 'Cardigan',
  cardigans: 'Cardigan',
  jacket: 'Jacket',
  jackets: 'Jacket',
  coat: 'Coat',
  coats: 'Coat',
  blazer: 'Blazer',
  blazers: 'Blazer',
  trouser: 'Trousers',
  trousers: 'Trousers',
  pants: 'Trousers',
  jean: 'Jeans',
  jeans: 'Jeans',
  skirt: 'Skirt',
  skirts: 'Skirt',
  shorts: 'Shorts',
  legging: 'Leggings',
  leggings: 'Leggings',
  shoe: 'Shoes',
  shoes: 'Shoes',
  boot: 'Boots',
  boots: 'Boots',
  sneaker: 'Sneakers',
  sneakers: 'Sneakers',
  sandal: 'Sandals',
  sandals: 'Sandals',
  loafer: 'Loafers',
  loafers: 'Loafers',
  heels: 'Heels',
  hat: 'Hat',
  hats: 'Hat',
  cap: 'Cap',
  caps: 'Cap',
  beanie: 'Beanie',
  beanies: 'Beanie',
  scarf: 'Scarf',
  scarves: 'Scarf',
  glove: 'Gloves',
  gloves: 'Gloves',
  belt: 'Belt',
  belts: 'Belt',
  bag: 'Bag',
  bags: 'Bag',
  handbag: 'Handbag',
  handbags: 'Handbag',
  tote: 'Tote',
  totes: 'Tote',
  backpack: 'Backpack',
  backpacks: 'Backpack',
  jersey: 'Jersey',
  jerseys: 'Jersey',
  polo: 'Polo',
  polos: 'Polo',
  robe: 'Robe',
  robes: 'Robe',
  sock: 'Socks',
  socks: 'Socks',
  tights: 'Tights',
  kimono: 'Kimono',
  kimonos: 'Kimono',
  vest: 'Vest',
  vests: 'Vest',
  waistcoat: 'Waistcoat',
  waistcoats: 'Waistcoat',
  parka: 'Parka',
  parkas: 'Parka',
  anorak: 'Anorak',
  anoraks: 'Anorak',
  dungarees: 'Dungarees',
  overalls: 'Overalls',
  romper: 'Romper',
  rompers: 'Romper',
  kurta: 'Kurta',
  kurtas: 'Kurta',
  tunic: 'Tunic',
  tunics: 'Tunic',
  poncho: 'Poncho',
  ponchos: 'Poncho',
  cape: 'Cape',
  capes: 'Cape',
  mule: 'Mules',
  mules: 'Mules',
  espadrille: 'Espadrilles',
  espadrilles: 'Espadrilles',
  clog: 'Clogs',
  clogs: 'Clogs',
  slide: 'Slides',
  slides: 'Slides',
  wallet: 'Wallet',
  wallets: 'Wallet',
  purse: 'Purse',
  purses: 'Purse',
  bralette: 'Bralette',
  bralettes: 'Bralette',
  bandeau: 'Bandeau',
  balaclava: 'Balaclava',
  cufflink: 'Cufflinks',
  cufflinks: 'Cufflinks',
  sarong: 'Sarong',
  sarongs: 'Sarong',
};

/**
 * Category words that prove apparel but name no printable kind — "Clothing"
 * is not a product name, so a family evidenced only by these and carrying an
 * unusable title is suppressed rather than titled "Clothing".
 */
export const GENERIC_FASHION_CATEGORY_WORDS: readonly string[] = [
  'apparel',
  'apparels',
  'clothing',
  'clothes',
  'fashion',
  'womenswear',
  'menswear',
  'outerwear',
  'activewear',
  'sportswear',
  'swimwear',
  'knitwear',
  'loungewear',
  'sleepwear',
  'footwear',
  'accessories',
  'garment',
  'garments',
  'denim',
  'lingerie',
  'hosiery',
];

/**
 * Departments a garment is never in. A hit here refuses the family outright,
 * because a merchant who files a row under Home or Automotive has told us what
 * it is more reliably than any noun in the title has.
 */
export const NON_FASHION_CATEGORY_WORDS: readonly string[] = [
  'home',
  'house',
  'household',
  'decor',
  'decoration',
  'decorations',
  'furniture',
  'kitchen',
  'dining',
  'table',
  'bedding',
  'bedroom',
  'bath',
  'bathroom',
  'garden',
  'patio',
  'lawn',
  'tool',
  'tools',
  'hardware',
  'plumbing',
  'paint',
  'automotive',
  'auto',
  'car',
  'motorcycle',
  'tire',
  'tires',
  'electronics',
  'electronic',
  'computer',
  'computers',
  'laptop',
  'phone',
  'phones',
  'camera',
  'cameras',
  'television',
  'tv',
  'appliance',
  'appliances',
  'grocery',
  'groceries',
  'food',
  'beverage',
  'beverages',
  'pet',
  'pets',
  'toy',
  'toys',
  'game',
  'games',
  'gaming',
  'office',
  'stationery',
  'book',
  'books',
  'music',
  'movie',
  'movies',
  'health',
  'beauty',
  'cosmetics',
  'makeup',
  'fragrance',
  'supplement',
  'supplements',
  'medical',
  'industrial',
  'fishing',
  'hunting',
  'camping',
  'firearm',
  'ammo',
  'sporting',
  'equipment',
  'lighting',
  'art',
  'wall',
  'storage',
  'organization',
  'cleaning',
  'party',
  'craft',
  'crafts',
  'pool',
];

/**
 * Objects that are never worn. Read from the TITLE, because the live
 * regression ("Wall Display Frame…", "Hat Rack") is a home-goods row whose
 * only garment word is a modifier of the object it hangs.
 *
 * Deliberately short. Every word here is one a real garment title could
 * eventually contain, and the cost of a wrong entry is a garment nobody sees —
 * so "stand" (stand collar), "frame" (a denim label) and "blanket" (blanket
 * scarf) were all considered and left out.
 */
export const NON_APPAREL_TITLE_WORDS: readonly string[] = [
  'rack',
  'racks',
  'cabinet',
  'shelf',
  'shelves',
  'hanger',
  'hangers',
  'holder',
  'organizer',
  'lamp',
  'rug',
  'mattress',
  'curtain',
  'poster',
  'decal',
  'mug',
  'tumbler',
  'charger',
  'adapter',
  'battery',
  'tire',
  'tyre',
  'bumper',
  'ornament',
  'figurine',
  'puzzle',
  'plaque',
  'wallpaper',
  'doormat',
  'pillow',
  'towel',
  'duvet',
  'comforter',
  'keychain',
  'magnet',
];

/** Fold accents so "Décor" and "Decor" are one word (verification, UX-9). */
const foldText = (text: string): string =>
  text.normalize('NFKD').replace(/[̀-ͯ]/g, '');

/**
 * Merchant text, reduced to space-separated words so a match can be bounded.
 * Anything that is not a letter or a digit becomes a gap — what stops "tan"
 * firing inside "titanium", the same word-boundary rule the colour scorer
 * lives by.
 */
const wordsOf = (text: string): string =>
  ` ${foldText(text).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;

/**
 * Word-bounded, and PLURAL-AWARE: merchant titles are overwhelmingly plural
 * or pack-quantified ("Ceramic Mugs Gift Set"), and a singular-only veto
 * admitted seventeen of eighteen such titles (verification, UX-9).
 */
const containsWord = (haystack: string, phrase: string): boolean =>
  haystack.includes(` ${phrase} `) ||
  haystack.includes(` ${phrase}s `) ||
  haystack.includes(` ${phrase}es `);

/**
 * The last word of a title that is not a pack or quantity word — the noun the
 * thing IS. "Wooden Coat Hanger Set" is a hanger; "Beach Towels 2-Pack" is towels.
 */
const TAIL_QUALIFIERS: ReadonlySet<string> = new Set([
  'set', 'sets', 'pack', 'packs', 'bundle', 'kit', 'piece', 'pieces', 'pc', 'pcs',
  'pair', 'pairs', 'count', 'lot', 'of', 'x',
]);
const headWord = (title: string): string => {
  const words = wordsOf(title).trim().split(' ').filter(Boolean);
  for (let i = words.length - 1; i >= 0; i -= 1) {
    const w = words[i]!;
    if (TAIL_QUALIFIERS.has(w) || /^\d+$/.test(w)) continue;
    return w;
  }
  return '';
};

export type CategoryVerdict = 'fashion' | 'non-fashion' | 'unknown';

/** What the merchant's own category string says about whether this is clothing. */
export function categoryVerdict(category: string | null): CategoryVerdict {
  if (!category) return 'unknown';
  const haystack = wordsOf(category);
  // A GARMENT word wins over a department word — "Kitchen & Chef Apparel",
  // "Sporting Goods > Golf > Apparel", "Home > Bath > Robes", a brand named
  // "House of …" are all clothing, and the veto-first reading dropped half
  // of a real corpus (verification, UX-8). The one weak word is
  // "accessories": "Electronics > Phone Accessories" is electronics, so it
  // counts only when no department word is present.
  for (const word of Object.keys(FASHION_CATEGORY_LABELS)) {
    if (containsWord(haystack, word)) return 'fashion';
  }
  for (const word of GENERIC_FASHION_CATEGORY_WORDS) {
    if (word === 'accessories') continue;
    if (containsWord(haystack, word)) return 'fashion';
  }
  for (const word of NON_FASHION_CATEGORY_WORDS) {
    if (containsWord(haystack, word)) return 'non-fashion';
  }
  if (containsWord(haystack, 'accessories')) return 'fashion';
  return 'unknown';
}

/** The printable kind the merchant's category names, when it names one. */
export function fashionCategoryLabel(category: string | null): string | null {
  if (categoryVerdict(category) !== 'fashion') return null;
  const haystack = wordsOf(category!);
  // Longest phrase first, so "t shirt" beats "shirt".
  const words = Object.keys(FASHION_CATEGORY_LABELS).sort(
    (a, b) => b.length - a.length || a.localeCompare(b),
  );
  for (const word of words) {
    if (containsWord(haystack, word)) return FASHION_CATEGORY_LABELS[word]!;
  }
  return null;
}

/**
 * Is this family confidently a garment of the kind that was asked for?
 *
 * See the essay above. Veto first, then proof; `unknown` on its own is never
 * enough, which is the whole point — the shelf would rather be short than be
 * a hardware aisle.
 */
export function isConfidentFashion(
  family: Pick<CatalogueFamily, 'title' | 'category' | 'productClass'>,
  slot: ShopFeedSlot,
): boolean {
  const verdict = categoryVerdict(family.category);
  if (verdict === 'non-fashion') return false;

  // The title's veto is the noun the thing IS — its head word — or, when no
  // garment noun appears anywhere in the title, any veto word at all. A
  // modifier is never a veto: "Bottle Green Coat" is a coat, "Magnet Buckle
  // Belt" is a belt, "Clothing Rack" is a rack (verification, UX-8b).
  const title = wordsOf(family.title);
  const head = headWord(family.title);
  const titleNamesGarment = Object.keys(FASHION_CATEGORY_LABELS).some((word) =>
    containsWord(title, word),
  );
  for (const word of NON_APPAREL_TITLE_WORDS) {
    const hit = head === word || head === `${word}s` || head === `${word}es`;
    if (hit || (!titleNamesGarment && containsWord(title, word))) return false;
  }

  if (family.productClass) return family.productClass === slot;
  // No class at all: the merchant's category has to say it in words.
  return verdict === 'fashion';
}

/**
 * P0 #17 — what a card prints, or nothing at all.
 *
 * "Catalog name unavailable" is a true sentence and a terrible card: it reads
 * as Cinch's own description of a garment. §10.3 forbids inventing a name, and
 * this does not — it prints the merchant's own name when that name is usable,
 * else the family's own fashion category label ("Dress", "Boots"), else the
 * card does not exist. The placeholder never reaches a shelf.
 */
export function cardTitle(
  family: Pick<CatalogueFamily, 'title' | 'category'>,
): string | null {
  if (isUsableTitle(family.title)) return family.title.trim();
  return fashionCategoryLabel(family.category);
}

function cardOf(slot: ShopFeedSlot, family: CatalogueFamily): ShopFeedCard | null {
  // Image-bearing and linkable, or absent: a shop card with no picture sells
  // nothing, and one with no destination is a dead end wearing a price tag.
  const colourway = representativeColour(family);
  if (!colourway?.imageUrl || !colourway.pageUrl) return null;
  const title = cardTitle(family);
  if (!title) return null;
  return {
    key: `${slot}:${family.familyId}`,
    slot,
    title,
    brand: family.brand,
    merchant: family.merchants[0] ?? null,
    imageUrl: colourway.imageUrl,
    pageUrl: colourway.pageUrl,
  };
}

// ---------------------------------------------------------------------------
// Colour affinity
// ---------------------------------------------------------------------------

/**
 * The closet's own palette, as the words the tagger wrote: every garment's
 * first colour name, counted, most-worn-of first. A tiny alias table folds
 * the one spelling split that actually occurs in merchant copy; anything
 * cleverer than that is a colour model this ranking does not need — the
 * catalogue is being SORTED, not filtered, so a missed synonym costs one
 * card a rank, never its place.
 */
const COLOUR_ALIASES: Record<string, string> = { gray: 'grey' };

const canonColour = (word: string): string => COLOUR_ALIASES[word] ?? word;

export function closetColourNames(
  wardrobe: readonly Pick<Garment, 'colors'>[],
): string[] {
  const counts = new Map<string, number>();
  for (const g of wardrobe) {
    const name = g.colors[0]?.name?.toLowerCase().trim();
    if (!name) continue;
    const canon = canonColour(name);
    counts.set(canon, (counts.get(canon) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name]) => name);
}

/**
 * How strongly one family speaks the closet's colours. The merchant's own
 * colourway label is the strong signal (it names the actual variant on the
 * card); the title is the weak one. Deterministic, word-boundary matched so
 * "tan" never fires inside "titanium".
 */
function colourScore(family: CatalogueFamily, palette: readonly string[]): number {
  if (!palette.length) return 0;
  // The same canon the palette went through, applied to the merchant's text,
  // so "gray" meets "grey" on equal terms.
  const norm = (s: string) => s.toLowerCase().replace(/\bgray\b/g, 'grey');
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const label = norm(family.colours[0]?.label ?? '');
  const title = norm(family.title);
  let score = 0;
  for (const colour of palette) {
    const re = new RegExp(`\\b${escape(colour)}\\b`);
    if (re.test(label)) score += 2;
    else if (re.test(title)) score += 1;
  }
  return score;
}

/**
 * Flatten per-slot responses into one grid, round-robin across slots so the
 * mix survives however many families each kind returned. Exact families
 * only — a near-miss is the catalogue disagreeing about what the thing IS,
 * which is a fine nuance for a deliberate search and noise in a feed.
 *
 * Within each slot, families that speak the closet's own colours rank
 * first — "like your closet" down to the palette, not just the kind. The
 * sort is stable (score, then the server's own order), so an empty palette
 * or an all-zero slot degrades to exactly the old behaviour.
 */
export function feedCards(
  responses: readonly { slot: ShopFeedSlot; families: CatalogueFamilies }[],
  palette: readonly string[] = [],
): ShopFeedCard[] {
  const perSlot = responses.map(({ slot, families }) =>
    families.exact
      // The category gate, before anything is ranked or drawn: a row that
      // cannot be proven to be clothing of this kind is not a low-ranked card,
      // it is not a card (P0 #16).
      .filter((f) => isConfidentFashion(f, slot))
      .map((f, i) => ({ f, i, score: colourScore(f, palette) }))
      .sort((a, b) => b.score - a.score || a.i - b.i)
      .map(({ f }) => cardOf(slot, f))
      .filter((c): c is ShopFeedCard => c !== null)
      .slice(0, FAMILIES_PER_SLOT),
  );

  const merged: ShopFeedCard[] = [];
  for (let i = 0; i < FAMILIES_PER_SLOT; i++) {
    for (const cards of perSlot) {
      if (cards[i]) merged.push(cards[i]!);
    }
  }
  return merged;
}

// ---------------------------------------------------------------------------
// The shelf, and when there isn't one
// ---------------------------------------------------------------------------

/**
 * Below this many confident cards, THERE IS NO SHELF.
 *
 * Four, because the grid is two columns: four fills two clean rows, and three
 * or fewer reads as leftovers rather than a shelf. The number is also a
 * quality signal, not only a layout one — a browse asks up to four kinds and
 * keeps six families each, so a run that survives the category gate with
 * fewer than four cards is a catalogue answer that was mostly not clothing.
 * Showing the two survivors of that would be showing the tail of a bad answer.
 *
 * Absent, never greyed and never apologised for: Explore's page is the circle,
 * and a missing shelf is a thing nobody has to be told about.
 */
export const MIN_CONFIDENT_CARDS = 4;

/** The shelf, or nothing. See `MIN_CONFIDENT_CARDS`. */
export function confidentShelf(cards: readonly ShopFeedCard[]): ShopFeedCard[] {
  return cards.length >= MIN_CONFIDENT_CARDS ? [...cards] : [];
}

/**
 * P1 #18 — commerce is subordinate, so Explore gets ONE compact grid.
 *
 * The page had grown two full merchant shelves under the circle, which is how
 * a private social page becomes a catalogue with friends at the top. What
 * Explore shows now is at most six cards; the rest lives behind one "See
 * more" door (`/shop`), where a person who wants a shop has said so.
 */
export const EXPLORE_SHELF_CAP = 6;

/** A shelf card, plus whether opening it pays Cinch. Disclosure is per card. */
export type ShelfCard = ShopFeedCard & { paid: boolean };

/** The label a card may print when a partner row's own title is unusable. */
const SLOT_LABEL: Record<ShopFeedSlot, string> = {
  top: 'Top',
  bottom: 'Trousers',
  outerwear: 'Coat',
  footwear: 'Shoes',
  dress: 'Dress',
  accessory: 'Accessory',
  bag: 'Bag',
  headwear: 'Hat',
};

/** The partner shelf's rows, as this file needs them. Structural on purpose. */
type PartnerLike = {
  key: string;
  title: string;
  brand: string | null;
  merchant: string;
  imageUrl: string;
  pageUrl: string;
  slot: string | null;
};

/**
 * The partner rows as cards.
 *
 * The server already admits only fashion merchants and only garment slots
 * (`PARTNER_FEED_MERCHANT_IDS`, `PARTNER_FEED_SLOTS`), so the kind is settled
 * before the wire. What is applied here is the title rule and nothing else: a
 * keyword dump is replaced by the row's own slot label, and a row that has
 * neither a usable title nor a known slot is suppressed rather than titled.
 */
export function partnerShelfCards(items: readonly PartnerLike[]): ShelfCard[] {
  const cards: ShelfCard[] = [];
  for (const item of items) {
    if (!item.imageUrl || !item.pageUrl) continue;
    const slot = (item.slot ?? '') as ShopFeedSlot;
    const label = SLOT_LABEL[slot] ?? null;
    const title = isUsableTitle(item.title) ? item.title.trim() : label;
    if (!title) continue;
    cards.push({
      key: `partner:${item.key}`,
      // The server's slot vocabulary is the same eight words; an unmapped one
      // keeps the card off the kind-labelled path rather than inventing a kind.
      slot: label ? slot : 'accessory',
      title,
      brand: item.brand,
      merchant: item.merchant,
      imageUrl: item.imageUrl,
      pageUrl: item.pageUrl,
      paid: true,
    });
  }
  return cards;
}

/**
 * Explore's one commerce zone: the closet-similarity cards first — they answer
 * the person — then partner stock to fill, capped.
 *
 * `total` is what the door leads to, so "See more" only appears when there is
 * genuinely more; it is not a decorative affordance.
 */
export function exploreShelf(
  closet: readonly ShopFeedCard[],
  partner: readonly ShelfCard[],
): { cards: ShelfCard[]; total: number } {
  const all: ShelfCard[] = [
    ...closet.map((c) => ({ ...c, paid: false })),
    ...partner,
  ];
  return { cards: all.slice(0, EXPLORE_SHELF_CAP), total: all.length };
}
