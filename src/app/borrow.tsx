import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BorrowRequestRow } from '@/components/social/BorrowRequestRow';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
// Pre-declared seam (docs/design/field-guide-audit.md, Batch 1): `ListSkeleton`
// lands alongside `Skeleton`'s export. Code against the contract.
import { ListSkeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { useSignedUrls } from '@/features/closet/use-image-urls';
import { useAnswerBorrow, useCancelBorrow } from '@/features/social-graph/mutations';
import { useBorrowRequests } from '@/features/social-graph/queries';
import { type BorrowThread } from '@/features/social-graph/types';
import { useTheme } from '@/theme/tokens';

/**
 * Borrowing — both directions of every request, newest first.
 *
 * "Asked of you" sits above "You asked" because the top of this screen is for
 * the things that want a decision from *you*. There are no due dates and no
 * reminders anywhere below: the lifecycle is request → lend/decline →
 * returned, and the physical handover stays in real life where it belongs.
 */
export default function BorrowScreen() {
  const router = useRouter();
  const theme = useTheme();

  const threads = useBorrowRequests();
  const answer = useAnswerBorrow();
  const cancel = useCancelBorrow();

  // Which row's write is in flight, so one spinner never blocks the others.
  const [busyId, setBusyId] = useState<string | null>(null);

  const all = threads.data ?? [];
  const incoming = all.filter((t) => t.direction === 'incoming');
  const outgoing = all.filter((t) => t.direction === 'outgoing');

  const { resolve } = useSignedUrls(
    all.flatMap((t) => [t.item?.thumbPath, t.item?.cutoutPath]),
  );

  const onError = (title: string) => (err: unknown) =>
    Alert.alert(title, err instanceof Error ? err.message : 'Something went wrong. Try again.');

  const respond = (thread: BorrowThread, status: 'approved' | 'declined' | 'returned') => {
    setBusyId(thread.request.id);
    answer.mutate(
      { id: thread.request.id, answer: status },
      {
        onSettled: () => setBusyId(null),
        onError: onError('Could not update that request'),
      },
    );
  };

  const withdraw = (thread: BorrowThread) => {
    setBusyId(thread.request.id);
    cancel.mutate(
      { id: thread.request.id },
      {
        onSettled: () => setBusyId(null),
        onError: onError('Could not withdraw that request'),
      },
    );
  };

  const section = (title: string, rows: BorrowThread[], emptyLine: string) => (
    <>
      <Text variant="eyebrow" className="mb-2.5 mt-6">
        {title}
      </Text>
      <View className="overflow-hidden rounded-plate border border-rule bg-surface">
        {rows.length === 0 ? (
          <Text variant="body" className="px-4 py-3.5 text-faint">
            {emptyLine}
          </Text>
        ) : (
          rows.map((thread, i) => (
            <View key={thread.request.id}>
              {i > 0 ? <View className="h-px bg-hairline" /> : null}
              <BorrowRequestRow
                thread={thread}
                imageUri={resolve(thread.item?.thumbPath, thread.item?.cutoutPath)}
                busy={busyId === thread.request.id}
                onLend={(t) => respond(t, 'approved')}
                onDecline={(t) => respond(t, 'declined')}
                onReturned={(t) => respond(t, 'returned')}
                onCancel={withdraw}
              />
            </View>
          ))
        )}
      </View>
    </>
  );

  return (
    <SafeAreaView className="flex-1 bg-canvas" edges={['top']}>
      <View className="flex-row items-center justify-between px-gutter pt-2">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-full border border-rule active:opacity-60">
          <SymbolView name="chevron.left" size={15} tintColor={theme.ink} resizeMode="scaleAspectFit" />
        </Pressable>
        <Text variant="colophon">Between friends</Text>
        <View style={{ width: 36 }} />
      </View>

      <View className="px-gutter pt-3">
        <Text variant="display" trim accessibilityRole="header">
          Borrowing
        </Text>
      </View>

      {threads.isError ? (
        // A failed fetch is not a settled "nothing on loan" — it is its own
        // state, with its own way back in.
        <ErrorState
          title="Couldn’t load your borrowing"
          body="Something went wrong reaching these requests. Nothing here has changed — try again."
          onRetry={() => void threads.refetch()}
        />
      ) : threads.isLoading ? (
        // The initial load used to fall through to the same `rows.length ===
        // 0` branch each section renders once settled, so "Nothing on loan"
        // and "No one has asked for anything." appeared before any data had
        // arrived. Loading now has its own shape, so empty can only ever mean
        // the query succeeded and came back with nothing.
        <View className="px-gutter pt-6">
          <ListSkeleton count={3} />
        </View>
      ) : all.length === 0 ? (
        <EmptyState
          symbol="hanger"
          title="Nothing on loan"
          body="When a friend asks to borrow one of your pieces — or you ask for one of hers — it shows up here."
          actionTitle="Browse your friends"
          onAction={() => router.push('/friends')}
        />
      ) : (
        <ScrollView
          contentContainerClassName="px-gutter pb-24"
          refreshControl={
            <RefreshControl
              refreshing={threads.isRefetching}
              onRefresh={() => void threads.refetch()}
            />
          }>
          {section('Asked of you', incoming, 'No one has asked for anything.')}
          {section('You asked', outgoing, 'You haven’t asked to borrow anything.')}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
