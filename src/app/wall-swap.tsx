import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, EmptyState, ErrorState, ScreenHeader, Text } from '@/components/ui';
import { nounWithArticle } from '@/features/closet/gap-feed';
import { useArchiveItems } from '@/features/closet/storage';
import { useSwap } from '@/features/closet/use-swap';
import { COUNTED_KINDS, type CountedKind } from '@/features/closet/outfit-count';
import { stableImageSource } from '@/features/closet/use-image-urls';
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
            "Couldn't store that piece",
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
        title="Couldn't read your closet"
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
        body="There's nothing in your closet that would make room right now."
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
                <View className="h-[60px] w-[60px] overflow-hidden rounded-lg bg-tray">
                  {c.piece.imageUri ? (
                    <Image
                      source={stableImageSource(c.piece.imageUri)}
                      contentFit="contain"
                      style={{ flex: 1, padding: 4 }}
                      cachePolicy="memory-disk"
                      accessibilityIgnoresInvertColors
                    />
                  ) : null}
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
          <View className="flex-row items-baseline justify-between gap-x-3">
            {/* The garment name is the user's own and can be long; the sentence
                wraps rather than colliding with the figures (never truncated —
                the C-01 rule), and the figures never give an inch. */}
            <Text variant="body" style={{ color: theme.muted, flexShrink: 1 }}>
              {`${selected.piece.name} out, room for ${nounWithArticle(add)}`}
            </Text>
            <Text variant="title" trim className="flex-none" style={{ fontSize: 24 }}>
              {`${selected.outcome.from} → ${selected.outcome.swapped}`}
            </Text>
          </View>
          <Text variant="caption" className="mt-1.5" style={{ color: theme.muted }}>
            {selected.outcome.swapped > selected.outcome.from
              ? `${selected.outcome.swapped - selected.outcome.from} more than you have now`
              : selected.outcome.swapped === selected.outcome.from
                ? 'The same as you have now'
                : `${selected.outcome.from - selected.outcome.swapped} fewer than you have now`}
            {selected.outcome.costOfSwap > 0
              ? `, ${selected.outcome.costOfSwap} fewer than keeping both. Storing is reversible at any time.`
              : '. Storing is reversible at any time.'}
          </Text>
          <Button
            title={`Store ${selected.piece.name}`}
            variant="primary"
            className="mt-3"
            loading={busyId === selected.id}
            onPress={store}
          />
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

/** The row-level "Store" pick — oxblood for the current choice, muted otherwise. */
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
        Store
      </Text>
    </Pressable>
  );
}
