import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, RefreshControl, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ClosetGrid } from '@/components/closet/closet-grid';
import { EmptyState, ErrorState, Text } from '@/components/ui';
import { useCapacity } from '@/features/billing/use-capacity';
import { pieceName } from '@/features/closet/item-name';
import { storedMetaLine } from '@/features/closet/piece-meta';
import { useRestoreItems, useStoredCloset } from '@/features/closet/storage';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import type { Item } from '@/schemas/item';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * C-07 — stored pieces, at the active ceiling.
 *
 * ── WHAT THE FRAME CHANGED ────────────────────────────────────────────────
 *
 * "Stored is a place, not a penalty: the tray states what is kept before what
 * is withheld, and the count line prints both figures from the plan so the
 * ceiling is arithmetic rather than a warning."
 *
 * This screen used to be a utility list — a centred header, one apologetic
 * sentence, and rows carrying Restore beside Delete permanently. Four things
 * are different now, and every one of them is the frame's:
 *
 * 1. THE GRID. Stored pieces are drawn as garments, in the same 168pt wells the
 *    closet uses, at 72% and without a contact shadow — "asleep, not degraded".
 *    The component inventory lists `stored` as a state of the garment card, so
 *    it is one, rather than a second card built here.
 *
 * 2. THE COUNT LINE. `12 stored · 148 of 150 active`, from the real counts.
 *    Never estimated: while the capacity query is in flight the active half is
 *    ABSENT rather than guessed, because a ceiling printed wrong is worse than
 *    a ceiling printed late.
 *
 * 3. WHAT IS KEPT, BEFORE WHAT IS WITHHELD. The tray leads with "Stored pieces
 *    stay yours" and only then says they are not styled. The old sentence led
 *    with the cost.
 *
 * 4. NO DELETE. The frame draws one control, and it is the way back in. Delete
 *    was a permanent, photograph-destroying action sitting one tap from a list
 *    whose whole promise is that nothing is lost; it stays reachable from a
 *    piece's own screen once the piece is active again. Nothing is lost by its
 *    absence here — the pieces, their photographs, their wears and their prices
 *    are all still exactly where they were.
 *
 * ── WHAT THE FRAME ASKS FOR AND THIS CANNOT DRAW ──────────────────────────
 *
 * The metadata line reads `Stored in March · worn 7 times` in the frame. There
 * is no storing date in the database — see `storedMetaLine`, which omits the
 * clause rather than substituting `created_at` for it. The line prints the half
 * that is true.
 *
 * The stored CEILING is claim 6 and is not drawn: "What the screen should say
 * when the stored count also reaches its limit is not yet defined." Nothing on
 * this screen invents an answer to it.
 */

