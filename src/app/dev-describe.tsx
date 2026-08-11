import { useAssets } from 'expo-asset';
import { useMemo } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  GarmentSearchSheetBody,
  type GarmentSearchFlowView,
} from '@/components/ingest/garment-search-sheet';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/theme/tokens';

/**
 * Describe fixture — `cinch://dev-describe`.
 *
 * The Describe State Atlas as one vertically scrolling screen: every state the
 * "Describe it instead" sheet can hold, hardcoded, signed-out, with no network
 * and no mutations in flight. One full-height page per state, labeled with its
 * atlas ID (D-01 … D-12), so the whole atlas can be judged on-device against
 * its PNGs.
 *
 * Each page renders the real `GarmentSearchSheetBody` — the exact component the
 * live sheet mounts inside its Modal — fed a hand-built `GarmentSearchFlowView`
 * instead of the live hook. The body is a pure function of that shape, so what
 * these pages draw is what the shipped sheet draws for the same state; the
 * fixture cannot drift from the screen it documents. The licensed photographs
 * in assets/garments/ stand in for retailer product shots, exactly as the atlas
 * itself renders them.
 *
 * Every callback is a no-op: nothing here searches, resolves or imports, which
 * is the point — the states are posed, not reached.
 *
 * Dev-only, like dev-capture and dev-screens: __DEV__-gated by the `dev-`
 * prefix in the auth gate.
 */

// The atlas's cast — the same licensed photographs the PNGs render. Downloaded
// (useAssets, below) rather than read as Metro URLs: in dev every bundler
// asset is served from the one `/assets` path with the file in the query
// string, and `stableImageSource` keys its cache on the path alone — so four
// Metro URLs collapse into one cache entry and every tile shows the first
// picture to load. A downloaded asset's `file://` localUri is distinct per
// file and survives the query-stripping.
const GARMENT_MODULES = [
  require('@/assets/garments/cream-mohair-sweater.jpg'),
  require('@/assets/garments/white-linen-blouse.jpg'),
  require('@/assets/garments/beige-corduroy-skirt.jpg'),
  require('@/assets/garments/cognac-shearling-coat.jpg'),
] as const;
const [CREAM_KNIT_IX, BLOUSE_IX, SKIRT_IX, COAT_IX] = [0, 1, 2, 3];

/** The description the search states share, verbatim from the atlas. */
const DESCRIPTION = 'Everlane cream mohair crewneck, oversized';

/** The pasted link the D-03/D-08 pages hold, tracking parameters and all. */
const REFORMATION_URL =
 'https://www.reformation.com/products/gemma-dress?color=navy&utm_source=ios';

/**
 * The four link-failure sentences, copied byte-for-byte from the private
 * `MESSAGES` table in use-garment-search.ts (it is not exported, and a fixture
 * import would drag the Supabase client into a dev screen). Straight
 * apostrophes and the one em dash, exactly as the table spells them — these
 * sentences are the contract the atlas checks.
 */
const LINK_REJECTED =
 "Cinch can't open that link. Paste the product page from the shop's own site.";
const LINK_UNREACHABLE =
 "That page didn't answer. Check the link, or photograph the item instead.";
const LINK_NOT_A_PAGE =
 "That link isn't a product page. Open the item on the shop's site and copy that link.";
const LINK_NO_IMAGE =
 "Cinch couldn't find the picture on that page — photograph the item instead.";

/** The D-05/D-06 candidate grid, four shops and four of our own photographs. */
function candidatesFrom(uris: readonly string[]) {
  return [
    { imageUrl: uris[CREAM_KNIT_IX], title: 'Oversized Alpaca Crew, Bone', source: 'everlane.com', confidence: 0.92 },
    { imageUrl: uris[BLOUSE_IX], title: 'Mohair Blend Sweater, Cream', source: 'net-a-porter.com', confidence: 0.84 },
    { imageUrl: uris[SKIRT_IX], title: 'Brushed Wool Crewneck', source: 'matchesfashion.com', confidence: 0.71 },
    { imageUrl: uris[COAT_IX], title: 'Cropped Knit, Ecru', source: 'ssense.com', confidence: 0.63 },
  ];
}

/**
 * The sheet as it opens: empty field, nothing attached, nothing asked yet.
 * Every state below is this plus its deltas, so a page declares only what
 * makes it itself.
 */
const IDLE: GarmentSearchFlowView = {
  description: '',
  setDescription: () => {},
  swatch: null,
  attachSwatch: async () => {},
  clearSwatch: () => {},
  results: null,
  run: async () => {},
  searching: false,
  choose: async () => null,
  importingUrl: null,
  errorMessage: null,
  closetFull: false,
  reset: () => {},
  link: null,
  readLink: async () => {},
  resolving: false,
  preview: null,
  previewName: '',
  setPreviewName: () => {},
  confirmPreview: async () => null,
  discardPreview: () => {},
  importingPreview: false,
};

function pose(overrides: Partial<GarmentSearchFlowView>): GarmentSearchFlowView {
  return { ...IDLE, ...overrides };
}

