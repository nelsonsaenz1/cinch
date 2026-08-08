import { Asset } from 'expo-asset';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GapCard } from '@/components/gap-feed/gap-card';
import { ClosetFullSheet } from '@/components/wall/closet-full-sheet';
import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import {
  corePreviewRows,
  dominantGaps,
  gapLabel,
  gapLabelLower,
  ordinal,
  pairablePieces,
  swapAdvice,
  type PairablePiece,
} from '@/features/closet/gap-feed';
import { rankGaps, type CountedKind, type Tally } from '@/features/closet/outfit-count';

/**
 * The Gap Feed fixture — `cinch://dev-gap-feed`.
 *
 * Renders G-01 through G-05 from hand-built fixtures against the SAME
 * components the real `/gap-feed` route uses (`GapCard`, `ClosetFullSheet`),
 * so nothing here can visually drift from what a signed-in closet renders.
 * Dev-only, like every other `dev-` route — see dev-item.tsx.
 */

const BLOUSE = Asset.fromModule(require('@/assets/garments/white-linen-blouse.jpg')).uri;
const SWEATER = Asset.fromModule(require('@/assets/garments/cream-mohair-sweater.jpg')).uri;
const PONCHO = Asset.fromModule(require('@/assets/garments/cream-crochet-poncho.jpg')).uri;
const TROUSERS = Asset.fromModule(require('@/assets/garments/charcoal-tailored-trousers.jpg')).uri;
const SKIRT = Asset.fromModule(require('@/assets/garments/beige-corduroy-skirt.jpg')).uri;
const LOAFERS = Asset.fromModule(require('@/assets/garments/brown-leather-loafers.jpg')).uri;
const BOOTS = Asset.fromModule(require('@/assets/garments/brown-leather-boots.jpg')).uri;

type Piece = { id: string; kind: CountedKind; name: string; imageUri?: string };

/** The canonical ten's four counted kinds, real assets standing in for real photographs. */
const TEN: Piece[] = [
  { id: 'top-1', kind: 'tops', name: 'White linen blouse', imageUri: BLOUSE },
  { id: 'top-2', kind: 'tops', name: 'Cream mohair jumper', imageUri: SWEATER },
  { id: 'top-3', kind: 'tops', name: 'Cream crochet poncho', imageUri: PONCHO },
  { id: 'bottom-1', kind: 'bottoms', name: 'Charcoal tailored trousers', imageUri: TROUSERS },
  { id: 'bottom-2', kind: 'bottoms', name: 'Beige corduroy skirt', imageUri: SKIRT },
  { id: 'dress-1', kind: 'dresses', name: 'Olive slip dress' },
  { id: 'shoe-1', kind: 'shoes', name: 'Brown leather loafers', imageUri: LOAFERS },
  { id: 'shoe-2', kind: 'shoes', name: 'Brown leather boots', imageUri: BOOTS },
];
const THE_TEN: Tally = { tops: 3, bottoms: 2, dresses: 1, shoes: 2 };

/** Eight tops, one bottom, one pair of shoes — G-05's unbalanced closet. */
const UNBALANCED: Piece[] = [
  ...Array.from({ length: 8 }, (_, i) => ({
    id: `top-${i}`,
    kind: 'tops' as const,
    name: [BLOUSE, SWEATER, PONCHO][i % 3] ? `Top ${i + 1}` : `Top ${i + 1}`,
    imageUri: [BLOUSE, SWEATER, PONCHO][i % 3],
  })),
  { id: 'bottom-1', kind: 'bottoms', name: 'Beige corduroy skirt', imageUri: SKIRT },
  { id: 'shoe-1', kind: 'shoes', name: 'Brown leather loafers', imageUri: LOAFERS },
];
const EIGHT_TOPS: Tally = { tops: 8, bottoms: 1, dresses: 0, shoes: 1 };

function toPairable(pieces: Piece[]): PairablePiece<Piece>[] {
  return pieces.map((p) => ({ id: p.id, kind: p.kind, piece: p }));
}

const CAPACITY = { used: 10, limit: 10 };

const FRAMES = ['G-01', 'G-02', 'G-03', 'G-04', 'G-05'] as const;
type Frame = (typeof FRAMES)[number];

