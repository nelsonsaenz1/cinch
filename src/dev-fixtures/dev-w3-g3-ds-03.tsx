import { useAssets } from 'expo-asset';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  GarmentSearchSheetBody,
  type GarmentSearchFlowView,
} from '@/components/ingest/garment-search-sheet';
import { Text } from '@/components/ui/text';

// Downloaded rather than read as Metro URLs: in dev every bundler asset is
// served from the one `/assets` path with the file in the query string, and
// `stableImageSource` keys its cache on the path alone — so several Metro URLs
// collapse into one cache entry and every row shows the first picture to load.
const GARMENTS = [
  require('@/assets/garments/cream-mohair-sweater.jpg'),
  require('@/assets/garments/white-linen-blouse.jpg'),
  require('@/assets/garments/beige-corduroy-skirt.jpg'),
];

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
  errorCode: null,
  // DS-03/04/05's escape, posed inert: a fixture must not write a row.
  fileOwnWords: async () => null,
  filing: false,
  canFileOwnWords: true,
  importingPreview: false,
};

function pose(over: Partial<GarmentSearchFlowView>): GarmentSearchFlowView {
  return { ...IDLE, ...over };
}

const QUERY = 'navy wool crewneck sweater';

/**
 * DS-03 — results as IDENTIFICATIONS, not a shop.
 *
 * The deviation ledger's fault: "Results read as a shopping feed; source of
 * image and details not stated per row." What replaces it is a list of rows
 * that each name where their picture and details came from, in prose, at the
 * moment of choosing rather than in a footnote — and the headline asks which
 * piece the user OWNS.
 *
 * What a reviewer checks: no price anywhere, no merchant button, no Paid link,
 * no sponsored ordering, and a match with no usable image saying so rather than
 * borrowing a stock photograph (the third row).
 *
 * THE ESCAPE ROW IS NOW DRAWN. "None of these — file my own words" was held
 * back while filing typed words with no picture had nowhere to land — a row
 * whose tap fails being worse than its absence. `useFileTypedWords` gives it
 * somewhere, and the same path repairs the third row below: a match with no
 * usable image used to call the importer with an empty URL and throw.
 *
 * ONE THING THIS FRAME STILL DOES NOT DRAW, reported rather than invented:
 *
 * · Claim 4's aggregator attribution. Each row names the retailer the feed
 *   reported. Whether the licence also requires naming the aggregator, and in
 *   what words, "is set by the licence rather than by design", so nothing is
 *   invented here in the meantime.
 *
 * The photographs are the repo's licensed set standing in for retailer product
 * shots, exactly as the atlas's own PNGs do.
 */
export default function DevW3G3Ds03() {
  // The hook runs before every early return — React requires the same hook
  // order on every render, and the `__DEV__` guard below is an early return.
  const [assets] = useAssets(GARMENTS);
  const uris = assets?.map((a) => a.localUri ?? a.uri) ?? [];

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  // Held until the three assets have resolved — a half-loaded row set would
  // capture differently on every run.
  if (uris.length < 3) return <View className="flex-1 bg-canvas" />;

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <GarmentSearchSheetBody
        flow={pose({
          description: QUERY,
          results: [
            {
              imageUrl: uris[0],
              title: 'Merino crewneck, navy',
              source: 'everlane.com',
              confidence: 0.94,
            },
            {
              imageUrl: uris[1],
              title: 'Lambswool crew, ink',
              source: 'jcrew.com',
              confidence: 0.81,
            },
            // The frame's third row: a real identification the feed could not
            // give a usable picture for. It says so and files as a silhouette.
            { imageUrl: '', title: 'Navy wool crewneck', source: 'uniqlo.com', confidence: 0.66 },
          ],
        })}
        onClose={() => {}}
      />
    </SafeAreaView>
  );
}
