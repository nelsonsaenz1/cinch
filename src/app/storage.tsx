import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, EmptyState, ErrorState, Rule, ScreenHeader, Skeleton, Text } from '@/components/ui';
import { pieceName, wearsLabel } from '@/features/closet/item-name';
import { useRemoveItems } from '@/features/closet/mutations';
import { useRestoreItems, useStoredCloset } from '@/features/closet/storage';
import { stableImageSource, useSignedUrls } from '@/features/closet/use-image-urls';
import type { Item } from '@/schemas/item';
import { MIN_TAP_TARGET, useTheme } from '@/theme/tokens';

/**
 * Storage — the pieces the user has taken out of rotation, and the only way
 * back from there.
 *
 * A utility screen on purpose: header, one honest line, a list. It has no atlas
 * and wants none. What it does have is the obligation the archive flag creates —
 * a one-way archive would burn closet slots forever with nothing to show for
 * them (the objection recorded above `useRemoveItems`), so this list existing,
 * and saying plainly what storage costs, is what makes the flag defensible at
 * all. See features/closet/storage.ts for the trigger read behind that claim.
 *
 * The two actions per row are the two real answers: bring it back, or delete it
 * for good. There is deliberately no third, quieter option — a piece they want
 * neither in the closet nor deleted is exactly what this screen is.
 */

/** The thumbnail well. 4:5, matching the grid card's proportion at row scale. */
const THUMB_WIDTH = 48;
const THUMB_HEIGHT = 60;

export default function StorageScreen() {
  const theme = useTheme();
  const stored = useStoredCloset();
  const restore = useRestoreItems();
  const remove = useRemoveItems();

  // Which row's write is in flight, so one piece's spinner never disables the
  // rest of the list. Same pattern as borrow.tsx.
  const [busyId, setBusyId] = useState<string | null>(null);

  const items = stored.data ?? [];
  const { resolve } = useSignedUrls(
    items.flatMap((item) => [item.listingPath, item.platePath, item.cutoutPath, item.thumbPath]),
  );

  const onError = (title: string) => (err: unknown) =>
    Alert.alert(title, err instanceof Error ? err.message : 'Something went wrong. Try again.');

  const restoreItem = (item: Item) => {
    setBusyId(item.id);
    restore.mutate(
      { ids: [item.id] },
      {
        onSettled: () => setBusyId(null),
        onError: onError('Couldn’t bring that back'),
      },
    );
  };

  /**
   * Both consequences are named in the dialog, because they are two different
   * losses and only one of them is obvious. The row disappearing is expected;
   * the photographs being deleted from the bucket is what `useRemoveItems`
   * actually does and is the part that cannot be undone by re-adding the
   * garment later.
   */
  const confirmDelete = (item: Item) => {
    Alert.alert(
      `Delete ${pieceName(item)}?`,
      'This removes the piece and deletes its photographs. It can’t be undone, and it frees the closet slot storage is still holding.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Delete permanently',
          style: 'destructive',
          onPress: () => {
            setBusyId(item.id);
            remove.mutate(
              { ids: [item.id] },
              {
                onSettled: () => setBusyId(null),
                onError: onError('Couldn’t delete that piece'),
              },
            );
          },
        },
      ],
    );
  };

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
    body = <StorageSkeleton />;
  } else if (items.length === 0) {
    body = (
      <EmptyState
        symbol="archivebox"
        title="Nothing in storage"
        body="Pieces you move out of rotation wait here. They keep their wears and stay out of your plans."
      />
    );
  } else {
    body = (
      <ScrollView
        contentContainerClassName="px-gutter pb-24 pt-4"
        refreshControl={
          <RefreshControl
            refreshing={stored.isRefetching}
            onRefresh={() => void stored.refetch()}
            tintColor={theme.muted}
          />
        }>
        <Card>
          {items.map((item, i) => (
            <View key={item.id}>
              {i > 0 ? <Rule tone="hairline" /> : null}
              <StoredRow
                item={item}
                imageUri={resolve(item.listingPath, item.platePath, item.cutoutPath, item.thumbPath)}
                busy={busyId === item.id}
                onRestore={restoreItem}
                onDelete={confirmDelete}
              />
            </View>
          ))}
        </Card>
      </ScrollView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <ScreenHeader align="center" title="Storage" />

      {/* The honest line. It used to say the unpleasant thing — a stored piece
          still spent a closet slot — because that was true. Migration
          20260808170000 split the ceiling in two and made storing actually free
          an active slot, so the sentence had to change with the behaviour or it
          would have become the one place the app lied about its own limit. The
          second ceiling is still named, because a person putting pieces away to
          make room should learn where that stops here rather than at the
          camera. */}
      <View className="px-gutter pt-4">
        <Text variant="label" className="text-muted dark:text-muted-dark">
          Stored pieces stay out of your closet grid and out of your plans, and they free up room
          for something new. They still count toward what your account can hold.
        </Text>
      </View>

      {body}
    </SafeAreaView>
  );
}

