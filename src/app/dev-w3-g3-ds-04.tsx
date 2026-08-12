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
 * DS-04 — nothing found, drawn as a filing rather than a failure.
 *
 * "When nothing matches, the outcome is a filing, not a failure... No result
 * count is invented, no '0 results' is printed, and the retry is offered as
 * changing the description rather than as trying the same query again."
 *
 * THE SEARCHING HALF OF THIS FRAME IS `dev-w3-g3-ds-04-searching`. The atlas
 * draws both on one sheet so the pair can be compared; two routes are the
 * honest translation, because the shipping screen shows one at a time and a
 * fixture that showed both would be posing a composition that never exists.
 *
 * THE PRIMARY ACTION IS NOW DRAWN. "File it in my words" was parked for two
 * packets because it needed an intake path that creates a piece from text with
 * no picture; `useFileTypedWords` is that path, and it turned out to need no
 * server change at all — `items` is owner-insertable under RLS and its image
 * columns have always been nullable. `supabase/tests/12_silhouette_intake.sql`
 * holds the boundary.
 */
export default function DevW3G3Ds04() {
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
        flow={pose({ description: QUERY, results: [] })}
        onClose={() => {}}
      />
    </SafeAreaView>
  );
}