export default function DevGapFeed() {
  const [frame, setFrame] = useState<Frame>('G-01');
  const [sheetOpen, setSheetOpen] = useState(false);

  if (!__DEV__) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
        <Text variant="label">Not available.</Text>
      </SafeAreaView>
    );
  }

  const rankedTen = rankGaps(THE_TEN);
  const pairableTen = toPairable(TEN);
  const rankedUnbalanced = rankGaps(EIGHT_TOPS);
  const dominant = dominantGaps(rankedUnbalanced);
  const pairableUnbalanced = toPairable(UNBALANCED);

  return (
    <View className="flex-1 bg-canvas">
      <SafeAreaView className="flex-1" edges={['top']}>
        {frame === 'G-01' ? (
          <ScrollView contentContainerClassName="px-gutter pb-24" contentContainerStyle={{ gap: 10 }}>
            <View className="pt-2">
              <Text variant="eyebrow" className="text-faint">
                Your closet · 10 pieces · 14 outfits
              </Text>
              <Text variant="title" trim className="mt-1.5" style={{ fontSize: 30, lineHeight: 34 }}>
                What one more piece would do
              </Text>
              <Text variant="body" className="mt-2 text-muted">
                Worked out from what you own. Ranked by how many new outfits each would actually
                make.
              </Text>
            </View>
            {rankedTen.slice(0, 3).map((g) => (
              <GapCard
                key={g.kind}
                gain={g}
                tally={THE_TEN}
                pairings={pairablePieces(g.kind, pairableTen)}
                lock={CAPACITY}
                onPress={() => {}}
                onAddAnyway={() => setSheetOpen(true)}
              />
            ))}
            <Text variant="label" className="mt-2 border-t border-rule pt-4 text-muted">
              Adding an eleventh piece needs a larger closet.
            </Text>
          </ScrollView>
        ) : null}

        {frame === 'G-02' ? (
          <G02 tally={THE_TEN} ranked={rankedTen} pairable={pairableTen} />
        ) : null}

        {frame === 'G-03' ? <G03 tally={THE_TEN} ranked={rankedTen} /> : null}

        {frame === 'G-04' ? (
          <View className="flex-1 px-gutter pt-2" style={{ opacity: 0.35 }}>
            <Text variant="eyebrow" className="text-faint">
              Your closet · 10 pieces · 14 outfits
            </Text>
            <Text variant="title" trim className="mt-1.5" style={{ fontSize: 30 }}>
              What one more piece would do
            </Text>
          </View>
        ) : null}

        {frame === 'G-05' && dominant ? (
          <ScrollView contentContainerClassName="px-gutter pb-24" contentContainerStyle={{ gap: 10 }}>
            <View className="pt-2">
              <Text variant="eyebrow" className="text-faint">
                Your closet · 10 pieces · 8 outfits
              </Text>
              <Text variant="title" trim className="mt-1.5" style={{ fontSize: 30, lineHeight: 34 }}>
                One piece is doing all the work
              </Text>
              <Text variant="body" className="mt-2 text-muted">
                Nearly every outfit you have runs through the same piece.
              </Text>
            </View>
            <GapCard
              gain={dominant[0]}
              tally={EIGHT_TOPS}
              pairings={pairablePieces(dominant[0].kind, pairableUnbalanced)}
              large
              onPress={() => {}}
              onAddAnyway={() => setSheetOpen(true)}
            />
            <View className="mt-2 border-t border-rule pt-4" style={{ gap: 8 }}>
              <Text variant="label" className="text-muted">
                {swapAdvice(EIGHT_TOPS, dominant[0].kind) ?? 'Swap a top for something else'}
              </Text>
            </View>
          </ScrollView>
        ) : null}
      </SafeAreaView>

      <ClosetFullSheet
        visible={sheetOpen || frame === 'G-04'}
        eyebrow={`${gapLabelLower(THE_TEN, rankedTen[0].kind)} · +${rankedTen[0].gain} outfits`}
        title={`Your closet holds ${CAPACITY.limit}. This would be the ${ordinal(CAPACITY.limit + 1)}.`}
        body="Two ways forward, and neither loses anything you've photographed."
        onSeePlans={() => {}}
        secondaryLabel="Swap a piece out instead"
        onSecondary={() => {}}
        onDismiss={() => setSheetOpen(false)}
      />

      <View className="absolute bottom-0 left-0 right-0 border-t border-rule bg-canvas px-3 pb-8 pt-2.5">
        <View className="flex-row flex-wrap gap-2">
          {FRAMES.map((f) => (
            <Chip
              key={f}
              label={f}
              selected={frame === f}
              selectedGround="ink"
              onPress={() => {
                setFrame(f);
                setSheetOpen(false);
              }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function G02({
  tally,
  ranked,
  pairable,
}: {
  tally: Tally;
  ranked: ReturnType<typeof rankGaps>;
  pairable: PairablePiece<Piece>[];
}) {
  const gain = ranked[0];
  const byKind: Partial<Record<CountedKind, Piece[]>> = {
    tops: pairable.filter((p) => p.kind === 'tops').map((p) => p.piece),
    bottoms: pairable.filter((p) => p.kind === 'bottoms').map((p) => p.piece),
    dresses: pairable.filter((p) => p.kind === 'dresses').map((p) => p.piece),
    shoes: pairable.filter((p) => p.kind === 'shoes').map((p) => p.piece),
  };
  const rows = corePreviewRows(gain.kind, byKind, gain.gain, 3);

  return (
    <ScrollView contentContainerClassName="px-gutter pb-24">
      <Text variant="eyebrow" className="text-faint">
        {`The gap · ${gain.kind}`}
      </Text>
      <Text variant="title" trim className="mt-1.5" style={{ fontSize: 32, lineHeight: 36 }}>
        {gapLabel(tally, gain.kind)}
      </Text>
      <Text variant="body" className="mt-2 text-muted">
        {`${gain.gain} outfits you don't have yet — here are ${rows.shown.length} of them.`}
      </Text>
      <View className="mt-4" style={{ gap: 8 }}>
        {rows.shown.map((row, i) => (
          <View key={i} className="flex-row items-center gap-2 rounded-[14px] border border-rule bg-surface px-3 py-2.5">
            {row.map((p) => (
              <View key={p.id} className="h-[54px] w-[54px] overflow-hidden rounded-lg bg-tray" />
            ))}
            <View className="h-[54px] w-[54px] items-center justify-center rounded-lg border border-dashed border-accent bg-blush">
              <Text variant="caption" style={{ fontSize: 11, textAlign: 'center' }} className="text-accent">
                {`the\n${gain.kind === 'shoes' ? 'shoes' : gain.kind.slice(0, -1)}`}
              </Text>
            </View>
            <View className="flex-1 items-end">
              <Text variant="caption" className="text-muted" style={{ textAlign: 'right' }}>
                {row.map((p) => p.name).join(' & ')}
              </Text>
            </View>
          </View>
        ))}
        {rows.more > 0 ? (
          <Text variant="label" className="pl-1 text-faint">{`and ${rows.more} more`}</Text>
        ) : null}
      </View>
      <View className="mt-6 rounded-[16px] border border-rule bg-surface px-4 py-4">
        <Text variant="body" className="text-muted">
          Your closet is full at ten. Adding this needs room for an eleventh piece.
        </Text>
      </View>
    </ScrollView>
  );
}

function G03({ tally, ranked }: { tally: Tally; ranked: ReturnType<typeof rankGaps> }) {
  const gain = ranked[0];
  return (
    <View className="px-gutter pt-6">
      <Text variant="eyebrow" className="text-faint">
        Detail · the lock
      </Text>
      <Text variant="title" trim className="mt-1.5" style={{ fontSize: 26 }}>
        Legible, specific, out of reach
      </Text>
      <View className="mt-4">
        <GapCard
          gain={gain}
          tally={tally}
          pairings={{ shown: [], more: 0 }}
          lock={CAPACITY}
          onPress={() => {}}
          onAddAnyway={() => {}}
        />
      </View>
      <View className="mt-3 rounded-[16px] border border-dashed border-rule-strong bg-ink/[0.03] px-4 py-3.5">
        <Text variant="caption" style={{ fontFamily: 'ui-monospace', letterSpacing: 0.4 }} className="text-faint">
          NOT THIS
        </Text>
        <View className="mt-2 flex-row items-baseline justify-between" style={{ opacity: 0.6 }}>
          <Text variant="body" className="font-semibold">
            {gapLabel(tally, gain.kind)}
          </Text>
          <Text variant="title">{`+${gain.gain}`}</Text>
        </View>
        <Text variant="caption" className="mt-2 text-muted">
          Blur implies there is something behind it. There isn't — the whole recommendation is
          already shown.
        </Text>
      </View>
    </View>
  );
}
