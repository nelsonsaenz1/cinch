import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RevealArrival } from '@/components/reveal/reveal-arrival';
import { RevealCount } from '@/components/reveal/reveal-count';
import { RevealEmpty } from '@/components/reveal/reveal-empty';
import { RevealStage } from '@/components/reveal/reveal-stage';
import { Plate } from '@/components/today/plate';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Placement } from '@/features/billing/placements';
import { useGate } from '@/features/billing/use-gate';
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
import { track } from '@/lib/posthog';
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
  const gate = useGate();
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

  // The first plate anyone ever sees, and the top of the outfit-engagement
  // funnel. Gated on exactly what the render below is gated on — settled, a
  // non-zero count, and an outfit actually produced — because the whole point
  // of the beat is that it may end at the honest zero instead, and a zero
  // Reveal is a screen where no outfit was seen. `useRef` rather than
  // `trackOnce`: the Reveal is a one-shot screen, so a per-mount guard is all
  // the claim needs, and a person who walks the repair loop and comes back has
  // genuinely been shown a second set.
  const revealViewed = useRef(false);
  const revealHasPlate = settled && !wardrobe.isLoading && count > 0 && Boolean(first);
  useEffect(() => {
    if (!revealHasPlate || revealViewed.current) return;
    revealViewed.current = true;
    track('outfit_set_viewed', { surface: 'reveal', count: 1, offline: false });
  }, [revealHasPlate]);

  /**
   * The end of onboarding: the reader has seen the count and the first plate,
   * and this hands them to the app.
   *
   * Founder decision D2 (docs/design/positioning-contract.md §5): a
   * DISMISSIBLE paywall presents here, on the way out. This is the highest-
   * intent second in the product — somebody has just photographed ten things
   * and been told, in a number computed from their own closet, what they own.
   *
   * WHY HERE AND NOWHERE ELSE. Not in an effect: that throws the sheet over a
   * page still being read, and "after the Reveal" has to mean after they say
   * they are done with it. Not on the Today side either — a paywall that
   * appears once the app has already changed underneath them reads as an
   * ambush rather than an offer. It goes on the press, before the replace.
   *
   * `router.replace` runs on EVERY outcome — `granted`, `declined`,
   * `unavailable` alike — which is why there is no branch on the result here.
   * Three separate reasons, and all three have to hold:
   *
   *  1. Nothing on this screen is withheld, so a purchase has nothing to
   *     unlock. Membership is read by `usePlan()` where it actually matters.
   *  2. The free tier the reader was just shown is intact after a dismissal,
   *     and it MUST be. Ten-pieces-free is the wedge; a Reveal that ends at a
   *     wall the free tier cannot pass makes the whole positioning a lie.
   *  3. Paywall 254200 is `non_gated`, so Superwall runs `feature()` on
   *     dismissal too and `present()` resolves 'granted' for somebody who
   *     bought nothing. Branching on the outcome would not mean what it looks
   *     like it means. On a real purchase `use-gate.ts` has already pushed
   *     /membership-thanks, and `replace` under it leaves that on top.
   *
   * `present()` never rejects and never hangs (the fail-safe contract in
   * use-gate.ts), so there is no error path here to invent.
   *
   * NOT THIS FUNCTION: the repair loop below (`onFix`). That is a reader whose
   * ten made no outfits, being sent back to fix it. Charging at that moment
   * would be charging for the failure.
   */
  const goToToday = useCallback(async () => {
    // `outfitCount` is the only field the line needs; plan and trial state are
    // read inside the hook and override anything passed from here.
    await gate.present(Placement.RevealComplete, undefined, { outfitCount: count });
    router.replace('/(tabs)');
  }, [gate, count, router]);

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
    <ScrollView className="flex-1 bg-canvas" contentContainerClassName="pb-16">
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
              /* No love / not-for-me / worn here. There is no day to mark as
                 worn yet, and the reader has not entered the app — the pills
                 used to render live on this screen and swallow every tap. */
              preview
            />
          </View>
          <View className="px-gutter">
            <Button title="Go to Today" onPress={() => void goToToday()} haptic />
          </View>
        </SafeAreaView>
      ) : null}
    </ScrollView>
  );
}
