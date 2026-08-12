import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FIXTURE_OUTFIT } from '@/components/dev/fixtures';
import { SAMPLE_ASSET } from '@/components/dev/ten-fixtures';
import { RevealArrival } from '@/components/reveal/reveal-arrival';
import { RevealCount } from '@/components/reveal/reveal-count';
import { RevealEmpty } from '@/components/reveal/reveal-empty';
import { RevealStage } from '@/components/reveal/reveal-stage';
import { Plate } from '@/components/today/plate';
import { Text } from '@/components/ui/text';
import type { Tally } from '@/features/closet/outfit-count';
import {
  compositionChips,
  defaultDerivation,
  headline,
  missingRows,
  smallestFix,
  substitutionDerivation,
  zeroBody,
  zeroHeadline,
} from '@/features/onboarding/reveal-copy';

/**
 * DEV ONLY — every state of The Reveal (R-01…R-05) at `cinch://dev-reveal`.
 * R-03 renders the real `Plate` component from `src/components/today/plate.tsx`
 * with the same fixture `dev-plate`/`dev-today` use, per the contract: "one of
 * them, laid out... presented exactly as every later outfit is presented."
 */
export default function DevRevealScreen() {
  // Hooks first, unconditionally — the __DEV__ gate below must not skip them.
  const [index, setIndex] = useState(0);

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  const pages = [
    { id: 'R-01', label: 'Arrival — the count is not known yet', render: () => <PageR01 /> },
    { id: 'R-02', label: 'The count revealed', render: () => <PageR02 /> },
    { id: 'R-03', label: 'The first outfit', render: () => <PageR03 /> },
    { id: 'R-04', label: 'A closet that deviated', render: () => <PageR04 /> },
    { id: 'R-05', label: 'The honest failure', render: () => <PageR05 /> },
  ];

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="flex-row flex-wrap gap-2 px-gutter pb-2 pt-1">
        {pages.map((p, i) => (
          <Text
            key={p.id}
            onPress={() => setIndex(i)}
            variant="colophon"
            style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}
            className={
              i === index
                ? 'border border-accent bg-accent-light text-accent'
                : 'border border-rule'
            }>
            {p.id}
          </Text>
        ))}
      </View>
      <Text variant="label" className="px-gutter pb-2">
        {pages[index]!.label}
      </Text>
      <View style={{ flex: 1 }}>{pages[index]!.render()}</View>
    </SafeAreaView>
  );
}

const CANONICAL_TALLY: Tally = { tops: 3, bottoms: 2, dresses: 1, shoes: 2 };
const DEVIATED_TALLY: Tally = { tops: 4, bottoms: 2, dresses: 0, shoes: 2 };
const BARE_TALLY: Tally = { tops: 10, bottoms: 0, dresses: 0, shoes: 0 };

function PageR01() {
  return (
    <RevealStage>
      <RevealArrival
        otherUris={[
          SAMPLE_ASSET.blouse,
          SAMPLE_ASSET.sweater,
          SAMPLE_ASSET.trousers,
          SAMPLE_ASSET.skirt,
          SAMPLE_ASSET.loafers,
          SAMPLE_ASSET.coat,
        ]}
        lastUri={SAMPLE_ASSET.tote}
        pieceCount={10}
      />
    </RevealStage>
  );
}

function PageR02() {
  return (
    <RevealStage>
      <RevealCount
        headline={headline(10, CANONICAL_TALLY)}
        derivation={defaultDerivation(CANONICAL_TALLY)}
        chips={compositionChips(CANONICAL_TALLY, true, true)}
      />
    </RevealStage>
  );
}

function PageR03() {
  return (
    <ScrollView contentContainerClassName="pt-6 pb-16" className="bg-canvas">
      <View className="px-gutter">
        <Text variant="eyebrow">Plate 01 · the first one</Text>
      </View>
      <View style={{ marginTop: 10 }}>
        <Plate
          outfit={FIXTURE_OUTFIT}
          index={0}
          occasion="dinner at 7"
          colophon={{ city: 'Brooklyn', feelsLikeC: 14 }}
          resolveImage={() => undefined}
          onWear={() => {}}
          onReact={() => {}}
        />
      </View>
    </ScrollView>
  );
}

function PageR04() {
  return (
    <RevealStage>
      <RevealCount
        headline={headline(10, DEVIATED_TALLY)}
        derivation={substitutionDerivation(DEVIATED_TALLY, 'tops')}
        chips={compositionChips(DEVIATED_TALLY, true, true)}
      />
    </RevealStage>
  );
}

function PageR05() {
  return (
    <RevealStage>
      <RevealEmpty
        headline={zeroHeadline(10)}
        body={zeroBody(BARE_TALLY)}
        rows={missingRows(BARE_TALLY)}
        fix={smallestFix(BARE_TALLY)}
        onFix={() => {}}
        onOpenToday={() => {}}
      />
    </RevealStage>
  );
}
