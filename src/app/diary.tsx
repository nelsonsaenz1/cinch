import { useRouter } from 'expo-router';
import { useState } from 'react';

import { useSignedUrls } from '@/features/closet/use-image-urls';
import { DiaryPage } from '@/features/diary/diary-page';
import { ALL_YEARS, filterByYear, groupByMonth, yearChips } from '@/features/diary/entry';
import { useDiary } from '@/features/diary/queries';
import type { DiaryPiece } from '@/features/diary/types';

/**
 * The Wear diary — WD-01, WD-02, WD-04.
 *
 * Every derivation and every navigation lives here; `DiaryPage` renders and
 * nothing else, and `dev-diary.tsx` mounts that same component over fixtures.
 * Same split as `friends/index.tsx` / `friends-page.tsx`, for the same reason:
 * what a reviewer signs off in the fixture is what ships, by construction.
 *
 * The diary is a READ of a table the app has been writing since its first
 * build. Nothing on this screen creates a wear — that happens on a confirm,
 * elsewhere — which is why the empty state sends the reader to Plan rather than
 * offering a form.
 */
export default function DiaryScreen() {
  const router = useRouter();
  const diary = useDiary();

  const [chip, setChip] = useState<string>(ALL_YEARS);

  const entries = diary.data ?? [];

  /**
   * MEMOISED BY THE COMPILER, deliberately not by hand — same reasoning as the
   * harmony walk in `item/[id].tsx`. `entries` is derived from `diary.data` in
   * this body, which React Compiler cannot prove stable through a manual
   * `useMemo`, so adding one makes the whole component bail out of
   * optimisation. The work is a sort and a group over one row per wear.
   */
  const chips = yearChips(entries);
  const months = groupByMonth(filterByYear(entries, chip));

  /**
   * One signing request for every photograph on the page.
   *
   * Only the four pieces each tile can show are signed: the tile is a likeness,
   * not an inventory, and signing the fifth garment of every look would triple
   * the request for pixels nothing renders.
   */
  const { resolve } = useSignedUrls(
    entries.flatMap((e) => e.pieces.slice(0, 4).flatMap((p) => p.imagePaths)),
  );
  const resolveImage = (piece: DiaryPiece) => resolve(...piece.imagePaths);

  return (
    <DiaryPage
      months={months}
      chips={chips}
      selectedChip={chip}
      onSelectChip={setChip}
      loading={diary.isLoading}
      error={diary.isError}
      retrying={diary.isRefetching}
      onRetry={() => void diary.refetch()}
      // An empty design makes a claim about the data. Only once the read has
      // actually succeeded is "nothing recorded yet" a thing the app knows.
      showEmpty={!diary.isLoading && !diary.isError && entries.length === 0}
      onPlanToday={() => router.replace('/(tabs)/plan')}
      onOpenEntry={(id) => router.push(`/diary/${id}`)}
      onBack={() => router.back()}
      refreshing={diary.isRefetching}
      onRefresh={() => void diary.refetch()}
      resolveImage={resolveImage}
    />
  );
}
