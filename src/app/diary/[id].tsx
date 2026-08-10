import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/ui/error-state';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { EntryMissing, EntryPage, EntrySkeleton } from '@/features/diary/entry-page';
import { groupByMonth, isCorrectable, postgresCode, unwearRefusal } from '@/features/diary/entry';
import {
  useKeepEntry,
  useSetEntryNote,
  useUnwearEntry,
  useWearAgain,
} from '@/features/diary/mutations';
import { NoteSheet } from '@/features/diary/note-sheet';
import { useDiary } from '@/features/diary/queries';
import type { DiaryPiece } from '@/features/diary/types';

/**
 * WD-03 — one day, opened.
 *
 * Read out of the SAME query the spine renders, so arriving here is a cache hit
 * rather than a second fetch, and a correction made here is reflected on the
 * list the moment it lands. Precedent: `item/[id].tsx` resolves its garment out
 * of `useCloset` for exactly this reason.
 *
 * Three writes live on this screen and each is narrower than it looks — see the
 * docblocks in `features/diary/mutations.ts`. The one worth restating here is
 * the correction: it is confirmed before it fires, because it deletes a wear
 * AND decrements five other surfaces' wear counts, and it surfaces the server's
 * own refusal past 24 hours rather than pretending the tap did nothing.
 */
export default function DiaryEntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const diary = useDiary();

  const wearAgain = useWearAgain();
  const keep = useKeepEntry();
  const setNote = useSetEntryNote();
  const unwear = useUnwearEntry();

  const [editingNote, setEditingNote] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const entries = diary.data ?? [];
  const entry = entries.find((e) => e.id === id) ?? null;

  // The month this day belongs to, and its total — the header's "August 2026 ·
  // 11 wears". Counted from the record rather than asked for separately, so the
  // header and the spine can never disagree.
  const month = groupByMonth(entries).find((m) => m.entries.some((e) => e.id === id)) ?? null;

  const { resolve } = useSignedUrls(entry ? entry.pieces.flatMap((p) => p.imagePaths) : []);
  const resolveImage = (piece: DiaryPiece) => resolve(...piece.imagePaths);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/diary'));

  if (diary.isLoading) return <EntrySkeleton onBack={goBack} />;

  if (diary.isError) {
    // A failed read is not a removed entry. Falling through to `EntryMissing`
    // would tell someone their day had been corrected away over a dropped
    // connection that never touched it.
    return (
      <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
        <ErrorState
          title="Couldn’t read this day."
          body="Cinch couldn’t reach your record just now. Nothing you wore has changed."
          onRetry={() => void diary.refetch()}
          retrying={diary.isRefetching}
        />
      </SafeAreaView>
    );
  }

  if (!entry || !month) return <EntryMissing onBack={goBack} />;

  /**
   * The correction, confirmed first.
   *
   * `unwear_outfit_tx` puts every piece's `wear_count` back as it deletes the
   * row — which is the whole reason it is a transaction — so this is not a
   * cosmetic delete and a stray tap should not perform it. The dialog names
   * both halves of what happens.
   */
  const confirmRemove = () => {
    setActionError(null);
    Alert.alert(
      'Remove this entry?',
      'The day comes off the record and each piece’s wear count goes back by one. This cannot be undone.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () =>
            unwear.mutate(
              { entryId: entry.id },
              {
                onSuccess: goBack,
                // The server owns the 24-hour rule, so its refusal is what gets
                // printed — `22023` becomes the rule itself rather than a
                // generic failure.
                onError: (err) => setActionError(unwearRefusal(postgresCode(err))),
              },
            ),
        },
      ],
    );
  };

  return (
    <>
      <EntryPage
        entry={entry}
        monthLabel={month.label}
        monthCount={month.count}
        onBack={goBack}
        resolveImage={resolveImage}
        onWearAgain={() => {
          setActionError(null);
          wearAgain.mutate(
            { entry },
            {
              // Land on today's entry, not back on the list: the wear just
              // written is the thing the tap was about.
              onSuccess: (outfitId) => router.replace(`/diary/${outfitId}`),
              onError: () =>
                setActionError(
                  'That didn’t go through. Nothing was recorded — check your connection and try again.',
                ),
            },
          );
        }}
        wearingAgain={wearAgain.isPending}
        onKeep={() => {
          setActionError(null);
          keep.mutate(
            { entryId: entry.id },
            {
              onError: () =>
                setActionError('Cinch couldn’t keep this plate. The entry itself is untouched.'),
            },
          );
        }}
        keeping={keep.isPending}
        onEditNote={() => {
          setNoteError(null);
          setEditingNote(true);
        }}
        correctable={isCorrectable(entry.wornAt)}
        onRemove={confirmRemove}
        removing={unwear.isPending}
        error={actionError}
      />

      <NoteSheet
        visible={editingNote}
        initial={entry.note ?? ''}
        busy={setNote.isPending}
        error={noteError}
        onCancel={() => {
          setNoteError(null);
          setEditingNote(false);
        }}
        onSave={(next) => {
          setNoteError(null);
          setNote.mutate(
            { entryId: entry.id, note: next },
            {
              onSuccess: () => setEditingNote(false),
              onError: () => setNoteError('That didn’t save. Check your connection and try again.'),
            },
          );
        }}
      />
    </>
  );
}
