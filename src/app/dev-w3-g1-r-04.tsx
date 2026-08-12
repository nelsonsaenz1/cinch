/**
 * DEV ONLY — Wave 3 Group 1 canonical fixture: R-04.
 *
 * After a substitution. A closet that traded the dress away reads differently from one that never owned a dress, and only the flow that ran the trade knows which happened — so the sentence is drawn from the redirect, never inferred from the tally shape. The dress chip is ABSENT rather than printed as a zero.
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
import { Plate } from '@/components/today/plate';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import type { Tally } from '@/features/closet/outfit-count';
import {
  compositionChips,
  headline,
  substitutionDerivation,
} from '@/features/onboarding/reveal-copy';

const TALLY: Tally = { tops: 4, bottoms: 2, dresses: 0, shoes: 2 };

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
          headline={headline(10, TALLY)}
          derivation={substitutionDerivation(TALLY, 'tops')}
          chips={compositionChips(TALLY, true, true)}
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
