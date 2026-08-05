import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { track } from '@/lib/posthog';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Text } from '@/components/ui/text';
import { ReviewCard } from '@/components/review/review-card';
import { useReviewQueue } from '@/features/closet/queries';
import { useVerifyItem } from '@/features/closet/mutations';
import type { Item, ItemCategory } from '@/schemas/item';

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

  // Local per-card edits, keyed by item id. Keyed rather than indexed so a
  // refetch that reorders or shortens the queue cannot hand one item's
  // corrections to another.
  const [edits, setEdits] = useState<
    Record<string, { category: ItemCategory; occasions: string[]; price: number | null }>
  >({});

  /**
   * Ids the user has dealt with in this sitting — confirmed OR skipped.
   *
   * This replaces the old integer cursor. An index into a list that a
   * background refetch can reorder needs a correcting effect every time the
   * queue changes, and that effect could reset the deck to zero the instant the
   * user finished it. Filtering by id is self-correcting: late arrivals append,
   * a shrinking queue is a no-op, and nothing has to be reconciled after the
   * fact.
   *
   * A SKIPPED id lives here and nowhere else. Nothing is written for it, so the
   * row stays `user_verified = false` and the server hands it back on the next
   * visit — which is exactly what "skip" should mean.
   */
  const [resolvedIds, setResolvedIds] = useState<ReadonlySet<string>>(() => new Set());

  /**
   * The last confirm that failed to persist. The item is put back in the deck
   * when this is set, so the failure costs the user a retry and never a
   * silently-dropped garment.
   */
  const [failure, setFailure] = useState<{ item: Item; message: string } | null>(null);

  // Guards a double-fire on one card (a fast swipe can resolve the gesture
  // twice before React has re-rendered the deck). Per-id rather than a global
  // lock so genuinely swiping two cards in quick succession still works.
  const inFlightRef = useRef<Set<string>>(new Set());

  const deck = useMemo(
    () => items.filter((it) => !resolvedIds.has(it.id)),
    [items, resolvedIds],
  );

  const resolve = useCallback((id: string) => {
    setResolvedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const unresolve = useCallback((id: string) => {
    setResolvedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  /** Only send fields the user actually changed — an unchanged patch is noise. */
  const patchFor = useCallback(
    (item: Item) => {
      const edit = edits[item.id];
      if (!edit) return undefined;
      const changed =
        edit.category !== item.category ||
        edit.price !== item.purchasePrice ||
        JSON.stringify(edit.occasions) !== JSON.stringify(item.occasions);
      return changed
        ? { category: edit.category, occasions: edit.occasions, purchasePrice: edit.price }
        : undefined;
    },
    [edits],
  );

  const confirm = useCallback(
    async (item: Item) => {
      if (inFlightRef.current.has(item.id)) return;
      inFlightRef.current.add(item.id);
      setFailure(null);

      // Advance the visible deck first so the animation isn't waiting on the
      // network. The write is still awaited — if it fails the card comes back.
      resolve(item.id);

      // Snapshot once, before the await: `edits` can change while the write is
      // in flight, and the analytics flag must describe the patch that was
      // actually sent, not whatever the deck looks like afterwards.
      const patch = patchFor(item);

      try {
        await verify.mutateAsync({ id: item.id, patch });
        // After the write, so a failed confirm never counts. Whether the user
        // corrected the AI (patch present) is the one property worth having —
        // it is the tagging model's error rate as experienced by real users.
        track('garment_reviewed', { corrected: patch !== undefined });
      } catch (err) {
        // Never let a failed write look like a successful confirm. Put the item
        // back in the deck and say so, because the alternative is an item that
        // vanishes from the queue while still unverified in the database.
        unresolve(item.id);
        setFailure({
          item,
          message: err instanceof Error ? err.message : 'Could not save that. Check your connection.',
        });
      } finally {
        inFlightRef.current.delete(item.id);
      }
    },
    [patchFor, resolve, unresolve, verify],
  );

  // Only used to keep the end-of-deck copy honest — "these are ready to wear"
  // is a lie if half of them were deferred.
  const [skippedCount, setSkippedCount] = useState(0);

  const skip = useCallback(
    (item: Item) => {
      // No mutation, by design. Skipping is "ask me later", and the only way to
      // mean that is to leave the row untouched.
      setFailure(null);
      setSkippedCount((n) => n + 1);
      resolve(item.id);
    },
    [resolve],
  );

  if (query.isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-canvas dark:bg-canvas-dark">
        <Text variant="body">Loading…</Text>
      </SafeAreaView>
    );
  }

  const done = deck.length === 0;
  const total = items.length;
  // 0-based position of the card currently on top of the stack — items ahead
  // of it have already been confirmed or skipped this sitting.
  const current = total - deck.length;

  return (
    <SafeAreaView className="flex-1 bg-canvas dark:bg-canvas-dark">
      {/*
        The deck is a fullScreenModal with no native header, so this ghost
        "Close"/"Done" stays as the only way out — dropping it would trap
        anyone who wants to finish reviewing later. It sits in its own slim
        row so it doesn't compete with the colophon progress line below.
      */}
      <View className="flex-row items-center justify-end px-gutter pt-2">
        <Button title={done ? 'Done' : 'Close'} variant="ghost" onPress={() => router.back()} />
      </View>

      {!done ? (
        <View className="flex-row items-center justify-between px-gutter pb-1 pt-1">
          <Text variant="colophon">
            Review · {Math.min(current + 1, total)} of {total}
          </Text>
          {/* Segmented progress — one pill per item, the current step in the
              accent, the rest in sand. `maxWidth` keeps a handful of pills at
              their full size while letting a long batch compress instead of
              overflowing the row. */}
          <View className="flex-row items-center gap-1">
            {Array.from({ length: total }).map((_, i) => (
              <View
                key={i}
                className={`h-1 rounded-full ${i === current ? 'bg-accent dark:bg-accent-dark' : 'bg-sand dark:bg-sand-dark'}`}
                style={{ flex: 1, maxWidth: 16 }}
              />
            ))}
          </View>
        </View>
      ) : null}

      {/*
        A failed confirm is the one error on this screen the user can act on, so
        it gets a persistent banner with a retry rather than a toast that
        disappears before they have read it. `accessibilityLiveRegion` makes
        VoiceOver announce it, since the failure happens after the card has
        already animated away and there is nothing else to notice.
      */}
      {failure ? (
        <View
          accessibilityLiveRegion="polite"
          className="mx-gutter mt-3 flex-row items-center justify-between gap-3 rounded-card bg-warning/15 px-3 py-2">
          <Text variant="label" className="flex-1">
            {`Couldn't save ${failure.item.subcategory ?? failure.item.category}. ${failure.message}`}
          </Text>
          <Button
            title="Retry"
            variant="secondary"
            onPress={() => {
              const target = failure.item;
              setFailure(null);
              void confirm(target);
            }}
          />
        </View>
      ) : null}

      {done ? (
        <EmptyState
          symbol="checkmark.circle"
          title={items.length === 0 ? 'Nothing to review' : 'All caught up'}
          body={
            items.length === 0
              ? 'After an import lands, confirm or correct what Cinch guessed. One tap per piece.'
              : skippedCount > 0
                ? `Confirmed pieces are ready to wear. The ${skippedCount} you skipped will be waiting next time.`
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
          {deck
            .slice(0, 3)
            .map((item, offset) => {
              const isTop = offset === 0;
              const edit = edits[item.id] ?? {
                category: item.category,
                occasions: item.occasions,
                price: item.purchasePrice,
              };
              return (
                <ReviewCard
                  // Keyed by id alone. A resolved card is removed from `deck`
                  // rather than stepped over by an index, so the cards that
                  // remain keep their identity — and with it their untouched
                  // translateX of 0 — as they are promoted up the stack.
                  key={item.id}
                  item={item}
                  isTop={isTop}
                  depth={offset}
                  category={edit.category}
                  occasions={edit.occasions}
                  price={edit.price}
                  onEditPrice={(next) =>
                    setEdits((prev) => ({ ...prev, [item.id]: { ...edit, price: next } }))
                  }
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
                  onConfirm={() => void confirm(item)}
                  onSkip={() => skip(item)}
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
