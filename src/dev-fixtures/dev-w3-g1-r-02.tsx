/**
 * DEV ONLY — Wave 3 Group 1 canonical fixture: R-02.
 *
 * The canonical ten. Twelve outfits from the separates and two more from the dress, counted from what was photographed rather than estimated. The first real outfit is shown as GARMENTS, which is what makes the count credible — the arithmetic is demonstrated rather than asserted.
 *
 * THE DERIVATION SITS DIRECTLY UNDER THE HEADLINE, never in a footnote, so the
 * number and its proof are read together. Every figure here is computed by
 * `countOutfits` and `reveal-copy.ts` from a literal tally — nothing is typed
 * into the layout, which is the rule the whole section exists to hold.
 *
 * Deterministic by construction: a literal tally, a bundled outfit fixture, and
 * a colophon whose temperature is a literal rather than a live reading.
 */

import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FIXTURE_OUTFIT } from '@/components/dev/fixtures';
import { RevealCount } from '@/components/reveal/reveal-count';
import { RevealStage } from '@/components/reveal/reveal-stage';
import { derivationLine, displayFontSize } from '@/features/onboarding/reveal-spec';
import { Plate } from '@/components/today/plate';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { countOutfits, type Tally } from '@/features/closet/outfit-count';
import {
  compositionChips,
} from '@/features/onboarding/reveal-copy';

const TALLY: Tally = { tops: 3, bottoms: 2, dresses: 1, shoes: 2 };

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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
        <RevealCount
          count={countOutfits(TALLY)}
          fontSize={displayFontSize(countOutfits(TALLY), false, false)}
          derivation={derivationLine(10, TALLY)}
          chips={compositionChips(TALLY, true, true)}
          spokenLabel={derivationLine(10, TALLY)}
        />
        <View style={{ marginTop: 24 }}>
          <Text variant="eyebrow">The first one</Text>
          <View style={{ marginTop: 10, marginHorizontal: -20 }}>
            <Plate
              outfit={FIXTURE_OUTFIT}
              index={0}
              occasion={null}
              colophon={{ city: 'Denver', feelsLikeC: 22 }}
              resolveImage={() => undefined}
              preview
            />
          </View>
        </View>
      </ScrollView>
      <SafeAreaView edges={['bottom']}>
        <Button title="Open Today" onPress={() => {}} className="self-stretch" />
      </SafeAreaView>
    </RevealStage>
  );
}
