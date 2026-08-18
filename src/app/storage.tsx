import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ChooserRow,
  PrimaryAction,
  SecondaryAction,
  SheetHead,
  StorageEmpty,
  StorageHeader,
  StorageMark,
  StorageNoticeBand,
  StorageSheet,
  StorageSkeleton,
  StoragePlate,
  StorageStop,
  useAx,
  useShortDevice,
} from '@/components/storage/storage-parts';
import { Placement } from '@/features/billing/placements';
import { useCapacity } from '@/features/billing/use-capacity';
import { useGate } from '@/features/billing/use-gate';
import { pieceName } from '@/features/closet/item-name';
import { useRestoreItems, useStoredCloset } from '@/features/closet/storage';
import {
  capacityLine,
  PLATE,
  primaryLabel,
  restoreBlocked,
  STORAGE_COPY,
  storageNotice,
  storageState,
  type StorageDoor,
} from '@/features/closet/storage-spec';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { haptics } from '@/lib/haptics';
import type { Item } from '@/schemas/item';
import { useTheme } from '@/theme/tokens';

/**
 * Storage — off-season pieces. Redesign 25.
 *
 * ── WHAT THE FRAMES CHANGED ─────────────────────────────────────────────────
 *
 * The previous build was already the right SHAPE — a grid of sleeping garments,
 * an arithmetic line, one control, and no delete. Redesign 25 keeps every one
 * of those decisions and changes four things:
 *
 * 1. THE ARITHMETIC GREW A THIRD CLAUSE. `12 stored · 138 of 150 active` became
 *    `12 stored · 138 of 150 active · 150 of 450 total`. The total ceiling was
 *    the one figure the old screen could not print, and its absence is what
 *    made the previous build declare the stored ceiling "not yet defined". It
 *    is defined now: `PLANS[plan].storedItems`, which was already there.
 *
 * 2. THE GRID DROPPED TO TWO COLUMNS AND ITS OWN COMPONENT. "Same grid language
 *    as Closet at LOWER emphasis" — see the note in `storage-parts.tsx` for why
 *    that stopped being a prop on `ClosetGrid` and became a sibling.
 *
 * 3. THE CHOOSER BECAME A DESIGNED SHEET. It was `ActionSheetIOS` with a list
 *    of names, which meant the one moment this screen exists for was drawn by
 *    the operating system and showed no garments at all. It is now a sheet with
 *    the real plates in it — you choose a coat by looking at the coat.
 *
 * 4. THE CEILINGS SPEAK. Six states, six things to say, and the one that
 *    matters most is the counter-intuitive one: TOTAL-FULL DOES NOT BLOCK A
 *    RESTORE, because restoring moves a piece between two sides of a total it
 *    does not change. See `restoreBlocked` in the spec.
 *
 * ── WHAT DID NOT CHANGE, ON PURPOSE ─────────────────────────────────────────
 *
 * The WRITE. `useRestoreItems` is called with the same shape, its error message
 * is still relayed verbatim rather than replaced with a guess about which
 * ceiling was hit, an in-flight restore still cannot double-fire, and nothing
 * on this screen deletes anything. The screen around the mutation is new; the
 * mutation and its contract are untouched.
 *
 * NO DELETE, still. The artifact draws a quiet "Delete a piece permanently…"
 * line in the both-full sheet and its own deviation note says to ship without
 * it if this route has no destructive confirmation — this route has none, and
 * both-full is escapable by storing anyway, so the line is omitted. See the
 * build report.
 *
 * NO STORED DATE, still. There is no `stored_at` column, so nothing here says
 * when a piece was put away. The plate carries a name and nothing else.
 */

/**
 * Each column's share of the row, leaving the gutter between them.
 *
 * A percentage rather than a measured width: the plate has a MAX width from the
 * artifact and a fluid one below it, so a device narrower than 2×157+10 still
 * gets two honest columns instead of a clipped second one.
 */
const COLUMN_PERCENT = 48;