export default function StorageScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const stored = useStoredCloset();
  const restore = useRestoreItems();
  const capacity = useCapacity();

  /** True while a restore is in flight, so the one control cannot double-fire. */
  const [busy, setBusy] = useState(false);

  const items = stored.data ?? [];
  const { resolve } = useSignedUrls(
    items.flatMap((item) => [item.listingPath, item.platePath, item.cutoutPath, item.thumbPath]),
  );

  const activate = (item: Item) => {
    setBusy(true);
    restore.mutate(
      { ids: [item.id] },
      {
        onSettled: () => setBusy(false),
        onError: (err) =>
          Alert.alert(
            'Couldn’t bring that back',
            // The server's own words when the ACTIVE closet is full — see the
            // restore trigger in features/closet/storage.ts. Relayed verbatim
            // rather than replaced with a guess about which ceiling was hit.
            err instanceof Error ? err.message : 'Something went wrong. Try again.',
          ),
      },
    );
  };

  /**
   * "Activate a piece" — the frame's one control, with a real target.
   *
   * The frame draws a single foot action rather than a control per card, and a
   * single action needs something to act on: this asks which piece, by name, in
   * the platform's own list. The cards themselves are deliberately inert —
   * `item/[id]` reads the ACTIVE closet, so a stored card that navigated would
   * land on "this piece is missing".
   *
   * Android's Alert caps at three buttons; the app ships iOS-first and the
   * closet's own recategorise sheet already accepts the same trade.
   */
  const choosePieceToActivate = () => {
    const names = items.map(pieceName);
    if (Platform.OS !== 'ios') {
      Alert.alert('Activate a piece', undefined, [
        ...items.map((item, i) => ({ text: names[i]!, onPress: () => activate(item) })),
        { text: 'Cancel', style: 'cancel' as const },
      ]);
      return;
    }
    ActionSheetIOS.showActionSheetWithOptions(
      { title: 'Activate a piece', options: [...names, 'Cancel'], cancelButtonIndex: names.length },
      (index) => {
        const item = items[index];
        if (item) activate(item);
      },
    );
  };

  /**
   * `12 stored · 148 of 150 active`, or as much of it as is actually known.
   *
   * Both halves are counts read off real queries. The active half is dropped
   * entirely while `useCapacity` is loading rather than printed as `0 of 0`:
   * the refusal is "printed when known or omitted — never estimated, never a
   * dash", and a ceiling is the last figure to guess at.
   */
  const countLine = [
    `${items.length} stored`,
    capacity.loading ? null : `${capacity.used} of ${capacity.limit} active`,
  ]
    .filter(Boolean)
    .join(' · ');

  let body: React.ReactNode;

  if (stored.isError) {
    // A failed read is not an empty drawer. Telling someone their stored pieces
    // are gone over a dropped connection is the one thing this screen must
    // never do — it is the screen they open to check those pieces are still there.
    body = (
      <ErrorState
        title="Couldn’t open storage"
        body="Cinch couldn’t read your stored pieces just now. Nothing has moved — try again."
        retrying={stored.isRefetching}
        onRetry={() => void stored.refetch()}
      />
    );
  } else if (stored.isLoading) {
    // No spinner: the grid's own skeleton geometry is the wait everywhere else
    // in this group, and a stored grid is the same grid.
    body = <StoredSkeleton />;
  } else if (items.length === 0) {
    body = (
      <EmptyState
        symbol="archivebox"
        title="Nothing in storage"
        body="Pieces you move out of rotation wait here. They keep their photographs, wear history and price, and they stay out of your plans."
      />
    );
  } else {
    body = (
      <ClosetGrid
        items={items}
        stored
        metaFor={storedMetaLine}
        resolveImage={(...paths) => resolve(...paths)}
        refreshControl={
          <RefreshControl
            refreshing={stored.isRefetching}
            onRefresh={() => void stored.refetch()}
            tintColor={theme.muted}
          />
        }
      />
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      {/* The frame's header: a 44pt tray disc, the serif title, and the count
          line under it. The disc is the way back — the frame draws a control
          there and this screen is pushed, so back is what it is. */}
      <View className="flex-row items-center gap-3 px-gutter pt-2">
        <BackDisc onPress={() => router.back()} />
        <View className="flex-1">
          <Text variant="plate" trim numberOfLines={1} accessibilityRole="header">
            Stored pieces
          </Text>
          <Text variant="note" className="mt-1">
            {countLine}
          </Text>
        </View>
      </View>

      {/* What is KEPT, then what is withheld — in that order, which is the
          whole argument of the frame. Tray fill at r12: the notice band this
          group uses everywhere, Medium heading over regular body. */}
      <View className="mx-gutter mt-4 rounded-md bg-tray px-4 py-3.5">
        <Text variant="label" className="text-ink">
          Stored pieces stay yours
        </Text>
        <Text variant="note" className="mt-1">
          {/* The ceiling is named as arithmetic, from the plan, not as a
              warning and never with a tier or a price attached — "the paywall
              is reached from the membership row in Profile". While the plan is
              still loading the sentence simply does not quote a number. */}
          {capacity.loading
            ? 'They keep their photographs, wear history and price. They are not styled into outfits and do not count against your active pieces.'
            : `They keep their photographs, wear history and price. They are not styled into outfits and do not count against your ${capacity.limit} active pieces.`}
        </Text>
      </View>

      <View className="mt-4 flex-1">{body}</View>

      {/* The one control, on the tray band the frame draws it on. Present only
          when there is something to activate: a control with an empty list
          behind it is a dead control. */}
      {items.length > 0 ? (
        <View
          className="border-t border-hairline bg-tray px-gutter pt-3"
          style={{ paddingBottom: insets.bottom + 12 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Activate a piece"
            accessibilityHint="Choose a stored piece to bring back into your closet"
            accessibilityState={{ disabled: busy, busy }}
            disabled={busy}
            onPress={choosePieceToActivate}
            style={{ minHeight: 48, opacity: busy ? 0.5 : 1 }}
            className="items-center justify-center rounded-md border border-rule active:opacity-70">
            {/* Outlined, so regular weight: the constitution reserves Medium
                for labels and FILLED actions. */}
            <Text variant="body" className="text-ink" style={{ fontSize: 15 }}>
              Activate a piece
            </Text>
          </Pressable>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

/** The header's 44pt tray disc — the frame's own back control. */
function BackDisc({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={onPress}
      style={{ width: MIN_TAP_TARGET, height: MIN_TAP_TARGET }}
      className="items-center justify-center rounded-full bg-tray active:opacity-60">
      <SymbolView
        name="chevron.left"
        size={16}
        tintColor={theme.ink}
        resizeMode="scaleAspectFit"
      />
    </Pressable>
  );
}

/**
 * The wait, shaped like the grid it becomes — two columns of 168pt wells with
 * their name and metadata bars, held still. No spinner and no sweep, for the
 * same reason C-06 gives.
 */
function StoredSkeleton() {
  const theme = useTheme();
  return (
    <View className="flex-row flex-wrap px-gutter" accessibilityLabel="Opening storage">
      {[0, 1, 2, 3].map((i) => (
        <View key={i} className="px-1.5 pb-2.5" style={{ width: '50%' }}>
          <View style={{ height: 168, borderRadius: 12, backgroundColor: theme.sand }} />
          <View
            style={{
              marginTop: 10,
              width: [120, 104, 132, 96][i],
              height: 15,
              borderRadius: 4,
              backgroundColor: theme.sand,
            }}
          />
          <View
            style={{
              marginTop: 6,
              width: [110, 96, 118, 90][i],
              height: 13,
              borderRadius: 4,
              backgroundColor: theme.tray,
            }}
          />
        </View>
      ))}
    </View>
  );
}