/** One stored piece: what it is, and the two ways out of here. */
function StoredRow({
  item,
  imageUri,
  busy,
  onRestore,
  onDelete,
}: {
  item: Item;
  /** Signed URL — a storage path is not a URL (see use-image-urls.ts). */
  imageUri?: string;
  busy: boolean;
  onRestore: (item: Item) => void;
  onDelete: (item: Item) => void;
}) {
  const theme = useTheme();
  const name = pieceName(item);

  return (
    <View className="flex-row gap-3 px-4 py-3">
      <View
        className="overflow-hidden rounded-sm border border-hairline bg-tray dark:border-hairline-dark dark:bg-tray-dark"
        style={{ width: THUMB_WIDTH, height: THUMB_HEIGHT }}>
        {imageUri ? (
          <Image
            source={stableImageSource(imageUri)}
            recyclingKey={item.id}
            contentFit="cover"
            transition={180}
            cachePolicy="memory-disk"
            style={{ flex: 1 }}
            accessibilityIgnoresInvertColors
          />
        ) : (
          // A piece whose photo never uploaded, or whose cutout never ran. The
          // placeholder is a garment glyph rather than a broken frame — the row
          // still has a name, and the name is what they are looking for.
          <View className="flex-1 items-center justify-center">
            <SymbolView
              name="tshirt"
              size={18}
              tintColor={theme.hairline}
              resizeMode="scaleAspectFit"
            />
          </View>
        )}
      </View>

      <View className="flex-1">
        <Text variant="label" numberOfLines={1} className="text-ink dark:text-ink-dark">
          {name}
        </Text>
        {/* Wears survive storage — the piece was worn, and putting it away does
            not unwear it. Saying so here is what makes the empty state's
            promise ("they keep their wears") checkable. */}
        <Text variant="caption" numberOfLines={1} className="mt-[3px]">
          {wearsLabel(item.wearCount)}
        </Text>

        <View className="mt-2 flex-row items-center" style={{ gap: 20 }}>
          <RowAction
            label="Restore"
            hint={`Move ${name} back into your closet`}
            busy={busy}
            color={theme.ink}
            onPress={() => onRestore(item)}
          />
          <RowAction
            label="Delete permanently"
            hint={`Delete ${name} and its photographs`}
            busy={busy}
            // Oxblood carries the destructive action, as it does on the closet's
            // selection bar. The row's other action stays ink so the screen
            // never offers two equally loud ways out.
            color={theme.accent}
            onPress={() => onDelete(item)}
          />
        </View>
      </View>
    </View>
  );
}

/**
 * A text action in a row. Text-sized by design, so `hitSlop` is what carries it
 * to the 44pt floor rather than padding that would push the rows apart.
 */
function RowAction({
  label,
  hint,
  busy,
  color,
  onPress,
}: {
  label: string;
  hint: string;
  /** True while this row's write is in flight — both actions go inert together. */
  busy: boolean;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: busy, busy }}
      hitSlop={{
        top: (MIN_TAP_TARGET - 20) / 2,
        bottom: (MIN_TAP_TARGET - 20) / 2,
        left: 6,
        right: 6,
      }}
      className="active:opacity-60">
      <Text variant="caption" style={{ color, opacity: busy ? 0.4 : 1 }}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * The wait, shaped like the list. A row of bars in the same anatomy as
 * `StoredRow` — thumbnail well, name, meta, two actions — so nothing jumps when
 * the read lands. `RowSkeleton` is the wrong shape here: its 32pt disc is an
 * avatar, and these rows lead with a garment.
 */
function StorageSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View className="px-gutter pt-4" accessibilityLabel="Opening storage">
      <Card>
        {Array.from({ length: count }).map((_, i) => (
          <View key={i}>
            {i > 0 ? <Rule tone="hairline" /> : null}
            <View className="flex-row gap-3 px-4 py-3">
              <Skeleton
                className="rounded-sm"
                style={{ width: THUMB_WIDTH, height: THUMB_HEIGHT }}
                delay={i * 120}
              />
              <View className="flex-1 gap-2 pt-1">
                <Skeleton className="h-3.5 w-2/3 rounded-chip" delay={i * 120} />
                <Skeleton className="h-2.5 w-1/4 rounded-chip" delay={i * 120} />
                <Skeleton className="mt-1 h-3 w-1/2 rounded-chip" delay={i * 120} />
              </View>
            </View>
          </View>
        ))}
      </Card>
    </View>
  );
}
