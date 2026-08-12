import { SafeAreaView } from 'react-native-safe-area-context';

import {
  GarmentSearchSheetBody,
  type GarmentSearchFlowView,
} from '@/components/ingest/garment-search-sheet';
import { Text } from '@/components/ui/text';

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

function pose(over: Partial<GarmentSearchFlowView>): GarmentSearchFlowView {
  return { ...IDLE, ...over };
}

const PASTED = 'https://www.everlane.com/products/womens-cashmere-crew-navy';

/**
 * DS-02 — a product link, recognised.
 *
 * The action renames itself from "Find it" to "Read this page", "because the
 * two do different work and a user who pasted a link should not wonder whether
 * Cinch is about to buy something."
 *
 * NO AFFILIATE LANGUAGE IS DRAWN HERE, and its absence is the frame's own
 * annotation: "No 'Paid link' — nothing affiliate." This is intake of a piece
 * the user already owns, so there is no Paid-link marker and no merchant row.
 * Those exist only in the approved commerce product sheet in the Gap Feed.
 */
export default function DevW3G3Ds02() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <GarmentSearchSheetBody
        flow={pose({
          description: PASTED,
          link: { url: PASTED, host: 'everlane.com' },
        })}
        onClose={() => {}}
      />
    </SafeAreaView>
  );
}
