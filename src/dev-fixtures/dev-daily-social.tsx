import { useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  CaughtUpLine,
  DailyLookSkeleton,
  DailyOfflineState,
  LookCard,
  NobodySharingState,
  QuietDayState,
} from '@/components/daily-social';
import { Card } from '@/components/ui/card';
import { SectionHeader } from '@/components/ui/section-header';
import { Text } from '@/components/ui/text';
import { DAY_HEADING } from '@/features/daily-social/copy';
import { showsCaughtUpLine, showsLooks, type DailyState } from '@/features/daily-social/states';
import { type DailyReaction } from '@/features/daily-social/types';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * `cinch://dev-daily-social` — the day's states, live, in the composition
 * Explore mounts them in.
 *
 * WHY A FIXTURE AND NOT THE REAL SCREEN. Every one of these states is behind
 * sign-in AND behind a second person: S-2 needs a mutual friend who shares and
 * wore nothing, S-3 needs one who wore something in the last seven days, and
 * S-1b needs friends who have all left sharing off. None of that is reachable
 * on a review device, and the contract's §7 names fixtures as the mechanism for
 * exactly this reason.
 *
 * WHAT IT IS NOT. It is not a redrawing of the section. The components are the
 * ones `explore.tsx` renders, the heading is the same `DAY_HEADING`, and the
 * state gating is the same `showsLooks` / `showsCaughtUpLine` — a fixture that
 * reimplemented the page would stop being evidence about it. Only the data is
 * local.
 *
 * S-1a IS DELIBERATELY ABSENT from the cycler, because it is absent from the
 * unit: a reader with no circle meets Explore's own empty hero, which has been
 * that state since before this unit existed. `dev-explore.tsx` is where that
 * frame is reviewed.
 *
 * THE THIRD LOOK HAS TWO PIECES WHERE THE OTHERS HAVE FOUR. That is the frame
 * worth checking, and it is the whole reason this fixture carries three looks
 * rather than one: a piece whose owner has hidden it from friends never enters
 * `friend_items` and so never enters the collage, and a short look must read as
 * a short look rather than as a broken one. Nothing anywhere may say how many
 * are missing.
 */

/**
 * Real garment images, because the collage's whole job is to look like a look.
 * `resolveAssetSource` on a bundled asset is the house helper for this
 * (`components/dev/ten-fixtures.ts:22`) and it needs no network, which is what
 * lets these frames be drawn on a review device that is not signed in.
 */
const uri = (mod: number): string => Image.resolveAssetSource(mod).uri;

const COAT = uri(require('@/assets/garments/cognac-shearling-coat.jpg'));
const PONCHO = uri(require('@/assets/garments/cream-crochet-poncho.jpg'));
const SWEATER = uri(require('@/assets/garments/cream-mohair-sweater.jpg'));
const BLOUSE = uri(require('@/assets/garments/white-linen-blouse.jpg'));

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

const LOOKS = [
  {
    outfitId: 'look-1',
    ownerName: 'Ada',
    name: 'Weekend layers',
    wornAt: hoursAgo(5),
    pieces: [
      { itemId: 'p1', imageUrl: COAT },
      { itemId: 'p2', imageUrl: SWEATER },
      { itemId: 'p3', imageUrl: BLOUSE },
      { itemId: 'p4', imageUrl: PONCHO },
    ],
  },
  {
    // Unnamed on purpose: `UNNAMED_LOOK` is the fallback and it has to be seen.
    outfitId: 'look-2',
    ownerName: 'Rosalind',
    name: null,
    wornAt: hoursAgo(30),
    pieces: [
      { itemId: 'p5', imageUrl: BLOUSE },
      { itemId: 'p6', imageUrl: COAT },
      { itemId: 'p7', imageUrl: SWEATER },
    ],
  },
  {
    // The short look. Two pieces, and not a word about the ones that are not
    // here — this is the frame that must not read as broken.
    outfitId: 'look-3',
    ownerName: 'Mae',
    name: 'Rain again',
    wornAt: hoursAgo(52),
    pieces: [
      { itemId: 'p8', imageUrl: PONCHO },
      { itemId: 'p9', imageUrl: SWEATER },
    ],
  },
];

const CYCLE: { state: DailyState | 'loading'; label: string }[] = [
  { state: 'the_day', label: 'S-3 · the day' },
  { state: 'caught_up', label: 'S-4 · caught up' },
  { state: 'nobody_sharing', label: 'S-1b · nobody sharing' },
  { state: 'quiet_day', label: 'S-2 · quiet day' },
  { state: 'offline', label: 'S-5 · offline' },
  { state: 'loading', label: 'loading' },
];

export default function DevDailySocial() {
  const theme = useTheme();
  const [index, setIndex] = useState(0);
  const [reactions, setReactions] = useState<Record<string, DailyReaction | null>>({});

  const current = CYCLE[index];
  const state = current.state;

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Showing ${current.label}. Tap for the next state.`}
        onPress={() => setIndex((i) => (i + 1) % CYCLE.length)}
        style={{ minHeight: MIN_TAP_TARGET }}
        className="justify-center px-gutter active:opacity-60">
        <Text variant="colophon" style={{ color: theme.muted, letterSpacing: 1.2 }}>
          {current.label.toUpperCase()} — TAP TO CYCLE
        </Text>
      </Pressable>

      <ScrollView contentContainerClassName="pb-24">
        <View className="px-gutter">
          <SectionHeader title={DAY_HEADING} className="mb-2.5 mt-6" />

          {state === 'loading' ? (
            <Card style={{ borderRadius: 16 }}>
              <DailyLookSkeleton />
            </Card>
          ) : state === 'offline' ? (
            <DailyOfflineState onRetry={() => setIndex(0)} />
          ) : state === 'nobody_sharing' ? (
            <NobodySharingState onOpenSharing={() => setIndex(0)} />
          ) : state === 'quiet_day' ? (
            <QuietDayState />
          ) : showsLooks(state) ? (
            <View>
              {LOOKS.map((look) => (
                <View key={look.outfitId} className="mb-4">
                  <LookCard
                    ownerName={look.ownerName}
                    name={look.name}
                    wornAt={look.wornAt}
                    pieces={look.pieces}
                    reaction={reactions[look.outfitId] ?? null}
                    onReact={(next) =>
                      setReactions((prev) => ({ ...prev, [look.outfitId]: next }))
                    }
                  />
                </View>
              ))}
              {showsCaughtUpLine(state) ? <CaughtUpLine /> : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
