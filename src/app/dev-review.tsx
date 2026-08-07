import { useAssets } from 'expo-asset';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Notice } from '@/components/ui/notice';
import { Text } from '@/components/ui/text';
import { ReviewCard } from '@/components/review/review-card';
import { describeGaps, gapsFor, noteGaps, partitionGaps } from '@/features/ingest/tag-gaps';
import type { Item, ItemCategory } from '@/schemas/item';

/**
 * Review fixture — `cinch://dev-review`.
 *
 * Mirrors `review.tsx` exactly — the Close/Done header, the colophon ordinal
 * with ink pips, the undo line, the gap invitation, a real three-card stack —
 * with no query, no mutation, no auth. The three mock garments are chosen to
 * walk the atlas's states in order: a settled spec sheet (R-01), a card with
 * an askable hole and an admitted one (R-02), and a third underneath so the
 * stack's 4%-smaller / 6pt-lower peek is visible (R-01's mounts). Confirming
 * and skipping work locally, so R-07's undo line and R-12's skip-aware ending
 * are reachable too.
 *
 * Dev-only, like dev-closet and dev-screens: __DEV__-gated in the auth gate.
 */
const BASE: Omit<Item, 'id' | 'category' | 'subcategory' | 'colors' | 'material' | 'pattern' | 'brand' | 'status'> = {
  userId: 'dev-user',
  imagePath: null,
  cutoutPath: null,
  platePath: null,
  thumbPath: null,
  formalityScore: 3,
  warmthScore: 3,
  waterResistant: false,
  fit: 'regular',
  patternScale: 'none',
  seasons: ['fall', 'winter'],
  occasions: ['casual'],
  description: null,
  purchasePrice: null,
  purchaseDate: null,
  wearCount: 0,
  lastWornAt: null,
  isArchived: false,
  isForSale: false,
  userVerified: false,
  createdAt: new Date(2026, 6, 20).toISOString(),
};

/** The deck, in atlas order: settled, holed, and one more to give the stack depth. */
const MOCK_ITEMS: Item[] = [
  {
    ...BASE,
    id: 'dev-review-cream-knit',
    status: 'tagged',
    category: 'top',
    subcategory: 'Knitwear',
    colors: [
      { hex: '#EDE4D3', name: 'Cream' },
      { hex: '#D8CBB4', name: 'Oat' },
    ],
    material: 'Mohair blend',
    pattern: 'Solid',
    brand: 'Arket',
  },
  {
    ...BASE,
    id: 'dev-review-corduroy-skirt',
    // The tagger reached for the catch-all and never named a brand — R-02's
    // exact pair of holes: category asked about above the deck, brand admitted
    // below the rows.
    status: 'tagged',
    category: 'other',
    subcategory: null,
    colors: [{ hex: '#C9B394', name: 'Sand' }],
    material: 'Corduroy',
    pattern: null,
    brand: null,
  },
  {
    ...BASE,
    id: 'dev-review-shearling-coat',
    status: 'tagged',
    category: 'outerwear',
    subcategory: 'Shearling coat',
    colors: [
      { hex: '#A9683A', name: 'Cognac' },
      { hex: '#C89B6C', name: 'Tan' },
    ],
    material: 'Shearling',
    pattern: null,
    brand: 'Acne Studios',
  },
];

const PLATES = [
  require('@/assets/plates/plate-01-knit.svg'),
  require('@/assets/plates/plate-01-trousers.svg'),
  require('@/assets/plates/plate-01-coat.svg'),
];

