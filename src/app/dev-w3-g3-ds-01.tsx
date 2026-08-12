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

/**
 * DS-01 — the empty field, with Find inert and its reason printed.
 *
 * Audit 70: ONE opening sentence and an 88pt field that grows a line at a time,
 * in place of the three-sentence intro and the half-screen text area.
 *
 * Audit 71: the field names both its jobs twice — in the uppercase label and in
 * the sentence above it — and a disabled Find "is inert paper with a hairline
 * and its reason printed beside it, never a dimmed oxblood button". The reason
 * is on screen before any tap, not after a failed one.
 *
 * NO AUTOFOCUS. The frame draws the keyboard up; this route deliberately does
 * not raise it, because a focused field blinks a caret and a blinking caret can
 * never reproduce its own bytes. Capture the keyboard state by tapping the
 * field by hand if the keyboard itself is what is under review.
 */
export default function DevW3G3Ds01() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <GarmentSearchSheetBody flow={IDLE} onClose={() => {}} />
    </SafeAreaView>
  );
}
