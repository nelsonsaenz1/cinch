import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GarmentImage } from '@/components/media/garment-image';
import { GarmentSwatch } from '@/components/media/garment-swatch';
import { Button, EmptyState, ErrorState, ScreenHeader, Text } from '@/components/ui';
import { nounWithArticle } from '@/features/closet/gap-feed';
import { useArchiveItems } from '@/features/closet/storage';
import { swapCostLine, swapDeltaLine } from '@/features/closet/swap';
import { useSwap } from '@/features/closet/use-swap';
import { COUNTED_KINDS, type CountedKind } from '@/features/closet/outfit-count';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * W-04 — making room. The free path through a full closet, fully built.
 *
 * Delete is deliberately not on this screen — it lives in item detail, where
 * it can be spelled out. Storing is explicitly reversible, and this screen
 * says so in its own body copy rather than only in the storage feature's.
 */
export default function WallSwapScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { add: rawAdd } = useLocalSearchParams<{ add?: string }>();
  const add: CountedKind = (COUNTED_KINDS as readonly string[]).includes(rawAdd ?? '')
    ? (rawAdd as CountedKind)
    : 'shoes';

  const model = useSwap(add);
  const archive = useArchiveItems();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  /**
   * The confirmation bar is absolute and opaque, and its real height moves with
   * the piece's name, the outcome copy and the reader's type size — so the list
   * reserves what the bar actually measures, not a guessed padding. 160 is the
   * bar at its shortest, used only for the first frame.
   */
  const [footerHeight, setFooterHeight] = useState(160);

  const candidates = model.candidates;
  const selected = candidates.find((c) => c.id === selectedId) ?? candidates[0];

  const store = () => {
    if (!selected) return;
    setBusyId(selected.id);
    archive.mutate(
      { ids: [selected.id] },
      {
        onSuccess: () => router.back(),
        onError: (err) =>
          Alert.alert(
            "Couldn’t store that piece",
            err instanceof Error ? err.message : 'Something went wrong. Try again.',
          ),
        onSettled: () => setBusyId(null),
      },
    );
  };

  let body: React.ReactNode;

  if (model.error) {
    body = (
      <ErrorState
        title="Couldn’t read your closet"
        body="Check your connection and try again."
      />
    );
  } else if (model.loading) {
    body = (
      <View className="flex-1 items-center justify-center">
        <Text variant="label">Reading your closet…</Text>
      </View>
    );
  } else if (candidates.length === 0) {
    body = (
      <EmptyState
        symbol="archivebox"
        title="Nothing to store"
        body="There’s nothing in your closet that would make room right now."
      />
    );
  } else {
    body = (
      <ScrollView
        contentContainerClassName="px-gutter"
        contentContainerStyle={{ paddingBottom: footerHeight }}>
        <Text variant="title" trim style={{ fontSize: 30, lineHeight: 34 }}>
          Which piece goes away?
        </Text>
        <Text variant="body" className="mt-2" style={{ color: theme.muted }}>
          Stored pieces leave your styling, not your account. Least-worn first — the numbers are
          your own.
        </Text>

        <View className="mt-4" style={{ gap: 8 }}>
          {candidates.map((c) => {
            const isSelected = c.id === selected?.id;
            return (
              <View
                key={c.id}
                className="flex-row items-center gap-3 rounded-md bg-surface px-3 py-2.5"
                style={{ borderWidth: isSelected ? 2 : 1, borderColor: isSelected ? theme.accent : theme.rule }}>
                {/* AUDIT 2026-09-02 · 48/62. This was `{uri ? <Image/> : null}`
                    over a bare tray square, straight through `expo-image` —
                    the one owned-garment well in the app that never adopted the
                    shared primitive, so a signature that expired and a piece
                    with no render both drew nothing at all. It goes through
                    `GarmentImage` now, and its fallback is the garment's own
                    colour, which is half of telling two "Black t-shirt" rows
                    apart. No caption in a 60pt square: the name is already
                    beside it, at a size that can be read. */}
                <View className="h-[60px] w-[60px] overflow-hidden rounded-lg bg-tray">
                  <GarmentImage
                    uri={c.piece.imageUri}
                    recyclingKey={c.piece.id}
                    contentFit="contain"
                    transition={180}
                    fallback={<GarmentSwatch label={null} hex={c.piece.hex} />}
                  />
                </View>
                <View className="flex-1">
                  <Text variant="label" numberOfLines={1} style={{ color: theme.ink }}>
                    {c.piece.name}
                  </Text>
                  <Text
                    variant="caption"
                    className="mt-0.5"
                    style={{ fontFamily: 'HelveticaNeue', fontSize: 11, letterSpacing: 0.4, color: theme.muted }}>
                    {`${wornLabel(c.wearCount)} · IN ${c.outfitCount} ${c.outfitCount === 1 ? 'OUTFIT' : 'OUTFITS'}`}
                  </Text>
                  {/* The other half of the duplicate-row guard: the brand, or
                      the month the piece was added. `pieceName` is colour +
                      subcategory, so three black t-shirts are three rows
                      reading "Black t-shirt" — and least-worn-first ranking
                      clusters the never-worn ones, so the identical rows land
                      next to each other. Absent rather than filled when the row
                      carries neither: an invented distinguisher would be worse
                      than two rows that genuinely match. */}
                  {c.piece.detail ? (
                    <Text variant="caption" numberOfLines={1} className="mt-0.5" style={{ color: theme.muted }}>
                      {c.piece.detail}
                    </Text>
                  ) : null}
                </View>
                <RowSelect
                  selected={isSelected}
                  label={`Choose ${c.piece.name} to store`}
                  onPress={() => setSelectedId(c.id)}
                />
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader title="Make room" onBack={() => router.back()} />
      {body}

      {selected ? (
        <View
          className="absolute inset-x-0 bottom-0 border-t border-rule bg-surface px-gutter pb-8 pt-4"
          style={{ paddingBottom: 34 }}
          onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}>
          {/* ── AUDIT 2026-09-02 · 48 · TWO ROWS, NOT ONE DENSE SENTENCE ──
              The bar used to carry a wrapping sentence beside a pair of figures
              and then, under both, a three-clause caption assembled from a
              nested ternary: "9 fewer than you have now, 9 fewer than keeping
              both. Storing is reversible at any time." A reader deciding which
              garment to put away had to parse two different baselines out of
              one run of 11pt muted type.

              ROW ONE is the outgoing item. ROW TWO is the capacity it buys,
              with the two figures and the delta on one line. Then the action,
              then the standing fact about storing — which was never about this
              swap and should not have been inside the sentence that was.

              Both clauses are `swapDeltaLine` / `swapCostLine` in
              `features/closet/swap.ts`: beside the arithmetic they describe,
              and where `tests/swap.test.ts` can run them. */}
          <View className="flex-row items-baseline justify-between gap-x-3">
            <Text variant="eyebrow" className="flex-none">
              Storing
            </Text>
            {/* The garment name is the user's own and can be long; it wraps
                rather than truncating — the C-01 rule. */}
            <Text variant="label" className="flex-1 text-right" style={{ color: theme.ink }}>
              {selected.piece.name}
            </Text>
          </View>

          <View className="mt-1.5 flex-row items-baseline justify-between gap-x-3">
            <Text variant="body" style={{ color: theme.muted, flexShrink: 1 }}>
              {`Room for ${nounWithArticle(add)} · ${swapDeltaLine(selected.outcome)}`}
            </Text>
            {/* The figures never give an inch. */}
            <Text variant="title" trim className="flex-none" style={{ fontSize: 24 }}>
              {`${selected.outcome.from} → ${selected.outcome.swapped}`}
            </Text>
          </View>

          {swapCostLine(selected.outcome) ? (
            <Text variant="caption" className="mt-1" style={{ color: theme.muted }}>
              {swapCostLine(selected.outcome)}
            </Text>
          ) : null}

          <Button
            title={`Store ${selected.piece.name}`}
            variant="primary"
            className="mt-3"
            loading={busyId === selected.id}
            onPress={store}
          />

          {/* A standing fact about storing, under the action it qualifies —
              not a clause inside the sentence about this particular swap. */}
          <Text variant="caption" className="mt-2" style={{ color: theme.muted }}>
            Storing is reversible at any time.
          </Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

/**
 * "NEVER WORN", "WORN ONCE", "WORN 3×" — the atlas's exact three forms
 * (W-04), read off `items.wear_count`, the same column the closet grid and
 * item detail already quote. Deliberately not `wearsLabel` from
 * `item-name.ts`: that helper's "0 wears" is honest but not what this atlas
 * says at zero, and the two screens are allowed to differ in register (one is
 * a caption under a thumbnail, the other is a warning about what storing this
 * piece would do).
 */
function wornLabel(count: number): string {
  if (count === 0) return 'NEVER WORN';
  if (count === 1) return 'WORN ONCE';
  return `WORN ${count}×`;
}

/**
 * The row-level pick — oxblood for the current choice, muted otherwise.
 *
 * AUDIT 2026-09-02 · 48 · "keep the CTA clear". Its visible word was "Store",
 * which is also the word on the primary button at the foot of the screen: N
 * controls reading Store, of which exactly one stores anything and the rest
 * merely select. The accessible label always disambiguated ("Choose … to
 * store"); the drawn word now agrees with it, and the only control that says
 * Store is the one that does it.
 */
function RowSelect({ selected, label, onPress }: { selected: boolean; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      hitSlop={{ top: (MIN_TAP_TARGET - 20) / 2, bottom: (MIN_TAP_TARGET - 20) / 2, left: 8, right: 8 }}
      className="active:opacity-60">
      <Text variant="label" style={{ fontSize: 14, color: selected ? theme.accent : theme.muted }}>
        {selected ? 'Chosen' : 'Choose'}
      </Text>
    </Pressable>
  );
}
