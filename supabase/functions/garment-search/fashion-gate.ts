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
];

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

const wordsOf = (text: string): string =>
  ` ${foldText(text).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;

/** Word-bounded and PLURAL-AWARE — see the client mirror in shop-feed.ts. */
const containsWord = (haystack: string, phrase: string): boolean =>
  haystack.includes(` ${phrase} `) ||
  haystack.includes(` ${phrase}s `) ||
  haystack.includes(` ${phrase}es `);

/**
 * Words a title may END with that are not the thing itself: colours, sizes
 * and pack/quantity words. The head noun is the last word past these.
 */
const TRAILING_WORDS: ReadonlySet<string> = new Set([
  'set', 'sets', 'pack', 'packs', 'bundle', 'kit', 'piece', 'pieces', 'pc', 'pcs',
  'pair', 'pairs', 'count', 'lot', 'of', 'x', 'in', 'with', 'for', 'and',
  'xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl', 'small', 'medium', 'large', 'petite',
  'tall', 'regular', 'plus', 'size', 'sizes', 'women', 'womens', 'men', 'mens',
  'kids', 'unisex', 'new', 'sale',
  'black', 'white', 'navy', 'blue', 'red', 'green', 'olive', 'tan', 'beige', 'cream',
  'ivory', 'grey', 'gray', 'charcoal', 'brown', 'camel', 'khaki', 'pink', 'blush',
  'burgundy', 'oxblood', 'wine', 'maroon', 'purple', 'lilac', 'lavender', 'yellow',
  'mustard', 'gold', 'silver', 'orange', 'rust', 'copper', 'teal', 'turquoise',
  'aqua', 'mint', 'sage', 'forest', 'emerald', 'coral', 'peach', 'nude', 'taupe',
  'sand', 'stone', 'ecru', 'oatmeal', 'chocolate', 'espresso', 'indigo', 'cobalt',
  'magenta', 'fuchsia', 'plum', 'multi', 'print', 'printed', 'stripe', 'striped',
  'floral', 'check', 'checked', 'plaid', 'solid',
]);

/** The last word of a title that is not a colour, size or pack word — the noun the thing IS. */
const headWord = (title: string): string => {
  const words = wordsOf(title).trim().split(' ').filter(Boolean);
  for (let i = words.length - 1; i >= 0; i -= 1) {
    const w = words[i]!;
    if (TRAILING_WORDS.has(w) || /^\d+$/.test(w)) continue;
    return w;
  }
  return '';
};

/** Whether a word is one of the garment nouns the labels table knows. */
const isGarmentWord = (word: string): boolean =>
  word in FASHION_CATEGORY_LABELS ||
  (word.endsWith('s') && word.slice(0, -1) in FASHION_CATEGORY_LABELS) ||
  (word.endsWith('es') && word.slice(0, -2) in FASHION_CATEGORY_LABELS);

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

  // Head-noun veto, or any veto word when the title names no garment at all
  // (verification, UX-8b). Mirror of shop-feed.ts.
  const title = wordsOf(family.title);
  const head = headWord(family.title);
  const titleNamesGarment = Object.keys(FASHION_CATEGORY_LABELS).some((word) =>
    containsWord(title, word),
  );
  // A title that names a garment must BE that garment: "Rotating Shoe Rack
  // Tower" names shoes and is a tower. The head noun — past colours, sizes
  // and pack words — has to be a garment word (found live 2026-09-03, a shoe
  // rack on the shelf labelled "Shoes").
  if (titleNamesGarment && !isGarmentWord(head)) return false;
  for (const word of NON_APPAREL_TITLE_WORDS) {
    const hit = head === word || head === `${word}s` || head === `${word}es`;
    if (hit || (!titleNamesGarment && containsWord(title, word))) return false;
  }

  if (family.productClass) return family.productClass === slot;
  return verdict === 'fashion';
}
