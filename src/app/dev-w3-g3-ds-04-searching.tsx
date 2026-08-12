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
 * DS-04, first half — searching.
 *
 * "The searching rows are the result rows with their content withheld, at
 * identical heights and thumb sizes." Skeleton geometry equals result geometry,
 * which is what makes the transition to DS-03 land without anything moving.
 *
 * NO SPINNER. `Skeleton`'s breath is an opacity animation that holds at its mid
 * value under Reduce Motion; capture this route with Reduce Motion ON so the
 * bytes settle. An `ActivityIndicator` is never acceptable inside a captured
 * viewport — it spins, and a spinning thing cannot reproduce itself.
 */
export default function DevW3G3Ds04Searching() {
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
        flow={pose({ description: QUERY, searching: true })}
        onClose={() => {}}
      />
    </SafeAreaView>
  );
}
