import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ChooserRow,
  PrimaryAction,
  SecondaryAction,
  SheetHead,
  StorageEmpty,
  StorageHeader,
  StorageMark,
  StorageNoticeBand,
  StorageSkeleton,
  StoragePlate,
  StorageStop,
} from '@/components/storage/storage-parts';
import { Text } from '@/components/ui/text';
import { piece } from '@/components/closet/w3-g3-fixture-data';
import {
  capacityLine,
  PLATE,
  primaryLabel,
  restoreBlocked,
  STORAGE_COPY,
  storageNotice,
  storageState,
  type StorageState,
} from '@/features/closet/storage-spec';
import type { Item } from '@/schemas/item';
import { useTheme } from '@/theme/tokens';

/**
 * Redesign 25's frames, posed inert — the shared body behind `dev-st-01…12`.
 *
 * THE PRIMITIVES ARE THE REAL ONES. `StorageHeader`, `StoragePlate`,
 * `StorageNoticeBand`, `StorageMark`, `PrimaryAction`, `ChooserRow` and the
 * empty and stop states are exactly what `src/app/storage.tsx` draws, and every
 * number is computed by the real `capacityLine` / `storageState` /
 * `storageNotice` off `plans.ts` figures. What is faked is only the STATE: the
 * counts, the plan's ceilings, which query is in flight.
 *
 * A fixture that retyped the arithmetic would be a fixture that gets
 * screenshotted as evidence the ceilings are right when they are only
 * TRANSCRIBED — which on this screen, whose entire subject is arithmetic, would
 * be the one lie worth catching. So the poses carry raw counts and the spec
 * derives every sentence from them, exactly as the screen does.
 *
 * Every callback is a no-op, so no fixture can restore a row, open a paywall or
 * reach the network however hard it is tapped.
 */

/**
 * Four stored pieces, with the artifact's own names.
 *
 * No `thumbPath`: these draw the shared fallback, which is the correct
 * treatment for a fixture — it is also what the `garment-no-usable-image` frame
 * shows, and a fixture that reached for a signed URL would need a session.
 */
export const ST_PIECES: Item[] = [
  piece({ category: 'outerwear', subcategory: 'Wool overcoat', isArchived: true, wearCount: 12 }),
  piece({ category: 'top', subcategory: 'Cable knit', isArchived: true, wearCount: 7 }),
  piece({ category: 'top', subcategory: 'Linen shirt', isArchived: true, wearCount: 4 }),
  piece({ category: 'bottom', subcategory: 'Wide trousers', isArchived: true, wearCount: 9 }),
];

/** A name long enough to prove the plate lifts its row rather than truncating. */
export const ST_LONG_NAME: Item[] = [
  piece({
    category: 'outerwear',
    subcategory: 'Charcoal double-breasted wool overcoat with belt',
    isArchived: true,
  }),
  ...ST_PIECES.slice(1),
];

/**
 * A pose is the raw counts and nothing derived — the spec does the deriving,
 * here exactly as on the screen.
 */
export interface StPose {
  readonly items: Item[];
  readonly stored: number;
  /** Null poses the "capacity not yet resolved" case, where clauses drop. */
  readonly active: number | null;
  readonly activeLimit: number | null;
  readonly total: number | null;
  readonly totalLimit: number | null;
  readonly picked?: number;
  readonly mark?: 'restored' | 'failed' | 'reconciled' | 'refreshing';
  readonly body?: 'grid' | 'empty' | 'loading' | 'error';
  readonly sheet?: 'chooser' | 'twoWays';
}

