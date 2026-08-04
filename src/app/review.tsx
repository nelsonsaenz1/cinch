import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';
import { ReviewCard } from '@/components/review/review-card';
import { useReviewQueue } from '@/features/closet/queries';
import { useVerifyItem } from '@/features/closet/mutations';
import type { ItemCategory } from '@/schemas/item';

/**
 * The tag-review deck.
 *
 * Target interaction cost: under 2 seconds per item. Common case is one
 * gesture — a right-swipe accepts the AI's guess as-is. Corrections are chip
 * toggles, never a picker or a text field.
 */
export default function ReviewScreen() {
  const router = useRouter();
  const query = useReviewQueue();
  const verify = useVerifyItem();

  const items = useMemo(() => query.data ?? [], [query.data]);

  // Pointer into the queue. Increment on both confirm and skip so the deck
  // always advances — a skipped item stays user_verified=false and shows up
  // again on the next visit, no wasted round-trip.
  const [cursor, setCursor] = useState(0);

  // Local per-card edits. Re-derived when the queue changes so late arrivals
  // (background tagging finishing while the deck is open) come in with the
  // model's own suggestions rather than a stale copy.
  const [edits, setEdits] = useState<
    Record<string, { category: ItemCategory; occasions: string[] }>
  >({});

  const advanceLockRef = useRef(false);

  useEffect(() => {
    // Reset cursor if a refetch shrinks the queue past our position.
    if (cursor >= items.length && items.length > 0) setCursor(0);
  }, [items.length, cursor]);

  const commit = async (skip = false) => {
    if (advanceLockRef.current) return;
    const current = items[cursor];
    if (!current) return;
    advanceLockRef.current = true;

    // Advance the visible deck first so the animation isn't waiting on the
    // network — mutation happens in the background.
    setCursor((c) => c + 1);

    if (!skip) {
      const edit = edits[current.id];
      const patch =
        edit &&
        (edit.category !== current.category ||
          JSON.stringify(edit.occasions) !== JSON.stringify(current.occasions))
          ? { category: edit.category, occasions: edit.occasions }
          : undefined;
      try {
        await verify.mutateAsync({ id: current.id, patch });
      } catch {
        // Errors surface via query invalidation on next fetch; the deck already
        // moved on. A batched retry lives further down the roadmap.
      }
    }

    // Release the lock after the swipe animation would complete.
    setTimeout(() => {
      advanceLockRef.current = false;
    }, 220);
  };

  if (query.isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas dark:bg-canvas-dark">
        <Text variant="body">Loading…</Text>
      </SafeAreaView>
    );
  }

  const done = cursor >= items.length;
  const remaining = Math.max(items.length - cursor, 0);

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark">
      <View className="flex-row items-center justify-between px-gutter pt-2">
        <View>
          <Text variant="heading">Review tags</Text>
          {!done ? (
            <Text variant="label" className="mt-0.5">
              {remaining} left
            </Text>
          ) : null}
        </View>
        <Button title={done ? 'Done' : 'Close'} variant="ghost" onPress={() => router.back()} />
      </View>

      {done ? (
        <EmptyState
          symbol="checkmark.circle"
          title={items.length === 0 ? 'Nothing to review' : 'All caught up'}
          body={
            items.length === 0
              ? 'After an import lands, confirm or correct what Cinch guessed. One tap per piece.'
              : 'These are ready to wear.'
          }
          actionTitle="Back to closet"
          onAction={() => router.replace('/(tabs)/closet')}
        />
      ) : (
        <View className="flex-1">
          {/*
            Render up to three cards. The top one is interactive; the two
            beneath peek out below and give the stack physical weight without
            costing render time on the whole queue.
          */}
          {items
            .slice(cursor, cursor + 3)
            .map((item, offset) => {
              const isTop = offset === 0;
              const edit = edits[item.id] ?? {
                category: item.category,
                occasions: item.occasions,
              };
              return (
                <ReviewCard
                  // Include cursor in the key so React tears down and rebuilds
                  // the top card when the deck advances — otherwise the
                  // translateX shared value keeps its previous end position.
                  key={`${item.id}-${cursor}-${offset}`}
                  item={item}
                  isTop={isTop}
                  depth={offset}
                  category={edit.category}
                  occasions={edit.occasions}
                  onEditCategory={(next) =>
                    setEdits((prev) => ({
                      ...prev,
                      [item.id]: { ...edit, category: next },
                    }))
                  }
                  onToggleOccasion={(occ) =>
                    setEdits((prev) => {
                      const current = prev[item.id]?.occasions ?? item.occasions;
                      const nextList = current.includes(occ)
                        ? current.filter((o) => o !== occ)
                        : [...current, occ];
                      return { ...prev, [item.id]: { ...edit, occasions: nextList } };
                    })
                  }
                  onConfirm={() => void commit(false)}
                />
              );
            })
            // Render bottom cards first so the topmost is drawn last (on top
            // of its stack). RN's flat rendering order doesn't respect
            // depth-in-array otherwise.
            .reverse()}
        </View>
      )}
    </SafeAreaView>
  );
}
