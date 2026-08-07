import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { track } from '@/lib/posthog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Notice } from '@/components/ui/notice';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { ReviewCard } from '@/components/review/review-card';
import { useReviewQueue } from '@/features/closet/queries';
import { useUnverifyItem, useVerifyItem } from '@/features/closet/mutations';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import {
  describeGaps,
  gapsFor,
  isFullyTagged,
  noteGaps,
  partitionGaps,
} from '@/features/ingest/tag-gaps';
import type { Item, ItemCategory } from '@/schemas/item';

/**
 * The most pips the progress bar will ever draw. Twelve 16pt marks plus their
 * gaps is about half a phone's width — the point past which another pip stops
 * adding information and starts subtracting legibility from the ones beside it.
 */
const PIP_LIMIT = 12;

/**
 * How long the undo line stays up after a confirm.
 *
 * Long enough to notice a mis-swipe and reach for it, short enough that it has
 * retired before the next card is settled — the line is a footnote to the
 * gesture that just happened, and one that outlived that gesture would start
 * reading as a claim about the card now on top of the stack.
 */
const UNDO_WINDOW_MS = 5_000;

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
  const unverify = useUnverifyItem();

  /**
   * The top inset, taken from the hook rather than from `<SafeAreaView>`.
   *
   * This route is a `fullScreenModal` (see `_layout.tsx`), and that is what
   * makes the difference: `SafeAreaView` in react-native-safe-area-context v5 is
   * a NATIVE view that reads the safe area off its own superview, and inside a
   * modally-presented view controller that comes back as zero — so the wrapper
   * that pads every other screen in Cinch padded nothing here, and the progress
   * line sat against the clock with "Close" under the battery glyphs.
   *
   * `useSafeAreaInsets` reads the JS context that the provider seeds from the
   * window's real metrics, which the modal presentation cannot zero out. Applied
   * explicitly, top and bottom, so there is exactly one source of inset on this
   * screen and no chance of double padding.
   */
  const insets = useSafeAreaInsets();
  const frame = {
    flex: 1,
    paddingTop: insets.top,
    paddingBottom: insets.bottom,
  } as const;

  const items = useMemo(() => query.data ?? [], [query.data]);

  /**
   * Storage paths -> signed URLs, for the WHOLE queue in one request.
   *
   * The `garments` bucket is private. A stored path is not a URL, and expo-image
   * given a path renders an empty plate without so much as a warning — which is
   * precisely what this deck did for every user until now. The closet grid has
   * always signed; the review card was handed `item.thumbPath` raw.
   *
   * Batched at the screen rather than per card for the same reason the grid
   * batches: only three cards are mounted at a time, but the deck walks the
   * whole queue, and signing on promotion would put a round trip between each
   * swipe and the next photograph. One request up front means the next card's
   * image is already resolved before it reaches the top of the stack.
   *
   * Called before every early return below, so the hook order is fixed.
   */
  // Named `resolveImage`, not `resolve`: this screen already has a `resolve`,
  // and it means something entirely different (mark a card dealt with).
  const { resolve: resolveImage } = useSignedUrls(
    useMemo(() => items.flatMap((i) => [i.thumbPath, i.cutoutPath, i.imagePath]), [items]),
  );

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

  /**
   * The confirm that can still be taken back, and the window it lives in.
   *
   * A swipe is a fast gesture on a stack of cards, and the one thing it cannot
   * do on its own is admit it went the wrong way. This holds the item as it
   * stood BEFORE the write — its pre-confirm `status` is what `useUnverifyItem`
   * restores, and after the confirm the server no longer remembers it.
   *
   * The offer is retired by the timer, by the next card being dealt with, or by
   * the undo itself. There is no toast layer in this app, so it renders as an
   * inline caption line in the same live-region grammar as the failure banner
   * below.
   */
  const [undoItem, setUndoItem] = useState<Item | null>(null);
  const [undoError, setUndoError] = useState<string | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearUndo = useCallback(() => {
    if (undoTimer.current) {
      clearTimeout(undoTimer.current);
      undoTimer.current = null;
    }
    setUndoItem(null);
    setUndoError(null);
  }, []);

  const offerUndo = useCallback((item: Item) => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndoError(null);
    setUndoItem(item);
    undoTimer.current = setTimeout(() => {
      undoTimer.current = null;
      setUndoItem(null);
    }, UNDO_WINDOW_MS);
  }, []);

  // The deck is a modal and "Close" is one tap away, so an in-flight timer
  // outliving the screen is the ordinary case, not the edge one.
  useEffect(
    () => () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    },
    [],
  );

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

  // Confirmed cards leave `items` on the next refetch, so a total derived from
  // items.length alone RENUMBERS as the user works — "1 of 10" became "1 of 9"
  // instead of "2 of 10". Counting confirms this sitting keeps the ordinal
  // advancing through a stable total, which is what a position marker is for.
  const [confirmedCount, setConfirmedCount] = useState(0);

  const confirm = useCallback(
    async (item: Item) => {
      if (inFlightRef.current.has(item.id)) return;
      inFlightRef.current.add(item.id);
      setFailure(null);
      // The previous card's offer expires here rather than on a timer: two undo
      // lines cannot be on screen at once, and "Confirmed" must always name the
      // most recent confirm.
      clearUndo();

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
        setConfirmedCount((n) => n + 1);
        // Offered only after the write landed. A confirm that failed already
        // puts the card back by itself, and there is nothing there to undo.
        offerUndo(item);
      } catch {
        // Never let a failed write look like a successful confirm. Put the item
        // back in the deck and say so, because the alternative is an item that
        // vanishes from the queue while still unverified in the database.
        unresolve(item.id);
        // The atlas fixes this line's copy — "Couldn't save shearling coat.
        // Check your connection." — so the banner names the garment and keeps
        // one calm sentence, rather than relaying whatever a fetch layer put
        // in `err.message`.
        setFailure({ item, message: 'Check your connection.' });
      } finally {
        inFlightRef.current.delete(item.id);
      }
    },
    [clearUndo, offerUndo, patchFor, resolve, unresolve, verify],
  );

  /**
   * Take the last confirm back.
   *
   * `useUnverifyItem` returns the row to the exact state the deck draws from —
   * `user_verified = false` and the status it held before the confirm — and
   * invalidates the queue, so the piece is handed back by the server in its own
   * queue order rather than spliced into the stack at a position nothing agrees
   * on. `unresolve` is what lets it through the local filter again; the ordinal
   * is decremented with it so the progress line does not claim a confirm that
   * no longer exists.
   *
   * The order matters: the write is awaited first. Returning the card and then
   * discovering the update failed would be the same lie the failure banner
   * exists to prevent, in the other direction.
   */
  const undoConfirm = useCallback(
    async (item: Item) => {
      if (undoTimer.current) {
        clearTimeout(undoTimer.current);
        undoTimer.current = null;
      }
      setUndoError(null);
      try {
        await unverify.mutateAsync({ item });
        // Wait for the queue to hand the piece back before letting it through
        // the local filter. The mutation's invalidation would get there on its
        // own, but a beat later — long enough for the deck to be briefly empty
        // and for the last undo of a sitting to flash "All caught up" on its
        // way home.
        await query.refetch();
        unresolve(item.id);
        setConfirmedCount((n) => Math.max(0, n - 1));
        setUndoItem(null);
      } catch (err) {
        // The offer stays on screen with the reason attached, so the tap can be
        // repeated. It has already outlived its window at this point, which is
        // right: a failure is not something to take away after five seconds.
        setUndoError(
          err instanceof Error ? err.message : 'Could not put that piece back. Check your connection.',
        );
      }
    },
    [query, unresolve, unverify],
  );

  /**
   * Accept every garment the tagger answered completely, in one action.
   *
   * The instruction this serves: do not interrogate somebody about things the
   * machine already got right. After a sixty-photo import most cards are a
   * settled spec line and a "Looks right" — sixty gestures to say "yes" sixty
   * times. This says it once, and leaves in the deck only the pieces that
   * genuinely need a person: the ones `gapsFor` found a hole in.
   *
   * Sequential, not parallel: these are ordinary row updates and a burst of
   * sixty concurrent ones is how a review session ends in a rate limit. A
   * failure stops the run and puts the offending card back, exactly as a single
   * confirm does — a bulk action that silently drops half its work would be
   * worse than no bulk action.
   */
  const [confirmingAll, setConfirmingAll] = useState(false);

  const confirmAllSettled = useCallback(
    async (settled: Item[]) => {
      setConfirmingAll(true);
      setFailure(null);
      // No undo offer for the bulk action, and the pending one is retired.
      // "Confirmed. Undo." can only name one garment, and naming one of forty
      // would be an offer to take back a piece the user cannot see.
      clearUndo();
      try {
        for (const it of settled) {
          resolve(it.id);
          try {
            await verify.mutateAsync({ id: it.id, patch: patchFor(it) });
            track('garment_reviewed', { corrected: false });
          } catch {
            unresolve(it.id);
            setFailure({ item: it, message: 'Check your connection.' });
            return;
          }
        }
      } finally {
        setConfirmingAll(false);
      }
    },
    [clearUndo, patchFor, resolve, unresolve, verify],
  );

  // Only used to keep the end-of-deck copy honest — "these are ready to wear"
  // is a lie if half of them were deferred.
  const [skippedCount, setSkippedCount] = useState(0);

  const skip = useCallback(
    (item: Item) => {
      // No mutation, by design. Skipping is "ask me later", and the only way to
      // mean that is to leave the row untouched.
      setFailure(null);
      clearUndo();
      setSkippedCount((n) => n + 1);
      resolve(item.id);
    },
    [clearUndo, resolve],
  );

  if (query.isLoading) {
    // The shape of the deck, before the deck: header line, then a card with
    // the photo well and the four tag rows where they will land. The old
    // version was a bare "Loading…" string — the one screen state the design
    // never drew, drawn now in the same grammar as the card it becomes.
    return (
      <View className="flex-1 bg-canvas dark:bg-canvas-dark" style={frame}>
        <View className="flex-row items-center justify-end px-gutter pt-2">
          <Button title="Close" variant="ghost" onPress={() => router.back()} />
        </View>
        <View accessibilityLabel="Loading your review queue" className="flex-1 px-5 pb-5 pt-1">
          <Skeleton className="h-3 w-28 rounded-chip" />
          <Card padding="xl" border="none" className="mt-4 flex-1">
            <Skeleton className="h-6 w-36 rounded-chip" />
            <Skeleton className="mt-2 h-3 w-52 rounded-chip" />
            <Skeleton className="mb-4 mt-4 h-44 w-full rounded-plate" />
            {[0, 1, 2].map((i) => (
              <View
                key={i}
                className="mb-3 border-b border-hairline pb-3 dark:border-hairline-dark">
                <Skeleton className="h-2.5 w-16 rounded-chip" />
                <Skeleton
                  className="mt-2 h-4 rounded-chip"
                  style={{ width: (['55%', '40%', '65%'] as const)[i] }}
                />
              </View>
            ))}
          </Card>
        </View>
      </View>
    );
  }

  if (query.isError) {
    // Distinct from "Nothing to review", deliberately: a queue that could not
    // be read is not an empty queue, and saying so here is what keeps the
    // empty state's word good.
    return (
      <View className="flex-1 bg-canvas dark:bg-canvas-dark" style={frame}>
        <View className="flex-row items-center justify-end px-gutter pt-2">
          <Button title="Close" variant="ghost" onPress={() => router.back()} />
        </View>
        <ErrorState
          title="The queue didn't load."
          body="Whatever is waiting for review is still waiting — this is a connection problem, not an empty queue."
          onRetry={() => void query.refetch()}
          retrying={query.isRefetching}
        />
      </View>
    );
  }

  const done = deck.length === 0;
  // Confirmed cards drop out of `items` on refetch; adding them back keeps the
  // sitting's total stable so the ordinal advances instead of renumbering.
  const total = items.length + confirmedCount;
  // 0-based position of the card currently on top of the stack — items ahead
  // of it have already been confirmed or skipped this sitting.
  const current = total - deck.length;

  // The pip bar, at whatever length it can actually be read at. Above the cap
  // the marker travels the bar in proportion rather than parking at the far
  // end, so a sixty-piece queue still shows movement as the deck is worked.
  const pipCount = Math.min(total, PIP_LIMIT);
  const activePip =
    total <= PIP_LIMIT
      ? current
      : Math.min(Math.floor((current / total) * pipCount), pipCount - 1);

  // What the tagger left unanswered on the card the user is looking at. Named
  // above the deck rather than inside the card so the invitation to correct
  // arrives BEFORE the eye reaches the spec rows, and so the card itself keeps
  // the composition the design draws.
  const top = deck[0];
  const { askable } = partitionGaps(top ? gapsFor(top) : []);
  /**
   * The banner above the deck is now ONE thing and only one: an invitation the
   * card can honour.
   *
   * `askable` gaps have a control behind them — "set it below" points at the
   * Edit affordance on the Category row — so naming them before the eye reaches
   * the spec rows earns its width.
   *
   * The other half used to live here too, and it was the wrong shape for what it
   * said. "Cinch left the brand blank. Nothing here fills that in — confirm the
   * rest." is a statement of record about a row with no control, rendered
   * full-bleed across the top of the first card of somebody's first review — an
   * app reporting a defect about itself at the most delicate moment in
   * onboarding. That admission is still made, still in Cinch's own words, but on
   * the card as a muted footnote (`noteGaps`, passed to each `ReviewCard`),
   * where it explains the blank rows it sits under instead of pre-empting them.
   */
  const gapLine = askable.length
    ? `Cinch wasn’t sure about ${describeGaps(askable)} — set it below, or skip.`
    : null;

  // Everything still in the deck that the tagger answered in full — the pieces
  // there is no honest question to ask about.
  const settled = deck.filter(isFullyTagged);

  return (
    <View className="flex-1 bg-canvas dark:bg-canvas-dark" style={frame}>
      {/*
        The deck is a fullScreenModal with no native header, so this ghost
        control stays as the only way out — dropping it would trap anyone who
        wants to finish reviewing later. It sits in its own slim row so it
        doesn't compete with the colophon progress line below.

        WHY THIS ONE IS NOT ALWAYS "DONE", unlike capture's (07a). The word
        changes because the state does: with cards left in the deck the review
        is demonstrably not done, and labelling the exit "Done" would have the
        user assert something untrue about their own closet — the pieces behind
        it stay unverified and come back next time. "Close" while there is work
        left, "Done" once the deck is empty.
      */}
      <View className="flex-row items-center justify-end px-gutter pt-2">
        <Button title={done ? 'Done' : 'Close'} variant="ghost" onPress={() => router.back()} />
      </View>

      {!done ? (
        <View className="flex-row items-center justify-between px-gutter pb-1 pt-1">
          <Text variant="colophon">
            Review · {Math.min(current + 1, total)} of {total}
          </Text>
          {/*
            Segmented progress — one pill per item, the current step in INK,
            the rest in sand. `maxWidth` keeps a handful of pills at their full
            size while letting a long batch compress instead of overflowing.

            The current pill used to be oxblood, and that was one accent too
            many: this screen already spends it on the "Edit" affordances inside
            the card, which are the only invitation the deck actually makes —
            the whole reason it exists is to let somebody correct a machine. A
            position marker is not a call to action, so it takes the ink the
            rest of the type is set in and the accent stays spent once.
          */}
          {/*
            CAPPED AT TWELVE. `flex: 1` with a 16pt ceiling degrades gracefully
            for a handful of pieces and catastrophically for sixty: a
            sixty-photo import drew sixty pips squeezed to sub-pixel slivers
            with hairline gaps between them, which is a grey smear, not a
            position. Past the cap the bar carries the shape and the colophon
            beside it says how many pieces it is compressing — the exact count
            is already on the ordinal to its left.
          */}
          <View className="flex-row items-center gap-1">
            {Array.from({ length: pipCount }).map((_, i) => (
              <View
                key={i}
                className={`h-1 rounded-full ${i === activePip ? 'bg-ink dark:bg-ink-dark' : 'bg-sand dark:bg-sand-dark'}`}
                style={{ flex: 1, maxWidth: 16 }}
              />
            ))}
            {total > PIP_LIMIT ? (
              <Text variant="colophon" className="ml-1.5">
                · {total - PIP_LIMIT} more
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {/*
        The undo offer, under the ordinal it corrects.

        Not gated on `!done`: the confirm most worth taking back is the one that
        emptied the deck, and hiding the line at exactly that moment would be
        the mis-swipe with no way home. A `caption` and a ghost control, in the
        same live-region grammar as the failure banner below — there is no toast
        layer in this app and this is not the place to invent one.
      */}
      {undoItem ? (
        // The failed case takes the critical colour rather than staying a
        // muted footnote: at that point the line is no longer a receipt for
        // something that worked.
        <Notice
          message={undoError ?? 'Confirmed.'}
          tone={undoError ? 'critical' : 'neutral'}
          className="px-gutter pb-1 pt-1"
          action={{
            label: 'Undo',
            loading: unverify.isPending,
            onPress: () => void undoConfirm(undoItem),
            accessibilityHint:
              'Puts the piece you just confirmed back in the deck, with any corrections you made.',
          }}
        />
      ) : null}

      {/*
        The invitation to correct, aimed only where it belongs.

        `gapsFor` reads what the tagger actually produced, so this line names the
        rows with a hole in them and stays silent when there are none — a garment
        Cinch is sure about should read as a settled spec sheet to confirm, not
        as a form to fill in. Set as a caption because that is what the type
        system calls a line under a photograph.
      */}
      {!done && gapLine ? (
        <View className="px-gutter pb-1 pt-1">
          <Text variant="caption">{gapLine}</Text>
        </View>
      ) : null}

      {/*
        Three or more is the point at which confirming them one at a time stops
        being a review and starts being a chore. Below that the deck is quicker
        than the shortcut, so the shortcut does not appear.
      */}
      {!done && settled.length >= 3 ? (
        <View className="px-gutter pb-1 pt-1">
          {/* `secondary`, not `ghost`. This is the shortcut that turns sixty
              gestures into one — the single most valuable control on the
              screen — and it was drawn in the register the app reserves for
              "Close" and "Dismiss". It still isn't the oxblood primary: the
              accent belongs to the Edit affordances inside the card. */}
          <Button
            title={`Confirm the ${settled.length} Cinch is sure about`}
            variant="secondary"
            loading={confirmingAll}
            onPress={() => void confirmAllSettled(settled)}
            accessibilityHint="Marks every piece with complete tags as correct, leaving only the ones that need your eye."
            className="self-start"
          />
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
          className="mx-gutter mt-3 flex-row items-center justify-between gap-3 rounded-plate bg-warning/15 px-3 py-2">
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
                  // Thumb first (smallest byte count for a 176pt plate), then
                  // the cutout, then the original — the same order the card's
                  // own fallback used before it was handed raw paths.
                  imageUri={resolveImage(item.thumbPath, item.cutoutPath, item.imagePath)}
                  // Per card, not per deck: the card underneath is a different
                  // garment with different holes in it, and it is promoted to
                  // the top the moment this one is swiped away.
                  gapNote={noteGaps(partitionGaps(gapsFor(item)).unfixable)}
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
    </View>
  );
}