export function StFrame({ id, name, pose }: { id: string; name: string; pose: StPose }) {
  const theme = useTheme();
  const [picked, setPicked] = useState<number | null>(pose.picked ?? null);

  const line = capacityLine({
    stored: pose.stored,
    active: pose.active,
    activeLimit: pose.activeLimit,
    total: pose.total,
    totalLimit: pose.totalLimit,
  });

  const state: StorageState | null =
    pose.active !== null && pose.activeLimit !== null && pose.total !== null && pose.totalLimit !== null
      ? storageState({
          active: pose.active,
          activeLimit: pose.activeLimit,
          total: pose.total,
          totalLimit: pose.totalLimit,
        })
      : null;

  const notice =
    state && pose.activeLimit !== null && pose.total !== null && pose.totalLimit !== null
      ? storageNotice({
          state,
          activeLimit: pose.activeLimit,
          total: pose.total,
          totalLimit: pose.totalLimit,
        })
      : null;

  const blocked = state !== null && restoreBlocked(state);
  const body = pose.body ?? 'grid';
  const pickedItem = picked === null ? null : (pose.items[picked] ?? null);

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <StorageHeader line={body === 'loading' || body === 'error' ? null : line} onBack={noop} />

      <View className="mt-4 flex-1">
        {body === 'loading' ? <StorageSkeleton /> : null}

        {body === 'error' ? (
          <StorageStop
            title={STORAGE_COPY.readError.title}
            body={STORAGE_COPY.readError.body}
            action={STORAGE_COPY.readError.action}
            onAction={noop}
          />
        ) : null}

        {body === 'empty' ? <StorageEmpty onBack={noop} /> : null}

        {body === 'grid' ? (
          <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
            {pose.mark === 'restored' ? (
              <View className="mb-3">
                <StorageMark
                  tone="positive"
                  title={STORAGE_COPY.restored.title('Wool overcoat')}
                  body={STORAGE_COPY.restored.body}
                />
              </View>
            ) : null}

            {pose.mark === 'failed' ? (
              <View className="mb-3">
                <StorageMark
                  tone="quiet"
                  title={STORAGE_COPY.writeFailed.title}
                  body={STORAGE_COPY.writeFailed.body}
                />
              </View>
            ) : null}

            {pose.mark === 'reconciled' ? (
              <View className="mb-3">
                <StorageMark
                  tone="quiet"
                  title={STORAGE_COPY.reconciled.title}
                  body={STORAGE_COPY.reconciled.body('Wool overcoat')}
                />
              </View>
            ) : null}

            {pose.mark === 'refreshing' ? (
              <View className="mb-3">
                <StorageMark tone="quiet" title={STORAGE_COPY.staleRefreshing} />
              </View>
            ) : null}

            {notice ? (
              <View className="mb-3">
                <StorageNoticeBand notice={notice} onDoor={noop} />
              </View>
            ) : null}

            <View className="flex-row flex-wrap px-gutter" style={{ gap: PLATE.gutter }}>
              {pose.items.map((item, i) => (
                <View key={item.id} style={{ width: '48%', maxWidth: PLATE.width }}>
                  <StoragePlate
                    item={item}
                    selected={picked === i}
                    onPress={() => setPicked((c) => (c === i ? null : i))}
                  />
                </View>
              ))}
            </View>
          </ScrollView>
        ) : null}
      </View>

      {body === 'grid' ? (
        <View className="px-gutter pb-4 pt-3" style={{ gap: 8 }}>
          <PrimaryAction
            label={primaryLabel(pickedItem ? nameOf(pickedItem) : null)}
            disabled={blocked}
            onPress={noop}
          />
          {pickedItem ? (
            <SecondaryAction label={STORAGE_COPY.clearSelection} onPress={() => setPicked(null)} />
          ) : null}
        </View>
      ) : null}

      {/* The sheets are drawn INLINE rather than in their `Modal`, so a
          screenshot of the fixture captures them — a modal over a fixture
          photographs as the screen behind it. */}
      {pose.sheet === 'chooser' ? (
        <View className="border-t border-hairline px-gutter pb-5 pt-4" style={{ backgroundColor: theme.canvas }}>
          <SheetHead title={STORAGE_COPY.chooser.title} body={STORAGE_COPY.chooser.body} />
          <View style={{ gap: 8 }}>
            {pose.items.slice(0, 3).map((item, i) => (
              <ChooserRow key={item.id} item={item} selected={i === 0} onPress={noop} />
            ))}
          </View>
          <View className="mt-4" style={{ gap: 8 }}>
            <PrimaryAction label={STORAGE_COPY.chooser.confirm} onPress={noop} />
            <SecondaryAction label={STORAGE_COPY.chooser.cancel} onPress={noop} />
          </View>
        </View>
      ) : null}

      {pose.sheet === 'twoWays' ? (
        <View className="border-t border-hairline px-gutter pb-5 pt-4" style={{ backgroundColor: theme.canvas }}>
          <SheetHead title={STORAGE_COPY.twoWays.title} body={STORAGE_COPY.twoWays.body} />
          <View style={{ gap: 8 }}>
            <PrimaryAction label={STORAGE_COPY.twoWays.store} onPress={noop} />
            <SecondaryAction label={STORAGE_COPY.twoWays.plans} onPress={noop} />
          </View>
        </View>
      ) : null}

      <Text variant="noteSmall" className="px-gutter pb-1 pt-2">
        {id} · {name}
      </Text>
    </SafeAreaView>
  );
}

function nameOf(item: Item): string {
  return item.subcategory ?? item.category;
}

function noop() {}

/** The `__DEV__` guard every fixture route shares. */
export function NotAvailable() {
  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-canvas">
      <Text variant="body">Not available in this build.</Text>
    </SafeAreaView>
  );
}
