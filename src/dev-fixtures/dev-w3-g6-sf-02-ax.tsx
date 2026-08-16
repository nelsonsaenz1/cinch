import { SafeAreaView } from 'react-native-safe-area-context';

import { UnblockSheet } from '@/components/social/BlockedList';
import { Text } from '@/components/ui/text';

/**
 * SF-02 / AX — largest Dynamic Type: the consequence scrolls, the actions pin.
 *
 * WHAT THIS FRAME IS EVIDENCE FOR
 *
 * · BOTH ACTIONS ARE ALWAYS VISIBLE. On a consequential sheet the options may
 *   never be off screen, so the paragraphs live in a height-capped scroller and
 *   the two buttons sit below a hairline, outside it. Neither is abbreviated.
 * · The alternative — shrinking the type until three paragraphs fit — would
 *   make a safety consequence the smallest text on the screen, which is the
 *   trade this layout exists to refuse.
 * · IT IS NOT A DYNAMIC-TYPE BRANCH. `UnblockSheet` is built this way at every
 *   size, because a layout that is only correct at the size somebody tested is
 *   wrong at the size a reader uses. This frame and SF-02 render the same
 *   component; what differs is the system text size the reviewer sets.
 * · Reading order puts the actions last as well as last visually, so nobody
 *   confirms before hearing why.
 *
 * The long name is the stress case in situ: "Katherine Villanueva-Ross" appears
 * in the question and in all three paragraphs.
 */
export default function DevW3G6SF02AX() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <UnblockSheet
        target={{ userId: 'u-katherine', name: 'Katherine Villanueva-Ross' }}
        onConfirm={() => undefined}
        onKeep={() => undefined}
      />
    </SafeAreaView>
  );
}