/** What the screen is doing about a restore right now. */
type Flow =
  | { kind: 'idle' }
  | { kind: 'choosing' }
  | { kind: 'saving' }
  /** The write returned and the piece left the grid — the light celebration. */
  | { kind: 'restored'; name: string }
  /** The write failed, or moved nothing. The pick survives it. */
  | { kind: 'failed'; message: string }
  /** The both-full recovery sheet. */
  | { kind: 'twoWays' };

export default function StorageScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const gate = useGate();
  const ax = useAx();
  const short = useShortDevice();

  const stored = useStoredCloset();
  const restore = useRestoreItems();
  const capacity = useCapacity();

  const [flow, setFlow] = useState<Flow>({ kind: 'idle' });
  /**
   * The pick. Its NAME is remembered alongside its id, and that is not
   * redundancy — see `vanished` below, which has to name a piece whose row is
   * already gone from the list.
   */
  const [pickedRef, setPickedRef] = useState<{ id: string; name: string } | null>(null);

  const items = useMemo(() => stored.data ?? [], [stored.data]);
  const { resolve } = useSignedUrls(
    items.flatMap((item) => [item.listingPath, item.platePath, item.cutoutPath, item.thumbPath]),
  );

  /**
   * The pick, resolved against the CURRENT list rather than held as an object.
   *
   * A restore on another device removes the row underneath a selection, and a
   * held copy would leave the primary action naming a piece that is no longer
   * in storage. Resolving every render means the selection evaporates with the
   * row rather than outliving it.
   */
  const picked = useMemo(
    () => items.find((item) => item.id === pickedRef?.id) ?? null,
    [items, pickedRef],
  );

  /**
   * The piece was picked here and is no longer in storage — it was activated on
   * another device while this screen was open.
   *
   * NOT AN ERROR, and drawn as a plain reconciliation. The reader did not cause
   * it, cannot fix it, and the list is now correct; reporting a failure for a
   * state that is simply current is how a screen teaches somebody to distrust
   * what it shows them.
   */
  const vanished = pickedRef !== null && picked === null && flow.kind === 'idle';

  /**
   * The arithmetic. Every figure is READ — the stored count off the list in
   * hand, the ceilings off `useCapacity`, which reads `plans.ts`. Nothing is
   * typed and nothing is estimated: while capacity is loading both ceiling
   * clauses are `null` and `capacityLine` drops them entirely.
   */
  const known = !capacity.loading;
  const line = capacityLine({
    stored: items.length,
    active: known ? capacity.used : null,
    activeLimit: known ? capacity.limit : null,
    total: known ? capacity.stored : null,
    totalLimit: known ? capacity.storedLimit : null,
  });

  const state = known
    ? storageState({
        active: capacity.used,
        activeLimit: capacity.limit,
        total: capacity.stored,
        totalLimit: capacity.storedLimit,
      })
    : null;

  const notice = state
    ? storageNotice({
        state,
        activeLimit: capacity.limit,
        total: capacity.stored,
        totalLimit: capacity.storedLimit,
      })
    : null;

  // An unknown capacity is NOT treated as blocked, on `useCapacity`'s own
  // reasoning: a failed count would otherwise disarm the control for somebody
  // with plenty of room, and the server refuses correctly either way.
  const blocked = state !== null && restoreBlocked(state);

  const openDoor = useCallback(
    (door: StorageDoor) => {
      if (door === 'recover') {
        // The one state with two honest ways out earns a sheet rather than a
        // jump, so the reader chooses between them instead of being sent.
        setFlow({ kind: 'twoWays' });
        return;
      }
      setFlow({ kind: 'idle' });
      if (door === 'store') {
        router.push('/(tabs)/closet');
        return;
      }
      void gate.present(Placement.AddGarmentOverLimit);
    },
    [gate, router],
  );

  const pick = useCallback((item: Item) => {
    haptics.selection();
    setPickedRef((current) =>
      current?.id === item.id ? null : { id: item.id, name: pieceName(item) },
    );
    // A new pick clears whatever the last one ended in, so a stale success mark
    // never sits above a fresh selection.
    setFlow({ kind: 'idle' });
  }, []);

  /**
   * The write. Unchanged in shape from the previous build, and deliberately so.
   *
   * The server's own words survive a refusal — the restore trigger raises
   * `closet_limit_reached` and that message is relayed rather than replaced,
   * because this client cannot know which ceiling the database was looking at
   * and a guess printed as a fact is worse than a blunt sentence that is true.
   */
  const activate = useCallback(
    (item: Item) => {
      const name = pieceName(item);
      setFlow({ kind: 'saving' });

      restore.mutate(
        { ids: [item.id] },
        {
          onSuccess: () => {
            // The light celebration: a success notification only AFTER the
            // write returns, never on the tap that started it.
            haptics.success();
            setPickedRef(null);
            setFlow({ kind: 'restored', name });
          },
          onError: (err) => {
            haptics.failure();
            setFlow({
              kind: 'failed',
              message: err instanceof Error ? err.message : STORAGE_COPY.writeFailed.body,
            });
          },
        },
      );
    },
    [restore],
  );

  const onPrimary = useCallback(() => {
    if (picked) {
      activate(picked);
      return;
    }
    // Nothing picked yet: the sheet is how a piece gets chosen.
    haptics.selection();
    setFlow({ kind: 'choosing' });
  }, [activate, picked]);

  // ── The states that replace the grid entirely ────────────────────────────

  if (stored.isError) {
    return (
      <Shell line={null} onBack={() => router.back()}>
        <StorageStop
          title={STORAGE_COPY.readError.title}
          body={STORAGE_COPY.readError.body}
          action={STORAGE_COPY.readError.action}
          busy={stored.isRefetching}
          busyLabel={STORAGE_COPY.readError.retrying}
          onAction={() => void stored.refetch()}
        />
      </Shell>
    );
  }

  if (stored.isLoading) {
    // No count and no arithmetic while the first read is in flight: every
    // figure is unknown, and the loading frame prints none of them.
    return (
      <Shell line={null} onBack={() => router.back()}>
        <View className="mt-4">
          <StorageSkeleton />
        </View>
      </Shell>
    );
  }

  if (items.length === 0) {
    return (
      <Shell line={line} onBack={() => router.back()}>
        <StorageEmpty onBack={() => router.back()} />
      </Shell>
    );
  }

  // ── The grid ─────────────────────────────────────────────────────────────

  const plateWidth = short ? PLATE.shortWidth : PLATE.width;

  return (
    <Shell line={line} onBack={() => router.back()}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={stored.isRefetching}
            onRefresh={() => void stored.refetch()}
            tintColor={theme.accentWarm}
          />
        }>
        {/* The marks, above the grid, one at a time. */}
        {flow.kind === 'restored' ? (
          <View className="mb-3">
            <StorageMark
              tone="positive"
              title={STORAGE_COPY.restored.title(flow.name)}
              body={STORAGE_COPY.restored.body}
            />
          </View>
        ) : null}

        {flow.kind === 'failed' ? (
          <View className="mb-3">
            <StorageMark tone="quiet" title={STORAGE_COPY.writeFailed.title} body={flow.message} />
          </View>
        ) : null}

        {vanished && pickedRef ? (
          <View className="mb-3">
            <StorageMark
              tone="quiet"
              title={STORAGE_COPY.reconciled.title}
              body={STORAGE_COPY.reconciled.body(pickedRef.name)}
            />
          </View>
        ) : null}

        {/* The stale list stays usable while the real one arrives. */}
        {stored.isRefetching && flow.kind === 'idle' && !vanished ? (
          <View className="mb-3">
            <StorageMark tone="quiet" title={STORAGE_COPY.staleRefreshing} />
          </View>
        ) : null}

        {notice ? (
          <View className="mb-3">
            <StorageNoticeBand notice={notice} onDoor={openDoor} />
          </View>
        ) : null}

        {/* Two columns, at every type size. The plates yield HEIGHT at AX
            rather than the grid dropping a column — see `PLATE.axHeight`. */}
        <View className="flex-row flex-wrap px-gutter" style={{ gap: PLATE.gutter }}>
          {items.map((item) => (
            <View key={item.id} style={{ width: `${COLUMN_PERCENT}%`, maxWidth: plateWidth }}>
              <StoragePlate
                item={item}
                uri={resolve(item.listingPath, item.thumbPath, item.cutoutPath)}
                selected={picked?.id === item.id}
                onPress={pick}
              />
            </View>
          ))}
        </View>
      </ScrollView>

      {/* The one control, on the band the frames draw it on. */}
      <View
        className="px-gutter pt-3"
        style={{ paddingBottom: insets.bottom + 12, gap: 8 }}>
        <PrimaryAction
          label={primaryLabel(picked ? pieceName(picked) : null)}
          disabled={blocked}
          loading={flow.kind === 'saving'}
          loadingLabel={STORAGE_COPY.chooser.saving}
          onPress={onPrimary}
        />
        {picked ? (
          <SecondaryAction
            label={STORAGE_COPY.clearSelection}
            onPress={() => {
              haptics.selection();
              setPickedRef(null);
            }}
          />
        ) : null}
      </View>

      {/* The chooser. Real plates, real names — you pick a coat by looking at
          the coat, which is the whole reason this stopped being an OS sheet. */}
      <StorageSheet
        visible={flow.kind === 'choosing' || flow.kind === 'saving'}
        onDismiss={() => {
          // Cancelling writes nothing and returns to the resting grid — the
          // frames pin it as identical to default by contract.
          if (flow.kind === 'saving') return;
          setFlow({ kind: 'idle' });
        }}>
        <SheetHead title={STORAGE_COPY.chooser.title} body={STORAGE_COPY.chooser.body} />

        <ScrollView style={{ maxHeight: ax ? 320 : 280 }} showsVerticalScrollIndicator={false}>
          <View style={{ gap: 8 }} accessibilityRole="radiogroup">
            {items.map((item) => (
              <ChooserRow
                key={item.id}
                item={item}
                uri={resolve(item.listingPath, item.thumbPath, item.cutoutPath)}
                selected={picked?.id === item.id}
                onPress={pick}
              />
            ))}
          </View>
        </ScrollView>

        <View className="mt-4" style={{ gap: 8 }}>
          <PrimaryAction
            label={STORAGE_COPY.chooser.confirm}
            disabled={picked === null || blocked}
            loading={flow.kind === 'saving'}
            loadingLabel={STORAGE_COPY.chooser.saving}
            onPress={() => picked && activate(picked)}
          />
          {/* Cancel is WITHDRAWN during the write, so there is no way to leave
              a sheet whose mutation is still in flight. */}
          {flow.kind === 'saving' ? null : (
            <SecondaryAction
              label={STORAGE_COPY.chooser.cancel}
              onPress={() => setFlow({ kind: 'idle' })}
            />
          )}
        </View>
      </StorageSheet>

      {/* The both-full recovery. Two constructive routes and no third. */}
      <StorageSheet visible={flow.kind === 'twoWays'} onDismiss={() => setFlow({ kind: 'idle' })}>
        <SheetHead title={STORAGE_COPY.twoWays.title} body={STORAGE_COPY.twoWays.body} />
        <View style={{ gap: 8 }}>
          <PrimaryAction label={STORAGE_COPY.twoWays.store} onPress={() => openDoor('store')} />
          <SecondaryAction label={STORAGE_COPY.twoWays.plans} onPress={() => openDoor('plans')} />
        </View>
      </StorageSheet>
    </Shell>
  );
}

/**
 * The page around whatever the screen is showing.
 *
 * A shell rather than a fragment repeated five times, because the header is the
 * one thing every state shares — the back control has to survive a failed read,
 * which is exactly the state somebody most needs to leave.
 */
function Shell({
  line,
  onBack,
  children,
}: {
  /** Null while nothing is known — the header then draws no arithmetic at all. */
  line: string | null;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <StorageHeader line={line ?? ''} onBack={onBack} />
      <View className="mt-4 flex-1">{children}</View>
    </SafeAreaView>
  );
}