export default function DevReviewScreen() {
  /**
   * Downloaded `localUri`s, not `Asset.fromModule(...).uri`. The Metro dev
   * server addresses every asset at the same path with the file named only in
   * the query string, and `stableImageSource` keys expo-image's cache on the
   * path alone (the query is where a signed URL keeps its volatile token) — so
   * three module URIs collapsed to one cache entry and every card drew the
   * same plate. The downloaded copies live at three distinct file:// paths.
   */
  const [plates] = useAssets(PLATES);
  const plateUris = plates?.map((a) => a.localUri ?? a.uri);

  const [edits, setEdits] = useState<
    Record<string, { category: ItemCategory; occasions: string[]; price: number | null }>
  >({});
  const [resolvedIds, setResolvedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [skippedCount, setSkippedCount] = useState(0);
  const [undoItem, setUndoItem] = useState<Item | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const deck = MOCK_ITEMS.filter((it) => !resolvedIds.has(it.id));
  const done = deck.length === 0;
  const total = MOCK_ITEMS.length;
  const current = total - deck.length;

  const clearUndo = () => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = null;
    setUndoItem(null);
  };

  const resolve = (id: string) =>
    setResolvedIds((prev) => new Set(prev).add(id));

  const confirm = (item: Item) => {
    clearUndo();
    resolve(item.id);
    setUndoItem(item);
    undoTimer.current = setTimeout(() => {
      undoTimer.current = null;
      setUndoItem(null);
    }, 5_000);
  };

  const skip = (item: Item) => {
    clearUndo();
    setSkippedCount((n) => n + 1);
    resolve(item.id);
  };

  const undoConfirm = (item: Item) => {
    clearUndo();
    setResolvedIds((prev) => {
      const next = new Set(prev);
      next.delete(item.id);
      return next;
    });
  };

  const top = deck[0];
  const { askable } = partitionGaps(top ? gapsFor(top) : []);
  const gapLine = askable.length
    ? `Cinch wasn’t sure about ${describeGaps(askable)} — set it below, or skip.`
    : null;

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark">
      <View className="flex-row items-center justify-end px-gutter pt-2">
        <Button title={done ? 'Done' : 'Close'} variant="ghost" onPress={() => {}} />
      </View>

      {!done ? (
        <View className="flex-row items-center justify-between px-gutter pb-1 pt-1">
          <Text variant="colophon">
            Review · {Math.min(current + 1, total)} of {total}
          </Text>
          {/* Ink, not accent — the pip is a position marker, and the accent on
              this screen is spent on Edit (see review.tsx). */}
          <View className="flex-row items-center gap-1">
            {Array.from({ length: total }).map((_, i) => (
              <View
                key={i}
                className={`h-1 rounded-full ${i === current ? 'bg-ink dark:bg-ink-dark' : 'bg-sand dark:bg-sand-dark'}`}
                style={{ flex: 1, maxWidth: 16 }}
              />
            ))}
          </View>
        </View>
      ) : null}

      {undoItem ? (
        <Notice
          message="Confirmed."
          tone="neutral"
          className="px-gutter pb-1 pt-1"
          action={{ label: 'Undo', onPress: () => undoConfirm(undoItem) }}
        />
      ) : null}

      {!done && gapLine ? (
        <View className="px-gutter pb-1 pt-1">
          <Text variant="caption">{gapLine}</Text>
        </View>
      ) : null}

      {done ? (
        <EmptyState
          symbol="checkmark.circle"
          title="All caught up"
          body={
            skippedCount > 0
              ? `Confirmed pieces are ready to wear. The ${skippedCount} you skipped will be waiting next time.`
              : 'These are ready to wear.'
          }
          actionTitle="Back to closet"
          onAction={() => {
            setResolvedIds(new Set());
            setSkippedCount(0);
          }}
        />
      ) : (
        <View className="flex-1">
          {deck
            .slice(0, 3)
            .map((item, offset) => {
              const plateUri = plateUris?.[MOCK_ITEMS.findIndex((m) => m.id === item.id)];
              const edit = edits[item.id] ?? {
                category: item.category,
                occasions: item.occasions,
                price: item.purchasePrice,
              };
              return (
                <ReviewCard
                  key={item.id}
                  item={item}
                  imageUri={plateUri}
                  gapNote={noteGaps(partitionGaps(gapsFor(item)).unfixable)}
                  isTop={offset === 0}
                  depth={offset}
                  category={edit.category}
                  occasions={edit.occasions}
                  price={edit.price}
                  onEditPrice={(next) =>
                    setEdits((prev) => ({ ...prev, [item.id]: { ...edit, price: next } }))
                  }
                  onEditCategory={(next) =>
                    setEdits((prev) => ({ ...prev, [item.id]: { ...edit, category: next } }))
                  }
                  onToggleOccasion={(occ) =>
                    setEdits((prev) => {
                      const cur = prev[item.id]?.occasions ?? item.occasions;
                      const nextList = cur.includes(occ)
                        ? cur.filter((o) => o !== occ)
                        : [...cur, occ];
                      return { ...prev, [item.id]: { ...edit, occasions: nextList } };
                    })
                  }
                  onConfirm={() => confirm(item)}
                  onSkip={() => skip(item)}
                />
              );
            })
            .reverse()}
        </View>
      )}
    </SafeAreaView>
  );
}
