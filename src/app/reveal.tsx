import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RevealArrival } from '@/components/reveal/reveal-arrival';
import { RevealCount } from '@/components/reveal/reveal-count';
import { RevealEmpty } from '@/components/reveal/reveal-empty';
import { RevealStage } from '@/components/reveal/reveal-stage';
import { Plate } from '@/components/today/plate';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { countOutfits, tallyOf, type CountedKind } from '@/features/closet/outfit-count';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { useStyleContext } from '@/features/context/use-style-context';
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
import { useWardrobe } from '@/features/styling/queries';
import { useOutfits } from '@/features/styling/use-outfits';
import { DEFAULT_WEIGHTS, EMPTY_AFFINITIES } from '@/lib/styling';

/**
 * The Reveal — Directive 2's three beats on one surface, states R-01…R-05.
 *
 * Arrives from The Ten's stop sheet. Beat one holds while the wardrobe query
 * catches up with tagging that may still be finishing for the last few
 * pieces — genuinely "the count is not known yet", not a staged pause — then
 * settles on the count (or the honest zero) and the first real outfit, laid
 * out exactly as `src/components/today/plate.tsx` renders every later one.
 * See docs/design/free-tier-contract.md and design-refs/html/The Reveal
 * State Atlas.
 */
export default function RevealScreen() {
  const router = useRouter();
  const { height: windowHeight } = useWindowDimensions();
  const wardrobe = useWardrobe();
  const params = useLocalSearchParams<{ redirectedDressTo?: string }>();
  const redirectedDressTo =
    params.redirectedDressTo === 'tops' || params.redirectedDressTo === 'bottoms'
      ? (params.redirectedDressTo as CountedKind)
      : null;

  // One refetch on arrival — the last piece or two may have still been
  // tagging when The Ten's stop sheet fired.
  useEffect(() => {
    void wardrobe.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [settled, setSettled] = useState(false);
  useEffect(() => {
    // A floor under the "arrival" beat so it reads as a beat and not a
    // flicker, and a ceiling so a slow tagging pass never holds the screen
    // hostage — whatever is tagged by then is the honest count.
    const t = setTimeout(() => setSettled(true), 1200);
    return () => clearTimeout(t);
  }, []);

  const items = useMemo(() => wardrobe.data ?? [], [wardrobe.data]);
  const tally = useMemo(() => tallyOf(items), [items]);
  const count = countOutfits(tally);

  const { resolve } = useSignedUrls(items.flatMap((g) => [g.platePath, g.cutoutPath, g.thumbPath]));

  const { context, cityLabel } = useStyleContext({ note: null });
  const outfits = useOutfits({
    wardrobe: items,
    context,
    profile: { weights: DEFAULT_WEIGHTS, affinities: EMPTY_AFFINITIES, feedbackCount: 0, summary: [] },
    count: 3,
    enabled: settled && count > 0,
  });
  const first = outfits.outfits[0];

  const derivation = redirectedDressTo
    ? substitutionDerivation(tally, redirectedDressTo)
    : defaultDerivation(tally);

  if (!settled || wardrobe.isLoading) {
    return (
      <RevealStage>
        <RevealArrival
          otherUris={items.slice(0, -1).slice(0, 6).map((g) => resolve(g.platePath, g.cutoutPath, g.thumbPath))}
          lastUri={
            items.length ? resolve(items[items.length - 1]!.platePath, items[items.length - 1]!.cutoutPath, items[items.length - 1]!.thumbPath) : undefined
          }
          pieceCount={items.length}
        />
      </RevealStage>
    );
  }

  return (
    <ScrollView className="flex-1 bg-canvas dark:bg-canvas-dark" contentContainerClassName="pb-16">
      {/* Beats one and two fill exactly one screen — "scroll for the first
          one" only reads as an instruction if there is somewhere to scroll
          FROM. */}
      <View style={{ minHeight: windowHeight }}>
        <RevealStage>
          {count === 0 ? (
            <RevealEmpty
              headline={zeroHeadline(items.length)}
              body={zeroBody(tally)}
              rows={missingRows(tally)}
              fix={smallestFix(tally)}
              onFix={() => router.replace('/the-ten')}
            />
          ) : (
            <RevealCount
              headline={headline(items.length, tally)}
              derivation={derivation}
              chips={compositionChips(
                tally,
                items.some((g) => g.slot === 'outerwear'),
                items.some((g) => g.slot === 'bag'),
              )}
            />
          )}
        </RevealStage>
      </View>

      {count > 0 && first ? (
        <SafeAreaView edges={['bottom']} className="mt-8">
          <View className="px-gutter">
            <Text variant="eyebrow">Plate 01 · the first one</Text>
          </View>
          <View style={{ marginTop: 10 }}>
            <Plate
              outfit={first}
              index={0}
              occasion={context.events[0]?.title ?? null}
              colophon={{ city: cityLabel, feelsLikeC: context.weather?.feelsLikeC }}
              resolveImage={resolve}
              onWear={() => {}}
              onReact={() => {}}
            />
          </View>
          <View className="px-gutter">
            <Button title="Go to Today" onPress={() => router.replace('/(tabs)')} haptic />
          </View>
        </SafeAreaView>
      ) : null}
    </ScrollView>
  );
}
