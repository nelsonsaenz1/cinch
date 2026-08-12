/**
 * DEV ONLY — Wave 3 Group 1 canonical fixture: R-05.
 *
 * The honest zero. Zero gets exactly the same typographic treatment as
 * fourteen, because it is the subject of the screen rather than an apology.
 * "Needed" is a WORD beside the figure as well as a colour, so the state never
 * depends on colour alone — and because the frame spends its oxblood on those
 * marks, the action is ink.
 *
 * Only the kinds that bear on the failure are listed: a closet with a dress and
 * no shoes would show Dresses and Shoes, never a Bottoms row nobody's outfit
 * needs.
 *
 * Deterministic by construction: a literal tally, and every row and sentence
 * derived from it by `reveal-copy.ts`.
 */

import { SafeAreaView } from 'react-native-safe-area-context';

import { RevealEmpty } from '@/components/reveal/reveal-empty';
import { RevealStage } from '@/components/reveal/reveal-stage';
import { Text } from '@/components/ui/text';
import type { Tally } from '@/features/closet/outfit-count';
import {
  missingRows,
  smallestFix,
  zeroBody,
  zeroHeadline,
} from '@/features/onboarding/reveal-copy';

/** Ten tops and nothing else — the closet the atlas draws this state for. */
const TALLY: Tally = { tops: 10, bottoms: 0, dresses: 0, shoes: 0 };

export default function Fixture() {
  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  return (
    <RevealStage>
      <RevealEmpty
        headline={zeroHeadline(10)}
        body={zeroBody(TALLY)}
        rows={missingRows(TALLY)}
        fix={smallestFix(TALLY)}
        onFix={() => {}}
        onOpenToday={() => {}}
      />
    </RevealStage>
  );
}
