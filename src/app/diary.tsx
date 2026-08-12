import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';

import { useSignedUrls } from '@/features/closet/use-image-urls';
import { DiaryPage } from '@/features/diary/diary-page';
import {
  ALL_YEARS,
  diaryTotalLine,
  filterByYear,
  groupByMonth,
  yearChips,
} from '@/features/diary/entry';
import { useDiary, usePlannedDays } from '@/features/diary/queries';
import type { DiaryPiece } from '@/features/diary/types';

/**
 * The Wear diary — WD-01, WD-03, and the loading and empty cuts.
 *
 * Every derivation and every navigation lives here; `DiaryPage` renders and
 * nothing else, and the fixture routes mount that same component over frozen
 * data. Same split as `friends/index.tsx` / `friends-page.tsx`, for the same
 * reason: what a reviewer signs off in the fixture is what ships, by
 * construction.
 *
 * The diary is a READ of a table the app has been writing since its first
 * build. Nothing on this screen creates a wear — that happens on a confirm,
 * elsewhere — which is why the empty state sends the reader to Plan rather than
 * offering a form.
 *
 * ── Two reads, and why the plans are the second one ───────────────────────
 *
 * WD-03 puts the days that are planned but not yet worn ABOVE the record. They
 * come from `outfit_calendar`, not from `outfits.worn_at`, and they are kept in
 * their own array right up to the point where the months are grouped: a plan is
 * not an entry, has no correction window and no wear counts behind it, and
 * `diary/[id].tsx` resolves an entry out of `useDiary` by id. Merging the two
 * upstream would let a link open a plan as a wear.
 *
 * The masthead's total and the year chips are computed from the WORN rows
 * alone, for the same reason: a plan is not a wear and must not be counted as
 * one.
 */
export default function DiaryScreen() {
  const router = useRouter();
  const diary = useDiary();
  const planned = usePlannedDays();

  /**
   * WD-03's undo notice, handed over by the entry page as it navigates back.
   *
   * A route param rather than shared state: the sentence is composed at the
   * moment the correction lands, from the counts as they stood before it, and
   * `unwear_outfit_tx`'s effect on those counts is defined rather than guessed
   * (see `undoneNotice`). Nothing here recomputes it, so nothing here can
   * disagree with what the user was told.
   */
  const { undone } = useLocalSearchParams<{ undone?: string }>();

  const [chip, setChip] = useState<string>(ALL_YEARS);

  const entries = diary.data ?? [];
  const plans = planned.data ?? [];

  /**
   * MEMOISED BY THE COMPILER, deliberately not by hand — same reasoning as the
   * harmony walk in `item/[id].tsx`. `entries` is derived from `diary.data` in
   * this body, which React Compiler cannot prove stable through a manual
   * `useMemo`, so adding one makes the whole component bail out of
   * optimisation. The work is a sort and a group over one row per wear.
   */
  const chips = yearChips(entries);
  // Plans join the spine only for the current-year and all-time views. Filtered
  // to 2025, a plan for next Saturday is not part of what is being asked for.
  const withPlans = chip === ALL_YEARS ? [...plans, ...entries] : entries;
  const months = groupByMonth(filterByYear(withPlans, chip));

  /**
   * One signing request for every photograph on the page.
   *
   * Only the four pieces each row could show are signed: the row is a likeness,
   * not an inventory, and signing the fifth garment of every look would triple
   * the request for pixels nothing renders.
   */
  const { resolve } = useSignedUrls(
    [...plans, ...entries].flatMap((e) => e.pieces.slice(0, 4).flatMap((p) => p.imagePaths)),
  );
  const resolveImage = (piece: DiaryPiece) => resolve(...piece.imagePaths);

  return (
    <DiaryPage
      months={months}
      totalLine={diaryTotalLine(filterByYear(entries, chip), chip)}
      chips={chips}
      selectedChip={chip}
      onSelectChip={setChip}
      undoneNotice={typeof undone === 'string' && undone.trim() ? undone : null}
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
