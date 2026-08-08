import { Asset } from 'expo-asset';
import { Image } from 'expo-image';
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import { ClosetFullSheet } from '@/components/wall/closet-full-sheet';
import { ordinal } from '@/features/closet/gap-feed';
import { countOutfits, rankGaps, type Tally } from '@/features/closet/outfit-count';
import { outcomeOfSwap, rankSwapCandidates, type SwapCandidate } from '@/features/closet/swap';
import { useTheme } from '@/theme/tokens';

/**
 * The Wall fixture — `cinch://dev-wall`.
 *
 * Renders W-01 through W-05 from hand-built fixtures against the real
 * `ClosetFullSheet` component and the real `swap.ts` math, so the numbers on
 * screen here are the same computed figures the live `/wall-swap` route
 * would show for this closet. Dev-only — see dev-item.tsx.
 */

const BLOUSE = Asset.fromModule(require('@/assets/garments/white-linen-blouse.jpg')).uri;
const SWEATER = Asset.fromModule(require('@/assets/garments/cream-mohair-sweater.jpg')).uri;
const PONCHO = Asset.fromModule(require('@/assets/garments/cream-crochet-poncho.jpg')).uri;
const TROUSERS = Asset.fromModule(require('@/assets/garments/charcoal-tailored-trousers.jpg')).uri;
const SKIRT = Asset.fromModule(require('@/assets/garments/beige-corduroy-skirt.jpg')).uri;
const LOAFERS = Asset.fromModule(require('@/assets/garments/brown-leather-loafers.jpg')).uri;
const BOOTS = Asset.fromModule(require('@/assets/garments/brown-leather-boots.jpg')).uri;
const COAT = Asset.fromModule(require('@/assets/garments/cognac-shearling-coat.jpg')).uri;
const TOTE = Asset.fromModule(require('@/assets/garments/cognac-leather-tote.jpg')).uri;
const OVERSHIRT = Asset.fromModule(require('@/assets/garments/beige-overshirt-jacket.jpg')).uri;

/** The free ten, real assets standing in for real photographs. */
const TEN_GRID = [BLOUSE, SWEATER, PONCHO, TROUSERS, SKIRT, LOAFERS, BOOTS, COAT, TOTE, OVERSHIRT];
const THE_TEN: Tally = { tops: 3, bottoms: 2, dresses: 1, shoes: 2 };

const FRAMES = ['W-01', 'W-02', 'W-03', 'W-04', 'W-05'] as const;
type Frame = (typeof FRAMES)[number];

export default function DevWall() {
  const [frame, setFrame] = useState<Frame>('W-01');

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  const dark = frame === 'W-02';

  return (
    <View className={`flex-1 ${dark ? 'bg-ink' : 'bg-canvas'}`}>
      <SafeAreaView className="flex-1" edges={['top']}>
        {frame === 'W-01' ? <W01 /> : null}
        {frame === 'W-02' ? <W02 /> : null}
        {frame === 'W-03' ? <W03 /> : null}
        {frame === 'W-04' ? <W04 /> : null}
        {frame === 'W-05' ? <W05 /> : null}
      </SafeAreaView>

      <View className="absolute bottom-0 left-0 right-0 border-t border-rule bg-canvas px-3 pb-8 pt-2.5">
        <View className="flex-row flex-wrap gap-2">
          {FRAMES.map((f) => (
            <Chip key={f} label={f} selected={frame === f} selectedGround="ink" onPress={() => setFrame(f)} />
          ))}
        </View>
      </View>
    </View>
  );
}

/** The 3-column grid every closet-full state shares, plus a live "+ Add" tile. */
function Grid({ uris, highlightFirst }: { uris: string[]; highlightFirst?: boolean }) {
  const theme = useTheme();
  return (
    <View className="mt-4 flex-row flex-wrap px-gutter" style={{ gap: 8 }}>
      {uris.map((uri, i) => (
        <View
          key={i}
          className="overflow-hidden rounded-[10px] bg-tray"
          style={{
            width: '31%',
            aspectRatio: 1,
            borderWidth: highlightFirst && i === 0 ? 2 : 0,
            borderColor: theme.accent,
          }}>
          <Image source={{ uri }} contentFit="cover" style={{ flex: 1 }} accessibilityIgnoresInvertColors />
        </View>
      ))}
      <View
        className="items-center justify-center rounded-[10px] border border-dashed border-rule-strong"
        style={{ width: '31%', aspectRatio: 1 }}>
        <Text variant="label" style={{ color: theme.faint }}>
          + Add
        </Text>
      </View>
    </View>
  );
}

