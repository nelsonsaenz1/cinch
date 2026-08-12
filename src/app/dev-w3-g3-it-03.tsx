import { SafeAreaView } from 'react-native-safe-area-context';

import { ItemEditSheet } from '@/components/item/item-edit-sheet';
import { PHOTO } from '@/components/closet/w3-g3-fixture-data';
import { Text } from '@/components/ui/text';

/**
 * IT-03 — owner edit, details open.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · "Editing is a separate document with its own bar, so the hero never becomes
 *   a form." The document is presented over this route, which is why the route
 *   itself is empty behind it.
 * · "Oxblood on Save only" — one accent on the frame, on one control, as text.
 * · "Field label 12 LABEL" — "Field labels are the only Medium text besides
 *   Save; every value and every explanation is regular."
 * · "Tray fields r12, 48 pt".
 * · "Store sits alone under a rule at the foot, in oxblood text but not as a
 *   filled action... and the word delete does not appear on this screen at all."
 *
 * WHAT IT CANNOT SHOW, AND WHY — see the docblock on `ItemEditSheet`. The Bought
 * field has no date-entry control anywhere in this app and adding one is a new
 * dependency; the Notes field has no private column to write to, and the nearest
 * one is readable by a friend, so "only you see these" would be a privacy claim
 * the app cannot honour. Both are absent rather than drawn dead.
 *
 * DETERMINISM: every value is a literal from the frame, the photograph is the
 * repo's own licensed asset, and the document opens on mount with no autofocused
 * field — the name field is editable but not focused, so no keyboard rises into
 * the capture.
 */
export default function DevW3G3It03() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ItemEditSheet
        visible
        initial={{ name: 'Shearling coat', price: '440', category: 'outerwear' }}
        imageUri={PHOTO.coat}
        onSave={() => {}}
        onCancel={() => {}}
        onStore={() => {}}
      />
    </SafeAreaView>
  );
}