/** The atlas ID strip above each page's sheet. */
function AtlasLabel({ id, name }: { id: string; name: string }) {
  const theme = useTheme();
  return (
    <View className="flex-row items-baseline gap-2 px-gutter pt-2">
      <Text variant="caption" style={{ color: theme.faint }}>
        {id}
      </Text>
      <Text variant="caption" style={{ color: theme.faint }}>
        {name}
      </Text>
    </View>
  );
}

export default function DevDescribeScreen() {
  const insets = useSafeAreaInsets();
  const { height: winHeight } = useWindowDimensions();
  const pageHeight = winHeight - insets.top;

  // Downloaded copies of the cast, for the distinct file:// URIs — see the
  // note on GARMENT_MODULES. `assets` is undefined for the first frames.
  const [assets] = useAssets([...GARMENT_MODULES]);
  const uris = useMemo(
    () => assets?.map((asset) => asset.localUri ?? asset.uri) ?? null,
    [assets],
  );

  // The atlas, in order. Link-failure pages pose their `link` directly rather
  // than deriving it from the field — D-09's IPv4 host would never survive
  // `parsePastedLink`, whose grammar refuses IP literals; the atlas frames the
  // rendering of the failure, not the path to it, so the fixture sets the
  // recognised link the real flow would have held the moment the server said no.
  const pages = useMemo(() => {
    if (!uris) return null;
    const CANDIDATES = candidatesFrom(uris);
    return [
        {
          id: 'D-01',
          name: 'Opened — empty field, Find asleep',
          flow: pose({}),
        },
        {
          id: 'D-02',
          name: 'Described, colour photo attached',
          flow: pose({
            description: DESCRIPTION,
            // A real local URI for the thumbnail; the dataUrl rides only in
            // the request body, which this fixture never sends.
            swatch: { uri: uris[CREAM_KNIT_IX], dataUrl: 'data:image/jpeg;base64,' },
          }),
        },
        {
          id: 'D-03',
          name: 'Link recognised — the row names the shop',
          flow: pose({
            description: REFORMATION_URL,
            link: { url: REFORMATION_URL, host: 'reformation.com' },
          }),
        },
        {
          id: 'D-04',
          name: 'Looking — the grid stands in for itself',
          flow: pose({
            description: DESCRIPTION,
            swatch: { uri: uris[CREAM_KNIT_IX], dataUrl: 'data:image/jpeg;base64,' },
            searching: true,
          }),
        },
        {
          id: 'D-05',
          name: 'Candidates — four pictures, four shops',
          flow: pose({
            description: DESCRIPTION,
            results: CANDIDATES,
          }),
        },
        {
          id: 'D-06',
          name: 'Adding one — chosen tile washed, others dimmed',
          flow: pose({
            description: DESCRIPTION,
            results: CANDIDATES,
            importingUrl: CANDIDATES[0].imageUrl,
          }),
        },
        {
          id: 'D-07',
          name: 'Nothing matched — a sentence, not a shrug',
          flow: pose({
            description: DESCRIPTION,
            results: [],
          }),
        },
        {
          id: 'D-08',
          name: 'Link resolved — one picture, one question',
          flow: pose({
            description: REFORMATION_URL,
            link: { url: REFORMATION_URL, host: 'reformation.com' },
            preview: { imageUrl: uris[COAT_IX], title: 'Gemma Dress', source: 'reformation.com' },
            previewName: 'Gemma Dress',
          }),
        },
        {
          id: 'D-09',
          name: 'Link refused — not a shop’s own page',
          flow: pose({
            description: 'http://192.168.1.24/shop/dress',
            link: { url: 'https://192.168.1.24/shop/dress', host: '192.168.1.24' },
            errorMessage: LINK_REJECTED,
          }),
        },
        {
          id: 'D-10',
          name: 'Page didn’t answer',
          flow: pose({
            description: 'https://shop.example.com/p/9f21-linen-blouse',
            link: { url: 'https://shop.example.com/p/9f21-linen-blouse', host: 'shop.example.com' },
            errorMessage: LINK_UNREACHABLE,
          }),
        },
        {
          id: 'D-11',
          name: 'Not a product page',
          flow: pose({
            description: 'https://cdn.shopcatalog.com/lookbook-aw26.pdf',
            link: { url: 'https://cdn.shopcatalog.com/lookbook-aw26.pdf', host: 'cdn.shopcatalog.com' },
            errorMessage: LINK_NOT_A_PAGE,
          }),
        },
        {
          id: 'D-12',
          name: 'No picture on the page',
          flow: pose({
            description: 'https://www.arket.com/en/product/silk-slip-skirt',
            link: { url: 'https://www.arket.com/en/product/silk-slip-skirt', host: 'arket.com' },
            errorMessage: LINK_NO_IMAGE,
          }),
        },
    ] as const;
  }, [uris]);

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  // A blank canvas frame for the beat the downloads take; posing the pages
  // with half-fetched pictures would put the one bug this fixture caught —
  // every tile showing the same photograph — back on screen.
  if (!pages) {
    return <SafeAreaView className="flex-1 bg-canvas" />;
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-canvas">
      <ScrollView showsVerticalScrollIndicator={false}>
        {pages.map((page) => (
          <View key={page.id} style={{ height: pageHeight }}>
            <AtlasLabel id={page.id} name={page.name} />
            <View className="flex-1">
              <GarmentSearchSheetBody flow={page.flow} onClose={() => {}} />
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