/** W-01 — the closet at 10 of 10, full read as a stated count, never a disabled control. */
function W01() {
  const theme = useTheme();
  const today = countOutfits(THE_TEN);
  return (
    <View className="flex-1">
      <View className="flex-row items-baseline justify-between px-gutter pt-2">
        <Text variant="title" trim style={{ fontSize: 34 }}>
          Closet
        </Text>
        <Text
          variant="caption"
          style={{ fontFamily: 'ui-monospace', letterSpacing: 0.4, color: theme.faint }}>
          10 OF 10 · FULL
        </Text>
      </View>
      <Text variant="body" className="mt-2 px-gutter" style={{ color: theme.muted }}>
        {`Ten pieces, ${today} outfits. Adding an eleventh needs a larger closet or a piece put away.`}
      </Text>
      <Grid uris={TEN_GRID} />
      <View className="mt-auto border-t border-rule px-gutter pb-8 pt-3.5">
        <Text
          variant="caption"
          style={{ fontFamily: 'ui-monospace', letterSpacing: 0.4, color: theme.faint }}>
          {`${today} OUTFITS · 10 PIECES`}
        </Text>
      </View>
    </View>
  );
}

/** W-02 — the camera path. Dark stage; the shutter is never disabled. */
function W02() {
  const theme = useTheme();
  const [sheetOpen, setSheetOpen] = useState(true);
  const today = countOutfits(THE_TEN);
  const best = rankGaps(THE_TEN)[0];

  return (
    <View className="flex-1">
      <View className="mx-4 mt-2 flex-1 items-center justify-center rounded-plate bg-black/40" />
      <ClosetFullSheet
        visible={sheetOpen}
        eyebrow="Before you shoot · closet full"
        title="Your closet is full at 10."
        body={`Your 10 pieces make ${today} outfits today. The right ${ordinal(11)} piece could take that as high as ${best.total}. Nothing is taken or lost by waiting.`}
        onSeePlans={() => {}}
        secondaryLabel="Make room for it"
        onSecondary={() => {}}
        tertiaryLabel="Not now"
        onDismiss={() => setSheetOpen(false)}
      />
      {!sheetOpen ? (
        <View className="absolute bottom-24 left-0 right-0 items-center">
          <Text variant="label" style={{ color: theme.canvas }} onPress={() => setSheetOpen(true)}>
            Reopen the sheet
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** W-03 — the listing-link path. The import is held, never cancelled. */
function W03() {
  const theme = useTheme();
  const [sheetOpen, setSheetOpen] = useState(true);
  const today = countOutfits(THE_TEN);
  const best = rankGaps(THE_TEN)[0];

  return (
    <View className="flex-1">
      <View className="px-gutter pt-2">
        <View className="flex-row items-center justify-between">
          <Text variant="title" trim style={{ fontSize: 26 }}>
            Add from a link
          </Text>
          <Text variant="body" style={{ color: theme.muted }}>
            Cancel
          </Text>
        </View>
        <View className="mt-3.5 rounded-xl border border-rule px-3 py-3">
          <Text variant="caption" style={{ fontFamily: 'ui-monospace', color: theme.muted }}>
            https://…/black-leather-ankle-boot
          </Text>
        </View>
        <View className="mt-3.5 flex-row items-center gap-3 rounded-[14px] border border-rule bg-surface p-3">
          <View className="h-[72px] w-[72px] overflow-hidden rounded-[10px] bg-tray">
            <Image source={{ uri: LOAFERS }} contentFit="cover" style={{ flex: 1 }} accessibilityIgnoresInvertColors />
          </View>
          <View className="flex-1">
            <Text variant="label" style={{ color: theme.ink }}>
              Black leather ankle boot
            </Text>
            <Text variant="caption" className="mt-0.5">
              Read from the listing · shoes
            </Text>
          </View>
        </View>
      </View>

      <View className="mt-auto">
        <ClosetFullSheet
          visible={sheetOpen}
          eyebrow="Ready to import · closet full"
          title="This is the piece your closet is missing."
          body={`The right ${ordinal(11)} piece could take you from ${today} outfits to ${best.total} — the largest gain of anything you could add. Your ten are already at ten.`}
          onSeePlans={() => {}}
          secondaryLabel="Make room for it"
          onSecondary={() => {}}
          onDismiss={() => setSheetOpen(false)}
        />
        <Text variant="caption" className="px-gutter pb-6" style={{ color: theme.faint }}>
          The import is held, not cancelled. It's here when there's room.
        </Text>
      </View>
    </View>
  );
}

type Piece = { name: string; uri: string };

/** W-04's own three candidates, real wear data standing in for real history. */
const CANDIDATES: SwapCandidate<Piece>[] = [
  { id: 'skirt', kind: 'bottoms', wearCount: 0, outfitCount: 4, piece: { name: 'Beige corduroy skirt', uri: SKIRT } },
  { id: 'sweater', kind: 'tops', wearCount: 1, outfitCount: 4, piece: { name: 'Cream mohair jumper', uri: SWEATER } },
  { id: 'coat', kind: null, wearCount: 3, outfitCount: 8, piece: { name: 'Cognac shearling coat', uri: COAT } },
];

function wornLabel(count: number): string {
  if (count === 0) return 'NEVER WORN';
  if (count === 1) return 'WORN ONCE';
  return `WORN ${count}×`;
}

/** W-04 — making room. Least-worn first, real recount per candidate. */
function W04() {
  const theme = useTheme();
  const ranked = rankSwapCandidates(THE_TEN, 'shoes', CANDIDATES);
  const [selectedId, setSelectedId] = useState(ranked[0]?.id);
  const selected = ranked.find((c) => c.id === selectedId) ?? ranked[0];

  return (
    <View className="flex-1">
      <Text variant="title" trim className="px-gutter pt-2" style={{ fontSize: 30 }}>
        Which piece goes away?
      </Text>
      <Text variant="body" className="mt-2 px-gutter" style={{ color: theme.muted }}>
        Stored pieces leave your styling, not your account. Least-worn first — the numbers are
        your own.
      </Text>

      <View className="mt-4 px-gutter" style={{ gap: 8 }}>
        {ranked.map((c) => {
          const isSelected = c.id === selected?.id;
          return (
            <View
              key={c.id}
              className="flex-row items-center gap-3 rounded-[14px] bg-surface px-3 py-2.5"
              style={{ borderWidth: isSelected ? 2 : 1, borderColor: isSelected ? theme.accent : theme.rule }}>
              <View className="h-[60px] w-[60px] overflow-hidden rounded-lg bg-tray">
                <Image source={{ uri: c.piece.uri }} contentFit="cover" style={{ flex: 1 }} accessibilityIgnoresInvertColors />
              </View>
              <View className="flex-1">
                <Text variant="label" style={{ color: theme.ink }}>
                  {c.piece.name}
                </Text>
                <Text
                  variant="caption"
                  className="mt-0.5"
                  style={{ fontFamily: 'ui-monospace', fontSize: 11, letterSpacing: 0.4, color: theme.faint }}>
                  {`${wornLabel(c.wearCount)} · IN ${c.outfitCount} OUTFITS`}
                </Text>
              </View>
              <Text
                variant="label"
                style={{ fontSize: 14, color: isSelected ? theme.accent : theme.muted }}
                onPress={() => setSelectedId(c.id)}>
                Store
              </Text>
            </View>
          );
        })}
      </View>

      {selected ? (
        <View className="mt-auto border-t border-rule bg-surface px-gutter pb-8 pt-4">
          <View className="flex-row items-baseline justify-between">
            <Text variant="body" style={{ color: theme.muted }}>
              {selected.kind ? `${selected.piece.name} out, boots in` : `${selected.piece.name} stored, boots in`}
            </Text>
            <Text variant="title" trim style={{ fontSize: 24 }}>
              {`${selected.outcome.from} → ${selected.outcome.swapped}`}
            </Text>
          </View>
          <Text variant="caption" className="mt-1.5" style={{ color: theme.faint }}>
            {selected.outcome.costOfSwap > 0
              ? `${selected.outcome.swapped - selected.outcome.from} more than you have now, ${selected.outcome.costOfSwap} fewer than keeping both. Storing is reversible at any time.`
              : `${selected.outcome.swapped - selected.outcome.from} more than you have now — storing this costs the count nothing. Storing is reversible at any time.`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** W-05 — after upgrading, the counter stops saying "of 10" entirely. */
function W05() {
  const theme = useTheme();
  const eleven: Tally = { ...THE_TEN, shoes: THE_TEN.shoes + 1 };
  const before = countOutfits(THE_TEN);
  const after = countOutfits(eleven);

  return (
    <View className="flex-1">
      <View className="flex-row items-baseline justify-between px-gutter pt-2">
        <Text variant="title" trim style={{ fontSize: 34 }}>
          Closet
        </Text>
        <Text
          variant="caption"
          style={{ fontFamily: 'ui-monospace', letterSpacing: 0.4, color: theme.faint }}>
          11 PIECES
        </Text>
      </View>
      <Text variant="body" className="mt-2 px-gutter" style={{ color: theme.muted }}>
        Room for the rest of your wardrobe. Photograph as much or as little as you like — the more
        Cinch sees, the better the mornings get.
      </Text>
      <Grid uris={[BOOTS, ...TEN_GRID]} highlightFirst />
      <View className="mt-auto px-gutter pb-8">
        <View className="rounded-[16px] border border-rule bg-surface px-4 py-4">
          <Text
            variant="caption"
            className="mb-1"
            style={{ fontFamily: 'ui-monospace', letterSpacing: 0.4, color: theme.faint }}>
            The boots are in
          </Text>
          <Text variant="title" trim style={{ fontSize: 26 }}>
            {`Eleven pieces. ${after} outfits.`}
          </Text>
          <Text variant="body" className="mt-1.5" style={{ color: theme.muted }}>
            {`${after - before} of them are new this morning.`}
          </Text>
        </View>
      </View>
    </View>
  );
}
