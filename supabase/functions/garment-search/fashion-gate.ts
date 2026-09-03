/**
 * The category confidence gate, server side — the same refusal the client
 * makes, made where the rows are.
 *
 * WHY IT EXISTS TWICE. The lists below are MIRRORED, word for word, from
 * `src/features/explore/shop-feed.ts`; `tests/explore-shop-feed.test.ts` reads
 * both files and fails the moment they disagree — the arrangement
 * `_shared/browse-slots.ts` already has with `gap-shop-match/policy.ts`, and
 * for the same reason: an Edge Function is its own Deno bundle and the app
 * bundle cannot import it.
 *
 * WHY BOTH SIDES RUN IT. The client gate is the guarantee (it ships in the
 * binary and needs no deploy); this one is the economy — a browse answer
 * cached for seven days for everybody should not carry hat racks in it, and
 * the category grid in intake reads the same browse.
 *
 * PURE ON PURPOSE — no `Deno.env`, no npm specifier — so the node suite can
 * read it and, where it wants to, execute it.
 */

import type { BrowsableSlot } from '../_shared/browse-slots.ts';

/** What the gate needs of a family. Structural, so `CatalogFamily` fits it. */
export type GateableFamily = {
  title: string;
  category: string | null;
  productClass: string | null;
};

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
  tee: 'T-shirt',
  tees: 'T-shirt',
  jumper: 'Jumper',
  jumpers: 'Jumper',
  bra: 'Bra',
  bras: 'Bra',
  bikini: 'Bikini',
  bikinis: 'Bikini',
  swimsuit: 'Swimsuit',
  swimsuits: 'Swimsuit',
};

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
  'collection',
  'collections',
  'workwear',
];

export const NON_FASHION_CATEGORY_WORDS: readonly string[] = [
  'home',
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
  'weapon',
  'weapons',
  'firearms',
  'tactical',
  'holster',
  'holsters',
  'concealed',
];

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
  'figurine',
  'puzzle',
  'plaque',
  'wallpaper',
  'doormat',
  'towel',
  'duvet',
  'comforter',
  'keychain',
  'tower',
  'stand',
  'tree',
  'case',
  'cover',
  'laptop',
  'phone',
  'seat',
  'bottles',
  'bumpers',
  'decals',
  // Plural only — the singular is a modifier in real titles ("Ornament Print Blouse").
  'ornaments',
  'magnets',
  'pillows',
  'rugs',
  // Weapons and weapon carry — a holster bag reached the shelf as a "Backpack" (2026-09-03).
  'gun',
  'pistol',
  'firearm',
  'holster',
  'ammo',
  'ammunition',
  'rifle',
  'knife',
  'knives',
  'taser',
  'pepper',
];

/** Fold accents so "Décor" and "Decor" are one word (verification, UX-9). */
const foldText = (text: string): string =>
  text.normalize('NFKD').replace(/[̀-ͯ]/g, '');

const wordsOf = (text: string): string =>
  ` ${foldText(text).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;

/** Word-bounded and PLURAL-AWARE — see the client mirror in shop-feed.ts. */
const containsWord = (haystack: string, phrase: string): boolean =>
  haystack.includes(` ${phrase} `) ||
  haystack.includes(` ${phrase}s `) ||
  haystack.includes(` ${phrase}es `);


export type CategoryVerdict = 'fashion' | 'non-fashion' | 'unknown';

/** What the merchant's own category string says about whether this is clothing. */
export function categoryVerdict(category: string | null): CategoryVerdict {
  if (!category) return 'unknown';
  const haystack = wordsOf(category);
  // Departments that are never clothing even when they say "apparel" — pet
  // clothes, toys, cars, electronics (verification, V2-4).
  for (const word of HARD_NON_FASHION_WORDS) {
    if (containsWord(haystack, word)) return 'non-fashion';
  }
  // Then a GARMENT word wins over a department word — "Kitchen & Chef
  // Apparel", "Sporting Goods > Golf > Apparel", "Home > Bath > Robes" are
  // clothing (verification, UX-8). "accessories" alone is weak: "Electronics
  // > Phone Accessories" is electronics.
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

/** Never clothing, whatever else the breadcrumb says. */
const HARD_NON_FASHION_WORDS: readonly string[] = [
  'pet', 'dog', 'cat', 'toy', 'automotive', 'electronic', 'electronics', 'phone', 'laptop', 'computer',
];

/**
 * Veto first, then proof — see the essay in `shop-feed.ts`, which is where
 * this rule is argued and where the client copy of it lives.
 *
 * `jewelry` is a browsable slot the shelf never asks for; it is admitted here
 * on the same terms as every other kind, because the category grid in intake
 * reads this same browse and somebody adding a necklace is not shopping.
 */
export function isFashionFamily(family: GateableFamily, slot: BrowsableSlot): boolean {
  const verdict = categoryVerdict(family.category);
  if (verdict === 'non-fashion') return false;

  // The title's own veto: an object nobody wears, anywhere in it, plural or
  // not — "Rotating Shoe Rack Tower" is a rack whatever else it names. The
  // list is kept to unambiguous objects so a modifier is never a veto
  // (verification, UX-8b, V2-3). Mirror of shop-feed.ts.
  const title = wordsOf(family.title);
  for (const word of NON_APPAREL_TITLE_WORDS) {
    if (containsWord(title, word)) return false;
  }

  if (family.productClass) return family.productClass === slot;
  return verdict === 'fashion';
}
